import { ORPCError } from "@orpc/server";
import { SUPPORTED_WEB_PAYMENT_PROVIDERS } from "@repo/app-config";
import { getCheckoutDecisionReasonFromError } from "@repo/app-config/payments/web-policy";
import { z } from "zod";
import type { Context } from "@/lib/context";
import { protectedProcedure } from "@/lib/orpc";

const webProviderEnum = z.enum(SUPPORTED_WEB_PAYMENT_PROVIDERS);

/**
 * Schema for validating checkout session creation requests
 * Contains all parameters needed to initiate a payment flow
 */
const createCheckoutInputSchema = z.object({
  planId: z.string(), // Plan being purchased
  priceId: z.string(), // Specific price option selected
  successUrl: z.url(), // Where to redirect after successful payment
  cancelUrl: z.url(), // Where to redirect if payment is canceled
  provider: webProviderEnum.optional(), // Force specific web payment provider (optional)
});

/**
 * Schema for validating customer portal session creation requests
 * Used to allow customers to manage their existing subscriptions
 */
const createPortalInputSchema = z.object({
  returnUrl: z.url(), // Where to redirect after portal session
  provider: webProviderEnum.optional(), // Specific web payment provider (optional)
});

/**
 * Schema for validating in-app subscription upgrade requests.
 */
const upgradeSubscriptionInputSchema = z.object({
  planId: z.string(), // Target plan to upgrade into
  priceId: z.string(), // Target subscription price
  provider: webProviderEnum.optional(), // Force specific web payment provider (optional)
});

/**
 * Resolves current billing user from request context.
 *
 * @param context - Request context containing authenticated session.
 * @returns Current user identifier.
 * @throws ORPCError when session is missing.
 */
function resolveBillingUser(context: Context): { userId: string } {
  const userId = context.session?.user.id;
  if (!userId) {
    throw new ORPCError("UNAUTHORIZED", {
      message: context.t("errors.unauthorized"),
    });
  }

  return { userId };
}

/**
 * Web-only payment action endpoints.
 */
export const paymentsRouter = {
  /**
   * Creates a checkout session to initiate payment for a specific plan and price
   * Returns a URL that redirects the user to the payment provider's checkout page
   */
  createCheckoutSession: protectedProcedure
    .input(createCheckoutInputSchema)
    .output(
      z.object({
        url: z.url(), // Checkout URL to redirect user to
      }),
    )
    .handler(async ({ context, input }) => {
      const user = resolveBillingUser(context);
      try {
        const session = await context.payments.createCheckoutSession({
          user,
          planId: input.planId,
          priceId: input.priceId,
          successUrl: input.successUrl,
          cancelUrl: input.cancelUrl,
          provider: input.provider,
          customerEmail: context.session?.user.email, // Pre-fill customer email
        });
        return { url: session.url };
      } catch (error) {
        const reason = getCheckoutDecisionReasonFromError(error);
        if (reason) {
          throw new ORPCError("BAD_REQUEST", {
            message: "Checkout decision blocked",
            data: { reason },
          });
        }
        throw new ORPCError("BAD_REQUEST", {
          message: error instanceof Error ? error.message : "Checkout failed. Please try again.",
        });
      }
    }),

  /**
   * Creates a customer portal session for subscription management
   * Returns a URL that redirects the user to manage their existing subscriptions
   * (cancel, update payment method, view invoices, etc.)
   */
  createPortalSession: protectedProcedure
    .input(createPortalInputSchema)
    .output(
      z.object({
        url: z.url(), // Portal URL to redirect user to
      }),
    )
    .handler(async ({ context, input }) => {
      const user = resolveBillingUser(context);
      try {
        const session = await context.payments.createPortalSession({
          user,
          returnUrl: input.returnUrl,
          provider: input.provider,
        });
        return { url: session.url };
      } catch (error) {
        throw new ORPCError("BAD_REQUEST", {
          message:
            error instanceof Error ? error.message : "Portal session failed. Please try again.",
        });
      }
    }),

  /**
   * Upgrades an active subscription in-app without redirecting to provider portal.
   * This keeps upgrade-only guardrails and blocks reverse operations.
   */
  upgradeSubscription: protectedProcedure
    .input(upgradeSubscriptionInputSchema)
    .output(
      z.object({
        ok: z.boolean(),
      }),
    )
    .handler(async ({ context, input }) => {
      const user = resolveBillingUser(context);
      try {
        await context.payments.upgradeSubscription({
          user,
          planId: input.planId,
          priceId: input.priceId,
          provider: input.provider,
        });
        return { ok: true };
      } catch (error) {
        const reason = getCheckoutDecisionReasonFromError(error);
        if (reason) {
          throw new ORPCError("BAD_REQUEST", {
            message: "Upgrade decision blocked",
            data: { reason },
          });
        }

        throw new ORPCError("BAD_REQUEST", {
          message: error instanceof Error ? error.message : "Upgrade failed. Please try again.",
        });
      }
    }),
};
