import fs from "node:fs";
import path from "node:path";

import {
  DEFAULT_SITE_URL,
  writePrerenderedPages,
} from "./seo-prerender.helpers.mjs";

const DIST_PATH = path.resolve("dist");
const TEMPLATE_PATH = path.join(DIST_PATH, "index.html");
const MANIFEST_PATH = path.resolve("node_modules", ".cache", "onoprop-seo-routes.json");

if (!fs.existsSync(TEMPLATE_PATH)) {
  throw new Error("No existe dist/index.html. Ejecutá Vite antes del prerender SEO.");
}

if (!fs.existsSync(MANIFEST_PATH)) {
  throw new Error("No existe el manifiesto SEO. Ejecutá primero npm run seo:sitemap.");
}

const template = fs.readFileSync(TEMPLATE_PATH, "utf8");
const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
const routes = Array.isArray(manifest.routes) ? manifest.routes : [];
const siteUrl = manifest.siteUrl || process.env.VITE_PUBLIC_SITE_URL || DEFAULT_SITE_URL;
const count = writePrerenderedPages({ template, routes, distPath: DIST_PATH, siteUrl });

console.log(`✅ HTML SEO generado para ${count} rutas públicas.`);
