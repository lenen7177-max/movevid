import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useTranslations } from "@/i18n";
import {
  isAndroidChrome,
  isAndroidDevice,
  isDesktopChrome,
  isIosSafari,
  isStandalonePwa,
  supportsBeforeInstallPrompt,
} from "@/lib/pwa.shared";

const INSTALL_TOAST_ID = "pwa-install";
const INSTALL_PROMPT_DISMISSAL_KEY = "pwa-install-prompt-dismissed";
// Avoid repeatedly interrupting users who have chosen to defer installation.
const INSTALL_PROMPT_DISMISSAL_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
const MANUAL_INSTALL_GUIDANCE_DELAY_MS = 3_000;
// Pending removal of the toast after an unmount; a remount (Strict Mode, route change back to
// the studio) cancels it, since a toast id dismissed and re-added at once stays hidden.
let unmountDismissTimer: number | undefined;

// Chromium exposes this non-standard event, but it is not consistently modeled by lib.dom.
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<{ outcome: "accepted" | "dismissed" }>;
};

// Chrome fires beforeinstallprompt once per page load, often while a marketing page (where
// PwaInstaller is not mounted) is showing. PwaPromptCapture is mounted on every route, keeps the
// event (and its preventDefault keeps Chrome's own install bar away), and PwaInstaller uses it.
let capturedPrompt: BeforeInstallPromptEvent | undefined;
let captureListening = false;

export function PwaPromptCapture() {
  useEffect(() => {
    if (captureListening) return;
    captureListening = true;
    window.addEventListener("beforeinstallprompt", (event) => {
      event.preventDefault();
      capturedPrompt = event as BeforeInstallPromptEvent;
    });
    window.addEventListener("appinstalled", () => {
      capturedPrompt = undefined;
    });
  }, []);
  return null;
}

function isInstallPromptDismissed() {
  const dismissedAt = Number(window.localStorage.getItem(INSTALL_PROMPT_DISMISSAL_KEY));
  return Date.now() - dismissedAt < INSTALL_PROMPT_DISMISSAL_DURATION_MS;
}

function dismissInstallPrompt() {
  window.localStorage.setItem(INSTALL_PROMPT_DISMISSAL_KEY, String(Date.now()));
  toast.dismiss(INSTALL_TOAST_ID);
}

export function PwaInstaller() {
  const t = useTranslations("pwa");
  const deferredPrompt = useRef<BeforeInstallPromptEvent | undefined>(undefined);
  const isPromptDismissed = useRef(false);

  useEffect(() => {
    window.clearTimeout(unmountDismissTimer);
    if (isStandalonePwa()) return;

    const wasDismissed = isInstallPromptDismissed();
    const iosSafari = isIosSafari();
    const androidDevice = isAndroidDevice();
    const androidChrome = isAndroidChrome();
    const desktopChrome = isDesktopChrome();
    const supportedChrome = androidChrome || desktopChrome;

    const shouldScheduleManualInstallGuidance =
      supportedChrome && supportsBeforeInstallPrompt() && !wasDismissed;
    isPromptDismissed.current = wasDismissed;

    const dismiss = () => {
      isPromptDismissed.current = true;
      dismissInstallPrompt();
    };

    const showInstallPrompt = () => {
      toast.info(t(androidDevice ? "mobileInstallAvailable" : "installAvailable"), {
        id: INSTALL_TOAST_ID,
        description: t("installDescription"),
        duration: Infinity,
        action: {
          label: t("installAction"),
          onClick: async () => {
            const prompt = deferredPrompt.current;
            if (!prompt) return;

            // An event's prompt() works once.
            deferredPrompt.current = undefined;
            capturedPrompt = undefined;
            const result = await prompt.prompt();
            toast.dismiss(INSTALL_TOAST_ID);

            if (result.outcome === "dismissed") {
              dismiss();
            }
          },
        },
        cancel: {
          label: t("laterAction"),
          onClick: dismiss,
        },
      });
    };

    const showManualInstallGuidance = () => {
      toast.info(t(androidChrome ? "mobileInstallAvailable" : "installAvailable"), {
        id: INSTALL_TOAST_ID,
        description: t(androidChrome ? "androidInstallDescription" : "desktopInstallDescription"),
        duration: Infinity,
        cancel: {
          label: t("laterAction"),
          onClick: dismiss,
        },
      });
    };

    const handleBeforeInstallPrompt = (event: Event) => {
      // Replace the browser's generic promotion with a contextual in-app prompt.
      event.preventDefault();
      if (isPromptDismissed.current) return;

      deferredPrompt.current = event as BeforeInstallPromptEvent;
      showInstallPrompt();
    };

    const handleAppInstalled = () => {
      // Installation may happen through browser chrome instead of this toast.
      deferredPrompt.current = undefined;
      window.localStorage.removeItem(INSTALL_PROMPT_DISMISSAL_KEY);
      toast.dismiss(INSTALL_TOAST_ID);
    };

    if (iosSafari && !wasDismissed) {
      // iOS Safari has no beforeinstallprompt event, so it needs manual instructions.
      toast.info(t("iosInstallAvailable"), {
        id: INSTALL_TOAST_ID,
        description: t("iosInstallDescription"),
        duration: Infinity,
        cancel: {
          label: t("gotItAction"),
          onClick: dismiss,
        },
      });
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    // The event already fired on an earlier page of this visit.
    if (capturedPrompt && !wasDismissed) {
      deferredPrompt.current = capturedPrompt;
      showInstallPrompt();
    }

    const manualInstallGuidanceTimeout = shouldScheduleManualInstallGuidance
      ? window.setTimeout(() => {
          // Chrome may postpone beforeinstallprompt until its engagement criteria are met.
          if (!deferredPrompt.current && !isPromptDismissed.current) {
            showManualInstallGuidance();
          }
        }, MANUAL_INSTALL_GUIDANCE_DELAY_MS)
      : undefined;

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
      if (manualInstallGuidanceTimeout !== undefined) {
        window.clearTimeout(manualInstallGuidanceTimeout);
      }
      // Unmounted on marketing pages: take the toast along, without counting it as dismissed.
      unmountDismissTimer = window.setTimeout(() => toast.dismiss(INSTALL_TOAST_ID), 0);
    };
  }, [t]);

  return null;
}
