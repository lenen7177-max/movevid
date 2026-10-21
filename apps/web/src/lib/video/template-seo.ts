import { type VideoTemplateId, videoTemplates } from "@repo/app-config/video";
import { webConfig } from "@/configs/web-config";
import { getCurrentLocale, getMessages } from "@/i18n";
import { organizationLd } from "@/lib/seo/site-ld";
import { type JsonLdObject, buildSeoHead } from "@/utils/seo";
import {
  type TemplatePageContent,
  templatePageContent,
  templateTranslator,
} from "./template-content";
import { templatePath, templatePoster, templateVideos } from "./templates";

function absoluteUrl(path: string): string {
  return /^https?:\/\//.test(path) ? path : `${webConfig.AppUrl}${path}`;
}

/** schema.org wants a full timestamp; a launch day reads as midnight UTC. */
function isoDateTime(day: string): string {
  return `${day}T00:00:00Z`;
}

/**
 * schema.org VideoObject for each clip of the template (sample render, video wall), as a list
 * to spread into an "@graph". Empty while a template has no clip yet.
 */
export function templateVideoGraph(
  templateId: VideoTemplateId,
  content: Pick<TemplatePageContent, "name" | "description" | "sampleTitle">,
  locale: string,
) {
  const template = videoTemplates[templateId];
  return templateVideos(templateId).map((clip) => ({
    "@type": "VideoObject",
    name: clip.wallIndex === null ? content.name : content.sampleTitle(clip.wallIndex),
    description: content.description,
    thumbnailUrl: absoluteUrl(clip.poster),
    contentUrl: absoluteUrl(clip.video),
    uploadDate: isoDateTime(clip.uploadDate ?? template.launchDate),
    duration: `PT${clip.durationSeconds ?? template.durationSeconds}S`,
    inLanguage: locale,
  }));
}

/** The clip for og:video (the first of templateVideos), or undefined while there is none. */
export function templateOgVideo(templateId: VideoTemplateId) {
  const clip = templateVideos(templateId)[0];
  return clip ? { url: absoluteUrl(clip.video), type: "video/mp4" } : undefined;
}

/** schema.org HowTo built from a template's numbered steps. */
export function templateHowToLd(copy: {
  name: string;
  description: string;
  url: string;
  locale: string;
  steps: Array<{ title: string; body: string }>;
}) {
  return {
    "@type": "HowTo",
    name: copy.name,
    description: copy.description,
    url: absoluteUrl(copy.url),
    inLanguage: copy.locale,
    step: copy.steps.map((step, index) => ({
      "@type": "HowToStep",
      position: index + 1,
      name: step.title,
      text: step.body,
    })),
  };
}

/** schema.org FAQPage from the template's questions (its own, or the shared set). */
export function templateFaqLd(faq: TemplatePageContent["faq"], locale: string) {
  return {
    "@type": "FAQPage",
    inLanguage: locale,
    mainEntity: faq.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
}

/**
 * <head> of a template's landing page: title, description, canonical, og:video and the
 * Organization / VideoObject / HowTo / FAQPage graph. Used by /templates/<slug>, and by the
 * home page when the site has a single template (`extraGraph` then adds the WebSite and
 * WebApplication nodes).
 */
export function buildTemplateHead(templateId: VideoTemplateId, extraGraph: JsonLdObject[] = []) {
  const locale = getCurrentLocale();
  const content = templatePageContent(templateTranslator(locale), templateId);
  const path = templatePath(templateId);
  const poster = templatePoster(templateId);

  return buildSeoHead({
    locale,
    title: content.seoTitle,
    description: content.description,
    keywords: getMessages(locale).video.templates[templateId].keywords,
    canonicalPath: path,
    image: poster.endsWith(".svg") ? undefined : poster,
    video: templateOgVideo(templateId),
    type: "website",
    siteName: webConfig.AppName,
    ldJson: {
      "@context": "https://schema.org",
      "@graph": [
        // The same Organization node (by @id) as the home page.
        organizationLd(),
        ...extraGraph,
        ...templateVideoGraph(templateId, content, locale),
        templateHowToLd({
          name: content.stepsTitle,
          description: content.description,
          url: path,
          locale,
          steps: content.steps,
        }),
        templateFaqLd(content.faq, locale),
      ],
    },
  });
}
