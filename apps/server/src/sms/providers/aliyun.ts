// Alibaba Cloud owns OTP generation and verification for the phone auth flow.
// Implemented with fetch + Web Crypto (ACS3-HMAC-SHA256) so the provider runs on
// Cloudflare Workers — the official @alicloud/* SDK depends on Node's https.request
// and is not compatible with the Workers runtime.
import { CN_DIAL_PREFIX, CN_PHONE_NUMBER_REGEX } from "@repo/shared";
import type { SmsProvider } from "../types";

// https://api.aliyun.com/product/Dypnsapi
const ALIYUN_SMS_HOST = "dypnsapi.aliyuncs.com";
const ALIYUN_SMS_VERSION = "2017-05-25";
const ALIYUN_SMS_SIGN_NAME = "速通互联验证码";
const ALIYUN_SMS_TEMPLATE_CODE = "100001";
const ALIYUN_SMS_COUNTRY_CODE = CN_DIAL_PREFIX.slice(1);
const ALIYUN_SMS_CODE_LENGTH = 6;
const ALIYUN_SMS_CODE_TYPE = 1;
const ALIYUN_SMS_DUPLICATE_POLICY = 1;
const ALIYUN_SMS_INTERVAL = 60;
const ALIYUN_SMS_VALID_TIME = 300;
// Template copy renders `${min}` minutes; derive from ValidTime so the two never drift.
const ALIYUN_SMS_TEMPLATE_PARAM = JSON.stringify({
  code: "##code##",
  min: String(Math.round(ALIYUN_SMS_VALID_TIME / 60)),
});
const SIGNATURE_ALGORITHM = "ACS3-HMAC-SHA256";

type CreateAliyunSmsProviderOptions = {
  accessKeyId: string;
  accessKeySecret: string;
};

type AliyunQueryParams = Record<string, string | number | undefined>;

type AliyunResponseBody = {
  Code?: string;
  Message?: string;
  Success?: boolean;
  RequestId?: string;
  Model?: {
    VerifyResult?: string;
  };
};

export class AliyunSmsError extends Error {
  readonly code: string;
  readonly requestId: string | undefined;
  readonly httpStatus: number;
  constructor(params: {
    code: string;
    message: string;
    requestId: string | undefined;
    httpStatus: number;
  }) {
    super(
      `Aliyun SMS request failed (${params.code}, http ${params.httpStatus}, requestId=${
        params.requestId ?? "n/a"
      }): ${params.message}`,
    );
    this.name = "AliyunSmsError";
    this.code = params.code;
    this.requestId = params.requestId;
    this.httpStatus = params.httpStatus;
  }
}

// Check whether the current provider can handle the normalized phone number.
export function isAliyunSmsSupportedPhoneNumber(phoneNumber: string) {
  return CN_PHONE_NUMBER_REGEX.test(phoneNumber);
}

// Convert a `+86` E.164 number into the country code and local number expected by Aliyun.
function normalizeMainlandChinaPhoneNumber(phoneNumber: string) {
  if (!isAliyunSmsSupportedPhoneNumber(phoneNumber)) {
    throw new Error(`Aliyun SMS only supports mainland China phone numbers: ${phoneNumber}`);
  }

  return {
    countryCode: ALIYUN_SMS_COUNTRY_CODE,
    phoneNumber: phoneNumber.slice(CN_DIAL_PREFIX.length),
  };
}

// RFC 3986 percent-encoding used by Aliyun for both query keys and values.
export function percentEncode(value: string) {
  return encodeURIComponent(value)
    .replace(/!/g, "%21")
    .replace(/'/g, "%27")
    .replace(/\(/g, "%28")
    .replace(/\)/g, "%29")
    .replace(/\*/g, "%2A");
}

export function toCanonicalQueryString(params: AliyunQueryParams) {
  const encoded = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => [percentEncode(key), percentEncode(String(value))] as const)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

  return encoded.map(([key, value]) => `${key}=${value}`).join("&");
}

function toHex(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let hex = "";
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, "0");
  }
  return hex;
}

async function sha256Hex(input: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return toHex(digest);
}

async function hmacSha256Hex(secret: string, input: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(input));
  return toHex(signature);
}

