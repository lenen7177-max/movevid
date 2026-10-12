import type { TrackProperties } from "@openpanel/web";

const clientId = import.meta.env.VITE_OPENPANEL_CLIENT_ID;

export const openPanel =
  typeof window !== "undefined" && clientId
    ? new (await import("@openpanel/web")).OpenPanel({
        clientId,
      })
    : undefined;

/**
 * Tracks an explicit OpenPanel event without enabling automatic page tracking.
 *
 * @param name - OpenPanel event name to send.
 * @param properties - Optional event properties.
 * @returns The OpenPanel tracking promise when configured, otherwise undefined.
 */
export function trackOpenPanelEvent(name: string, properties?: TrackProperties) {
  return openPanel?.track(name, properties);
}

/**
 * Tracks an explicit OpenPanel screen view for routes the product chooses to measure.
 *
 * @param path - Route or screen path to associate with the screen view.
 * @param properties - Optional screen view properties.
 */
export function trackOpenPanelScreenView(path: string, properties?: TrackProperties) {
  openPanel?.screenView(path, properties);
}
