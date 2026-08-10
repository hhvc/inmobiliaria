import crypto from "node:crypto";
import { Buffer } from "node:buffer";

import admin from "firebase-admin";
import forge from "node-forge";
import { defineSecret } from "firebase-functions/params";
import { HttpsError, onCall } from "firebase-functions/v2/https";

import {
    ARCA_RECEIVER_IVA_CONDITIONS,
    buildArcaRegistrationRequest,
    buildWsaaLoginCmsEnvelope,
    buildWsaaTra,
    buildWsfeCaeRequest,
    buildWsfeDummyRequest,
    buildWsfeLastAuthorizedRequest,
    buildWsfePointsOfSaleRequest,
    buildWsfeVoucherQueryRequest,
    createArcaRequestId,
    isValidArcaCuit,
    normalizeArcaCuit,
    parseArcaSoapFault,
    parseArcaRegistrationResponse,
    parseWsaaLoginTicket,
    parseWsfeCaeResponse,
    parseWsfeDummyResponse,
    parseWsfeLastAuthorizedResponse,
    parseWsfePointsOfSaleResponse,
    parseWsfeVoucherQueryResponse,
    validateArcaInvoiceDraft,
} from "./arca.helpers.js";

if (!admin.apps.length) admin.initializeApp();

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;
const Timestamp = admin.firestore.Timestamp;
const REGION = "southamerica-east1";
const PROFILE_COLLECTION = "arca_issuer_profiles";
const TICKET_COLLECTION = "arca_private_tickets";
const LOCK_COLLECTION = "arca_issue_sequences";
const DRAFT_COLLECTION = "arca_invoice_drafts";
const PRODUCTION_PREVIEW_COLLECTION = "arca_production_invoice_previews";
const AUDIT_COLLECTION = "arca_audit_events";
const REGISTRATION_SERVICE = "ws_sr_constancia_inscripcion";
const LOCK_TTL_MS = 2 * 60 * 1000;

const arcaHomoCertificate = defineSecret("ARCA_HOMO_CERTIFICATE");
const arcaHomoPrivateKey = defineSecret("ARCA_HOMO_PRIVATE_KEY");
const arcaProdCertificate = defineSecret("ARCA_PROD_CERTIFICATE");
const arcaProdPrivateKey = defineSecret("ARCA_PROD_PRIVATE_KEY");
const arcaEncryptionKey = defineSecret("ARCA_TOKEN_ENCRYPTION_KEY");
const arcaSecrets = [arcaHomoCertificate, arcaHomoPrivateKey, arcaEncryptionKey];
const arcaProdSecrets = [
    arcaProdCertificate,
    arcaProdPrivateKey,
    arcaEncryptionKey,
];

const ARCA_ENVIRONMENTS = Object.freeze({
    homo: {
        name: "homo",
        credentialAlias: "platform_homo",
        wsaaUrl: "https://wsaahomo.afip.gov.ar/ws/services/LoginCms",
        wsfeUrl: "https://wswhomo.afip.gov.ar/wsfev1/service.asmx",
        registrationUrl:
            "https://awshomo.arca.gob.ar/sr-padron/webservices/personaServiceA5",
        certificate: arcaHomoCertificate,
        privateKey: arcaHomoPrivateKey,
    },
    prod: {
        name: "prod",
        credentialAlias: "onoprop_facturacion_prod",
        wsaaUrl: "https://wsaa.afip.gov.ar/ws/services/LoginCms",
        wsfeUrl: "https://servicios1.afip.gov.ar/wsfev1/service.asmx",
        registrationUrl:
            "https://aws.arca.gob.ar/sr-padron/webservices/personaServiceA5",
        certificate: arcaProdCertificate,
        privateKey: arcaProdPrivateKey,
    },
});

const getArcaEnvironment = (environment = "homo") => {
    const config = ARCA_ENVIRONMENTS[environment];
    if (!config) throw new Error("El entorno ARCA solicitado no es válido.");
    return config;
};

const memoryTickets = new Map();
const pendingTickets = new Map();

const cleanText = (value = "", maxLength = 500) => (
    value?.toString?.().trim().replace(/\s+/g, " ").slice(0, maxLength) || ""
);

const cleanDigits = (value = "") => value.toString().replace(/\D/g, "");

const getTicketCacheId = (profile, service = "wsfe", environment = "homo") => {
    const config = getArcaEnvironment(environment);
    return crypto
    .createHash("sha256").update([
        config.name,
        config.credentialAlias,
        profile.issuerCuit,
        service,
    ].join("|")).digest("hex").slice(0, 32);
};

const serializeValue = (value) => {
    if (value?.toDate && typeof value.toDate === "function") {
        return value.toDate().toISOString();
    }
    if (Array.isArray(value)) return value.map(serializeValue);
    if (value && typeof value === "object") {
        return Object.fromEntries(Object.entries(value).map(([key, item]) => (
            [key, serializeValue(item)]
        )));
    }
    return value;
};

const getUserData = async (uid) => {
    if (!uid) throw new HttpsError("unauthenticated", "Tenés que iniciar sesión.");
    const snap = await db.collection("users").doc(uid).get();
    if (!snap.exists) {
        throw new HttpsError("permission-denied", "Perfil de usuario no encontrado.");
    }
    return snap.data() || {};
};

const userHasRole = (userData = {}, roleName = "") => (
    userData.role === roleName ||
    userData.primaryRole === roleName ||
    (Array.isArray(userData.roles) && userData.roles.includes(roleName))
);

const assertRoot = async (uid) => {
    const userData = await getUserData(uid);
    if (!userHasRole(userData, "root")) {
        throw new HttpsError(
            "permission-denied",
            "Esta operación está reservada para la administración de ONO Prop.",
        );
    }
    return userData;
};

const assertCanManageAgency = async (uid, inmobiliariaId) => {
    const safeId = cleanText(inmobiliariaId, 128);
    if (!safeId) throw new HttpsError("invalid-argument", "Falta la inmobiliaria.");
    const userData = await getUserData(uid);
    const isRoot = userHasRole(userData, "root");
    const isAdmin = userHasRole(userData, "admin");
    const agencies = Array.isArray(userData.inmobiliarias)
        ? userData.inmobiliarias
        : [];
    if (!isRoot && (!isAdmin || !agencies.includes(safeId))) {
        throw new HttpsError(
            "permission-denied",
            "No tenés permisos para administrar esta inmobiliaria.",
        );
    }
    return {userData, isRoot, inmobiliariaId: safeId};
};

const profileRef = (profileId) => db.collection(PROFILE_COLLECTION).doc(profileId);
const draftRef = (inmobiliariaId, draftId) => db
    .collection("inmobiliarias").doc(inmobiliariaId)
    .collection(DRAFT_COLLECTION).doc(draftId);
const productionPreviewRef = (inmobiliariaId, previewId) => db
    .collection("inmobiliarias").doc(inmobiliariaId)
    .collection(PRODUCTION_PREVIEW_COLLECTION).doc(previewId);

const getProfile = async (profileId) => {
    const snap = await profileRef(cleanText(profileId, 128)).get();
    if (!snap.exists) throw new HttpsError("not-found", "No se encontró el perfil fiscal.");
    return {id: snap.id, ...(snap.data() || {})};
};

const assertProfileForAgency = (profile, inmobiliariaId) => {
    if (profile.inmobiliariaId !== inmobiliariaId) {
        throw new HttpsError(
            "failed-precondition",
            "El perfil fiscal pertenece a otra inmobiliaria.",
        );
    }
    if (profile.active !== true) {
        throw new HttpsError(
            "failed-precondition",
            "El perfil fiscal está inactivo. Activá el perfil antes de utilizarlo.",
        );
    }
    if (profile.environment !== "homo") {
        throw new HttpsError(
            "failed-precondition",
            "Esta etapa admite únicamente perfiles de homologación.",
        );
    }
};

const assertProductionProfileForAgency = (profile, inmobiliariaId) => {
    if (profile.inmobiliariaId !== inmobiliariaId) {
        throw new HttpsError(
            "failed-precondition",
            "El perfil fiscal pertenece a otra inmobiliaria.",
        );
    }
    if (profile.active !== true) {
        throw new HttpsError(
            "failed-precondition",
            "El perfil fiscal está inactivo. Activá el perfil antes de utilizarlo.",
        );
    }
};

