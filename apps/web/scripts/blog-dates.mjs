// Blog post dates. `date` is the publish day; the optional `updated` is the day of the last
// substantive change (new steps, corrected facts), never a date-only refresh. BlogPosting
// `dateModified` and the sitemap <lastmod> use `updated` when it is set, else `date`.

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * @typedef {{ date?: string, updated?: string }} PostDates
 */

/**
 * Whether `value` is a YYYY-MM-DD string naming a real calendar day.
 * @param {unknown} value
 * @returns {boolean}
 */
export function isIsoDay(value) {
  if (typeof value !== "string" || !ISO_DAY.test(value)) return false;
  const day = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(day.getTime()) && day.toISOString().slice(0, 10) === value;
}

/**
 * Problems with a post's optional `updated`, as messages: the format, and that it is not
 * before `date` (an invalid `date` is reported on its own).
 * @param {{ date?: unknown, updated?: unknown }} frontmatter
 * @returns {string[]}
 */
export function updatedDateErrors({ date, updated }) {
  if (updated === undefined) return [];
  if (!isIsoDay(updated)) {
    return [`has invalid updated date: ${String(updated)} (use YYYY-MM-DD)`];
  }
  if (isIsoDay(date) && /** @type {string} */ (updated) < /** @type {string} */ (date)) {
    return [`has updated ${updated} before its date ${date}`];
  }
  return [];
}

/**
 * `date` and `updated` from an MDX file's frontmatter (quotes stripped).
 * @param {string} source
 * @returns {PostDates}
 */
export function frontmatterDates(source) {
  const frontmatter = /^(?:﻿)?---\r?\n([\s\S]*?)\r?\n---/.exec(source)?.[1] ?? "";
  const field = (name) =>
    new RegExp(`^${name}:\\s*["']?([^"'\\s#]+)`, "m").exec(frontmatter)?.[1] ?? undefined;
  return { date: field("date"), updated: field("updated") };
}

/**
 * The day a post last changed: `updated` when set, else `date`.
 * @param {PostDates} dates
 * @returns {string | undefined}
 */
export function lastModifiedDay({ date, updated }) {
  return updated || date;
}
