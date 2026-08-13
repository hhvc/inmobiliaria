import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";

import app, { db } from "../../firebase/config";
import { normalizeConsortiumNotificationSettings } from "../utils/consorcioNotification.helpers";

const functions = getFunctions(app, "southamerica-east1");
const timestampMillis = (value) => value?.toMillis?.() || Number(value?.seconds || 0) * 1000 || 0;

const settingsRef = (inmobiliariaId, consortiumId) => doc(
  db,
  "inmobiliarias",
  inmobiliariaId,
  "condominium_notification_settings",
  consortiumId,
);

const communicationCollection = (inmobiliariaId) => collection(
  db,
  "inmobiliarias",
  inmobiliariaId,
  "condominium_communications",
);

const consentCollection = (inmobiliariaId) => collection(
  db,
  "inmobiliarias",
  inmobiliariaId,
  "condominium_communication_consents",
);

export const getConsortiumNotificationSettings = async (inmobiliariaId, consortiumId) => {
  if (!inmobiliariaId || !consortiumId) return normalizeConsortiumNotificationSettings();
  const snap = await getDoc(settingsRef(inmobiliariaId, consortiumId));
  const raw = snap.exists() ? snap.data() : {};
  return {
    ...normalizeConsortiumNotificationSettings(raw),
    authorizedByEmail: raw.authorizedByEmail || "",
    authorizedAt: raw.authorizedAt || null,
    consentVersion: raw.consentVersion || "",
  };
};

export const saveConsortiumNotificationSettings = async (
  inmobiliariaId,
  consortiumId,
  value,
) => {
  const callable = httpsCallable(functions, "consortiumSaveNotificationSettings");
  const result = await callable({
    inmobiliariaId,
    consortiumId,
    settings: normalizeConsortiumNotificationSettings(value),
    authorizationAccepted: value.authorizationAccepted === true,
  });
  return result.data?.settings || normalizeConsortiumNotificationSettings();
};

export const getConsortiumCommunications = async (
  inmobiliariaId,
  { consortiumId = "", periodId = "", unitId = "", limit = 300 } = {},
) => {
  if (!inmobiliariaId) return [];
  const source = unitId
    ? query(communicationCollection(inmobiliariaId), where("unitId", "==", unitId))
    : periodId
      ? query(communicationCollection(inmobiliariaId), where("periodId", "==", periodId))
      : communicationCollection(inmobiliariaId);
  const snap = await getDocs(source);
  return snap.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .filter((item) => !consortiumId || item.consortiumId === consortiumId)
    .sort((a, b) => timestampMillis(b.createdAt) - timestampMillis(a.createdAt))
    .slice(0, Math.max(1, Number(limit) || 300));
};

export const getConsortiumCommunicationConsents = async (
  inmobiliariaId,
  consortiumId,
) => {
  if (!inmobiliariaId || !consortiumId) return [];
  const snap = await getDocs(query(
    consentCollection(inmobiliariaId),
    where("consortiumId", "==", consortiumId),
  ));
  return snap.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .sort((a, b) => timestampMillis(b.createdAt) - timestampMillis(a.createdAt));
};

export const sendConsortiumCommunications = async (inmobiliariaId, obligationIds) => {
  const callable = httpsCallable(functions, "consortiumSendCommunications", {
    timeout: 540000,
  });
  const result = await callable({ inmobiliariaId, obligationIds });
  return result.data;
};

export const previewConsortiumAutomation = async (
  inmobiliariaId,
  consortiumId,
  dateKey,
) => {
  const callable = httpsCallable(functions, "consortiumPreviewAutomation", {
    timeout: 120000,
  });
  const result = await callable({ inmobiliariaId, consortiumId, dateKey });
  return result.data;
};

export const runConsortiumAutomation = async (inmobiliariaId, consortiumId) => {
  const callable = httpsCallable(functions, "consortiumRunConsortiumAutomation", {
    timeout: 540000,
  });
  const result = await callable({ inmobiliariaId, consortiumId, confirmed: true });
  return result.data;
};
