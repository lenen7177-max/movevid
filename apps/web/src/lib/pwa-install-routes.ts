/**
 * Public marketing pages where the "install the app" toast stays hidden: a first visit there
 * should see the page, not a pop-up. The prompt still shows in the studio and dashboard.
 * Paths arrive without the locale prefix (the router strips it).
 */
const MARKETING_PATHS = [
  /^\/$/,
  /^\/templates(?:\/|$)/,
  /^\/pricing\/?$/,
  /^\/blog(?:\/|$)/,
  /^\/(?:privacy|terms)\/?$/,
];

export function isInstallPromptRoute(pathname: string): boolean {
  return !MARKETING_PATHS.some((pattern) => pattern.test(pathname));
}
