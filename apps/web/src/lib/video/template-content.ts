import { resolveWebCommonConfig } from "@repo/app-config";
import {
  type VideoTemplateId,
  getVideoPurchaseQuote,
  videoTemplateAllowsPets,
  videoTemplates,
} from "@repo/app-config/video";
import { type Locale } from "@repo/i18n";
import { type Messages, createTranslator } from "use-intl";
import { webConfig } from "@/configs/web-config";
import { getMessages } from "@/i18n";
import { getVideoPricing } from "./pricing";
import { templateFromCredits } from "./template-catalog";

export const TEMPLATE_STEP_KEYS = ["upload", "render", "share"] as const;
export const TEMPLATE_FAQ_KEYS = ["photos", "time", "refund", "privacy", "commercial"] as const;
/**
 * Asked on every template page, after its own or the default questions: price, pets (only
 * where the template takes them), posting to TikTok and watermarks.
 */
export const TEMPLATE_SHARED_FAQ_KEYS = ["free", "pets", "tiktok", "watermark"] as const;
export const TEMPLATE_WHO_KEYS = ["yourself", "friend", "parents", "pet"] as const;

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  currencyDisplay: "narrowSymbol",
});

/**
 * Cents of the cheapest pack that pays for the template's cheapest render for a new visitor
 * (no credits yet), or null when no pack is big enough. Same rule as the create button.
 */
export function templateFromPriceCents(templateId: VideoTemplateId): number | null {
  const quote = getVideoPurchaseQuote(templateFromCredits(templateId), 0, getVideoPricing().packs);
  return quote?.kind === "pack" ? quote.pack.amountCents : null;
}

/**
 * Translator over the `video` messages: `useTranslations("video")` in components,
 * `templateTranslator(locale)` in route heads. Both format ICU (plurals) the same way.
 */
export type VideoTranslator = {
  (key: string, values?: Record<string, string | number>): string;
  has(key: string): boolean;
  raw(key: string): unknown;
};

export function templateTranslator(locale: Locale): VideoTranslator {
  // Loosely typed like useTranslations(), so keys built at runtime type-check the same way.
  const messages: Messages = getMessages(locale);
  return createTranslator({ locale, messages, namespace: "video" });
}

/** Values interpolated into the template page copy. */
export function templateCopyValues(templateId: VideoTemplateId) {
  const template = videoTemplates[templateId];
  return {
    photos: template.slots.length,
    seconds: template.durationSeconds,
    aspect: template.aspectRatio,
    credits: templateFromCredits(templateId),
    // "$9.99", or the credits when no pack covers a render (then nothing is for sale anyway).
    price: (() => {
      const cents = templateFromPriceCents(templateId);
      return cents == null ? `${templateFromCredits(templateId)} credits` : usd.format(cents / 100);
    })(),
  };
}

export type TemplateFaqItem = { q: string; a: string };

/**
 * A template page's own copy. Each template can set, under `video.templates.<id>` in the web
 * messages: `seoTitle`, `h1`, `faq` (a list of {q, a}), `trend` ({title?, body: [paragraphs]})
 * `samples` (one caption per sample-wall clip), `cta` (the create button, "Make my … video")
 * and `who` (same shape as `video.templatePage.who`, any key). Optional extras: `h1Accent`,
 * `ticker` and `frameBadge` (see template-skin.ts), `expect` ({get: [...], limits: [...]}) and
 * `shotList` ({title?, lede?, rows: [{time, beat, body}]}). Anything left out falls back to
 * the shared copy in `video.templatePage`. All of them may use {name}, {appName}, {photos},
 * {seconds}, {aspect}, {credits} and {price}. The shared questions (TEMPLATE_SHARED_FAQ_KEYS)
 * follow the template's own FAQ, minus any it already asks word for word.
 */
