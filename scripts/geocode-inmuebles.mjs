import fs from "node:fs";
import path from "node:path";

import admin from "firebase-admin";

const APPLY = process.argv.includes("--apply");
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const WAIT_BETWEEN_REQUESTS_MS = 1100;

const loadEnvFiles = () => {
  [".env.local", ".env"].forEach((fileName) => {
    const filePath = path.resolve(fileName);
    if (!fs.existsSync(filePath)) return;

    fs.readFileSync(filePath, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => !line.startsWith("#"))
      .forEach((line) => {
        const equalIndex = line.indexOf("=");
        if (equalIndex < 1) return;
        const key = line.slice(0, equalIndex).trim();
        if (process.env[key] !== undefined) return;
        process.env[key] = line
          .slice(equalIndex + 1)
          .trim()
          .replace(/^["']|["']$/g, "");
      });
  });
};

const initializeFirebaseAdmin = () => {
  if (admin.apps.length > 0) return admin.app();

  const serviceAccountPath =
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
    path.resolve(".secrets", "firebase-service-account.json");
  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = JSON.parse(
      fs.readFileSync(serviceAccountPath, "utf8"),
    );
    return admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id,
    });
  }

  return admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId:
      process.env.VITE_FIREBASE_PROJECT_ID ||
      process.env.GOOGLE_CLOUD_PROJECT ||
      process.env.GCLOUD_PROJECT,
  });
};

const wait = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const finiteCoordinate = (value, min, max) => {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max
    ? number
    : null;
};

const hasCoordinates = (inmueble = {}) => {
  const direccion = inmueble.direccion || {};
  const latitude = finiteCoordinate(
    direccion.lat ?? direccion.latitude ?? inmueble.lat ?? inmueble.latitude,
    -90,
    90,
  );
  const longitude = finiteCoordinate(
    direccion.lng ??
      direccion.longitude ??
      inmueble.lng ??
      inmueble.longitude,
    -180,
    180,
  );
  return latitude !== null && longitude !== null;
};

const buildAddressQuery = (inmueble = {}) => {
  const direccion = inmueble.direccion || {};
  return [
    [direccion.calle, direccion.numero].filter(Boolean).join(" "),
    direccion.barrio,
    direccion.ciudad,
    direccion.provincia || "Córdoba",
    direccion.pais || "Argentina",
  ]
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .join(", ");
};

const searchAddress = async (query) => {
  if (query.length < 5) return [];
  const url = new URL(NOMINATIM_URL);
  url.search = new URLSearchParams({
    q: query,
    format: "jsonv2",
    addressdetails: "1",
    countrycodes: "ar",
    limit: "3",
  }).toString();

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "Accept-Language": "es-AR,es;q=0.9",
      "User-Agent": "ONOProp/1.0 (https://onoprop.com/contacto)",
    },
  });
  if (!response.ok) {
    throw new Error(`Nominatim respondió HTTP ${response.status}`);
  }
  const data = await response.json();
  return Array.isArray(data) ? data : [];
};

const main = async () => {
  loadEnvFiles();
  initializeFirebaseAdmin();
  const db = admin.firestore();
  const inmobiliariasSnapshot = await db.collection("inmobiliarias").get();
  const pending = [];

  for (const inmobiliariaDoc of inmobiliariasSnapshot.docs) {
    const inmueblesSnapshot = await inmobiliariaDoc.ref
      .collection("inmuebles")
      .get();
    inmueblesSnapshot.docs.forEach((inmuebleDoc) => {
      const inmueble = inmuebleDoc.data() || {};
      if (
        inmueble.publicarEnPortal === true &&
        inmueble.deleted !== true &&
        !hasCoordinates(inmueble)
      ) {
        pending.push({
          ref: inmuebleDoc.ref,
          inmobiliariaId: inmobiliariaDoc.id,
          id: inmuebleDoc.id,
          titulo: inmueble.titulo || inmuebleDoc.id,
          query: buildAddressQuery(inmueble),
        });
      }
    });
  }

  console.log(
    `${APPLY ? "MODO APLICAR" : "MODO REVISIÓN"}: ${pending.length} publicaciones sin coordenadas.`,
  );
  let resolved = 0;
  let unresolved = 0;

  for (const [index, item] of pending.entries()) {
    if (index > 0) await wait(WAIT_BETWEEN_REQUESTS_MS);
    const results = await searchAddress(item.query);
    const candidate = results[0];
    const latitude = finiteCoordinate(candidate?.lat, -90, 90);
    const longitude = finiteCoordinate(candidate?.lon, -180, 180);

    console.log(
      JSON.stringify({
        inmobiliariaId: item.inmobiliariaId,
        inmuebleId: item.id,
        titulo: item.titulo,
        query: item.query,
        candidate: candidate?.display_name || "",
        latitude,
        longitude,
        alternatives: Math.max(0, results.length - 1),
      }),
    );

    if (latitude === null || longitude === null) {
      unresolved += 1;
      continue;
    }

    resolved += 1;
    if (APPLY) {
      await item.ref.update({
        "direccion.lat": latitude,
        "direccion.lng": longitude,
        "direccion.precisionMapa": "aproximada",
        geocoding: {
          provider: "OpenStreetMap Nominatim",
          query: item.query,
          displayName: String(candidate.display_name || "").slice(0, 700),
          reviewed: false,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  }

  console.log(
    `Resultado: ${resolved} con candidato; ${unresolved} sin candidato; ${APPLY ? resolved : 0} actualizadas.`,
  );
};

main().catch((error) => {
  console.error("No se pudo completar la geocodificación:", error);
  process.exitCode = 1;
});
