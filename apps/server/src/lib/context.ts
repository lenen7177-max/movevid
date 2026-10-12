import type { Context as HonoContext } from "hono";
import {
  CLIENT_DEVICE_ID_HEADER,
  CLIENT_PLATFORM_HEADER,
  getClientIp,
  normalizeClientPlatform,
  normalizeDeviceId,
  normalizeHeaderValue,
} from "@repo/shared";
import { recordClientSignal } from "../abuse/signals";
import { createCreditsService } from "../credits";
import { createDb } from "../db";
import { getEmailProvider } from "../emails";
import { createT, getLocaleFromRequest } from "../i18n";
import { getPaymentService } from "../payments";
import { getStorageProvider } from "../storage";
import {
  FRESH_AUTH_SESSION_QUERY,
  finalizeSoftDeletedSession,
  getUserDeletedAt,
} from "./auth-session-guard";
import { createAuth } from "./auth";

export type CreateContextOptions = {
  /** Hono request context with Cloudflare bindings. */
  context: HonoContext<{ Bindings: Cloudflare.Env }>;
};

/** Creates the per-request server context shared by oRPC procedures. */
export async function createContext({ context }: CreateContextOptions) {
  const db = createDb(context.env.DB);
  const auth = createAuth(context.env.DB);
  const headers = new Headers(context.req.raw.headers);
  const rawSession = await auth.api.getSession({
    headers,
    query: FRESH_AUTH_SESSION_QUERY,
  });
  const deletedAt = rawSession ? await getUserDeletedAt(db, rawSession.user.id) : null;
  const session = finalizeSoftDeletedSession(rawSession, deletedAt);
  const locale = getLocaleFromRequest(context.req.raw);
  const sessionRequest = rawSession?.session as
    | { ipAddress?: string | null; userAgent?: string | null }
    | undefined;
  const deviceId = normalizeDeviceId(headers.get(CLIENT_DEVICE_ID_HEADER));
  const clientPlatform = normalizeClientPlatform(headers.get(CLIENT_PLATFORM_HEADER)) ?? "web";
  const ipAddress = getClientIp(headers) ?? sessionRequest?.ipAddress ?? null;

  if (session?.user.id && deviceId) {
    await recordClientSignal(db, {
      userId: session.user.id,
      platform: clientPlatform,
      deviceId,
      ipAddress,
      hashSecret: context.env.BETTER_AUTH_SECRET,
    });
  }

  // Create storage provider
  const storage = getStorageProvider({
    storage: context.env.STORAGE,
    aliyunOssEnv: context.env,
  });

  // Email provider and service
  const emailProvider = getEmailProvider();
  const payments = getPaymentService(db);
  // Credits share the same database and session context as billing and user APIs.
  const credits = createCreditsService(db, {
    signupGrant: {
      hashSecret: context.env.BETTER_AUTH_SECRET,
      ipAddress,
      userAgent:
        normalizeHeaderValue(headers.get("user-agent")) ?? sessionRequest?.userAgent ?? null,
      deviceId,
    },
  });

  return {
    env: context.env,
    session,
    db,
    auth,
    headers,
    locale,
    t: createT(locale),
    storage,
    email: emailProvider,
    payments,
    credits,
    // Populated by requireAuth on protected procedures.
    currentUser: undefined as
      | {
          deletedAt: Date | null;
          role: string | null;
          banned: boolean | null;
          banExpires: Date | null;
        }
      | undefined,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