export function templatePageContent(t: VideoTranslator, templateId: VideoTemplateId) {
  const own = (key: string) => `templates.${templateId}.${key}`;
  const name = t(own("name"));
  const values = { ...templateCopyValues(templateId), name, appName: webConfig.AppName };
  const list = (key: string) => {
    const raw = t.has(key) ? t.raw(key) : undefined;
    return Array.isArray(raw) ? raw.map((_, index) => `${key}.${index}`) : null;
  };

  const allowsPets = videoTemplateAllowsPets(templateId);
  const signupGrant = resolveWebCommonConfig().credits?.signupGrant;
  const grant = signupGrant?.enabled ? signupGrant.amount : null;
  const faqValues = { ...values, grant: grant ?? 0 };
  const sharedFaqKeys = TEMPLATE_SHARED_FAQ_KEYS.flatMap((key) => {
    if (key === "pets" && !allowsPets) return [];
    // "Is it free?" answers from the signup grant setting: not free unless it is on.
    if (key === "free" && grant != null) return ["templatePage.faq.freeGrant"];
    return [`templatePage.faq.${key}`];
  });
  const faqKeys = [
    ...(list(own("faq")) ?? TEMPLATE_FAQ_KEYS.map((key) => `templatePage.faq.${key}`)),
    ...sharedFaqKeys,
  ];
  const faq: TemplateFaqItem[] = [];
  for (const key of faqKeys) {
    const q = t(`${key}.q`, faqValues);
    if (!faq.some((item) => item.q === q)) faq.push({ q, a: t(`${key}.a`, faqValues) });
  }
  // A template's own `who` copy wins key by key over the shared one.
  const pick = (key: string) => t(t.has(own(key)) ? own(key) : `templatePage.${key}`, values);
  const trendBody = list(own("trend.body")) ?? list("templatePage.trend.body") ?? [];
  const optional = (key: string) => (t.has(own(key)) ? t(own(key), values) : null);
  const strings = (key: string) => (list(own(key)) ?? []).map((item) => t(item, values));
  const shotRows = list(own("shotList.rows")) ?? [];

  return {
    name,
    values,
    seoTitle: t(t.has(own("seoTitle")) ? own("seoTitle") : "templatePage.seoTitle", values),
    h1: t.has(own("h1")) ? t(own("h1"), values) : name,
    /** Second H1 line, set in the skin's accent color. */
    h1Accent: optional("h1Accent"),
    /** Phrases for the strip under the hero; empty hides it. */
    ticker: strings("ticker"),
    /** Label on the phone frame of a "phone" skin. */
    frameBadge: optional("frameBadge"),
    /** "What you get" (what happens in the clip) and "Good to know" (honest limits). */
    expect: { get: strings("expect.get"), limits: strings("expect.limits") },
    /** The clip second by second; no rows hides the section. */
    shotList: {
      title: t(
        t.has(own("shotList.title")) ? own("shotList.title") : "templatePage.shotList.title",
        values,
      ),
      lede: t(
        t.has(own("shotList.lede")) ? own("shotList.lede") : "templatePage.shotList.lede",
        values,
      ),
      rows: shotRows.map((key) => ({
        time: t(`${key}.time`, values),
        beat: t(`${key}.beat`, values),
        body: t(`${key}.body`, values),
      })),
    },
    description: t(own("description"), values),
    faq,
    who: {
      title: pick("who.title"),
      cards: TEMPLATE_WHO_KEYS.filter((key) => key !== "pet" || allowsPets).map((key) => ({
        key,
        title: pick(`who.cards.${key}.title`),
        body: pick(`who.cards.${key}.body`),
      })),
    },
    trend: {
      title: t(t.has(own("trend.title")) ? own("trend.title") : "templatePage.trend.title", values),
      paragraphs: trendBody.map((key) => t(key, values)),
    },
    stepsTitle: t("templatePage.stepsTitle", values),
    steps: TEMPLATE_STEP_KEYS.map((key) => ({
      key,
      title: t(`templatePage.steps.${key}.title`, values),
      body: t(`templatePage.steps.${key}.body`, values),
    })),
    /** Caption of the sample-wall clip at `index`. */
    sampleTitle: (index: number) =>
      t.has(own(`samples.${index}`))
        ? t(own(`samples.${index}`), values)
        : t("templatePage.wall.item", { ...values, number: index + 1 }),
  };
}

export type TemplatePageContent = ReturnType<typeof templatePageContent>;