const parseEncryptionKey = () => {
    const value = arcaEncryptionKey.value().trim();
    const key = Buffer.from(value, "base64");
    if (key.length !== 32) {
        throw new Error("ARCA_TOKEN_ENCRYPTION_KEY debe contener 32 bytes en Base64.");
    }
    return key;
};

const encryptTicket = (ticket) => {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", parseEncryptionKey(), iv);
    const encrypted = Buffer.concat([
        cipher.update(JSON.stringify(ticket), "utf8"),
        cipher.final(),
    ]);
    return {
        algorithm: "aes-256-gcm",
        ciphertext: encrypted.toString("base64"),
        iv: iv.toString("base64"),
        tag: cipher.getAuthTag().toString("base64"),
    };
};

const decryptTicket = (payload = {}) => {
    if (payload.algorithm !== "aes-256-gcm") return null;
    const decipher = crypto.createDecipheriv(
        "aes-256-gcm",
        parseEncryptionKey(),
        Buffer.from(payload.iv || "", "base64"),
    );
    decipher.setAuthTag(Buffer.from(payload.tag || "", "base64"));
    const decrypted = Buffer.concat([
        decipher.update(Buffer.from(payload.ciphertext || "", "base64")),
        decipher.final(),
    ]).toString("utf8");
    return JSON.parse(decrypted);
};

const isTicketUsable = (ticket, nowMs = Date.now()) => {
    const expirationMs = new Date(ticket?.expirationTime || 0).getTime();
    return Boolean(ticket?.token && ticket?.sign && expirationMs > nowMs + 10 * 60 * 1000);
};

const normalizePemSecret = (value = "") => {
    const normalized = value.trim().replace(/\\n/g, "\n");
    if (normalized.includes("-----BEGIN ")) return normalized;
    const decoded = Buffer.from(normalized, "base64").toString("utf8").trim();
    if (!decoded.includes("-----BEGIN ")) {
        throw new Error("El secreto ARCA no contiene un PEM válido.");
    }
    return decoded;
};

const signTra = (traXml, environment = "homo") => {
    const config = getArcaEnvironment(environment);
    const certificatePem = normalizePemSecret(config.certificate.value());
    const privateKeyPem = normalizePemSecret(config.privateKey.value());
    const certificate = forge.pki.certificateFromPem(certificatePem);
    const privateKey = forge.pki.privateKeyFromPem(privateKeyPem);
    const signedData = forge.pkcs7.createSignedData();
    signedData.content = forge.util.createBuffer(traXml, "utf8");
    signedData.addCertificate(certificate);
    signedData.addSigner({
        key: privateKey,
        certificate,
        digestAlgorithm: forge.pki.oids.sha256,
        authenticatedAttributes: [
            {type: forge.pki.oids.contentType, value: forge.pki.oids.data},
            {type: forge.pki.oids.messageDigest},
            {type: forge.pki.oids.signingTime, value: new Date()},
        ],
    });
    signedData.sign();
    return forge.util.encode64(
        forge.asn1.toDer(signedData.toAsn1()).getBytes(),
        64,
    ).replace(/\r?\n/g, "");
};

const postSoap = async ({url, action, xml}) => {
    let response;
    try {
        response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "text/xml; charset=utf-8",
                SOAPAction: `"${action}"`,
            },
            body: xml,
            signal: AbortSignal.timeout(30000),
        });
    } catch (error) {
        const cause = error?.cause || {};
        const networkCode = cleanText(cause.code, 80);
        const networkMessage = cleanText(cause.message, 300);
        console.error("Falló una conexión saliente con ARCA.", {
            host: new URL(url).hostname,
            errorName: cleanText(error?.name, 80),
            errorMessage: cleanText(error?.message, 300),
            networkCode,
            networkMessage,
        });
        const detail = [networkCode, networkMessage].filter(Boolean).join(": ");
        throw new Error(
            `No se pudo conectar con ARCA${detail ? ` (${detail})` : ""}.`,
        );
    }
    const body = await response.text();
    if (!response.ok) {
        const fault = parseArcaSoapFault(body);
        const faultSummary = `${fault?.code || ""} ${fault?.message || ""}`;
        const alreadyAuthenticated = /alreadyAuthenticated/i.test(faultSummary);
        const message = alreadyAuthenticated
            ? "WSAA informó que ya existe un ticket vigente para este certificado y servicio. Reintentá cuando expire; puede demorar hasta 12 horas desde la solicitud anterior."
            : fault?.message
                ? `ARCA respondió HTTP ${response.status}: ${cleanText(fault.message, 500)}`
                : `ARCA respondió HTTP ${response.status}.`;
        const error = new Error(message);
        error.code = cleanText(fault?.code, 100) || `ARCA_HTTP_${response.status}`;
        throw error;
    }
    return body;
};

const createWsaaTicket = async (
    profile,
    service = "wsfe",
    environment = "homo",
) => {
    const config = getArcaEnvironment(environment);
    const cacheId = getTicketCacheId(profile, service, environment);
    parseEncryptionKey();
    const cms = signTra(buildWsaaTra({service}), environment);
    const response = await postSoap({
        url: config.wsaaUrl,
        action: "",
        xml: buildWsaaLoginCmsEnvelope(cms),
    });
    const ticket = parseWsaaLoginTicket(response);
    const encrypted = encryptTicket(ticket);
    await db.collection(TICKET_COLLECTION).doc(cacheId).set({
        ...encrypted,
        credentialAlias: config.credentialAlias,
        issuerCuit: profile.issuerCuit,
        lastProfileId: profile.id,
        service,
        environment: config.name,
        expiresAt: Timestamp.fromDate(new Date(ticket.expirationTime)),
        updatedAt: FieldValue.serverTimestamp(),
    });
    memoryTickets.set(cacheId, ticket);
    return ticket;
};

const getWsaaTicket = async (profile, {
    service = "wsfe",
    forceRefresh = false,
    environment = "homo",
} = {}) => {
    const cacheId = getTicketCacheId(profile, service, environment);
    if (!forceRefresh && isTicketUsable(memoryTickets.get(cacheId))) {
        return memoryTickets.get(cacheId);
    }
    if (!forceRefresh) {
        const snap = await db.collection(TICKET_COLLECTION).doc(cacheId).get();
        if (snap.exists) {
            try {
                const ticket = decryptTicket(snap.data());
                if (isTicketUsable(ticket)) {
                    memoryTickets.set(cacheId, ticket);
                    return ticket;
                }
            } catch (error) {
                console.warn("No se pudo reutilizar el ticket WSAA cifrado.", {
                    profileId: profile.id,
                    message: cleanText(error.message, 200),
                });
            }
        }
    }
    if (!pendingTickets.has(cacheId)) {
        const promise = createWsaaTicket(profile, service, environment).finally(() => {
            pendingTickets.delete(cacheId);
        });
        pendingTickets.set(cacheId, promise);
    }
    return pendingTickets.get(cacheId);
};

const callWsfe = async ({action, xml, environment = "homo"}) => postSoap({
    url: getArcaEnvironment(environment).wsfeUrl,
    action: `http://ar.gov.afip.dif.FEV1/${action}`,
    xml,
});

const callRegistrationService = async (xml, environment = "homo") => postSoap({
    url: getArcaEnvironment(environment).registrationUrl,
    action: "",
    xml,
});

const getWsfeAuth = async (profile, environment = "homo") => {
    const ticket = await getWsaaTicket(profile, {service: "wsfe", environment});
    return {
        token: ticket.token,
        sign: ticket.sign,
        issuerCuit: profile.issuerCuit,
    };
};

const getRegistrationAuth = async (profile, environment = "homo") => {
    const ticket = await getWsaaTicket(profile, {
        service: REGISTRATION_SERVICE,
        environment,
    });
    return {
        token: ticket.token,
        sign: ticket.sign,
        representedCuit: profile.issuerCuit,
    };
};

const inspectCertificate = (environment = "homo") => {
    const config = getArcaEnvironment(environment);
    const certificate = forge.pki.certificateFromPem(
        normalizePemSecret(config.certificate.value()),
    );
    const subject = Object.fromEntries(certificate.subject.attributes.map((item) => (
        [item.shortName || item.name, item.value]
    )));
    const certificateCuit = certificate.subject.attributes
        .map((item) => cleanDigits(item.value))
        .find((value) => value.length === 11) || "";
    return {
        commonName: cleanText(subject.CN || subject.commonName, 200),
        issuerCuit: certificateCuit,
        serialNumber: cleanText(certificate.serialNumber, 128),
        validFrom: certificate.validity.notBefore.toISOString(),
        validTo: certificate.validity.notAfter.toISOString(),
    };
};

