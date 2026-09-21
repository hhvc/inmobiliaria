import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
const assetsDirectory = path.join(directory, "assets");
const parentAssets = path.resolve(directory, "..", "assets");
const ffmpeg = process.argv[2];
const playwrightModule = process.argv[3];
const chromeExecutable = process.argv[4];

if (!ffmpeg || !playwrightModule || !chromeExecutable) {
    throw new Error("Uso: node generate.mjs <ffmpeg.exe> <playwright/index.mjs> <chrome.exe>");
}

fs.mkdirSync(assetsDirectory, { recursive: true });
const { chromium } = await import(pathToFileURL(playwrightModule).href);

if (!process.argv.includes("--reuse-captures")) {
    const browser = await chromium.launch({
        executablePath: chromeExecutable,
        headless: true,
        args: ["--disable-dev-shm-usage"],
    });

    try {
        const page = await browser.newPage({
            viewport: { width: 1280, height: 850 },
            deviceScaleFactor: 1,
            colorScheme: "light",
        });
        const capture = async (url, name, scrollY = 0, height = 760, width = 1280, x = 0) => {
            await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
            await page.waitForTimeout(1800);
            if (scrollY) {
                await page.evaluate((y) => window.scrollTo(0, y), scrollY);
                await page.waitForTimeout(700);
            }
            await page.screenshot({
                path: path.join(assetsDirectory, name),
                clip: { x, y: 0, width, height },
            });
        };
        await capture("https://onoprop.com/inmuebles?origen=reel_catalogo", "portal-publico.png", 0, 500, 900, 80);
        await capture("https://onoprop.com/software-para-inmobiliarias?origen=reel_catalogo", "modulos-publicos.png", 760);
    } finally {
        await browser.close();
    }
}

const imageUri = (filePath) => `data:image/png;base64,${fs.readFileSync(filePath).toString("base64")}`;
const logo = imageUri(path.join(parentAssets, "logo-ono-prop.png"));
const photo = imageUri(path.join(parentAssets, "inmobiliarias-escena.png"));
const portal = imageUri(path.join(assetsDirectory, "portal-publico.png"));
const modules = imageUri(path.join(assetsDirectory, "modulos-publicos.png"));

const scenes = [
    {
        seconds: 4.3,
        kind: "photo",
        eyebrow: "SOFTWARE PARA INMOBILIARIAS",
        title: "Tu inmobiliaria<br><em>hace mucho más</em><br>que publicar.",
        subtitle: "Dale a cada tarea un lugar en ONO Prop.",
    },
    {
        seconds: 6.3,
        eyebrow: "01 · PUBLICACIÓN",
        title: "Publicá.<br><em>Mostrá tu marca.</em>",
        subtitle: "Inmuebles y emprendimientos en ONO Prop y en tu sitio propio.",
        screenshot: portal,
        chips: ["Portal inmobiliario", "Sitio propio"],
    },
    {
        seconds: 5.3,
        eyebrow: "02 · DIFUSIÓN",
        title: "Llegá a más<br><em>personas.</em>",
        subtitle: "Sumá canales de difusión a tu operación.",
        cards: ["Instagram", "Mercado Libre"],
        disclaimer: "Integraciones sujetas a habilitación de la cuenta y la plataforma.",
    },
    {
        seconds: 7.3,
        eyebrow: "03 · ADMINISTRACIÓN",
        title: "Gestioná<br><em>toda la operación.</em>",
        subtitle: "Del inmueble al cobro, sin perder el hilo.",
        cards: ["Inmuebles", "Alquileres", "Consorcios"],
    },
    {
        seconds: 6.3,
        eyebrow: "04 · ANÁLISIS",
        title: "Decidí con<br><em>más información.</em>",
        subtitle: "Tasaciones, mapas y datos de parcelas.",
        screenshot: modules,
        chips: ["Tasaciones", "Mapas y parcelas"],
    },
    {
        seconds: 5.3,
        eyebrow: "05 · COBROS",
        title: "Cobrá.<br><em>Liquidá. Facturá.</em>",
        subtitle: "Herramientas para ordenar la cuenta corriente.",
        cards: ["Mercado Pago", "Liquidaciones", "Facturación ARCA"],
    },
    {
        seconds: 5.3,
        kind: "photo",
        eyebrow: "ONO PROP PARA INMOBILIARIAS",
        title: "Una plataforma.<br><em>Tu marca.</em>",
        subtitle: "Elegí los módulos que necesitás.",
        cta: "PEDÍ UNA DEMOSTRACIÓN",
        url: "onoprop.com/demo",
    },
];

