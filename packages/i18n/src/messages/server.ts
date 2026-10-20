import type { Locale, LocaleRecord } from "../locales";

import serverEn from "./server/en.json";

export type ServerMessages = typeof serverEn;

// Only served locales are loaded; ./server/zh.json and jp.json stay for later (see ../locales.ts).
export const serverMessages: LocaleRecord<ServerMessages> = {
  en: serverEn,
};

export function getServerMessages(locale: Locale): ServerMessages {
  return serverMessages[locale];
}
