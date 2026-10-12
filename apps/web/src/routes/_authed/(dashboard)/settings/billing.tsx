import { useMutation } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { CreditCardIcon, ExternalLinkIcon, Loader2Icon } from "lucide-react";
import { type ComponentProps, type ReactNode, useEffect } from "react";
import { toast } from "sonner";
import { ContentLoading } from "@/components/feedback/full-screen-loading";
import { PricingMatrix } from "@/components/billing/pricing-matrix";
import { PricingSkeletonGrid } from "@/components/billing/pricing-skeleton-grid";
import { SubscriptionStatusBadge } from "@/components/shared/subscription-status-badge";

import { Button } from "@repo/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/card";
import { Skeleton } from "@repo/ui/skeleton";
import { getBillingUrls } from "@/configs/web-config";
import { useBillingStatusQuery, usePaymentPlansQuery } from "@/hooks/use-payments";
import { useTranslations } from "@/i18n";
import { createCheckoutSuccessUrl } from "@/lib/payments/checkout-redirect-url";
import { resolveBillingErrorMessage } from "@/lib/payments/error-message";
import { findPriceProvider } from "@/lib/payments/find-price-provider";
import { openProviderCheckoutUrl } from "@/lib/payments/open-checkout-url";
import {
  isWebUpgradeUnavailable,
  resolveWebCheckoutPolicyDecision,
} from "@/lib/payments/web-checkout-policy";
import { orpc } from "@/utils/orpc";

/** Props accepted by the shared pricing matrix component. */
type PricingMatrixProps = ComponentProps<typeof PricingMatrix>;
/** Price selection handler type reused by the billing page. */
type PricingMatrixOnSelectPrice = NonNullable<PricingMatrixProps["onSelectPrice"]>;
/** CTA label resolver type reused by the billing page. */
type PricingMatrixGetCtaLabel = NonNullable<PricingMatrixProps["getCtaLabel"]>;
/** CTA disabled-state resolver type reused by the billing page. */
type PricingMatrixIsCtaDisabled = NonNullable<PricingMatrixProps["isCtaDisabled"]>;
type BillingMembershipSectionProps = {
  title: string;
  children: ReactNode;
};

/** File-based route definition for the authenticated billing settings page. */
export const Route = createFileRoute("/_authed/(dashboard)/settings/billing")({
  component: RouteComponent,
  pendingComponent: ContentLoading,
});

