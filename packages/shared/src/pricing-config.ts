type PricingConfigStatus = "active" | "archived";

export type PricingConfigPrice<
  Provider extends string,
  PriceKind extends string,
  Interval extends string,
> = {
  id: string;
  provider: Provider;
  providerPriceId: string;
  currency: string;
  amountCents: number;
  priceType: PriceKind;
  interval?: Interval | null;
  status?: PricingConfigStatus;
};

export type PricingConfigPlan<
  Provider extends string,
  PriceKind extends string,
  Interval extends string,
> = {
  id: string;
  status?: PricingConfigStatus;
  prices?: PricingConfigPrice<Provider, PriceKind, Interval>[];
};

export type NormalizedPricingConfigPrice<
  Provider extends string,
  PriceKind extends string,
  Interval extends string,
> = {
  id: string;
  planId: string;
  provider: Provider;
  providerPriceId: string;
  currency: string;
  amountCents: number;
  priceType: PriceKind;
  interval: Interval | null;
  status: PricingConfigStatus;
};

export type NormalizedPricingConfigPlan<
  Provider extends string,
  PriceKind extends string,
  Interval extends string,
> = {
  id: string;
  status: PricingConfigStatus;
  prices: NormalizedPricingConfigPrice<Provider, PriceKind, Interval>[];
};

type NormalizePlanPricingConfigInput<
  Provider extends string,
  PriceKind extends string,
  Interval extends string,
> = {
  plans?: PricingConfigPlan<Provider, PriceKind, Interval>[];
  supportedProviders: readonly Provider[];
  supportedPriceTypes: readonly PriceKind[];
  supportedIntervals: readonly Interval[];
  subscriptionPriceType: PriceKind;
  lifetimePriceType: PriceKind;
  errorPrefix: string;
};

/**
 * Validates and normalizes plan/price configuration shape.
 */
export function normalizePlanPricingConfig<
  Provider extends string,
  PriceKind extends string,
  Interval extends string,
>(
  input: NormalizePlanPricingConfigInput<Provider, PriceKind, Interval>,
): NormalizedPricingConfigPlan<Provider, PriceKind, Interval>[] {
  const plans = Array.isArray(input.plans) ? input.plans : [];
  const planIds = new Set<string>();
  const priceIds = new Set<string>();
  const providerPriceIds = new Set<string>();
  const normalizedPlans: NormalizedPricingConfigPlan<Provider, PriceKind, Interval>[] = [];

  for (const plan of plans) {
    if (!plan.id) {
      throw new Error(`${input.errorPrefix} Plan id is required.`);
    }
    if (planIds.has(plan.id)) {
      throw new Error(`${input.errorPrefix} Duplicate plan id: ${plan.id}`);
    }
    planIds.add(plan.id);

    if (plan.status && plan.status !== "active" && plan.status !== "archived") {
      throw new Error(`${input.errorPrefix} Invalid plan status for plan ${plan.id}.`);
    }

    const planStatus: PricingConfigStatus = plan.status ?? "active";
    const prices = Array.isArray(plan.prices) ? plan.prices : [];

    const normalizedPrices: NormalizedPricingConfigPrice<Provider, PriceKind, Interval>[] =
      prices.map((price) => {
        if (!price.id) {
          throw new Error(`${input.errorPrefix} Price id is required for plan ${plan.id}.`);
        }
        if (!price.providerPriceId) {
          throw new Error(
            `${input.errorPrefix} providerPriceId is required for price ${price.id}.`,
          );
        }
        if (!price.currency) {
          throw new Error(`${input.errorPrefix} currency is required for price ${price.id}.`);
        }
        if (!Number.isInteger(price.amountCents) || price.amountCents <= 0) {
          throw new Error(
            `${input.errorPrefix} amountCents must be a positive number for price ${price.id}.`,
          );
        }

        if (priceIds.has(price.id)) {
          throw new Error(`${input.errorPrefix} Duplicate price id: ${price.id}`);
        }
        priceIds.add(price.id);

        const providerKey = `${price.provider}:${price.providerPriceId}`;
        if (providerPriceIds.has(providerKey)) {
          throw new Error(`${input.errorPrefix} Duplicate provider price id: ${providerKey}`);
        }
        providerPriceIds.add(providerKey);

        if (!input.supportedProviders.includes(price.provider)) {
          throw new Error(
            `${input.errorPrefix} Unsupported provider: ${price.provider} for price ${price.id}.`,
          );
        }
        if (!input.supportedPriceTypes.includes(price.priceType)) {
          throw new Error(`${input.errorPrefix} Invalid priceType for price ${price.id}.`);
        }
        if (
          price.priceType === input.subscriptionPriceType &&
          (!price.interval || !input.supportedIntervals.includes(price.interval))
        ) {
          throw new Error(
            `${input.errorPrefix} Subscription price ${price.id} requires a valid interval.`,
          );
        }
        if (price.priceType === input.lifetimePriceType && price.interval) {
          throw new Error(
            `${input.errorPrefix} Lifetime price ${price.id} must not include an interval.`,
          );
        }
        if (price.interval && !input.supportedIntervals.includes(price.interval)) {
          throw new Error(`${input.errorPrefix} Invalid interval for price ${price.id}.`);
        }

        const priceStatus: PricingConfigStatus = price.status ?? "active";
        if (price.status && price.status !== "active" && price.status !== "archived") {
          throw new Error(`${input.errorPrefix} Invalid price status for price ${price.id}.`);
        }

        return {
          id: price.id,
          planId: plan.id,
          provider: price.provider,
          providerPriceId: price.providerPriceId,
          currency: price.currency,
          amountCents: price.amountCents,
          priceType: price.priceType,
          interval:
            price.priceType === input.subscriptionPriceType ? (price.interval as Interval) : null,
          status: priceStatus,
        };
      });

    normalizedPlans.push({
      id: plan.id,
      status: planStatus,
      prices: normalizedPrices,
    });
  }

  return normalizedPlans;
}
