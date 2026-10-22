import {
  type VideoModel,
  type VideoPhotoSlot,
  type VideoQuality,
  type VideoTemplateId,
  videoTemplates,
  getVideoCreditsCost,
  getVideoFirstFullCredits,
  getVideoMinPhotos,
  getVideoTemplateModels,
  isVideoModelQuality,
} from "@repo/app-config/video";
import { and, desc, eq, inArray, isNull, lt } from "drizzle-orm";
import { type createCreditsService, grantCredits } from "../credits";
import type { Database } from "../db";
import { videoJob } from "../db/schema/video";
import {
  deleteAsset,
  describeImage,
  getAssetTask,
  listAssets,
  getVideoTask,
  submitImageAsset,
  submitVideoTask,
  uploadImage,
} from "./apimart";
import {
  VIDEO_STORAGE_PREFIX,
  type VideoMediaEnv,
  videoTemplateConfig,
  getVideoTemplate,
  templateMediaUrl,
} from "./config";
import { alertApimartOutOfBalance, isApimartOutOfBalance } from "./balance-alert";
import { notifyVideoReady } from "./ready-email";
import { type VideoErrorCode, classifyVideoError } from "./errors";
import {
  APPEARANCE_NOTE_QUESTION,
  appendAppearanceNotes,
  cleanAppearanceNote,
} from "./appearance-notes";

type VideoJobRow = typeof videoJob.$inferSelect;

type VideoEnv = Pick<
  Cloudflare.Env,
  | "APIMART_API_KEY"
  | "APIMART_BASE_URL"
  | "APIMART_ASSET_GROUP_ID"
  | "SERVER_URL"
  | "WEBSITE_URL"
  | "STORAGE"
  | "ADMIN_EMAIL"
> &
  VideoMediaEnv;

export type PublicVideoJob = {
  id: string;
  templateId: VideoTemplateId;
  status: VideoJobRow["status"];
  /** While processing: photo review in the asset library, then the render itself. */
  phase: "reviewing" | "rendering" | null;
  quality: VideoJobRow["quality"];
  model: VideoJobRow["model"];
  progress: number;
  /** Null once the uploaded photos were purged (see purgeExpiredVideoInputs). */
  leftImageUrl: string | null;
  /** Only set for three-person templates. */
  middleImageUrl: string | null;
  /** Null for one-photo templates. */
  rightImageUrl: string | null;
  videoUrl: string | null;
  error: string | null;
  errorCode: VideoErrorCode | null;
  creditsCost: number;
  creditsRefunded: boolean;
  createdAt: string;
};

export class VideoJobError extends Error {
  constructor(
    readonly code:
      | "INSUFFICIENT_CREDITS"
      | "INVALID_QUALITY"
      | "MISSING_PHOTO"
      | "NOT_CONFIGURED"
      | "PHOTO_REJECTED"
      | "SUBMIT_FAILED",
    message: string,
  ) {
    super(message);
  }
}

// A job row that never received a provider task id was interrupted mid-submit.
const STALE_SUBMIT_MS = 10 * 60 * 1000;
// providerTaskId placeholder while one sync claims the render submit, so concurrent syncs
// (client polling and the cron) never submit the same job twice.
const SUBMITTING = "submitting";

/** Job columns that hold each photo slot's stored image and its asset-library review task. */
const SLOT_COLUMNS = {
  left: { image: "leftImageKey", review: "leftAssetTaskId" },
  middle: { image: "middleImageKey", review: "middleAssetTaskId" },
  right: { image: "rightImageKey", review: "rightAssetTaskId" },
} as const satisfies Record<
  VideoPhotoSlot,
  { image: keyof VideoJobRow; review: keyof VideoJobRow }
>;

/**
 * The photo slots a job casts, in prompt order (@图片1, @图片2, …). Templates with optional
 * photos store them in the first slots, so the filled slots are the cast.
 */
function jobSlots(
  job: Pick<VideoJobRow, "templateId" | "leftImageKey" | "middleImageKey" | "rightImageKey">,
): readonly VideoPhotoSlot[] {
  return videoTemplates[job.templateId as VideoTemplateId].slots.filter(
    (slot) => job[SLOT_COLUMNS[slot].image],
  );
}
const CRON_SYNC_LIMIT = 25;

