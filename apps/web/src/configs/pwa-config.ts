import type { AnyRouteMatch } from "@tanstack/react-router";
import { webConfig } from "./web-config";

type PwaHeadConfig = Required<Pick<AnyRouteMatch, "meta" | "links">>;

const enabledPwaHeadConfig: PwaHeadConfig = {
  meta: [
    {
      name: "apple-mobile-web-app-capable",
      content: "yes",
    },
  ],
  links: [
    {
      rel: "apple-touch-icon",
      sizes: "192x192",
      href: "/pwa/pwa-192x192.png",
    },
    {
      rel: "manifest",
      href: "/manifest.webmanifest",
    },
  ],
};

const disabledPwaHeadConfig: PwaHeadConfig = { meta: [], links: [] };

export function isPwaEnabled(pathname: string) {
  const { enabled, paths } = webConfig.pwa;
  return enabled && (paths === undefined || paths.includes(pathname));
}

export function getPwaHeadConfig(pathname: string) {
  return isPwaEnabled(pathname) ? enabledPwaHeadConfig : disabledPwaHeadConfig;
}
