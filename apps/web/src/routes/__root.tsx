import { TanStackDevtools } from "@tanstack/react-devtools";
import type { QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtoolsPanel } from "@tanstack/react-query-devtools";
import { createRootRouteWithContext, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { BuyCreditsDialogRoot } from "@/components/video/buy-credits-dialog";
import { SignInDialogRoot } from "@/components/auth/sign-in-dialog";
import { DefaultCatchBoundary } from "@/components/feedback/default-catch-boundary";
import { NavigationProgress } from "@/components/layout/navigation-progress";
import { getPwaHeadConfig } from "@/configs/pwa-config";
import { webConfig } from "@/configs/web-config";
import { localeToHreflang } from "@repo/i18n";
import { getCurrentLocale } from "@/i18n";
import { getGoogleAnalyticsScripts } from "@/lib/analytics/google-analytics";
import type { orpc } from "@/utils/orpc";
import appCss from "../styles/index.css?url";

export interface RouterAppContext {
  orpc: typeof orpc;
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterAppContext>()({
  head: ({ matches }) => {
    const pwaHeadConfig = getPwaHeadConfig(matches.at(-1)?.pathname ?? "/");

    return {
      meta: [
        {
          charSet: "utf-8",
        },
        {
          name: "viewport",
          content: "width=device-width, initial-scale=1",
        },
        {
          name: "theme-color",
          content: "#111114",
        },
        ...pwaHeadConfig.meta,
        {
          title: webConfig.AppName,
        },
      ],
      links: [
        {
          rel: "stylesheet",
          href: appCss,
        },
        {
          rel: "icon",
          type: "image/svg+xml",
          href: "/logo.svg",
        },
        {
          rel: "icon",
          sizes: "48x48",
          href: "/favicon.ico",
        },
        {
          rel: "icon",
          sizes: "16x16",
          href: "/favicon-16x16.ico",
        },
        {
          rel: "icon",
          sizes: "32x32",
          href: "/favicon-32x32.ico",
        },
        ...pwaHeadConfig.links,
      ],
      scripts: getGoogleAnalyticsScripts(),
    };
  },
  component: RootDocument,
  errorComponent: DefaultCatchBoundary,
});

function RootDocument() {
  const locale = getCurrentLocale();
  const htmlLang = localeToHreflang[locale];

  return (
    <html lang={htmlLang} suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <NavigationProgress />
        <Outlet />
        <SignInDialogRoot />
        <BuyCreditsDialogRoot />
        <TanStackDevtools
          plugins={[
            {
              name: "TanStack Query",
              render: <ReactQueryDevtoolsPanel />,
            },
            {
              name: "TanStack Router",
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
        <Scripts />
      </body>
    </html>
  );
}
