export type ApiClientErrorKind =
  | 'configuration'
  | 'invalid_request'
  | 'timeout'
  | 'aborted'
  | 'network'
  | 'http_status'
  | 'invalid_content_type'
  | 'empty_response'
  | 'invalid_json'
  | 'contract_mismatch';

export interface ApiClientErrorDetails {
  kind: ApiClientErrorKind;
  message: string;
  method?: 'GET';
  endpoint?: string;
  requestId?: string;
  status?: number;
  issues?: readonly string[];
  cause?: unknown;
}

export class ApiClientError extends Error {
  readonly kind: ApiClientErrorKind;
  readonly method: 'GET' | undefined;
  readonly endpoint: string | undefined;
  readonly requestId: string | undefined;
  readonly status: number | undefined;
  readonly issues: readonly string[];

  constructor(details: ApiClientErrorDetails) {
    super(details.message, details.cause === undefined ? undefined : { cause: details.cause });
    this.name = 'ApiClientError';
    this.kind = details.kind;
    this.method = details.method;
    this.endpoint = details.endpoint;
    this.requestId = details.requestId;
    this.status = details.status;
    this.issues = details.issues ?? [];
  }

  toJSON(): Record<string, unknown> {
    return {
      kind: this.kind,
      message: this.message,
      method: this.method,
      endpoint: this.endpoint,
      request_id: this.requestId,
      status: this.status,
      issues: this.issues,
    };
  }
}
