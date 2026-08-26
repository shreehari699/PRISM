/**
 * Uniform result type for the service layer. Every service function
 * returns one of these instead of throwing for expected failure modes
 * (not found, not owned, conflicting state, upstream unavailable) — a
 * route handler maps `code` to an HTTP status via `toHttpStatus` and
 * never has to guess what a thrown error meant.
 */
export type ServiceErrorCode =
  | "unauthenticated"
  | "not_found"
  | "invalid_input"
  | "conflict"
  | "unavailable"
  | "not_implemented"
  | "error";

export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: ServiceErrorCode; message: string };

export function ok<T>(data: T): ServiceResult<T> {
  return { ok: true, data };
}

export function fail<T = never>(
  code: ServiceErrorCode,
  message: string,
): ServiceResult<T> {
  return { ok: false, code, message };
}

export function toHttpStatus(code: ServiceErrorCode): number {
  switch (code) {
    case "unauthenticated":
      return 401;
    case "not_found":
      return 404;
    case "invalid_input":
      return 400;
    case "conflict":
      return 409;
    case "unavailable":
      return 503;
    case "not_implemented":
      return 501;
    case "error":
      return 500;
  }
}
