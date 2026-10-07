export const GOOGLE_PLAY_DISTRIBUTION = "google_play";

const DISTRIBUTION_PARAM = "app_distribution";
const DISTRIBUTION_SESSION_KEY = "onoprop:app-distribution";

const getBrowserSearch = () => (
  typeof window === "undefined" ? "" : window.location.search
);

const getBrowserSessionStorage = () => {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
};

export const captureAppDistribution = ({
  search = getBrowserSearch(),
  storage = getBrowserSessionStorage(),
} = {}) => {
  const distribution = new URLSearchParams(search || "").get(DISTRIBUTION_PARAM) || "";

  if (distribution === GOOGLE_PLAY_DISTRIBUTION) {
    try {
      storage?.setItem(DISTRIBUTION_SESSION_KEY, distribution);
    } catch {
      // El modo sigue activo para esta carga aunque el almacenamiento no esté disponible.
    }
    return distribution;
  }

  try {
    return storage?.getItem(DISTRIBUTION_SESSION_KEY) || "";
  } catch {
    return "";
  }
};

export const getAppDistribution = (options) => captureAppDistribution(options);

export const isGooglePlayDistribution = (options) => (
  getAppDistribution(options) === GOOGLE_PLAY_DISTRIBUTION
);

export const allowsExternalDigitalCommerce = (options) => (
  !isGooglePlayDistribution(options)
);
