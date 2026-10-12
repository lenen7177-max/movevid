import { ORPCError } from "@orpc/server";
import {
  VIDEO_MODELS,
  VIDEO_QUALITIES,
  VIDEO_TEMPLATE_IDS,
  videoConfig,
} from "@repo/app-config/video";
import { z } from "zod";
import { videoTemplateConfig } from "@/video/config";
import { VIDEO_ERROR_CODES } from "@/video/errors";
import {
  VideoJobError,
  createVideoJob,
  getVideoJobForUser,
  isVideoFirstFullEligible,
  listVideoJobsForUser,
  syncVideoJob,
  toPublicVideoJob,
} from "@/video/service";
import type { Context } from "@/lib/context";
import { protectedProcedure, publicProcedure } from "@/lib/orpc";

const jobSchema = z.object({
  id: z.string(),
  templateId: z.enum(VIDEO_TEMPLATE_IDS),
  status: z.enum(["processing", "succeeded", "failed"]),
  phase: z.enum(["reviewing", "rendering"]).nullable(),
  quality: z.enum(VIDEO_QUALITIES),
  model: z.enum(VIDEO_MODELS),
  progress: z.number(),
  leftImageUrl: z.string().nullable(),
  middleImageUrl: z.string().nullable(),
  rightImageUrl: z.string().nullable(),
  videoUrl: z.string().nullable(),
  error: z.string().nullable(),
  errorCode: z.enum(VIDEO_ERROR_CODES).nullable(),
  creditsCost: z.number(),
  creditsRefunded: z.boolean(),
  createdAt: z.string(),
});

const photoSchema = z
  .file()
  .max(videoTemplateConfig.maxImageBytes)
  .mime([...videoTemplateConfig.allowedImageTypes]);

function requireUserId(context: Context): string {
  const userId = context.session?.user.id;
  if (!userId) throw new ORPCError("UNAUTHORIZED");
  return userId;
}

/** Template video renders: config, create, poll and history. */
export const videoRouter = {
  config: publicProcedure
    .output(
      z.object({
        templateIds: z.array(z.enum(VIDEO_TEMPLATE_IDS)),
        defaultTemplateId: z.enum(VIDEO_TEMPLATE_IDS),
        qualities: z.record(z.enum(VIDEO_QUALITIES), z.object({ creditsCost: z.number() })),
        defaultQuality: z.enum(VIDEO_QUALITIES),
        maxImageBytes: z.number(),
        allowedImageTypes: z.array(z.string()),
      }),
    )
    .handler(() => ({
      templateIds: [...VIDEO_TEMPLATE_IDS],
      defaultTemplateId: videoConfig.defaultTemplateId,
      qualities: videoConfig.qualities,
      defaultQuality: videoConfig.defaultQuality,
      maxImageBytes: videoTemplateConfig.maxImageBytes,
      allowedImageTypes: [...videoTemplateConfig.allowedImageTypes],
    })),

  // Whether the viewer's first full video still gets videoConfig.firstFullCredits; signed-out
  // visitors haven't made one yet.
  offer: publicProcedure
    .output(z.object({ firstFull: z.boolean() }))
    .handler(async ({ context }) => {
      const userId = context.session?.user.id;
      return { firstFull: userId ? await isVideoFirstFullEligible(context.db, userId) : true };
    }),

  create: protectedProcedure
    .input(
      z.object({
        templateId: z.enum(VIDEO_TEMPLATE_IDS).default(videoConfig.defaultTemplateId),
        quality: z.enum(VIDEO_QUALITIES).default(videoConfig.defaultQuality),
        // Clients from before model choice send none and keep getting seedance-2.5.
        model: z.enum(VIDEO_MODELS).default("seedance-2.5"),
        left: photoSchema,
        // Only three-person templates use middle and one-photo templates skip right;
        // the service checks the template's slots.
        middle: photoSchema.optional(),
        right: photoSchema.optional(),
      }),
    )
    .output(jobSchema)
    .handler(async ({ context, input }) => {
      const userId = requireUserId(context);
      try {
        const job = await createVideoJob(context.db, context.env, context.credits, {
          userId,
          templateId: input.templateId,
          quality: input.quality,
          model: input.model,
          photos: { left: input.left, middle: input.middle, right: input.right },
        });
        return toPublicVideoJob(context.env, job);
      } catch (error) {
        if (error instanceof VideoJobError) {
          throw new ORPCError(
            ["INSUFFICIENT_CREDITS", "INVALID_QUALITY", "MISSING_PHOTO", "PHOTO_REJECTED"].includes(
              error.code,
            )
              ? "BAD_REQUEST"
              : "BAD_GATEWAY",
            { message: error.code, data: { reason: error.code } },
          );
        }
        throw error;
      }
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .output(jobSchema)
    .handler(async ({ context, input }) => {
      const userId = requireUserId(context);
      const job = await getVideoJobForUser(context.db, userId, input.id);
      if (!job) throw new ORPCError("NOT_FOUND");
      const synced = await syncVideoJob(context.db, context.env, job);
      return toPublicVideoJob(context.env, synced);
    }),

  list: protectedProcedure
    .input(z.object({ limit: z.number().int().min(1).max(50).default(12) }).optional())
    .output(z.object({ jobs: z.array(jobSchema) }))
    .handler(async ({ context, input }) => {
      const userId = requireUserId(context);
      const jobs = await listVideoJobsForUser(context.db, userId, input?.limit ?? 12);
      return { jobs: jobs.map((job) => toPublicVideoJob(context.env, job)) };
    }),
};
