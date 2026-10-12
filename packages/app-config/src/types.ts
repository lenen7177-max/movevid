import type { DeepPartial } from "@repo/shared";

/** Supported email providers available in app configuration. */
export const SUPPORTED_EMAIL_PROVIDERS = ["resend", "cloudflare"] as const;

/** Supported web payment providers available in app configuration. */
export const SUPPORTED_WEB_PAYMENT_PROVIDERS = ["stripe", "creem", "waffo"] as const;

/** Supported server-side payment providers available in app configuration. */
export const SUPPORTED_SERVER_PAYMENT_PROVIDERS = [...SUPPORTED_WEB_PAYMENT_PROVIDERS] as const;

/** Supported storage providers available in app configuration. */
export const SUPPORTED_STORAGE_PROVIDERS = ["r2", "aliyun-oss"] as const;

/** Supported SMS providers available in app configuration. */
export const SUPPORTED_SMS_PROVIDERS = ["aliyun"] as const;

/** Union type of all supported email provider keys. */
export type EmailProviderKey = (typeof SUPPORTED_EMAIL_PROVIDERS)[number];

/** Union type of all supported server payment provider keys. */
export type ServerPaymentProviderKey = (typeof SUPPORTED_SERVER_PAYMENT_PROVIDERS)[number];

/** Union type of all supported web payment provider keys. */
export type WebPaymentProviderKey = (typeof SUPPORTED_WEB_PAYMENT_PROVIDERS)[number];

/** Union type of all supported storage provider keys. */
export type StorageProviderKey = (typeof SUPPORTED_STORAGE_PROVIDERS)[number];

/** Union type of all supported SMS provider keys. */
export type SmsProviderKey = (typeof SUPPORTED_SMS_PROVIDERS)[number];

/** Lifecycle status for plans and prices. */
export type PlanStatus = "active" | "archived";

/** Billing model of a price. */
export type PriceType = "subscription" | "lifetime";

/** Billing interval for subscription prices. */
export type BillingInterval = "month" | "year";

/** Rank of membership entitlement in ascending benefit order. */
export type MembershipTier = "free" | "monthly" | "yearly" | "lifetime";

export const APP_ROLES = ["user", "admin"] as const;

/** Platform-wide authority role. Distinct from MembershipTier (billing entitlement). */
export type AppRole = (typeof APP_ROLES)[number];

/** Static role-based access control settings shared by server and clients. */
export type RbacConfig = {
  /** Role assigned to newly created accounts. */
  defaultRole: AppRole;
  /** Roles treated as administrative by Better Auth's admin plugin. */
  adminRoles: readonly AppRole[];
};

/** Stable membership presentation variants used by payment UIs. */
export type MembershipPresentationKind = "monthly" | "yearly" | "lifetime";

/** Payment provider price environment used by web/server billing. */
export type ProviderPriceEnvironment = "test" | "prod";

/** Credit package purchase lifecycle status. */
export type CreditPackageStatus = "active" | "archived";

/** Provider-specific web price settings for one payment environment. */
export type WebProviderPriceEnvironmentConfig = {
  /** Provider-specific price ID for this environment. */
  providerPriceId: string;
};

/**
 * Shared shape for a plan price entry.
 *
 * @typeParam TProviderKey - Provider key type used by the price.
 */
type BasePriceConfig<TProviderKey> = {
  /** Internal unique price ID in app config. */
  id: string;
  /** Provider key that owns this price. */
  provider: TProviderKey;
  /** Provider-specific price ID (for example Stripe price ID). */
  providerPriceId: string;
  /** ISO currency code used by this price. */
  currency: string;
  /** Price amount in minor units (for example cents). */
  amountCents: number;
  /** Price billing model. */
  priceType: PriceType;
  /** Optional billing interval for subscription prices. */
  interval?: BillingInterval | null;
  /** Optional lifecycle status of this price. */
  status?: PlanStatus;
};

/**
 * Shared shape for a plan entry.
 *
 * @typeParam TPriceConfig - Price item type used by the plan.
 */
type BasePlanConfig<TPriceConfig> = {
  /** Internal unique plan ID in app config. */
  id: string;
  /** Optional lifecycle status of this plan. */
  status?: PlanStatus;
  /** Optional list of prices attached to this plan. */
  prices?: TPriceConfig[];
};

/** Canonical membership price semantics shared across web and server. */
export type MembershipPriceConfig = {
  /** Globally unique membership price ID. */
  id: string;
  /** Membership tier granted by this price. */
  tier: Exclude<MembershipTier, "free">;
  /** Billing model used by this price. */
  priceType: PriceType;
  /** Billing interval for subscription prices. */
  interval?: BillingInterval | null;
  /** Optional lifecycle status of this membership price. */
  status?: PlanStatus;
  /** Stable presentation variant used by UI adapters. */
  presentationKind?: MembershipPresentationKind;
};