const inspectProductionCertificateForProfile = (profile) => {
    const certificate = inspectCertificate("prod");
    if (certificate.issuerCuit && certificate.issuerCuit !== profile.issuerCuit) {
        throw new HttpsError(
            "failed-precondition",
            "El CUIT del certificado de producción no coincide con el CUIT del perfil fiscal.",
        );
    }
    const now = Date.now();
    const validFrom = new Date(certificate.validFrom).getTime();
    const validTo = new Date(certificate.validTo).getTime();
    if (!Number.isFinite(validFrom) || !Number.isFinite(validTo) ||
        now < validFrom || now >= validTo) {
        throw new HttpsError(
            "failed-precondition",
            "El certificado de producción no está vigente.",
        );
    }
    return certificate;
};

const todayArgentina = () => new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
}).format(new Date());

const normalizeProfilePayload = (value = {}) => ({
    name: cleanText(value.name, 200),
    issuerLegalName: cleanText(value.issuerLegalName, 200),
    issuerTradeName: cleanText(value.issuerTradeName, 200),
    commercialAddress: cleanText(value.commercialAddress, 300),
    grossIncomeNumber: cleanText(value.grossIncomeNumber, 80),
    activityStartDate: cleanText(value.activityStartDate, 10),
    inmobiliariaId: cleanText(value.inmobiliariaId, 128),
    issuerPartyId: cleanText(value.issuerPartyId, 128),
    issuerCuit: normalizeArcaCuit(value.issuerCuit),
    environment: "homo",
    pointOfSale: Math.max(0, Math.trunc(Number(value.pointOfSale) || 0)),
    voucherType: 11,
    issuerIvaConditionId: 6,
    credentialAlias: ARCA_ENVIRONMENTS.homo.credentialAlias,
    active: value.active !== false,
    ...(normalizeArcaCuit(value.registrationLookup?.personCuit) ? {
        registrationLookup: {
            source: "ws_sr_constancia_inscripcion",
            environment: "homo",
            personCuit: normalizeArcaCuit(value.registrationLookup.personCuit),
            queriedAt: cleanText(value.registrationLookup.queriedAt, 40),
            processedAt: cleanText(value.registrationLookup.processedAt, 40),
            taxIdStatus: cleanText(value.registrationLookup.taxIdStatus, 80),
        },
    } : {}),
});

const validateProfile = (profile) => {
    const errors = [];
    if (!profile.name) errors.push("Ingresá un nombre para el perfil fiscal.");
    if (!profile.inmobiliariaId) errors.push("Seleccioná una inmobiliaria.");
    if (!isValidArcaCuit(profile.issuerCuit)) errors.push("El CUIT emisor no es válido.");
    if (!(profile.pointOfSale > 0)) errors.push("Ingresá el punto de venta WSFE.");
    return errors;
};

const listProfiles = async ({inmobiliariaId = "", isRoot = false} = {}) => {
    let query = db.collection(PROFILE_COLLECTION);
    if (!isRoot || inmobiliariaId) {
        query = query.where("inmobiliariaId", "==", inmobiliariaId);
    }
    const snap = await query.limit(200).get();
    return snap.docs.map((item) => serializeValue({
        id: item.id,
        ...(item.data() || {}),
    })).sort((a, b) => a.name.localeCompare(b.name));
};

const listDrafts = async (inmobiliariaId) => {
    const snap = await db.collection("inmobiliarias").doc(inmobiliariaId)
        .collection(DRAFT_COLLECTION).limit(300).get();
    return snap.docs.map((item) => serializeValue({
        id: item.id,
        ...(item.data() || {}),
    })).sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
};

const listProductionPreviews = async (inmobiliariaId) => {
    const snap = await db.collection("inmobiliarias").doc(inmobiliariaId)
        .collection(PRODUCTION_PREVIEW_COLLECTION).limit(300).get();
    return snap.docs.map((item) => serializeValue({
        id: item.id,
        ...(item.data() || {}),
    })).sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
};

export const arcaGetOverview = onCall({region: REGION}, async (request) => {
    const inmobiliariaId = cleanText(request.data?.inmobiliariaId, 128);
    const access = await assertCanManageAgency(request.auth?.uid, inmobiliariaId);
    const profiles = await listProfiles({
        inmobiliariaId,
        isRoot: access.isRoot,
    });
    return {
        environment: "homo",
        productionEnabled: access.isRoot,
        productionPreviewEnabled: access.isRoot,
        productionInvoiceIssuanceEnabled: access.isRoot,
        receiverIvaConditions: ARCA_RECEIVER_IVA_CONDITIONS,
        profiles: profiles.filter((profile) => profile.active === true),
        drafts: await listDrafts(inmobiliariaId),
        productionPreviews: access.isRoot
            ? await listProductionPreviews(inmobiliariaId)
            : [],
    };
});

export const arcaGetAdminOverview = onCall({region: REGION}, async (request) => {
    await assertRoot(request.auth?.uid);
    return {
        environment: "homo",
        productionEnabled: true,
        productionInvoiceIssuanceEnabled: true,
        receiverIvaConditions: ARCA_RECEIVER_IVA_CONDITIONS,
        profiles: await listProfiles({isRoot: true}),
    };
});

export const arcaGetRegistrationCertificate = onCall({
    region: REGION,
    secrets: arcaSecrets,
    timeoutSeconds: 60,
}, async (request) => {
    try {
        await assertRoot(request.auth?.uid);
        const profileId = cleanText(request.data?.profileId, 128);
        const profile = profileId
            ? await getProfile(profileId)
            : {
                id: "registration-preview",
                issuerCuit: normalizeArcaCuit(request.data?.representedCuit),
                environment: "homo",
            };
        const personCuit = normalizeArcaCuit(request.data?.personCuit);
        if (profile.environment !== "homo") {
            throw new HttpsError(
                "failed-precondition",
                "La consulta está habilitada únicamente en homologación.",
            );
        }
        if (!isValidArcaCuit(profile.issuerCuit)) {
            throw new HttpsError(
                "invalid-argument",
                "El CUIT representado no es válido.",
            );
        }
        if (!isValidArcaCuit(personCuit)) {
            throw new HttpsError(
                "invalid-argument",
                "El CUIT que querés consultar no es válido.",
            );
        }

        const auth = await getRegistrationAuth(profile);
        const xml = buildArcaRegistrationRequest({
            ...auth,
            personCuit,
        });
        const response = await callRegistrationService(xml);
        const certificate = parseArcaRegistrationResponse(response);
        const queriedAt = new Date().toISOString();
        return {
            ...certificate,
            source: {
                service: REGISTRATION_SERVICE,
                environment: "homo",
                representedCuit: profile.issuerCuit,
                queriedAt,
                processedAt: certificate.metadata?.processedAt || "",
            },
            suggestedProfile: {
                issuerLegalName: certificate.legalName,
                commercialAddress: certificate.fiscalAddress?.formatted || "",
            },
        };
    } catch (error) {
        if (error instanceof HttpsError) throw error;
        console.error("Falló la consulta de Constancia de Inscripción ARCA.", {
            code: cleanText(error?.code, 100),
            message: cleanText(error?.message, 500),
        });
        throw new HttpsError(
            "unavailable",
            cleanText(error?.message, 500) ||
                "No se pudo consultar la Constancia de Inscripción.",
        );
    }
});

export const arcaUpsertIssuerProfile = onCall({region: REGION}, async (request) => {
    await assertRoot(request.auth?.uid);
    const profile = normalizeProfilePayload(request.data?.profile || {});
    const errors = validateProfile(profile);
    if (errors.length) throw new HttpsError("invalid-argument", errors.join(" "));
    const agencySnap = await db.collection("inmobiliarias")
        .doc(profile.inmobiliariaId).get();
    if (!agencySnap.exists) throw new HttpsError("not-found", "La inmobiliaria no existe.");
    if (profile.issuerPartyId) {
        const partySnap = await agencySnap.ref.collection("rental_people")
            .doc(profile.issuerPartyId).get();
        const party = partySnap.data() || {};
        if (!partySnap.exists || !Array.isArray(party.roles) ||
            !party.roles.includes("owner")) {
            throw new HttpsError(
                "invalid-argument",
                "El emisor seleccionado no es un locador de la inmobiliaria.",
            );
        }
        if (normalizeArcaCuit(party.taxId) !== profile.issuerCuit) {
            throw new HttpsError(
                "invalid-argument",
                "El CUIT del perfil no coincide con el CUIT del locador.",
            );
        }
    }
    const profileId = cleanText(request.data?.profileId, 128) ||
        `${profile.inmobiliariaId}_${profile.issuerCuit}`;
    const ref = profileRef(profileId);
    const existing = await ref.get();
    await ref.set({
        ...profile,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: request.auth.uid,
        ...(existing.exists ? {} : {
            createdAt: FieldValue.serverTimestamp(),
            createdBy: request.auth.uid,
        }),
    }, {merge: true});
    return {profile: serializeValue({id: ref.id, ...profile})};
});

