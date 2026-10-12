import {
  type VideoModel,
  type VideoTemplateId,
  videoConfig,
  videoTemplates,
  getVideoRenderSeconds,
  isVideoHighlight,
} from "@repo/app-config/video";
import { videoServerTemplates } from "./templates";

/**
 * How Seedance treats the reference clip.
 * - "reference": generates a new clip guided by the reference; uses size + duration below.
 *   Required for depth-map references, since "edit" would return a depth-map video.
 * - "edit": rewrites the clip itself (same cuts, length, camera); size/duration follow the clip.
 */
export type VideoTaskMode = "edit" | "reference";

/** Settings shared by every template. */
export const videoTemplateConfig = {
  provider: "apimart",
  mode: "reference" as VideoTaskMode,
  // Renders are silent; the soundtrack is added in the browser (see apps/web/src/lib/video/mux-soundtrack.ts).
  generateAudio: false,
  maxImageBytes: videoConfig.maxImageBytes,
  allowedImageTypes: videoConfig.allowedImageTypes,
  // Renders stuck longer than this are failed and refunded by the cron sync.
  timeoutMs: 60 * 60 * 1000,
  // Minimum gap between provider status checks for the same job.
  pollIntervalMs: 4000,
  // Vision model that describes each photo's look for the prompt (see appearance-notes.ts).
  // Set to null to skip the extra call.
  appearanceNoteModel: "gpt-4.1-mini" as string | null,
  appearanceNoteTimeoutMs: 15_000,
  // Off by default: APIMart's asset-library DELETE was unreliable at the time of writing, and
  // extra calls eat the shared asset rate limit that photo review polling needs.
  deleteLibraryAssets: false,
  // The admin is emailed when the APIMart account balance drops below this (USD).
  balanceAlertUsd: 30,
} as const;

/** R2 key prefix for uploaded photos and finished renders. */
export const VIDEO_STORAGE_PREFIX = "video";

export type VideoMediaEnv = Pick<Cloudflare.Env, "TEMPLATE_MEDIA_BASE_URL">;

/**
 * Public URL of a template media file. Reference clips and soundtracks are not bundled; upload
 * them to a public bucket (e.g. an R2 public bucket) and point TEMPLATE_MEDIA_BASE_URL at it.
 * Absolute URLs in a template's media paths are used as they are.
 */
export function templateMediaUrl(env: VideoMediaEnv, path: string): string | null {
  if (/^https?:\/\//.test(path)) return path;
  const base = env.TEMPLATE_MEDIA_BASE_URL?.replace(/\/$/, "");
  return base ? `${base}/${path.replace(/^\//, "")}` : null;
}

/** Shape, media and prompt for what `model` renders: the full clip, or the highlight cut. */
export function getVideoTemplate(templateId: VideoTemplateId, model: VideoModel) {
  const { highlight, ...full } = videoServerTemplates[templateId];
  const media = isVideoHighlight(templateId, model) && highlight ? highlight : full;
  return {
    ...videoTemplates[templateId],
    ...media,
    durationSeconds: getVideoRenderSeconds(templateId, model),
  };
}
