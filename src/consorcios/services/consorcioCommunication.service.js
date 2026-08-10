import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";

import app, { db } from "../../firebase/config";
import { assertInmobiliariaActiva } from "../../inmobiliaria/services/inmobiliaria.service";
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

export const getConsortiumNotificationSettings = async (inmobiliariaId, consortiumId) => {
  if (!inmobiliariaId || !consortiumId) return normalizeConsortiumNotificationSettings();
  const snap = await getDoc(settingsRef(inmobiliariaId, consortiumId));
  return normalizeConsortiumNotificationSettings(snap.exists() ? snap.data() : {});
};

export const saveConsortiumNotificationSettings = async (
  inmobiliariaId,
  consortiumId,
  value,
) => {
  await assertInmobiliariaActiva(inmobiliariaId);
  const payload = normalizeConsortiumNotificationSettings(value);
  await setDoc(settingsRef(inmobiliariaId, consortiumId), {
    ...payload,
    enabled: false,
    sendOnIssue: false,
    id: consortiumId,
    schemaVersion: 1,
    inmobiliariaId,
    ownerInmobiliariaId: inmobiliariaId,
    consortiumId,
    updatedAt: serverTimestamp(),
  }, { merge: true });
  return { ...payload, enabled: false, sendOnIssue: false };
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

export const sendConsortiumCommunications = async (inmobiliariaId, obligationIds) => {
  const callable = httpsCallable(functions, "consortiumSendCommunications", {
    timeout: 540000,
  });
  const result = await callable({ inmobiliariaId, obligationIds });
  return result.data;
};
