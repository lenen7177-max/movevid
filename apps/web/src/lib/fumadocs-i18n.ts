//https://www.fumadocs.dev/docs/internationalization/tanstack-start

import { useRouter } from "@tanstack/react-router";
import { defineI18n } from "fumadocs-core/i18n";
import { defineI18nUI } from "fumadocs-ui/i18n";
import {
  defaultLocale,
  isValidLocale,
  localeDisplayNames,
  type Locale,
  setLocaleCookie,
  shouldIgnorePath,
  supportedLocales,
} from "@/i18n";

const languages = [...supportedLocales];

export const fumadocsI18n = defineI18n({
  defaultLanguage: defaultLocale,
  languages,
  parser: "dir",
  // TanStack rewrite already adds locale prefixes; keep page URLs delocalized
  // so sidebar active state matches the router's delocalized pathname.
  hideLocale: "always",
  fallbackLanguage: defaultLocale,
});

const { provider } = defineI18nUI(fumadocsI18n, {
  translations: {
    en: {
      displayName: localeDisplayNames.en,
      search: "Search",
    },
    zh: {
      displayName: localeDisplayNames.zh,
      search: "搜索",
    },
    jp: {
      displayName: localeDisplayNames.jp,
      search: "検索",
    },
  },
});

export function useFumadocsI18nProvider(locale: Locale | undefined) {
  const router = useRouter();
  return {
    ...provider(locale),
    onLocaleChange(nextLocale: string) {
      if (typeof window === "undefined") return;
      const newLocale = isValidLocale(nextLocale) ? (nextLocale as Locale) : defaultLocale;

      setLocaleCookie(newLocale);

      const pathname = window.location.pathname;
      const pathWithoutLocale = pathname.replace(/^\/[a-z]{2}(?=\/|$)/, "") || "/";

      if (shouldIgnorePath(pathWithoutLocale)) {
        router.navigate({
          to: `${pathWithoutLocale}${window.location.search}${window.location.hash}`,
          reloadDocument: true,
        });
        return;
      }

      const newPath =
        newLocale === defaultLocale
          ? pathWithoutLocale
          : `/${newLocale}${pathWithoutLocale === "/" ? "" : pathWithoutLocale}`;

      router.navigate({
        to: `${newPath}${window.location.search}${window.location.hash}`,
        reloadDocument: true,
      });
    },
  };
}
