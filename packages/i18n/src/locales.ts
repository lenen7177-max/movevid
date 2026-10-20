/**
 * Single source of truth for locales across all apps.
 *
 * `knownLocales` have message files in ./messages/{web,server,common}/<locale>.json.
 * `supportedLocales` are the ones the site actually serves: URL prefixes, the language
 * switcher, sitemap, hreflang and emails. The site ships English only; the zh and jp message
 * files stay in the repo but are not loaded, so new copy only has to be written in en.json.
 *
 * To serve another locale:
 * 1. Add it to supportedLocales below
 * 2. Import its message files in ./messages/{web,server,common}.ts and fill in what's missing
 *    (TypeScript checks every key against en.json)
 * 3. Add its content folders under apps/web/content/{blog,author,category}/<locale>
 */
export const knownLocales = ["en", "zh", "jp"] as const;

export type KnownLocale = (typeof knownLocales)[number];

export const supportedLocales = ["en"] as const satisfies readonly KnownLocale[];

export type Locale = (typeof supportedLocales)[number];

export const defaultLocale: Locale = "en";
export const localeCookieName = "locale";

/**
 * Locale to human-readable display name mapping.
 * Used in locale switchers and language menus.
 */
export const localeDisplayNames: Record<KnownLocale, string> = {
  en: "English",
  zh: "中文",
  jp: "日本語",
};

/**
 * Locale to Open Graph locale mapping.
 * Used for og:locale meta tags.
 */
export const localeToOpenGraph: Record<KnownLocale, string> = {
  en: "en_US",
  zh: "zh_CN",
  jp: "ja_JP",
};

/**
 * Locale to the language code search engines expect in hreflang (ISO 639-1).
 * Our "jp" locale is Japanese, which hreflang spells "ja". Also used for <html lang>.
 */
export const localeToHreflang: Record<KnownLocale, string> = {
  en: "en",
  zh: "zh",
  jp: "ja",
};

/**
 * Locale to BCP 47 language tag mapping.
 * Used for Intl formatting APIs.
 */
export const localeToDateFormat: Record<KnownLocale, string> = {
  en: "en-US",
  zh: "zh-CN",
  jp: "ja-JP",
};

export function isValidLocale(locale: string | undefined): locale is Locale {
  return (supportedLocales as readonly string[]).includes(locale as string);
}

/**
 * Type helper to ensure all served locales are covered in a record.
 * Usage: const messages: LocaleRecord<typeof en> = { en };
 */
export type LocaleRecord<T> = Record<Locale, T>;
