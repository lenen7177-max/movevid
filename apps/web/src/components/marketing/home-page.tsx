import {
  VIDEO_TEMPLATE_IDS,
  type VideoTemplateId,
  videoTemplateAllowsPets,
  videoTemplates,
} from "@repo/app-config/video";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@repo/ui/accordion";
import { buttonVariants } from "@repo/ui/button";
import { Marquee } from "@repo/ui/marquee";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Building2,
  Clapperboard,
  Coins,
  Download,
  Gift,
  Heart,
  Megaphone,
  PartyPopper,
  PawPrint,
  RectangleVertical,
  ShieldCheck,
  Sparkles,
  Star,
  Upload,
  Users,
  Wand2,
} from "lucide-react";
import type { ReactNode } from "react";
import { CreditPackGrid, fillPricingValues } from "@/components/video/pricing-page";
import { TemplateMedia } from "@/components/video/media";
import { TemplateGallery } from "@/components/video/template-gallery";
import { usePricingCheckout } from "@/hooks/use-pricing-checkout";
import { webConfig } from "@/configs/web-config";
import { useLocale, useTranslations } from "@/i18n";
import { templatesNewestFirst } from "@/lib/video/template-catalog";
import { PreviewFrame } from "@/components/video/preview-frame";
import { templatePageContent } from "@/lib/video/template-content";
import { templateFromCredits } from "@/lib/video/template-catalog";
import { templateSkin, templateSkinStyle } from "@/lib/video/template-skin";
import {
  ANNOUNCED_TEMPLATE_ID,
  FEATURED_TEMPLATE_ID,
  templateLink,
  templateVideos,
} from "@/lib/video/templates";
import { cn } from "@/lib/utils";
import { formatEffectiveDate } from "@/utils/date";

export const HOME_FAQ_KEYS = [
  "what",
  "account",
  "photos",
  "time",
  "price",
  "refund",
  "privacy",
] as const;
/** Bump when the FAQ answers change; shown under the heading and sent as dateModified. */
export const FAQ_UPDATED_AT = "2026-10-21";
const STEP_KEYS = ["pick", "upload", "share"] as const;
const STEP_ICONS = { pick: Clapperboard, upload: Upload, share: Download };
const AUDIENCE_ICONS = {
  creators: Sparkles,
  friends: Users,
  marketers: Megaphone,
  events: PartyPopper,
  pets: PawPrint,
  agencies: Building2,
  family: Heart,
  gifts: Gift,
  fans: Star,
};
/**
 * "Who it's for" cards, in order (copy in video.home.audience.items.<key>). "pets" is dropped
 * on its own while no template takes pet photos. Consumer sites can swap the business ones
 * (marketers, agencies) for family, gifts and fans.
 */
export const HOME_AUDIENCE_KEYS: readonly (keyof typeof AUDIENCE_ICONS)[] = [
  "creators",
  "friends",
  "marketers",
  "events",
  "pets",
  "agencies",
];

// Facts about the templates the shared copy depends on, so it never promises what the site's
// templates don't do (sound, several photos, pets, several aspect ratios).
const ANY_SOUNDTRACK = VIDEO_TEMPLATE_IDS.some((id) => videoTemplates[id].soundtrack);
const MAX_PHOTOS = Math.max(...VIDEO_TEMPLATE_IDS.map((id) => videoTemplates[id].slots.length));
const ANY_PETS = VIDEO_TEMPLATE_IDS.some((id) => videoTemplateAllowsPets(id));
const ASPECT_RATIOS = [...new Set(VIDEO_TEMPLATE_IDS.map((id) => videoTemplates[id].aspectRatio))];
const CHEAPEST_CREDITS = Math.min(...VIDEO_TEMPLATE_IDS.map((id) => templateFromCredits(id)));

function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = "center",
}: {
  eyebrow: string;
  title: ReactNode;
  subtitle?: ReactNode;
  align?: "center" | "left";
}) {
  return (
    <div className={cn("max-w-2xl", align === "center" && "mx-auto text-center")}>
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="display mt-4 text-4xl sm:text-5xl">{title}</h2>
      {subtitle ? (
        <p className="text-muted-foreground mt-4 text-lg text-pretty">{subtitle}</p>
      ) : null}
    </div>
  );
}

