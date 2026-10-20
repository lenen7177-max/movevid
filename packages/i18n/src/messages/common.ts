import type { Locale, LocaleRecord } from "../locales";

import commonEn from "./common/en.json";

export type CommonMessages = typeof commonEn;

// Only served locales are loaded; ./common/zh.json and jp.json stay for later (see ../locales.ts).
export const commonMessages: LocaleRecord<CommonMessages> = {
  en: commonEn,
};

export function getCommonMessages(locale: Locale): CommonMessages {
  return commonMessages[locale];
}
