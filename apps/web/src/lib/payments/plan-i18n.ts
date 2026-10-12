import type { WebMessages } from "@repo/i18n/messages";

type PlanMessages = {
  name?: string;
  description?: string;
  features?: string[];
};

export function getPlanI18n(messages: WebMessages, planId: string) {
  const plans = messages.landingPage?.pricing?.plans as Record<string, PlanMessages> | undefined;
  const plan = plans?.[planId] ?? {};
  const features = Array.isArray(plan.features)
    ? plan.features.filter((feature) => typeof feature === "string")
    : [];

  return {
    name: typeof plan.name === "string" ? plan.name : planId,
    description: typeof plan.description === "string" ? plan.description : "",
    features,
  };
}
