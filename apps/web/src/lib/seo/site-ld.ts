import { webConfig } from "@/configs/web-config";
import { type JsonLdObject, resolveOrigin } from "@/utils/seo";

/** @id of the site's Organization node, so other nodes and pages can point at it. */
export function organizationId(): string {
  return `${resolveOrigin()}/#organization`;
}

/**
 * schema.org Organization for the brand: name, home URL, logo, support email and the social
 * profiles from site.config.jsonc (`socialUrls`; no sameAs while the list is empty).
 */
export function organizationLd(): JsonLdObject {
  const origin = resolveOrigin();
  const email = webConfig.SupportEmail.trim();
  return {
    "@type": "Organization",
    "@id": organizationId(),
    name: webConfig.AppName,
    url: `${origin}/`,
    logo: {
      "@type": "ImageObject",
      url: `${origin}/pwa/pwa-512x512.png`,
      width: 512,
      height: 512,
    },
    ...(email
      ? {
          email,
          contactPoint: { "@type": "ContactPoint", contactType: "customer support", email },
        }
      : {}),
    ...(webConfig.SocialUrls.length > 0 ? { sameAs: [...webConfig.SocialUrls] } : {}),
  };
}

/** schema.org WebSite for the home page, published by the Organization. */
export function webSiteLd(locale: string): JsonLdObject {
  const origin = resolveOrigin();
  return {
    "@type": "WebSite",
    "@id": `${origin}/#website`,
    name: webConfig.AppName,
    url: `${origin}/`,
    inLanguage: locale,
    publisher: { "@id": organizationId() },
  };
}
