import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { setPendingCreditOrderId } from "@/hooks/use-pending-credit-order";
import { useTranslations } from "@/i18n";
import { getAttributedTemplate } from "@/lib/analytics/attribution";
import { trackCreditPackCheckout } from "@/lib/analytics/events";
import { ensureSession } from "@/lib/auth/guest-session";
import { openProviderCheckoutUrl } from "@/lib/payments/open-checkout-url";
import { orpc } from "@/utils/orpc";

function getCurrentPageUrl() {
  const url = new URL(window.location.href);
  url.hash = "";
  url.search = "";
  return url.toString();
}

/** Credit pack checkout for the public pricing page. */
export function usePricingCheckout() {
  const tCredits = useTranslations("dashboard.credits");

  const createCreditCheckout = useMutation({
    ...orpc.web.credits.createCheckoutSession.mutationOptions(),
    onSuccess: ({ url, orderId }) => {
      setPendingCreditOrderId(orderId);
      openProviderCheckoutUrl(url);
    },
    onError: (error: Error) => {
      toast.error(`${tCredits("checkoutError")}: ${error.message}`);
    },
  });

  const buyCredits = async (packageId: string) => {
    // Signed-out buyers pay as guests; Stripe asks for their email.
    if (!(await ensureSession())) {
      toast.error(tCredits("checkoutError"));
      return;
    }
    trackCreditPackCheckout(packageId);
    createCreditCheckout.mutate({
      packageId,
      returnUrl: getCurrentPageUrl(),
      templateId: getAttributedTemplate(),
    });
  };

  const busyKey = createCreditCheckout.isPending
    ? (createCreditCheckout.variables?.packageId ?? "credits")
    : null;

  return {
    buyCredits,
    busyKey,
    isPending: busyKey !== null,
  };
}
