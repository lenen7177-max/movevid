import { localeToHreflang, localeToOpenGraph } from "@repo/i18n";
import type { WebMessages } from "@repo/i18n/messages";
import { isAbsoluteUrl, normalizePath, toAbsoluteUrl, trimTrailingSlash } from "@repo/shared";
import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { getCurrentLocale, getMessages, type Locale } from "@/i18n";
import { defaultLocale, supportedLocales } from "@/i18n/config";

type JsonLdPrimitive = string | number | boolean | null;
type JsonLdValue = JsonLdPrimitive | JsonLdObject | JsonLdValue[];
export type JsonLdObject = {
  [key: string]: JsonLdValue | undefined;
};

type SeoMetaTag = React.JSX.IntrinsicElements["meta"] | { title: string };

type SeoLinkTag = React.JSX.IntrinsicElements["link"];
type SeoScriptTag = React.JSX.IntrinsicElements["script"];

export interface SeoOptions {
  title: string;
  description?: string;
  keywords?: string | string[];
  canonicalPath: string;
  locale?: Locale;
  robots?: string;
  image?: string;
  imageAlt?: string;
  /** The page's main video (MP4), for og:video. */
  video?: { url: string; type?: string };
  type?: "website" | "article";
  siteName?: string;
  twitterSite?: string;
  alternates?: boolean;
  ldJson?: JsonLdObject;
}

export interface SeoHead {
  meta: SeoMetaTag[];
  links: SeoLinkTag[];
  scripts?: SeoScriptTag[];
}

export type NoIndexPageKey = keyof WebMessages["seo"]["noIndex"]["pages"];

export interface NoIndexSeoOptions extends Omit<
  SeoOptions,
  "robots" | "alternates" | "description"
> {
  description?: string;
  noIndexPage?: NoIndexPageKey;
}

const getRuntimeOrigin = createIsomorphicFn()
  .server(() => {
    try {
      const request = getRequest();
      return new URL(request.url).origin;
    } catch {
      return "";
    }
  })
  .client(() => window.location.origin);

function stripLocalePrefix(path: string): string {
  for (const locale of supportedLocales) {
    const prefix = `/${locale}`;
    if (path === prefix) {
      return "/";
    }
    if (path.startsWith(`${prefix}/`)) {
      return path.slice(prefix.length) || "/";
    }
  }
  return path;
}

function applyLocalePrefix(path: string, locale: Locale): string {
  if (locale === defaultLocale) {
    return path;
  }
  return `/${locale}${path === "/" ? "" : path}`;
}

/** Origin used for canonical URLs and structured data: VITE_APP_URL, else the request's. */
export function resolveOrigin(): string {
  const configuredOrigin = trimTrailingSlash(import.meta.env.VITE_APP_URL ?? "");
  if (configuredOrigin) {
    return configuredOrigin;
  }

  const runtimeOrigin = trimTrailingSlash(getRuntimeOrigin());
  if (runtimeOrigin) {
    return runtimeOrigin;
  }

  return "http://localhost:3000";
}

function resolveCanonicalPath(path: string, locale: Locale): string {
  if (isAbsoluteUrl(path)) {
    return path;
  }

  const normalizedPath = normalizePath(path);
  const localeNeutralPath = stripLocalePrefix(normalizedPath);
  return applyLocalePrefix(localeNeutralPath, locale);
}

function resolveOgLocale(locale: Locale): string {
  return localeToOpenGraph[locale];
}

function buildAlternateLinks(canonicalPath: string, origin: string): Array<SeoLinkTag> {
  if (isAbsoluteUrl(canonicalPath)) {
    return [];
  }

  const localeNeutralPath = stripLocalePrefix(normalizePath(canonicalPath));
  const alternates: SeoLinkTag[] = supportedLocales.map((locale) => {
    const localizedPath = applyLocalePrefix(localeNeutralPath, locale);
    return {
      rel: "alternate",
      hrefLang: localeToHreflang[locale],
      href: toAbsoluteUrl(localizedPath, origin),
    };
  });

  // x-default only means something when there is more than one language to choose from.
  if (supportedLocales.length > 1) {
    alternates.push({
      rel: "alternate",
      hrefLang: "x-default",
      href: toAbsoluteUrl(localeNeutralPath, origin),
    });
  }

  return alternates;
}

