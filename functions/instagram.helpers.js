import { Buffer } from "node:buffer";
import crypto from "node:crypto";

export const DEFAULT_INSTAGRAM_OPENER_ORIGIN = "https://onoprop.com";

export const INSTAGRAM_ALLOWED_OPENER_ORIGINS = new Set([
    DEFAULT_INSTAGRAM_OPENER_ORIGIN,
    "https://www.onoprop.com",
    "https://inmobiliaria-bcc63.web.app",
    "https://inmobiliaria-bcc63.firebaseapp.com",
    "http://localhost:5173",
    "http://localhost:4173",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:4173",
]);

export const normalizeInstagramIdentifier = (value = "") => {
    const identifier = value?.toString?.().trim().slice(0, 200) || "";

    if (!identifier || identifier.includes("/")) return "";
    return identifier;
};

export const getInstagramConnectionLinkEntries = (connection = {}) => {
    const candidates = [
        {
            identifier: normalizeInstagramIdentifier(
                connection.instagramUserId,
            ),
            identifierType: "instagram_user_id",
        },
        {
            identifier: normalizeInstagramIdentifier(
                connection.instagramScopedId,
            ),
            identifierType: "instagram_scoped_id",
        },
        {
            identifier: normalizeInstagramIdentifier(connection.oauthUserId),
            identifierType: "oauth_user_id",
        },
    ];
    const seen = new Set();

    return candidates.filter(({ identifier }) => {
        if (!identifier || seen.has(identifier)) return false;
        seen.add(identifier);
        return true;
    });
};

export const getInstagramConnectionIdentifiers = (connection = {}) => {
    return getInstagramConnectionLinkEntries(connection)
        .map(({ identifier }) => identifier);
};

export const normalizeInstagramOpenerOrigin = (value = "") => {
    let origin;

    try {
        origin = new URL(value).origin;
    } catch {
        throw new Error("El origen de retorno de Instagram no es válido.");
    }

    if (!INSTAGRAM_ALLOWED_OPENER_ORIGINS.has(origin)) {
        throw new Error("El origen de retorno de Instagram no está autorizado.");
    }

    return origin;
};

export const parseInstagramEncryptionKey = (rawKey) => {
    const value = rawKey?.toString?.().trim().slice(0, 500) || "";

    if (/^[0-9a-fA-F]{64}$/.test(value)) {
        return Buffer.from(value, "hex");
    }

    const decoded = Buffer.from(value, "base64");
    if (decoded.length === 32) return decoded;

    throw new Error(
        "INSTAGRAM_TOKEN_ENCRYPTION_KEY debe contener exactamente 32 bytes en base64 o 64 caracteres hexadecimales.",
    );
};

export const encryptInstagramToken = (token, rawKey) => {
    if (!token) return null;

    const key = parseInstagramEncryptionKey(rawKey);
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    const encrypted = Buffer.concat([
        cipher.update(token.toString(), "utf8"),
        cipher.final(),
    ]);

    return {
        version: 1,
        algorithm: "aes-256-gcm",
        iv: iv.toString("base64"),
        tag: cipher.getAuthTag().toString("base64"),
        data: encrypted.toString("base64"),
    };
};

export const decryptInstagramToken = (encryptedToken, rawKey) => {
    if (!encryptedToken) return "";
    if (
        encryptedToken.version !== 1 ||
        encryptedToken.algorithm !== "aes-256-gcm"
    ) {
        throw new Error("El token cifrado de Instagram no tiene un formato válido.");
    }

    const key = parseInstagramEncryptionKey(rawKey);
    const decipher = crypto.createDecipheriv(
        "aes-256-gcm",
        key,
        Buffer.from(encryptedToken.iv, "base64"),
    );
    decipher.setAuthTag(Buffer.from(encryptedToken.tag, "base64"));

    return Buffer.concat([
        decipher.update(Buffer.from(encryptedToken.data, "base64")),
        decipher.final(),
    ]).toString("utf8");
};

export const verifyInstagramSignedRequest = (
    signedRequest,
    appSecret,
) => {
    const normalizedRequest =
        signedRequest?.toString?.().trim().slice(0, 10000) || "";
    const [encodedSignature, encodedPayload, extraPart] =
        normalizedRequest.split(".");

    if (!encodedSignature || !encodedPayload || extraPart) {
        throw new Error("signed_request inválido.");
    }

    const signature = Buffer.from(encodedSignature, "base64url");
    const expected = crypto
        .createHmac("sha256", appSecret?.toString?.() || "")
        .update(encodedPayload)
        .digest();

    if (
        signature.length !== expected.length ||
        !crypto.timingSafeEqual(signature, expected)
    ) {
        throw new Error("La firma de Meta no es válida.");
    }

    const payload = JSON.parse(
        Buffer.from(encodedPayload, "base64url").toString("utf8"),
    );
    const algorithm = payload?.algorithm?.toString?.().toUpperCase();

    if (algorithm && algorithm !== "HMAC-SHA256") {
        throw new Error("El algoritmo de firma de Meta no es válido.");
    }

    return payload;
};

export const isInstagramTokenRefreshDue = (
    expiresAtMs,
    nowMs = Date.now(),
    refreshMarginMs = 7 * 24 * 60 * 60 * 1000,
) => {
    const expiration = Number(expiresAtMs || 0);
    const now = Number(nowMs || 0);
    const margin = Math.max(0, Number(refreshMarginMs || 0));

    return expiration > 0 && expiration <= now + margin;
};
