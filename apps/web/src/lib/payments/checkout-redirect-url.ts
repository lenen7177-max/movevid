type CheckoutRedirectTarget = {
  planId: string;
  priceId: string;
};

export function createCheckoutSuccessUrl(url: string, target: CheckoutRedirectTarget) {
  const successUrl = new URL(url);
  successUrl.searchParams.set("planId", target.planId);
  successUrl.searchParams.set("priceId", target.priceId);

  return successUrl.toString();
}
