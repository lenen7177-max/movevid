import { trimTrailingSlash } from "@repo/shared";
import { resolveCommonConfig } from "../app-config";
import { SUPPORTED_STORAGE_PROVIDERS, type StorageProviderKey } from "../types";

/**
 * Type representing the purpose of a file upload
 */
export type UploadPurpose = keyof ReturnType<typeof getStorageConfig>["allowedTypes"];

export type ParsedStoragePath = {
  provider: StorageProviderKey;
  key: string;
  isProviderScoped: boolean;
};

function getStorageConfig() {
  return resolveCommonConfig().storage;
}

/**
 * Checks if the given MIME type is allowed for a specific upload purpose
 * @param purpose The intended purpose of the upload
 * @param contentType The MIME type of the file
 * @returns Whether the file type is allowed
 */
export function isAllowedFileType(purpose: UploadPurpose, contentType: string): boolean {
  const allowedTypes = getStorageConfig().allowedTypes[purpose] as readonly string[];
  return allowedTypes.includes(contentType);
}

/**
 * Checks if the file size is within the allowed limit for a specific purpose
 * @param purpose The intended purpose of the upload
 * @param size The size of the file in bytes
 * @returns Whether the file size is allowed
 */
export function isAllowedFileSize(purpose: UploadPurpose, size: number): boolean {
  return size <= getStorageConfig().maxFileSizes[purpose];
}

/**
 * Gets the maximum allowed file size for a specific purpose
 * @param purpose The intended purpose of the upload
 * @returns The maximum size in bytes
 */
export function getMaxFileSize(purpose: UploadPurpose): number {
  return getStorageConfig().maxFileSizes[purpose];
}

/**
 * Gets the list of allowed MIME types for a specific purpose
 * @param purpose The intended purpose of the upload
 * @returns A readonly array of MIME type strings
 */
export function getAllowedFileTypes(purpose: UploadPurpose): readonly string[] {
  return getStorageConfig().allowedTypes[purpose];
}

/**
 * Gets a comma-separated string of allowed MIME types for HTML input accept attribute
 * @param purpose The intended purpose of the upload
 * @returns A comma-separated string of MIME types
 */
export function getAcceptString(purpose: UploadPurpose): string {
  return getAllowedFileTypes(purpose).join(",");
}

/**
 * Build a user-scoped storage prefix for a purpose
 * @param purpose The intended purpose of the upload
 * @param userId The user ID
 * @returns The user-specific prefix with trailing slash
 */
export function getUserStoragePrefix(purpose: UploadPurpose, userId: string): string {
  return `${getStorageConfig().keyPrefixes[purpose]}/${userId}/`;
}

/**
 * Build all user-scoped prefixes used for ownership checks
 * @param userId The user ID
 * @returns Array of user-specific prefixes with trailing slashes
 */
export function getUserStoragePrefixes(userId: string): string[] {
  const storageConfig = getStorageConfig();
  const prefixes = Object.values(storageConfig.keyPrefixes).map((prefix) => `${prefix}/${userId}/`);
  prefixes.push(`${storageConfig.fallbackPrefix}/${userId}/`);
  return prefixes;
}

/**
 * Build the public base URL for storage from a server base URL
 * @param serverUrl The server base URL
 * @returns The public base URL for storage
 */
export function getStoragePublicBaseUrl(serverUrl: string): string {
  const baseUrl = trimTrailingSlash(serverUrl);
  return `${baseUrl}${getStorageConfig().publicPath}`;
}

function isStorageProviderKey(value: string): value is StorageProviderKey {
  return (SUPPORTED_STORAGE_PROVIDERS as readonly string[]).includes(value);
}

/**
 * Extract provider and key from a storage path.
 * Supports new provider-scoped paths and legacy key-only paths.
 * @param path The path after the storage public base path
 * @returns Parsed provider/key pair or null if invalid
 */
export function parseStoragePath(path: string): ParsedStoragePath | null {
  const normalizedPath = path.replace(/^\/+/, "");
  if (!normalizedPath) {
    return null;
  }

  const [firstSegment, ...remainingSegments] = normalizedPath.split("/");
  if (isStorageProviderKey(firstSegment)) {
    const key = remainingSegments.join("/");
    if (!key) {
      return null;
    }
    return {
      provider: firstSegment,
      key,
      isProviderScoped: true,
    };
  }

  return {
    provider: getStorageConfig().provider,
    key: normalizedPath,
    isProviderScoped: false,
  };
}

/**
 * Build a public URL for a stored file
 * @param publicBaseUrl The public base URL for storage
 * @param key The storage key
 * @param provider The storage provider used for the file
 * @returns Public URL for the file
 */
export function getPublicUrl(
  publicBaseUrl: string,
  key: string,
  provider: StorageProviderKey = getStorageConfig().provider,
): string {
  const baseUrl = trimTrailingSlash(publicBaseUrl);
  return `${baseUrl}/${provider}/${key}`;
}

/**
 * Extract provider and key from a public storage URL.
 * @param publicBaseUrl The public base URL for storage
 * @param url The public URL
 * @returns Parsed provider/key pair or null if the URL is invalid
 */
export function parseStoragePublicUrl(
  publicBaseUrl: string,
  url: string,
): ParsedStoragePath | null {
  const baseUrl = trimTrailingSlash(publicBaseUrl);
  if (url !== baseUrl && !url.startsWith(`${baseUrl}/`)) {
    return null;
  }

  const path = url.slice(baseUrl.length).replace(/^\/+/, "");
  return parseStoragePath(path);
}

/**
 * Extract a storage key from a public URL
 * @param publicBaseUrl The public base URL for storage
 * @param url The public URL
 * @returns Storage key or null if the URL is invalid
 */
export function getKeyFromUrl(publicBaseUrl: string, url: string): string | null {
  return parseStoragePublicUrl(publicBaseUrl, url)?.key ?? null;
}
