import { env } from "cloudflare:workers";
import { ORPCError } from "@orpc/server";
import { SUPPORTED_STORAGE_PROVIDERS } from "@repo/app-config";
import { z } from "zod";
import { protectedProcedure } from "@/lib/orpc";
import {
  generateStorageKey,
  getStorageProvider,
  getMaxFileSize,
  getPublicUrl,
  getStoragePublicBaseUrl,
  getUserStoragePrefix,
  getUserStoragePrefixes,
  isAllowedFileSize,
  isAllowedFileType,
  parseStoragePublicUrl,
  resolveStorageProviderKey,
} from "@/storage";

const uploadPurposeSchema = z.enum(["avatar", "attachment"]);
const storageProviderSchema = z.enum(SUPPORTED_STORAGE_PROVIDERS);

const uploadInputSchema = z.object({
  file: z.file(),
  purpose: uploadPurposeSchema,
  provider: storageProviderSchema.optional(),
});

const listInputSchema = z
  .object({
    provider: storageProviderSchema.optional(),
    purpose: uploadPurposeSchema.optional(),
  })
  .optional();

const uploadOutputSchema = z.object({
  url: z.string(),
  key: z.string(),
  size: z.number(),
  contentType: z.string(),
  provider: storageProviderSchema,
});

const listOutputSchema = z.object({
  files: z.array(uploadOutputSchema.extend({ uploadedAt: z.string().nullable() })),
});

export const storageRouter = {
  upload: protectedProcedure
    .input(uploadInputSchema)
    .output(uploadOutputSchema)
    .handler(async ({ context, input }) => {
      const { session, t } = context;
      const { file, purpose } = input;
      const provider = resolveStorageProviderKey(input.provider);

      const userId = session?.user.id;
      if (!userId) {
        throw new ORPCError("UNAUTHORIZED", {
          message: t("errors.unauthorized"),
        });
      }

      const contentType = file.type || "application/octet-stream";

      // Validate file type
      if (!isAllowedFileType(purpose, contentType)) {
        throw new ORPCError("BAD_REQUEST", {
          message: t("errors.invalidFileType"),
        });
      }

      // Validate file size
      if (!isAllowedFileSize(purpose, file.size)) {
        const maxSize = getMaxFileSize(purpose);
        const maxSizeMB = Math.round(maxSize / 1024 / 1024);
        throw new ORPCError("BAD_REQUEST", {
          message: t("errors.fileTooLarge", { maxSizeMB }),
        });
      }

      // Generate storage key
      const key = generateStorageKey(purpose, userId, file.name, contentType);
      const storageProvider = getStorageProvider({
        storage: env.STORAGE,
        provider,
        aliyunOssEnv: env,
      });

      await storageProvider.put(key, file, {
        contentType,
      });

      // Build the public URL
      const publicBaseUrl = getStoragePublicBaseUrl(env.SERVER_URL);
      const url = getPublicUrl(publicBaseUrl, key, provider);

      return {
        url,
        key,
        size: file.size,
        contentType,
        provider,
      };
    }),

  list: protectedProcedure
    .input(listInputSchema)
    .output(listOutputSchema)
    .handler(async ({ context, input }) => {
      const { session, t } = context;
      const provider = resolveStorageProviderKey(input?.provider);

      const userId = session?.user.id;
      if (!userId) {
        throw new ORPCError("UNAUTHORIZED", {
          message: t("errors.unauthorized"),
        });
      }

      const prefixes = input?.purpose
        ? [getUserStoragePrefix(input.purpose, userId)]
        : getUserStoragePrefixes(userId);

      const storageProvider = getStorageProvider({
        storage: env.STORAGE,
        provider,
        aliyunOssEnv: env,
      });
      const publicBaseUrl = getStoragePublicBaseUrl(env.SERVER_URL);
      const objects = (
        await Promise.all(prefixes.map((prefix) => storageProvider.list({ prefix })))
      )
        .flat()
        .sort((left, right) => {
          const leftTime = left.uploaded?.getTime() ?? 0;
          const rightTime = right.uploaded?.getTime() ?? 0;
          return rightTime - leftTime;
        });

      return {
        files: objects.map((object) => ({
          url: getPublicUrl(publicBaseUrl, object.key, provider),
          key: object.key,
          size: object.size,
          contentType: object.httpMetadata?.contentType ?? "application/octet-stream",
          provider,
          uploadedAt: object.uploaded?.toISOString() ?? null,
        })),
      };
    }),

  delete: protectedProcedure
    .input(z.object({ url: z.string() }))
    .output(z.object({ success: z.boolean() }))
    .handler(async ({ context, input }) => {
      const { session, t } = context;
      const { url } = input;

      const userId = session?.user.id;
      if (!userId) {
        throw new ORPCError("UNAUTHORIZED", {
          message: t("errors.unauthorized"),
        });
      }

      // Extract key from URL
      const publicBaseUrl = getStoragePublicBaseUrl(env.SERVER_URL);
      const parsedStorageUrl = parseStoragePublicUrl(publicBaseUrl, url);
      if (!parsedStorageUrl) {
        throw new ORPCError("BAD_REQUEST", {
          message: t("errors.invalidUrl"),
        });
      }
      const { key, provider } = parsedStorageUrl;

      // Verify the file belongs to the user (key starts with purpose/userId/)
      const isOwner = getUserStoragePrefixes(userId).some((prefix) => key.startsWith(prefix));

      if (!isOwner) {
        throw new ORPCError("FORBIDDEN", {
          message: t("errors.forbidden"),
        });
      }

      const storageProvider = getStorageProvider({
        storage: env.STORAGE,
        provider,
        aliyunOssEnv: env,
      });
      await storageProvider.delete(key);

      return { success: true };
    }),
};
