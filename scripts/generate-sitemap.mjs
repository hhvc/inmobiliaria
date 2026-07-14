import fs from "node:fs";
import path from "node:path";

import admin from "firebase-admin";

const DEFAULT_SITE_URL = "https://onoprop.com";

const getSiteUrl = () => {
    return (
        process.env.SITE_URL ||
        process.env.VITE_PUBLIC_SITE_URL ||
        DEFAULT_SITE_URL
    );
};

const OUTPUT_PATH = path.resolve("public", "sitemap.xml");

const STATIC_ROUTES = [
    {
        path: "/",
        changefreq: "weekly",
        priority: "1.0",
    },
    {
        path: "/inmuebles",
        changefreq: "daily",
        priority: "0.9",
    },
];

const ENV_FILES = [".env.local", ".env"];

const loadEnvFiles = () => {
    ENV_FILES.forEach((fileName) => {
        const filePath = path.resolve(fileName);

        if (!fs.existsSync(filePath)) return;

        const content = fs.readFileSync(filePath, "utf8");

        content
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean)
            .filter((line) => !line.startsWith("#"))
            .forEach((line) => {
                const equalIndex = line.indexOf("=");

                if (equalIndex === -1) return;

                const key = line.slice(0, equalIndex).trim();
                const rawValue = line.slice(equalIndex + 1).trim();

                if (!key || process.env[key] !== undefined) return;

                const value = rawValue.replace(/^["']|["']$/g, "");

                process.env[key] = value;
            });
    });
};

const initializeFirebaseAdmin = () => {
    if (admin.apps.length > 0) {
        return admin.app();
    }

    const serviceAccountPath =
        process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
        path.resolve(".secrets", "firebase-service-account.json");

    if (fs.existsSync(serviceAccountPath)) {
        const serviceAccount = JSON.parse(
            fs.readFileSync(serviceAccountPath, "utf8"),
        );

        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            projectId: serviceAccount.project_id,
        });

        return admin.app();
    }

    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);

        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            projectId: serviceAccount.project_id,
        });

        return admin.app();
    }

    admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId:
            process.env.VITE_FIREBASE_PROJECT_ID ||
            process.env.GOOGLE_CLOUD_PROJECT ||
            process.env.GCLOUD_PROJECT,
    });

    return admin.app();
};

const normalizeBaseUrl = (value) => {
    return value.toString().replace(/\/+$/, "");
};

const normalizeSlug = (value = "") => {
    return value.toString().trim().replace(/^\/+|\/+$/g, "");
};

const buildUrl = (routePath) => {
    const baseUrl = normalizeBaseUrl(getSiteUrl());
    const cleanPath = routePath.startsWith("/") ? routePath : `/${routePath}`;

    return `${baseUrl}${cleanPath}`;
};

const escapeXml = (value = "") => {
    return value
        .toString()
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&apos;");
};

const toDate = (value) => {
    if (!value) return null;

    if (typeof value.toDate === "function") {
        return value.toDate();
    }

    if (value instanceof Date) {
        return value;
    }

    const date = new Date(value);

    return Number.isFinite(date.getTime()) ? date : null;
};

const toLastmod = (value) => {
    const date = toDate(value) || new Date();

    return date.toISOString().slice(0, 10);
};

const isNoIndex = (data = {}) => {
    return data.noIndex === true || data.seo?.noIndex === true;
};

const isPublicInmobiliaria = (data = {}) => {
    if (!data.slug) return false;
    if (data.deleted === true) return false;
    if (data.activa === false) return false;
    if (isNoIndex(data)) return false;

    return true;
};

const isPublicInmueble = (data = {}) => {
    if (!data.slug) return false;
    if (data.deleted === true) return false;
    if (data.estado !== "activo") return false;
    if (data.publicarEnPortal !== true) return false;
    if (isNoIndex(data)) return false;

    return true;
};

const getInmobiliariasPublicas = async (db) => {
    const snapshot = await db.collection("inmobiliarias").get();

    return snapshot.docs
        .map((docSnap) => ({
            id: docSnap.id,
            ...docSnap.data(),
        }))
        .filter(isPublicInmobiliaria);
};

const getInmueblesPublicosByInmobiliaria = async (db, inmobiliariaId) => {
    const snapshot = await db
        .collection("inmobiliarias")
        .doc(inmobiliariaId)
        .collection("inmuebles")
        .get();

    return snapshot.docs
        .map((docSnap) => ({
            id: docSnap.id,
            inmobiliariaId,
            ...docSnap.data(),
        }))
        .filter(isPublicInmueble);
};

const buildSitemapEntry = ({
    loc,
    lastmod,
    changefreq = "weekly",
    priority = "0.5",
}) => {
    return [
        "  <url>",
        `    <loc>${escapeXml(loc)}</loc>`,
        `    <lastmod>${escapeXml(lastmod)}</lastmod>`,
        `    <changefreq>${escapeXml(changefreq)}</changefreq>`,
        `    <priority>${escapeXml(priority)}</priority>`,
        "  </url>",
    ].join("\n");
};

const uniqueByLoc = (entries) => {
    const map = new Map();

    entries.forEach((entry) => {
        if (!entry?.loc) return;

        map.set(entry.loc, entry);
    });

    return Array.from(map.values());
};

const writeSitemap = (entries) => {
    const uniqueEntries = uniqueByLoc(entries);

    const xml = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        ...uniqueEntries.map(buildSitemapEntry),
        "</urlset>",
        "",
    ].join("\n");

    fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
    fs.writeFileSync(OUTPUT_PATH, xml, "utf8");

    return uniqueEntries.length;
};

const main = async () => {
    loadEnvFiles();
    initializeFirebaseAdmin();

    const db = admin.firestore();
    const today = new Date().toISOString().slice(0, 10);

    const entries = STATIC_ROUTES.map((route) => ({
        loc: buildUrl(route.path),
        lastmod: today,
        changefreq: route.changefreq,
        priority: route.priority,
    }));

    const inmobiliarias = await getInmobiliariasPublicas(db);

    for (const inmobiliaria of inmobiliarias) {
        const slug = normalizeSlug(inmobiliaria.slug);

        entries.push({
            loc: buildUrl(`/inmobiliaria/${slug}`),
            lastmod: toLastmod(inmobiliaria.updatedAt || inmobiliaria.createdAt),
            changefreq: "weekly",
            priority: "0.8",
        });

        const inmuebles = await getInmueblesPublicosByInmobiliaria(
            db,
            inmobiliaria.id,
        );

        inmuebles.forEach((inmueble) => {
            const inmuebleSlug = normalizeSlug(inmueble.slug);

            entries.push({
                loc: buildUrl(`/inmueble/${inmuebleSlug}`),
                lastmod: toLastmod(inmueble.updatedAt || inmueble.createdAt),
                changefreq: "weekly",
                priority: inmueble.destacado ? "0.8" : "0.7",
            });
        });
    }

    const total = writeSitemap(entries);

    console.log(`✅ Sitemap generado en ${OUTPUT_PATH}`);
    console.log(`🏢 Inmobiliarias incluidas: ${inmobiliarias.length}`);
    console.log(`🔗 URLs incluidas: ${total}`);
};

main().catch((error) => {
    console.error("❌ Error generando sitemap:", error);
    process.exit(1);
});