import { ZodError } from 'zod';

/** Handles Zod errors across workspace package/module boundaries
 * (the shared package may throw a ZodError from a different module copy). */
export function isZodError(error: unknown): error is ZodError {
  return error instanceof ZodError || (
    typeof error === 'object'
    && error !== null
    && Array.isArray((error as { issues?: unknown }).issues)
  );
}

export function zodMessage(error: unknown): string {
  if (isZodError(error)) {
    const first = (error as { issues?: Array<{ message?: string }> }).issues?.[0];
    if (first?.message) return first.message;
    const legacy = (error as { errors?: Array<{ message?: string }> }).errors?.[0];
    if (legacy?.message) return legacy.message;
  }
  return 'Invalid input';
}
