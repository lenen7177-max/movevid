export function isStandalonePwa() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari exposes standalone mode through this non-standard Navigator property.
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function isIosSafari() {
  return (
    // iPads using desktop mode identify as MacIntel while still reporting touch points.
    (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) &&
    /Safari/.test(navigator.userAgent) &&
    !/CriOS|FxiOS|EdgiOS|OPiOS/.test(navigator.userAgent)
  );
}

export function supportsBeforeInstallPrompt() {
  return "onbeforeinstallprompt" in window;
}

export function isAndroidDevice() {
  return /Android/.test(navigator.userAgent);
}

export function isAndroidChrome() {
  return (
    isAndroidDevice() &&
    /Chrome/.test(navigator.userAgent) &&
    !/\bwv\b|Version\/4\.0|EdgA|OPR|SamsungBrowser/.test(navigator.userAgent)
  );
}

export function isDesktopChrome() {
  return (
    /Chrome/.test(navigator.userAgent) &&
    !/Android|iPad|iPhone|iPod|Edg|OPR|SamsungBrowser/.test(navigator.userAgent)
  );
}
