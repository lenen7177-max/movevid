import { VIDEO_MODELS, VIDEO_QUALITIES } from "@repo/app-config/video";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { user } from "./auth";

export const VIDEO_JOB_STATUSES = ["processing", "succeeded", "failed"] as const;

export type VideoJobStatus = (typeof VIDEO_JOB_STATUSES)[number];

/** One template render (one to three photos) submitted to the video provider. */
export const videoJob = sqliteTable(
  "video_job",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    templateId: text("template_id").notNull(),
    status: text("status", { enum: VIDEO_JOB_STATUSES }).notNull().default("processing"),
    provider: text("provider").notNull(),
    // Output resolution the user picked; also decides creditsCost.
    quality: text("quality", { enum: VIDEO_QUALITIES }).notNull().default("720p"),
    // Seedance model the user picked; Seedance 2.0 models render the template's highlight cut.
    model: text("model", { enum: VIDEO_MODELS }).notNull().default("seedance-2.5"),
    // Asset-library review tasks per photo slot; the render is submitted once all of them pass.
    // The middle slot is only used by three-person templates.
    leftAssetTaskId: text("left_asset_task_id"),
    middleAssetTaskId: text("middle_asset_task_id"),
    rightAssetTaskId: text("right_asset_task_id"),
    providerTaskId: text("provider_task_id"),
    progress: integer("progress").notNull().default(0),
    leftImageKey: text("left_image_key").notNull(),
    middleImageKey: text("middle_image_key"),
    // Null for one-photo templates.
    rightImageKey: text("right_image_key"),
    outputKey: text("output_key"),
    // When the uploaded photos were purged from storage (30 days after creation); the video stays.
    inputsDeletedAt: integer("inputs_deleted_at", { mode: "timestamp" }),
    creditsCost: integer("credits_cost").notNull(),
    creditsRefunded: integer("credits_refunded", { mode: "boolean" }).notNull().default(false),
    // Provider-reported USD cost, kept to check margins against credit pricing.
    providerCost: text("provider_cost"),
    error: text("error"),
    lastPolledAt: integer("last_polled_at", { mode: "timestamp" }),
    completedAt: integer("completed_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("video_job_user_created_idx").on(table.userId, table.createdAt),
    index("video_job_status_idx").on(table.status),
  ],
);
