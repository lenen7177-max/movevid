/**
 * Storage Module
 *
 * Provider-agnostic storage abstraction for file upload, download, and management.
 */

import { resolveCommonConfig } from "@repo/app-config/config";
import {
  createAliyunOssStorageProvider,
  resolveAliyunOssOptions,
  type AliyunOssStorageProviderOptions,
} from "./providers/aliyun-oss";
import { createR2StorageProvider } from "./providers/r2";
import type { StorageProvider, StorageProviderKey } from "./types";

export {
  getAllowedFileTypes,
  getKeyFromUrl,
  getMaxFileSize,
  parseStoragePath,
  parseStoragePublicUrl,
  getPublicUrl,
  getStoragePublicBaseUrl,
  getUserStoragePrefix,
  getUserStoragePrefixes,
  isAllowedFileSize,
  isAllowedFileType,
} from "@repo/app-config/storage";
// Types
export type {
  ListOptions,
  PutOptions,
  StorageData,
  StorageHttpMetadata,
  StorageObject,
  StorageObjectBody,
  StorageObjectMeta,
  StorageProvider,
  StorageProviderKey,
} from "./types";
// Utilities
export { generateStorageKey } from "./utils";

const r2ProviderCache = new WeakMap<R2Bucket, StorageProvider>();
const aliyunOssProviderCache = new Map<string, StorageProvider>();

export type StorageProviderOptions = {
  storage: R2Bucket;
  provider?: StorageProviderKey;
  aliyunOss?: AliyunOssStorageProviderOptions;
  aliyunOssEnv?: Parameters<typeof resolveAliyunOssOptions>[0];
};

export function resolveAliyunOssStorageOptions(
  env: Parameters<typeof resolveAliyunOssOptions>[0],
): AliyunOssStorageProviderOptions {
  return resolveAliyunOssOptions(env);
}

function getAliyunOssCacheKey(options: AliyunOssStorageProviderOptions): string {
  return [options.accessKeyId, options.bucket, options.region, options.endpoint].join("|");
}

export function resolveStorageProviderKey(provider?: StorageProviderKey): StorageProviderKey {
  return provider ?? resolveCommonConfig().storage.provider;
}

/**
 * Get storage provider based on configuration
 *
 * @param options - Options containing storage bucket
 * @returns Storage provider instance
 *
 * @example
 * ```typescript
 * const provider = getStorageProvider({ storage: env.STORAGE });
 * await provider.put('key', data);
 * ```
 */
export function getStorageProvider({
  storage,
  provider,
  aliyunOss,
  aliyunOssEnv,
}: StorageProviderOptions): StorageProvider {
  const providerKey = resolveStorageProviderKey(provider);

  if (providerKey === "r2") {
    const cached = r2ProviderCache.get(storage);
    if (cached) {
      return cached;
    }

    const provider = createR2StorageProvider({ bucket: storage });
    r2ProviderCache.set(storage, provider);
    return provider;
  }

  if (providerKey === "aliyun-oss") {
    const resolvedAliyunOss =
      aliyunOss ?? (aliyunOssEnv ? resolveAliyunOssOptions(aliyunOssEnv) : undefined);
    if (!resolvedAliyunOss) {
      throw new Error("Aliyun OSS storage options are required");
    }

    const cacheKey = getAliyunOssCacheKey(resolvedAliyunOss);
    const cached = aliyunOssProviderCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const provider = createAliyunOssStorageProvider(resolvedAliyunOss);
    aliyunOssProviderCache.set(cacheKey, provider);
    return provider;
  }

  throw new Error(`Storage provider not registered: ${providerKey}`);
}
