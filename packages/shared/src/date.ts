/**
 * Format a date string using Intl.DateTimeFormat with locale-specific formatting.
 * Read in UTC, so a date-only value ("2026-01-01") shows the same day on the server and in
 * every visitor's time zone.
 * @param locale - The locale string (e.g., 'en', 'zh', 'jp')
 * @param value - The date string to format
 * @param localeToDateFormat - Mapping of locale to Intl locale format
 * @returns Formatted date string or original value if parsing fails
 */
export function formatDate(
  locale: string,
  value: string,
  localeToDateFormat: Record<string, string>,
): string {
  const intlLocale =
    localeToDateFormat[locale as keyof typeof localeToDateFormat] ?? localeToDateFormat.en;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(intlLocale, {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(parsed);
}

const defaultDateTimeFormatOptions: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "long",
  day: "numeric",
};

const dateTimeFormatters = new Map<string, Intl.DateTimeFormat>();

function getDateTimeFormatter(
  locale: string,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const optionEntries = Object.entries(options).sort(([left], [right]) =>
    left.localeCompare(right),
  );
  const key = JSON.stringify([locale, optionEntries]);
  const cachedFormatter = dateTimeFormatters.get(key);

  if (cachedFormatter) {
    return cachedFormatter;
  }

  const formatter = new Intl.DateTimeFormat(locale, options);
  dateTimeFormatters.set(key, formatter);
  return formatter;
}

/**
 * Format a date with customizable options and locale
 * @param date - Date to format (Date, string, number, or undefined)
 * @param options - Intl.DateTimeFormatOptions for customization
 * @param locale - Locale string (defaults to 'en-US')
 * @returns Formatted date string or empty string if date is invalid/undefined
 */
export function formatDateWithOptions(
  date: Date | string | number | undefined,
  options: Intl.DateTimeFormatOptions = {},
  locale = "en-US",
): string {
  if (date === undefined) {
    return "";
  }

  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  const resolvedOptions = Object.keys(options).length ? options : defaultDateTimeFormatOptions;
  return getDateTimeFormatter(locale, resolvedOptions).format(parsed);
}
