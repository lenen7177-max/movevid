import * as React from "react";
import { AnimatedGroup } from "@repo/ui/animated-group";
import { Button } from "@repo/ui/button";
import { Card } from "@repo/ui/card";
import { messages, useLocale, useTranslations } from "@/i18n";
import { defaultLocale, isValidLocale } from "@/i18n/config";
import { getPlanI18n } from "@/lib/payments/plan-i18n";
import { cn } from "@/lib/utils";
import { PricingCard } from "./pricing-card";
import { Tab } from "./pricing-tab";
import type { PaymentFrequency, PlanPrice, PriceMeta, PricingTier } from "./pricing-types";
import { getBadgeLabel, pickPriceByFrequency, shouldRenderSubscriptionTier } from "./pricing-utils";

const transitionVariants = {
  item: {
    hidden: {
      opacity: 0,
    },
    visible: {
      opacity: 1,
      transition: {
        type: "tween",
        ease: "easeOut",
        duration: 1.5,
      },
    },
  },
} as const;

const ALL_FREQUENCIES: PaymentFrequency[] = ["monthly", "yearly", "lifetime"];
const SUBSCRIPTION_FREQUENCIES: PaymentFrequency[] = ["monthly", "yearly"];

type PricingPlan = {
  id: string;
  status: "active" | "archived";
  prices: Array<PlanPrice & { provider?: string }>;
};

type PricingMatrixAction = {
  planId: string;
  priceMeta: PriceMeta;
  paymentFrequency: PaymentFrequency;
};

type PricingMatrixHandlerInput = {
  tier: PricingTier;
  priceMeta: PriceMeta | null;
  paymentFrequency: PaymentFrequency;
};

interface PricingMatrixProps {
  plans: PricingPlan[];
  header?: React.ReactNode;
  animate?: boolean;
  showEnterprise?: boolean;
  showFrequencyTabs?: boolean;
  priceFilter?: (price: PlanPrice & { provider?: string }) => boolean;
  onSelectPrice?: (input: PricingMatrixAction) => void;
  getCtaLabel?: (input: PricingMatrixHandlerInput) => string;
  isCtaDisabled?: (input: PricingMatrixHandlerInput) => boolean;
  ctaLoading?: boolean;
  showCtaArrow?: boolean;
  gridClassName?: string;
  className?: string;
}

