import { useMutation } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CoinsIcon } from "lucide-react";
import { toast } from "sonner";
import { AnimatedNumberText } from "@repo/ui/animated-number-text";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/card";
import { ContentLoading } from "@/components/feedback/full-screen-loading";
import { Skeleton } from "@repo/ui/skeleton";
import { CreditPackGrid } from "@/components/video/pricing-page";
import { useCreditBalanceQuery } from "@/hooks/use-credits";
import { setPendingCreditOrderId } from "@/hooks/use-pending-credit-order";
import { useTranslations } from "@/i18n";
import { getAttributedTemplate } from "@/lib/analytics/attribution";
import { trackCreditPackCheckout } from "@/lib/analytics/events";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_authed/(dashboard)/credits/purchase")({
  component: RouteComponent,
  pendingComponent: ContentLoading,
});

function getCreditReturnUrl() {
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  return url.toString();
}

function RouteComponent() {
  const t = useTranslations("dashboard.credits");
  const creditBalanceQuery = useCreditBalanceQuery();

  const createCreditCheckout = useMutation({
    ...orpc.web.credits.createCheckoutSession.mutationOptions(),
    onSuccess: ({ url, orderId }) => {
      setPendingCreditOrderId(orderId);
      window.location.href = url;
    },
    onError: (error: Error) => {
      toast.error(`${t("checkoutError")}: ${error.message}`);
    },
  });

  const handleCreditCheckout = (packageId: string) => {
    trackCreditPackCheckout(packageId);
    createCreditCheckout.mutate({
      packageId,
      returnUrl: getCreditReturnUrl(),
      templateId: getAttributedTemplate(),
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CoinsIcon className="size-5" />
          {t("purchaseTitle")}
        </CardTitle>
        <CardDescription>{t("purchaseDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        <div className="bg-muted/30 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-2xl border p-5">
          <div>
            <p className="text-muted-foreground text-sm">{t("balanceLabel")}</p>
            {creditBalanceQuery.isLoading ? (
              <Skeleton className="mt-2 h-9 w-20" />
            ) : (
              <AnimatedNumberText
                value={creditBalanceQuery.data?.balance ?? 0}
                className="mt-1 block text-3xl font-semibold tabular-nums"
              />
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            {creditBalanceQuery.data?.expiringCredits ? (
              <p className="text-sm text-amber-600">
                {t("expiringNotice", { count: creditBalanceQuery.data.expiringCredits })}
              </p>
            ) : (
              <p className="text-muted-foreground max-w-md text-sm">{t("balanceDescription")}</p>
            )}
            <Link
              to="/credits/transactions"
              className="text-primary text-sm font-medium whitespace-nowrap hover:underline"
            >
              {t("transactionsPageTitle")} →
            </Link>
          </div>
        </div>
        {/* Room above the grid for the pack badges that sit on the card borders. */}
        <div className="pt-2">
          <CreditPackGrid
            busyKey={
              createCreditCheckout.isPending
                ? (createCreditCheckout.variables?.packageId ?? null)
                : null
            }
            isPending={createCreditCheckout.isPending}
            onBuy={handleCreditCheckout}
            gridClassName="sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5"
          />
        </div>
      </CardContent>
    </Card>
  );
}
