import {
  type VideoModel,
  type VideoQuality,
  type VideoTemplateId,
  getVideoRenderSeconds,
} from "@repo/app-config/video";

/**
 * Typical seconds from "Generate" to a finished video (photo review + render), measured on
 * Seedance renders through APIMart: 480p took ~6–7 min and 720p ~9–10 min for 25 s clips, and
 * 1080p was no slower than 720p. Refit these lines against your own render logs.
 */
const ETA_MODEL: Record<VideoQuality, { baseSeconds: number; perVideoSecond: number }> = {
  "480p": { baseSeconds: 300, perVideoSecond: 4.5 },
  "720p": { baseSeconds: 380, perVideoSecond: 8 },
  "1080p": { baseSeconds: 380, perVideoSecond: 8 },
};

// The time-based bar stops here until the server reports the video as done.
const MAX_ESTIMATED_PERCENT = 95;

export function estimateRenderSeconds(
  templateId: VideoTemplateId,
  quality: VideoQuality,
  model: VideoModel,
): number {
  const eta = ETA_MODEL[quality];
  return Math.round(
    eta.baseSeconds + eta.perVideoSecond * getVideoRenderSeconds(templateId, model),
  );
}

export function estimateRenderMinutes(
  templateId: VideoTemplateId,
  quality: VideoQuality,
  model: VideoModel,
): number {
  return Math.max(1, Math.round(estimateRenderSeconds(templateId, quality, model) / 60));
}

/**
 * Progress shown while a job renders: the provider's percentage often sits still for minutes, so
 * the bar also advances with elapsed time against the estimate, and never claims 100% early.
 */
export function renderProgress(
  job: {
    templateId: VideoTemplateId;
    quality: VideoQuality;
    model: VideoModel;
    progress: number;
    createdAt: string;
  },
  now: number,
) {
  const estimatedSeconds = estimateRenderSeconds(job.templateId, job.quality, job.model);
  const elapsedSeconds = Math.max(0, Math.round((now - Date.parse(job.createdAt)) / 1000));
  const timePercent = (elapsedSeconds / estimatedSeconds) * MAX_ESTIMATED_PERCENT;
  const percent = Math.round(Math.min(MAX_ESTIMATED_PERCENT, Math.max(job.progress, timePercent)));
  return {
    percent,
    elapsedSeconds,
    remainingSeconds: estimatedSeconds - elapsedSeconds,
  };
}
