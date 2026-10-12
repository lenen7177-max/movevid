/**
 * Storage Provider Types
 *
 * Defines the interface for storage providers. Users can implement
 * custom providers by following this interface.
 */

/**
 * Data types that can be stored
 */
export type StorageData = ArrayBuffer | ReadableStream | string | Uint8Array | Blob;

/**
 * Storage provider identifiers
 */
export type { StorageProviderKey } from "@repo/app-config";

/**
 * Options for put operations
 */
export interface PutOptions {
  contentType?: string;
  customMetadata?: Record<string, string>;
}

/**
 * Options for list operations
 */
export interface ListOptions {
  prefix: string;
}

/**
 * HTTP metadata for stored objects
 */
export interface StorageHttpMetadata {
  contentType?: string;
  contentLanguage?: string;
  contentDisposition?: string;
  contentEncoding?: string;
  cacheControl?: string;
  cacheExpiry?: Date;
}

/**
 * Metadata for a stored object (without body)
 */
export interface StorageObjectMeta {
  key: string;
  size: number;
  etag: string;
  httpMetadata?: StorageHttpMetadata;
  customMetadata?: Record<string, string>;
  uploaded?: Date;
}

/**
 * Stored object with body stream
 */
export interface StorageObjectBody extends StorageObjectMeta {
  body: ReadableStream;
  bodyUsed: boolean;
  arrayBuffer(): Promise<ArrayBuffer>;
  text(): Promise<string>;
}

/**
 * Result of a put operation
 */
export interface StorageObject extends StorageObjectMeta {
  // Additional fields can be added by providers
}

/**
 * Storage Provider Interface
 *
 * Implement this interface to create a custom storage provider.
 * The default implementation uses Cloudflare R2 via createR2StorageProvider.
 *
 * @example
 * ```typescript
 * export function createS3StorageProvider({
 *   client,
 *   bucket,
 * }: {
 *   client: S3Client;
 *   bucket: string;
 * }): StorageProvider {
 *   return {
 *     async put(key: string, data: StorageData, options?: PutOptions) {
 *       // Implement S3 upload
 *     },
 *
 *     async get(key: string) {
 *       // Implement S3 download
 *     },
 *
 *     async head(key: string) {
 *       // Implement S3 head
 *     },
 *
 *     async delete(key: string) {
 *       // Implement S3 delete
 *     },
 *   };
 * }
 * ```
 */
export interface StorageProvider {
  /**
   * Store data at the specified key
   *
   * @param key - Storage key (path)
   * @param data - Data to store
   * @param options - Optional metadata
   * @returns Stored object metadata
   */
  put(key: string, data: StorageData, options?: PutOptions): Promise<StorageObject>;

  /**
   * Retrieve data and metadata by key
   *
   * @param key - Storage key (path)
   * @returns Object with body stream, or null if not found
   */
  get(key: string): Promise<StorageObjectBody | null>;

  /**
   * Retrieve metadata only (no body)
   *
   * @param key - Storage key (path)
   * @returns Object metadata, or null if not found
   */
  head(key: string): Promise<StorageObjectMeta | null>;

  /**
   * List object metadata by prefix
   *
   * @param options - List options containing an owner-scoped prefix
   * @returns Object metadata list
   */
  list(options: ListOptions): Promise<StorageObjectMeta[]>;

  /**
   * Delete data at the specified key
   *
   * @param key - Storage key (path)
   */
  delete(key: string): Promise<void>;
}
