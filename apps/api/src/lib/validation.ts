import { ZodError } from 'zod';

/** Handles Zod errors across workspace package/module boundaries. */
export function isZodError(error: unknown): error is ZodError {
  return error instanceof ZodError || (
    typeof error === 'object'
    && error !== null
    && Array.isArray((error as { issues?: unknown }).issues)
  );
}
