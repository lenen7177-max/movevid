import {
  VIDEO_TEMPLATE_IDS,
  type VideoTemplateId,
  videoTemplates,
  getVideoCreditsCost,
  getVideoMinPhotos,
  getVideoTemplateModels,
} from "@repo/app-config/video";
import { ANNOUNCED_TEMPLATE_ID } from "./templates";

/** Every template, newest first, with the announced one pinned to the top. */
export function templatesNewestFirst(): VideoTemplateId[] {
  const newestFirst = [...VIDEO_TEMPLATE_IDS].reverse();
  if (!ANNOUNCED_TEMPLATE_ID) return newestFirst;
  return [ANNOUNCED_TEMPLATE_ID, ...newestFirst.filter((id) => id !== ANNOUNCED_TEMPLATE_ID)];
}

/** Whether the template is the newly announced one. */
export function isNewTemplate(templateId: VideoTemplateId): boolean {
  return templateId === ANNOUNCED_TEMPLATE_ID;
}

/** Cheapest render the template offers: 480p on the lowest model it is rendered with. */
export function templateFromCredits(templateId: VideoTemplateId): number {
  return Math.min(
    ...getVideoTemplateModels(templateId).map((model) =>
      getVideoCreditsCost("480p", templateId, model),
    ),
  );
}

/** Photo count shown on cards: a range for templates with optional photos. */
export function templatePhotoRange(templateId: VideoTemplateId): { min: number; max: number } {
  return { min: getVideoMinPhotos(templateId), max: videoTemplates[templateId].slots.length };
}
