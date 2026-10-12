import { useEffect } from "react";
import { toast } from "sonner";
import { useTranslations } from "@/i18n";

const SERVICE_WORKER_UPDATE_INTERVAL_MS = 60 * 60 * 1000;
const PWA_BUILD_VERSION_URL = "/api/pwa-version";

async function registerVersionedServiceWorker() {
  const response = await fetch(PWA_BUILD_VERSION_URL, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Unable to load the PWA build version: ${response.status}`);
  }

  const { buildId } = (await response.json()) as { buildId: string };
  const serviceWorkerUrl = `/service-worker.js?build=${encodeURIComponent(buildId)}`;
  return navigator.serviceWorker.register(serviceWorkerUrl, { updateViaCache: "none" });
}

export function PwaUpdater({
  enabled,
  shouldRegister,
}: {
  enabled: boolean;
  shouldRegister: boolean;
}) {
  const t = useTranslations("pwa");

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (!enabled) {
      navigator.serviceWorker.getRegistration().then((registration) => registration?.unregister());
      return;
    }

    if (!shouldRegister) return;

    let hasExistingController = Boolean(navigator.serviceWorker.controller);
    let isDisposed = false;
    let registration: ServiceWorkerRegistration | undefined;
    let installingWorker: ServiceWorker | undefined;
    let updateInterval: ReturnType<typeof setInterval> | undefined;

    const showUpdatePrompt = () => {
      if (!registration?.waiting || !navigator.serviceWorker.controller) return;

      toast.info(t("updateAvailable"), {
        id: "pwa-update",
        duration: Infinity,
        action: {
          label: t("updateAction"),
          onClick: () => {
            registration?.waiting?.postMessage({ type: "SKIP_WAITING" });
          },
        },
        cancel: {
          label: t("laterAction"),
          onClick: () => {
            toast.dismiss("pwa-update");
          },
        },
      });
    };

    const handleControllerChange = () => {
      // The first install also gains a controller; only reload when replacing an existing worker.
      if (hasExistingController) {
        window.location.reload();
        return;
      }

      hasExistingController = true;
    };

    const handleInstallingWorkerStateChange = () => {
      if (installingWorker?.state === "installed") {
        showUpdatePrompt();
      }
    };

    const handleUpdateFound = () => {
      const worker = registration?.installing;
      if (!worker || worker === installingWorker) return;

      installingWorker?.removeEventListener("statechange", handleInstallingWorkerStateChange);
      installingWorker = worker;
      worker.addEventListener("statechange", handleInstallingWorkerStateChange);
      handleInstallingWorkerStateChange();
    };

    const observeRegistration = (nextRegistration: ServiceWorkerRegistration) => {
      if (registration !== nextRegistration) {
        registration?.removeEventListener("updatefound", handleUpdateFound);
        registration = nextRegistration;
        registration.addEventListener("updatefound", handleUpdateFound);
      }

      handleUpdateFound();
      showUpdatePrompt();
    };

    const checkForUpdate = () => {
      registerVersionedServiceWorker()
        .then((nextRegistration) => {
          if (!isDisposed) {
            observeRegistration(nextRegistration);
          }
        })
        .catch((error: unknown) => {
          if (!isDisposed) {
            console.error("Unable to register PWA service worker", error);
          }
        });
    };

    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);
    checkForUpdate();
    updateInterval = setInterval(checkForUpdate, SERVICE_WORKER_UPDATE_INTERVAL_MS);

    return () => {
      isDisposed = true;
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
      registration?.removeEventListener("updatefound", handleUpdateFound);
      installingWorker?.removeEventListener("statechange", handleInstallingWorkerStateChange);
      if (updateInterval) {
        clearInterval(updateInterval);
      }
    };
  }, [enabled, shouldRegister, t]);

  return null;
}
