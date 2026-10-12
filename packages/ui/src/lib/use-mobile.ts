import * as React from "react";

const MOBILE_BREAKPOINT = 768;
const mobileMediaQuery = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;

function subscribeToMobileBreakpoint(onChange: () => void) {
  const mediaQuery = window.matchMedia(mobileMediaQuery);
  mediaQuery.addEventListener("change", onChange);
  return () => mediaQuery.removeEventListener("change", onChange);
}

function getIsMobileSnapshot() {
  return window.matchMedia(mobileMediaQuery).matches;
}

export function useIsMobile() {
  return React.useSyncExternalStore(subscribeToMobileBreakpoint, getIsMobileSnapshot, () => false);
}
