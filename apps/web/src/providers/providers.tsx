import { QueryClientProvider } from "@tanstack/react-query";
import { ClientOnly, useRouterState } from "@tanstack/react-router";
import { RootProvider } from "fumadocs-ui/provider/tanstack";
import type { ReactNode } from "react";
import { Toaster } from "@repo/ui/sonner";
import { TooltipProvider } from "@repo/ui/tooltip";
import { PwaInstaller, PwaPromptCapture } from "@/components/pwa/pwa-installer";
import { PwaUpdater } from "@/components/pwa/pwa-updater";
import { ThemeProvider, useTheme } from "@/components/providers/theme-provider";
import { getCurrentLocale, getMessages, IntlProvider } from "@/i18n";
import { PageViewTracker } from "@/lib/analytics/page-view-tracker";
import { AcquisitionReporter } from "@/lib/analytics/acquisition-reporter";
import { AuthEventTracker } from "@/lib/analytics/auth-event-tracker";
import { useFumadocsI18nProvider } from "@/lib/fumadocs-i18n";
import { TawkToChat } from "@/lib/support/tawkto-chat";
import { isPwaEnabled } from "@/configs/pwa-config";
import { isInstallPromptRoute } from "@/lib/pwa-install-routes";
import { webConfig } from "@/configs/web-config";
import { queryClient } from "@/utils/orpc";

function ThemedToaster() {
  const { theme } = useTheme();

  return <Toaster richColors position="top-right" theme={theme} />;
}

export function Providers({ children }: { children: ReactNode }) {
  const locale = getCurrentLocale();
  const messages = getMessages(locale);
  const fumadocsI18nProvider = useFumadocsI18nProvider(locale);
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const pwaEnabled = isPwaEnabled(pathname);

  return (
    <IntlProvider locale={locale} messages={messages}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <TooltipProvider>
            <RootProvider
              i18n={fumadocsI18nProvider}
              theme={{ enabled: false }}
              search={{ enabled: false }}
            >
              <PageViewTracker />
              <AuthEventTracker />
              <AcquisitionReporter />
              <ClientOnly>
                <TawkToChat />
                {pwaEnabled && <PwaPromptCapture />}
                {pwaEnabled && isInstallPromptRoute(pathname) && <PwaInstaller />}
                <PwaUpdater enabled={webConfig.pwa.enabled} shouldRegister={pwaEnabled} />
              </ClientOnly>
              {children}
            </RootProvider>
          </TooltipProvider>
          <ThemedToaster />
        </ThemeProvider>
      </QueryClientProvider>
    </IntlProvider>
  );
}
