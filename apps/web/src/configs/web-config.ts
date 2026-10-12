import { resolveWebCommonConfig } from "@repo/app-config";
import { trimTrailingSlash } from "@repo/shared";
import { getCurrentLocale } from "@/i18n";
import { defaultLocale } from "@/i18n/config";
import type { WebConfig, AuthUrls } from "./types";

const commonConfig = resolveWebCommonConfig();
const webRoutes = commonConfig.routes;

function resolveAppUrl(): string {
  const configuredAppUrl = import.meta.env.VITE_APP_URL;
  if (configuredAppUrl) {
    return configuredAppUrl;
  }

  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  return "http://localhost:3000";
}

function getLocalePrefix(locale: string): string {
  return locale === defaultLocale ? "" : `/${locale}`;
}

function getLocalizedBaseUrl(): string {
  const locale = getCurrentLocale();
  const appUrl = resolveAppUrl();
  return `${trimTrailingSlash(appUrl)}${getLocalePrefix(locale)}`;
}

export const webConfig: WebConfig = {
  AppName: commonConfig.app.name,
  AppUrl: resolveAppUrl(),
  SupportEmail: commonConfig.app.supportEmail,
  adminUserManagementEnabled: commonConfig.admin.userManagement.enabled,
  adminPaidUsersEnabled: commonConfig.admin.paidUsers.enabled,
  pwa: {
    enabled: commonConfig.pwa?.enabled ?? false,
    paths: commonConfig.pwa?.paths,
  },
  creditsEnabled: commonConfig.credits.enabled ?? false,
  storageEnabled: commonConfig.storage.enabled ?? false,
  auth: {
    methods: {
      emailPasswordEnabled: commonConfig.auth.methods.emailPasswordEnabled ?? false,
      emailOtpEnabled: commonConfig.auth.methods.emailOtpEnabled ?? false,
      smsEnabled: commonConfig.auth.methods.smsEnabled ?? false,
      githubEnabled: commonConfig.auth.methods.githubEnabled ?? false,
      googleEnabled: commonConfig.auth.methods.googleEnabled ?? false,
      appleEnabled: commonConfig.auth.methods.appleEnabled ?? false,
    },
    otp: {
      email: commonConfig.auth.otp.email,
      sms: commonConfig.auth.otp.sms,
    },
  },
};

/**
 * Get auth callback URLs with locale prefix
 * URLs are generated dynamically to match current user's locale
 */
export function getAuthUrls(): AuthUrls {
  const localizedBaseUrl = getLocalizedBaseUrl();

  return {
    callbackURL: `${localizedBaseUrl}${webRoutes.authSignIn}`,
    errorCallbackURL: `${localizedBaseUrl}${webRoutes.authSignIn}`,
    resetPasswordCallbackURL: `${localizedBaseUrl}${webRoutes.authResetPassword}`,
  };
}
