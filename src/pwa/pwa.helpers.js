export const PWA_INSTALL_DISMISS_MS = 7 * 24 * 60 * 60 * 1000;

const ONOPROP_PWA_HOSTS = new Set([
  "onoprop.com",
  "www.onoprop.com",
  "inmobiliaria-bcc63.web.app",
  "inmobiliaria-bcc63.firebaseapp.com",
  "localhost",
  "127.0.0.1",
]);

export const isOnopropPwaHost = (hostname = "") => ONOPROP_PWA_HOSTS.has(
  hostname.toString().trim().toLowerCase(),
);

export const isStandalonePwa = ({
  displayModeStandalone = false,
  navigatorStandalone = false,
} = {}) => Boolean(displayModeStandalone || navigatorStandalone);

export const shouldOfferPwaInstall = ({
  dismissedAt = 0,
  now = Date.now(),
  cooldownMs = PWA_INSTALL_DISMISS_MS,
} = {}) => {
  const dismissed = Number(dismissedAt || 0);
  if (!Number.isFinite(dismissed) || dismissed <= 0) return true;
  return Number(now) - dismissed >= cooldownMs;
};
