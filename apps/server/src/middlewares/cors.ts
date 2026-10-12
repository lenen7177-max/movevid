import type { MiddlewareHandler } from "hono";
import { CLIENT_DEVICE_ID_HEADER, CLIENT_PLATFORM_HEADER } from "@repo/shared";
import { cors } from "hono/cors";
import { createOriginPolicy } from "@/lib/origin-policy";

// Web clients tag every request with a device id and platform (see apps/web/src/lib/device-id.ts).
const ALLOWED_HEADERS = [
  "Content-Type",
  "Authorization",
  "Cookie",
  CLIENT_DEVICE_ID_HEADER,
  CLIENT_PLATFORM_HEADER,
  // Turnstile token checked by Better Auth's captcha plugin.
  "x-captcha-response",
];

function createCorsOriginResolver(env: Record<string, string>) {
  return createOriginPolicy({
    nodeEnv: env.NODE_ENV,
    websiteUrl: env.WEBSITE_URL,
  }).resolveCorsOrigin;
}

// CORS middleware for auth endpoints
export const authCorsMiddleware: MiddlewareHandler = (c, next) => {
  const env = c.env as Record<string, string>;
  const corsMiddleware = cors({
    origin: createCorsOriginResolver(env),
    allowHeaders: ALLOWED_HEADERS,
    allowMethods: ["POST", "GET", "OPTIONS"],
    exposeHeaders: ["Content-Length", "Set-Cookie"],
    maxAge: 600,
    credentials: true,
  });
  return corsMiddleware(c, next);
};

// CORS middleware for API and RPC endpoints
export const apiCorsMiddleware: MiddlewareHandler = (c, next) => {
  const env = c.env as Record<string, string>;
  const corsMiddleware = cors({
    origin: createCorsOriginResolver(env),
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ALLOWED_HEADERS,
    credentials: true,
  });
  return corsMiddleware(c, next);
};
