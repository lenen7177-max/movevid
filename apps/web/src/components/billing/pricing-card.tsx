import NumberFlow from "@number-flow/react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, BadgeCheck, Loader2 } from "lucide-react";

import { Badge } from "@repo/ui/badge";
import { Button, buttonVariants } from "@repo/ui/button";
import { Card } from "@repo/ui/card";
import { useTranslations } from "@/i18n";
import { cn } from "@/lib/utils";
import type { PaymentFrequency, PricingTier } from "./pricing-types";
import { buildCtaHref, getBillingNoteLabel, getPriceSuffix } from "./pricing-utils";

interface PricingCardProps {
  tier: PricingTier;
  paymentFrequency: PaymentFrequency;
  ctaLabel?: string;
  ctaDisabled?: boolean;
  ctaLoading?: boolean;
  onSelect?: () => void;
  showCtaArrow?: boolean;
}

export function PricingCard({
  tier,
  paymentFrequency,
  ctaLabel,
  ctaDisabled,
  ctaLoading,
  onSelect,
  showCtaArrow,
}: PricingCardProps) {
  const tPricing = useTranslations("landingPage.pricing");
  const t = useTranslations("landingPage.pricing.periods");
  const price = tier.priceByFrequency[paymentFrequency];
  const priceMeta = tier.priceMetaByFrequency[paymentFrequency];
  const isHighlighted = tier.highlighted;
  const isPopular = tier.popular;
  const ctaHref = buildCtaHref(tier.planId, priceMeta?.priceId ?? null);
  const defaultCtaLabel = priceMeta ? tPricing("cta.subscribe") : tPricing("cta.getStarted");
  const resolvedCtaLabel = ctaLabel ?? defaultCtaLabel;
  const resolvedCtaDisabled =
    ctaLoading === true ? true : (ctaDisabled ?? (onSelect ? !priceMeta : false));
  const shouldShowArrow = showCtaArrow ?? !onSelect;
  const priceSuffix = getPriceSuffix(t, priceMeta);
  const billingNote = getBillingNoteLabel(tPricing, priceMeta);

  const trialBadgeLabel =
    priceMeta?.priceType === "subscription" && priceMeta.trialDays
      ? tPricing("trial.newUserDays", { days: priceMeta.trialDays })
      : null;

  return (
    <Card
      className={cn(
        "relative flex h-full flex-col gap-8 overflow-hidden p-6",
        isHighlighted ? "bg-foreground text-background" : "bg-background text-foreground",
        isPopular && "ring-2 ring-primary",
      )}
    >
      {isHighlighted && <HighlightedBackground />}
      {isPopular && <PopularBackground />}

      <h2 className="flex items-center gap-3 text-xl font-medium capitalize">
        {tier.name}
        {isPopular && (
          <Badge variant="secondary" className="mt-1 z-10">
            {tPricing("badge.popular")}
          </Badge>
        )}
      </h2>

      {billingNote ? (
        <p className="-mt-5 text-xs leading-5 text-muted-foreground">{billingNote}</p>
      ) : null}

      <div className="relative min-h-18 space-y-1.5">
        {typeof price === "number" ? (
          <>
            <NumberFlow
              format={{
                style: "currency",
                currency: priceMeta?.currency.toUpperCase() ?? "USD",
                minimumFractionDigits: 0,
                currencyDisplay: "narrowSymbol",
              }}
              value={price}
              className="text-4xl font-medium leading-none"
            />
            {priceSuffix ? (
              <p className="pb-1 text-sm font-medium text-muted-foreground">{priceSuffix}</p>
            ) : null}
          </>
        ) : (
          <div className="space-y-1.5">
            <h1 className="text-4xl font-medium leading-none">{price}</h1>
          </div>
        )}
      </div>

      <div className="flex-1 space-y-2">
        <h3 className="text-sm font-medium">{tier.description}</h3>
        <ul className="space-y-2">
          {tier.features.map((feature, index) => (
            <li
              key={index}
              className={cn(
                "flex items-center gap-2 text-sm font-medium",
                isHighlighted ? "text-background" : "text-muted-foreground",
              )}
            >
              <BadgeCheck className="h-4 w-4" />
              {feature}
            </li>
          ))}
        </ul>
      </div>

      {trialBadgeLabel ? (
        <div className="flex items-center">
          <span
            className={cn(
              "inline-flex rounded-full px-3 py-1 text-xs font-medium",
              isHighlighted
                ? "bg-background/15 text-background"
                : "bg-emerald-500/10 text-emerald-700",
            )}
          >
            {trialBadgeLabel}
          </span>
        </div>
      ) : null}

      {onSelect ? (
        <Button
          variant={isHighlighted ? "secondary" : "default"}
          className="w-full"
          disabled={resolvedCtaDisabled}
          onClick={onSelect}
        >
          {ctaLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {resolvedCtaLabel}
          {shouldShowArrow && <ArrowRight className="ml-2 h-4 w-4" />}
        </Button>
      ) : (
        <Link
          className={buttonVariants({
            variant: isHighlighted ? "secondary" : "default",
            className: "w-full",
          })}
          to={ctaHref}
        >
          {resolvedCtaLabel}
          {shouldShowArrow && <ArrowRight className="ml-2 h-4 w-4" />}
        </Link>
      )}
    </Card>
  );
}

const HighlightedBackground = () => (
  <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f4f4f2e_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f2e_1px,transparent_1px)] bg-size-[45px_45px] mask-[radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_110%)]" />
);

const PopularBackground = () => (
  <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.1),rgba(255,255,255,0))]" />
);