/** The fanned stack of template previews under the hero copy. */
function HeroStage() {
  const [first, second, third] = templatesNewestFirst();
  // Newest template in the middle, the next two fanned out behind it.
  const cards = [
    { id: second, className: "z-10 w-[34%] sm:w-[26%] -mr-[6%] translate-y-10 -rotate-6" },
    { id: first, className: "z-20 w-[40%] sm:w-[31%]" },
    { id: third, className: "z-10 w-[34%] sm:w-[26%] -ml-[6%] translate-y-10 rotate-6" },
  ].filter((card): card is { id: VideoTemplateId; className: string } => Boolean(card.id));

  return (
    <div className="relative mx-auto mt-16 flex max-w-4xl items-start justify-center px-4">
      <div className="bg-primary/25 absolute inset-x-[15%] top-10 bottom-0 rounded-full blur-3xl" />
      {cards.map((card) => (
        <Link
          key={card.id}
          {...templateLink(card.id)}
          className={cn(
            "relative aspect-[9/16] overflow-hidden rounded-[1.75rem] border border-white/10 shadow-2xl shadow-black/50 transition-transform duration-500 hover:-translate-y-2",
            card.className,
          )}
        >
          <TemplateMedia templateId={card.id} className="size-full" />
          <span className="absolute inset-x-3 bottom-3 truncate rounded-full bg-black/50 px-3 py-1.5 text-center text-xs font-medium text-white backdrop-blur">
            <HeroCardLabel templateId={card.id} />
          </span>
        </Link>
      ))}
    </div>
  );
}

function HeroCardLabel({ templateId }: { templateId: VideoTemplateId }) {
  const t = useTranslations("video.templates");
  return <>{t(`${templateId}.name`)}</>;
}

/**
 * Hero for a site riding one trend (FEATURED_TEMPLATE_ID): the brand line on the left, the
 * featured template on the right in its own skin, and the main button straight to its page.
 */
function FeaturedHero({ templateId }: { templateId: VideoTemplateId }) {
  const t = useTranslations("video.home.hero");
  const tVideo = useTranslations("video");
  const content = templatePageContent(tVideo, templateId);
  const skin = templateSkin(templateId);
  const cta = tVideo.has(`templates.${templateId}.cta`)
    ? tVideo(`templates.${templateId}.cta`)
    : tVideo("templatePage.cta", { name: content.name });
  return (
    <section className="hero-glow relative overflow-hidden pt-28 pb-16 sm:pt-36">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="text-center lg:text-left">
          <p className="eyebrow">{t("featured")}</p>
          <h1 className="display mt-4 text-[2.5rem] leading-[1.05] sm:text-7xl">
            {t("title")}
            <br />
            <span className="text-muted-foreground">{t("titleMuted")}</span>
          </h1>
          <p className="text-muted-foreground mx-auto mt-6 max-w-xl text-lg text-pretty sm:text-xl lg:mx-0">
            {t("subtitle", { count: VIDEO_TEMPLATE_IDS.length })}
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
            <Link
              {...templateLink(templateId)}
              className={buttonVariants({ size: "lg", className: "h-11 rounded-full px-6" })}
            >
              <Wand2 aria-hidden="true" />
              {cta}
            </Link>
            <Link
              to="/templates"
              className={buttonVariants({
                size: "lg",
                variant: "outline",
                className: "h-11 rounded-full px-6",
              })}
            >
              {t("secondary")}
            </Link>
          </div>
          <p className="text-muted-foreground mt-5 font-mono text-[11px] tracking-wider uppercase">
            {t("note")}
          </p>
        </div>
        <Link
          {...templateLink(templateId)}
          data-skin-font={skin?.font}
          style={templateSkinStyle(skin)}
          className="group mx-auto block w-full max-w-[19rem]"
        >
          <PreviewFrame phone badge={content.frameBadge}>
            <TemplateMedia templateId={templateId} className="aspect-[9/16] w-full" />
          </PreviewFrame>
          <span className="mt-5 block text-center">
            <span className="display block text-2xl">{content.name}</span>
            {content.h1Accent ? (
              <span className="skin-accent-2 display mt-1 block text-base">{content.h1Accent}</span>
            ) : null}
            <span className="text-primary mt-2 inline-flex items-center gap-1 text-sm font-medium">
              {t("featuredCta", { credits: templateFromCredits(templateId) })}
              <ArrowRight
                className="size-4 transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </span>
          </span>
        </Link>
      </div>
    </section>
  );
}

function Hero() {
  if (FEATURED_TEMPLATE_ID) return <FeaturedHero templateId={FEATURED_TEMPLATE_ID} />;
  return <BrandHero />;
}

