import {useEffect, useMemo, useState} from "react";

import {
  PWA_INSTALL_DISMISS_MS,
  isOnopropPwaHost,
  isStandalonePwa,
  shouldOfferPwaInstall,
} from "./pwa.helpers";
import {
  PWA_UPDATE_READY_EVENT,
  activatePwaUpdate,
} from "./pwa.service";

const DISMISS_STORAGE_KEY = "onoprop_pwa_install_dismissed_at";

const readDismissedAt = () => {
  try {
    return Number(window.localStorage.getItem(DISMISS_STORAGE_KEY) || 0);
  } catch {
    return 0;
  }
};

const saveDismissedAt = () => {
  try {
    window.localStorage.setItem(DISMISS_STORAGE_KEY, Date.now().toString());
  } catch {
    // La instalación sigue funcionando aunque el navegador bloquee localStorage.
  }
};

const PwaInstallPrompt = () => {
  const [installEvent, setInstallEvent] = useState(null);
  const [updateRegistration, setUpdateRegistration] = useState(null);
  const [message, setMessage] = useState("");

  const eligibleHost = useMemo(() => (
    typeof window !== "undefined" && isOnopropPwaHost(window.location.hostname)
  ), []);

  useEffect(() => {
    if (!eligibleHost) return undefined;

    const standalone = isStandalonePwa({
      displayModeStandalone: window.matchMedia?.("(display-mode: standalone)")
        ?.matches,
      navigatorStandalone: window.navigator.standalone === true,
    });

    const handleInstallPrompt = (event) => {
      event.preventDefault();
      if (standalone || !shouldOfferPwaInstall({
        dismissedAt: readDismissedAt(),
      })) return;
      setInstallEvent(event);
    };
    const handleInstalled = () => {
      setInstallEvent(null);
      setMessage("ONO Prop quedó instalada en tu dispositivo.");
    };
    const handleUpdate = (event) => {
      setUpdateRegistration(event.detail?.registration || null);
    };

    window.addEventListener("beforeinstallprompt", handleInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);
    window.addEventListener(PWA_UPDATE_READY_EVENT, handleUpdate);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
      window.removeEventListener(PWA_UPDATE_READY_EVENT, handleUpdate);
    };
  }, [eligibleHost]);

  const handleInstall = async () => {
    if (!installEvent) return;

    try {
      await installEvent.prompt();
      const choice = await installEvent.userChoice;
      if (choice?.outcome !== "accepted") saveDismissedAt();
      setInstallEvent(null);
    } catch {
      setMessage("No pudimos abrir la instalación. Usá el menú del navegador.");
    }
  };

  const handleDismiss = () => {
    saveDismissedAt();
    setInstallEvent(null);
  };

  const handleUpdate = () => {
    if (!activatePwaUpdate(updateRegistration)) {
      setMessage("La actualización se aplicará al volver a abrir ONO Prop.");
      setUpdateRegistration(null);
    }
  };

  if (!eligibleHost || (!installEvent && !updateRegistration && !message)) {
    return null;
  }

  return (
    <div
      className="position-fixed bottom-0 start-50 translate-middle-x w-100 p-3"
      style={{zIndex: 1080, maxWidth: "620px"}}
      role="status"
      aria-live="polite"
    >
      <div className="card border-primary-subtle shadow-lg">
        <div className="card-body d-flex gap-3 align-items-start">
          <img
            src="/pwa/icon-192.png"
            alt=""
            width="52"
            height="52"
            className="rounded-3 border flex-shrink-0"
          />
          <div className="flex-grow-1">
            {updateRegistration ? (
              <>
                <div className="fw-semibold">Hay una nueva versión de ONO Prop</div>
                <p className="small text-muted mb-3">
                  Actualizá ahora para usar las últimas mejoras.
                </p>
                <div className="d-flex flex-wrap gap-2">
                  <button type="button" className="btn btn-primary btn-sm" onClick={handleUpdate}>
                    Actualizar ahora
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm"
                    onClick={() => setUpdateRegistration(null)}
                  >
                    Más tarde
                  </button>
                </div>
              </>
            ) : installEvent ? (
              <>
                <div className="fw-semibold">Instalar ONO Prop</div>
                <p className="small text-muted mb-3">
                  Accedé desde tu pantalla de inicio sin abrir el navegador.
                </p>
                <div className="d-flex flex-wrap gap-2">
                  <button type="button" className="btn btn-primary btn-sm" onClick={handleInstall}>
                    Instalar
                  </button>
                  <button type="button" className="btn btn-outline-secondary btn-sm" onClick={handleDismiss}>
                    Ahora no
                  </button>
                </div>
              </>
            ) : (
              <div className="small">{message}</div>
            )}
          </div>
          {message && !installEvent && !updateRegistration && (
            <button
              type="button"
              className="btn-close"
              aria-label="Cerrar"
              onClick={() => setMessage("")}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default PwaInstallPrompt;
