import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const playwrightModule = process.argv[2];
const chromeExecutable = process.argv[3];

if (!playwrightModule || !chromeExecutable) {
  throw new Error("Uso: node scripts/generate-default-social-preview.mjs <playwright> <chrome>");
}

const outputPath = path.resolve(
  "public",
  "assets",
  "img",
  "og",
  "onoprop-social-preview.png",
);
const logoPath = path.resolve("public", "assets", "img", "logoONOProp3.png");
const logo = await fs.readFile(logoPath);
const logoDataUrl = `data:image/png;base64,${logo.toString("base64")}`;

await fs.mkdir(path.dirname(outputPath), { recursive: true });

const { chromium } = await import(pathToFileURL(playwrightModule).href);
const browser = await chromium.launch({ executablePath: chromeExecutable, headless: true });

try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await page.setContent(`<!doctype html>
    <html lang="es">
      <head>
        <meta charset="utf-8" />
        <style>
          * { box-sizing: border-box; }
          html, body { width: 1200px; height: 630px; margin: 0; overflow: hidden; }
          body {
            color: #f8fbff;
            font-family: Arial, Helvetica, sans-serif;
            background:
              radial-gradient(circle at 87% 18%, rgba(58, 213, 193, .3), transparent 31%),
              radial-gradient(circle at 8% 108%, rgba(42, 104, 188, .5), transparent 43%),
              linear-gradient(120deg, #061426, #0a2846 64%, #0c3847);
          }
          .grid {
            position: absolute;
            inset: 0;
            opacity: .08;
            background-image:
              linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px);
            background-size: 54px 54px;
          }
          .ring {
            position: absolute;
            right: -145px;
            top: -235px;
            width: 610px;
            height: 610px;
            border: 78px solid rgba(67, 224, 207, .68);
            border-radius: 50%;
          }
          main { position: relative; height: 100%; padding: 62px 72px; }
          .logo {
            width: 430px;
            height: 155px;
            object-fit: contain;
            object-position: left center;
          }
          .eyebrow {
            margin: 40px 0 14px;
            color: #64e1d2;
            font-size: 20px;
            font-weight: 900;
            letter-spacing: 3px;
            text-transform: uppercase;
          }
          h1 {
            max-width: 930px;
            margin: 0;
            font-size: 62px;
            line-height: 1.02;
            letter-spacing: -2.5px;
          }
          h1 span { color: #64e1d2; }
          .lead {
            max-width: 900px;
            margin-top: 22px;
            color: #d2e1e9;
            font-size: 25px;
            line-height: 1.35;
          }
          footer {
            position: absolute;
            left: 72px;
            right: 72px;
            bottom: 42px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding-top: 20px;
            border-top: 3px solid rgba(255,255,255,.72);
            font-size: 19px;
            font-weight: 800;
          }
          footer strong { color: #64e1d2; }
        </style>
      </head>
      <body>
        <div class="grid"></div>
        <div class="ring"></div>
        <main>
          <img class="logo" src="${logoDataUrl}" alt="ONO Prop" />
          <p class="eyebrow">Portal y software inmobiliario</p>
          <h1>Publicá. Administrá.<br /><span>Hacé crecer tu actividad.</span></h1>
          <p class="lead">Inmuebles, alquileres, consorcios, tasaciones y herramientas digitales en una plataforma modular.</p>
          <footer>
            <strong>ONO Prop</strong>
            <span>onoprop.com</span>
          </footer>
        </main>
      </body>
    </html>`);
  await page.screenshot({ path: outputPath, type: "png" });
} finally {
  await browser.close();
}

console.log(outputPath);
