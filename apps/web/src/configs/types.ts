import type { AppCommonConfig, AppWebConfig } from "@repo/app-config";

export interface WebConfig {
  AppName: string;
  AppUrl: string;
  SupportEmail: string;
  adminUserManagementEnabled: boolean;
  adminPaidUsersEnabled: boolean;
  pwa: Required<Pick<NonNullable<AppWebConfig["pwa"]>, "enabled">> &
    Pick<NonNullable<AppWebConfig["pwa"]>, "paths">;
  creditsEnabled: boolean;
  storageEnabled: boolean;
  auth: {
    methods: {
      emailPasswordEnabled: boolean;
      emailOtpEnabled: boolean;
      smsEnabled: boolean;
      githubEnabled: boolean;
      googleEnabled: boolean;
      appleEnabled: boolean;
    };
    otp: {
      email: AppCommonConfig["auth"]["otp"]["email"];
      sms: AppCommonConfig["auth"]["otp"]["sms"];
    };
  };
}

export type AuthUrls = {
  callbackURL: string;
  errorCallbackURL: string;
  resetPasswordCallbackURL: string;
};
