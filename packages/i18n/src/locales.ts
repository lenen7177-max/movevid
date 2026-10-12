/**
 * Single source of truth for supported locales across all apps.
 *
 * To add a new locale:
 * 1. Add it to the supportedLocales array below
 * 2. Add corresponding translation files in each app's messages folder
 * 3. TypeScript will enforce that all apps implement the new locale
 */
export const supportedLocales = ["en", "zh", "jp"] as const;

export type Locale = (typeof supportedLocales)[number];

export const defaultLocale: Locale = "en";
export const localeCookieName = "locale";

/**
 * Locale to human-readable display name mapping.
 * Used in locale switchers and language menus.
 */
export const localeDisplayNames: LocaleRecord<string> = {
  en: "English",
  zh: "中文",
  jp: "日本語",
};

/**
 * Locale to Open Graph locale mapping.
 * Used for og:locale meta tags.
 */
export const localeToOpenGraph: LocaleRecord<string> = {
  en: "en_US",
  zh: "zh_CN",
  jp: "ja_JP",
};

/**
 * Locale to the language code search engines expect in hreflang (ISO 639-1).
 * Our "jp" locale is Japanese, which hreflang spells "ja".
 */
export const localeToHreflang: LocaleRecord<string> = {
  en: "en",
  zh: "zh",
  jp: "ja",
};

/**
 * Locale to BCP 47 language tag mapping.
 * Used for Intl formatting APIs.
 */
export const localeToDateFormat: LocaleRecord<string> = {
  en: "en-US",
  zh: "zh-CN",
  jp: "ja-JP",
};

export function isValidLocale(locale: string | undefined): locale is Locale {
  return supportedLocales.includes(locale as Locale);
}

/**
 * Type helper to ensure all locales are covered in a record.
 * Usage: const messages: LocaleRecord<typeof en> = { en, zh };
 */
export type LocaleRecord<T> = Record<Locale, T>;
