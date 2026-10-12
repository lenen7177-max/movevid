import { CHECKOUT_DECISION_REASONS, type CheckoutDecisionReason } from "../membership";

const CHECKOUT_DECISION_REASON_SET = new Set<string>(CHECKOUT_DECISION_REASONS);

/**
 * Checks if a value is a valid checkout decision reason.
 */
export function isCheckoutDecisionReason(value: unknown): value is CheckoutDecisionReason {
  return typeof value === "string" && CHECKOUT_DECISION_REASON_SET.has(value);
}

/**
 * Extracts checkout decision reason from known error payload shapes.
 */
export function getCheckoutDecisionReasonFromError(error: unknown): CheckoutDecisionReason | null {
  if (!error || typeof error !== "object") {
    return null;
  }

  const normalized = error as {
    checkoutDecisionReason?: unknown;
    reason?: unknown;
    data?: {
      reason?: unknown;
    };
  };

  const candidate =
    normalized.checkoutDecisionReason ?? normalized.data?.reason ?? normalized.reason;

  return isCheckoutDecisionReason(candidate) ? candidate : null;
}
