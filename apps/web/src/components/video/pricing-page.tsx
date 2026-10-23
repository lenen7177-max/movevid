import {
  ANY_VIDEO_TEMPLATE_OPEN,
  SINGLE_TEMPLATE_ID,
  VIDEO_TEMPLATE_IDS,
  type VideoModel,
  type VideoQuality,
  getVideoCreditsCost,
  getVideoFastCountForCredits,
  getVideoFullCountForCredits,
  getVideoTemplateModels,
  isVideoModelQuality,
  videoConfig,
} from "@repo/app-config/video";
import { type KnownLocale, localeToHreflang } from "@repo/i18n";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@repo/ui/accordion";
import { buttonVariants } from "@repo/ui/button";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { usePricingCheckout } from "@/hooks/use-pricing-checkout";
import { useLocale, useTranslations } from "@/i18n";
import { authClient } from "@/lib/auth/auth-client";
import { cn } from "@/lib/utils";
import { getVideoPricing } from "@/lib/video/pricing";
import { templatesNewestFirst } from "@/lib/video/template-catalog";
import { templatePath } from "@/lib/video/templates";
import { orpc } from "@/utils/orpc";

// The starter pack is highlighted: its credits pay for exactly one first full video, the
// cheapest way to try the product. Use a pack id from app-config, or null for none.
const FEATURED_PACK_ID: string | null = "starter";

/**
 * Starting rate ("from") across the site's templates: the cheapest template that offers the
 * model, so the copy matches what the template pages charge even when every template overrides
 * the default rates. Falls back to the default rates when no template offers the model.
 */
function fromCredits(model: VideoModel, quality: VideoQuality): number {
  const costs = VIDEO_TEMPLATE_IDS.filter((id) => getVideoTemplateModels(id).includes(model))
    .filter(() => isVideoModelQuality(model, quality))
    .map((id) => getVideoCreditsCost(quality, id, model));
  if (costs.length > 0) return Math.min(...costs);
  return model === "seedance-2.5"
    ? videoConfig.qualities[quality].creditsCost
    : videoConfig.liteCredits["seedance-2.0-fast"][quality === "1080p" ? "720p" : quality];
}

// Full videos on Premium, fast renders (up to 15 s) on Fast.
const FULL_480 = fromCredits("seedance-2.5", "480p");
const FAST_480 = fromCredits("seedance-2.0-fast", "480p");
export const PRICING_RATE_VALUES = {
  fast: FAST_480,
  sd: FULL_480,
  hd: fromCredits("seedance-2.5", "720p"),
  fhd: fromCredits("seedance-2.5", "1080p"),
};
const RATE_TIERS = [
  {
    key: "fast",
    credits: { "480p": FAST_480, "720p": fromCredits("seedance-2.0-fast", "720p") },
  },
  {
    key: "premium",
    credits: {
      "480p": FULL_480,
      "720p": PRICING_RATE_VALUES.hd,
      "1080p": PRICING_RATE_VALUES.fhd,
    },
  },
] as const;

export function fillPricingValues(template: string): string {
  const values: Record<string, number> = PRICING_RATE_VALUES;
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}

export function useMoney() {
  const locale = useLocale();
  const formatter = new Intl.NumberFormat(localeToHreflang[locale as KnownLocale] ?? locale, {
    style: "currency",
    currency: "USD",
    // "$9.99" in every locale, rather than "US$9.99" on a zh page.
    currencyDisplay: "narrowSymbol",
  });
  return (cents: number) => formatter.format(cents / 100);
}

