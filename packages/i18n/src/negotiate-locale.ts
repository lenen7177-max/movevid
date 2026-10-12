import { defaultLocale, type Locale } from "./locales";

/**
 * Browser language tags we can serve.
 * Japanese browsers send `ja`; the app locale code is `jp`.
 */
const primaryLanguageToLocale: Record<string, Locale> = {
  en: "en",
  zh: "zh",
  ja: "jp",
  jp: "jp",
};

type LanguagePreference = {
  tag: string;
  quality: number;
};

function matchLanguageTag(tag: string): Locale | null {
  const normalized = tag.trim().toLowerCase().replaceAll("_", "-");
  if (!normalized || normalized === "*") return null;

  const primary = normalized.split("-")[0];
  if (!primary) return null;

  return primaryLanguageToLocale[primary] ?? null;
}

function readQuality(parameters: string[]): number | null {
  let quality = 1;

  for (const parameter of parameters) {
    const [rawKey, rawValue] = parameter.trim().split("=");
    if (rawKey?.trim() !== "q") continue;

    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed)) return null;
    quality = parsed;
  }

  return quality;
}

function parseAcceptLanguage(header: string): LanguagePreference[] {
  const preferences: LanguagePreference[] = [];

  for (const part of header.split(",")) {
    const [rawTag, ...parameters] = part.trim().split(";");
    const tag = rawTag?.trim();
    if (!tag) continue;

    const quality = readQuality(parameters);
    if (quality === null || quality <= 0) continue;

    preferences.push({ tag, quality });
  }

  return preferences.sort((left, right) => right.quality - left.quality);
}

function pickSupportedLocale(preferences: LanguagePreference[]): Locale {
  for (const preference of preferences) {
    const locale = matchLanguageTag(preference.tag);
    if (locale) return locale;
  }

  return defaultLocale;
}

/**
 * Pick a supported locale from an Accept-Language header.
 * Higher q values win. Unsupported languages fall through to the next
 * preference, then to English.
 */
export function negotiateLocale(acceptLanguage: string | null | undefined): Locale {
  if (!acceptLanguage) return defaultLocale;
  return pickSupportedLocale(parseAcceptLanguage(acceptLanguage));
}

/**
 * Pick a supported locale from an ordered language list, such as
 * `navigator.languages`. The first supported tag wins.
 */
export function negotiateLocaleList(languages: readonly string[] | null | undefined): Locale {
  if (!languages) return defaultLocale;

  for (const language of languages) {
    const locale = matchLanguageTag(language);
    if (locale) return locale;
  }

  return defaultLocale;
}
