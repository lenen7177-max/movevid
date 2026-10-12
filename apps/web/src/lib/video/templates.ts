import {
  type VideoModel,
  type VideoPhotoSlot,
  type VideoQuality,
  type VideoTemplateId,
  isVideoHighlight,
  videoTemplates,
} from "@repo/app-config/video";
import { templateSlug } from "./slug";

/**
 * Public media bucket for template previews and samples (the same bucket the server reads
 * reference clips from). Unset, templates fall back to the placeholder posters in /public.
 */
const MEDIA_BASE = (import.meta.env.VITE_TEMPLATE_MEDIA_BASE_URL ?? "").replace(/\/$/, "");

function media(path: string): string {
  return `${MEDIA_BASE}/${path}`;
}

type VideoSampleRender = {
  /** A finished render of the sample photos, with the soundtrack already muxed in. */
  video: string;
  poster: string;
  /** Shown with the sample when set: the tier and quality it was rendered at. */
  model?: VideoModel;
  quality?: VideoQuality;
  /** The same render trimmed to the highlight cut, for templates that have one. */
  highlight?: { video: string; poster: string };
  /** Sample photo per slot. "Try sample photos" loads these and plays the render above. */
  photos: Partial<Record<VideoPhotoSlot, string>>;
};

type VideoTemplateMedia = {
  /** Still shown on cards and before playback. */
  poster: string;
  /** Short muted loop played on hover and in the hero. Optional. */
  previewVideo?: string;
  /** Optional: a render of bundled sample photos, so visitors can preview without credits. */
  sample?: VideoSampleRender;
};

/**
 * Web-side media per template. The shipped posters are placeholders in
 * apps/web/public/templates/<id>/poster.svg. Once you have real renders, upload them to
 * the media bucket and switch to e.g.
 *   poster: media("templates/duo_dance/poster.jpg"),
 *   previewVideo: media("templates/duo_dance/preview.mp4"),
 *   sample: { video: media("templates/duo_dance/sample.mp4"), … }
 */
export const VIDEO_TEMPLATE_MEDIA: Record<VideoTemplateId, VideoTemplateMedia> = {
  duo_dance: {
    poster: "/templates/duo_dance/poster.svg",
    previewVideo: MEDIA_BASE ? media("templates/duo_dance/preview.mp4") : undefined,
  },
  solo_spotlight: {
    poster: "/templates/solo_spotlight/poster.svg",
    previewVideo: MEDIA_BASE ? media("templates/solo_spotlight/preview.mp4") : undefined,
  },
  squad_walk: {
    poster: "/templates/squad_walk/poster.svg",
    previewVideo: MEDIA_BASE ? media("templates/squad_walk/preview.mp4") : undefined,
  },
};

/** The newest template, announced with a "New" badge. Set to null to hide it. */
export const ANNOUNCED_TEMPLATE_ID: VideoTemplateId | null = "squad_walk";

/** Path of a template's landing page, for SEO tags and plain hrefs. */
export function templatePath(templateId: VideoTemplateId): string {
  return `/templates/${templateSlug(templateId)}`;
}

/** Typed <Link> props for a template's landing page. */
export function templateLink(templateId: VideoTemplateId) {
  return { to: "/templates/$slug", params: { slug: templateSlug(templateId) } } as const;
}

export function templatePoster(templateId: VideoTemplateId): string {
  return VIDEO_TEMPLATE_MEDIA[templateId].sample?.poster ?? VIDEO_TEMPLATE_MEDIA[templateId].poster;
}

/** Clip played on hover and in heroes, or null while a template only has a poster. */
export function templatePreviewVideo(templateId: VideoTemplateId): string | null {
  const entry = VIDEO_TEMPLATE_MEDIA[templateId];
  return entry.previewVideo ?? entry.sample?.video ?? null;
}

/** The pre-rendered result of the sample photos, or null when a template has none. */
export function sampleRender(templateId: VideoTemplateId): VideoSampleRender | null {
  return VIDEO_TEMPLATE_MEDIA[templateId].sample ?? null;
}

export function hasSampleRender(templateId: VideoTemplateId): boolean {
  return sampleRender(templateId) !== null;
}

/**
 * The studio's empty-state sample for the picked version: the sample render, or its highlight
 * cut. `cut` is null when the template has no highlight sample, so no version badge is shown.
 */
export function sampleForModel(
  templateId: VideoTemplateId,
  model: VideoModel,
): { video: string; poster: string; cut: "full" | "highlight" | null } | null {
  const sample = sampleRender(templateId);
  if (!sample) return null;
  if (!sample.highlight) return { video: sample.video, poster: sample.poster, cut: null };
  if (isVideoHighlight(templateId, model)) return { ...sample.highlight, cut: "highlight" };
  return { video: sample.video, poster: sample.poster, cut: "full" };
}

/** The bundled sample photo for one slot. */
export function samplePhotoUrl(templateId: VideoTemplateId, slot: VideoPhotoSlot): string | null {
  return sampleRender(templateId)?.photos[slot] ?? null;
}

const ASPECT_CLASSES = {
  "16:9": "aspect-video",
  "4:3": "aspect-[4/3]",
  "1:1": "aspect-square",
  // Vertical clips are capped and centered so they never fill a whole desktop column.
  "3:4": "mx-auto aspect-[3/4] max-w-md",
  "9:16": "mx-auto aspect-[9/16] max-w-sm",
} as const;

/** Tailwind aspect class matching the template's output video. */
export function templateAspectClass(templateId: VideoTemplateId): string {
  return ASPECT_CLASSES[videoTemplates[templateId].aspectRatio];
}
