/**
 * Normalizes unknown thrown values into `Error` instances.
 */
export function toError(cause: unknown, fallbackMessage = "Unknown error") {
  if (cause instanceof Error) {
    return cause;
  }

  return new Error(typeof cause === "string" ? cause : fallbackMessage);
}
