import { env } from "cloudflare:workers";
import { resolveCommonConfig } from "@repo/app-config";
import type { SmsProviderKey } from "@repo/app-config";
import { createAliyunSmsProvider, isAliyunSmsSupportedPhoneNumber } from "./providers/aliyun";
import type { SmsProvider } from "./types";

const smsConfig = resolveCommonConfig().sms;
const providerCache = new Map<SmsProviderKey, SmsProvider>();

// Lazy-construct the provider on first use so module load does not fail when env is absent
// (e.g. during non-auth requests or tooling that instantiates the module eagerly).
function createProvider(providerKey: SmsProviderKey): SmsProvider {
  switch (providerKey) {
    case "aliyun":
      return createAliyunSmsProvider({
        accessKeyId: env.ALIBABA_CLOUD_ACCESS_KEY_ID,
        accessKeySecret: env.ALIBABA_CLOUD_ACCESS_KEY_SECRET,
      });
  }
}

export function getSmsProvider(providerKey: SmsProviderKey = smsConfig.provider): SmsProvider {
  const cached = providerCache.get(providerKey);
  if (cached) return cached;
  const provider = createProvider(providerKey);
  providerCache.set(providerKey, provider);
  return provider;
}

// Route OTP verification through the same provider service that handled the send step.
export function verifySmsCode(
  phoneNumber: string,
  code: string,
  providerKey: SmsProviderKey = smsConfig.provider,
) {
  const verifyCode = getSmsProvider(providerKey).verifyCode;
  if (!verifyCode) {
    throw new Error(`SMS provider does not support code verification: ${providerKey}`);
  }

  return verifyCode(phoneNumber, code);
}

// Check whether the current SMS provider accepts the target phone number.
export function isSupportedSmsPhoneNumber(
  phoneNumber: string,
  providerKey: SmsProviderKey = smsConfig.provider,
) {
  switch (providerKey) {
    case "aliyun":
      return isAliyunSmsSupportedPhoneNumber(phoneNumber);
  }
}
