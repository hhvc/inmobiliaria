import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const playwrightModule = process.argv[2];
const chromeExecutable = process.argv[3];

if (!playwrightModule || !chromeExecutable) {
  throw new Error("Uso: node scripts/generate-consortium-social-preview.mjs <playwright> <chrome>");
}

const outputPath = path.resolve(
  "public",
  "assets",
  "img",
  "og",
  "onoprop-administracion-consorcios.png",
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
            color: #f7fbfd;
            font-family: Arial, Helvetica, sans-serif;
            background:
              radial-gradient(circle at 82% 20%, rgba(58, 213, 193, .28), transparent 33%),
              radial-gradient(circle at 13% 105%, rgba(43, 102, 179, .42), transparent 44%),
              #071a31;
          }
          .grid {
            position: absolute;
            inset: 0;
            opacity: .08;
            background-image:
              linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px);
            background-size: 52px 52px;
          }
          main { position: relative; height: 100%; padding: 50px 62px; }
          .logo { width: 280px; height: 100px; object-fit: contain; object-position: left center; }
          .eyebrow {
            margin: 30px 0 14px;
            color: #ffd37f;
            font-size: 20px;
            font-weight: 800;
            letter-spacing: 2.5px;
            text-transform: uppercase;
          }
          h1 { width: 760px; margin: 0; font-size: 58px; line-height: 1.02; letter-spacing: -2px; }
          h1 span { color: #64e1d2; }
          .lead { width: 740px; margin: 20px 0 0; color: #c8dce3; font-size: 23px; line-height: 1.35; }
          .benefits { display: flex; gap: 12px; margin-top: 28px; }
          .benefit {
            padding: 11px 17px;
            border: 1px solid rgba(100,225,210,.45);
            border-radius: 999px;
            background: rgba(255,255,255,.07);
            font-size: 17px;
            font-weight: 700;
          }
          .offer {
            position: absolute;
            right: 58px;
            top: 84px;
            width: 275px;
            padding: 26px;
            border-radius: 24px;
            color: #071a31;
            background: linear-gradient(145deg, #f7fbfd, #dff9f5);
            box-shadow: 0 24px 55px rgba(0,0,0,.28);
          }
          .offer small { display: block; color: #08796d; font-size: 16px; font-weight: 800; text-transform: uppercase; }
          .price { margin: 10px 0 0; font-size: 48px; font-weight: 900; letter-spacing: -2px; }
          .unit { font-size: 17px; font-weight: 700; line-height: 1.25; }
          .pilot { margin-top: 22px; padding-top: 18px; border-top: 1px solid rgba(7,26,49,.18); font-size: 17px; line-height: 1.35; }
          footer {
            position: absolute;
            left: 62px;
            right: 62px;
            bottom: 30px;
            display: flex;
            justify-content: space-between;
            color: #f7fbfd;
            font-size: 18px;
            font-weight: 700;
          }
          footer strong { color: #64e1d2; }
        </style>
      </head>
      <body>
        <div class="grid"></div>
        <main>
          <img class="logo" src="${logoDataUrl}" alt="ONO Prop" />
          <p class="eyebrow">Administración de consorcios</p>
          <h1>Menos tareas dispersas.<br /><span>Más control.</span></h1>
          <p class="lead">Liquidaciones, cobranzas, cuentas corrientes, documentación y comunicación en un mismo circuito.</p>
          <div class="benefits">
            <span class="benefit">Expensas</span>
            <span class="benefit">Cobranzas</span>
            <span class="benefit">Portal del consorcista</span>
          </div>
          <aside class="offer">
            <small>Piloto acompañado</small>
            <div class="price">$1.000</div>
            <div class="unit">por unidad funcional por mes</div>
            <div class="pilot">30 días de puesta en marcha acompañada.</div>
          </aside>
          <footer>
            <span><strong>Solicitá una demostración</strong></span>
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
