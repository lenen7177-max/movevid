import {
  SINGLE_TEMPLATE_ID,
  type VideoTemplateId,
  getVideoRenderSeconds,
  isVideoHighlight,
  videoTemplates,
} from "@repo/app-config/video";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@repo/ui/accordion";
import { Button } from "@repo/ui/button";
import { Marquee } from "@repo/ui/marquee";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BookOpen,
  ChevronLeft,
  Heart,
  PawPrint,
  UserRound,
  Users,
  Wand2,
} from "lucide-react";
import { useState } from "react";
import { usePricingCheckout } from "@/hooks/use-pricing-checkout";
import { useTranslations } from "@/i18n";
import { type TemplatePageContent, templatePageContent } from "@/lib/video/template-content";
import type { TemplateGuide } from "@/lib/video/template-guide";
import { cn } from "@/lib/utils";
import { CaseVideo, TemplateMedia } from "./media";
import { PreviewFrame } from "./preview-frame";
import { CreditPackGrid } from "./pricing-page";
import { StickyCreateCta, scrollToCreateForm } from "./sticky-create-cta";
import { StudioCreator } from "./studio-creator";
import { MoreTemplates, useTemplatePhotosLabel } from "./template-gallery";
import { sampleForModel, sampleWall, templateAspectClass } from "@/lib/video/templates";
import { templateSkin, templateSkinStyle, templateUpdatedDate } from "@/lib/video/template-skin";
import { videoConfig } from "@repo/app-config/video";

/** Preview on the template page: the sample render for the picked version, else the template loop. */
function TemplatePreview({
  templateId,
  model,
}: {
  templateId: VideoTemplateId;
  model: (typeof videoConfig)["defaultModel"];
}) {
  const t = useTranslations("video.templatePage");
  const tVersion = useTranslations("video.studio.version");
  const sample = sampleForModel(templateId, model);
  const aspect = templateAspectClass(templateId);

  if (sample) {
    const seconds = getVideoRenderSeconds(templateId, model);
    return (
      <CaseVideo
        src={sample.video}
        poster={sample.poster}
        label={t("playSample")}
        sampleLabel={t("sampleBadge")}
        badge={
          sample.cut
            ? tVersion(isVideoHighlight(templateId, model) ? "highlight" : "full", { seconds })
            : undefined
        }
        className={cn("w-full rounded-3xl", aspect)}
      />
    );
  }

  return (
    <TemplateMedia
      templateId={templateId}
      sampleLabel={t("sampleBadge")}
      className={cn("w-full rounded-3xl border", aspect)}
    />
  );
}

const updatedFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

/** "Oct 23, 2026" from YYYY-MM-DD. */
function formatUpdated(date: string): string {
  return updatedFormat.format(new Date(`${date}T00:00:00Z`));
}

/** Full-width strip of short selling points under the hero ("One photo ◆ 11 seconds ◆ …"). */
function Ticker({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="bg-primary text-primary-foreground border-y" role="presentation">
      <Marquee duration={30} gap={1.5} repeat={4} className="py-2.5 [--marquee-gap:1.5rem]">
        {items.map((item) => (
          <span
            key={item}
            className="display flex shrink-0 items-center gap-6 text-sm font-semibold tracking-wide uppercase sm:text-base"
          >
            {item}
            <span aria-hidden="true">◆</span>
          </span>
        ))}
      </Marquee>
    </div>
  );
}

