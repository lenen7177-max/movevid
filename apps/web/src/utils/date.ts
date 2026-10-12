import { isValidLocale, localeToDateFormat } from "@repo/i18n";

export function formatEffectiveDate(locale: string, effectiveDate: string): string {
  const intlLocale = isValidLocale(locale) ? localeToDateFormat[locale] : localeToDateFormat.en;

  try {
    return new Intl.DateTimeFormat(intlLocale, {
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${effectiveDate}T00:00:00Z`));
  } catch {
    return effectiveDate;
  }
}
