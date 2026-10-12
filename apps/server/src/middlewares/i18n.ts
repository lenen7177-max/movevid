import { createMiddleware } from "hono/factory";
import { createT, getLocaleFromRequest } from "../i18n";
import type { Locale } from "@repo/i18n";

declare module "hono" {
  interface ContextVariableMap {
    locale: Locale;
    t: ReturnType<typeof createT>;
  }
}

export const i18nMiddleware = createMiddleware(async (c, next) => {
  const locale = getLocaleFromRequest(c.req.raw);
  c.set("locale", locale);
  c.set("t", createT(locale));
  await next();
});
