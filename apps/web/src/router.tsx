import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { DefaultCatchBoundary } from "@/components/feedback/default-catch-boundary";
import { FullScreenLoading } from "@/components/feedback/full-screen-loading";
import { deLocalizeUrl, localizeUrl } from "./i18n/client";
import { Providers } from "./providers/providers.js";
import { routeTree } from "./routeTree.gen";
import { registerRouteInvalidator } from "./utils/app-router";
import { orpc, queryClient } from "./utils/orpc";

export const getRouter = () => {
  const router = createTanStackRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
    context: { orpc, queryClient },
    defaultPendingComponent: FullScreenLoading,
    defaultErrorComponent: DefaultCatchBoundary,
    InnerWrap: ({ children }) => <Providers>{children}</Providers>,
    rewrite: {
      // Remove locale prefix before routing (e.g., /zh/about -> /about)
      input: ({ url }) => deLocalizeUrl(url),
      // Add locale prefix when generating links (e.g., /about -> /zh/about)
      output: ({ url }) => localizeUrl(url),
    },
  });
  registerRouteInvalidator(() => router.invalidate());
  return router;
};

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
