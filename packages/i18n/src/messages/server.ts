import type { Locale, LocaleRecord } from "../locales";

import serverEn from "./server/en.json";
import serverJp from "./server/jp.json";
import serverZh from "./server/zh.json";

export type ServerMessages = typeof serverEn;

export const serverMessages: LocaleRecord<ServerMessages> = {
  en: serverEn,
  zh: serverZh,
  jp: serverJp,
};

export function getServerMessages(locale: Locale): ServerMessages {
  return serverMessages[locale];
}
