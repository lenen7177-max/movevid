export {
  getRegistrableLikeDomain,
  isLocalOrIpHost,
  parseHostname,
  resolveCrossSubdomainCookieDomain,
} from "./domain";

export { toNullable } from "./nullable";

export {
  type CreditTransactionLabelKey,
  type CreditTransactionSourceKey,
  resolveCreditTransactionLabel,
  resolveCreditTransactionSource,
} from "./credits";
export { formatDate, formatDateWithOptions } from "./date";
export { formatCurrency, formatFileSize } from "./format";
export { getContentTypeFromKey } from "./storage";

export {
  CLIENT_DEVICE_ID_HEADER,
  CLIENT_DEVICE_STORAGE_KEY,
  CLIENT_PLATFORM_HEADER,
  CLIENT_PLATFORMS,
  type ClientPlatform,
  createDeviceId,
  normalizeClientPlatform,
  normalizeDeviceId,
} from "./client-device";
export { toError } from "./error";
export {
  buildDefaultEmailUserName,
  canonicalizeEmailAddress,
  emailDomainCandidates,
} from "./email";
export { hashNamespacedValue, toHex } from "./hash";
export { getClientIp, normalizeHeaderValue } from "./ip";
export { computeOtpRemainingSeconds } from "./otp";
export {
  CN_DIAL_PREFIX,
  CN_LOCAL_PHONE_DIGITS,
  CN_PHONE_NUMBER_REGEX,
  getVisibleUserContact,
  getVisibleUserEmail,
  getVisibleUserName,
  isPhoneCompatibilityEmail,
  isPhoneUser,
  normalizePhoneDigits,
  PHONE_COMPATIBILITY_EMAIL_DIGEST_LENGTH,
  PHONE_COMPATIBILITY_EMAIL_DOMAIN,
  PHONE_COMPATIBILITY_EMAIL_PREFIX,
  toCnE164PhoneNumber,
} from "./phone";

export { getFirstSearchParam, getSearchParamArray } from "./search-param";

export {
  type DeepPartial,
  deepMerge,
  type Platform,
  type PlatformScoped,
  resolvePlatformScoped,
} from "./platform";

export {
  type NormalizedPricingConfigPlan,
  type NormalizedPricingConfigPrice,
  normalizePlanPricingConfig,
  type PricingConfigPlan,
  type PricingConfigPrice,
} from "./pricing-config";

export { isAbsoluteUrl, joinUrl, normalizePath, toAbsoluteUrl, trimTrailingSlash } from "./url";
