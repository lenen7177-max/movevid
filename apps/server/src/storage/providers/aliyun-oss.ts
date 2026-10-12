import { XMLParser } from "fast-xml-parser";
import { getContentTypeFromKey } from "@repo/shared";
import type { StorageData, StorageObject, StorageObjectBody, StorageProvider } from "../types";

const ALGORITHM = "OSS4-HMAC-SHA256";
const HASHED_PAYLOAD = "UNSIGNED-PAYLOAD";
const PRODUCT = "oss";
const REQUEST_SUFFIX = "aliyun_v4_request";

export interface AliyunOssStorageProviderOptions {
  accessKeyId: string;
  accessKeySecret: string;
  bucket: string;
  region: string;
  endpoint: string;
}

export type AliyunOssStorageEnv = {
  ALIBABA_CLOUD_ACCESS_KEY_ID?: string;
  ALIBABA_CLOUD_ACCESS_KEY_SECRET?: string;
  ALIYUN_OSS_BUCKET?: string;
  ALIYUN_OSS_REGION?: string;
  ALIYUN_OSS_ENDPOINT?: string;
};

type RequestMethod = "DELETE" | "GET" | "HEAD" | "PUT";
type QueryParams = Record<string, number | string | undefined>;

type ParsedListObject = {
  ETag?: number | string;
  Key?: number | string;
  LastModified?: number | string;
  Size?: number | string;
};

type ParsedListObjectsResponse = {
  ListBucketResult?: {
    Contents?: ParsedListObject | ParsedListObject[];
    NextContinuationToken?: number | string;
  };
};

const xmlParser = new XMLParser({
  ignoreAttributes: true,
  parseTagValue: false,
  trimValues: true,
});