export const arcaTestHomologation = onCall({
    region: REGION,
    secrets: arcaSecrets,
    timeoutSeconds: 60,
}, async (request) => {
    try {
        await assertRoot(request.auth?.uid);
        const profile = await getProfile(request.data?.profileId);
        assertProfileForAgency(profile, profile.inmobiliariaId);
        const certificate = inspectCertificate();
        if (certificate.issuerCuit && certificate.issuerCuit !== profile.issuerCuit) {
            throw new HttpsError(
                "failed-precondition",
                "El CUIT del certificado no coincide con el CUIT del perfil fiscal.",
            );
        }
        const dummyXml = await callWsfe({
            action: "FEDummy",
            xml: buildWsfeDummyRequest(),
        });
        const dummy = parseWsfeDummyResponse(dummyXml);
        const auth = await getWsfeAuth(profile);
        const pointsXml = await callWsfe({
            action: "FEParamGetPtosVenta",
            xml: buildWsfePointsOfSaleRequest(auth),
        });
        const pointsOfSale = parseWsfePointsOfSaleResponse(pointsXml);
        const configuredPoint = pointsOfSale.find((item) => (
            item.number === Number(profile.pointOfSale)
        ));
        let lastAuthorizedVoucher = null;
        let pointValidationMode = "catalog";
        let configuredPointAvailable = Boolean(
            configuredPoint && !configuredPoint.blocked,
        );
        if (!pointsOfSale.length) {
            const lastAuthorizedXml = await callWsfe({
                action: "FECompUltimoAutorizado",
                xml: buildWsfeLastAuthorizedRequest({
                    ...auth,
                    pointOfSale: profile.pointOfSale,
                    voucherType: profile.voucherType,
                }),
            });
            lastAuthorizedVoucher = parseWsfeLastAuthorizedResponse(
                lastAuthorizedXml,
            );
            pointValidationMode = "last-authorized";
            configuredPointAvailable = true;
        }
        const result = {
            checkedAt: new Date().toISOString(),
            environment: "homo",
            dummy,
            certificate,
            pointsOfSale,
            configuredPointAvailable,
            pointValidationMode,
            lastAuthorizedVoucher,
        };
        await profileRef(profile.id).update({
            lastTest: result,
            updatedAt: FieldValue.serverTimestamp(),
            updatedBy: request.auth.uid,
        });
        return result;
    } catch (error) {
        if (error instanceof HttpsError) throw error;
        console.error("Falló la prueba de homologación ARCA.", {
            code: cleanText(error?.code, 100),
            message: cleanText(error?.message, 500),
        });
        throw new HttpsError(
            "unavailable",
            cleanText(error?.message, 500) ||
                "No se pudo completar la prueba de homologación.",
        );
    }
});

export const arcaTestProductionConnection = onCall({
    region: REGION,
    secrets: arcaProdSecrets,
    timeoutSeconds: 60,
}, async (request) => {
    try {
        await assertRoot(request.auth?.uid);
        const profile = await getProfile(request.data?.profileId);
        if (profile.active !== true || !isValidArcaCuit(profile.issuerCuit)) {
            throw new HttpsError(
                "failed-precondition",
                "El perfil fiscal debe estar activo y contener un CUIT válido.",
            );
        }
        if (!(Number(profile.pointOfSale) > 0)) {
            throw new HttpsError(
                "failed-precondition",
                "El perfil fiscal no contiene un punto de venta válido.",
            );
        }
        const certificate = inspectProductionCertificateForProfile(profile);
        const dummyXml = await callWsfe({
            action: "FEDummy",
            xml: buildWsfeDummyRequest(),
            environment: "prod",
        });
        const dummy = parseWsfeDummyResponse(dummyXml);
        const auth = await getWsfeAuth(profile, "prod");
        const pointsXml = await callWsfe({
            action: "FEParamGetPtosVenta",
            xml: buildWsfePointsOfSaleRequest(auth),
            environment: "prod",
        });
        const pointsOfSale = parseWsfePointsOfSaleResponse(pointsXml);
        const configuredPoint = pointsOfSale.find((item) => (
            item.number === Number(profile.pointOfSale)
        ));
        let lastAuthorizedVoucher = null;
        let pointValidationMode = "catalog";
        let configuredPointAvailable = Boolean(
            configuredPoint && !configuredPoint.blocked,
        );
        if (!pointsOfSale.length) {
            const lastAuthorizedXml = await callWsfe({
                action: "FECompUltimoAutorizado",
                xml: buildWsfeLastAuthorizedRequest({
                    ...auth,
                    pointOfSale: profile.pointOfSale,
                    voucherType: profile.voucherType,
                }),
                environment: "prod",
            });
            lastAuthorizedVoucher = parseWsfeLastAuthorizedResponse(
                lastAuthorizedXml,
            );
            pointValidationMode = "last-authorized";
            configuredPointAvailable = true;
        }
        const result = {
            checkedAt: new Date().toISOString(),
            environment: "prod",
            readOnly: true,
            invoiceIssuanceEnabled: true,
            dummy,
            certificate,
            pointsOfSale,
            configuredPointAvailable,
            pointValidationMode,
            lastAuthorizedVoucher,
        };
        await profileRef(profile.id).update({
            lastProductionTest: result,
            updatedAt: FieldValue.serverTimestamp(),
            updatedBy: request.auth.uid,
        });
        return result;
    } catch (error) {
        if (error instanceof HttpsError) throw error;
        console.error("Falló la prueba de solo lectura en producción ARCA.", {
            code: cleanText(error?.code, 100),
            message: cleanText(error?.message, 500),
        });
        throw new HttpsError(
            "unavailable",
            cleanText(error?.message, 500) ||
                "No se pudo completar la prueba de producción.",
        );
    }
});

export const arcaGetProductionRegistrationCertificate = onCall({
    region: REGION,
    secrets: arcaProdSecrets,
    timeoutSeconds: 60,
}, async (request) => {
    try {
        await assertRoot(request.auth?.uid);
        const profileId = cleanText(request.data?.profileId, 128);
        if (!profileId) {
            throw new HttpsError(
                "invalid-argument",
                "Seleccioná un perfil fiscal guardado.",
            );
        }
        const profile = await getProfile(profileId);
        if (!isValidArcaCuit(profile.issuerCuit)) {
            throw new HttpsError(
                "failed-precondition",
                "El perfil fiscal debe contener un CUIT válido.",
            );
        }
        inspectProductionCertificateForProfile(profile);
        const auth = await getRegistrationAuth(profile, "prod");
        const xml = buildArcaRegistrationRequest({
            ...auth,
            personCuit: profile.issuerCuit,
        });
        const response = await callRegistrationService(xml, "prod");
        const certificate = parseArcaRegistrationResponse(response);
        const queriedAt = new Date().toISOString();
        const result = {
            ...certificate,
            source: {
                service: REGISTRATION_SERVICE,
                environment: "prod",
                representedCuit: profile.issuerCuit,
                queriedAt,
                processedAt: certificate.metadata?.processedAt || "",
            },
            suggestedProfile: {
                issuerLegalName: certificate.legalName,
                commercialAddress: certificate.fiscalAddress?.formatted || "",
            },
        };
        await profileRef(profile.id).update({
            lastProductionRegistrationLookup: {
                personCuit: result.personCuit,
                queriedAt,
                processedAt: result.source.processedAt,
                taxIdStatus: result.taxIdStatus || "",
            },
            updatedAt: FieldValue.serverTimestamp(),
            updatedBy: request.auth.uid,
        });
        return result;
    } catch (error) {
        if (error instanceof HttpsError) throw error;
        console.error("Falló la consulta de producción a Constancia ARCA.", {
            code: cleanText(error?.code, 100),
            message: cleanText(error?.message, 500),
        });
        throw new HttpsError(
            "unavailable",
            cleanText(error?.message, 500) ||
                "No se pudo consultar la Constancia de Inscripción en producción.",
        );
    }
});

