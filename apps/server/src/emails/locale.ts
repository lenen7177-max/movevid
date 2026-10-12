import { defaultLocale, type Locale } from "@repo/i18n";
import { getLocaleFromRequest } from "@/i18n";

export function withLocale<T>(
  request: Request | undefined,
  fn: (params: T & { locale: Locale }) => Promise<void>,
) {
  const locale = request ? getLocaleFromRequest(request) : defaultLocale;
  return (params: T) => fn({ ...params, locale });
}