const baseCss = `
  * { box-sizing: border-box; }
  html, body { margin: 0; width: 1080px; height: 1920px; overflow: hidden; }
  body { font-family: 'Segoe UI', Arial, sans-serif; }
  .stage { position: relative; width: 1080px; height: 1920px; overflow: hidden;
    color: #f8fbff; background: radial-gradient(circle at 102% 15%, #116874 0%, transparent 36%),
      radial-gradient(circle at -10% 96%, #223d79 0%, transparent 40%), #07192e; }
  .stage::before { content: ''; position: absolute; inset: 0; opacity: .13;
    background: repeating-linear-gradient(90deg, transparent 0 87px, #65d8db 88px, transparent 89px); }
  .stage.photo::after { content: ''; position: absolute; inset: 0;
    background: linear-gradient(180deg, rgba(6,20,39,.82), rgba(6,20,39,.86) 42%, rgba(6,20,39,.77)); }
  .photo-bg { position: absolute; width: 100%; height: 100%; object-fit: cover; object-position: center 46%; }
  .glow { position: absolute; width: 630px; height: 630px; border-radius: 50%;
    filter: blur(105px); background: rgba(0,196,181,.19); top: 850px; left: 650px; }
  .content { position: relative; z-index: 2; padding: 280px 72px 0; }
  .brand { height: 88px; display: flex; align-items: center; justify-content: space-between; }
  .brand img { width: 286px; height: 88px; object-fit: contain; object-position: left center; }
  .brand span { font-weight: 750; font-size: 30px; letter-spacing: .08em; color: #d4e8ec; }
  .eyebrow { color: #ffce79; letter-spacing: .14em; font-weight: 780; font-size: 32px; margin-top: 78px; }
  h1 { font-size: 90px; line-height: 1.03; letter-spacing: -.045em; margin: 30px 0 25px;
    font-weight: 810; max-width: 930px; text-wrap: balance; }
  h1 em { color: #64e1d2; font-style: normal; }
  .subtitle { font-size: 45px; line-height: 1.26; color: #e5eff2; max-width: 915px; margin: 0; font-weight: 500; }
  .browser { margin-top: 88px; width: 936px; border: 10px solid rgba(255,255,255,.28); border-radius: 31px;
    overflow: hidden; background: #fff; box-shadow: 0 36px 80px rgba(0,0,0,.4); }
  .browser-top { height: 53px; background: #e9f0f3; display: flex; gap: 12px; align-items: center; padding-left: 26px; }
  .browser-top i { width: 13px; height: 13px; border-radius: 50%; background: #8ca4b0; }
  .browser img { display: block; width: 100%; height: 510px; object-fit: cover; object-position: top left; }
  .chips { display: flex; gap: 18px; flex-wrap: wrap; margin-top: 38px; }
  .chips span { border-radius: 100px; border: 2px solid rgba(100,225,210,.7); padding: 16px 24px;
    font-size: 31px; font-weight: 700; color: #e4fffb; background: rgba(2,67,75,.55); }
  .cards { display: grid; gap: 23px; margin-top: 84px; }
  .cards.two { grid-template-columns: 1fr 1fr; }
  .card { min-height: 148px; display: flex; align-items: center; gap: 28px; padding: 22px 26px;
    background: rgba(255,255,255,.12); border: 2px solid rgba(255,255,255,.24); border-radius: 25px;
    backdrop-filter: blur(6px); font-size: 43px; font-weight: 730; }
  .card b { display: grid; place-items: center; flex: none; width: 75px; height: 75px; border-radius: 20px;
    font-size: 31px; background: #14b5ac; color: #041923; }
  .disclaimer { font-size: 30px; color: #d6e5eb; margin-top: 36px; line-height: 1.2; }
  .cta { display: inline-block; margin-top: 88px; padding: 25px 36px; border-radius: 22px;
    background: #ffcd70; color: #08213a; font-size: 40px; letter-spacing: .015em; font-weight: 850; }
  .url { font-size: 43px; color: #fff; font-weight: 700; margin-top: 33px; }
  .footer { position: absolute; z-index: 2; left: 72px; right: 72px; bottom: 180px;
    display: flex; justify-content: space-between; align-items: center; color: #bdd4dc; font-size: 28px; }
  .footer::before { content: ''; position: absolute; width: 100%; top: -40px; height: 3px; background: rgba(255,255,255,.25); }
`;

