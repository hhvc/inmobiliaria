import crypto from "node:crypto";

import admin from "firebase-admin";
import { HttpsError, onCall } from "firebase-functions/v2/https";

import {
    PORTAL_PERFORMANCE_EVENT_COUNTERS,
    cleanPerformanceText,
    getDateRangeDays,
    getPortalPerformanceDateKey,
    isActivePortalPromotion,
    normalizePerformanceDateKey,
    normalizePerformanceSource,
    serializePerformanceRecord,
} from "./portalPerformance.helpers.js";

if (!admin.apps.length) admin.initializeApp();

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;
const REGION = "southamerica-east1";
const MAX_DASHBOARD_RECORDS = 5000;
const MAX_DASHBOARD_DAYS = 366;

const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");

const getUserData = async (uid) => {
    if (!uid) throw new HttpsError("unauthenticated", "Iniciá sesión para continuar.");
    const snapshot = await db.collection("users").doc(uid).get();
    if (!snapshot.exists) {
        throw new HttpsError("permission-denied", "No encontramos tu perfil de acceso.");
    }
    return snapshot.data() || {};
};

const userHasRole = (userData = {}, roleName = "") => (
    userData.role === roleName ||
    userData.primaryRole === roleName ||
    (Array.isArray(userData.roles) && userData.roles.includes(roleName))
);

const assertCanViewAgencyPerformance = async (uid, inmobiliariaId) => {
    const safeAgencyId = cleanPerformanceText(inmobiliariaId, 128);
    if (!safeAgencyId) throw new HttpsError("invalid-argument", "Falta la inmobiliaria.");

    const userData = await getUserData(uid);
    const isRoot = userHasRole(userData, "root");
    const agencies = Array.isArray(userData.inmobiliarias) ? userData.inmobiliarias : [];

    if (!isRoot && !agencies.includes(safeAgencyId)) {
        throw new HttpsError(
            "permission-denied",
            "No tenés permisos para ver el rendimiento de esta inmobiliaria.",
        );
    }

    return safeAgencyId;
};

const getPublicProperty = async (ownerAgencyId, inmuebleId) => {
    const reference = db.collection("inmobiliarias")
        .doc(ownerAgencyId)
        .collection("inmuebles")
        .doc(inmuebleId);
    const snapshot = await reference.get();
    const property = snapshot.data() || {};

    if (
        !snapshot.exists ||
        property.deleted === true ||
        property.estado !== "activo" ||
        property.publicarEnPortal !== true
    ) {
        throw new HttpsError("not-found", "La publicación ya no está disponible.");
    }

    return property;
};

const getSharedPresentation = async ({
    ownerAgencyId,
    presentationAgencyId,
    inmuebleId,
    property,
}) => {
    if (presentationAgencyId === ownerAgencyId) return null;

    const sharedId = `${ownerAgencyId}_${inmuebleId}`;
    const sharedSnapshot = await db.collection("inmobiliarias")
        .doc(presentationAgencyId)
        .collection("shared_publications")
        .doc(sharedId)
        .get();
    const shared = sharedSnapshot.data() || {};

    if (sharedSnapshot.exists && (shared.hiddenOnMain === true || shared.active === false)) {
        return null;
    }

    const groupIds = Array.isArray(property?.sharing?.friendGroupIds)
        ? property.sharing.friendGroupIds
            .map((groupId) => cleanPerformanceText(groupId, 128))
            .filter(Boolean)
            .slice(0, 20)
        : [];
    if (groupIds.length === 0) return null;

    const membershipSnapshots = await db.getAll(...groupIds.map((groupId) => (
        db.collection("agency_friend_group_members").doc(`${groupId}_${presentationAgencyId}`)
    )));
    const hasAcceptedMembership = membershipSnapshots.some((membershipSnapshot) => {
        const membership = membershipSnapshot.data() || {};
        return membershipSnapshot.exists &&
            membership.agencyId === presentationAgencyId &&
            ["owner", "accepted"].includes(membership.status);
    });

    return hasAcceptedMembership ? shared : null;
};

const getPropertyTitle = (property = {}) => cleanPerformanceText(
    property.titulo || property.title || property.ubicacion || "Inmueble publicado",
    240,
);

const getPropertyOperation = (property = {}) => cleanPerformanceText(
    property.operacion || property.operation || "",
    80,
);