function normalizeKeywords(keywords?: string | string[]): string | undefined {
  if (!keywords) {
    return undefined;
  }
  if (Array.isArray(keywords)) {
    return keywords.join(", ");
  }
  return keywords;
}

function serializeJsonLd(value: JsonLdObject): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function applyTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_match, key) => values[key] ?? "");
}

export function resolveNoIndexDescription(
  page: NoIndexPageKey,
  locale: Locale = getCurrentLocale(),
): string {
  const messages = getMessages(locale);
  const template = messages.seo.noIndex.descriptionTemplate;
  const pageLabel = messages.seo.noIndex.pages[page];
  return applyTemplate(template, { page: pageLabel });
}

// https://tanstack.com/start/v0/docs/framework/react/guide/seo
export function buildSeoHead(options: SeoOptions): SeoHead {
  const locale = options.locale ?? getCurrentLocale();
  const origin = resolveOrigin();
  const canonicalPath = resolveCanonicalPath(options.canonicalPath, locale);
  const canonicalUrl = toAbsoluteUrl(canonicalPath, origin);
  const description = options.description;
  const keywords = normalizeKeywords(options.keywords);
  // max-video-preview:-1 lets search engines show video previews of any length.
  const robots = options.robots ?? "index,follow,max-video-preview:-1";
  const type = options.type ?? "website";
  const twitterSite = options.twitterSite ?? canonicalUrl;

  const defaultOgImage = "/og/og.png";
  const imageSource = options.image ?? defaultOgImage;

  const imageUrl = toAbsoluteUrl(imageSource, origin);

  const twitterCard = imageUrl ? "summary_large_image" : "summary";

  const meta: SeoMetaTag[] = [
    { title: options.title },
    { name: "robots", content: robots },
    { property: "og:type", content: type },
    { property: "og:title", content: options.title },
    { property: "og:url", content: canonicalUrl },
    { property: "og:locale", content: resolveOgLocale(locale) },
    { name: "twitter:card", content: twitterCard },
    { name: "twitter:title", content: options.title },
    { name: "twitter:url", content: canonicalUrl },
    { name: "twitter:site", content: twitterSite },
  ];

  if (description) {
    meta.push(
      { name: "description", content: description },
      { property: "og:description", content: description },
      { name: "twitter:description", content: description },
    );
  }

  if (keywords) {
    meta.push({ name: "keywords", content: keywords });
  }

  if (options.siteName) {
    meta.push({ property: "og:site_name", content: options.siteName });
  }

  if (imageUrl) {
    meta.push(
      { property: "og:image", content: imageUrl },
      { name: "twitter:image", content: imageUrl },
    );
  }

  if (imageUrl && options.imageAlt) {
    meta.push({ property: "og:image:alt", content: options.imageAlt });
  }

  if (options.video) {
    const videoUrl = toAbsoluteUrl(options.video.url, origin);
    meta.push(
      { property: "og:video", content: videoUrl },
      ...(videoUrl.startsWith("https://")
        ? [{ property: "og:video:secure_url", content: videoUrl }]
        : []),
      { property: "og:video:type", content: options.video.type ?? "video/mp4" },
    );
  }

  const links: SeoLinkTag[] = [
    { rel: "canonical", href: canonicalUrl },
    ...(options.alternates === false ? [] : buildAlternateLinks(canonicalPath, origin)),
  ];

  const scripts = options.ldJson
    ? [
        {
          type: "application/ld+json",
          children: serializeJsonLd(options.ldJson),
        } satisfies SeoScriptTag,
      ]
    : undefined;

  return {
    meta,
    links,
    scripts,
  };
}

export function buildNoIndexHead(options: NoIndexSeoOptions): SeoHead {
  const locale = options.locale ?? getCurrentLocale();
  const { noIndexPage, description, ...seoOptions } = options;

  const resolvedDescription =
    description ?? (noIndexPage ? resolveNoIndexDescription(noIndexPage, locale) : undefined);

  return buildSeoHead({
    ...seoOptions,
    locale,
    description: resolvedDescription,
    robots: "noindex,nofollow",
    alternates: false,
  });
}