export function PricingMatrix({
  plans,
  header,
  animate = true,
  showEnterprise = true,
  showFrequencyTabs = true,
  priceFilter,
  onSelectPrice,
  getCtaLabel,
  isCtaDisabled,
  ctaLoading = false,
  showCtaArrow,
  gridClassName,
  className,
}: PricingMatrixProps) {
  const t = useTranslations("landingPage.pricing");
  const rawLocale = useLocale();
  const locale = isValidLocale(rawLocale) ? rawLocale : defaultLocale;
  const localeMessages = messages[locale] ?? messages[defaultLocale];
  const filteredPlans = React.useMemo(() => {
    if (!priceFilter) return plans;
    return plans.map((plan) => ({
      ...plan,
      prices: plan.prices.filter(priceFilter),
    }));
  }, [plans, priceFilter]);

  const frequencies = React.useMemo<PaymentFrequency[]>(() => {
    const available = new Set<PaymentFrequency>();
    let hasFreePlan = false;

    for (const plan of filteredPlans) {
      const activePrices = plan.prices;

      if (activePrices.length === 0) {
        hasFreePlan = true;
      }
      for (const price of activePrices) {
        if (price.priceType !== "subscription") continue;
        if (price.interval === "month") {
          available.add("monthly");
        }
        if (price.interval === "year") {
          available.add("yearly");
        }
      }
    }

    const list = SUBSCRIPTION_FREQUENCIES.filter((freq) => available.has(freq));
    if (list.length === 0 && hasFreePlan) {
      return ["monthly"];
    }
    return list;
  }, [filteredPlans]);

  const [preferredFrequency, setPreferredFrequency] = React.useState<PaymentFrequency>(
    frequencies[0] ?? "monthly",
  );
  const selectedFrequency = frequencies.includes(preferredFrequency)
    ? preferredFrequency
    : (frequencies[0] ?? "monthly");

  const { subscriptionTiers, lifetimeTiers } = React.useMemo(() => {
    const subscription: PricingTier[] = [];
    const lifetime: PricingTier[] = [];

    for (const plan of filteredPlans) {
      const prices = plan.prices;

      const hasAnyPrices = prices.length > 0;
      const subscriptionPrices = prices.filter((price) => price.priceType === "subscription");
      const lifetimePrices = prices.filter((price) => price.priceType === "lifetime");

      const { name, description, features } = getPlanI18n(localeMessages, plan.id);
      const baseTier = {
        planId: plan.id,
        name,
        description,
        features,
      };

      if (subscriptionPrices.length > 0 || !hasAnyPrices) {
        const priceByFrequency = {} as Record<PaymentFrequency, number | string>;
        const priceMetaByFrequency = {} as Record<PaymentFrequency, PriceMeta | null>;

        for (const frequency of ALL_FREQUENCIES) {
          const price =
            frequency === "lifetime" ? null : pickPriceByFrequency(subscriptionPrices, frequency);

          if (price) {
            priceByFrequency[frequency] = price.amountCents / 100;
            priceMetaByFrequency[frequency] = {
              priceId: price.id,
              currency: price.currency,
              priceType: price.priceType,
              interval: price.interval ?? null,
              trialDays: price.trialDays ?? null,
            };
          } else if (!hasAnyPrices) {
            priceByFrequency[frequency] = t("freeLabel");
            priceMetaByFrequency[frequency] = null;
          } else {
            priceByFrequency[frequency] = "";
            priceMetaByFrequency[frequency] = null;
          }
        }

        subscription.push({
          ...baseTier,
          priceByFrequency,
          priceMetaByFrequency,
          hasAnyPrice: hasAnyPrices,
        });
      }

      if (lifetimePrices.length > 0) {
        const priceByFrequency = {} as Record<PaymentFrequency, number | string>;
        const priceMetaByFrequency = {} as Record<PaymentFrequency, PriceMeta | null>;
        const lifetimePrice = lifetimePrices[0];

        for (const frequency of ALL_FREQUENCIES) {
          if (frequency === "lifetime") {
            priceByFrequency[frequency] = lifetimePrice.amountCents / 100;
            priceMetaByFrequency[frequency] = {
              priceId: lifetimePrice.id,
              currency: lifetimePrice.currency,
              priceType: lifetimePrice.priceType,
              interval: lifetimePrice.interval ?? null,
              trialDays: lifetimePrice.trialDays ?? null,
            };
          } else {
            priceByFrequency[frequency] = "";
            priceMetaByFrequency[frequency] = null;
          }
        }

        lifetime.push({
          ...baseTier,
          priceByFrequency,
          priceMetaByFrequency,
          hasAnyPrice: true,
        });
      }
    }

    return { subscriptionTiers: subscription, lifetimeTiers: lifetime };
  }, [filteredPlans, localeMessages, t]);

  const cardsKey = React.useMemo(
    () => filteredPlans.map((plan) => plan.id).join("|") || "empty",
    [filteredPlans],
  );
  const frequencyLabels = React.useMemo<Record<PaymentFrequency, string>>(
    () => ({
      monthly: t("frequencies.monthly"),
      yearly: t("frequencies.yearly"),
      lifetime: t("frequencies.lifetime"),
    }),
    [t],
  );
  const enterpriseFeatures = React.useMemo(
    () => [
      t("enterprise.features.first"),
      t("enterprise.features.second"),
      t("enterprise.features.third"),
    ],
    [t],
  );
  const yearlyBadgeLabel = React.useMemo(
    () =>
      getBadgeLabel(t, {
        priceId: "yearly",
        currency: "usd",
        priceType: "subscription",
        interval: "year",
        trialDays: null,
      }),
    [t],
  );
  const renderHeader = () => {
    if (!header && (!showFrequencyTabs || frequencies.length === 0)) {
      return null;
    }

    const content = (
      <div className="space-y-7 text-center">
        {header}
        {showFrequencyTabs && frequencies.length > 0 ? (
          <div className="mx-auto flex w-fit rounded-full bg-muted p-1">
            {frequencies.map((freq) => (
              <Tab
                key={freq}
                frequency={freq}
                label={frequencyLabels[freq]}
                selected={selectedFrequency === freq}
                setSelected={setPreferredFrequency}
                discountLabel={freq === "yearly" ? (yearlyBadgeLabel ?? undefined) : undefined}
                discount={freq === "yearly" && yearlyBadgeLabel !== null}
              />
            ))}
          </div>
        ) : null}
      </div>
    );

    if (!animate) {
      return content;
    }

    return (
      <AnimatedGroup
        variants={{
          container: {
            visible: {
              transition: {
                staggerChildren: 0.05,
                delayChildren: 0.1,
              },
            },
          },
          ...transitionVariants,
        }}
        className="space-y-7 text-center"
      >
        {content}
      </AnimatedGroup>
    );
  };

  const renderGrid = () => {
    const content = (
      <div
        className={cn("grid w-full max-w-6xl gap-6 sm:grid-cols-2 xl:grid-cols-4", gridClassName)}
      >
        {subscriptionTiers
          .filter((tier) => shouldRenderSubscriptionTier(tier, selectedFrequency))
          .map((tier) => {
            const priceMeta = tier.priceMetaByFrequency[selectedFrequency];
            const actionInput = {
              tier,
              priceMeta,
              paymentFrequency: selectedFrequency,
            };
            const ctaLabel = getCtaLabel?.(actionInput);
            const ctaDisabled = isCtaDisabled?.(actionInput);
            const canSelect = onSelectPrice && priceMeta;
            const handleSelect = canSelect
              ? () => {
                  onSelectPrice({
                    planId: tier.planId,
                    priceMeta,
                    paymentFrequency: selectedFrequency,
                  });
                }
              : undefined;

            return (
              <PricingCard
                key={tier.planId}
                tier={tier}
                paymentFrequency={selectedFrequency}
                ctaLabel={ctaLabel}
                ctaDisabled={ctaDisabled}
                ctaLoading={ctaLoading}
                onSelect={handleSelect}
                showCtaArrow={showCtaArrow}
              />
            );
          })}
        {lifetimeTiers.map((tier) => {
          const priceMeta = tier.priceMetaByFrequency.lifetime;
          const actionInput = {
            tier,
            priceMeta,
            paymentFrequency: "lifetime" as const,
          };
          const ctaLabel = getCtaLabel?.(actionInput);
          const ctaDisabled = isCtaDisabled?.(actionInput);
          const canSelect = onSelectPrice && priceMeta;
          const handleSelect = canSelect
            ? () => {
                onSelectPrice({
                  planId: tier.planId,
                  priceMeta,
                  paymentFrequency: "lifetime",
                });
              }
            : undefined;

          return (
            <PricingCard
              key={`${tier.planId}-lifetime`}
              tier={tier}
              paymentFrequency="lifetime"
              ctaLabel={ctaLabel}
              ctaDisabled={ctaDisabled}
              ctaLoading={ctaLoading}
              onSelect={handleSelect}
              showCtaArrow={showCtaArrow}
            />
          );
        })}

        {showEnterprise ? (
          <Card className="relative flex h-full flex-col gap-8 overflow-hidden bg-background p-6 text-foreground">
            <h2 className="text-xl font-medium">{t("enterprise.title")}</h2>
            <div className="relative min-h-23 space-y-1.5">
              <h1 className="text-4xl font-medium leading-none">{t("enterprise.price")}</h1>
              <p className="text-xs leading-5 text-muted-foreground">
                {t("enterprise.description")}
              </p>
            </div>
            <div className="flex-1 space-y-2">
              <ul className="space-y-2 text-sm text-muted-foreground list-disc pl-4">
                {enterpriseFeatures.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
            </div>
            <Button className="w-full">{t("enterprise.cta")}</Button>
          </Card>
        ) : null}
      </div>
    );

    if (!animate) {
      return content;
    }

    return (
      <AnimatedGroup
        key={cardsKey}
        variants={{
          container: {
            visible: {
              transition: {
                staggerChildren: 0.08,
                delayChildren: 0.2,
              },
            },
          },
          ...transitionVariants,
        }}
        className={cn("grid w-full max-w-6xl gap-6 sm:grid-cols-2 xl:grid-cols-4", gridClassName)}
      >
        {content.props.children}
      </AnimatedGroup>
    );
  };

  return (
    <div className={cn("flex w-full flex-col items-center gap-10", className)}>
      {renderHeader()}
      {renderGrid()}
    </div>
  );
}