const getRentalDocuments = async ({inmobiliariaId, contractId, obligationId}) => {
    const agencyRef = db.collection("inmobiliarias").doc(inmobiliariaId);
    const [contractSnap, obligationSnap] = await Promise.all([
        agencyRef.collection("rental_contracts").doc(contractId).get(),
        agencyRef.collection("rental_obligations").doc(obligationId).get(),
    ]);
    if (!contractSnap.exists) throw new HttpsError("not-found", "El contrato no existe.");
    if (!obligationSnap.exists) throw new HttpsError("not-found", "La obligación no existe.");
    const contract = {id: contractSnap.id, ...(contractSnap.data() || {})};
    const obligation = {id: obligationSnap.id, ...(obligationSnap.data() || {})};
    if (obligation.contractId !== contract.id) {
        throw new HttpsError("invalid-argument", "La obligación no corresponde al contrato.");
    }
    if (obligation.voided === true || obligation.status === "voided") {
        throw new HttpsError(
            "failed-precondition",
            "La obligación fue anulada por una revisión del contrato y no puede facturarse.",
        );
    }
    if (obligation.externalClosure?.closed === true) {
        throw new HttpsError(
            "failed-precondition",
            "El período está cerrado fuera de gestión. Reabrilo antes de preparar una factura desde ONO Prop.",
        );
    }
    if (obligation.externalInvoice?.registered === true) {
        throw new HttpsError(
            "failed-precondition",
            "El período figura como facturado externamente. Quitá esa marca antes de preparar otra factura.",
        );
    }
    if (obligation.arcaProductionInvoice?.authorized === true) {
        throw new HttpsError(
            "failed-precondition",
            "El período ya tiene un comprobante autorizado en ARCA Producción.",
        );
    }
    return {agencyRef, contract, obligation};
};

const getTenant = async ({agencyRef, contract, tenantId}) => {
    const allowedIds = Array.isArray(contract.partyIds?.tenants)
        ? contract.partyIds.tenants
        : [];
    const safeTenantId = cleanText(tenantId, 128) || allowedIds[0] || "";
    if (!safeTenantId || !allowedIds.includes(safeTenantId)) {
        throw new HttpsError("invalid-argument", "Seleccioná un inquilino del contrato.");
    }
    const snap = await agencyRef.collection("rental_people").doc(safeTenantId).get();
    if (!snap.exists) throw new HttpsError("not-found", "El inquilino no existe.");
    return {id: snap.id, ...(snap.data() || {})};
};

const buildRecipient = (tenant, payload = {}) => {
    const rawTaxId = cleanDigits(payload.documentNumber || tenant.taxId);
    const inferredType = rawTaxId.length === 11 ? 80 : rawTaxId ? 96 : 99;
    return {
        partyId: tenant.id,
        name: cleanText(payload.name || tenant.name, 200),
        documentType: Number(payload.documentType || inferredType),
        documentNumber: cleanDigits(payload.documentNumber || tenant.taxId) || "0",
        ivaConditionId: Number(payload.ivaConditionId || 0),
        address: cleanText(payload.address || tenant.address, 300),
    };
};

export const arcaCreateRentalInvoiceDraft = onCall({region: REGION}, async (request) => {
    const inmobiliariaId = cleanText(request.data?.inmobiliariaId, 128);
    await assertCanManageAgency(request.auth?.uid, inmobiliariaId);
    const profile = await getProfile(request.data?.profileId);
    assertProfileForAgency(profile, inmobiliariaId);
    const documents = await getRentalDocuments({
        inmobiliariaId,
        contractId: cleanText(request.data?.contractId, 128),
        obligationId: cleanText(request.data?.obligationId, 180),
    });
    if (documents.contract.currency !== "ARS") {
        throw new HttpsError(
            "failed-precondition",
            "La primera etapa de facturación admite únicamente contratos en ARS.",
        );
    }
    const ownerIds = Array.isArray(documents.contract.partyIds?.owners)
        ? documents.contract.partyIds.owners
        : [];
    if (profile.issuerPartyId && !ownerIds.includes(profile.issuerPartyId)) {
        throw new HttpsError(
            "failed-precondition",
            "El emisor fiscal configurado no es locador de este contrato.",
        );
    }
    const tenant = await getTenant({
        agencyRef: documents.agencyRef,
        contract: documents.contract,
        tenantId: request.data?.tenantId,
    });
    const draftId = createArcaRequestId({
        issuerProfileId: profile.id,
        issuerPartyId: profile.issuerPartyId || "",
        pointOfSale: profile.pointOfSale,
        voucherType: profile.voucherType,
        obligationId: documents.obligation.id,
    });
    const ref = draftRef(inmobiliariaId, draftId);
    const existing = await ref.get();
    if (existing.exists && existing.data()?.status === "authorized") {
        return {draft: serializeValue({id: ref.id, ...(existing.data() || {})})};
    }
    if (existing.exists && existing.data()?.status === "authorizing") {
        throw new HttpsError(
            "aborted",
            "El comprobante se está autorizando. Esperá antes de modificarlo.",
        );
    }
    const recipient = buildRecipient(tenant, request.data?.recipient || {});
    const contractualTerms = {
        amountMinor: Math.max(0, Math.round(Number(
            documents.obligation.totalAmountMinor,
        ) || 0)),
        serviceFrom: cleanText(documents.obligation.serviceStartDate, 10),
        serviceTo: cleanText(documents.obligation.serviceEndDate, 10),
        paymentDueDate: cleanText(documents.obligation.dueDate, 10),
    };
    const requestedAmount = Number(request.data?.amountMinor);
    const fiscalTerms = {
        amountMinor: Number.isFinite(requestedAmount)
            ? Math.max(0, Math.round(requestedAmount))
            : contractualTerms.amountMinor,
        serviceFrom: cleanText(request.data?.serviceFrom, 10) ||
            contractualTerms.serviceFrom,
        serviceTo: cleanText(request.data?.serviceTo, 10) ||
            contractualTerms.serviceTo,
        paymentDueDate: cleanText(request.data?.paymentDueDate, 10) ||
            contractualTerms.paymentDueDate,
    };
    const hasFiscalAdjustments = Object.entries(contractualTerms).some(
        ([key, value]) => fiscalTerms[key] !== value,
    );
    const adjustmentReason = cleanText(request.data?.adjustmentReason, 500);
    if (hasFiscalAdjustments && !adjustmentReason) {
        throw new HttpsError(
            "invalid-argument",
            "Explicá el motivo de la diferencia respecto de la obligación contractual.",
        );
    }
    const draft = {
        id: draftId,
        requestId: draftId,
        inmobiliariaId,
        issuerProfileId: profile.id,
        environment: "homo",
        issuerCuit: profile.issuerCuit,
        issuerSnapshot: {
            legalName: profile.issuerLegalName || profile.name,
            tradeName: profile.issuerTradeName || "",
            commercialAddress: profile.commercialAddress || "",
            grossIncomeNumber: profile.grossIncomeNumber || "",
            activityStartDate: profile.activityStartDate || "",
            ivaConditionId: Number(profile.issuerIvaConditionId || 6),
        },
        pointOfSale: profile.pointOfSale,
        voucherType: 11,
        contractId: documents.contract.id,
        obligationId: documents.obligation.id,
        periodKey: cleanText(documents.obligation.periodKey, 20),
        recipient,
        amountMinor: fiscalTerms.amountMinor,
        currency: "ARS",
        invoiceDate: cleanText(request.data?.invoiceDate, 10) || todayArgentina(),
        serviceFrom: fiscalTerms.serviceFrom,
        serviceTo: fiscalTerms.serviceTo,
        paymentDueDate: fiscalTerms.paymentDueDate,
        contractualTerms,
        hasFiscalAdjustments,
        adjustmentReason,
        description: cleanText(
            request.data?.description ||
            `Alquiler ${documents.obligation.periodKey} · ` +
            (documents.contract.inmuebleSnapshot?.address || "Inmueble"),
            500,
        ),
        contractSnapshot: {
            title: cleanText(documents.contract.inmuebleSnapshot?.title, 220),
            address: cleanText(documents.contract.inmuebleSnapshot?.address, 300),
        },
        obligationSnapshot: {
            rentAmountMinor: Number(documents.obligation.rentAmountMinor || 0),
            otherChargesMinor: Number(documents.obligation.otherChargesMinor || 0),
            paidAmountMinor: Number(documents.obligation.paidAmountMinor || 0),
        },
        status: "draft",
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: request.auth.uid,
        ...(existing.exists ? {} : {
            createdAt: FieldValue.serverTimestamp(),
            createdBy: request.auth.uid,
        }),
    };
    const validationErrors = validateArcaInvoiceDraft(draft, {
        requestDateKey: todayArgentina(),
    });
    if (validationErrors.length) {
        throw new HttpsError("invalid-argument", validationErrors.join(" "));
    }
    await ref.set({
        ...draft,
        ...(existing.exists ? {
            arcaResult: FieldValue.delete(),
            errors: FieldValue.delete(),
            observations: FieldValue.delete(),
            proposedVoucherNumber: FieldValue.delete(),
        } : {}),
    }, {merge: true});
    return {draft: serializeValue({...draft, updatedAt: new Date().toISOString()})};
});

