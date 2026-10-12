import type { Locale, LocaleRecord } from "../locales";

import webEn from "./web/en.json";
import webJp from "./web/jp.json";
import webZh from "./web/zh.json";

export type WebMessages = typeof webEn;

export const webMessages: LocaleRecord<WebMessages> = {
  en: webEn,
  zh: webZh,
  jp: webJp,
};

export function getWebMessages(locale: Locale): WebMessages {
  return webMessages[locale];
}
