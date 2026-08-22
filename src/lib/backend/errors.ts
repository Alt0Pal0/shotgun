import { AppError } from "./types";

const STATUS: Record<string, number> = {
  UNAUTHENTICATED: 401, FORBIDDEN: 403, NOT_FOUND: 404, INVALID_STATE: 409, VALIDATION: 422, NOT_STATIONARY: 409, OVERLAP: 409,
};

/** Map a Postgres exception raised by app.fail() (detail = code) into an AppError. */
export function toAppError(e: unknown): AppError {
  if (e instanceof AppError) return e;
  const err = e as { message?: string; detail?: string; details?: string; hint?: string; code?: string };
  const detail = err.detail ?? err.details ?? "";
  const code = STATUS[detail] ? detail : err.code === "42501" ? "FORBIDDEN" : err.code === "23505" ? "CONFLICT" : "INTERNAL";
  const status = STATUS[code] ?? (code === "CONFLICT" ? 409 : 500);
  const message = err.message ?? "Unexpected error";
  return new AppError(code, status === 500 && process.env.NODE_ENV === "production" ? "Something went wrong" : message, status, err.hint);
}
