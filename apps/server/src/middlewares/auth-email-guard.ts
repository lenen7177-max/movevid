import { resolveCommonConfig } from "@repo/app-config";
import { getClientIp } from "@repo/shared";
import { createMiddleware } from "hono/factory";
import { isDisposableEmailDomain } from "@/abuse/disposable-email-domains";
import { EMAIL_SENDING_AUTH_PATHS } from "@/lib/auth";

const AUTH_BASE_PATH = "/api/auth";
const blockDisposableEmailDomains = resolveCommonConfig().auth.abuse.blockDisposableEmailDomains;

async function readEmail(request: Request): Promise<string | null> {
  try {
    const body = (await request.clone().json()) as { email?: unknown };
    return typeof body.email === "string" ? body.email.trim().toLowerCase() : null;
  } catch {
    return null;
  }
}

/**
 * Guards auth routes that send email: rejects disposable inboxes before a message goes out,
 * then caps calls per client IP and per recipient address.
 */
export const authEmailGuardMiddleware = createMiddleware<{ Bindings: Cloudflare.Env }>(
  async (c, next) => {
    const path = c.req.path.slice(AUTH_BASE_PATH.length);
    if (c.req.method !== "POST" || !EMAIL_SENDING_AUTH_PATHS.includes(path)) {
      await next();
      return;
    }

    const email = await readEmail(c.req.raw);
    if (blockDisposableEmailDomains && email && isDisposableEmailDomain(email)) {
      return c.json(
        { code: "EMAIL_DOMAIN_BLOCKED", message: c.get("t")("errors.emailDomainBlocked") },
        403,
      );
    }

    const ip = getClientIp(c.req.raw.headers) ?? "unknown";
    const [byIp, byEmail] = await Promise.all([
      c.env.AUTH_EMAIL_IP_RATE_LIMITER.limit({ key: ip }),
      email ? c.env.AUTH_EMAIL_ADDRESS_RATE_LIMITER.limit({ key: email }) : { success: true },
    ]);
    if (!byIp.success || !byEmail.success) {
      return c.json(
        { code: "TOO_MANY_REQUESTS", message: c.get("t")("errors.tooManyRequests") },
        429,
      );
    }
    await next();
  },
);