const buildAggregateWrite = ({
    reportingAgencyId,
    ownerAgencyId,
    presentationAgencyId,
    inmuebleId,
    property,
    shared,
    counterKey,
    source,
    requestedBranchId,
    dateKey,
}) => {
    const isFriendPresentation = reportingAgencyId !== ownerAgencyId;
    const allowedFriendBranches = Array.isArray(shared?.branchIds) ? shared.branchIds : [];
    const branchId = isFriendPresentation
        ? (allowedFriendBranches.includes(requestedBranchId) ? requestedBranchId : "")
        : (cleanPerformanceText(property.sucursalId, 128) || "");
    const promoted = isFriendPresentation
        ? isActivePortalPromotion(shared || {})
        : isActivePortalPromotion(property);
    const documentId = sha256([
        dateKey,
        ownerAgencyId,
        inmuebleId,
        source,
        branchId,
        promoted ? "promoted" : "organic",
    ].join("|")).slice(0, 40);
    const reference = db.collection("inmobiliarias")
        .doc(reportingAgencyId)
        .collection("performance_daily")
        .doc(documentId);

    return {
        reference,
        data: {
            dateKey,
            reportingAgencyId,
            ownerAgencyId,
            presentationAgencyId,
            branchId,
            inmuebleId,
            inmuebleSlug: cleanPerformanceText(property.slug || inmuebleId, 180),
            inmuebleTitle: getPropertyTitle(property),
            inmuebleType: cleanPerformanceText(property.tipo || property.type || "", 80),
            inmuebleOperation: getPropertyOperation(property),
            source,
            promoted,
            counters: {
                [counterKey]: FieldValue.increment(1),
            },
            updatedAt: FieldValue.serverTimestamp(),
        },
    };
};

export const portalRecordPerformanceEvent = onCall(
    {
        region: REGION,
        invoker: "public",
        enforceAppCheck: true,
        timeoutSeconds: 30,
    },
    async (request) => {
        const payload = request.data && typeof request.data === "object" ? request.data : {};
        const ownerAgencyId = cleanPerformanceText(payload.ownerAgencyId, 128);
        const requestedPresentationId = cleanPerformanceText(payload.presentationAgencyId, 128);
        const presentationAgencyId = requestedPresentationId || ownerAgencyId;
        const inmuebleId = cleanPerformanceText(payload.inmuebleId, 128);
        const requestedBranchId = cleanPerformanceText(payload.branchId, 128);
        const eventType = cleanPerformanceText(payload.eventType, 40);
        const counterKey = PORTAL_PERFORMANCE_EVENT_COUNTERS[eventType];

        if (!ownerAgencyId || !inmuebleId || !counterKey) {
            throw new HttpsError("invalid-argument", "La interacción informada no es válida.");
        }

        const property = await getPublicProperty(ownerAgencyId, inmuebleId);
        const shared = await getSharedPresentation({
            ownerAgencyId,
            presentationAgencyId,
            inmuebleId,
            property,
        });
        const hasValidFriendPresentation = presentationAgencyId !== ownerAgencyId && Boolean(shared);
        const validPresentationId = hasValidFriendPresentation
            ? presentationAgencyId
            : ownerAgencyId;
        const source = normalizePerformanceSource(
            hasValidFriendPresentation ? payload.source : (
                payload.source === "friend_agency" ? "direct" : payload.source
            ),
        );
        const dateKey = getPortalPerformanceDateKey();
        const reportingAgencyIds = Array.from(new Set([
            ownerAgencyId,
            validPresentationId,
        ]));
        const batch = db.batch();

        reportingAgencyIds.forEach((reportingAgencyId) => {
            const write = buildAggregateWrite({
                reportingAgencyId,
                ownerAgencyId,
                presentationAgencyId: validPresentationId,
                inmuebleId,
                property,
                shared,
                counterKey,
                source,
                requestedBranchId,
                dateKey,
            });
            batch.set(write.reference, write.data, { merge: true });
        });

        await batch.commit();
        return { ok: true };
    },
);

export const portalGetPerformanceDashboard = onCall(
    {
        region: REGION,
        invoker: "public",
        timeoutSeconds: 60,
    },
    async (request) => {
        const inmobiliariaId = await assertCanViewAgencyPerformance(
            request.auth?.uid,
            request.data?.inmobiliariaId,
        );
        const today = getPortalPerformanceDateKey();
        const defaultFrom = getPortalPerformanceDateKey(new Date(Date.now() - (29 * 86400000)));
        const dateFrom = normalizePerformanceDateKey(request.data?.dateFrom) || defaultFrom;
        const dateTo = normalizePerformanceDateKey(request.data?.dateTo) || today;
        const rangeDays = getDateRangeDays(dateFrom, dateTo);

        if (rangeDays <= 0 || rangeDays > MAX_DASHBOARD_DAYS) {
            throw new HttpsError(
                "invalid-argument",
                `Elegí un período de entre 1 y ${MAX_DASHBOARD_DAYS} días.`,
            );
        }

        const snapshot = await db.collection("inmobiliarias")
            .doc(inmobiliariaId)
            .collection("performance_daily")
            .where("dateKey", ">=", dateFrom)
            .where("dateKey", "<=", dateTo)
            .orderBy("dateKey", "asc")
            .limit(MAX_DASHBOARD_RECORDS + 1)
            .get();
        const truncated = snapshot.size > MAX_DASHBOARD_RECORDS;
        const records = snapshot.docs
            .slice(0, MAX_DASHBOARD_RECORDS)
            .map(serializePerformanceRecord);

        return {
            inmobiliariaId,
            dateFrom,
            dateTo,
            records,
            truncated,
        };
    },
);