const IMAGE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function getVideoMediaUrl(env: Pick<Cloudflare.Env, "SERVER_URL">, key: string): string {
  return `${env.SERVER_URL.replace(/\/$/, "")}/api/video/media/${key}`;
}

export function toPublicVideoJob(
  env: Pick<Cloudflare.Env, "SERVER_URL">,
  job: VideoJobRow,
): PublicVideoJob {
  return {
    id: job.id,
    templateId: job.templateId as VideoTemplateId,
    status: job.status,
    phase: jobPhase(job),
    quality: job.quality,
    model: job.model,
    progress: job.status === "succeeded" ? 100 : job.progress,
    leftImageUrl: job.inputsDeletedAt ? null : getVideoMediaUrl(env, job.leftImageKey),
    middleImageUrl:
      job.middleImageKey && !job.inputsDeletedAt ? getVideoMediaUrl(env, job.middleImageKey) : null,
    rightImageUrl:
      job.rightImageKey && !job.inputsDeletedAt ? getVideoMediaUrl(env, job.rightImageKey) : null,
    videoUrl: job.outputKey ? getVideoMediaUrl(env, job.outputKey) : null,
    error: job.error,
    errorCode: classifyVideoError(job.error),
    creditsCost: job.creditsCost,
    creditsRefunded: job.creditsRefunded,
    createdAt: job.createdAt.toISOString(),
  };
}

function jobPhase(job: VideoJobRow): PublicVideoJob["phase"] {
  if (job.status !== "processing") return null;
  return job.providerTaskId && job.providerTaskId !== SUBMITTING ? "rendering" : "reviewing";
}

/**
 * Charges credits, stores both photos, and sends them to the asset library for review.
 * syncVideoJob submits the render once both photos pass.
 */