function CheckoutButton({
  featured,
  disabled,
  busy,
  onClick,
  children,
}: {
  featured?: boolean;
  disabled: boolean;
  busy: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={cn(
        buttonVariants({ size: "lg", variant: featured ? "default" : "outline" }),
        "w-full rounded-full",
      )}
      disabled={disabled}
      onClick={onClick}
    >
      {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

type CreditPackGridProps = {
  busyKey: string | null;
  isPending: boolean;
  onBuy: (packId: string) => void;
  /** Column classes; dialogs are narrower than the public page. */
  gridClassName?: string;
};

/** Credit pack cards, used on /pricing, the dashboard and the buy-credits dialog. */
export function CreditPackGrid({
  busyKey,
  isPending,
  onBuy,
  gridClassName = "md:grid-cols-3",
}: CreditPackGridProps) {
  const t = useTranslations("video.pricing.packs");
  const money = useMoney();
  const { packs } = getVideoPricing();
  // Whether the viewer's first full video still gets the first-full price; signed-out visitors
  // (and the server render, while the session loads) count as eligible, like the studio's price
  // does. Once a viewer is known to be signed in, the claim waits for their offer.
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const signedIn = Boolean(session?.user);
  const offerQuery = useQuery({
    queryKey: ["video", "offer", signedIn],
    queryFn: () => orpc.video.offer.call({}),
    enabled: !sessionPending,
    staleTime: 60_000,
  });
  const firstFull = offerQuery.data?.firstFull ?? !signedIn;
  const firstFullCredits = videoConfig.firstFullCredits;
  const firstPack = packs[0];
  // Savings are measured against the smallest pack.
  const baseCentsPerCredit = firstPack ? firstPack.amountCents / firstPack.credits : 0;

  return (
    <div className={cn("grid gap-4", gridClassName)}>
      {packs.map((pack) => {
        const featured = pack.id === FEATURED_PACK_ID;
        const centsPerCredit = pack.amountCents / pack.credits;
        const fullCount = getVideoFullCountForCredits(pack.credits, { firstFull });
        const fastCount = getVideoFastCountForCredits(pack.credits);
        // The first full video costs less only when the pack can't buy one at the regular price.
        const firstFullMakesIt =
          firstFull &&
          firstFullCredits != null &&
          fullCount > getVideoFullCountForCredits(pack.credits);
        const savePercent = Math.round((1 - centsPerCredit / baseCentsPerCredit) * 100);
        return (
          <div
            key={pack.id}
            className={cn(
              "bg-card relative flex flex-col rounded-3xl border p-6",
              featured && "border-primary/60 ring-primary/30 shadow-primary/10 shadow-2xl ring-1",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="eyebrow">
                {t.has(`names.${pack.id}`) ? t(`names.${pack.id}` as "names.starter") : pack.id}
              </p>
              {featured ? (
                <span className="bg-primary text-primary-foreground rounded-full px-2.5 py-0.5 text-[11px] font-medium">
                  {t("popular")}
                </span>
              ) : savePercent >= 1 ? (
                <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                  {t("save", { percent: savePercent })}
                </span>
              ) : null}
            </div>
            <p className="display mt-5 text-5xl">{money(pack.amountCents)}</p>
            <p className="text-muted-foreground mt-1 text-sm">
              {t("credits", { count: pack.credits })} · {t("oneTime")}
            </p>
            {featured && fullCount > 0 ? (
              <div className="mt-4">
                <p className="text-lg font-semibold">
                  {t("equalsFull", { count: fullCount })}
                  {fastCount > 0 ? (
                    <span className="text-muted-foreground text-sm font-normal">
                      {" "}
                      {t("orFast", { count: fastCount })}
                    </span>
                  ) : null}
                </p>
                {firstFullMakesIt ? (
                  <p className="text-muted-foreground mt-1 text-xs">
                    {t("firstFullNote", { credits: firstFullCredits })}
                  </p>
                ) : null}
              </div>
            ) : null}
            <ul className="mt-6 space-y-2.5 text-sm">
              <li className="flex gap-2">
                <Check className="text-primary mt-0.5 size-4 shrink-0" aria-hidden="true" />
                {t("yieldFast", { count: fastCount })}
              </li>
              <li className="flex gap-2">
                <Check className="text-primary mt-0.5 size-4 shrink-0" aria-hidden="true" />
                {t("yieldFull", { count: fullCount })}
              </li>
              <li className="flex gap-2">
                <Check className="text-primary mt-0.5 size-4 shrink-0" aria-hidden="true" />
                {t("perVideo", { price: money(Math.round(centsPerCredit * FAST_480)) })}
              </li>
            </ul>
            <div className="mt-auto pt-8">
              <CheckoutButton
                featured={featured}
                disabled={isPending || !ANY_VIDEO_TEMPLATE_OPEN}
                busy={busyKey === pack.id}
                onClick={() => onBuy(pack.id)}
              >
                {ANY_VIDEO_TEMPLATE_OPEN ? t("cta") : t("comingSoon")}
              </CheckoutButton>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** What each version costs per quality, so the pack counts read clearly. */
function TierGuide() {
  const t = useTranslations("video.pricing.tiers");
  return (
    <div className="mt-16">
      <p className="eyebrow text-center">{t("eyebrow")}</p>
      <h2 className="display mt-3 text-center text-3xl sm:text-4xl">{t("title")}</h2>
      <p className="text-muted-foreground mx-auto mt-3 max-w-2xl text-center">{t("lede")}</p>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {RATE_TIERS.map((tier) => (
          <div key={tier.key} className="bg-card rounded-3xl border p-6">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-lg font-medium">{t(`${tier.key}.name`)}</h3>
              <span className="text-muted-foreground font-mono text-xs">
                {t(`${tier.key}.length`)}
              </span>
            </div>
            <p className="text-muted-foreground mt-2 text-sm">{t(`${tier.key}.desc`)}</p>
            <dl className="mt-5 divide-y border-t">
              {Object.entries(tier.credits).map(([quality, count]) => (
                <div key={quality} className="flex justify-between py-2.5 text-sm">
                  <dt className="text-muted-foreground font-mono">{quality}</dt>
                  <dd className="font-medium">{t("creditsValue", { count })}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
      <p className="text-muted-foreground mt-4 text-center text-xs">{t("note")}</p>
    </div>
  );
}

/** Back to making a video: the template (home) page, or every template's page. */
function PricingNext() {
  const t = useTranslations("video.pricing.next");
  const tTemplates = useTranslations("video.templates");
  const links = SINGLE_TEMPLATE_ID
    ? [{ to: "/", label: t("single", { name: tTemplates(`${SINGLE_TEMPLATE_ID}.name`) }) }]
    : templatesNewestFirst().map((id) => ({
        to: templatePath(id),
        label: t("template", { name: tTemplates(`${id}.name`) }),
      }));
  return (
    <section className="mx-auto mt-24 max-w-3xl px-4 text-center sm:px-6">
      <p className="eyebrow">{t("eyebrow")}</p>
      <h2 className="display mt-3 text-3xl sm:text-4xl">{t("title")}</h2>
      <ul className="mt-8 flex flex-wrap justify-center gap-3">
        {links.map((link) => (
          <li key={link.to}>
            <Link
              to={link.to}
              className={cn(
                buttonVariants({ size: "lg", variant: SINGLE_TEMPLATE_ID ? "default" : "outline" }),
                "rounded-full",
              )}
            >
              {link.label}
              <ArrowRight aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Public pricing page: credit packs, the tier guide, FAQ and the way back to a template. */
export function PricingPage() {
  const t = useTranslations("video.pricing");
  const { buyCredits, busyKey, isPending } = usePricingCheckout();
  const faq = (t.raw("faq") as Array<{ q: string; a: string }>).map((item) => ({
    q: item.q,
    a: fillPricingValues(item.a),
  }));
  const included = t.raw("included.items") as string[];

  return (
    <main className="pt-28 pb-24 sm:pt-36">
      <section className="hero-glow mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="eyebrow">{t("eyebrow")}</p>
          <h1 className="display mt-4 text-5xl sm:text-6xl">{t("title")}</h1>
          <p className="text-muted-foreground mt-5 text-lg text-pretty">
            {fillPricingValues(t.raw("lede") as string)}
          </p>
        </div>

        <div className="mt-14">
          <CreditPackGrid busyKey={busyKey} isPending={isPending} onBuy={buyCredits} />
        </div>

        <div className="bg-card mt-4 rounded-3xl border p-6">
          <h2 className="font-medium">{t("included.title")}</h2>
          <ul className="mt-4 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {included.map((item) => (
              <li key={item} className="text-muted-foreground flex gap-2">
                <Check className="text-primary mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <TierGuide />
      </section>

      <section className="mx-auto mt-24 max-w-3xl px-4 sm:px-6">
        <p className="eyebrow text-center">FAQ</p>
        <h2 className="display mt-3 text-center text-3xl sm:text-4xl">{t("faqTitle")}</h2>
        <Accordion className="bg-card mt-8 w-full rounded-3xl border px-6 py-2">
          {faq.map((item) => (
            <AccordionItem key={item.q} value={item.q}>
              <AccordionTrigger className="cursor-pointer text-base hover:no-underline">
                {item.q}
              </AccordionTrigger>
              <AccordionContent>
                <p className="text-muted-foreground">{item.a}</p>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      <PricingNext />
    </main>
  );
}
