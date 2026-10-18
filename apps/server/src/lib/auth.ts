import { env } from "cloudflare:workers";
import { resolveCommonConfig } from "@repo/app-config";
import { rbacConfig } from "@repo/app-config/rbac";
import { joinUrl, parseHostname, resolveCrossSubdomainCookieDomain } from "@repo/shared";
import { buildGuestEmail, mergeGuestAccount } from "@/lib/guest-account";
import { buildPhoneCompatibilityEmail } from "@/lib/phone-email";
import { type BetterAuthOptions, betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { admin } from "better-auth/plugins/admin";
import { anonymous } from "better-auth/plugins/anonymous";
import { bearer } from "better-auth/plugins/bearer";
import { captcha } from "better-auth/plugins";
import { emailOTP } from "better-auth/plugins/email-otp";
import { phoneNumber } from "better-auth/plugins/phone-number";
import { localization } from "better-auth-localization";
import { eq } from "drizzle-orm";
import { createDb } from "@/db";
import { abuseBlockErrorKey, findRequestAbuseBlock } from "@/abuse/policy";
import { createT, getLocaleFromHeaders, getLocaleFromRequest } from "@/i18n";
import { getAppleProviderConfig } from "@/lib/apple-auth";
import { createOriginPolicy } from "@/lib/origin-policy";
import { hashPassword, verifyPassword } from "@/lib/password";
import { betterAuthAccessControl, betterAuthRoles } from "@/lib/rbac";
import { getSmsProvider, isSupportedSmsPhoneNumber, verifySmsCode } from "@/sms";
import * as schema from "../db/schema/auth";
import {
  sendResetPasswordEmailFromRequest,
  sendSignInOtpEmailFromRequest,
  sendVerificationEmailFromRequest,
} from "../emails";
import type { Locale } from "@repo/i18n";

const commonConfig = resolveCommonConfig();
const emailOtpConfig = commonConfig.auth.otp.email;
const smsOtpConfig = commonConfig.auth.otp.sms;

/** Auth routes that send an email. Each call needs a Turnstile token and is rate limited. */
export const EMAIL_SENDING_AUTH_PATHS = [
  "/email-otp/send-verification-otp",
  "/sign-up/email",
  "/sign-in/email",
  "/send-verification-email",
  "/request-password-reset",
];

/**
 * Map our locale to better-auth-localization locale
 * See: https://github.com/marcellosso/better-auth-localization/tree/main/src/translations
 */
const betterAuthLocaleMap = {
  en: "default",
  zh: "zh-Hans",
  jp: "ja-JP",
} as const satisfies Record<Locale, string>;

const authCache = new WeakMap<D1Database, ReturnType<typeof betterAuth>>();

type CreateAuthOptions = {
  // Better Auth uses this hook to offload non-critical work such as SMS delivery.
  // On Cloudflare Workers we pass `executionCtx.waitUntil` so OTP sends do not block the response.
  backgroundTaskHandler?: ((promise: Promise<unknown>) => void) | undefined;
};

const PHONE_USER_NAME_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

function buildRandomPhoneUserName(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  const suffix = Array.from(
    bytes,
    (byte) => PHONE_USER_NAME_ALPHABET[byte % PHONE_USER_NAME_ALPHABET.length],
  ).join("");

  return `User ${suffix}`;
}

function resolveCookiePolicy(
  serverUrl: string | undefined,
  websiteUrl: string | undefined,
): {
  cookieDomain: string | undefined;
  sameSite: "Lax" | "None";
  secure: boolean;
} {
  const secure = serverUrl?.startsWith("https") ?? false;
  const cookieDomain = resolveCrossSubdomainCookieDomain(serverUrl, websiteUrl);
  const serverHost = parseHostname(serverUrl);
  const websiteHost = parseHostname(websiteUrl);
  const isCrossSite =
    Boolean(serverHost) && Boolean(websiteHost) && serverHost !== websiteHost && !cookieDomain;

  // Cross-site cookies require SameSite=None and Secure=true.
  const sameSite = isCrossSite && secure ? "None" : "Lax";

  return {
    cookieDomain,
    sameSite,
    secure,
  };
}

export function createAuth(d1: D1Database, options: CreateAuthOptions = {}) {
  const { backgroundTaskHandler } = options;
  // Intentionally bypass the cache when a request-scoped backgroundTaskHandler is supplied:
  // the handler captures that request's executionCtx and must not leak into other requests.
  if (!backgroundTaskHandler) {
    const cached = authCache.get(d1);
    if (cached) return cached;
  }

  const db = createDb(d1);
  const configuredAdminEmail = (
    (env as Cloudflare.Env & { ADMIN_EMAIL?: string }).ADMIN_EMAIL ?? ""
  )
    .trim()
    .toLowerCase();
  const { cookieDomain, sameSite, secure } = resolveCookiePolicy(env.SERVER_URL, env.WEBSITE_URL);
  const originPolicy = createOriginPolicy({
    nodeEnv: env.NODE_ENV,
    websiteUrl: env.WEBSITE_URL,
  });
  const auth = betterAuth<BetterAuthOptions>({
    baseURL: env.SERVER_URL || "",
    appName: commonConfig.app.name,
    database: drizzleAdapter(db, {
      provider: "sqlite",
      schema,
    }),
    account: {
      accountLinking: {
        enabled: true,
        trustedProviders: ["google", "github"],
      },
    },
    session: {
      cookieCache: {
        enabled: true,
        maxAge: 60 * 60,
      },
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
    },
    databaseHooks: {
      user: {
        create: {
          before: async (nextUser, context) => {
            const headers = context?.headers ?? new Headers();
            const blocked = await findRequestAbuseBlock(db, {
              headers,
              email: nextUser.email,
              hashSecret: env.BETTER_AUTH_SECRET,
              includeDisposableEmailDomains: commonConfig.auth.abuse.blockDisposableEmailDomains,
              kinds: ["email_domain", "ip", "device"],
            });
            if (!blocked) return;

            const t = createT(getLocaleFromHeaders(headers));
            throw new APIError("FORBIDDEN", {
              message: t(abuseBlockErrorKey(blocked)),
            });
          },
        },
      },
      session: {
        create: {
          before: async (nextSession, context) => {
            const headers = context?.headers ?? new Headers();
            const [currentUser] = await db
              .select({
                deletedAt: schema.user.deletedAt,
                email: schema.user.email,
                emailVerified: schema.user.emailVerified,
                role: schema.user.role,
              })
              .from(schema.user)
              .where(eq(schema.user.id, nextSession.userId));

            if (currentUser?.deletedAt) {
              const t = createT(getLocaleFromHeaders(headers));
              throw new APIError("UNAUTHORIZED", {
                message: t("errors.accountDeleted"),
              });
            }

            const blocked = await findRequestAbuseBlock(db, {
              headers,
              hashSecret: env.BETTER_AUTH_SECRET,
              includeDisposableEmailDomains: false,
              kinds: ["ip", "device"],
            });
            if (blocked) {
              const t = createT(getLocaleFromHeaders(headers));
              throw new APIError("FORBIDDEN", {
                message: t(abuseBlockErrorKey(blocked)),
              });
            }

            if (
              configuredAdminEmail &&
              currentUser?.emailVerified &&
              currentUser.email.toLowerCase() === configuredAdminEmail &&
              currentUser.role !== "admin"
            ) {
              await db
                .update(schema.user)
                .set({ role: "admin", updatedAt: new Date() })
                .where(eq(schema.user.id, nextSession.userId));
            }
          },
        },
      },
    },
    trustedOrigins: originPolicy.trustedBrowserOrigins,
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      password: {
        hash: hashPassword,
        verify: verifyPassword,
      },
      sendResetPassword: async ({ user, url }, request) => {
        try {
          await sendResetPasswordEmailFromRequest(request)({
            to: user.email,
            name: user.name || "User",
            resetUrl: url,
          });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Failed to send reset password email";
          throw new APIError("BAD_REQUEST", { message });
        }
      },
    },
    emailVerification: {
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }, request) => {
        try {
          await sendVerificationEmailFromRequest(request)({
            to: user.email,
            name: user.name || "User",
            verificationUrl: url,
          });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Failed to send verification email";
          throw new APIError("BAD_REQUEST", { message });
        }
      },
    },
    socialProviders: {
      github: {
        enabled: commonConfig.auth.methods.githubEnabled ?? false,
        clientId: env.GITHUB_CLIENT_ID || "",
        clientSecret: env.GITHUB_CLIENT_SECRET || "",
        redirectURI: joinUrl(env.SERVER_URL, "/api/auth/callback/github"),
      },
      google: {
        prompt: "select_account",
        enabled: commonConfig.auth.methods.googleEnabled ?? false,
        clientId: env.GOOGLE_CLIENT_ID || "",
        clientSecret: env.GOOGLE_CLIENT_SECRET || "",
        redirectURI: joinUrl(env.SERVER_URL, "/api/auth/callback/google"),
      },
      apple: {
        ...getAppleProviderConfig(),
        enabled: commonConfig.auth.methods.appleEnabled ?? false,
      },
    },
    // Route-level throttle for auth endpoints. The phone-number routes are the hottest abuse
    // target (each send triggers a billed SMS), so they get the tightest per-IP budget.
    rateLimit: {
      enabled: true,
      window: 60,
      max: 30,
      customRules: {
        "/email-otp/send-verification-otp": { window: 60, max: 3 },
        "/sign-in/email-otp": { window: 60, max: 10 },
        "/phone-number/send-otp": { window: 60, max: 3 },
        "/phone-number/verify": { window: 60, max: 10 },
        // Guest checkout: each call creates a user row, so a browser rarely needs more than one.
        "/sign-in/anonymous": { window: 60, max: 5 },
      },
    },
    advanced: {
      // https://better-auth.com/docs/reference/options#advanced
      ipAddress: {
        ipAddressHeaders: ["cf-connecting-ip", "x-forwarded-for", "x-real-ip"],
      },
      cookiePrefix: commonConfig.auth.cookiePrefix,
      ...(backgroundTaskHandler
        ? {
            // Better Auth calls this instead of awaiting backgroundable tasks inline.
            backgroundTasks: {
              handler: backgroundTaskHandler,
            },
          }
        : {}),
      defaultCookieAttributes: {
        sameSite,
        secure,
        httpOnly: !env.SERVER_URL?.includes("localhost"),
        // shared subdomains
        domain: cookieDomain,
        path: "/",
      },
    },
    plugins: [
      bearer(),
      // Clients send the Turnstile token in the x-captcha-response header.
      captcha({
        provider: "cloudflare-turnstile",
        secretKey: env.TURNSTILE_SECRET_KEY,
        endpoints: EMAIL_SENDING_AUTH_PATHS,
      }),
      emailOTP({
        disableSignUp: false,
        otpLength: emailOtpConfig.otpLength,
        expiresIn: emailOtpConfig.expiresInSeconds,
        allowedAttempts: emailOtpConfig.allowedAttempts,
        storeOTP: "hashed",
        sendVerificationOTP: async ({ email, otp, type }, ctx) => {
          if (type !== "sign-in") {
            throw new APIError("BAD_REQUEST", { message: "Unsupported email OTP type" });
          }

          await sendSignInOtpEmailFromRequest(ctx?.request)({
            to: email,
            otp,
          });
        },
      }),
      phoneNumber({
        otpLength: smsOtpConfig.otpLength,
        expiresIn: smsOtpConfig.expiresInSeconds,
        // Aliyun generates the OTP itself. Better Auth keeps route/session orchestration only.
        // This callback only triggers provider-side delivery.
        sendOTP: async ({ phoneNumber }) => {
          await getSmsProvider().sendVerificationCode(phoneNumber);
        },
        // When the provider exposes verifyCode, it becomes the source of truth for OTP checks.
        verifyOTP: async ({ phoneNumber, code }) => verifySmsCode(phoneNumber, code),
        // Phone auth is limited to mainland China E.164 numbers for the Aliyun integration.
        // isSupportedSmsPhoneNumber already enforces the strict +86\d{11} shape.
        phoneNumberValidator: async (phoneNumber) => isSupportedSmsPhoneNumber(phoneNumber),
        signUpOnVerification: {
          // Better Auth still requires an email field, so phone-only users receive a placeholder.
          // The placeholder is an HMAC digest keyed by the server secret so the raw phone number
          // is never readable from the email column.
          getTempEmail: (phoneNumber) =>
            buildPhoneCompatibilityEmail(phoneNumber, env.BETTER_AUTH_SECRET),
          getTempName: () => buildRandomPhoneUserName(),
        },
      }),
      // Role storage, ban semantics, and auth.api.* helpers. HTTP /admin/* is denied in index.ts.
      admin({
        ac: betterAuthAccessControl,
        roles: betterAuthRoles,
        defaultRole: rbacConfig.defaultRole,
        adminRoles: [...rbacConfig.adminRoles],
      }),
      // Guests can render and pay without signing in; see lib/guest-account.ts.
      anonymous({
        generateRandomEmail: buildGuestEmail,
        generateName: () => "Guest",
        // A guest signing in to a real account brings their credits and renders along.
        onLinkAccount: async ({ anonymousUser, newUser }) => {
          await mergeGuestAccount(db, anonymousUser.user.id, newUser.user.id);
        },
      }),
      localization({
        defaultLocale: "default",
        getLocale: (request) => {
          if (!request) return "default";
          const locale = getLocaleFromRequest(request);
          return betterAuthLocaleMap[locale];
        },
      }),
    ],
  });

  if (!backgroundTaskHandler) {
    authCache.set(d1, auth);
  }
  return auth;
}