export async function createVideoJob(
  db: Database,
  env: VideoEnv,
  credits: Pick<ReturnType<typeof createCreditsService>, "consumeCredits">,
  input: {
    userId: string;
    templateId: VideoTemplateId;
    quality: VideoQuality;
    model: VideoModel;
    photos: Partial<Record<VideoPhotoSlot, File>>;
  },
): Promise<VideoJobRow> {
  if (!isVideoModelQuality(input.model, input.quality)) {
    throw new VideoJobError("INVALID_QUALITY", `${input.model} does not render ${input.quality}`);
  }
  if (!getVideoTemplateModels(input.templateId).includes(input.model)) {
    throw new VideoJobError(
      "INVALID_QUALITY",
      `${input.templateId} is not offered on ${input.model}`,
    );
  }
  const template = getVideoTemplate(input.templateId, input.model);
  // Uploads fill the template's slots in order, so a gap left in the form never becomes a gap in the cast.
  const files = template.slots
    .map((slot) => input.photos[slot])
    .filter((file): file is File => Boolean(file));
  const minPhotos = getVideoMinPhotos(input.templateId);
  if (files.length < minPhotos) {
    throw new VideoJobError("MISSING_PHOTO", `At least ${minPhotos} photos are required`);
  }
  const photos = files.map((file, index) => [template.slots[index], file] as const);
  const referenceVideoUrl = templateMediaUrl(env, template.referenceVideoPath);
  if (!referenceVideoUrl || !env.APIMART_API_KEY) {
    throw new VideoJobError(
      "NOT_CONFIGURED",
      "Template reference video or provider key is missing",
    );
  }

  const jobId = crypto.randomUUID();
  const now = new Date();
  const firstFullCredits = getVideoFirstFullCredits(input.quality, input.templateId, input.model);
  // Two first-full renders submitted at the same instant could both get the price; at ~$2 each
  // that isn't worth a lock.
  const creditsCost =
    firstFullCredits !== null && (await isVideoFirstFullEligible(db, input.userId))
      ? firstFullCredits
      : getVideoCreditsCost(input.quality, input.templateId, input.model);
  const stored = photos.map(([slot, file]) => ({
    slot,
    file,
    key: inputKey(input.userId, jobId, slot, file.type),
  }));
  const imageKeys = Object.fromEntries(
    stored.map(({ slot, key }) => [SLOT_COLUMNS[slot].image, key]),
  ) as { leftImageKey: string; middleImageKey?: string; rightImageKey?: string };

  await Promise.all(
    stored.map(({ file, key }) =>
      env.STORAGE.put(key, file, { httpMetadata: { contentType: file.type } }),
    ),
  );

  try {
    await credits.consumeCredits({
      user: { userId: input.userId },
      amount: creditsCost,
      idempotencyKey: `video:${jobId}`,
      metadata: { jobId, templateId: input.templateId, quality: input.quality, model: input.model },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Insufficient credits") {
      throw new VideoJobError("INSUFFICIENT_CREDITS", error.message);
    }
    throw error;
  }

  await db.insert(videoJob).values({
    id: jobId,
    userId: input.userId,
    templateId: input.templateId,
    status: "processing",
    provider: videoTemplateConfig.provider,
    quality: input.quality,
    model: input.model,
    progress: 0,
    ...imageKeys,
    creditsCost,
    createdAt: now,
    updatedAt: now,
  });

  try {
    // Real faces only pass Seedance moderation as reviewed library assets, so each photo
    // gets its own review task (keeps photo order unambiguous).
    const reviewTasks = await Promise.all(
      stored.map(async ({ slot, file }) => {
        const imageUrl = await uploadImage(env, file, fileName(slot, file.type));
        const taskId = await submitImageAsset(env, {
          model: input.model,
          imageUrl,
          name: `${jobId}-${slot}`,
          groupId: env.APIMART_ASSET_GROUP_ID || undefined,
        });
        return [SLOT_COLUMNS[slot].review, taskId] as const;
      }),
    );
    const [updated] = await db
      .update(videoJob)
      .set({ ...Object.fromEntries(reviewTasks), progress: 2, updatedAt: new Date() })
      .where(eq(videoJob.id, jobId))
      .returning();
    return updated;
  } catch (error) {
    const message = error instanceof Error ? error.message : "submit_failed";
    console.error("[video] submit failed", jobId, message);
    await failAndRefund(db, env, jobId, message);
    if (isApimartOutOfBalance(message)) await alertApimartOutOfBalance(env, jobId);
    throw new VideoJobError(
      classifyVideoError(message) === "photo_rejected" ? "PHOTO_REJECTED" : "SUBMIT_FAILED",
      message,
    );
  }
}

/**
 * Describes each photo's hair and headwear, in slot order. Best effort: a photo whose description
 * fails or times out gets null, and the render goes ahead without that note.
 */
async function describeJobAppearance(
  env: VideoEnv,
  job: VideoJobRow,
): Promise<Array<string | null>> {
  const model = videoTemplateConfig.appearanceNoteModel;
  if (!model) return [];
  return Promise.all(
    jobSlots(job).map(async (slot) => {
      const key = job[SLOT_COLUMNS[slot].image];
      if (!key) return null;
      try {
        const note = await describeImage(env, {
          model,
          prompt: APPEARANCE_NOTE_QUESTION,
          imageUrl: getVideoMediaUrl(env, key),
          timeoutMs: videoTemplateConfig.appearanceNoteTimeoutMs,
        });
        return cleanAppearanceNote(note);
      } catch (error) {
        console.warn("[video] appearance note failed", job.id, slot, error);
        return null;
      }
    }),
  );
}

/** Submits the render with the approved `asset://` photos, in slot order. One caller wins the claim. */
async function submitRender(
  db: Database,
  env: VideoEnv,
  job: VideoJobRow,
  assetUrls: string[],
): Promise<VideoJobRow> {
  const [claimed] = await db
    .update(videoJob)
    .set({ providerTaskId: SUBMITTING, updatedAt: new Date() })
    .where(
      and(
        eq(videoJob.id, job.id),
        eq(videoJob.status, "processing"),
        isNull(videoJob.providerTaskId),
      ),
    )
    .returning();
  if (!claimed) return (await reload(db, job.id)) ?? job;

  const template = getVideoTemplate(job.templateId as VideoTemplateId, job.model);
  const referenceVideoUrl = templateMediaUrl(env, template.referenceVideoPath);
  try {
    if (!referenceVideoUrl) throw new Error("reference_video_missing");
    const isEdit = videoTemplateConfig.mode === "edit";
    const notes = await describeJobAppearance(env, claimed);
    const taskId = await submitVideoTask(env, {
      model: job.model,
      prompt: appendAppearanceNotes(template.buildPrompt(jobSlots(claimed).length), notes),
      // Order matters: @视频1 = reference clip, then @图片1… follow the template's slot order.
      // No audio reference: copyrighted music is rejected upstream, so the soundtrack is muxed client-side.
      videoUrls: [referenceVideoUrl],
      audioUrls: [],
      imageUrls: assetUrls,
      resolution: job.quality,
      size: isEdit ? "adaptive" : template.aspectRatio,
      duration: isEdit ? -1 : template.durationSeconds,
      generateAudio: videoTemplateConfig.generateAudio,
      taskType: job.model === "seedance-2.5" ? videoTemplateConfig.mode : undefined,
    });
    const now = new Date();
    const [updated] = await db
      .update(videoJob)
      .set({ providerTaskId: taskId, progress: 5, lastPolledAt: now, updatedAt: now })
      .where(eq(videoJob.id, job.id))
      .returning();
    return updated ?? claimed;
  } catch (error) {
    const message = error instanceof Error ? error.message : "submit_failed";
    console.error("[video] render submit failed", job.id, message);
    const failed = await failAndRefund(db, env, job.id, message);
    if (isApimartOutOfBalance(message)) await alertApimartOutOfBalance(env, job.id);
    return failed ?? claimed;
  }
}

/** Polls every photo review; fails the job on a rejection, submits the render when all pass. */
async function syncAssetReview(
  db: Database,
  env: VideoEnv,
  job: VideoJobRow,
): Promise<VideoJobRow> {
  const sides = jobSlots(job).map((slot) => [slot, job[SLOT_COLUMNS[slot].review]] as const);
  let reviews: Array<Awaited<ReturnType<typeof getAssetTask>>>;
  try {
    reviews = await Promise.all(sides.map(([, taskId]) => getAssetTask(env, taskId ?? "")));
  } catch (error) {
    console.error("[video] asset review check failed", job.id, error);
    return job;
  }

  for (const [index, [side]] of sides.entries()) {
    const review = reviews[index];
    if (review?.status === "failed" || review?.status === "cancelled") {
      const reason = review.error ? `: ${review.error}` : "";
      return (await failAndRefund(db, env, job.id, `asset_review_failed:${side}${reason}`)) ?? job;
    }
  }

  if (reviews.every((review) => review.status === "completed")) {
    const assetUrls = reviews.map((review) => review.assetUrl);
    if (assetUrls.some((url) => !url)) {
      return (await failAndRefund(db, env, job.id, "asset_url_missing")) ?? job;
    }
    return submitRender(db, env, job, assetUrls as string[]);
  }

  const now = new Date();
  const [updated] = await db
    .update(videoJob)
    .set({ lastPolledAt: now, updatedAt: now })
    .where(and(eq(videoJob.id, job.id), eq(videoJob.status, "processing")))
    .returning();
  return updated ?? job;
}

/** Whether the user's next full (seedance-2.5) video gets the first-full price: none kept so far. */
export async function isVideoFirstFullEligible(db: Database, userId: string): Promise<boolean> {
  // Refunded renders don't count, so a failed first video gives the offer back.
  const [kept] = await db
    .select({ id: videoJob.id })
    .from(videoJob)
    .where(
      and(
        eq(videoJob.userId, userId),
        eq(videoJob.model, "seedance-2.5"),
        eq(videoJob.creditsRefunded, false),
      ),
    )
    .limit(1);
  return !kept;
}

export async function getVideoJobForUser(
  db: Database,
  userId: string,
  jobId: string,
): Promise<VideoJobRow | undefined> {
  const [job] = await db
    .select()
    .from(videoJob)
    .where(and(eq(videoJob.id, jobId), eq(videoJob.userId, userId)))
    .limit(1);
  return job;
}

export function listVideoJobsForUser(db: Database, userId: string, limit: number) {
  return db
    .select()
    .from(videoJob)
    .where(eq(videoJob.userId, userId))
    .orderBy(desc(videoJob.createdAt))
    .limit(limit);
}

/** Advances a processing job by asking the provider for its status. */
export async function syncVideoJob(
  db: Database,
  env: VideoEnv,
  job: VideoJobRow,
  /** Runs work after the response (the Worker's waitUntil); without it the work is awaited. */
  defer?: (task: Promise<unknown>) => void,
): Promise<VideoJobRow> {
  if (job.status !== "processing") return job;

  const nowMs = Date.now();
  const reviewing = jobSlots(job).every((slot) => Boolean(job[SLOT_COLUMNS[slot].review]));
  // No review tasks and no render: the create request died mid-submit.
  // A stuck render claim: the sync that claimed it died before storing the task id.
  if (
    (!job.providerTaskId && !reviewing) ||
    (job.providerTaskId === SUBMITTING && nowMs - job.updatedAt.getTime() > STALE_SUBMIT_MS)
  ) {
    if (nowMs - job.createdAt.getTime() > STALE_SUBMIT_MS) {
      return (await failAndRefund(db, env, job.id, "submit_interrupted")) ?? job;
    }
    return job;
  }
  if (job.providerTaskId === SUBMITTING) return job;
  if (job.lastPolledAt && nowMs - job.lastPolledAt.getTime() < videoTemplateConfig.pollIntervalMs) {
    return job;
  }
  if (nowMs - job.createdAt.getTime() > videoTemplateConfig.timeoutMs) {
    return (await failAndRefund(db, env, job.id, "timeout")) ?? job;
  }
  if (!job.providerTaskId) return syncAssetReview(db, env, job);

  let task: Awaited<ReturnType<typeof getVideoTask>>;
  try {
    task = await getVideoTask(env, job.providerTaskId);
  } catch (error) {
    console.error("[video] status check failed", job.id, error);
    return job;
  }

  if (task.status === "failed" || task.status === "cancelled") {
    return (await failAndRefund(db, env, job.id, task.error ?? `provider_${task.status}`)) ?? job;
  }

  if (task.status === "completed") {
    if (!task.videoUrl) {
      return (await failAndRefund(db, env, job.id, "provider_output_missing")) ?? job;
    }
    const outputKey = `${VIDEO_STORAGE_PREFIX}/outputs/${job.userId}/${job.id}.mp4`;
    try {
      const resp = await fetch(task.videoUrl);
      if (!resp.ok) throw new Error(`output_fetch_${resp.status}`);
      await env.STORAGE.put(outputKey, await resp.arrayBuffer(), {
        httpMetadata: { contentType: "video/mp4" },
      });
    } catch (error) {
      // The provider URL stays valid for about a day; the next poll retries the copy.
      console.error("[video] output copy failed", job.id, error);
      return job;
    }
    const now = new Date();
    const [updated] = await db
      .update(videoJob)
      .set({
        status: "succeeded",
        progress: 100,
        outputKey,
        providerCost: task.cost == null ? null : String(task.cost),
        completedAt: now,
        lastPolledAt: now,
        updatedAt: now,
      })
      .where(and(eq(videoJob.id, job.id), eq(videoJob.status, "processing")))
      .returning();
    if (updated) {
      await releaseJobAssets(env, updated);
      // Only the sync whose update moved the job to succeeded gets a row back, so this sends once.
      // A client poll returns without waiting for the mail.
      const notify = notifyVideoReady(db, env, updated);
      if (defer) defer(notify);
      else await notify;
    }
    return updated ?? (await reload(db, job.id)) ?? job;
  }

  const progress = normalizeProgress(task.progress, job.progress);
  const now = new Date();
  const [updated] = await db
    .update(videoJob)
    .set({ progress, lastPolledAt: now, updatedAt: now })
    .where(and(eq(videoJob.id, job.id), eq(videoJob.status, "processing")))
    .returning();
  return updated ?? job;
}

/** Cron safety net: finishes or refunds renders whose owners closed the page. */
export async function syncPendingVideoJobs(db: Database, env: VideoEnv): Promise<void> {
  const pending = await db
    .select()
    .from(videoJob)
    .where(
      and(eq(videoJob.status, "processing"), lt(videoJob.createdAt, new Date(Date.now() - 60_000))),
    )
    .orderBy(videoJob.createdAt)
    .limit(CRON_SYNC_LIMIT);
  const results = await Promise.allSettled(pending.map((job) => syncVideoJob(db, env, job)));
  for (const result of results) {
    if (result.status === "rejected") console.error("[video] cron sync failed", result.reason);
  }
}

/**
 * Deletes a finished job's photos from the Seedance asset library. They are only needed
 * while the render runs. Best effort: purgeStaleVideoAssets sweeps anything left behind.
 */
async function releaseJobAssets(env: VideoEnv, job: VideoJobRow): Promise<void> {
  if (!videoTemplateConfig.deleteLibraryAssets) return;
  const reviewTaskIds = jobSlots(job).flatMap((slot) => {
    const taskId = job[SLOT_COLUMNS[slot].review];
    return taskId ? [taskId] : [];
  });
  await Promise.all(
    reviewTaskIds.map(async (taskId) => {
      try {
        const { assetUrl } = await getAssetTask(env, taskId);
        if (assetUrl) await deleteAsset(env, assetUrl);
      } catch (error) {
        console.warn("[video] asset release failed", job.id, error);
      }
    }),
  );
}

// Renders time out after an hour, so any library photo older than this belongs to a finished job.
const STALE_ASSET_MS = 3 * 60 * 60 * 1000;
const ASSET_PAGE_SIZE = 100;
// APIMart rate-limits the asset endpoints (429), so deletes go one at a time, spaced out,
// a few per cron tick; the 15-minute cron works through any backlog.
const ASSET_DELETES_PER_RUN = 15;
const ASSET_DELETE_GAP_MS = 1000;

/** Cron safety net: deletes asset-library photos left behind by finished jobs. */
export async function purgeStaleVideoAssets(env: VideoEnv): Promise<number> {
  if (!videoTemplateConfig.deleteLibraryAssets) return 0;
  const groupId = env.APIMART_ASSET_GROUP_ID;
  if (!groupId || !env.APIMART_API_KEY) return 0;
  const cutoff = Date.now() - STALE_ASSET_MS;

  // Newest first: the oldest (stale) photos sit on the last page.
  const first = await listAssets(env, { groupId, page: 1, pageSize: ASSET_PAGE_SIZE });
  const lastPage = Math.max(1, Math.ceil(first.total / ASSET_PAGE_SIZE));
  const tail =
    lastPage === 1
      ? first
      : await listAssets(env, { groupId, page: lastPage, pageSize: ASSET_PAGE_SIZE });
  const stale = [...tail.items]
    .reverse()
    .filter((asset) => asset.createdAt.getTime() < cutoff)
    .slice(0, ASSET_DELETES_PER_RUN);

  let deleted = 0;
  for (const asset of stale) {
    try {
      // Sequential on purpose: parallel deletes trip the provider's rate limit.
      // oxlint-disable-next-line no-await-in-loop
      await deleteAsset(env, asset.id);
      deleted += 1;
    } catch (error) {
      // Rate-limited or failing: stop here, the next tick picks up the rest.
      console.warn("[video] asset purge paused", deleted, error);
      break;
    }
    // oxlint-disable-next-line no-await-in-loop
    await new Promise((resolve) => setTimeout(resolve, ASSET_DELETE_GAP_MS));
  }
  return deleted;
}

/**
 * The photos of one of the user's earlier jobs, for making the same video again on a better
 * version or quality without uploading them again. Throws MISSING_PHOTO once they're purged.
 */
export async function loadSourceJobPhotos(
  db: Database,
  env: VideoEnv,
  userId: string,
  sourceJobId: string,
): Promise<{ templateId: VideoTemplateId; photos: Partial<Record<VideoPhotoSlot, File>> }> {
  const job = await getVideoJobForUser(db, userId, sourceJobId);
  if (!job || job.inputsDeletedAt) {
    throw new VideoJobError("MISSING_PHOTO", "The earlier video's photos are no longer stored");
  }
  const entries = await Promise.all(
    jobSlots(job).map(async (slot) => {
      const key = job[SLOT_COLUMNS[slot].image];
      const object = key ? await env.STORAGE.get(key) : null;
      if (!object) {
        throw new VideoJobError("MISSING_PHOTO", "The earlier video's photos are no longer stored");
      }
      const type = object.httpMetadata?.contentType ?? "image/jpeg";
      const file = new File([await object.arrayBuffer()], fileName(slot, type), { type });
      return [slot, file] as const;
    }),
  );
  return { templateId: job.templateId as VideoTemplateId, photos: Object.fromEntries(entries) };
}

const INPUT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const INPUT_PURGE_LIMIT = 200;

/** Daily: deletes uploaded photos 30 days after the job was created. The video is kept. */
export async function purgeExpiredVideoInputs(db: Database, env: VideoEnv): Promise<number> {
  const cutoff = new Date(Date.now() - INPUT_RETENTION_MS);
  const jobs = await db
    .select()
    .from(videoJob)
    .where(and(isNull(videoJob.inputsDeletedAt), lt(videoJob.createdAt, cutoff)))
    .limit(INPUT_PURGE_LIMIT);
  const finished = jobs.filter((job) => job.status !== "processing");
  if (finished.length === 0) return 0;

  const keys = finished.flatMap((job) =>
    [job.leftImageKey, job.middleImageKey, job.rightImageKey].filter((key): key is string =>
      Boolean(key),
    ),
  );
  await env.STORAGE.delete(keys);
  await db
    .update(videoJob)
    .set({ inputsDeletedAt: new Date() })
    .where(
      inArray(
        videoJob.id,
        finished.map((job) => job.id),
      ),
    );
  return finished.length;
}

async function failAndRefund(
  db: Database,
  env: VideoEnv,
  jobId: string,
  error: string,
): Promise<VideoJobRow | undefined> {
  const now = new Date();
  const [failed] = await db
    .update(videoJob)
    .set({ status: "failed", error: error.slice(0, 500), completedAt: now, updatedAt: now })
    .where(and(eq(videoJob.id, jobId), eq(videoJob.status, "processing")))
    .returning();
  // Only the call that moved the job to failed cleans up, so concurrent polls don't repeat it.
  if (failed) await releaseJobAssets(env, failed);
  const job = failed ?? (await reload(db, jobId));
  if (!job || job.status !== "failed" || job.creditsRefunded) return job;

  // Idempotent by source id, so concurrent polls cannot double-refund.
  await grantCredits(db, {
    user: { userId: job.userId },
    amount: job.creditsCost,
    sourceProvider: "app",
    sourceType: "refund",
    sourceId: `video-refund:${job.id}`,
    metadata: { jobId: job.id, templateId: job.templateId },
  });
  const [refunded] = await db
    .update(videoJob)
    .set({ creditsRefunded: true, updatedAt: new Date() })
    .where(eq(videoJob.id, job.id))
    .returning();
  return refunded ?? job;
}

async function reload(db: Database, jobId: string): Promise<VideoJobRow | undefined> {
  const [job] = await db.select().from(videoJob).where(eq(videoJob.id, jobId)).limit(1);
  return job;
}

function normalizeProgress(value: number | undefined, previous: number): number {
  if (value == null || Number.isNaN(value)) return Math.max(previous, 10);
  const percent = value > 0 && value <= 1 ? value * 100 : value;
  // Hold at 95 until the output is actually stored.
  return Math.max(previous, Math.min(95, Math.round(percent)));
}

function inputKey(userId: string, jobId: string, side: VideoPhotoSlot, mime: string): string {
  return `${VIDEO_STORAGE_PREFIX}/inputs/${userId}/${jobId}-${side}.${IMAGE_EXTENSIONS[mime] ?? "jpg"}`;
}

function fileName(side: VideoPhotoSlot, mime: string): string {
  return `${side}.${IMAGE_EXTENSIONS[mime] ?? "jpg"}`;
}
