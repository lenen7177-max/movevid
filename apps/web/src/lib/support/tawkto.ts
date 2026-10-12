import { extractLocaleFromPath } from "@/i18n";

const SCRIPT_ID = "tawkto-embed";
const EMBED_ORIGIN = "https://embed.tawk.to";

export const tawkPropertyId = (import.meta.env.VITE_TAWK_PROPERTY_ID ?? "").trim();
export const tawkWidgetId = (import.meta.env.VITE_TAWK_WIDGET_ID ?? "").trim();

export type TawkVisitor = {
  name?: string;
  email?: string;
};

type TawkApi = {
  visitor?: Record<string, string>;
  onLoad?: () => void;
  setAttributes?: (
    attributes: Record<string, string>,
    callback?: (error?: unknown) => void,
  ) => void;
  hideWidget?: () => void;
  showWidget?: () => void;
  endChat?: () => void;
};

declare global {
  interface Window {
    Tawk_API?: TawkApi;
    Tawk_LoadStart?: Date;
  }
}

let loadPromise: Promise<void> | null = null;
let hideAfterLoad = false;

/**
 * Returns true when both public Tawk.to IDs are present.
 */
export function isTawkToConfigured() {
  return Boolean(tawkPropertyId && tawkWidgetId);
}

/**
 * Returns true for auth routes, including locale-prefixed paths such as `/zh/auth/sign-in`.
 */
export function isAuthPath(pathname: string) {
  const locale = extractLocaleFromPath(pathname);
  const unprefixed = locale ? pathname.slice(locale.length + 1) : pathname;
  const path = unprefixed.startsWith("/") ? unprefixed : `/${unprefixed}`;
  return path === "/auth" || path.startsWith("/auth/");
}

/**
 * Injects the Tawk.to embed once. Later calls reuse the in-flight or completed load.
 *
 * @param visitor - Optional name/email applied before the first script insert.
 */
export function loadTawkTo(visitor?: TawkVisitor) {
  if (!isTawkToConfigured() || typeof window === "undefined") {
    return Promise.resolve();
  }

  if (loadPromise) {
    return loadPromise;
  }

  const api = ensureTawkApi();
  const initialVisitor = toVisitorAttributes(visitor);
  if (initialVisitor) {
    api.visitor = initialVisitor;
  }

  if (isTawkReady(api)) {
    loadPromise = Promise.resolve();
    return loadPromise;
  }

  window.Tawk_LoadStart = new Date();

  loadPromise = new Promise((resolve) => {
    const previousOnLoad = api.onLoad;
    api.onLoad = () => {
      previousOnLoad?.();
      if (hideAfterLoad) {
        api.hideWidget?.();
      }
      resolve();
    };

    if (document.getElementById(SCRIPT_ID)) {
      return;
    }

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.async = true;
    script.src = `${EMBED_ORIGIN}/${tawkPropertyId}/${tawkWidgetId}`;
    script.setAttribute("crossorigin", "*");
    script.onerror = () => resolve();
    document.body.appendChild(script);
  });

  return loadPromise;
}

/**
 * Updates the Tawk.to visitor after the widget is ready.
 */
export function identifyTawkVisitor(visitor: TawkVisitor) {
  const attributes = toVisitorAttributes(visitor);
  if (!attributes || typeof window === "undefined") {
    return;
  }

  const api = ensureTawkApi();
  const apply = () => {
    api.setAttributes?.(attributes, () => undefined);
  };

  if (isTawkReady(api)) {
    apply();
    return;
  }

  const previousOnLoad = api.onLoad;
  api.onLoad = () => {
    previousOnLoad?.();
    apply();
  };
}

/**
 * Hides the chat bubble. Safe to call before the widget has loaded.
 */
export function hideTawkTo() {
  hideAfterLoad = true;
  if (typeof window === "undefined") {
    return;
  }
  window.Tawk_API?.hideWidget?.();
}

/**
 * Shows the chat bubble after a previous hide.
 */
export function showTawkTo() {
  hideAfterLoad = false;
  if (typeof window === "undefined") {
    return;
  }
  window.Tawk_API?.showWidget?.();
}

/**
 * Tears down the Tawk.to widget so the next load does not keep the previous visitor.
 */
export function resetTawkTo() {
  if (typeof window === "undefined") {
    return;
  }

  window.Tawk_API?.endChat?.();
  document.getElementById(SCRIPT_ID)?.remove();

  for (const node of document.querySelectorAll(
    'script[src*="embed.tawk.to"], iframe[src*="tawk.to"], [id^="tawk"], [class^="tawk-"]',
  )) {
    node.remove();
  }

  loadPromise = null;
  hideAfterLoad = false;
  delete window.Tawk_API;
  delete window.Tawk_LoadStart;
}

function ensureTawkApi() {
  window.Tawk_API = window.Tawk_API ?? {};
  return window.Tawk_API;
}

function isTawkReady(api: TawkApi) {
  return typeof api.showWidget === "function";
}

function toVisitorAttributes(visitor?: TawkVisitor) {
  if (!visitor) {
    return;
  }

  const attributes: Record<string, string> = {};
  if (visitor.name) {
    attributes.name = visitor.name;
  }
  if (visitor.email) {
    attributes.email = visitor.email;
  }

  if (!attributes.name && !attributes.email) {
    return;
  }

  return attributes;
}