/** Billing settings page for subscriptions and membership plans. */
function RouteComponent() {
  const t = useTranslations("dashboard.billing");
  const tPricing = useTranslations("landingPage.pricing");
  const plansQuery = usePaymentPlansQuery();
  const plans = plansQuery.data ?? [];
  const statusQuery = useBillingStatusQuery();
  const billingUrls = getBillingUrls();

  const createCheckout = useMutation({
    ...orpc.web.payments.createCheckoutSession.mutationOptions(),
    onSuccess: ({ url }) => {
      openProviderCheckoutUrl(url);
    },
    onError: (error: Error) => {
      toast.error(resolveBillingErrorMessage(error, t, "checkoutError"));
    },
  });

  const createPortal = useMutation({
    ...orpc.web.payments.createPortalSession.mutationOptions(),
    onSuccess: ({ url }) => {
      openProviderCheckoutUrl(url, { newTab: billingProvider === "waffo" });
    },
    onError: (error: Error) => {
      toast.error(`${t("portalError")}: ${error.message}`);
    },
  });
  const upgradeSubscription = useMutation({
    ...orpc.web.payments.upgradeSubscription.mutationOptions(),
    onSuccess: async () => {
      await statusQuery.refetch();
      toast.success(t("upgradeSuccess"));
    },
    onError: (error: Error) => {
      toast.error(resolveBillingErrorMessage(error, t, "upgradeError"));
    },
  });

  const webBilling = statusQuery.data?.billingDomains.web ?? null;
  const subscriptionStatus = webBilling?.subscription?.status ?? null;
  const billingProvider = webBilling?.provider ?? null;
  const canManageBilling = webBilling?.canManageBilling ?? false;
  const shouldShowPlans = statusQuery.data?.currentEntitlement.tier !== "lifetime";
  const isFreeTier = statusQuery.data?.currentEntitlement.tier === "free";
  const ctaPending =
    createCheckout.isPending || createPortal.isPending || upgradeSubscription.isPending;

  /** Opens the provider-hosted billing portal for subscription management. */
  const handleOpenPortal = () => {
    if (!billingProvider) {
      return;
    }

    createPortal.mutate({
      returnUrl: billingUrls.returnURL,
      provider: billingProvider,
    });
  };

  /** Handles membership plan checkout or same-provider subscription upgrades. */
  const onSelectPrice: PricingMatrixOnSelectPrice = ({ planId, priceMeta }) => {
    const decision = resolveWebCheckoutPolicyDecision(
      statusQuery.data,
      priceMeta
        ? {
            id: priceMeta.priceId,
            priceType: priceMeta.priceType,
            interval: priceMeta.interval,
          }
        : null,
    );
    const targetProvider = findPriceProvider(plans, priceMeta.priceId);
    const canUseDirectProviderUpgrade =
      decision.action === "upgrade" &&
      (billingProvider === "stripe" || billingProvider === "creem") &&
      targetProvider === billingProvider;

    if (canUseDirectProviderUpgrade) {
      upgradeSubscription.mutate({
        planId,
        priceId: priceMeta.priceId,
      });
      return;
    }

    if (decision.action !== "checkout" || !priceMeta) {
      return;
    }

    createCheckout.mutate({
      planId,
      priceId: priceMeta.priceId,
      successUrl: createCheckoutSuccessUrl(billingUrls.successURL, {
        planId,
        priceId: priceMeta.priceId,
      }),
      cancelUrl: billingUrls.cancelURL,
    });
  };

  /** Resolves the primary CTA label for each pricing option. */
  const getCtaLabel: PricingMatrixGetCtaLabel = ({ priceMeta }) => {
    if (!priceMeta) {
      return tPricing("cta.getStarted");
    }
    if (statusQuery.isLoading) {
      return t("startCheckout");
    }

    const decision = resolveWebCheckoutPolicyDecision(statusQuery.data, {
      id: priceMeta.priceId,
      priceType: priceMeta.priceType,
      interval: priceMeta.interval,
    });

    if (decision.reason === "current_price") {
      return t("currentPlanCta");
    }
    if (decision.reason === "managed_by_other_channel") {
      return t("managedByOtherChannel");
    }
    if (decision.reason === "subscription_upgrade") {
      const targetProvider = findPriceProvider(plans, priceMeta.priceId);
      if (isWebUpgradeUnavailable(billingProvider, targetProvider)) {
        return t("upgradeUnavailable");
      }
      return t("upgradeSubscription");
    }
    if (decision.reason === "already_lifetime") {
      return t("alreadyLifetime");
    }
    if (decision.reason === "downgrade_or_same_tier") {
      return t("downgradeNotAllowed");
    }

    return t("startCheckout");
  };

  /** Disables pricing CTAs while loading, pending, or blocked by entitlement policy. */
  const isCtaDisabled: PricingMatrixIsCtaDisabled = ({ priceMeta }) => {
    if (!priceMeta) {
      return true;
    }
    if (statusQuery.isLoading || ctaPending) {
      return true;
    }

    const decision = resolveWebCheckoutPolicyDecision(statusQuery.data, {
      id: priceMeta.priceId,
      priceType: priceMeta.priceType,
      interval: priceMeta.interval,
    });
    const targetProvider = findPriceProvider(plans, priceMeta.priceId);
    if (
      decision.reason === "subscription_upgrade" &&
      isWebUpgradeUnavailable(billingProvider, targetProvider)
    ) {
      return true;
    }

    return decision.action === "disabled";
  };

  useEffect(() => {
    // Stripe can leave a subscription incomplete while payment confirmation is still settling.
    if (subscriptionStatus !== "incomplete") {
      return;
    }

    const interval = setInterval(() => {
      statusQuery.refetch();
    }, 3000);

    return () => clearInterval(interval);
  }, [subscriptionStatus, statusQuery.refetch]);

  return (
    <BillingMembershipSection title={t("sectionTitle")}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCardIcon className="size-5" />
            {t("title")}
          </CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </CardHeader>
        <CardContent>
          {statusQuery.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-56" />
            </div>
          ) : (
            <div className="rounded-lg border bg-muted/20 p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">{t("currentPlan")}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <SubscriptionStatusBadge className="mt-1" />
                  </div>
                </div>
                {!isFreeTier && canManageBilling ? (
                  <Button
                    variant="outline"
                    disabled={createPortal.isPending}
                    onClick={handleOpenPortal}
                  >
                    {createPortal.isPending && <Loader2Icon className="mr-2 size-4 animate-spin" />}
                    {t("manageBilling")}
                    <ExternalLinkIcon className="ml-2 size-4" />
                  </Button>
                ) : null}
              </div>
              {subscriptionStatus === "incomplete" ? (
                <div className="mt-3 flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm text-muted-foreground">
                  <Loader2Icon className="size-4 animate-spin" />
                  <span>{t("subscriptionSyncing")}</span>
                </div>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("plansTitle")}</CardTitle>
          <CardDescription>
            {shouldShowPlans ? t("plansDescription") : t("alreadyLifetime")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {plansQuery.isLoading ? (
            <PricingSkeletonGrid
              count={3}
              className="items-stretch gap-6"
              gridClassName="max-w-none gap-4 xl:grid-cols-3"
            />
          ) : plansQuery.data?.length ? (
            <PricingMatrix
              plans={plansQuery.data}
              animate={false}
              showEnterprise={false}
              onSelectPrice={onSelectPrice}
              getCtaLabel={getCtaLabel}
              isCtaDisabled={isCtaDisabled}
              ctaLoading={ctaPending}
              showCtaArrow={false}
              className="items-stretch gap-6"
              gridClassName="max-w-none gap-4 xl:grid-cols-3"
            />
          ) : (
            <p className="text-sm text-muted-foreground">{t("noPlans")}</p>
          )}
        </CardContent>
      </Card>
    </BillingMembershipSection>
  );
}

function BillingMembershipSection({ title, children }: BillingMembershipSectionProps) {
  return (
    <section aria-labelledby="billing-membership-section-title" className="space-y-6">
      <h1 id="billing-membership-section-title" className="text-2xl font-semibold tracking-tight">
        {title}
      </h1>
      {children}
    </section>
  );
}