/** Canonical membership plan semantics. */
export type MembershipPlanConfig = {
  /** Internal unique membership plan ID. */
  id: string;
  /** Optional lifecycle status of this membership plan. */
  status?: PlanStatus;
  /** Canonical membership prices attached to this plan. */
  prices: MembershipPriceConfig[];
};

/** Canonical membership catalog shared by all platforms. */
export type MembershipCatalogConfig = {
  /** Purchasable membership plans. Free Membership is the default tier, not a purchasable plan. */
  plans: MembershipPlanConfig[];
};

/** Price configuration used by web/server payments. */
export type WebPriceConfig = Omit<BasePriceConfig<WebPaymentProviderKey>, "providerPriceId"> & {
  /** Test/sandbox provider price config used outside production. */
  test: WebProviderPriceEnvironmentConfig;
  /** Production provider price config used when NODE_ENV is production. */
  prod: WebProviderPriceEnvironmentConfig;
  /** Optional free-trial duration in days for subscription prices. */
  trialDays?: number;
};

/** Plan configuration used by web/server payments. */
export type WebPlanConfig = BasePlanConfig<WebPriceConfig>;

/** Automatic checks that withhold a signup grant from repeated identities. */
export type CreditSignupAntiAbuseConfig = {
  /** Toggle for email canonicalization and IP/device grant limits. */
  enabled?: boolean;
  /** Collapse email aliases before comparing signup identities. */
  canonicalizeEmail?: boolean;
  /** Maximum signup grants for one IP inside the window. */
  ip?: {
    /** Grants allowed for one IP during the window. */
    maxGrants?: number;
    /** Length of the IP window in hours. */
    windowHours?: number;
  };
  /** Maximum signup grants for one device. */
  device?: {
    /** Grants allowed for one device, with no time window. */
    maxGrants?: number;
  };
};

/** Grant rule for free credits. */
export type CreditGrantConfig = {
  /** Toggle that enables this grant rule. */
  enabled?: boolean;
  /** Number of credits to grant. */
  amount: number;
  /** Optional expiration in days. Null or omitted means no expiration. */
  expiresInDays?: number | null;
  /** Optional repeated-signup checks for this grant. */
  antiAbuse?: CreditSignupAntiAbuseConfig;
};

/** Web provider price settings for a credit package in one environment. */
export type CreditWebProviderPriceEnvironmentConfig = {
  /** Provider-specific price ID for this environment. */
  providerPriceId: string;
};

/** Web purchase configuration for one credit package. */
export type CreditWebPackageConfig = {
  /** Provider that owns this credit package price. */
  provider: WebPaymentProviderKey;
  /** Test/sandbox provider price config used outside production. */
  test: CreditWebProviderPriceEnvironmentConfig;
  /** Production provider price config used when NODE_ENV is production. */
  prod: CreditWebProviderPriceEnvironmentConfig;
  /** ISO currency code used by this package. */
  currency: string;
  /** Package amount in minor units. */
  amountCents: number;
  /** Optional lifecycle status of this platform package. */
  status?: CreditPackageStatus;
};

/** Credit package available for purchase. */
export type CreditPackageConfig = {
  /** Internal unique package ID. */
  id: string;
  /** Number of credits granted after successful purchase. */
  amount: number;
  /** Optional lifecycle status of this package. */
  status?: CreditPackageStatus;
  /** Optional web checkout configuration. */
  web?: CreditWebPackageConfig;
};

/** Credit system configuration. */
export type AppCreditsConfig = {
  /** Toggle that enables credit system paths. */
  enabled?: boolean;
  /** Purchasable credit packages. */
  packages: CreditPackageConfig[];
  /** One-time signup grant. */
  signupGrant?: CreditGrantConfig;
};

/** Supported upload purposes used by the storage module. */
export type StorageUploadPurpose = "avatar" | "attachment";

