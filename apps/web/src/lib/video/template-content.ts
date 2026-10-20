import { type VideoTemplateId, videoTemplates } from "@repo/app-config/video";
import { type Locale } from "@repo/i18n";
import { type Messages, createTranslator } from "use-intl";
import { webConfig } from "@/configs/web-config";
import { getMessages } from "@/i18n";
import { templateFromCredits } from "./template-catalog";

export const TEMPLATE_STEP_KEYS = ["upload", "render", "share"] as const;
export const TEMPLATE_FAQ_KEYS = ["photos", "time", "refund", "privacy", "commercial"] as const;

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
  };
}

export type TemplateFaqItem = { q: string; a: string };

/**
 * A template page's own copy. Each template can set, under `video.templates.<id>` in the web
 * messages: `seoTitle`, `h1`, `faq` (a list of {q, a}), `trend` ({title?, body: [paragraphs]})
 * and `samples` (one caption per sample-wall clip). Anything left out falls back to the shared
 * copy in `video.templatePage`. All of them may use {name}, {appName}, {photos}, {seconds},
 * {aspect} and {credits}.
 */
export function templatePageContent(t: VideoTranslator, templateId: VideoTemplateId) {
  const own = (key: string) => `templates.${templateId}.${key}`;
  const name = t(own("name"));
  const values = { ...templateCopyValues(templateId), name, appName: webConfig.AppName };
  const list = (key: string) => {
    const raw = t.has(key) ? t.raw(key) : undefined;
    return Array.isArray(raw) ? raw.map((_, index) => `${key}.${index}`) : null;
  };

  const faqKeys = list(own("faq")) ?? TEMPLATE_FAQ_KEYS.map((key) => `templatePage.faq.${key}`);
  const trendBody = list(own("trend.body")) ?? list("templatePage.trend.body") ?? [];

  return {
    name,
    values,
    seoTitle: t(t.has(own("seoTitle")) ? own("seoTitle") : "templatePage.seoTitle", values),
    h1: t.has(own("h1")) ? t(own("h1"), values) : name,
    description: t(own("description"), values),
    faq: faqKeys.map(
      (key): TemplateFaqItem => ({ q: t(`${key}.q`, values), a: t(`${key}.a`, values) }),
    ),
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