function BrandHero() {
  const t = useTranslations("video.home.hero");
  const tTemplates = useTranslations("video.templates");

  return (
    <section className="hero-glow relative overflow-hidden pt-32 pb-12 sm:pt-40">
      <div className="mx-auto max-w-5xl px-4 text-center sm:px-6">
        {ANNOUNCED_TEMPLATE_ID ? (
          <Link
            {...templateLink(ANNOUNCED_TEMPLATE_ID)}
            className="bg-card/70 hover:border-primary/50 mb-8 inline-flex items-center gap-2 rounded-full border px-1.5 py-1 pr-3 text-sm backdrop-blur transition-colors"
          >
            <span className="bg-primary text-primary-foreground rounded-full px-2 py-0.5 font-mono text-[10px] tracking-wider uppercase">
              {t("badge")}
            </span>
            <span className="text-muted-foreground">
              {t("announce", { name: tTemplates(`${ANNOUNCED_TEMPLATE_ID}.name`) })}
            </span>
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        ) : null}
        <h1 className="display text-[2.5rem] leading-[1.05] sm:text-7xl">
          {t("title")}
          <br />
          <span className="text-muted-foreground">{t("titleMuted")}</span>
        </h1>
        <p className="text-muted-foreground mx-auto mt-6 max-w-2xl text-lg text-pretty sm:text-xl">
          {t("subtitle", { count: VIDEO_TEMPLATE_IDS.length })}
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/studio"
            className={buttonVariants({ size: "lg", className: "h-11 rounded-full px-6" })}
          >
            <Wand2 aria-hidden="true" />
            {t("primary")}
          </Link>
          <Link
            to="/templates"
            className={buttonVariants({
              size: "lg",
              variant: "outline",
              className: "h-11 rounded-full px-6",
            })}
          >
            {t("secondary")}
          </Link>
        </div>
        <p className="text-muted-foreground mt-5 font-mono text-[11px] tracking-wider uppercase">
          {t("note")}
        </p>
      </div>
      <HeroStage />
    </section>
  );
}

/** A slow sideways reel of every template, like a feed. */
function Showcase() {
  const t = useTranslations("video.home.showcase");
  const tTemplates = useTranslations("video.templates");
  // A reel of the same placeholder poster reads as empty: it waits for 3 templates with clips.
  const ids = templatesNewestFirst().filter((id) => templateVideos(id).length > 0);
  if (ids.length < 3) return null;
  return (
    <section className="py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading eyebrow={t("eyebrow")} title={t("title")} subtitle={t("subtitle")} />
      </div>
      <Marquee pauseOnHover duration={50} gap={1} className="mt-12 [--marquee-gap:1rem]">
        {ids.map((id) => (
          <Link
            key={id}
            {...templateLink(id)}
            className={cn(
              "relative block h-72 overflow-hidden rounded-3xl border sm:h-96",
              (videoTemplates[id].aspectRatio as string) === "16:9"
                ? "aspect-video"
                : "aspect-[9/16]",
            )}
          >
            <TemplateMedia templateId={id} className="size-full" />
            <span className="absolute bottom-3 left-3 rounded-full bg-black/50 px-3 py-1 text-xs text-white backdrop-blur">
              {tTemplates(`${id}.name`)}
            </span>
          </Link>
        ))}
      </Marquee>
    </section>
  );
}

