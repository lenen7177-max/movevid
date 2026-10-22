import {
  SINGLE_TEMPLATE_ID,
  VIDEO_TEMPLATE_IDS,
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

/** One finished example on the template page's video wall. */
type VideoSampleClip = {
  /** The render with its soundtrack muxed in. */
  video: string;
  poster: string;
  /** Only when it differs from the template's durationSeconds. */
  durationSeconds?: number;
  /** YYYY-MM-DD the clip went up, when later than the template's launchDate. */
  uploadDate?: string;
};

/** A video wall holds 3 to 6 clips: enough to show the range, few enough to stay fast. */
type VideoSampleWall =
  | readonly [VideoSampleClip, VideoSampleClip, VideoSampleClip]
  | readonly [VideoSampleClip, VideoSampleClip, VideoSampleClip, VideoSampleClip]
  | readonly [VideoSampleClip, VideoSampleClip, VideoSampleClip, VideoSampleClip, VideoSampleClip]
  | readonly [
      VideoSampleClip,
      VideoSampleClip,
      VideoSampleClip,
      VideoSampleClip,
      VideoSampleClip,
      VideoSampleClip,
    ];

type VideoTemplateMedia = {
  /** Still shown on cards and before playback. */
  poster: string;
  /** Short muted loop played on hover and in the hero. Optional. */
  previewVideo?: string;
  /** Optional: a render of bundled sample photos, so visitors can preview without credits. */
  sample?: VideoSampleRender;
  /**
   * Optional: 3–6 finished examples shown as a video wall on the template page. Each one is
   * also a schema.org VideoObject. Captions live in the web messages under
   * `video.templates.<id>.samples` (one string per clip).
   */
  samples?: VideoSampleWall;
  /**
   * Optional: original posts of the trend on TikTok, shown with TikTok's own embed player in the
   * "What is the … trend" section and credited to their creators. Never downloaded or presented
   * as renders from this site.
   */
  trendVideos?: readonly TrendVideo[];
};

/** A TikTok post that shows the trend, embedded with TikTok's player (credited, not copied). */
export type TrendVideo = { tiktokId: string; author: string };

/** Media-bucket clip `templates/<id>/samples/<n>.mp4` with its poster `<n>.jpg`. */
export function sampleClip(templateId: VideoTemplateId, n: number): VideoSampleClip {
  return {
    video: media(`templates/${templateId}/samples/${n}.mp4`),
    poster: media(`templates/${templateId}/samples/${n}.jpg`),
  };
}

/**
 * Web-side media per template. The shipped posters are placeholders in
 * apps/web/public/templates/<id>/poster.svg. Once you have real renders, upload them to
 * the media bucket and switch to e.g.
 *   poster: media("templates/duo_dance/poster.jpg"),
 *   previewVideo: media("templates/duo_dance/preview.mp4"),
 *   sample: { video: media("templates/duo_dance/sample.mp4"), … },
 *   samples: [1, 2, 3, 4].map((n) => sampleClip("duo_dance", n)) as VideoSampleWall,
 * or list each clip as { video, poster } for files elsewhere.
 */
export const VIDEO_TEMPLATE_MEDIA: Record<VideoTemplateId, VideoTemplateMedia> = {
  ai_celebrity_autograph: {
    poster: "/templates/ai_celebrity_autograph/poster.svg",
    trendVideos: [
      { tiktokId: "7673848706940095766", author: "capcutdailyuk" },
      { tiktokId: "7699361308772306184", author: "inlove1422" },
      { tiktokId: "7699133560552197383", author: "818817_cj_clarksonjames" },
    ],
    previewVideo: MEDIA_BASE ? media("templates/ai_celebrity_autograph/preview.mp4") : undefined,
  },
};

/**
 * The template announced with a "New" badge: the newest one (last in VIDEO_TEMPLATE_IDS) while
 * there are several. Set to a specific id, or to null to hide the badge.
 */
export const ANNOUNCED_TEMPLATE_ID: VideoTemplateId | null = SINGLE_TEMPLATE_ID
  ? null
  : (VIDEO_TEMPLATE_IDS.at(-1) ?? null);

/**
 * Path of a template's landing page, for SEO tags and plain hrefs. With a single template that
 * page is the home page, and /templates/<slug> redirects there.
 */
export function templatePath(templateId: VideoTemplateId): string {
  return templateId === SINGLE_TEMPLATE_ID ? "/" : `/templates/${templateSlug(templateId)}`;
}

/** Typed <Link> props for a template's landing page (the home page with a single template). */
export function templateLink(templateId: VideoTemplateId) {
  return templateId === SINGLE_TEMPLATE_ID
    ? ({ to: "/" } as const)
    : ({ to: "/templates/$slug", params: { slug: templateSlug(templateId) } } as const);
}

export function templatePoster(templateId: VideoTemplateId): string {
  return VIDEO_TEMPLATE_MEDIA[templateId].sample?.poster ?? VIDEO_TEMPLATE_MEDIA[templateId].poster;
}

/** Clip played on hover and in heroes, or null while a template only has a poster. */
export function templatePreviewVideo(templateId: VideoTemplateId): string | null {
  const entry = VIDEO_TEMPLATE_MEDIA[templateId];
  return entry.previewVideo ?? entry.sample?.video ?? null;
}

/** The template's video wall, empty while it has no finished examples yet. */
export function sampleWall(templateId: VideoTemplateId): readonly VideoSampleClip[] {
  return VIDEO_TEMPLATE_MEDIA[templateId].samples ?? [];
}

/**
 * Every clip that shows the template's result, best first and without repeats: the sample
 * render, then the video wall; the muted preview loop only when there is nothing else.
 * The first one is the page's og:video; each one is a VideoObject.
 */
export function templateVideos(
  templateId: VideoTemplateId,
): Array<VideoSampleClip & { wallIndex: number | null }> {
  const entry = VIDEO_TEMPLATE_MEDIA[templateId];
  const clips: Array<VideoSampleClip & { wallIndex: number | null }> = [];
  if (entry.sample) {
    clips.push({ video: entry.sample.video, poster: entry.sample.poster, wallIndex: null });
  }
  sampleWall(templateId).forEach((clip, index) => clips.push({ ...clip, wallIndex: index }));
  if (clips.length === 0 && entry.previewVideo) {
    clips.push({ video: entry.previewVideo, poster: entry.poster, wallIndex: null });
  }
  return clips.filter(
    (clip, index) => clips.findIndex((other) => other.video === clip.video) === index,
  );
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

/** TikTok posts embedded in the template's trend section (empty when it has none). */
export function templateTrendVideos(templateId: VideoTemplateId): readonly TrendVideo[] {
  return VIDEO_TEMPLATE_MEDIA[templateId].trendVideos ?? [];
}
