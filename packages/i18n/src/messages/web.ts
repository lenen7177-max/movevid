import type { Locale, LocaleRecord } from "../locales";

import webEn from "./web/en.json";

export type WebMessages = typeof webEn;

// Only served locales are loaded; ./web/zh.json and jp.json stay for later (see ../locales.ts).
export const webMessages: LocaleRecord<WebMessages> = {
  en: webEn,
};

export function getWebMessages(locale: Locale): WebMessages {
  return webMessages[locale];
}