function HowItWorks() {
  const t = useTranslations("video.home.steps");
  return (
    <section id="how-it-works" className="scroll-mt-24 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading eyebrow={t("eyebrow")} title={t("title")} subtitle={t("subtitle")} />
        <ol className="mt-14 grid gap-4 md:grid-cols-3">
          {STEP_KEYS.map((key, index) => {
            const Icon = STEP_ICONS[key];
            return (
              <li key={key} className="bg-card relative overflow-hidden rounded-3xl border p-7">
                <div className="flex items-center justify-between">
                  <span className="bg-primary/10 text-primary flex size-11 items-center justify-center rounded-2xl">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <span className="text-muted-foreground/50 font-mono text-4xl">0{index + 1}</span>
                </div>
                <h3 className="mt-8 text-xl font-medium">{t(`items.${key}.title`)}</h3>
                <p className="text-muted-foreground mt-2">
                  {t(`items.${key}.body`, {
                    photos: MAX_PHOTOS,
                    sound: ANY_SOUNDTRACK ? "yes" : "no",
                  })}
                </p>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

/** Four reasons in a 2×2 bento, each with a small visual. */
function Features() {
  const t = useTranslations("video.home.features");
  const tStudio = useTranslations("video.studio");
  return (
    <section className="py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading eyebrow={t("eyebrow")} title={t("title")} />
        <div className="mt-14 grid gap-4 md:grid-cols-2">
          <FeatureCard title={t("items.noPrompt.title")} body={t("items.noPrompt.body")}>
            <div className="dot-grid bg-background/60 flex h-full items-center justify-center rounded-2xl border p-6">
              <div className="bg-card w-full max-w-xs rounded-2xl border p-4 shadow-xl">
                <p className="text-muted-foreground font-mono text-[10px] tracking-widest uppercase">
                  {tStudio("templateLabel")}
                </p>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {VIDEO_TEMPLATE_IDS.map((id) => (
                    <TemplateMedia
                      key={id}
                      templateId={id}
                      playing={false}
                      className="aspect-square rounded-xl"
                    />
                  ))}
                </div>
                <div className="bg-primary text-primary-foreground mt-3 flex h-9 items-center justify-center gap-2 rounded-full text-sm font-medium">
                  <Wand2 className="size-4" aria-hidden="true" />
                  {tStudio("generate")}
                </div>
              </div>
            </div>
          </FeatureCard>
          <FeatureCard title={t("items.faces.title")} body={t("items.faces.body")}>
            <div className="dot-grid bg-background/60 flex h-full items-center justify-center gap-3 rounded-2xl border p-6">
              {[0, 1, 2].map((n) => (
                <div
                  key={n}
                  className="bg-card flex aspect-[3/4] w-20 flex-col items-center justify-end overflow-hidden rounded-xl border pb-2 shadow-lg sm:w-24"
                >
                  <div className="bg-muted-foreground/25 mb-1 size-8 rounded-full" />
                  <div className="bg-muted-foreground/20 h-10 w-14 rounded-t-3xl" />
                  <span className="mt-2 flex items-center gap-1 text-[10px] font-medium text-emerald-500">
                    <ShieldCheck className="size-3" aria-hidden="true" />
                    {t("items.faces.passed")}
                  </span>
                </div>
              ))}
            </div>
          </FeatureCard>
          <FeatureCard
            title={t("items.formats.title")}
            body={
              ASPECT_RATIOS.length > 1
                ? t("items.formats.body")
                : t("items.formats.bodySingle", {
                    aspect: ASPECT_RATIOS[0] ?? "9:16",
                    vertical: ASPECT_RATIOS[0] === "9:16" ? "yes" : "no",
                  })
            }
          >
            <div className="dot-grid bg-background/60 flex h-full items-end justify-center gap-3 rounded-2xl border p-6">
              {FORMAT_TILES.filter((item) =>
                (ASPECT_RATIOS as readonly string[]).includes(item.ratio),
              ).map((item) => (
                <div
                  key={item.ratio}
                  className={cn(
                    "bg-card flex flex-col items-center justify-center rounded-xl border shadow-lg",
                    item.className,
                  )}
                >
                  <RectangleVertical className="text-primary size-4" aria-hidden="true" />
                  <span className="mt-1 font-mono text-xs">{item.ratio}</span>
                </div>
              ))}
            </div>
          </FeatureCard>
          <FeatureCard title={t("items.credits.title")} body={t("items.credits.body")}>
            <div className="dot-grid bg-background/60 flex h-full flex-col justify-center gap-2 rounded-2xl border p-6">
              {(["charged", "rendering", "refunded"] as const).map((key) => (
                <div
                  key={key}
                  className="bg-card flex items-center justify-between rounded-xl border px-4 py-2.5 text-sm shadow-sm"
                >
                  <span className="flex items-center gap-2">
                    <Coins className="text-primary size-4" aria-hidden="true" />
                    {t(`items.credits.ledger.${key}`)}
                  </span>
                  <span
                    className={cn(
                      "font-mono text-xs",
                      key === "refunded" ? "text-emerald-500" : "text-muted-foreground",
                    )}
                  >
                    {key === "charged"
                      ? `−${CHEAPEST_CREDITS}`
                      : key === "refunded"
                        ? `+${CHEAPEST_CREDITS}`
                        : "···"}
                  </span>
                </div>
              ))}
            </div>
          </FeatureCard>
        </div>
      </div>
    </section>
  );
}

const FORMAT_TILES = [
  { ratio: "9:16", className: "h-36 w-20" },
  { ratio: "3:4", className: "h-32 w-24" },
  { ratio: "1:1", className: "h-24 w-24" },
  { ratio: "4:3", className: "h-24 w-32" },
  { ratio: "16:9", className: "h-20 w-36" },
] as const;

function FeatureCard({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children: ReactNode;
}) {
  return (
    <div className="bg-card flex flex-col overflow-hidden rounded-3xl border p-7">
      <h3 className="text-xl font-medium">{title}</h3>
      <p className="text-muted-foreground mt-2">{body}</p>
      <div className="mt-8 h-56">{children}</div>
    </div>
  );
}

function TemplatesSection() {
  const t = useTranslations("video.home.templates");
  return (
    <section id="templates" className="scroll-mt-24 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <SectionHeading
            align="left"
            eyebrow={t("eyebrow")}
            title={t("title")}
            subtitle={t("subtitle")}
          />
          <Link
            to="/templates"
            className={buttonVariants({ variant: "outline", className: "rounded-full" })}
          >
            {t("viewAll")}
            <ArrowRight aria-hidden="true" />
          </Link>
        </div>
        <TemplateGallery className="mt-12" />
      </div>
    </section>
  );
}

function Audience() {
  const t = useTranslations("video.home.audience");
  return (
    <section className="py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading eyebrow={t("eyebrow")} title={t("title")} subtitle={t("subtitle")} />
        <ul className="mt-14 grid gap-px overflow-hidden rounded-3xl border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {HOME_AUDIENCE_KEYS.filter((key) => key !== "pets" || ANY_PETS).map((key) => {
            const Icon = AUDIENCE_ICONS[key];
            return (
              <li key={key} className="bg-card p-7">
                <Icon className="text-primary size-5" aria-hidden="true" />
                <h3 className="mt-5 text-lg font-medium">{t(`items.${key}.title`)}</h3>
                <p className="text-muted-foreground mt-2 text-sm">{t(`items.${key}.body`)}</p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

function PricingSection() {
  const t = useTranslations("video.home.pricing");
  const { buyCredits, busyKey, isPending } = usePricingCheckout();
  return (
    <section id="pricing" className="scroll-mt-24 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          eyebrow={t("eyebrow")}
          title={t("title")}
          subtitle={fillPricingValues(t.raw("subtitle") as string)}
        />
        <div className="mt-14">
          <CreditPackGrid busyKey={busyKey} isPending={isPending} onBuy={buyCredits} />
        </div>
        <p className="mt-6 text-center">
          <Link
            to="/pricing"
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm transition-colors"
          >
            {t("details")}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </p>
      </div>
    </section>
  );
}

function Faq() {
  const t = useTranslations("video.home.faq");
  const videoT = useTranslations("video");
  const locale = useLocale();
  return (
    <section id="faq" className="scroll-mt-24 py-20 sm:py-28">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <SectionHeading eyebrow={t("eyebrow")} title={t("title")} />
        {/* Shows readers (and search engines) who wrote the answers and that they're current. */}
        <p className="text-muted-foreground mt-4 text-center text-xs">
          <Link
            to="/about"
            rel="author"
            className="hover:text-foreground underline-offset-4 hover:underline"
          >
            {videoT("byline", { appName: webConfig.AppName })}
          </Link>
          {" · "}
          <time dateTime={FAQ_UPDATED_AT}>
            {videoT("updated", { date: formatEffectiveDate(locale, FAQ_UPDATED_AT) })}
          </time>
        </p>
        <Accordion className="bg-card mt-12 w-full rounded-3xl border px-6 py-2">
          {HOME_FAQ_KEYS.map((key) => (
            <AccordionItem key={key} value={key}>
              <AccordionTrigger className="cursor-pointer text-base hover:no-underline">
                {t(`items.${key}.q`)}
              </AccordionTrigger>
              <AccordionContent hiddenUntilFound>
                <p className="text-muted-foreground">
                  {fillPricingValues(t.raw(`items.${key}.a`) as string)}
                </p>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}

function ClosingCta() {
  const t = useTranslations("video.home.cta");
  return (
    <section className="px-4 pt-8 pb-24 sm:px-6">
      <div className="hero-glow bg-card relative mx-auto max-w-5xl overflow-hidden rounded-[2rem] border px-6 py-20 text-center">
        <h2 className="display mx-auto max-w-2xl text-4xl sm:text-6xl">{t("title")}</h2>
        <p className="text-muted-foreground mx-auto mt-5 max-w-xl text-lg">{t("subtitle")}</p>
        <Link
          to="/studio"
          className={buttonVariants({ size: "lg", className: "mt-9 h-11 rounded-full px-6" })}
        >
          <Wand2 aria-hidden="true" />
          {t("button")}
        </Link>
      </div>
    </section>
  );
}

export function HomePage() {
  return (
    <main>
      <Hero />
      <Showcase />
      <HowItWorks />
      <Features />
      <TemplatesSection />
      <Audience />
      <PricingSection />
      <Faq />
      <ClosingCta />
    </main>
  );
}