const assertProductionPreparationReady = (profile) => {
    const missingFields = [
        ["apellido y nombre / razón social", profile.issuerLegalName],
        ["domicilio comercial", profile.commercialAddress],
        ["Ingresos Brutos / condición", profile.grossIncomeNumber],
        ["inicio de actividades", profile.activityStartDate],
    ].filter(([, value]) => !cleanText(value, 300)).map(([label]) => label);
    if (missingFields.length) {
        throw new HttpsError(
            "failed-precondition",
            `Completá el perfil fiscal antes de preparar Producción: ${missingFields.join(", ")}.`,
        );
    }
    const lastTest = profile.lastProductionTest || {};
    const checkedAtMs = new Date(lastTest.checkedAt || 0).getTime();
    const maximumAgeMs = 30 * 24 * 60 * 60 * 1000;
    if (lastTest.configuredPointAvailable !== true ||
        !Number.isFinite(checkedAtMs) || checkedAtMs < Date.now() - maximumAgeMs) {
        throw new HttpsError(
            "failed-precondition",
            "Ejecutá nuevamente “Probar PROD”; la validación debe ser correcta y tener menos de 30 días.",
        );
    }
    if (normalizeArcaCuit(
        profile.lastProductionRegistrationLookup?.personCuit,
    ) !== profile.issuerCuit) {
        throw new HttpsError(
            "failed-precondition",
            "Consultá la Constancia real del emisor antes de preparar Producción.",
        );
    }
};

export const arcaPrepareProductionRentalInvoicePreview = onCall({
    region: REGION,
    secrets: arcaProdSecrets,
    timeoutSeconds: 60,
}, async (request) => {
    try {
        await assertRoot(request.auth?.uid);
        const inmobiliariaId = cleanText(request.data?.inmobiliariaId, 128);
        const sourceDraftId = cleanText(request.data?.draftId, 128);
        if (!inmobiliariaId || !sourceDraftId) {
            throw new HttpsError(
                "invalid-argument",
                "Faltan la inmobiliaria o el borrador de homologación.",
            );
        }
        const sourceRef = draftRef(inmobiliariaId, sourceDraftId);
        const sourceSnap = await sourceRef.get();
        if (!sourceSnap.exists) {
            throw new HttpsError(
                "not-found",
                "No se encontró el borrador de homologación.",
            );
        }
        const sourceDraft = {id: sourceSnap.id, ...(sourceSnap.data() || {})};
        if (sourceDraft.inmobiliariaId !== inmobiliariaId ||
            sourceDraft.environment !== "homo") {
            throw new HttpsError(
                "failed-precondition",
                "La fuente debe ser un borrador válido de homologación.",
            );
        }
        if (sourceDraft.status === "authorizing") {
            throw new HttpsError(
                "aborted",
                "El borrador de homologación se está autorizando.",
            );
        }
        const requestedProfileId = cleanText(request.data?.profileId, 128);
        const profile = await getProfile(
            requestedProfileId || sourceDraft.issuerProfileId,
        );
        assertProfileForAgency(profile, inmobiliariaId);
        const documents = await getRentalDocuments({
            inmobiliariaId,
            contractId: sourceDraft.contractId,
            obligationId: sourceDraft.obligationId,
        });
        const ownerIds = Array.isArray(documents.contract.partyIds?.owners)
            ? documents.contract.partyIds.owners
            : [];
        if (profile.issuerPartyId && !ownerIds.includes(profile.issuerPartyId)) {
            throw new HttpsError(
                "failed-precondition",
                "El emisor fiscal seleccionado no es locador de este contrato.",
            );
        }
        assertProductionPreparationReady(profile);
        const certificate = inspectProductionCertificateForProfile(profile);
        const validationErrors = validateArcaInvoiceDraft(sourceDraft, {
            requestDateKey: todayArgentina(),
        });
        if (validationErrors.length) {
            throw new HttpsError(
                "failed-precondition",
                validationErrors.join(" "),
            );
        }

        const auth = await getWsfeAuth(profile, "prod");
        const lastAuthorizedXml = await callWsfe({
            action: "FECompUltimoAutorizado",
            xml: buildWsfeLastAuthorizedRequest({
                ...auth,
                pointOfSale: profile.pointOfSale,
                voucherType: profile.voucherType,
            }),
            environment: "prod",
        });
        const lastAuthorizedVoucher = parseWsfeLastAuthorizedResponse(
            lastAuthorizedXml,
        );
        const previewId = createArcaRequestId({
            issuerProfileId: profile.id,
            pointOfSale: profile.pointOfSale,
            voucherType: profile.voucherType,
            obligationId: sourceDraft.obligationId,
            environment: "prod",
        });
        const observedAt = new Date().toISOString();
        const preview = {
            id: previewId,
            requestId: previewId,
            sourceHomologationDraftId: sourceDraft.id,
            sourceHomologationStatus: cleanText(sourceDraft.status, 60),
            inmobiliariaId,
            issuerProfileId: profile.id,
            environment: "prod",
            issuerCuit: profile.issuerCuit,
            issuerSnapshot: {
                legalName: profile.issuerLegalName || profile.name,
                tradeName: profile.issuerTradeName || "",
                commercialAddress: profile.commercialAddress || "",
                grossIncomeNumber: profile.grossIncomeNumber || "",
                activityStartDate: profile.activityStartDate || "",
                ivaConditionId: Number(profile.issuerIvaConditionId || 6),
            },
            pointOfSale: Number(profile.pointOfSale),
            voucherType: 11,
            contractId: sourceDraft.contractId,
            obligationId: sourceDraft.obligationId,
            periodKey: sourceDraft.periodKey,
            recipient: sourceDraft.recipient,
            amountMinor: Number(sourceDraft.amountMinor),
            currency: "ARS",
            invoiceDate: sourceDraft.invoiceDate,
            serviceFrom: sourceDraft.serviceFrom,
            serviceTo: sourceDraft.serviceTo,
            paymentDueDate: sourceDraft.paymentDueDate,
            contractualTerms: sourceDraft.contractualTerms || {},
            hasFiscalAdjustments: sourceDraft.hasFiscalAdjustments === true,
            adjustmentReason: sourceDraft.adjustmentReason || "",
            description: sourceDraft.description || "",
            contractSnapshot: sourceDraft.contractSnapshot || {},
            obligationSnapshot: sourceDraft.obligationSnapshot || {},
            status: "production_preview",
            readOnly: false,
            productionInvoiceIssuanceEnabled: true,
            issuanceBlockedReason: "",
            lastAuthorizedVoucher,
            proposedVoucherNumber: lastAuthorizedVoucher + 1,
            sequenceObservedAt: observedAt,
            sequenceReserved: false,
            certificate: {
                commonName: certificate.commonName,
                issuerCuit: certificate.issuerCuit,
                serialNumber: certificate.serialNumber,
                validTo: certificate.validTo,
            },
            updatedAt: FieldValue.serverTimestamp(),
            updatedBy: request.auth.uid,
        };
        const previewErrors = validateArcaInvoiceDraft(preview, {
            requestDateKey: todayArgentina(),
            allowedEnvironments: ["prod"],
        });
        if (previewErrors.length) {
            throw new HttpsError(
                "failed-precondition",
                previewErrors.join(" "),
            );
        }
        const ref = productionPreviewRef(inmobiliariaId, previewId);
        const existing = await ref.get();
        const auditRef = db.collection(AUDIT_COLLECTION).doc();
        const batch = db.batch();
        batch.set(ref, {
            ...preview,
            ...(existing.exists ? {} : {
                createdAt: FieldValue.serverTimestamp(),
                createdBy: request.auth.uid,
            }),
        }, {merge: true});
        batch.set(auditRef, {
            action: "arca_production_preview_prepared",
            environment: "prod",
            readOnly: true,
            inmobiliariaId,
            profileId: profile.id,
            previewId,
            sourceDraftId: sourceDraft.id,
            pointOfSale: Number(profile.pointOfSale),
            lastAuthorizedVoucher,
            proposedVoucherNumber: lastAuthorizedVoucher + 1,
            performedBy: request.auth.uid,
            performedAt: FieldValue.serverTimestamp(),
        });
        await batch.commit();
        return {
            preview: serializeValue({...preview, updatedAt: observedAt}),
        };
    } catch (error) {
        if (error instanceof HttpsError) throw error;
        console.error("Falló la preparación productiva de solo lectura.", {
            code: cleanText(error?.code, 100),
            message: cleanText(error?.message, 500),
        });
        throw new HttpsError(
            "unavailable",
            cleanText(error?.message, 500) ||
                "No se pudo preparar la vista previa productiva.",
        );
    }
});

