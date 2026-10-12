export type PlanWithPrices = {
  prices: Array<{
    id: string;
    provider: string;
  }>;
};

/**
 * Resolves the provider key for a configured price.
 */
export function findPriceProvider(plans: PlanWithPrices[], priceId: string): string {
  for (const plan of plans) {
    const matchedPrice = plan.prices.find((price) => price.id === priceId);
    if (matchedPrice) {
      return matchedPrice.provider;
    }
  }

  throw new Error(`Unknown price provider for price "${priceId}"`);
}
