// firebase/config.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
// 🚀 NUEVO: Importar App Check y su proveedor
import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
} from "firebase/app-check";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// INICIALIZACIÓN MEJORADA
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
export const db = getFirestore(app);

// TEMPORAL: Hacer auth global para diagnóstico
if (typeof window !== "undefined") {
  window._firebaseAuth = auth;
}

console.log("✅ Firebase configurado:", {
  appName: app.name,
  projectId: app.options.projectId,
  auth: !!auth,
});

// 🚀 NUEVO: Inicializar Firebase App Check
if (typeof window !== "undefined") {
  // Aquí la clave de App Check **DEBE** ser la misma clave de reCAPTCHA Enterprise que usas en tu index.html.
  const appCheckSiteKey = import.meta.env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY;

  if (!appCheckSiteKey) {
    console.error(
      "❌ VITE_RECAPTCHA_ENTERPRISE_SITE_KEY no definida para App Check. App Check no se inicializará."
    );
  } else {
    initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(appCheckSiteKey),
      isTokenAutoRefreshEnabled: true, // Para que App Check refresque sus tokens automáticamente
    });
    console.log("✅ Firebase App Check inicializado con reCAPTCHA Enterprise.");
  }
}

export { auth };
export const analytics =
  typeof window !== "undefined" ? getAnalytics(app) : null;
export default app;
