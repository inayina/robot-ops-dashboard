import { z } from 'zod';
import { ApiClientError } from './errors';

export type QueryValue = string | number | boolean | undefined;
export type QueryParameters = Readonly<Record<string, QueryValue>>;

export interface HttpClientOptions {
  baseUrl: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  requestIdFactory?: () => string;
}

export interface GetOptions {
  query?: QueryParameters;
  signal?: AbortSignal;
}

function defaultRequestId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

function formatIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join('.') : '<root>';
    return `${path}: ${issue.message}`;
  });
}

function extractServerMessage(body: string): string {
  try {
    const value: unknown = JSON.parse(body);
    if (typeof value !== 'object' || value === null) return '';
    const record = value as Record<string, unknown>;
    if (typeof record.error === 'string') return record.error;
    if (typeof record.detail === 'string') return record.detail;
    if (typeof record.detail === 'object' && record.detail !== null) {
      const detail = record.detail as Record<string, unknown>;
      if (typeof detail.detail === 'string') return detail.detail;
    }
  } catch {
    return '';
  }
  return '';
}

export class HttpClient {
  private readonly baseUrl: URL;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly requestIdFactory: () => string;

  constructor(options: HttpClientOptions) {
    let baseUrl: URL;
    try {
      baseUrl = new URL(options.baseUrl.endsWith('/') ? options.baseUrl : `${options.baseUrl}/`);
    } catch (cause) {
      throw new ApiClientError({
        kind: 'configuration',
        message: 'Platform base URL is invalid',
        cause,
      });
    }
    if (baseUrl.protocol !== 'http:' && baseUrl.protocol !== 'https:') {
      throw new ApiClientError({
        kind: 'configuration',
        message: 'Platform base URL must use HTTP or HTTPS',
      });
    }
    const timeoutMs = options.timeoutMs ?? 5_000;
    if (!Number.isInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 60_000) {
      throw new ApiClientError({
        kind: 'configuration',
        message: 'Platform timeout must be an integer between 1 and 60000 ms',
      });
    }
    this.baseUrl = baseUrl;
    this.timeoutMs = timeoutMs;
    if (options.fetchImpl === undefined && typeof globalThis.fetch !== 'function') {
      throw new ApiClientError({
        kind: 'configuration',
        message: 'A Fetch API implementation is required',
      });
    }
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
    this.requestIdFactory = options.requestIdFactory ?? defaultRequestId;
  }

  async get<Output>(path: string, schema: z.ZodType<Output>, options: GetOptions = {}): Promise<Output> {
    const endpoint = this.buildUrl(path, options.query);
    const requestId = this.requestIdFactory();
    const controller = new AbortController();
    let timedOut = false;
    const timeoutHandle = globalThis.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, this.timeoutMs);
    const abortFromCaller = (): void => controller.abort(options.signal?.reason);
    if (options.signal?.aborted === true) {
      abortFromCaller();
    } else {
      options.signal?.addEventListener('abort', abortFromCaller, { once: true });
    }

    let response: Response;
    try {
      response = await this.fetchImpl(endpoint, {
        method: 'GET',
        cache: 'no-store',
        headers: {
          Accept: 'application/json',
          'X-Request-ID': requestId,
        },
        signal: controller.signal,
      });
    } catch (cause) {
      const kind = timedOut ? 'timeout' : options.signal?.aborted === true ? 'aborted' : 'network';
      throw new ApiClientError({
        kind,
        method: 'GET',
        endpoint: endpoint.toString(),
        requestId,
        message: kind === 'timeout' ? `Platform request timed out after ${this.timeoutMs} ms` :
          kind === 'aborted' ? 'Platform request was aborted by the caller' : 'Platform network request failed',
        cause,
      });
    } finally {
      globalThis.clearTimeout(timeoutHandle);
      options.signal?.removeEventListener('abort', abortFromCaller);
    }

    const responseRequestId = response.headers.get('x-request-id') || requestId;
    let body: string;
    try {
      body = await response.text();
    } catch (cause) {
      throw new ApiClientError({
        kind: 'network',
        method: 'GET',
        endpoint: endpoint.toString(),
        requestId: responseRequestId,
        status: response.status,
        message: 'Platform response body could not be read',
        cause,
      });
    }
    if (!response.ok) {
      const detail = extractServerMessage(body);
      throw new ApiClientError({
        kind: 'http_status',
        method: 'GET',
        endpoint: endpoint.toString(),
        requestId: responseRequestId,
        status: response.status,
        message: detail || `Platform returned HTTP ${response.status}`,
      });
    }
    if (body.trim() === '') {
      throw new ApiClientError({
        kind: 'empty_response',
        method: 'GET',
        endpoint: endpoint.toString(),
        requestId: responseRequestId,
        status: response.status,
        message: 'Platform returned an empty response',
      });
    }
    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.toLowerCase().includes('application/json')) {
      throw new ApiClientError({
        kind: 'invalid_content_type',
        method: 'GET',
        endpoint: endpoint.toString(),
        requestId: responseRequestId,
        status: response.status,
        message: `Platform returned non-JSON content type: ${contentType || '<missing>'}`,
      });
    }

    let payload: unknown;
    try {
      payload = JSON.parse(body);
    } catch (cause) {
      throw new ApiClientError({
        kind: 'invalid_json',
        method: 'GET',
        endpoint: endpoint.toString(),
        requestId: responseRequestId,
        status: response.status,
        message: 'Platform returned invalid JSON',
        cause,
      });
    }

    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
      throw new ApiClientError({
        kind: 'contract_mismatch',
        method: 'GET',
        endpoint: endpoint.toString(),
        requestId: responseRequestId,
        status: response.status,
        issues: formatIssues(parsed.error),
        message: 'Platform response does not match the runtime contract',
      });
    }
    return parsed.data;
  }

  private buildUrl(path: string, query: QueryParameters | undefined): URL {
    if (!path.startsWith('/') || path.startsWith('//')) {
      throw new ApiClientError({
        kind: 'invalid_request',
        method: 'GET',
        message: 'Platform request path must be root-relative',
      });
    }
    const url = new URL(path.slice(1), this.baseUrl);
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
    return url;
  }
}
