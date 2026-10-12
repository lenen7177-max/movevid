import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { CheckCircleIcon, Loader2Icon } from "lucide-react";
import { useEffect } from "react";
import { z } from "zod";
import { buttonVariants } from "@repo/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/card";
import { useTranslations } from "@/i18n";
import { trackPurchase } from "@/lib/analytics/events";
import { getVideoPricing } from "@/lib/video/pricing";
import { orpc } from "@/utils/orpc";

const searchSchema = z.object({
  planId: z.string().optional(),
  priceId: z.string().optional(),
});

export const Route = createFileRoute("/billing/success")({
  validateSearch: searchSchema,
  component: RouteComponent,
});

function RouteComponent() {
  const t = useTranslations("billingSuccess");
  const navigate = useNavigate();
  const search = Route.useSearch();

  const statusQuery = useQuery(
    orpc.payments.getBillingStatus.queryOptions({
      staleTime: 0,
      refetchOnWindowFocus: true,
    }),
  );
  const hasExpectedCheckoutTarget = Boolean(search.planId && search.priceId);
  const isCheckoutSynced = hasExpectedCheckoutTarget
    ? statusQuery.data?.activePlan?.id === search.planId &&
      statusQuery.data?.activePrice?.id === search.priceId
    : Boolean(statusQuery.data?.activePlan);

  useEffect(() => {
    if (!isCheckoutSynced) return;
    const subscription = statusQuery.data?.subscription;
    if (subscription) {
      const yearly = subscription.priceId === "yearly";
      const pro = getVideoPricing().pro;
      // One purchase per subscription; renewals are not tracked here.
      trackPurchase(`sub:${subscription.id}`, {
        id: `${subscription.planId}:${subscription.priceId}`,
        name: yearly ? "Pro yearly" : "Pro monthly",
        cents: yearly ? pro.yearlyCents : pro.monthlyCents,
        currency: "usd",
        kind: "subscription",
      });
    }
    navigate({ to: "/settings/billing", replace: true });
  }, [isCheckoutSynced, navigate, statusQuery.data?.subscription]);

  useEffect(() => {
    if (statusQuery.isError || isCheckoutSynced) {
      return;
    }

    const interval = setInterval(() => {
      statusQuery.refetch();
    }, 3000);

    return () => clearInterval(interval);
  }, [isCheckoutSynced, statusQuery.isError, statusQuery.refetch]);

  const isSyncing = !statusQuery.isError && !isCheckoutSynced;

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl items-center px-4">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircleIcon className="size-5 text-green-600" />
            {t("title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{t("description")}</p>
          {isSyncing ? (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2Icon className="size-4 animate-spin" />
                <span>{t("syncingTitle")}</span>
              </div>
              <p className="text-xs text-muted-foreground">{t("syncingDescription")}</p>
            </div>
          ) : null}
          <Link className={buttonVariants()} to="/settings/billing">
            {t("goToBilling")}
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