const acquireIssueLock = async ({
    profile,
    draft,
    uid,
    environment = "homo",
    documentRef = draftRef(draft.inmobiliariaId, draft.id),
}) => {
    const lockId = [
        environment,
        profile.issuerCuit,
        profile.pointOfSale,
        profile.voucherType,
    ].join("_");
    const ref = db.collection(LOCK_COLLECTION).doc(lockId);
    const lockToken = crypto.randomUUID();
    await db.runTransaction(async (transaction) => {
        const [lockSnap, currentDraftSnap] = await Promise.all([
            transaction.get(ref),
            transaction.get(documentRef),
        ]);
        const currentDraft = currentDraftSnap.data() || {};
        if (currentDraft.status === "authorized") return;
        const lock = lockSnap.data() || {};
        const expiresAtMs = lock.expiresAt?.toMillis?.() || 0;
        if (lock.token && expiresAtMs > Date.now()) {
            throw new HttpsError(
                "aborted",
                "Hay otra emisión en curso para este punto de venta. Reintentá en unos segundos.",
            );
        }
        transaction.set(ref, {
            token: lockToken,
            profileId: profile.id,
            draftId: draft.id,
            acquiredBy: uid,
            acquiredAt: FieldValue.serverTimestamp(),
            expiresAt: Timestamp.fromMillis(Date.now() + LOCK_TTL_MS),
        });
        transaction.update(currentDraftSnap.ref, {
            status: "authorizing",
            authorizationStartedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
            updatedBy: uid,
        });
    });
    return {ref, lockToken};
};

const releaseIssueLock = async ({ref, lockToken}) => {
    await db.runTransaction(async (transaction) => {
        const snap = await transaction.get(ref);
        if (snap.data()?.token === lockToken) transaction.delete(ref);
    });
};

const persistAuthorizedDraft = async ({ref, result, uid, source}) => {
    if (!result?.cae) throw new Error("ARCA no devolvió un CAE válido.");
    await ref.update({
        status: "authorized",
        cae: result.cae,
        caeExpirationDate: result.caeExpirationDate || "",
        voucherNumber: Number(result.voucherNumber || 0),
        voucherDate: result.voucherDate || "",
        observations: result.observations || [],
        arcaResult: result.result || "A",
        authorizationSource: source,
        authorizedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: uid,
    });
};

const getExistingVoucher = async ({profile, draft, auth, environment = "homo"}) => {
    if (!(Number(draft.proposedVoucherNumber) > 0)) return null;
    const xml = buildWsfeVoucherQueryRequest({
        ...auth,
        pointOfSale: profile.pointOfSale,
        voucherType: profile.voucherType,
        voucherNumber: draft.proposedVoucherNumber,
    });
    const response = await callWsfe({action: "FECompConsultar", xml, environment});
    return parseWsfeVoucherQueryResponse(response);
};

export const arcaAuthorizeRentalInvoice = onCall({
    region: REGION,
    secrets: arcaSecrets,
    timeoutSeconds: 60,
}, async (request) => {
    const inmobiliariaId = cleanText(request.data?.inmobiliariaId, 128);
    await assertCanManageAgency(request.auth?.uid, inmobiliariaId);
    if (request.data?.confirmHomologation !== true) {
        throw new HttpsError(
            "failed-precondition",
            "Confirmá expresamente la emisión en homologación.",
        );
    }
    const ref = draftRef(inmobiliariaId, cleanText(request.data?.draftId, 128));
    let snap = await ref.get();
    if (!snap.exists) throw new HttpsError("not-found", "El borrador no existe.");
    let draft = {id: snap.id, ...(snap.data() || {})};
    if (draft.status === "authorized") return {draft: serializeValue(draft)};
    const requestDateKey = todayArgentina();
    const errors = validateArcaInvoiceDraft(draft, {requestDateKey});
    if (errors.length) throw new HttpsError("failed-precondition", errors.join(" "));
    const profile = await getProfile(draft.issuerProfileId);
    assertProfileForAgency(profile, inmobiliariaId);
    await getRentalDocuments({
        inmobiliariaId,
        contractId: draft.contractId,
        obligationId: draft.obligationId,
    });
    const lock = await acquireIssueLock({profile, draft, uid: request.auth.uid});
    try {
        snap = await ref.get();
        draft = {id: snap.id, ...(snap.data() || {})};
        const auth = await getWsfeAuth(profile);
        const recovered = await getExistingVoucher({profile, draft, auth});
        if (recovered?.cae) {
            await persistAuthorizedDraft({
                ref,
                result: recovered,
                uid: request.auth.uid,
                source: "reconciliation",
            });
            return {draft: serializeValue({
                ...draft,
                ...recovered,
                status: "authorized",
            })};
        }
        const lastXml = buildWsfeLastAuthorizedRequest({
            ...auth,
            pointOfSale: profile.pointOfSale,
            voucherType: profile.voucherType,
        });
        const lastResponse = await callWsfe({
            action: "FECompUltimoAutorizado",
            xml: lastXml,
        });
        const voucherNumber = parseWsfeLastAuthorizedResponse(lastResponse) + 1;
        await ref.update({
            proposedVoucherNumber: voucherNumber,
            updatedAt: FieldValue.serverTimestamp(),
        });
        const caeXml = buildWsfeCaeRequest({
            draft,
            ...auth,
            voucherNumber,
            requestDateKey,
        });
        const caeResponse = await callWsfe({action: "FECAESolicitar", xml: caeXml});
        const result = parseWsfeCaeResponse(caeResponse);
        if (!result.cae || result.result !== "A") {
            await ref.update({
                status: "rejected",
                arcaResult: result.result || "R",
                errors: result.errors || [],
                observations: result.observations || [],
                updatedAt: FieldValue.serverTimestamp(),
                updatedBy: request.auth.uid,
            });
            throw new HttpsError(
                "failed-precondition",
                [...(result.errors || []), ...(result.observations || [])]
                    .map((item) => `${item.code}: ${item.message}`).join(" · ") ||
                "ARCA rechazó el comprobante.",
            );
        }
        await persistAuthorizedDraft({
            ref,
            result: {...result, voucherNumber},
            uid: request.auth.uid,
            source: "FECAESolicitar",
        });
        return {draft: serializeValue({
            ...draft,
            ...result,
            voucherNumber,
            status: "authorized",
        })};
    } catch (error) {
        if (!(error instanceof HttpsError)) {
            await ref.update({
                status: "pending_reconciliation",
                lastError: cleanText(error.message, 500),
                updatedAt: FieldValue.serverTimestamp(),
                updatedBy: request.auth.uid,
            });
            throw new HttpsError(
                "unavailable",
                "La respuesta de ARCA no pudo confirmarse. Reintentá para reconciliar sin duplicar.",
            );
        }
        throw error;
    } finally {
        await releaseIssueLock(lock).catch((error) => {
            console.warn("No se pudo liberar el bloqueo de emisión ARCA.", {
                draftId: draft.id,
                message: cleanText(error.message, 200),
            });
        });
    }
});

