export type PaymentFrequency = "monthly" | "yearly" | "lifetime";

export type PriceMeta = {
  priceId: string;
  currency: string;
  priceType: "subscription" | "lifetime";
  interval: "month" | "year" | null;
  trialDays: number | null;
};

export interface PricingTier {
  planId: string;
  name: string;
  description: string;
  features: string[];
  priceByFrequency: Record<PaymentFrequency, number | string>;
  priceMetaByFrequency: Record<PaymentFrequency, PriceMeta | null>;
  hasAnyPrice: boolean;
  highlighted?: boolean;
  popular?: boolean;
}

export type PlanPrice = {
  id: string;
  currency: string;
  amountCents: number;
  priceType: "subscription" | "lifetime";
  interval: "month" | "year" | null;
  trialDays: number | null;
  status: "active" | "archived";
};