// Build the `Authorization` header following Aliyun's v3 ACS3-HMAC-SHA256 scheme.
// Reference: https://help.aliyun.com/zh/sdk/product-overview/v3-request-structure-and-signature
async function buildAuthorization(
  canonicalQuery: string,
  signedHeaders: Record<string, string>,
  hashedPayload: string,
  options: CreateAliyunSmsProviderOptions,
) {
  const sortedKeys = Object.keys(signedHeaders).sort();
  const canonicalHeaders = sortedKeys
    .map((key) => `${key}:${signedHeaders[key].trim()}\n`)
    .join("");
  const signedHeaderList = sortedKeys.join(";");

  const canonicalRequest = [
    "POST",
    "/",
    canonicalQuery,
    canonicalHeaders,
    signedHeaderList,
    hashedPayload,
  ].join("\n");

  const stringToSign = `${SIGNATURE_ALGORITHM}\n${await sha256Hex(canonicalRequest)}`;
  const signature = await hmacSha256Hex(options.accessKeySecret, stringToSign);

  return `${SIGNATURE_ALGORITHM} Credential=${options.accessKeyId},SignedHeaders=${signedHeaderList},Signature=${signature}`;
}

// Issue a signed RPC-style call to the Dypnsapi endpoint. All parameters are carried in
// the query string; the body is empty, matching what the official SDK produces.
async function callAliyunDypnsapi(
  action: string,
  params: AliyunQueryParams,
  options: CreateAliyunSmsProviderOptions,
): Promise<AliyunResponseBody> {
  const canonicalQuery = toCanonicalQueryString(params);
  const hashedPayload = await sha256Hex("");

  const signedHeaders: Record<string, string> = {
    host: ALIYUN_SMS_HOST,
    "x-acs-action": action,
    "x-acs-content-sha256": hashedPayload,
    "x-acs-date": new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
    "x-acs-signature-nonce": crypto.randomUUID(),
    "x-acs-version": ALIYUN_SMS_VERSION,
  };

  const authorization = await buildAuthorization(
    canonicalQuery,
    signedHeaders,
    hashedPayload,
    options,
  );

  const url = `https://${ALIYUN_SMS_HOST}/${canonicalQuery ? `?${canonicalQuery}` : ""}`;
  // `host` is set automatically by the Workers fetch runtime from the URL; passing it
  // explicitly triggers a warning. Only the signing step needs it.
  const { host: _host, ...fetchHeaders } = signedHeaders;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      ...fetchHeaders,
      accept: "application/json",
      authorization,
    },
  });

  const body = (await response.json().catch(() => ({}))) as AliyunResponseBody;

  if (!response.ok || body?.Code !== "OK" || body?.Success === false) {
    throw new AliyunSmsError({
      code: body?.Code ?? "UNKNOWN",
      message: body?.Message ?? "Unknown error",
      requestId: body?.RequestId,
      httpStatus: response.status,
    });
  }

  return body;
}

// Create the Aliyun-backed SMS provider used by the auth flow.
export function createAliyunSmsProvider(options: CreateAliyunSmsProviderOptions): SmsProvider {
  if (!options.accessKeyId) {
    throw new Error("ALIBABA_CLOUD_ACCESS_KEY_ID is not configured");
  }

  if (!options.accessKeySecret) {
    throw new Error("ALIBABA_CLOUD_ACCESS_KEY_SECRET is not configured");
  }

  async function sendVerificationCode(phoneNumber: string) {
    const recipient = normalizeMainlandChinaPhoneNumber(phoneNumber);
    await callAliyunDypnsapi(
      "SendSmsVerifyCode",
      {
        CountryCode: recipient.countryCode,
        PhoneNumber: recipient.phoneNumber,
        SignName: ALIYUN_SMS_SIGN_NAME,
        TemplateCode: ALIYUN_SMS_TEMPLATE_CODE,
        TemplateParam: ALIYUN_SMS_TEMPLATE_PARAM,
        CodeLength: ALIYUN_SMS_CODE_LENGTH,
        CodeType: ALIYUN_SMS_CODE_TYPE,
        DuplicatePolicy: ALIYUN_SMS_DUPLICATE_POLICY,
        Interval: ALIYUN_SMS_INTERVAL,
        ValidTime: ALIYUN_SMS_VALID_TIME,
      },
      options,
    );
  }

  async function verifyCode(phoneNumber: string, code: string) {
    const recipient = normalizeMainlandChinaPhoneNumber(phoneNumber);
    try {
      const body = await callAliyunDypnsapi(
        "CheckSmsVerifyCode",
        {
          CountryCode: recipient.countryCode,
          PhoneNumber: recipient.phoneNumber,
          VerifyCode: code,
        },
        options,
      );
      return body.Model?.VerifyResult === "PASS";
    } catch (error) {
      if (error instanceof AliyunSmsError && error.code === "isv.ValidateFail") {
        return false;
      }
      throw error;
    }
  }

  return {
    sendVerificationCode,
    verifyCode,
  };
}
