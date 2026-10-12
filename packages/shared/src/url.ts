/**
 * Remove trailing slashes from URL.
 */
export function trimTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

/**
 * Join base URL and path.
 */
export function joinUrl(baseUrl: string, path: string): string {
  return `${trimTrailingSlash(baseUrl)}${path}`;
}

/**
 * Check whether a value is an absolute http/https URL.
 */
export function isAbsoluteUrl(value: string): boolean {
  return /^https?:\/\//.test(value);
}

/**
 * Convert a relative path or absolute URL to an absolute URL.
 */
export function toAbsoluteUrl(pathOrUrl: string, origin: string): string {
  if (isAbsoluteUrl(pathOrUrl)) {
    return pathOrUrl;
  }
  return new URL(pathOrUrl, `${trimTrailingSlash(origin)}/`).toString();
}

/**
 * Normalize a path by removing query/hash and enforcing leading slash.
 */
export function normalizePath(path: string): string {
  const stripped = path.split(/[?#]/)[0] ?? "/";
  if (!stripped) {
    return "/";
  }
  return stripped.startsWith("/") ? stripped : `/${stripped}`;
}
