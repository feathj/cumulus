/**
 * Errors a service can fail with. The codes are named after tRPC's so the API
 * layer maps them one-to-one, but services don't depend on tRPC: the MCP
 * server will call the same services and map these its own way.
 */
export type DomainErrorCode = 'NOT_FOUND' | 'CONFLICT' | 'BAD_REQUEST';

export class DomainError extends Error {
  readonly code: DomainErrorCode;

  constructor(code: DomainErrorCode, message: string) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
  }
}

export class NotFoundError extends DomainError {
  constructor(entity: string, key: string) {
    super('NOT_FOUND', `${entity} not found: ${key}`);
    this.name = 'NotFoundError';
  }
}
