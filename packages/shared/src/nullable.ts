/**
 * Converts a nullable-or-undefined value into a nullable value.
 */
export function toNullable<T>(value: T | null | undefined): T | null {
  return value ?? null;
}
