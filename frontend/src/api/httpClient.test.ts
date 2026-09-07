import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ApiClientError } from './errors';
import { HttpClient } from './httpClient';

const ValueSchema = z.strictObject({ value: z.string() });

function jsonResponse(value: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

function clientWith(fetchImpl: typeof fetch, timeoutMs = 100): HttpClient {
  return new HttpClient({
    baseUrl: 'http://platform.test/data/v1',
    timeoutMs,
    fetchImpl,
    requestIdFactory: () => 'request-test-1',
  });
}

async function expectKind(promise: Promise<unknown>, kind: ApiClientError['kind']): Promise<ApiClientError> {
  try {
    await promise;
    throw new Error('expected request to reject');
  } catch (error) {
    expect(error).toBeInstanceOf(ApiClientError);
    const clientError = error as ApiClientError;
    expect(clientError.kind).toBe(kind);
    return clientError;
  }
}

describe('HttpClient', () => {
  it('returns only runtime-validated JSON and sends a request ID', async () => {
    let sentRequestId: string | null = null;
    const fetchImpl: typeof fetch = async (_input, init) => {
      sentRequestId = new Headers(init?.headers).get('x-request-id');
      return jsonResponse({ value: 'ok' }, 200, { 'x-request-id': 'platform-request-7' });
    };
    await expect(clientWith(fetchImpl).get('/health', ValueSchema)).resolves.toEqual({ value: 'ok' });
    expect(sentRequestId).toBe('request-test-1');
  });

  it('maps 404 and 500 responses to structured HTTP errors', async () => {
    const notFound = await expectKind(
      clientWith(async () => jsonResponse({ error: 'episode not found' }, 404)).get('/episodes/missing', ValueSchema),
      'http_status',
    );
    expect(notFound.status).toBe(404);
    expect(notFound.message).toBe('episode not found');

    const serverError = await expectKind(
      clientWith(async () => jsonResponse({ error: 'store unavailable' }, 500)).get('/episodes/failure', ValueSchema),
      'http_status',
    );
    expect(serverError.status).toBe(500);
  });

  it('distinguishes timeout from caller abort', async () => {
    const pendingFetch: typeof fetch = async (_input, init) => new Promise<Response>((_resolve, reject) => {
      const rejectAbort = (): void => reject(new DOMException('aborted', 'AbortError'));
      if (init?.signal?.aborted === true) {
        rejectAbort();
        return;
      }
      init?.signal?.addEventListener('abort', rejectAbort, { once: true });
    });
    await expectKind(clientWith(pendingFetch, 5).get('/slow', ValueSchema), 'timeout');

    const caller = new AbortController();
    caller.abort();
    await expectKind(clientWith(pendingFetch).get('/aborted', ValueSchema, { signal: caller.signal }), 'aborted');
  });

  it('rejects invalid JSON, non-JSON content, empty bodies, and schema drift', async () => {
    await expectKind(clientWith(async () => new Response('{', {
      headers: { 'content-type': 'application/json' },
    })).get('/invalid-json', ValueSchema), 'invalid_json');
    await expectKind(clientWith(async () => new Response('{"value":"ok"}', {
      headers: { 'content-type': 'text/plain' },
    })).get('/text', ValueSchema), 'invalid_content_type');
    await expectKind(clientWith(async () => new Response('', {
      headers: { 'content-type': 'application/json' },
    })).get('/empty', ValueSchema), 'empty_response');
    const mismatch = await expectKind(
      clientWith(async () => jsonResponse({ renamed_value: 'ok' })).get('/drift', ValueSchema),
      'contract_mismatch',
    );
    expect(mismatch.issues[0]).toContain('value');
  });

  it('does not permit absolute paths to escape the configured Platform origin', async () => {
    const client = clientWith(async () => jsonResponse({ value: 'unexpected' }));
    await expectKind(client.get('https://untrusted.test/data', ValueSchema), 'invalid_request');
  });
});
