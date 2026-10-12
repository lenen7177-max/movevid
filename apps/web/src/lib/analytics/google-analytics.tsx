export const gaMeasurementId = import.meta.env.VITE_GA_MEASUREMENT_ID;

type GoogleAnalyticsEventParams = Record<string, unknown>;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (command: "event", eventName: string, eventParams?: GoogleAnalyticsEventParams) => void;
  }
}

/**
 * Builds the GA4 script tags used by the TanStack Start root document.
 *
 * @returns Script descriptors for GA4 initialization, or an empty list when GA is not configured.
 */
export function getGoogleAnalyticsScripts() {
  if (!gaMeasurementId) {
    return [];
  }

  return [
    {
      src: `https://www.googletagmanager.com/gtag/js?id=${gaMeasurementId}`,
      async: true,
    },
    {
      children: `
window.dataLayer = window.dataLayer || [];
function gtag(){window.dataLayer.push(arguments);}
window.gtag = gtag;
gtag('js', new Date());
gtag('config', ${JSON.stringify(gaMeasurementId)}, { send_page_view: false });
			`.trim(),
    },
  ];
}

/**
 * Tracks a GA4 page view for the current browser location.
 */
export function trackGooglePageView() {
  if (typeof window === "undefined") {
    return;
  }

  trackGoogleEvent("page_view", {
    page_location: window.location.href,
    page_path: window.location.pathname + window.location.search + window.location.hash,
    page_title: document.title,
  });
}

/**
 * Tracks a custom GA4 event when Google Analytics is configured.
 *
 * @param eventName - GA4 event name to send.
 * @param eventParams - Optional GA4 event parameters.
 */
export function trackGoogleEvent(eventName: string, eventParams?: GoogleAnalyticsEventParams) {
  if (!gaMeasurementId || typeof window === "undefined" || !window.gtag) {
    return;
  }

  window.gtag("event", eventName, eventParams);
}