function assertConfigValue(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

export function resolveAliyunOssOptions(env: AliyunOssStorageEnv): AliyunOssStorageProviderOptions {
  return {
    accessKeyId: assertConfigValue(env.ALIBABA_CLOUD_ACCESS_KEY_ID, "ALIBABA_CLOUD_ACCESS_KEY_ID"),
    accessKeySecret: assertConfigValue(
      env.ALIBABA_CLOUD_ACCESS_KEY_SECRET,
      "ALIBABA_CLOUD_ACCESS_KEY_SECRET",
    ),
    bucket: assertConfigValue(env.ALIYUN_OSS_BUCKET, "ALIYUN_OSS_BUCKET"),
    region: assertConfigValue(env.ALIYUN_OSS_REGION, "ALIYUN_OSS_REGION"),
    endpoint: assertConfigValue(env.ALIYUN_OSS_ENDPOINT, "ALIYUN_OSS_ENDPOINT"),
  };
}

function encodePath(value: string): string {
  return value
    .split("/")
    .map((segment) =>
      encodeURIComponent(segment).replace(
        /[!'()*]/g,
        (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
      ),
    )
    .join("/");
}

function encodeQueryValue(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function buildCanonicalQueryString(query?: QueryParams): string {
  return Object.entries(query ?? {})
    .filter((entry): entry is [string, number | string] => entry[1] !== undefined)
    .map(([name, value]) => [encodeQueryValue(name), encodeQueryValue(String(value))] as const)
    .sort(([leftName, leftValue], [rightName, rightValue]) => {
      const nameCompare = leftName.localeCompare(rightName);
      return nameCompare === 0 ? leftValue.localeCompare(rightValue) : nameCompare;
    })
    .map(([name, value]) => `${name}=${value}`)
    .join("&");
}

function normalizeEndpoint(endpoint: string): { protocol: string; host: string } {
  const withProtocol = /^https?:\/\//.test(endpoint) ? endpoint : `https://${endpoint}`;
  const url = new URL(withProtocol);

  return {
    protocol: url.protocol,
    host: url.host,
  };
}

function formatOssDate(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

function utf8(value: string): ArrayBuffer {
  return toArrayBuffer(new TextEncoder().encode(value));
}

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(value: string): Promise<string> {
  return toHex(await crypto.subtle.digest("SHA-256", utf8(value)));
}

async function hmacSha256(key: string | ArrayBuffer, value: string): Promise<ArrayBuffer> {
  const keyData = typeof key === "string" ? utf8(key) : key;
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return crypto.subtle.sign("HMAC", cryptoKey, utf8(value));
}

async function getSignatureKey(secret: string, date: string, region: string): Promise<ArrayBuffer> {
  const dateKey = await hmacSha256(`aliyun_v4${secret}`, date);
  const regionKey = await hmacSha256(dateKey, region);
  const productKey = await hmacSha256(regionKey, PRODUCT);
  return hmacSha256(productKey, REQUEST_SUFFIX);
}

function canonicalHeaderValue(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

async function signRequest({
  accessKeyId,
  accessKeySecret,
  bucket,
  headers,
  key,
  method,
  query,
  region,
}: {
  accessKeyId: string;
  accessKeySecret: string;
  bucket: string;
  headers: Record<string, string>;
  key: string;
  method: RequestMethod;
  query?: QueryParams;
  region: string;
}): Promise<string> {
  const canonicalUri = `/${bucket}/${encodePath(key)}`;
  const canonicalQueryString = buildCanonicalQueryString(query);
  const lowercaseHeaders = Object.fromEntries(
    Object.entries(headers).map(([headerKey, value]) => [headerKey.toLowerCase(), value]),
  );
  const headersToSign = Object.keys(lowercaseHeaders)
    .filter(
      (headerKey) =>
        headerKey === "content-type" ||
        headerKey === "content-md5" ||
        headerKey.startsWith("x-oss-"),
    )
    .sort();
  const canonicalHeaders = headersToSign
    .map((headerKey) => `${headerKey}:${canonicalHeaderValue(lowercaseHeaders[headerKey])}\n`)
    .join("");
  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    "",
    lowercaseHeaders["x-oss-content-sha256"] || HASHED_PAYLOAD,
  ].join("\n");
  const timestamp = lowercaseHeaders["x-oss-date"];
  const date = timestamp.split("T")[0];
  const scope = `${date}/${region}/${PRODUCT}/${REQUEST_SUFFIX}`;
  const stringToSign = [ALGORITHM, timestamp, scope, await sha256Hex(canonicalRequest)].join("\n");
  const signingKey = await getSignatureKey(accessKeySecret, date, region);
  const signature = toHex(await hmacSha256(signingKey, stringToSign));

  return `${ALGORITHM} Credential=${accessKeyId}/${scope},Signature=${signature}`;
}

function getSize(data: StorageData): number | undefined {
  if (typeof data === "string") {
    return utf8(data).byteLength;
  }
  if (data instanceof Blob) {
    return data.size;
  }
  if (data instanceof ArrayBuffer) {
    return data.byteLength;
  }
  if (data instanceof Uint8Array) {
    return data.byteLength;
  }
  return undefined;
}

function getBody(data: StorageData): BodyInit {
  if (data instanceof Uint8Array) {
    return toArrayBuffer(data);
  }
  return data as BodyInit;
}

function parseCustomMetadata(headers: Headers): Record<string, string> | undefined {
  const metadata: Record<string, string> = {};
  headers.forEach((value, headerKey) => {
    if (headerKey.startsWith("x-oss-meta-")) {
      metadata[headerKey.slice("x-oss-meta-".length)] = value;
    }
  });
  return Object.keys(metadata).length > 0 ? metadata : undefined;
}

function toArray<T>(value: T | T[] | undefined): T[] {
  if (!value) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function decodeOssListValue(value: number | string | undefined): string {
  if (value === undefined) {
    return "";
  }

  const stringValue = String(value);
  try {
    return decodeURIComponent(stringValue);
  } catch {
    return stringValue;
  }
}

function mapListObjectsResponse(xml: string): {
  objects: StorageObject[];
  nextContinuationToken?: string;
} {
  const parsed = xmlParser.parse(xml) as ParsedListObjectsResponse;
  const result = parsed.ListBucketResult;
  const objects = toArray(result?.Contents).map((item) => {
    const key = decodeOssListValue(item.Key);
    const contentType = getContentTypeFromKey(key);
    const lastModified = item.LastModified ? String(item.LastModified) : undefined;

    return {
      key,
      size: Number(item.Size ?? 0),
      etag: item.ETag ? String(item.ETag) : "",
      httpMetadata: contentType ? { contentType } : undefined,
      uploaded: lastModified ? new Date(lastModified) : undefined,
    };
  });

  const nextContinuationToken = decodeOssListValue(result?.NextContinuationToken);

  return {
    objects,
    nextContinuationToken: nextContinuationToken || undefined,
  };
}

function mapHeadersToStorageObject(key: string, headers: Headers, fallbackSize = 0): StorageObject {
  const contentLength = headers.get("content-length");
  const lastModified = headers.get("last-modified");
  const contentType = headers.get("content-type") || undefined;

  return {
    key,
    size: contentLength ? Number(contentLength) : fallbackSize,
    etag: headers.get("etag") ?? "",
    httpMetadata: contentType ? { contentType } : undefined,
    customMetadata: parseCustomMetadata(headers),
    uploaded: lastModified ? new Date(lastModified) : undefined,
  };
}

async function readError(response: Response): Promise<string> {
  const text = await response.text().catch(() => "");
  return text || `${response.status} ${response.statusText}`;
}

/**
 * Aliyun OSS storage provider factory.
 *
 * Implements the project StorageProvider protocol with OSS REST API V4 signing.
 */
export function createAliyunOssStorageProvider(
  options: AliyunOssStorageProviderOptions,
): StorageProvider {
  const endpoint = normalizeEndpoint(options.endpoint);
  const baseUrl = `${endpoint.protocol}//${options.bucket}.${endpoint.host}`;

  async function request(
    method: RequestMethod,
    key: string,
    init: {
      body?: BodyInit;
      contentType?: string;
      customMetadata?: Record<string, string>;
      query?: QueryParams;
      successStatuses: number[];
    },
  ) {
    const headers: Record<string, string> = {
      "x-oss-content-sha256": HASHED_PAYLOAD,
      "x-oss-date": formatOssDate(new Date()),
    };

    if (init.contentType) {
      headers["content-type"] = init.contentType;
    }
    for (const [metadataKey, value] of Object.entries(init.customMetadata ?? {})) {
      headers[`x-oss-meta-${metadataKey}`] = value;
    }

    headers.authorization = await signRequest({
      accessKeyId: options.accessKeyId,
      accessKeySecret: options.accessKeySecret,
      bucket: options.bucket,
      headers,
      key,
      method,
      query: init.query,
      region: options.region,
    });

    const queryString = buildCanonicalQueryString(init.query);
    const url = `${baseUrl}/${encodePath(key)}${queryString ? `?${queryString}` : ""}`;

    const response = await fetch(url, {
      method,
      headers,
      body: init.body,
    });

    if (!init.successStatuses.includes(response.status)) {
      throw new Error(`Aliyun OSS ${method} ${key} failed: ${await readError(response)}`);
    }

    return response;
  }

  return {
    async put(key, data, putOptions) {
      const contentType =
        putOptions?.contentType || (data instanceof Blob ? data.type : undefined) || undefined;
      const response = await request("PUT", key, {
        body: getBody(data),
        contentType,
        customMetadata: putOptions?.customMetadata,
        successStatuses: [200],
      });

      return mapHeadersToStorageObject(key, response.headers, getSize(data) ?? 0);
    },

    async get(key) {
      const response = await request("GET", key, {
        successStatuses: [200, 404],
      });
      if (response.status === 404) {
        return null;
      }

      const object = mapHeadersToStorageObject(key, response.headers);
      const body = response.body ?? new Blob([]).stream();
      const storageBody: StorageObjectBody = {
        ...object,
        body,
        bodyUsed: response.bodyUsed,
        arrayBuffer: () => response.arrayBuffer(),
        text: () => response.text(),
      };

      return storageBody;
    },

    async head(key) {
      const response = await request("HEAD", key, {
        successStatuses: [200, 404],
      });
      if (response.status === 404) {
        return null;
      }

      return mapHeadersToStorageObject(key, response.headers);
    },

    async list({ prefix }) {
      const objects: StorageObject[] = [];
      let continuationToken: string | undefined;

      do {
        const response = await request("GET", "", {
          query: {
            "encoding-type": "url",
            "list-type": 2,
            "max-keys": 1000,
            prefix: prefix,
            "continuation-token": continuationToken,
          },
          successStatuses: [200],
        });
        const result = mapListObjectsResponse(await response.text());
        objects.push(...result.objects);
        continuationToken = result.nextContinuationToken;
      } while (continuationToken);

      return objects;
    },

    async delete(key) {
      await request("DELETE", key, {
        successStatuses: [200, 204],
      });
    },
  };
}
