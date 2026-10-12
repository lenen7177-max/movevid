/**
 * Storage Utilities
 *
 * Helper functions for key generation and validation.
 */

import { resolveCommonConfig } from "@repo/app-config/config";
import type { UploadPurpose } from "@repo/app-config/storage";

const MIME_EXTENSION_MAP = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "application/pdf": "pdf",
  "text/plain": "txt",
} as const;

/**
 * Generate a storage key for a file
 *
 * @param purpose - The purpose of the upload (avatar, attachment)
 * @param userId - The user ID to namespace the file
 * @param filename - Original filename
 * @returns A unique storage key
 */
export function generateStorageKey(
  purpose: UploadPurpose,
  userId: string,
  filename: string,
  contentType?: string,
): string {
  const storageConfig = resolveCommonConfig().storage;

  // Validate inputs
  if (!userId || typeof userId !== "string") {
    throw new Error("Valid userId is required for storage key generation");
  }
  if (!filename || typeof filename !== "string") {
    throw new Error("Valid filename is required for storage key generation");
  }

  const timestamp = Date.now();
  const mimeType = contentType?.split(";")[0].trim();
  const ext = filename.includes(".")
    ? filename.split(".").pop() || ""
    : mimeType
      ? MIME_EXTENSION_MAP[mimeType as keyof typeof MIME_EXTENSION_MAP] || ""
      : "";

  // Sanitize extension: keep alphanumeric, hyphens, underscores, limit to 10 chars
  const sanitizedExt = ext
    .toLowerCase()
    .replace(/[^\da-z\-_]/g, "")
    .slice(0, 10);

  switch (purpose) {
    case "avatar": {
      return `${storageConfig.keyPrefixes.avatar}/${userId}/${timestamp}.${sanitizedExt}`;
    }
    case "attachment": {
      return `${storageConfig.keyPrefixes.attachment}/${userId}/${timestamp}.${sanitizedExt}`;
    }
    default: {
      return `${storageConfig.fallbackPrefix}/${userId}/${timestamp}.${sanitizedExt}`;
    }
  }
}
