import type { VideoPhotoSlot } from "@repo/app-config/video";

export const VIDEO_ERROR_CODES = [
  "photo_rejected",
  "photo_left_rejected",
  "photo_middle_rejected",
  "photo_right_rejected",
  "content_blocked",
  "timeout",
] as const;
export type VideoErrorCode = (typeof VIDEO_ERROR_CODES)[number];

// Seedance's input image moderation, e.g. celebrity photos or copyrighted stills.
const PHOTO_REJECTED_PATTERN = /InputImageSensitiveContentDetected/;
// Asset-library review rejected one photo; written by syncVideoJob as `asset_review_failed:<side>…`.
const ASSET_REVIEW_FAILED_PATTERN = /^asset_review_failed:(left|middle|right)/;
// Other moderation blocks, e.g. "Blocked by a specific content policy (e.g. public figures, ...)"
// or "Your request did not pass content safety review. Please adjust your prompt or input files…".
const CONTENT_BLOCKED_PATTERN =
  /content policy|content safety|safety review|SensitiveContentDetected/i;

/** Maps a raw provider error to a code the client can explain to users. */
export function classifyVideoError(error: string | null): VideoErrorCode | null {
  if (!error) return null;
  const slot = ASSET_REVIEW_FAILED_PATTERN.exec(error)?.[1];
  if (slot) return `photo_${slot as VideoPhotoSlot}_rejected`;
  if (PHOTO_REJECTED_PATTERN.test(error)) return "photo_rejected";
  if (CONTENT_BLOCKED_PATTERN.test(error)) return "content_blocked";
  if (error === "timeout") return "timeout";
  return null;
}
