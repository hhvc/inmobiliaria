// firebase/config.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
  getToken,
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

// INICIALIZACIÓN
const app = initializeApp(firebaseConfig);
// 🔥 ACTIVAR MODO DEPURACIÓN SOLO EN LOCALHOST
if (typeof window !== "undefined" && window.location.hostname === "localhost") {
  self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  console.log("🔧 Modo depuración de App Check activado para localhost.");
}
const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

console.log("✅ Firebase configurado:", {
  appName: app.name,
  projectId: app.options.projectId,
  auth: !!auth,
});

// 🚀 PROMESA GLOBAL para App Check Ready
let appCheck;
let appCheckReadyPromise = Promise.resolve();

if (typeof window !== "undefined") {
  const appCheckSiteKey = import.meta.env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY;

  if (!appCheckSiteKey) {
    console.error(
      "❌ VITE_RECAPTCHA_ENTERPRISE_SITE_KEY no definida. App Check no se inicializará."
    );
  } else {
    appCheck = initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(appCheckSiteKey),
      isTokenAutoRefreshEnabled: true,
    });
    console.log("✅ Firebase App Check inicializado con reCAPTCHA Enterprise.");

    // 🔥 PROMESA CORREGIDA: Se elimina el parámetro 'reject' no utilizado
    appCheckReadyPromise = new Promise((resolve) => {
      getToken(appCheck, false)
        .then((tokenResult) => {
          console.log(
            "✅ Primer token de App Check obtenido. App Check está LISTO."
          );
          resolve({ token: tokenResult.token, success: true });
        })
        .catch((error) => {
          console.error(
            "❌ Error obteniendo el primer token de App Check:",
            error
          );
          // 🔥 Aún resolvemos la promesa, pero con un estado de fallo
          resolve({ token: null, success: false, error: error.message });
        });
    });
  }
}

export { auth };
export const analytics =
  typeof window !== "undefined" ? getAnalytics(app) : null;
export default app;

// 🔥 EXPORTAR la promesa (ahora devuelve un objeto con más información)
export { appCheckReadyPromise };
