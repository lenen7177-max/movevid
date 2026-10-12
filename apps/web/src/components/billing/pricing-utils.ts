import { resolvePaymentPresentation } from "@repo/app-config/membership";
import type { PaymentFrequency, PlanPrice, PriceMeta, PricingTier } from "./pricing-types";

export function buildCtaHref(planId: string, priceId: string | null) {
  const params = new URLSearchParams({ planId });
  if (priceId) {
    params.set("priceId", priceId);
  }
  return `/auth/sign-in?${params.toString()}`;
}

type PricingPresentationKey =
  | "badge.bestValue"
  | "billingNote.billedAnnually"
  | "billingNote.flexibleCancelAnytime"
  | "billingNote.oneTimePurchase";

export function getPriceSuffix(
  t: (key: "oneTime" | "perYear" | "perMonth") => string,
  priceMeta: PriceMeta | null,
) {
  if (!priceMeta) return null;

  const presentation = resolvePaymentPresentation({
    priceType: priceMeta.priceType,
    interval: priceMeta.interval,
  });

  switch (presentation.kind) {
    case "lifetime":
      return t("oneTime");
    case "yearly":
      return t("perYear");
    case "monthly":
      return t("perMonth");
  }
}

export function getBillingNoteLabel(
  t: (key: PricingPresentationKey) => string,
  priceMeta: PriceMeta | null,
) {
  if (!priceMeta) {
    return null;
  }

  const presentation = resolvePaymentPresentation({
    priceType: priceMeta.priceType,
    interval: priceMeta.interval,
  });

  switch (presentation.billingNoteKey) {
    case "billed_annually":
      return t("billingNote.billedAnnually");
    case "flexible_cancel_anytime":
      return t("billingNote.flexibleCancelAnytime");
    case "one_time_purchase":
      return t("billingNote.oneTimePurchase");
  }
}

export function getBadgeLabel(t: (key: "badge.bestValue") => string, priceMeta: PriceMeta | null) {
  if (!priceMeta) {
    return null;
  }

  const presentation = resolvePaymentPresentation({
    priceType: priceMeta.priceType,
    interval: priceMeta.interval,
  });

  if (presentation.badgeKey === "best_value") {
    return t("badge.bestValue");
  }

  return null;
}

export function pickPriceByFrequency(prices: PlanPrice[], frequency: PaymentFrequency) {
  if (frequency === "lifetime") {
    return prices.find((price) => price.priceType === "lifetime") ?? null;
  }
  if (frequency === "yearly") {
    return (
      prices.find((price) => price.priceType === "subscription" && price.interval === "year") ??
      null
    );
  }
  return (
    prices.find((price) => price.priceType === "subscription" && price.interval === "month") ?? null
  );
}

export function shouldRenderSubscriptionTier(tier: PricingTier, frequency: PaymentFrequency) {
  if (!tier.hasAnyPrice) return true;
  return tier.priceMetaByFrequency[frequency] !== null;
}
