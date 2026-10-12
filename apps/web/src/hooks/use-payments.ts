import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { orpc } from "@/utils/orpc";

type UsePaymentPlansQueryOptions = {
  enabled?: boolean;
};

type UseCurrentSubscriptionOptions = {
  includePlan?: boolean;
};

type UseBillingStatusQueryOptions = {
  enabled?: boolean;
};

export function usePaymentPlansQuery(options?: UsePaymentPlansQueryOptions) {
  const enabled = options?.enabled ?? true;
  return useQuery(
    orpc.payments.listPlans.queryOptions({
      staleTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      enabled,
    }),
  );
}

export function useBillingStatusQuery(options?: UseBillingStatusQueryOptions) {
  const enabled = options?.enabled ?? true;

  return useQuery(
    orpc.payments.getBillingStatus.queryOptions({
      staleTime: 60_000,
      refetchOnWindowFocus: true,
      enabled,
    }),
  );
}

export function useCurrentSubscription(options?: UseCurrentSubscriptionOptions) {
  const includePlan = options?.includePlan ?? true;
  const billingQuery = useBillingStatusQuery();
  const plansQuery = usePaymentPlansQuery({ enabled: includePlan });

  const plansQueryData = includePlan ? plansQuery.data : undefined;
  const billingQueryData = billingQuery.data;

  // current active plan
  const activePlanId = billingQueryData?.activePlan?.id ?? null;
  // current active price
  const activePriceId = billingQueryData?.activePrice?.id ?? null;

  const plan = useMemo(() => {
    if (!includePlan) return null;
    if (!activePlanId || !plansQueryData) return null;
    return plansQueryData.find((item) => item.id === activePlanId) ?? null;
  }, [activePlanId, includePlan, plansQueryData]);

  const price = useMemo(() => {
    if (!activePriceId || !plan) return null;
    return plan.prices.find((item) => item.id === activePriceId) ?? null;
  }, [activePriceId, plan]);

  const subscription = billingQueryData?.subscription ?? null;

  const hasSubscription = billingQueryData?.hasActiveSubscription;

  const hasLifetime = billingQueryData?.lifetimePurchase;

  return {
    subscriptionStatus: subscription?.status ?? null,
    subscription,
    hasSubscription,
    hasLifetime,
    plan,
    planId: activePlanId,
    activePrice: billingQueryData?.activePrice ?? null,
    currentEntitlement: billingQueryData?.currentEntitlement ?? null,
    adminTrial: billingQueryData?.adminTrial ?? null,
    price,
    isLoading: billingQuery.isLoading || (includePlan && plansQuery.isLoading),
    isError: billingQuery.isError || (includePlan && plansQuery.isError),
    refetch: async () => {
      if (!includePlan) {
        await billingQuery.refetch();
        return;
      }
      await Promise.all([billingQuery.refetch(), plansQuery.refetch()]);
    },
  };
}
