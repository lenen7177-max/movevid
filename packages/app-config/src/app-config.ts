import { deepMerge } from "@repo/shared/platform";
// Written by `pnpm site:sync` from site.config.jsonc at the repo root; edit that file instead.
import site from "./site.generated.json";
import type {
  AppCommonConfig,
  AppConfig,
  AppCreditsConfig,
  AppPlatformCommonConfig,
  ResolvedWebCommonConfig,
} from "./types";

const creditSignupGrant = {
  // Off by default: every render costs real provider money. Turn it on to let new
  // accounts try one short render for free.
  enabled: false,
  // Number of credits granted on signup (validated even while disabled, so it must stay > 0).
  amount: 10,
  // Days before the signup grant expires.
  expiresInDays: 30,
  // Withhold the grant for repeated emails, devices, and IPs. Registration still succeeds.
  antiAbuse: {
    enabled: true,
    canonicalizeEmail: true,
    ip: {
      maxGrants: 2,
      windowHours: 24,
    },
    device: {
      maxGrants: 1,
    },
  },
} satisfies NonNullable<AppCreditsConfig["signupGrant"]>;

/**
 * Credit packages sold through the web checkout provider.
 *
 * Replace every `providerPriceId` with the price IDs from your own Stripe account
 * (test mode for `test`, live mode for `prod`). `amountCents` is only used for display
 * and must match the Stripe price. Size packs against your render costs; see
 * packages/app-config/src/video.ts for per-template credit prices.
 */
const webCreditPackages = [
  {
    id: "starter",
    // Number of credits delivered after purchase.
    amount: 30,
    web: {
      provider: "stripe",
      test: {
        providerPriceId: "price_STARTER_TEST_PLACEHOLDER",
      },
      prod: {
        providerPriceId: "price_STARTER_LIVE_PLACEHOLDER",
      },
      currency: "usd",
      // Price amount in minor units, such as cents.
      amountCents: 999,
      status: "active",
    },
  },
  {
    id: "creator",
    amount: 100,
    web: {
      provider: "stripe",
      test: {
        providerPriceId: "price_CREATOR_TEST_PLACEHOLDER",
      },
      prod: {
        providerPriceId: "price_CREATOR_LIVE_PLACEHOLDER",
      },
      currency: "usd",
      amountCents: 2999,
      status: "active",
    },
  },
  {
    id: "studio",
    amount: 250,
    web: {
      provider: "stripe",
      test: {
        providerPriceId: "price_STUDIO_TEST_PLACEHOLDER",
      },
      prod: {
        providerPriceId: "price_STUDIO_LIVE_PLACEHOLDER",
      },
      currency: "usd",
      amountCents: 6999,
      status: "active",
    },
  },
] satisfies AppCreditsConfig["packages"];

const membershipPlans = [
  {
    id: "pro",
    prices: [
      {
        id: "monthly",
        tier: "monthly",
        priceType: "subscription",
        interval: "month",
        presentationKind: "monthly",
        status: "active",
      },
      {
        id: "yearly",
        tier: "yearly",
        priceType: "subscription",
        interval: "year",
        presentationKind: "yearly",
        status: "active",
      },
    ],
  },
  {
    id: "lifetime",
    prices: [
      {
        id: "lifetime",
        tier: "lifetime",
        priceType: "lifetime",
        interval: null,
        presentationKind: "lifetime",
        status: "active",
      },
    ],
  },
] satisfies AppCommonConfig["membership"]["plans"];

