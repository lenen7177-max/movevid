/**
 * File Serve Handler
 *
 * Handles file download/serving from storage.
 * Supports caching headers for performance.
 */

import type { Context as HonoContext } from "hono";
import { resolveCommonConfig } from "@repo/app-config/config";
import { getStorageProvider, parseStoragePath } from "../storage";

/**
 * Handle file serving/download
 *
 * GET /api/storage/*
 *
 * Serves files from storage with proper content-type and caching headers.
 *
 * Response:
 * - 200: File binary data with appropriate headers
 * - 400: { error: string } - Missing key
 * - 404: { error: string } - File not found
 */
export async function handleFileServe(
  c: HonoContext<{ Bindings: Cloudflare.Env }>,
): Promise<Response> {
  const storagePath = c.req.path.replace("/api/storage/", "");
  const parsedStoragePath = parseStoragePath(storagePath);
  const storageKeyPrefixes = resolveCommonConfig().storage.keyPrefixes;

  if (!parsedStoragePath) {
    return c.json({ error: "File key is required" }, 400);
  }

  // Use storage provider for file serving
  const storageProvider = getStorageProvider({
    storage: c.env.STORAGE,
    provider: parsedStoragePath.provider,
    aliyunOssEnv: c.env,
  });
  const file = await storageProvider.get(parsedStoragePath.key);

  if (!file) {
    return c.json({ error: "File not found" }, 404);
  }

  const headers = new Headers();

  // Set content type from metadata
  if (file.httpMetadata?.contentType) {
    headers.set("Content-Type", file.httpMetadata.contentType);
  }

  // Set cache headers (1 day for avatars, 1 hour for others)
  const isAvatar = parsedStoragePath.key.startsWith(`${storageKeyPrefixes.avatar}/`);
  const maxAge = isAvatar ? 86400 : 3600;
  headers.set("Cache-Control", `public, max-age=${maxAge}`);

  // Set ETag for cache validation
  headers.set("ETag", file.etag);

  return c.newResponse(file.body, {
    status: 200,
    headers,
  });
}
