import { useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { trackGooglePageView } from "./google-analytics";

/**
 * Tracks GA4 page views on route changes without sending automatic OpenPanel events.
 */
export function PageViewTracker() {
  const href = useRouterState({ select: (state) => state.location.href });

  useEffect(() => {
    const id = requestAnimationFrame(() => trackGooglePageView());
    return () => cancelAnimationFrame(id);
  }, [href]);

  return null;
}
