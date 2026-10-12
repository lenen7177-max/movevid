import type { Locale, LocaleRecord } from "../locales";

import commonEn from "./common/en.json";
import commonJp from "./common/jp.json";
import commonZh from "./common/zh.json";

export type CommonMessages = typeof commonEn;

export const commonMessages: LocaleRecord<CommonMessages> = {
  en: commonEn,
  zh: commonZh,
  jp: commonJp,
};

export function getCommonMessages(locale: Locale): CommonMessages {
  return commonMessages[locale];
}
