import type { Locale } from "@repo/i18n";
import { type WebMessages, webMessages } from "@repo/i18n/messages";

export function getMessages(locale: Locale): WebMessages {
  return webMessages[locale];
}

export { webMessages as messages };