/** Common app configuration shared by all platforms. */
export type AppCommonConfig = {
  /** Administrative capabilities shared by Web and Server. */
  admin: {
    /** Paid-member management surfaces and APIs. */
    paidUsers: {
      /** Toggle that enables paid-user management capabilities. */
      enabled: boolean;
    };
    /** Registered-user management surfaces and APIs. */
    userManagement: {
      /** Toggle that enables user management routes, navigation, and APIs. */
      enabled: boolean;
    };
  };
  /** Generic app metadata. */
  app: {
    /** Human-readable app name. */
    name: string;
    /** Support email address. */
    supportEmail: string;
    /** Official website URL. */
    websiteUrl: string;
    /** Social media URL (e.g. X/Twitter profile). */
    socialUrl: string;
  };
  /** Authentication provider configuration shared by auth UIs. */
  auth: {
    /** Cookie namespace used by Better Auth. */
    cookiePrefix: string;
    /** Login method UI switches. */
    methods: {
      /** Toggle that controls email/password auth UI entry points. */
      emailPasswordEnabled?: boolean;
      /** Toggle that controls email OTP auth UI entry points. */
      emailOtpEnabled?: boolean;
      /** Toggle that controls SMS auth UI entry points. */
      smsEnabled?: boolean;
      /** Toggle that controls GitHub sign-in UI entry points. */
      githubEnabled?: boolean;
      /** Toggle that controls Google sign-in UI entry points. */
      googleEnabled?: boolean;
      /** Toggle that controls Apple sign-in UI entry points. */
      appleEnabled?: boolean;
    };
    /** One-time code settings shared by auth flows. */
    otp: {
      /** Email one-time sign-in code settings. */
      email: {
        /** One-time code length. */
        otpLength: number;
        /** One-time code expiry in seconds. */
        expiresInSeconds: number;
        /** Maximum failed verification attempts per issued code. */
        allowedAttempts: number;
        /** Client-side resend cooldown in seconds. */
        resendCooldownSeconds: number;
      };
      /** SMS one-time verification code settings. */
      sms: {
        /** One-time code length. */
        otpLength: number;
        /** One-time code expiry in seconds. */
        expiresInSeconds: number;
        /** Client-side resend cooldown in seconds. */
        resendCooldownSeconds: number;
      };
    };
    /** Global role defaults used by Better Auth's admin plugin. */
    rbac: RbacConfig;
    /** Signup abuse checks that are independent of the credit ledger. */
    abuse: {
      /** Reject signups from a short built-in list of disposable email domains. */
      blockDisposableEmailDomains: boolean;
    };
  };
  /** Outbound email configuration. */
  email: {
    /** Email provider key. */
    provider: EmailProviderKey;
    /** Sender address parts used to compose the from email. */
    from: {
      /** Local part of sender address (before @). */
      localPart: string;
      /** Domain part of sender address (after @). */
      domain: string;
    };
  };
  /** File storage configuration. */
  storage: {
    /** Toggle that controls storage-backed UI entry points. */
    enabled?: boolean;
    /** Storage provider key. */
    provider: StorageProviderKey;
    /** Public base path used for serving uploaded files. */
    publicPath: string;
    /** Key prefixes mapped by upload purpose. */
    keyPrefixes: Record<StorageUploadPurpose, string>;
    /** Fallback key prefix used when no purpose-specific prefix is available. */
    fallbackPrefix: string;
    /** Allowed MIME types mapped by upload purpose. */
    allowedTypes: Record<StorageUploadPurpose, readonly string[]>;
    /** Maximum file sizes in bytes mapped by upload purpose. */
    maxFileSizes: Record<StorageUploadPurpose, number>;
  };
  /** Product-level membership catalog shared by all platforms. */
  membership: MembershipCatalogConfig;
  /** SMS configuration shared by auth flows. */
  sms: {
    /** SMS provider key. */
    provider: SmsProviderKey;
  };
};

/**
 * Optional platform-specific overrides for common app configuration.
 *
 * Uses DeepPartial so each platform can override only required fields.
 */
export type AppPlatformCommonConfig = {
  /** Optional app metadata overrides. */
  app?: DeepPartial<AppCommonConfig["app"]>;
  /** Optional auth provider overrides. */
  auth?: DeepPartial<AppCommonConfig["auth"]>;
  /** Optional email configuration overrides. */
  email?: DeepPartial<AppCommonConfig["email"]>;
  /** Optional storage configuration overrides. */
  storage?: DeepPartial<AppCommonConfig["storage"]>;
  /** Optional SMS configuration overrides. */
  sms?: DeepPartial<AppCommonConfig["sms"]>;
};

/** Web-specific app configuration. */
export type AppWebConfig = AppPlatformCommonConfig & {
  /** Progressive web app settings. */
  pwa?: {
    /** Toggle that enables PWA metadata, installation prompts, and service worker updates. */
    enabled?: boolean;
    /** Exact page paths where PWA is enabled. Omit to enable it on every page. */
    paths?: readonly string[];
  };
  /** Web credit system configuration. */
  credits: AppCreditsConfig;
  /** Web route configuration used by auth and billing flows. */
  routes: {
    /** Sign-in page route path. */
    authSignIn: string;
    /** Reset-password page route path. */
    authResetPassword: string;
  };
  /** Optional web payment configuration. */
  payments?: AppWebPaymentsConfig;
};

/** Payment configuration used by web/server billing flows. */
export type AppWebPaymentsConfig = {
  enabled?: boolean;
  /** Default web payment provider key used by web billing. */
  provider: WebPaymentProviderKey;
  /** Plan catalog available to web billing. */
  plans: WebPlanConfig[];
};

/** Root app configuration object combining common and web settings. */
export type AppConfig = {
  /** Common configuration shared by all platforms. */
  common: AppCommonConfig;
  /** Web platform configuration. */
  web: AppWebConfig;
};

export type ResolvedWebCommonConfig = AppCommonConfig & {
  pwa?: AppWebConfig["pwa"];
  credits: AppWebConfig["credits"];
  routes: AppWebConfig["routes"];
  payments?: AppWebConfig["payments"];
};
