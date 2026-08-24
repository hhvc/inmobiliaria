import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { deleteObject, ref as storageRef, uploadBytes } from "firebase/storage";
import { getFunctions, httpsCallable } from "firebase/functions";

import app, { auth, db, storage } from "../../firebase/config";
import { assertInmobiliariaActiva } from "../../inmobiliaria/services/inmobiliaria.service";
import {
  CONSORTIUM_PORTAL_REQUIRED_FILE_SECTIONS,
  CONSORTIUM_PORTAL_SECTION_IDS,
  createDefaultConsortiumPortalSections,
  normalizeConsortiumPortalSections,
} from "../utils/consorcioPortalInformation.constants";
import {
  isConsortiumDocumentFileValid,
  normalizeConsortiumEmails,
  safeConsortiumFileName,
} from "../utils/consorcioPortal.helpers";

const functions = getFunctions(app, "southamerica-east1");
const SETTINGS_COLLECTION = "condominium_portal_settings";
const RESOURCES_COLLECTION = "condominium_portal_resources";
const UNITS_COLLECTION = "condominium_units";

const cleanText = (value = "", maxLength = 1000) => (
  value?.toString?.().trim().replace(/\s+/g, " ").slice(0, maxLength) || ""
);
const cleanLongText = (value = "", maxLength = 10000) => (
  value?.toString?.().trim().slice(0, maxLength) || ""
);
const cleanDate = (value = "") => (
  /^\d{4}-\d{2}-\d{2}$/.test(value || "") ? value : ""
);
const cleanUrl = (value = "") => {
  const normalized = cleanText(value, 1000);
  if (!normalized) return "";
  try {
    const parsed = new URL(normalized);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.toString() : "";
  } catch {
    return "";
  }
};
const timestampMillis = (value) => (
  value?.toMillis?.() || Number(value?.seconds || 0) * 1000 || 0
);
const agencyCollection = (inmobiliariaId, name) => (
  collection(db, "inmobiliarias", inmobiliariaId, name)
);
const agencyDoc = (inmobiliariaId, name, id) => (
  doc(db, "inmobiliarias", inmobiliariaId, name, id)
);
const currentUserOrThrow = () => {
  const user = auth.currentUser;
  if (!user?.uid) throw new Error("Usuario no autenticado.");
  return user;
};
const assertAgency = async (inmobiliariaId) => {
  currentUserOrThrow();
  await assertInmobiliariaActiva(inmobiliariaId);
};

const normalizeSettings = (value = {}) => ({
  id: cleanText(value.id, 128),
  schemaVersion: 1,
  inmobiliariaId: cleanText(value.inmobiliariaId, 128),
  ownerInmobiliariaId: cleanText(value.ownerInmobiliariaId, 128),
  consortiumId: cleanText(value.consortiumId, 128),
  sections: normalizeConsortiumPortalSections(
    value.sections || createDefaultConsortiumPortalSections(),
  ),
});

const getAggregatedAccessEmails = (units = [], field = "portalEmails") => (
  normalizeConsortiumEmails(units
    .filter((unit) => unit.active !== false && unit.deleted !== true)
    .flatMap((unit) => {
      if (Array.isArray(unit[field])) return unit[field];
      if (field === "ownerPortalEmails") {
        return [unit.ownerEmail, ...(unit.manualOwnerPortalEmails || [])];
      }
      if (field === "occupantPortalEmails") {
        return [unit.occupantEmail, ...(unit.manualPortalEmails || [])];
      }
      return unit.portalEmails || [];
    }))
);

export const getConsortiumPortalSettings = async (inmobiliariaId, consortiumId) => {
  if (!inmobiliariaId || !consortiumId) return normalizeSettings({});
  const snapshot = await getDoc(agencyDoc(
    inmobiliariaId,
    SETTINGS_COLLECTION,
    consortiumId,
  ));
  return normalizeSettings(snapshot.exists() ? snapshot.data() : {
    id: consortiumId,
    inmobiliariaId,
    ownerInmobiliariaId: inmobiliariaId,
    consortiumId,
  });
};

