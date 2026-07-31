import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import crypto from "node:crypto";
import test from "node:test";

import {
    decryptInstagramToken,
    encryptInstagramToken,
    getInstagramConnectionIdentifiers,
    getInstagramConnectionLinkEntries,
    isInstagramTokenRefreshDue,
    isInstagramReelStorageUrl,
    normalizeInstagramMediaKind,
    normalizeInstagramOpenerOrigin,
    parseInstagramEncryptionKey,
    verifyInstagramSignedRequest,
} from "../functions/instagram.helpers.js";

test("normaliza y deduplica los identificadores de una conexión", () => {
    const connection = {
        instagramUserId: " 12345 ",
        instagramScopedId: "67890",
        oauthUserId: "12345",
    };

    assert.deepEqual(getInstagramConnectionIdentifiers(connection), [
        "12345",
        "67890",
    ]);
    assert.deepEqual(getInstagramConnectionLinkEntries(connection), [
        {
            identifier: "12345",
            identifierType: "instagram_user_id",
        },
        {
            identifier: "67890",
            identifierType: "instagram_scoped_id",
        },
    ]);
});

test("acepta únicamente los orígenes de retorno autorizados", () => {
    assert.equal(
        normalizeInstagramOpenerOrigin("https://onoprop.com/difusion"),
        "https://onoprop.com",
    );
    assert.equal(
        normalizeInstagramOpenerOrigin("http://localhost:5173/admin"),
        "http://localhost:5173",
    );
    assert.throws(
        () => normalizeInstagramOpenerOrigin("https://example.com"),
        /no está autorizado/i,
    );
});

test("cifra y descifra tokens con AES-256-GCM", () => {
    const key = crypto.randomBytes(32).toString("base64");
    const encrypted = encryptInstagramToken("token-de-prueba", key);

    assert.equal(encrypted.algorithm, "aes-256-gcm");
    assert.equal(
        decryptInstagramToken(encrypted, key),
        "token-de-prueba",
    );
    assert.equal(parseInstagramEncryptionKey(key).length, 32);
    assert.throws(
        () => parseInstagramEncryptionKey("clave-invalida"),
        /exactamente 32 bytes/i,
    );
});

test("rechaza un token cifrado alterado", () => {
    const key = crypto.randomBytes(32).toString("base64");
    const encrypted = encryptInstagramToken("token-de-prueba", key);

    encrypted.data = Buffer.from("contenido-alterado").toString("base64");
    assert.throws(() => decryptInstagramToken(encrypted, key));
});

test("verifica la firma HMAC de las solicitudes de Meta", () => {
    const appSecret = "meta-secret-de-prueba";
    const payload = Buffer.from(
        JSON.stringify({
            algorithm: "HMAC-SHA256",
            user_id: "12345",
        }),
    ).toString("base64url");
    const signature = crypto
        .createHmac("sha256", appSecret)
        .update(payload)
        .digest("base64url");
    const signedRequest = `${signature}.${payload}`;

    assert.equal(
        verifyInstagramSignedRequest(signedRequest, appSecret).user_id,
        "12345",
    );
    assert.throws(
        () => verifyInstagramSignedRequest(signedRequest, "otro-secret"),
        /firma de Meta/i,
    );
});

test("detecta cuándo corresponde renovar un token", () => {
    const now = Date.UTC(2026, 6, 31);
    const day = 24 * 60 * 60 * 1000;

    assert.equal(isInstagramTokenRefreshDue(now + 6 * day, now, 7 * day), true);
    assert.equal(isInstagramTokenRefreshDue(now + 8 * day, now, 7 * day), false);
    assert.equal(isInstagramTokenRefreshDue(0, now, 7 * day), false);
});

test("normaliza el tipo de publicación de Instagram", () => {
    assert.equal(normalizeInstagramMediaKind("reel"), "reel");
    assert.equal(normalizeInstagramMediaKind("REEL"), "reel");
    assert.equal(normalizeInstagramMediaKind("otro"), "images");
});

test("acepta únicamente videos del inmueble alojados en Firebase Storage", () => {
    const encodedPath = encodeURIComponent(
        "inmuebles/inmo-1/item-2/instagram/reel-video.mp4",
    );
    const url = `https://firebasestorage.googleapis.com/v0/b/bucket/o/${encodedPath}?alt=media&token=test`;

    assert.equal(
        isInstagramReelStorageUrl({
            url,
            inmobiliariaId: "inmo-1",
            inmuebleId: "item-2",
        }),
        true,
    );
    assert.equal(
        isInstagramReelStorageUrl({
            url,
            inmobiliariaId: "otra-inmo",
            inmuebleId: "item-2",
        }),
        false,
    );
    assert.equal(
        isInstagramReelStorageUrl({
            url: "https://example.com/video.mp4",
            inmobiliariaId: "inmo-1",
            inmuebleId: "item-2",
        }),
        false,
    );
});
