import {
  addDoc,
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";

import { auth, db } from "../../firebase/config";
import {
  buildSharedPublicationId,
  isActivePromotion,
  mergeFriendPublication,
  normalizeAgencySlug,
} from "../utils/agencyNetwork.helpers";

const branchesRef = (agencyId) => collection(db, "inmobiliarias", agencyId, "branches");
const branchRef = (agencyId, branchId) => doc(db, "inmobiliarias", agencyId, "branches", branchId);
const groupsRef = collection(db, "agency_friend_groups");
const membersRef = collection(db, "agency_friend_group_members");
const localPublicationsRef = (agencyId) => (
  collection(db, "inmobiliarias", agencyId, "shared_publications")
);

const mapSnap = (snap) => ({ id: snap.id, ...(snap.data() || {}) });

export const getPublicAgenciesForNetwork = async () => {
  const snap = await getDocs(query(
    collection(db, "inmobiliarias"),
    where("activa", "==", true),
  ));
  return snap.docs.map(mapSnap).sort((a, b) => (
    (a.nombre || a.razonSocial || "").localeCompare(b.nombre || b.razonSocial || "")
  ));
};

export const getInmobiliariaBranches = async (agencyId, { includeInactive = false } = {}) => {
  if (!agencyId) return [];
  const snap = await getDocs(includeInactive
    ? branchesRef(agencyId)
    : query(branchesRef(agencyId), where("active", "==", true)));
  return snap.docs
    .map(mapSnap)
    .filter((item) => includeInactive || item.active !== false)
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
};

export const getPublicBranchBySlug = async (agencyId, slug) => {
  if (!agencyId || !slug) return null;
  const snap = await getDocs(query(
    branchesRef(agencyId),
    where("slug", "==", slug),
    where("active", "==", true),
  ));
  const branch = snap.docs.map(mapSnap).find((item) => item.active !== false);
  return branch || null;
};

export const saveInmobiliariaBranch = async (agencyId, branch = {}) => {
  if (!agencyId) throw new Error("Falta la inmobiliaria.");
  const name = (branch.name || "").trim();
  const slug = normalizeAgencySlug(branch.slug || name);
  if (!name || !slug) throw new Error("La sucursal necesita nombre y URL.");
  const slugSnap = await getDocs(query(branchesRef(agencyId), where("slug", "==", slug)));
  if (slugSnap.docs.some((item) => item.id !== branch.id)) {
    throw new Error("Ya existe otra sucursal con esa URL corta.");
  }
  const payload = {
    agencyId,
    name,
    slug,
    active: branch.active !== false,
    address: (branch.address || "").trim(),
    contact: {
      email: (branch.contact?.email || "").trim(),
      telefono: (branch.contact?.telefono || "").trim(),
      whatsapp: (branch.contact?.whatsapp || "").trim(),
    },
    branding: {
      heroImageUrl: (branch.branding?.heroImageUrl || "").trim(),
      primaryColor: (branch.branding?.primaryColor || "").trim(),
    },
    updatedAt: serverTimestamp(),
    updatedBy: auth.currentUser?.uid || "",
  };
  if (branch.id) {
    await setDoc(branchRef(agencyId, branch.id), payload, { merge: true });
    return branch.id;
  }
  const created = await addDoc(branchesRef(agencyId), {
    ...payload,
    createdAt: serverTimestamp(),
    createdBy: auth.currentUser?.uid || "",
  });
  return created.id;
};

export const archiveInmobiliariaBranch = (agencyId, branchId) => updateDoc(
  branchRef(agencyId, branchId),
  { active: false, updatedAt: serverTimestamp(), updatedBy: auth.currentUser?.uid || "" },
);

export const getAgencyFriendMemberships = async (agencyId) => {
  if (!agencyId) return [];
  const snap = await getDocs(query(membersRef, where("agencyId", "==", agencyId)));
  return snap.docs.map(mapSnap);
};

export const getAgencyFriendGroups = async (agencyId) => {
  const memberships = await getAgencyFriendMemberships(agencyId);
  const accepted = memberships.filter((item) => ["owner", "accepted"].includes(item.status));
  const groups = await Promise.all(accepted.map(async (membership) => {
    const snap = await getDoc(doc(db, "agency_friend_groups", membership.groupId));
    return snap.exists() ? { ...mapSnap(snap), membership } : null;
  }));
  return groups.filter((group) => group?.active !== false);
};

export const getFriendGroupMembers = async (groupId) => {
  if (!groupId) return [];
  const snap = await getDocs(query(membersRef, where("groupId", "==", groupId)));
  return snap.docs.map(mapSnap);
};

export const createAgencyFriendGroup = async ({ agencyId, agencyName, name }) => {
  const safeName = (name || "").trim();
  if (!agencyId || !safeName) throw new Error("Indicá un nombre para el grupo.");
  const group = await addDoc(groupsRef, {
    name: safeName,
    ownerAgencyId: agencyId,
    ownerAgencyName: agencyName || "",
    active: true,
    createdAt: serverTimestamp(),
    createdBy: auth.currentUser?.uid || "",
    updatedAt: serverTimestamp(),
  });
  await setDoc(doc(db, "agency_friend_group_members", `${group.id}_${agencyId}`), {
    groupId: group.id,
    ownerAgencyId: agencyId,
    agencyId,
    agencyName: agencyName || "",
    status: "owner",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return group.id;
};

export const inviteAgencyToFriendGroup = async ({ group, agency }) => {
  if (!group?.id || !agency?.id) throw new Error("Seleccioná una inmobiliaria.");
  if (group.ownerAgencyId === agency.id) throw new Error("La inmobiliaria ya es titular del grupo.");
  await setDoc(doc(db, "agency_friend_group_members", `${group.id}_${agency.id}`), {
    groupId: group.id,
    groupName: group.name || "",
    ownerAgencyId: group.ownerAgencyId,
    ownerAgencyName: group.ownerAgencyName || "",
    agencyId: agency.id,
    agencyName: agency.nombre || agency.razonSocial || "",
    status: "pending",
    invitedBy: auth.currentUser?.uid || "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }, { merge: true });
};

export const answerAgencyFriendInvitation = (membershipId, status) => {
  if (!["accepted", "rejected"].includes(status)) throw new Error("Respuesta inválida.");
  return updateDoc(doc(db, "agency_friend_group_members", membershipId), {
    status,
    answeredAt: serverTimestamp(),
    answeredBy: auth.currentUser?.uid || "",
    updatedAt: serverTimestamp(),
  });
};

export const removeAgencyFriendMember = (membershipId) => (
  deleteDoc(doc(db, "agency_friend_group_members", membershipId))
);

export const getSharedPublicationOverrides = async (agencyId) => {
  if (!agencyId) return [];
  const snap = await getDocs(localPublicationsRef(agencyId));
  return snap.docs.map(mapSnap);
};

export const saveSharedPublicationOverride = async ({ agencyId, ownerAgencyId, inmuebleId, patch }) => {
  const id = buildSharedPublicationId(ownerAgencyId, inmuebleId);
  if (!agencyId || !ownerAgencyId || !inmuebleId) throw new Error("Publicación compartida inválida.");
  await setDoc(doc(localPublicationsRef(agencyId), id), {
    hostAgencyId: agencyId,
    ownerAgencyId,
    inmuebleId,
    ...patch,
    updatedAt: serverTimestamp(),
    updatedBy: auth.currentUser?.uid || "",
  }, { merge: true });
};

export const getFriendSharedPublications = async ({
  agencyId,
  agencySlug,
  branchId = "",
  branchSlug = "",
  includeHidden = false,
}) => {
  if (!agencyId) return [];
  const groups = await getAgencyFriendGroups(agencyId);
  const groupIds = groups.map((group) => group.id);
  if (!groupIds.length) return [];

  const snapshots = await Promise.all(groupIds.map((groupId) => getDocs(query(
    collectionGroup(db, "inmuebles"),
    where("sharing.friendGroupIds", "array-contains", groupId),
    where("deleted", "==", false),
    where("estado", "==", "activo"),
    where("publicarEnPortal", "==", true),
  ))));
  const deduped = new Map();
  snapshots.forEach((snap) => snap.docs.forEach((item) => {
    const inmueble = mapSnap(item);
    const ownerAgencyId = inmueble.ownerInmobiliariaId || inmueble.inmobiliariaId;
    if (
      ownerAgencyId !== agencyId &&
      inmueble.estado === "activo" &&
      inmueble.deleted !== true &&
      inmueble.publicarEnPortal === true
    ) deduped.set(`${ownerAgencyId}_${item.id}`, inmueble);
  }));

  const overrides = await getSharedPublicationOverrides(agencyId);
  const overridesById = new Map(overrides.map((item) => [item.id, item]));
  return [...deduped.entries()].map(([id, inmueble]) => {
    const override = overridesById.get(id) || {};
    if (!includeHidden && override.hiddenOnMain === true && !branchId) return null;
    if (branchId && !(override.branchIds || []).includes(branchId)) return null;
    return mergeFriendPublication({ inmueble, override, agencySlug, branchSlug });
  }).filter(Boolean);
};

export const isSharedPublicationHighlighted = (override) => isActivePromotion(override?.promotion);