export const saveConsortiumPortalSettings = async ({
  inmobiliariaId,
  consortiumId,
  sections,
}) => {
  await assertAgency(inmobiliariaId);
  const user = currentUserOrThrow();
  const normalizedSections = normalizeConsortiumPortalSections(sections);
  const unitSnapshot = await getDocs(query(
    agencyCollection(inmobiliariaId, UNITS_COLLECTION),
    where("consortiumId", "==", consortiumId),
  ));
  const units = unitSnapshot.docs.map((item) => ({
    id: item.id,
    _ref: item.ref,
    ...item.data(),
  }));
  const ownerPortalEmails = getAggregatedAccessEmails(units, "ownerPortalEmails");
  const occupantPortalEmails = getAggregatedAccessEmails(units, "occupantPortalEmails")
    .filter((email) => !ownerPortalEmails.includes(email));
  const portalEmails = normalizeConsortiumEmails([
    ...ownerPortalEmails,
    ...occupantPortalEmails,
  ]);
  const settingsRef = agencyDoc(inmobiliariaId, SETTINGS_COLLECTION, consortiumId);
  const consortiumRef = agencyDoc(inmobiliariaId, "condominiums", consortiumId);
  const resources = await getDocs(query(
    agencyCollection(inmobiliariaId, RESOURCES_COLLECTION),
    where("consortiumId", "==", consortiumId),
  ));
  const batch = writeBatch(db);
  batch.set(settingsRef, {
    id: consortiumId,
    schemaVersion: 1,
    inmobiliariaId,
    ownerInmobiliariaId: inmobiliariaId,
    consortiumId,
    sections: normalizedSections,
    updatedBy: user.uid,
    updatedAt: serverTimestamp(),
  }, { merge: true });
  batch.update(consortiumRef, {
    portalEmails,
    ownerPortalEmails,
    occupantPortalEmails,
    updatedBy: user.uid,
    updatedAt: serverTimestamp(),
  });
  units.forEach((unit) => {
    if (unit.active === false || unit.deleted === true) return;
    const unitOwnerEmails = getAggregatedAccessEmails([unit], "ownerPortalEmails");
    const unitOccupantEmails = getAggregatedAccessEmails([unit], "occupantPortalEmails")
      .filter((email) => !unitOwnerEmails.includes(email));
    batch.update(unit._ref, {
      ownerPortalEmails: unitOwnerEmails,
      occupantPortalEmails: unitOccupantEmails,
      portalEmails: normalizeConsortiumEmails([
        ...unitOwnerEmails,
        ...unitOccupantEmails,
      ]),
      updatedBy: user.uid,
      updatedAt: serverTimestamp(),
    });
  });
  resources.docs.forEach((resourceSnapshot) => {
    const section = resourceSnapshot.data().section;
    if (!CONSORTIUM_PORTAL_SECTION_IDS.includes(section)) return;
    batch.update(resourceSnapshot.ref, {
      visibility: normalizedSections[section].visibility,
      updatedBy: user.uid,
      updatedAt: serverTimestamp(),
    });
  });
  await batch.commit();
  return normalizeSettings({
    id: consortiumId,
    inmobiliariaId,
    ownerInmobiliariaId: inmobiliariaId,
    consortiumId,
    sections: normalizedSections,
  });
};

export const getConsortiumPortalResources = async (
  inmobiliariaId,
  consortiumId,
  { section = "", publishedOnly = false } = {},
) => {
  if (!inmobiliariaId || !consortiumId) return [];
  const constraints = [where("consortiumId", "==", consortiumId)];
  if (section) constraints.push(where("section", "==", section));
  if (publishedOnly) {
    constraints.push(where("published", "==", true));
    constraints.push(where("archived", "==", false));
  }
  const snapshot = await getDocs(query(
    agencyCollection(inmobiliariaId, RESOURCES_COLLECTION),
    ...constraints,
  ));
  return snapshot.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .filter((item) => item.archived !== true)
    .sort((first, second) => {
      const firstDate = first.meetingDate || first.expiresAt || first.issuedDate || "";
      const secondDate = second.meetingDate || second.expiresAt || second.issuedDate || "";
      return secondDate.localeCompare(firstDate)
        || timestampMillis(second.updatedAt) - timestampMillis(first.updatedAt);
    });
};

const sanitizeResource = (value = {}, settings = {}) => {
  const section = CONSORTIUM_PORTAL_SECTION_IDS.includes(value.section)
    ? value.section
    : "emergency_contacts";
  return {
    schemaVersion: 1,
    section,
    visibility: settings.sections?.[section]?.visibility === "all" ? "all" : "owners",
    title: cleanText(value.title, 220),
    summary: cleanText(value.summary, 1000),
    body: cleanLongText(value.body, 12000),
    phone: cleanText(value.phone, 80),
    email: normalizeConsortiumEmails([value.email])[0] || "",
    url: cleanUrl(value.url),
    providerName: cleanText(value.providerName, 220),
    policyNumber: cleanText(value.policyNumber, 120),
    coverage: cleanLongText(value.coverage, 4000),
    memberRole: cleanText(value.memberRole, 160),
    issuedDate: cleanDate(value.issuedDate),
    effectiveDate: cleanDate(value.effectiveDate),
    expiresAt: cleanDate(value.expiresAt),
    meetingDate: cleanDate(value.meetingDate),
    published: value.published !== false,
    archived: false,
  };
};