/** "What you get" next to an honest "Good to know", so nobody is surprised by the result. */
function ExpectSection({ content }: { content: TemplatePageContent }) {
  const t = useTranslations("video.templatePage");
  const { get, limits } = content.expect;
  if (get.length === 0 && limits.length === 0) return null;
  const columns = [
    { key: "get", title: t("expect.get"), items: get, ordered: true },
    { key: "limits", title: t("expect.limits"), items: limits, ordered: false },
  ].filter((column) => column.items.length > 0);
  return (
    <section className="border-t py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <p className="eyebrow">{t("expect.eyebrow")}</p>
        <div className={cn("mt-6 grid gap-4", columns.length > 1 && "md:grid-cols-2")}>
          {columns.map((column) => {
            const List = column.ordered ? "ol" : "ul";
            return (
              <div key={column.key} className="bg-card rounded-3xl border p-6 sm:p-8">
                <h2 className="display text-2xl sm:text-3xl">{column.title}</h2>
                <List
                  className={cn(
                    "text-muted-foreground mt-5 space-y-3 pl-5",
                    column.ordered ? "list-decimal" : "list-disc",
                  )}
                >
                  {column.items.map((item) => (
                    <li key={item} className="pl-1">
                      {item}
                    </li>
                  ))}
                </List>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/** The clip second by second, as a table (search engines and AI answers quote these). */
function ShotListSection({ content }: { content: TemplatePageContent }) {
  const t = useTranslations("video.templatePage");
  const { title, lede, rows } = content.shotList;
  if (rows.length === 0) return null;
  return (
    <section className="border-t py-20 sm:py-24">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <p className="eyebrow">{t("shotList.eyebrow")}</p>
        <h2 className="display mt-3 text-3xl sm:text-4xl">{title}</h2>
        <p className="text-muted-foreground mt-3 max-w-2xl text-pretty">{lede}</p>
        <div className="mt-8 overflow-x-auto rounded-3xl border">
          <table className="w-full min-w-[32rem] text-left text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th
                  scope="col"
                  className="px-4 py-3 font-mono text-[11px] tracking-[0.18em] uppercase"
                >
                  {t("shotList.time")}
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 font-mono text-[11px] tracking-[0.18em] uppercase"
                >
                  {t("shotList.beat")}
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 font-mono text-[11px] tracking-[0.18em] uppercase"
                >
                  {t("shotList.what")}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.time} className="border-t align-top">
                  <td className="text-primary px-4 py-3 font-mono whitespace-nowrap">{row.time}</td>
                  <td className="px-4 py-3 font-medium whitespace-nowrap">{row.beat}</td>
                  <td className="text-muted-foreground px-4 py-3">{row.body}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

/** The template's finished examples (3–6 clips), each played on click. */
function SampleWall({
  templateId,
  content,
}: {
  templateId: VideoTemplateId;
  content: TemplatePageContent;
}) {
  const t = useTranslations("video.templatePage");
  const clips = sampleWall(templateId);
  if (clips.length === 0) return null;
  const aspect = templateAspectClass(templateId);

  return (
    <section className="border-t py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <p className="eyebrow">{t("wall.eyebrow")}</p>
        <h2 className="display mt-3 text-3xl sm:text-4xl">
          {t("wall.title", { name: content.name })}
        </h2>
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clips.map((clip, index) => (
            <li key={clip.video}>
              <figure>
                <CaseVideo
                  src={clip.video}
                  poster={clip.poster}
                  label={content.sampleTitle(index)}
                  sampleLabel={t("sampleBadge")}
                  className={cn("w-full rounded-3xl", aspect)}
                />
                <figcaption className="text-muted-foreground mt-3 text-center text-sm">
                  {content.sampleTitle(index)}
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** "Read the full guide": the template's paired how-to post, plus a way into the blog. */
function GuideLinks({ guide }: { guide?: TemplateGuide | null }) {
  const t = useTranslations("video.templatePage");
  return (
    <div className="mt-6 grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      {guide ? (
        <Link
          to={guide.path}
          data-guide-card=""
          className="bg-card hover:border-primary/60 group flex items-start gap-4 rounded-3xl border p-6 transition-colors"
        >
          <BookOpen className="text-primary mt-1 size-5 shrink-0" aria-hidden="true" />
          <span className="min-w-0">
            <span className="eyebrow block">{t("guide.eyebrow")}</span>
            <span className="mt-2 block text-lg font-medium">{guide.title}</span>
            {guide.description ? (
              <span className="text-muted-foreground mt-1 block text-sm">{guide.description}</span>
            ) : null}
            <span className="text-primary mt-3 inline-flex items-center gap-1.5 text-sm font-medium">
              {t("guide.cta")}
              <ArrowRight
                className="size-4 transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </span>
          </span>
        </Link>
      ) : null}
      <Link
        to="/blog"
        className={cn(
          "text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 self-center text-sm font-medium transition-colors",
          !guide && "md:col-span-2",
        )}
      >
        {t("guide.blog")}
        <ArrowRight className="size-4" aria-hidden="true" />
      </Link>
    </div>
  );
}

const WHO_ICONS = { yourself: UserRound, friend: Users, parents: Heart, pet: PawPrint } as const;

/** "Who to make it of": yourself, a friend, your parents and, where it works, your pet. */
function WhoSection({ content }: { content: TemplatePageContent }) {
  const t = useTranslations("video.templatePage");
  return (
    <section className="border-t py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <p className="eyebrow">{t("who.eyebrow")}</p>
        <h2 className="display mt-3 text-3xl sm:text-4xl">{content.who.title}</h2>
        <ul
          className={cn(
            "mt-10 grid gap-4 sm:grid-cols-2",
            content.who.cards.length > 3 ? "lg:grid-cols-4" : "lg:grid-cols-3",
          )}
        >
          {content.who.cards.map((card) => {
            const Icon = WHO_ICONS[card.key];
            return (
              <li key={card.key} className="bg-card rounded-3xl border p-6">
                <Icon className="text-primary size-5" aria-hidden="true" />
                <h3 className="mt-4 text-lg font-medium">{card.title}</h3>
                <p className="text-muted-foreground mt-2 text-sm">{card.body}</p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

/** The credit packs, bought right here (guests check out without signing in). */
function PricingSection({ content }: { content: TemplatePageContent }) {
  const t = useTranslations("video.templatePage");
  const { buyCredits, busyKey, isPending } = usePricingCheckout();
  return (
    <section id="pricing" className="scroll-mt-24 border-t py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <p className="eyebrow">{t("pricing.eyebrow")}</p>
        <h2 className="display mt-3 text-3xl sm:text-4xl">{t("pricing.title")}</h2>
        <p className="text-muted-foreground mt-3 max-w-2xl text-pretty">
          {t("pricing.lede", content.values)}
        </p>
        <div className="mt-10 pt-2">
          <CreditPackGrid busyKey={busyKey} isPending={isPending} onBuy={buyCredits} />
        </div>
        <Link
          to="/pricing"
          className="text-foreground hover:text-primary mt-6 inline-flex items-center gap-1.5 text-sm font-medium transition-colors"
        >
          {t("pricing.allPacks")}
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}

/** Last call: the action again, with the create button's label; it scrolls back to the form. */
function ClosingCta({ content, label }: { content: TemplatePageContent; label: string | null }) {
  const t = useTranslations("video.templatePage");
  return (
    <section id="closing-cta" className="hero-glow border-t py-20 sm:py-28">
      <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
        <h2 className="display text-3xl sm:text-5xl">{t("closing.title", content.values)}</h2>
        <p className="text-muted-foreground mx-auto mt-4 max-w-xl text-pretty">
          {t("closing.body", content.values)}
        </p>
        <Button
          type="button"
          size="lg"
          className="mt-8 h-auto min-h-11 rounded-full px-6 py-2 whitespace-normal"
          onClick={() => scrollToCreateForm("create")}
        >
          <Wand2 aria-hidden="true" />
          {label ?? t("cta", { name: content.name })}
        </Button>
      </div>
    </section>
  );
}

/**
 * A template's own page: preview, quick facts, the create form, sample wall, steps, who to
 * make it of, the "What is the … trend" section, pricing, FAQ, more templates and a closing
 * call to action. Also the home page when the site has a single template.
 */
export function TemplatePage({
  templateId,
  guide,
}: {
  templateId: VideoTemplateId;
  /** The template's paired how-to post (blog frontmatter `template:`), if it has one. */
  guide?: TemplateGuide | null;
}) {
  const t = useTranslations("video.templatePage");
  const content = templatePageContent(useTranslations("video"), templateId);
  const photosLabel = useTemplatePhotosLabel();
  const [model, setModel] = useState(videoConfig.defaultModel);
  // The create button's label with its price, repeated by the sticky bar.
  const [ctaLabel, setCtaLabel] = useState<string | null>(null);
  const template = videoTemplates[templateId];
  const skin = templateSkin(templateId);
  const updated = formatUpdated(templateUpdatedDate(templateId));
  const facts = [
    { label: t("facts.photos"), value: photosLabel(templateId) },
    { label: t("facts.length"), value: t("facts.seconds", { seconds: template.durationSeconds }) },
    { label: t("facts.format"), value: template.aspectRatio },
    { label: t("facts.from"), value: t("facts.credits", { credits: content.values.credits }) },
  ];

  return (
    <main data-skin-font={skin?.font} style={templateSkinStyle(skin)}>
      <section className="hero-glow pt-20 pb-16 sm:pt-32 lg:pt-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          {SINGLE_TEMPLATE_ID ? null : (
            <Link
              to="/templates"
              className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm transition-colors sm:mb-6 lg:mb-4"
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
              {t("back")}
            </Link>
          )}
          {/*
            Phones: intro, then the create form, then facts and preview, so the photo slots start
            on the first screen. From lg: intro, facts and preview on the left, the form beside them.
          */}
          <div className="grid items-start gap-x-10 gap-y-6 lg:grid-cols-[minmax(0,1fr)_420px] lg:grid-rows-[auto_1fr] lg:gap-y-8">
            <div>
              <p className="eyebrow">
                {t("eyebrow")} · {t("updated", { date: updated })}
              </p>
              <h1 className="display mt-3 text-4xl sm:text-6xl">
                {content.h1}
                {content.h1Accent ? (
                  <span className="skin-accent-2 mt-2 block text-[0.6em] leading-tight">
                    {content.h1Accent}
                  </span>
                ) : null}
              </h1>
              {/* Two lines on phones; the facts, steps and trend section below carry the rest. */}
              <p className="text-muted-foreground mt-4 line-clamp-2 max-w-2xl text-lg text-pretty sm:line-clamp-none">
                {content.description}
              </p>
            </div>
            <div className="lg:sticky lg:top-24 lg:col-start-2 lg:row-span-2 lg:row-start-1">
              <StudioCreator
                id="create"
                templateId={templateId}
                onModelChange={setModel}
                onCtaLabelChange={setCtaLabel}
                hideTemplateBar
                compactOptions
              />
            </div>
            <div className="lg:col-start-1">
              <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-4">
                {facts.map((fact) => (
                  <div key={fact.label} className="bg-background px-4 py-3">
                    <dt className="text-muted-foreground font-mono text-[10px] tracking-[0.18em] uppercase">
                      {fact.label}
                    </dt>
                    <dd className="mt-1 text-sm font-medium">{fact.value}</dd>
                  </div>
                ))}
              </dl>
              {/* Vertical clips stay compact on phones, where they follow the form. */}
              <div
                className={cn(
                  "mt-6 sm:mt-8",
                  template.aspectRatio === "9:16" && "mx-auto max-w-72 sm:max-w-none",
                )}
              >
                <PreviewFrame phone={skin?.frame === "phone"} badge={content.frameBadge}>
                  <TemplatePreview templateId={templateId} model={model} />
                </PreviewFrame>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Ticker items={content.ticker} />
      <SampleWall templateId={templateId} content={content} />
      <ExpectSection content={content} />

      <section id="how-it-works" className="scroll-mt-24 border-t py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <p className="eyebrow">{t("stepsEyebrow")}</p>
          <h2 className="display mt-3 text-3xl sm:text-4xl">{content.stepsTitle}</h2>
          <ol className="mt-10 grid gap-4 md:grid-cols-3">
            {content.steps.map((step, index) => (
              <li key={step.key} className="bg-card rounded-3xl border p-6">
                <span className="text-primary font-mono text-sm">0{index + 1}</span>
                <h3 className="mt-4 text-lg font-medium">{step.title}</h3>
                <p className="text-muted-foreground mt-2 text-sm">{step.body}</p>
              </li>
            ))}
          </ol>
          <GuideLinks guide={guide} />
        </div>
      </section>

      <ShotListSection content={content} />

      <WhoSection content={content} />

      {content.trend.paragraphs.length > 0 ? (
        <section className="border-t py-20 sm:py-24">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <p className="eyebrow">{t("trendEyebrow")}</p>
            <h2 className="display mt-3 text-3xl sm:text-4xl">{content.trend.title}</h2>
            <div className="text-muted-foreground mt-6 space-y-4 text-lg text-pretty">
              {content.trend.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
            <p className="text-muted-foreground mt-8 border-t pt-4 text-xs">
              {t("updated", { date: updated })} · {t("trend.disclaimer")}
            </p>
          </div>
        </section>
      ) : null}

      <PricingSection content={content} />

      <section id="faq" className="scroll-mt-24 pb-8">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <p className="eyebrow text-center">FAQ</p>
          <h2 className="display mt-3 text-center text-3xl sm:text-4xl">{t("faqTitle")}</h2>
          <Accordion className="bg-card mt-8 w-full rounded-3xl border px-6 py-2">
            {content.faq.map((item) => (
              <AccordionItem key={item.q} value={item.q}>
                <AccordionTrigger className="cursor-pointer text-base hover:no-underline">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent hiddenUntilFound>
                  <p className="text-muted-foreground">{item.a}</p>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      <MoreTemplates current={templateId} />
      <ClosingCta content={content} label={ctaLabel} />
      <StickyCreateCta
        targetId="create"
        label={ctaLabel}
        alsoHideOver={["#closing-cta", "footer"]}
      />
    </main>
  );
}
