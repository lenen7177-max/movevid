/**
 * Template placeholders that every new site replaces. Specific ones come first: text they match
 * is not counted again by the generic ones (see countPlaceholders).
 */
export const PLACEHOLDERS = [
  {
    label: "rate-limit namespace_id (unique per Cloudflare account)",
    pattern: /<YOUR_RATELIMIT_NAMESPACE_ID_\d+>/g,
  },
  // Not inside another name: my-example.com and our-your-project are real values.
  {
    label: "example.com domain",
    pattern: /(?<![\w-])(?:api\.|media\.|www\.)?example\.com(?![\w-])/g,
  },
  { label: "your-project name", pattern: /(?<![\w-])your-project(?![\w])/g },
  { label: "PLACEHOLDER price/key", pattern: /[A-Z_]*PLACEHOLDER[A-Z_]*/g },
  { label: "<YOUR_…> value", pattern: /<YOUR_[A-Z0-9_]+>/g },
  { label: "zero UUID", pattern: /00000000-0000-0000-0000-000000000000/g },
  { label: "YourBrand name", pattern: /\bYourBrand\b/g },
];

/** [label, count] for each placeholder kind found in `text`. */
export function countPlaceholders(text) {
  const hits = [];
  let remaining = text;
  for (const { label, pattern } of PLACEHOLDERS) {
    const count = remaining.match(pattern)?.length ?? 0;
    if (count) {
      hits.push([label, count]);
      remaining = remaining.replace(pattern, "");
    }
  }
  return hits;
}

/** Whether a single config value is still one of the placeholders. */
export function isPlaceholder(value) {
  return countPlaceholders(String(value ?? "")).length > 0;
}
