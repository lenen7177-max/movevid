import { getCheckoutDecisionReasonFromError } from "@repo/app-config/payments/web-policy";
import type { CheckoutDecisionReason } from "@repo/app-config/membership";

type BillingDecisionReason = Exclude<CheckoutDecisionReason, "ok">;
type BillingDecisionTranslationKey = `checkoutDecisionErrors.${BillingDecisionReason}`;
type BillingFallbackTranslationKey = "checkoutError" | "upgradeError" | "portalError";

/**
 * Resolves billing toast message from structured error payload or fallback text.
 */
export function resolveBillingErrorMessage(
  error: unknown,
  t: (key: BillingDecisionTranslationKey | BillingFallbackTranslationKey) => string,
  fallbackKey: BillingFallbackTranslationKey,
): string {
  const reason = getCheckoutDecisionReasonFromError(error);
  if (reason && reason !== "ok") {
    return t(`checkoutDecisionErrors.${reason}`);
  }

  const message = error instanceof Error ? error.message : "Unknown error";
  return `${t(fallbackKey)}: ${message}`;
}
