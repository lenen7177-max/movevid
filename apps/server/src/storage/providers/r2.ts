import type { StorageObject, StorageObjectBody, StorageProvider } from "../types";

/**
 * R2 storage provider factory
 *
 * Wraps Cloudflare R2Bucket to implement the StorageProvider interface.
 * This is the default provider used when deploying to Cloudflare Workers.
 */
export function createR2StorageProvider({ bucket }: { bucket: R2Bucket }): StorageProvider {
  const mapR2ObjectToStorageObject = (r2Object: R2Object): StorageObject => ({
    key: r2Object.key,
    size: r2Object.size,
    etag: r2Object.etag,
    httpMetadata: r2Object.httpMetadata
      ? {
          contentType: r2Object.httpMetadata.contentType,
          contentLanguage: r2Object.httpMetadata.contentLanguage,
          contentDisposition: r2Object.httpMetadata.contentDisposition,
          contentEncoding: r2Object.httpMetadata.contentEncoding,
          cacheControl: r2Object.httpMetadata.cacheControl,
          cacheExpiry: r2Object.httpMetadata.cacheExpiry,
        }
      : undefined,
    customMetadata: r2Object.customMetadata,
    uploaded: r2Object.uploaded,
  });

  const mapR2ObjectBodyToStorageObjectBody = (r2Object: R2ObjectBody): StorageObjectBody => ({
    ...mapR2ObjectToStorageObject(r2Object),
    body: r2Object.body,
    bodyUsed: r2Object.bodyUsed,
    arrayBuffer: () => r2Object.arrayBuffer(),
    text: () => r2Object.text(),
  });

  return {
    async put(key, data, options) {
      try {
        const result = await bucket.put(key, data, {
          httpMetadata: options?.contentType ? { contentType: options.contentType } : undefined,
          customMetadata: options?.customMetadata,
        });

        return mapR2ObjectToStorageObject(result);
      } catch (error) {
        throw new Error(
          `Failed to upload file: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }
    },

    async get(key) {
      try {
        const result = await bucket.get(key);
        if (!result) {
          return null;
        }

        return mapR2ObjectBodyToStorageObjectBody(result);
      } catch (error) {
        throw new Error(
          `Failed to retrieve file: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }
    },

    async head(key) {
      try {
        const result = await bucket.head(key);
        if (!result) {
          return null;
        }

        return mapR2ObjectToStorageObject(result);
      } catch (error) {
        throw new Error(
          `Failed to get file metadata: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }
    },

    async list({ prefix }) {
      try {
        const objects: StorageObject[] = [];
        let cursor: string | undefined;

        do {
          const result = await bucket.list({
            prefix,
            cursor,
            limit: 1000,
          });
          objects.push(...result.objects.map(mapR2ObjectToStorageObject));
          cursor = result.truncated ? result.cursor : undefined;
        } while (cursor);

        return objects;
      } catch (error) {
        throw new Error(
          `Failed to list files: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }
    },

    async delete(key) {
      try {
        await bucket.delete(key);
      } catch (error) {
        throw new Error(
          `Failed to delete file: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }
    },
  };
}
