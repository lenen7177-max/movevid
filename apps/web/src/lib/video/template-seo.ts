import { type VideoTemplateId, videoTemplates } from "@repo/app-config/video";
import { webConfig } from "@/configs/web-config";
import { sampleRender, templatePoster, templatePreviewVideo } from "./templates";

function absoluteUrl(path: string): string {
  return /^https?:\/\//.test(path) ? path : `${webConfig.AppUrl}${path}`;
}

/**
 * schema.org VideoObject for the template's preview, as a list to spread into an "@graph"
 * (empty while a template has no clip yet).
 */
export function templateVideoGraph(
  templateId: VideoTemplateId,
  copy: { name: string; description: string; locale: string; uploadDate: string },
) {
  const video = sampleRender(templateId)?.video ?? templatePreviewVideo(templateId);
  if (!video) return [];
  return [
    {
      "@type": "VideoObject",
      name: copy.name,
      description: copy.description,
      thumbnailUrl: absoluteUrl(templatePoster(templateId)),
      contentUrl: absoluteUrl(video),
      uploadDate: copy.uploadDate,
      duration: `PT${videoTemplates[templateId].durationSeconds}S`,
      inLanguage: copy.locale,
    },
  ];
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
