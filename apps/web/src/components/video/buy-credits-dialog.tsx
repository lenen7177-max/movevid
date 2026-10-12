import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/dialog";
import { formatCurrency } from "@repo/shared";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { openSignInDialog } from "@/components/auth/sign-in-dialog";
import { useCreditBalanceQuery } from "@/hooks/use-credits";
import { setPendingCreditOrderId, usePendingCreditOrder } from "@/hooks/use-pending-credit-order";
import { useUnfinishedCreditOrder } from "@/hooks/use-unfinished-credit-order";
import { useTranslations } from "@/i18n";
import { getAttributedTemplate } from "@/lib/analytics/attribution";
import { trackCreditPackCheckout } from "@/lib/analytics/events";
import { authClient } from "@/lib/auth/auth-client";
import { openProviderCheckoutUrl } from "@/lib/payments/open-checkout-url";
import { orpc } from "@/utils/orpc";
import { CreditPackGrid } from "./pricing-page";

type OpenBuyCreditsOptions = {
  /** Runs before leaving for the provider checkout, e.g. to keep uploaded photos. */
  beforeCheckout?: () => Promise<void>;
};

let dialogOpen = false;
let pendingOptions: OpenBuyCreditsOptions = {};
const listeners = new Set<() => void>();

function setDialogOpen(open: boolean) {
  dialogOpen = open;
  for (const listener of listeners) listener();
}

/** Opens the credit pack picker over the current page; signed-out users get the sign-in dialog. */
export function openBuyCreditsDialog(options: OpenBuyCreditsOptions = {}) {
  pendingOptions = options;
  setDialogOpen(true);
}

/** The checkout returns to the page it started from, minus any hash. */
function getReturnUrl() {
  const url = new URL(window.location.href);
  url.hash = "";
  return url.toString();
}

/**
 * Mounted once in the root layout: the pack picker dialog, plus the check that confirms a
 * pack bought from any page and refreshes every credit balance once it lands.
 */
export function BuyCreditsDialogRoot() {
  const t = useTranslations("dashboard.credits");
  const tPricing = useTranslations("video.pricing");
  const navigate = useNavigate();
  const { data: session } = authClient.useSession();
  const [open, setOpen] = useState(dialogOpen);

  useEffect(() => {
    const listener = () => setOpen(dialogOpen);
    listeners.add(listener);
    setOpen(dialogOpen);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const { pendingOrderId } = usePendingCreditOrder((order) => {
    toast.success(tPricing("creditsAddedToast", { credits: order.creditAmount }), {
      action: {
        label: tPricing("creditsAddedAction"),
        onClick: () => navigate({ to: "/studio" }),
      },
    });
  });

  const createCheckout = useMutation({
    ...orpc.web.credits.createCheckoutSession.mutationOptions(),
    onSuccess: async ({ url, orderId }) => {
      setPendingCreditOrderId(orderId);
      await pendingOptions.beforeCheckout?.();
      openProviderCheckoutUrl(url);
    },
    onError: (error: Error) => {
      toast.error(`${t("checkoutError")}: ${error.message}`);
    },
  });

  const buy = (packageId: string) => {
    if (!session) {
      setDialogOpen(false);
      openSignInDialog();
      return;
    }
    trackCreditPackCheckout(packageId);
    createCheckout.mutate({
      packageId,
      returnUrl: getReturnUrl(),
      templateId: getAttributedTemplate(),
    });
  };

  // A buyer who left a pack unpaid gets one nudge to finish it on a later visit.
  useUnfinishedCreditOrder(Boolean(session) && !pendingOrderId, (order) => {
    toast(
      tPricing("unfinishedToast", {
        credits: order.creditAmount,
        price: formatCurrency(order.amountCents, order.currency),
      }),
      {
        duration: 15_000,
        action: { label: tPricing("unfinishedAction"), onClick: () => buy(order.packageId) },
      },
    );
  });

  return (
    <Dialog open={open} onOpenChange={setDialogOpen}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle>{t("purchaseTitle")}</DialogTitle>
          <DialogDescription>
            {session ? <CurrentBalance label={t("balanceLabel")} /> : t("purchaseDescription")}
          </DialogDescription>
        </DialogHeader>
        {/* pt-2 leaves room for the badges that sit on the card borders. */}
        <div className="pt-2">
          <CreditPackGrid
            busyKey={
              createCheckout.isPending ? (createCheckout.variables?.packageId ?? null) : null
            }
            isPending={createCheckout.isPending}
            onBuy={buy}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CurrentBalance({ label }: { label: string }) {
  const balanceQuery = useCreditBalanceQuery();
  return (
    <>
      {label}:{" "}
      <span className="text-foreground font-semibold">{balanceQuery.data?.balance ?? "—"}</span>
    </>
  );
}