export const saveConsortiumPortalResource = async ({
  inmobiliariaId,
  consortiumId,
  resourceId = "",
  value,
}) => {
  await assertAgency(inmobiliariaId);
  const user = currentUserOrThrow();
  const settings = await getConsortiumPortalSettings(inmobiliariaId, consortiumId);
  const payload = sanitizeResource(value, settings);
  if (!payload.title) throw new Error("Ingresá un título o nombre.");
  if (payload.section === "regulations" && !payload.url) {
    throw new Error("Ingresá un enlace válido que comience con http:// o https://.");
  }
  const resourceRef = resourceId
    ? agencyDoc(inmobiliariaId, RESOURCES_COLLECTION, resourceId)
    : doc(agencyCollection(inmobiliariaId, RESOURCES_COLLECTION));
  const currentSnapshot = resourceId ? await getDoc(resourceRef) : null;
  if (resourceId && !currentSnapshot?.exists()) throw new Error("El contenido no existe.");
  const current = currentSnapshot?.data() || {};
  const file = value.file || null;
  if (file && !isConsortiumDocumentFileValid(file)) {
    throw new Error("Adjuntá un PDF, JPG, PNG o WEBP de hasta 10 MB.");
  }
  if (!file && !current.storagePath &&
    CONSORTIUM_PORTAL_REQUIRED_FILE_SECTIONS.has(payload.section)) {
    throw new Error("Adjuntá el documento correspondiente.");
  }

  let nextFile = {
    fileName: current.fileName || "",
    originalFileName: current.originalFileName || "",
    storagePath: current.storagePath || "",
    contentType: current.contentType || "",
    size: Number(current.size || 0),
  };
  if (file) {
    const safeName = safeConsortiumFileName(file.name);
    const path = `consorcios/${inmobiliariaId}/${consortiumId}/portal/${payload.section}/${resourceRef.id}/${safeName}`;
    await uploadBytes(storageRef(storage, path), file, {
      contentType: file.type,
      customMetadata: {
        inmobiliariaId,
        consortiumId,
        section: payload.section,
        resourceId: resourceRef.id,
        uploadedBy: user.uid,
      },
    });
    nextFile = {
      fileName: safeName,
      originalFileName: cleanText(file.name, 220),
      storagePath: path,
      contentType: file.type,
      size: Number(file.size || 0),
    };
  }

  try {
    await setDoc(resourceRef, {
      id: resourceRef.id,
      ...payload,
      inmobiliariaId,
      ownerInmobiliariaId: inmobiliariaId,
      consortiumId,
      ...nextFile,
      updatedBy: user.uid,
      updatedAt: serverTimestamp(),
      ...(currentSnapshot?.exists() ? {} : {
        createdBy: user.uid,
        createdAt: serverTimestamp(),
      }),
    }, { merge: true });
    if (file && current.storagePath && current.storagePath !== nextFile.storagePath) {
      await deleteObject(storageRef(storage, current.storagePath)).catch(() => {});
    }
  } catch (error) {
    if (file && nextFile.storagePath !== current.storagePath) {
      await deleteObject(storageRef(storage, nextFile.storagePath)).catch(() => {});
    }
    throw error;
  }
  return resourceRef.id;
};

export const archiveConsortiumPortalResource = async ({
  inmobiliariaId,
  resourceId,
}) => {
  await assertAgency(inmobiliariaId);
  const user = currentUserOrThrow();
  await updateDoc(agencyDoc(inmobiliariaId, RESOURCES_COLLECTION, resourceId), {
    published: false,
    archived: true,
    archivedBy: user.uid,
    archivedAt: serverTimestamp(),
    updatedBy: user.uid,
    updatedAt: serverTimestamp(),
  });
};

export const getConsortiumManagedMessages = async ({
  inmobiliariaId,
  consortiumId,
}) => {
  currentUserOrThrow();
  const callable = httpsCallable(functions, "consortiumGetManagedMessages", {
    timeout: 30000,
  });
  const result = await callable({ inmobiliariaId, consortiumId });
  return Array.isArray(result.data?.messages) ? result.data.messages : [];
};
