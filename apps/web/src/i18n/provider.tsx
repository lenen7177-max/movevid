import type { ReactNode } from "react";
import type { WebMessages } from "@repo/i18n/messages";
import { IntlProvider as UseIntlProvider } from "use-intl";
import type { Locale } from "./config";

interface IntlProviderProps {
  locale: Locale;
  messages: WebMessages;
  children: ReactNode;
}

export function IntlProvider({ locale, messages, children }: IntlProviderProps) {
  return (
    <UseIntlProvider locale={locale} messages={messages} timeZone="UTC">
      {children}
    </UseIntlProvider>
  );
}