const appConfig: AppConfig = {
  // Shared defaults inherited by web unless it overrides them.
  common: {
    // Administrative capabilities shared by all runtimes.
    admin: {
      // Controls paid-member management capabilities.
      paidUsers: {
        enabled: true,
      },
      // Controls registered-user management navigation, routes, and APIs.
      userManagement: {
        enabled: true,
      },
    },
    // Public app metadata used in UI, links, and platform setup.
    app: {
      // Product display name. Also used in emails, page titles and the OG image.
      name: site.name,
      // Public support contact.
      supportEmail: site.supportEmail,
      // Official marketing or product website.
      websiteUrl: `https://${site.domain}`,
      // Public social profile URL.
      socialUrl: "https://x.com/your_handle",
    },
    // Authentication provider settings shared by platform UIs.
    auth: {
      // Must match the Better Auth server cookie prefix.
      cookiePrefix: "better-auth-v2",
      // Login method UI entry points.
      methods: {
        // Controls email/password auth UI entry points.
        emailPasswordEnabled: false,
        // Controls email OTP auth UI entry points.
        emailOtpEnabled: true,
        // Controls SMS auth UI entry points.
        smsEnabled: false,
        // Controls GitHub sign-in UI entry points.
        githubEnabled: false,
        // Controls Google sign-in UI entry points. Turn on after setting GOOGLE_CLIENT_ID
        // (wrangler.jsonc) and GOOGLE_CLIENT_SECRET (secret).
        googleEnabled: false,
        // Controls Apple sign-in UI entry points.
        appleEnabled: false,
      },
      // One-time code settings shared by auth flows.
      otp: {
        // Email one-time sign-in code settings.
        email: {
          // Number of digits in one-time sign-in codes.
          otpLength: 6,
          // Verification code lifetime in seconds.
          expiresInSeconds: 300,
          // Maximum failed verification attempts per issued code.
          allowedAttempts: 3,
          // Client-side resend cooldown in seconds.
          resendCooldownSeconds: 60,
        },
        // SMS one-time verification code settings.
        sms: {
          // Number of digits in one-time verification codes.
          otpLength: 6,
          // Verification code lifetime in seconds.
          expiresInSeconds: 300,
          // Client-side resend cooldown in seconds.
          resendCooldownSeconds: 60,
        },
      },
      // Global role defaults used by Better Auth's admin plugin.
      rbac: {
        // Role assigned to newly created real accounts.
        defaultRole: "user",
        // Roles treated as administrative by the admin plugin.
        adminRoles: ["admin"],
      },
      // Signup checks that do not depend on the credit ledger.
      abuse: {
        // Short built-in disposable domains.
        blockDisposableEmailDomains: true,
      },
    },
    // Outbound email provider settings.
    email: {
      // Provider used to send transactional email.
      provider: "cloudflare",
      // Sender address parts combined into localPart@domain.
      from: {
        localPart: "noreply",
        domain: site.domain,
      },
    },
    // File upload and public asset storage settings.
    storage: {
      // Controls storage-backed UI entry points.
      enabled: true,
      // Provider used for file storage.
      provider: "r2",
      // Public API path used to serve stored files.
      publicPath: "/api/storage",
      // Storage key prefixes by upload purpose.
      keyPrefixes: {
        avatar: "avatars",
        attachment: "attachments",
      },
      // Prefix used when a purpose-specific prefix is unavailable.
      fallbackPrefix: "files",
      // Allowed upload MIME types by purpose.
      allowedTypes: {
        avatar: ["image/jpeg", "image/png", "image/gif", "image/webp"],
        attachment: [
          "image/jpeg",
          "image/png",
          "image/gif",
          "image/webp",
          "application/pdf",
          "text/plain",
        ],
      },
      // Maximum upload size in bytes by purpose.
      maxFileSizes: {
        avatar: 5 * 1024 * 1024,
        attachment: 25 * 1024 * 1024,
      },
    },
    // Canonical product-level membership semantics shared by web and server.
    membership: {
      plans: membershipPlans,
    },
    // SMS verification settings.
    sms: {
      // Provider used to send SMS messages.
      provider: "aliyun",
    },
  },
  // Web-only configuration.
  web: {
    // Progressive web app behavior.
    pwa: {
      // Controls PWA metadata, installation prompts, and service worker updates.
      enabled: true,
    },
    // Web credit system settings and purchasable web packages.
    credits: {
      // Controls whether web credit routes and sidebar entries are visible.
      enabled: true,
      // Optional free credit grant for new web users.
      signupGrant: creditSignupGrant,
      // Credit packages available through web checkout.
      packages: webCreditPackages,
    },
    // Route paths used by web auth flows.
    routes: {
      // Sign-in page path.
      authSignIn: "/auth/sign-in",
      // Password reset page path.
      authResetPassword: "/auth/reset-password",
    },
    // Web payment settings. Credit packs are the product; the plan list only holds the free
    // plan. Add subscription plans here (and to membershipPlans) to sell memberships.
    payments: {
      // Enables web billing runtime paths.
      enabled: true,
      // Default payment provider for web billing.
      provider: "stripe",
      // Web provider price IDs are split by environment to avoid using test IDs in production.
      plans: [
        {
          // Free plan available without provider prices.
          id: "free",
        },
      ],
    },
  },
};

function resolvePlatformCommonConfig(platformConfig: AppPlatformCommonConfig) {
  const commonOverrides: AppPlatformCommonConfig = {
    app: platformConfig.app,
    auth: platformConfig.auth,
    email: platformConfig.email,
    storage: platformConfig.storage,
    sms: platformConfig.sms,
  };

  if (Object.keys(commonOverrides).length === 0) {
    return appConfig.common;
  }

  return deepMerge<AppCommonConfig>(appConfig.common, commonOverrides);
}

export function resolveCommonConfig(): AppCommonConfig {
  return resolvePlatformCommonConfig(appConfig.common);
}

export function resolveWebCommonConfig(): ResolvedWebCommonConfig {
  const commonConfig = resolvePlatformCommonConfig(appConfig.web);
  return {
    ...commonConfig,
    pwa: appConfig.web.pwa,
    credits: appConfig.web.credits,
    routes: appConfig.web.routes,
    payments: appConfig.web.payments,
  };
}