const persistProductionAuthorization = async ({
    previewRef,
    preview,
    result,
    uid,
    source,
}) => {
    if (!result?.cae) throw new Error("ARCA no devolvió un CAE válido.");
    const voucherNumber = Number(result.voucherNumber || preview.proposedVoucherNumber || 0);
    const obligationRef = db.collection("inmobiliarias").doc(preview.inmobiliariaId)
        .collection("rental_obligations").doc(preview.obligationId);
    const auditRef = db.collection(AUDIT_COLLECTION).doc();
    const batch = db.batch();
    batch.update(previewRef, {
        status: "authorized",
        cae: result.cae,
        caeExpirationDate: result.caeExpirationDate || "",
        voucherNumber,
        voucherDate: result.voucherDate || "",
        observations: result.observations || [],
        arcaResult: result.result || "A",
        authorizationSource: source,
        authorizedAt: FieldValue.serverTimestamp(),
        productionInvoiceIssuanceEnabled: true,
        sequenceReserved: true,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: uid,
    });
    batch.update(obligationRef, {
        arcaProductionInvoice: {
            authorized: true,
            environment: "prod",
            previewId: preview.id,
            issuerProfileId: preview.issuerProfileId,
            pointOfSale: Number(preview.pointOfSale),
            voucherType: Number(preview.voucherType),
            voucherNumber,
            voucherDate: result.voucherDate || preview.invoiceDate,
            amountMinor: Number(preview.amountMinor),
            cae: result.cae,
            caeExpirationDate: result.caeExpirationDate || "",
            authorizedAt: FieldValue.serverTimestamp(),
            authorizedBy: uid,
        },
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: uid,
    });
    batch.set(auditRef, {
        action: "arca_production_invoice_authorized",
        environment: "prod",
        inmobiliariaId: preview.inmobiliariaId,
        profileId: preview.issuerProfileId,
        previewId: preview.id,
        obligationId: preview.obligationId,
        pointOfSale: Number(preview.pointOfSale),
        voucherType: Number(preview.voucherType),
        voucherNumber,
        cae: result.cae,
        source,
        performedBy: uid,
        performedAt: FieldValue.serverTimestamp(),
    });
    await batch.commit();
};

export const arcaAuthorizeProductionRentalInvoice = onCall({
    region: REGION,
    secrets: arcaProdSecrets,
    timeoutSeconds: 60,
}, async (request) => {
    await assertRoot(request.auth?.uid);
    if (request.data?.confirmProduction !== true ||
        cleanText(request.data?.confirmationText, 30).toUpperCase() !== "EMITIR") {
        throw new HttpsError(
            "failed-precondition",
            "La emisión real requiere escribir EMITIR y confirmar expresamente la operación.",
        );
    }
    const inmobiliariaId = cleanText(request.data?.inmobiliariaId, 128);
    const previewId = cleanText(request.data?.previewId, 128);
    if (!inmobiliariaId || !previewId) {
        throw new HttpsError("invalid-argument", "Faltan la inmobiliaria o la vista previa productiva.");
    }
    const ref = productionPreviewRef(inmobiliariaId, previewId);
    let snap = await ref.get();
    if (!snap.exists) throw new HttpsError("not-found", "La vista previa de Producción no existe.");
    let preview = {id: snap.id, ...(snap.data() || {})};
    if (preview.status === "authorized" && preview.cae) {
        return {preview: serializeValue(preview)};
    }
    if (preview.environment !== "prod" || preview.inmobiliariaId !== inmobiliariaId ||
        preview.productionInvoiceIssuanceEnabled !== true) {
        throw new HttpsError(
            "failed-precondition",
            "Actualizá la vista previa de Producción antes de emitir.",
        );
    }
    if (cleanText(request.data?.sequenceObservedAt, 60) !==
        cleanText(preview.sequenceObservedAt, 60)) {
        throw new HttpsError(
            "failed-precondition",
            "La vista previa cambió. Revisala nuevamente antes de emitir.",
        );
    }
    const profile = await getProfile(preview.issuerProfileId);
    assertProductionProfileForAgency(profile, inmobiliariaId);
    assertProductionPreparationReady(profile);
    inspectProductionCertificateForProfile(profile);
    const documents = await getRentalDocuments({
        inmobiliariaId,
        contractId: preview.contractId,
        obligationId: preview.obligationId,
    });
    const ownerIds = Array.isArray(documents.contract.partyIds?.owners) ?
        documents.contract.partyIds.owners : [];
    if (profile.issuerPartyId && !ownerIds.includes(profile.issuerPartyId)) {
        throw new HttpsError(
            "failed-precondition",
            "El emisor fiscal seleccionado no es locador de este contrato.",
        );
    }
    const errors = validateArcaInvoiceDraft(preview, {
        requestDateKey: todayArgentina(),
        allowedEnvironments: ["prod"],
    });
    if (errors.length) throw new HttpsError("failed-precondition", errors.join(" "));

    const previousStatus = preview.status;
    const lock = await acquireIssueLock({
        profile,
        draft: preview,
        uid: request.auth.uid,
        environment: "prod",
        documentRef: ref,
    });
    try {
        snap = await ref.get();
        preview = {id: snap.id, ...(snap.data() || {})};
        const auth = await getWsfeAuth(profile, "prod");
        if (["pending_reconciliation", "authorizing"].includes(previousStatus) &&
            Number(preview.proposedVoucherNumber) > 0) {
            const recovered = await getExistingVoucher({
                profile,
                draft: preview,
                auth,
                environment: "prod",
            });
            if (recovered?.cae) {
                await persistProductionAuthorization({
                    previewRef: ref,
                    preview,
                    result: recovered,
                    uid: request.auth.uid,
                    source: "production_reconciliation",
                });
                return {preview: serializeValue({
                    ...preview,
                    ...recovered,
                    status: "authorized",
                })};
            }
        }
        const lastXml = buildWsfeLastAuthorizedRequest({
            ...auth,
            pointOfSale: profile.pointOfSale,
            voucherType: profile.voucherType,
        });
        const lastResponse = await callWsfe({
            action: "FECompUltimoAutorizado",
            xml: lastXml,
            environment: "prod",
        });
        const voucherNumber = parseWsfeLastAuthorizedResponse(lastResponse) + 1;
        await ref.update({
            proposedVoucherNumber: voucherNumber,
            authorizationRequestStartedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
            updatedBy: request.auth.uid,
        });
        preview = {...preview, proposedVoucherNumber: voucherNumber};
        const requestDateKey = todayArgentina();
        const caeXml = buildWsfeCaeRequest({
            draft: preview,
            ...auth,
            voucherNumber,
            requestDateKey,
        });
        const caeResponse = await callWsfe({
            action: "FECAESolicitar",
            xml: caeXml,
            environment: "prod",
        });
        const result = parseWsfeCaeResponse(caeResponse);
        if (!result.cae || result.result !== "A") {
            await ref.update({
                status: "rejected",
                arcaResult: result.result || "R",
                errors: result.errors || [],
                observations: result.observations || [],
                updatedAt: FieldValue.serverTimestamp(),
                updatedBy: request.auth.uid,
            });
            throw new HttpsError(
                "failed-precondition",
                [...(result.errors || []), ...(result.observations || [])]
                    .map((item) => `${item.code}: ${item.message}`).join(" · ") ||
                    "ARCA rechazó el comprobante de Producción.",
            );
        }
        await persistProductionAuthorization({
            previewRef: ref,
            preview,
            result: {...result, voucherNumber},
            uid: request.auth.uid,
            source: "FECAESolicitar_PROD",
        });
        return {preview: serializeValue({
            ...preview,
            ...result,
            voucherNumber,
            status: "authorized",
        })};
    } catch (error) {
        if (!(error instanceof HttpsError)) {
            await ref.update({
                status: "pending_reconciliation",
                lastError: cleanText(error.message, 500),
                updatedAt: FieldValue.serverTimestamp(),
                updatedBy: request.auth.uid,
            });
            throw new HttpsError(
                "unavailable",
                "La respuesta de ARCA Producción no pudo confirmarse. Reintentá para reconciliar sin duplicar.",
            );
        }
        throw error;
    } finally {
        await releaseIssueLock(lock).catch((error) => {
            console.warn("No se pudo liberar el bloqueo de emisión ARCA Producción.", {
                previewId,
                message: cleanText(error.message, 200),
            });
        });
    }
});
