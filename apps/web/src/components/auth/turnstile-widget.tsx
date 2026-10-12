import { useEffect, useRef } from "react";

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const siteKey = (import.meta.env.VITE_TURNSTILE_SITE_KEY ?? "").trim();

type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      size: "flexible";
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
    },
  ) => string;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptPromise: Promise<TurnstileApi> | null = null;

function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  scriptPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => {
      if (window.turnstile) resolve(window.turnstile);
      else reject(new Error("Turnstile failed to initialize"));
    };
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error("Turnstile failed to load"));
    };
    document.head.append(script);
  });
  return scriptPromise;
}

type TurnstileWidgetProps = {
  /** Receives a fresh token, or null when it expires, errors, or is reset. Must be stable. */
  onTokenChange: (token: string | null) => void;
  /** Increment after each use: tokens are single-use, so the widget issues a new one. */
  resetSignal: number;
};

/** Cloudflare Turnstile check required by the server before it sends any auth email. */
export function TurnstileWidget({ onTokenChange, resetSignal }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadTurnstile()
      .then((turnstile) => {
        if (cancelled || !containerRef.current) return;
        widgetIdRef.current = turnstile.render(containerRef.current, {
          sitekey: siteKey,
          size: "flexible",
          callback: (token) => onTokenChange(token),
          "expired-callback": () => onTokenChange(null),
          "error-callback": () => onTokenChange(null),
        });
      })
      .catch(() => onTokenChange(null));

    return () => {
      cancelled = true;
      if (widgetIdRef.current) window.turnstile?.remove(widgetIdRef.current);
      widgetIdRef.current = null;
    };
  }, [onTokenChange]);

  useEffect(() => {
    if (resetSignal === 0 || !widgetIdRef.current) return;
    onTokenChange(null);
    window.turnstile?.reset(widgetIdRef.current);
  }, [onTokenChange, resetSignal]);

  return <div ref={containerRef} className="min-h-[65px]" />;
}
