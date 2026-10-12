import {
  defaultLocale,
  isValidLocale,
  localeCookieName,
  negotiateLocale,
  type Locale,
} from "@repo/i18n";
import {
  type CommonMessages,
  commonMessages,
  type ServerMessages,
  serverMessages,
} from "@repo/i18n/messages";

// Combined messages type for server
type CombinedErrors = CommonMessages["errors"] & ServerMessages["errors"];

type Messages = {
  errors: CombinedErrors;
  email: ServerMessages["email"];
};

// Build combined messages for each locale
function buildMessages(locale: Locale): Messages {
  const errors: CombinedErrors = {
    ...commonMessages[locale].errors,
    ...serverMessages[locale].errors,
  };

  return {
    errors,
    email: serverMessages[locale].email,
  };
}

const LOCALE_COOKIE = localeCookieName;
const LOCALE_REGEX = new RegExp(`${LOCALE_COOKIE}=([^;]+)`);

export function getLocaleFromHeaders(headers: Headers): Locale {
  const cookie = headers.get("cookie");
  const cookieMatch = cookie?.match(LOCALE_REGEX);
  if (cookieMatch?.[1] && isValidLocale(cookieMatch[1])) {
    return cookieMatch[1];
  }

  return negotiateLocale(headers.get("accept-language"));
}

export function getLocaleFromRequest(request: Request): Locale {
  return getLocaleFromHeaders(request.headers);
}

export function createT(locale: Locale | undefined) {
  const safeLocale = isValidLocale(locale) ? locale : defaultLocale;
  const dict = buildMessages(safeLocale);

  return (key: string, params?: Record<string, string | number>) => {
    const keys = key.split(".");
    let value: unknown = dict;
    for (const k of keys) {
      value = (value as Record<string, unknown>)?.[k];
    }

    if (typeof value !== "string") return key;

    if (params) {
      return value.replace(/\{(\w+)\}/g, (_, k: string) => String(params[k] ?? `{${k}}`));
    }
    return value;
  };
}

export { commonMessages, serverMessages };
