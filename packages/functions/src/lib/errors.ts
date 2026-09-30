import { CoinError } from '@pobe/core';

export type ErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'INSUFFICIENT'
  | 'QUOTA'
  | 'RATE_LIMITED'
  | 'GONE';

const STATUS: Record<ErrorCode, number> = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  GONE: 410,
  INSUFFICIENT: 422,
  QUOTA: 422,
  RATE_LIMITED: 429,
};

/** An error with a user-facing message: what went wrong and how to fix it. */
export class ApiError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
  get status() {
    return STATUS[this.code];
  }
}

export const notFound = (what: string) => new ApiError('NOT_FOUND', `${what} wasn't found. It may have been deleted.`);
export const forbidden = (msg = 'Only household admins can do that.') => new ApiError('FORBIDDEN', msg);
export const conflict = (msg: string) => new ApiError('CONFLICT', msg);
export const badRequest = (msg: string, details?: unknown) => new ApiError('BAD_REQUEST', msg, details);

/** Maps domain errors to API errors. */
export function toApiError(err: unknown): ApiError | null {
  if (err instanceof ApiError) return err;
  if (err instanceof CoinError) {
    return new ApiError(err.code === 'INSUFFICIENT' ? 'INSUFFICIENT' : 'BAD_REQUEST', err.message);
  }
  return null;
}
