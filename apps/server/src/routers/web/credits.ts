import { ORPCError } from "@orpc/server";
import { VIDEO_TEMPLATE_IDS } from "@repo/app-config/video";
import { z } from "zod";
import type { Context } from "@/lib/context";
import { protectedProcedure } from "@/lib/orpc";

/** Web payment providers that can create credit package checkout sessions. */
const webCreditProviderEnum = z.enum(["stripe", "creem"]);

/** Input schema for starting a web credit package checkout session. */
const createCreditCheckoutInputSchema = z.object({
  packageId: z.string(),
  returnUrl: z.url(),
  provider: webCreditProviderEnum.optional(),
  /** Template the buyer last worked with, for per-template conversion reporting. */
  templateId: z.enum(VIDEO_TEMPLATE_IDS).optional(),
});

/** Resolves the authenticated user for protected web credit endpoints. */
function resolveCreditUser(context: Context): { userId: string } {
  const userId = context.session?.user.id;
  if (!userId) {
    throw new ORPCError("UNAUTHORIZED", {
      message: context.t("errors.unauthorized"),
    });
  }

  return { userId };
}

/** Web-only credit routes for checkout creation. */
export const webCreditsRouter = {
  createCheckoutSession: protectedProcedure
    .input(createCreditCheckoutInputSchema)
    .output(z.object({ url: z.url(), orderId: z.string() }))
    .handler(async ({ context, input }) => {
      const user = resolveCreditUser(context);
      try {
        const session = await context.credits.createCheckoutSession({
          user,
          packageId: input.packageId,
          returnUrl: input.returnUrl,
          provider: input.provider,
          customerEmail: context.session?.user.email,
          templateId: input.templateId,
        });
        return { url: session.url, orderId: session.creditOrderId };
      } catch (error) {
        throw new ORPCError("BAD_REQUEST", {
          message: error instanceof Error ? error.message : "Credit checkout failed",
        });
      }
    }),
};
