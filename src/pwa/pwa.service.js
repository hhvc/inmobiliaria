import {isOnopropPwaHost} from "./pwa.helpers";

export const PWA_UPDATE_READY_EVENT = "onoprop:pwa-update-ready";

let reloadAfterUpdate = false;
let controllerListenerRegistered = false;

const announceUpdate = (registration) => {
  window.dispatchEvent(new CustomEvent(PWA_UPDATE_READY_EVENT, {
    detail: {registration},
  }));
};

const watchRegistration = (registration) => {
  if (registration.waiting && navigator.serviceWorker.controller) {
    announceUpdate(registration);
  }

  registration.addEventListener("updatefound", () => {
    const worker = registration.installing;
    if (!worker) return;

    worker.addEventListener("statechange", () => {
      if (worker.state === "installed" && navigator.serviceWorker.controller) {
        announceUpdate(registration);
      }
    });
  });
};

export const registerPwaServiceWorker = () => {
  if (
    !import.meta.env.PROD ||
    !("serviceWorker" in navigator) ||
    !isOnopropPwaHost(window.location.hostname)
  ) return;

  if (!controllerListenerRegistered) {
    controllerListenerRegistered = true;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!reloadAfterUpdate) return;
      reloadAfterUpdate = false;
      window.location.reload();
    });
  }

  const register = async () => {
    try {
      const registration = await navigator.serviceWorker.register("/sw.js", {
        scope: "/",
      });
      watchRegistration(registration);
      registration.update().catch(() => undefined);
    } catch (error) {
      console.warn("No se pudo registrar la experiencia instalable:", error);
    }
  };

  if (document.readyState === "complete") register();
  else window.addEventListener("load", register, {once: true});
};

export const activatePwaUpdate = (registration) => {
  if (!registration?.waiting) return false;
  reloadAfterUpdate = true;
  registration.waiting.postMessage({type: "SKIP_WAITING"});
  return true;
};
