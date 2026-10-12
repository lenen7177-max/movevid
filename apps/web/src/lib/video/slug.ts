/** URL slug of a template page: `duo_dance` → `duo-dance`. */
export function templateSlug(templateId: string): string {
  return templateId.replace(/_/g, "-");
}

/** Template id for a URL slug, or null when the slug has no matching template. */
export function templateIdFromSlug<T extends string>(slug: string, ids: readonly T[]): T | null {
  const id = slug.replace(/-/g, "_");
  return (ids as readonly string[]).includes(id) ? (id as T) : null;
}
