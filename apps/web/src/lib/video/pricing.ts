import { resolveWebCommonConfig } from "@repo/app-config";

export type VideoPackPricing = { id: string; credits: number; amountCents: number };

export type VideoPricing = {
  packs: VideoPackPricing[];
  pro: { monthlyCents: number; yearlyCents: number; yearlySavePercent: number };
};

/** Display prices straight from app-config, so the page never drifts from checkout. */
export function getVideoPricing(): VideoPricing {
  const config = resolveWebCommonConfig();
  const packs = config.credits.packages
    .filter((pack) => pack.web && (pack.web.status ?? "active") === "active")
    .map((pack) => ({ id: pack.id, credits: pack.amount, amountCents: pack.web?.amountCents ?? 0 }))
    .sort((a, b) => a.amountCents - b.amountCents);

  const proPrices = config.payments?.plans.find((plan) => plan.id === "pro")?.prices ?? [];
  const monthlyCents = proPrices.find((price) => price.interval === "month")?.amountCents ?? 0;
  const yearlyCents = proPrices.find((price) => price.interval === "year")?.amountCents ?? 0;
  const yearlySavePercent =
    monthlyCents > 0 ? Math.round((1 - yearlyCents / (monthlyCents * 12)) * 100) : 0;

  return { packs, pro: { monthlyCents, yearlyCents, yearlySavePercent } };
}