const renderHtml = (scene, index) => {
    const cards = scene.cards?.length
        ? `<div class="cards ${scene.cards.length === 2 ? "two" : ""}">${scene.cards.map((label, i) =>
            `<div class="card"><b>${String(i + 1).padStart(2, "0")}</b><span>${label}</span></div>`).join("")}</div>`
        : "";
    const screenshot = scene.screenshot
        ? `<div class="browser"><div class="browser-top"><i></i><i></i><i></i></div><img src="${scene.screenshot}"></div>`
        : "";
    const chips = scene.chips?.length
        ? `<div class="chips">${scene.chips.map((chip) => `<span>${chip}</span>`).join("")}</div>`
        : "";
    return `<!doctype html><html><head><meta charset="utf-8"><style>${baseCss}</style></head>
        <body><section class="stage ${scene.kind || ""}">
          ${scene.kind === "photo" ? `<img class="photo-bg" src="${photo}">` : `<div class="glow"></div>`}
          <div class="content"><div class="brand"><img src="${logo}"><span>ONO PROP</span></div>
            <div class="eyebrow">${scene.eyebrow}</div><h1>${scene.title}</h1>
            <p class="subtitle">${scene.subtitle}</p>${screenshot}${chips}${cards}
            ${scene.disclaimer ? `<p class="disclaimer">${scene.disclaimer}</p>` : ""}
            ${scene.cta ? `<div class="cta">${scene.cta}</div><div class="url">${scene.url}</div>` : ""}
          </div><div class="footer"><span>onoprop.com · Software modular</span><span>${index + 1} / ${scenes.length}</span></div>
        </section></body></html>`;
};

const slideBrowser = await chromium.launch({ executablePath: chromeExecutable, headless: true });
try {
    const page = await slideBrowser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
    for (let index = 0; index < scenes.length; index++) {
        await page.setContent(renderHtml(scenes[index], index), { waitUntil: "load" });
        await page.screenshot({ path: path.join(assetsDirectory, `escena-${String(index + 1).padStart(2, "0")}.png`) });
    }
} finally {
    await slideBrowser.close();
}

const run = (args) => {
    const result = spawnSync(ffmpeg, args, { stdio: "inherit", maxBuffer: 16 * 1024 * 1024 });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`FFmpeg terminó con código ${result.status}`);
};

const transition = 0.35;
const args = ["-hide_banner", "-loglevel", "error", "-y"];
scenes.forEach((scene, index) => {
    args.push("-loop", "1", "-framerate", "24", "-t", String(scene.seconds),
        "-i", path.join(assetsDirectory, `escena-${String(index + 1).padStart(2, "0")}.png`));
});

const filters = scenes.map((scene, index) =>
    `[${index}:v]fps=24,format=yuv420p,setsar=1[v${index}]`);
let previous = "v0";
let offset = 0;
for (let index = 1; index < scenes.length; index++) {
    offset += scenes[index - 1].seconds - transition;
    const next = `x${index}`;
    filters.push(`[${previous}][v${index}]xfade=transition=fade:duration=${transition}:offset=${offset.toFixed(2)}[${next}]`);
    previous = next;
}
const silentVideo = path.join(directory, "ONO_Prop_Reel_Plataforma_Inmobiliarias.mp4");
args.push("-filter_complex", filters.join(";"), "-map", `[${previous}]`, "-r", "24",
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p",
    "-movflags", "+faststart", silentVideo);
run(args);

fs.copyFileSync(path.join(assetsDirectory, "escena-01.png"),
    path.join(directory, "ONO_Prop_Reel_Plataforma_Inmobiliarias_Cover.png"));
console.log(`Vídeo sin audio: ${silentVideo}`);
