import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import QRCode from "qrcode";

const directory = path.dirname(fileURLToPath(import.meta.url));
const assetsDirectory = path.join(directory, "assets");
const projectRoot = path.resolve(directory, "..", "..", "..");
const playwrightModule = process.argv[2];
const chromeExecutable = process.argv[3];

if (!playwrightModule || !chromeExecutable) {
    throw new Error("Uso: node generate-assets.mjs <playwright/index.mjs> <chrome.exe>");
}

fs.mkdirSync(assetsDirectory, { recursive: true });

const { chromium } = await import(pathToFileURL(playwrightModule).href);
const logoPath = path.join(projectRoot, "public", "assets", "img", "logoONOProp3.png");
const logo = `data:image/png;base64,${fs.readFileSync(logoPath).toString("base64")}`;
const campaignUrl = "https://onoprop.com/software-administracion-consorcios" +
    "?utm_source=material_comercial&utm_medium=qr&utm_campaign=piloto_consorcios_2026";
const qr = await QRCode.toDataURL(campaignUrl, {
    width: 520,
    margin: 2,
    color: { dark: "#09243f", light: "#ffffff" },
    errorCorrectionLevel: "H",
});

const imageUri = (filePath) => `data:image/png;base64,${fs.readFileSync(filePath).toString("base64")}`;

const browser = await chromium.launch({
    executablePath: chromeExecutable,
    headless: true,
    args: ["--disable-dev-shm-usage"],
});

const captures = [
    { name: "landing-hero.png", url: campaignUrl, scrollY: 0 },
    { name: "landing-benefits.png", url: campaignUrl, scrollY: 760 },
    { name: "landing-pilot.png", url: campaignUrl, scrollY: 2050 },
    {
        name: "guide-overview.png",
        url: "https://onoprop.com/guias/administracion-consorcios?utm_source=material_comercial",
        scrollY: 620,
    },
];

try {
    const page = await browser.newPage({
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 1,
        colorScheme: "light",
    });
    for (const capture of captures) {
        await page.goto(capture.url, { waitUntil: "domcontentloaded", timeout: 60000 });
        await page.waitForTimeout(2000);
        if (capture.scrollY) {
            await page.evaluate((y) => window.scrollTo(0, y), capture.scrollY);
            await page.waitForTimeout(750);
        }
        await page.screenshot({
            path: path.join(assetsDirectory, capture.name),
            clip: { x: 0, y: 0, width: 1440, height: 900 },
        });
    }
} finally {
    await browser.close();
}

const screenshotUris = Object.fromEntries(captures.map((capture) => [
    capture.name,
    imageUri(path.join(assetsDirectory, capture.name)),
]));

const commonCss = `
  * { box-sizing: border-box; }
  html, body { margin: 0; overflow: hidden; }
  body { font-family: "Segoe UI", Arial, sans-serif; }
  .brand { display: flex; align-items: center; justify-content: space-between; }
  .brand img { width: 292px; height: 86px; object-fit: contain; object-position: left center; }
  .brand b { color: #d9edf1; font-size: 28px; letter-spacing: .13em; }
  .eyebrow { color: #ffd37f; font-weight: 800; letter-spacing: .12em; }
  .accent { color: #64e1d2; }
`;

const plateHtml = `<!doctype html><html><head><meta charset="utf-8"><style>
  ${commonCss}
  html, body { width: 1080px; height: 1350px; }
  .plate { position: relative; width: 1080px; height: 1350px; padding: 74px 72px;
    color: white; background: radial-gradient(circle at 102% 9%, #147a80 0%, transparent 37%),
      radial-gradient(circle at 0% 100%, #284c8b 0%, transparent 45%), #071a31; }
  .plate::before { content: ""; position: absolute; inset: 0; opacity: .1;
    background: repeating-linear-gradient(90deg, transparent 0 89px, #75e7de 90px, transparent 91px); }
  .content { position: relative; z-index: 2; }
  .eyebrow { font-size: 25px; margin-top: 65px; }
  h1 { margin: 20px 0 22px; max-width: 830px; font-size: 65px; line-height: 1.02; letter-spacing: -.035em; }
  .lead { max-width: 820px; color: #e4f1f4; font-size: 31px; line-height: 1.28; margin: 0; }
  .features { display: grid; grid-template-columns: 1fr 1fr; gap: 14px 26px; margin: 40px 0; }
  .features span { display: flex; align-items: center; gap: 12px; font-size: 25px; font-weight: 650; }
  .features span::before { content: "✓"; display: grid; place-items: center; width: 31px; height: 31px;
    flex: none; border-radius: 50%; color: #061f32; background: #64e1d2; font-size: 20px; font-weight: 900; }
  .offer { display: grid; grid-template-columns: 1fr 225px; gap: 35px; align-items: center; margin-top: 30px;
    padding: 30px 32px; border-radius: 26px; background: #fff; color: #0b2741; box-shadow: 0 26px 65px rgba(0,0,0,.24); }
  .offer h2 { margin: 0 0 12px; color: #0c756f; font-size: 32px; }
  .price { font-size: 46px; font-weight: 850; line-height: 1; }
  .price small { display: block; margin-top: 12px; color: #526777; font-size: 20px; font-weight: 600; }
  .offer p { margin: 17px 0 0; color: #334d62; font-size: 21px; line-height: 1.28; }
  .offer img { width: 225px; height: 225px; }
  .cta { display: flex; justify-content: space-between; align-items: center; margin-top: 32px; }
  .cta strong { padding: 18px 27px; border-radius: 16px; background: #ffd070; color: #09233d;
    font-size: 25px; }
  .cta span { color: #dcebef; font-size: 23px; font-weight: 650; }
</style></head><body><section class="plate"><div class="content">
  <div class="brand"><img src="${logo}"><b>ADMINISTRACIÓN DE CONSORCIOS</b></div>
  <div class="eyebrow">MENOS TAREAS DISPERSAS</div>
  <h1>Todo el consorcio<br><span class="accent">en un mismo circuito</span></h1>
  <p class="lead">Liquidaciones, cobranzas, documentación y comunicación con consorcistas bajo el control de la administración.</p>
  <div class="features">
    <span>Liquidaciones y expensas</span><span>Cuentas corrientes</span>
    <span>Pagos y comprobantes</span><span>Portal del consorcista</span>
    <span>Mensajes y reclamos</span><span>Pólizas y documentación</span>
  </div>
  <div class="offer"><div><h2>Piloto acompañado de 30 días</h2>
    <div class="price">$1.000 por unidad<small>Mínimo mensual $20.000</small></div>
    <p>Demostración gratuita. La solicitud no genera cargos ni contrataciones automáticas.</p>
  </div><img src="${qr}" alt="QR"></div>
  <div class="cta"><strong>SOLICITÁ UNA DEMOSTRACIÓN</strong><span>onoprop.com</span></div>
</div></section></body></html>`;

const scenes = [
    {
        seconds: 4.0,
        eyebrow: "ADMINISTRACIÓN DE CONSORCIOS",
        title: "¿Planillas, mensajes<br>y comprobantes<br><em>por todos lados?</em>",
        subtitle: "La gestión diaria necesita un circuito claro.",
        screenshot: screenshotUris["landing-hero.png"],
    },
    {
        seconds: 4.2,
        eyebrow: "LIQUIDACIONES Y COBRANZAS",
        title: "Cada movimiento<br><em>queda conectado.</em>",
        subtitle: "Expensas, gastos, pagos, intereses y cuentas corrientes.",
        screenshot: screenshotUris["landing-benefits.png"],
    },
    {
        seconds: 4.2,
        eyebrow: "PORTAL DEL CONSORCISTA",
        title: "Menos consultas<br><em>dispersas.</em>",
        subtitle: "Propietarios y ocupantes consultan, informan pagos y envían mensajes.",
        screenshot: screenshotUris["guide-overview.png"],
    },
    {
        seconds: 4.2,
        eyebrow: "DOCUMENTACIÓN Y COMUNICACIÓN",
        title: "Información accesible<br><em>con permisos claros.</em>",
        subtitle: "Pólizas, reglamentos, actas, emergencias y reclamos.",
        screenshot: screenshotUris["landing-pilot.png"],
    },
    {
        seconds: 4.0,
        eyebrow: "PILOTO ACOMPAÑADO",
        title: "Probalo durante<br><em>30 días.</em>",
        subtitle: "$1.000 por unidad al mes. Mínimo mensual $20.000.",
        tags: ["Demo gratuita", "Sin cargos automáticos"],
    },
    {
        seconds: 4.0,
        eyebrow: "ONO PROP",
        title: "Tu primer consorcio<br><em>puede empezar hoy.</em>",
        subtitle: "Solicitá una demostración gratuita.",
        cta: "onoprop.com/software-administracion-consorcios",
        qr,
    },
];

const reelCss = `
  ${commonCss}
  html, body { width: 1080px; height: 1920px; }
  .stage { position: relative; width: 1080px; height: 1920px; overflow: hidden; color: #f8fbff;
    background: radial-gradient(circle at 110% 12%, #147a80 0%, transparent 39%),
      radial-gradient(circle at -4% 96%, #294c87 0%, transparent 43%), #071a31; }
  .stage::before { content: ""; position: absolute; inset: 0; opacity: .105;
    background: repeating-linear-gradient(90deg, transparent 0 88px, #6de4dc 89px, transparent 90px); }
  .content { position: relative; z-index: 2; padding: 260px 70px 0; }
  .eyebrow { margin-top: 86px; font-size: 30px; }
  h1 { max-width: 940px; margin: 28px 0 24px; font-size: 84px; line-height: 1.01; letter-spacing: -.045em; }
  h1 em { color: #64e1d2; font-style: normal; }
  .subtitle { max-width: 910px; margin: 0; color: #e4f0f3; font-size: 41px; line-height: 1.25; font-weight: 520; }
  .browser { margin-top: 76px; width: 940px; height: 590px; overflow: hidden; border: 9px solid rgba(255,255,255,.3);
    border-radius: 28px; background: white; box-shadow: 0 36px 90px rgba(0,0,0,.42); }
  .browser-top { height: 48px; display: flex; align-items: center; gap: 10px; padding-left: 23px; background: #e9eff2; }
  .browser-top i { width: 12px; height: 12px; border-radius: 50%; background: #8098a5; }
  .browser img { width: 100%; height: 542px; object-fit: cover; object-position: top center; }
  .tags { display: flex; flex-wrap: wrap; gap: 18px; margin-top: 70px; }
  .tags span { padding: 18px 27px; border: 2px solid rgba(100,225,210,.75); border-radius: 100px;
    color: #e9fffc; background: rgba(2,74,78,.5); font-size: 31px; font-weight: 740; }
  .final { display: grid; grid-template-columns: 1fr 255px; gap: 38px; align-items: center; margin-top: 76px; }
  .final img { width: 255px; height: 255px; border-radius: 18px; }
  .cta { color: #ffd174; font-size: 33px; font-weight: 820; line-height: 1.28; overflow-wrap: anywhere; }
  .footer { position: absolute; left: 70px; right: 70px; bottom: 175px; z-index: 2; padding-top: 31px;
    border-top: 2px solid rgba(255,255,255,.24); color: #c2d9df; font-size: 27px; }
`;

const sceneHtml = (scene, index) => `<!doctype html><html><head><meta charset="utf-8"><style>${reelCss}</style></head>
  <body><section class="stage"><div class="content">
    <div class="brand"><img src="${logo}"><b>ONO PROP</b></div>
    <div class="eyebrow">${scene.eyebrow}</div><h1>${scene.title}</h1>
    <p class="subtitle">${scene.subtitle}</p>
    ${scene.screenshot ? `<div class="browser"><div class="browser-top"><i></i><i></i><i></i></div><img src="${scene.screenshot}"></div>` : ""}
    ${scene.tags ? `<div class="tags">${scene.tags.map((tag) => `<span>${tag}</span>`).join("")}</div>` : ""}
    ${scene.qr ? `<div class="final"><div class="cta">${scene.cta}</div><img src="${scene.qr}"></div>` : ""}
  </div><div class="footer">onoprop.com · Administración de Consorcios · ${index + 1}/${scenes.length}</div>
  </section></body></html>`;

const renderBrowser = await chromium.launch({ executablePath: chromeExecutable, headless: true });
try {
    const platePage = await renderBrowser.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 1 });
    await platePage.setContent(plateHtml, { waitUntil: "load" });
    await platePage.screenshot({ path: path.join(directory, "ONO_Prop_Piloto_Consorcios_WhatsApp.png") });

    const scenePage = await renderBrowser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
    for (let index = 0; index < scenes.length; index++) {
        await scenePage.setContent(sceneHtml(scenes[index], index), { waitUntil: "load" });
        await scenePage.screenshot({
            path: path.join(assetsDirectory, `scene-${String(index + 1).padStart(2, "0")}.png`),
        });
    }
} finally {
    await renderBrowser.close();
}

const transition = 0.30;
const duration = scenes.reduce((sum, scene) => sum + scene.seconds, 0) -
    transition * (scenes.length - 1);
const starts = [];
let timeline = 0;
for (let index = 0; index < scenes.length; index++) {
    starts.push(timeline);
    timeline += scenes[index].seconds - (index < scenes.length - 1 ? transition : 0);
}
const recordingScenes = scenes.map((scene, index) => ({
    seconds: scene.seconds,
    start: starts[index],
    image: imageUri(path.join(assetsDirectory, `scene-${String(index + 1).padStart(2, "0")}.png`)),
}));
const recorderHtml = `<!doctype html><html><body style="margin:0;background:#000">
  <canvas id="canvas" width="1080" height="1920"></canvas><button id="record">record</button>
  <script>
    const scenes = ${JSON.stringify(recordingScenes)};
    const transition = ${transition};
    const duration = ${duration};
    const canvas = document.querySelector('#canvas');
    const ctx = canvas.getContext('2d', { alpha: false });
    const images = [];
    const ready = Promise.all(scenes.map((scene) => new Promise((resolve, reject) => {
      const image = new Image(); image.onload = () => resolve(image); image.onerror = reject; image.src = scene.image;
      images.push(image);
    })));
    const draw = (elapsed) => {
      let index = scenes.length - 1;
      for (let current = 0; current < scenes.length; current++) {
        if (elapsed < scenes[current].start + scenes[current].seconds) { index = current; break; }
      }
      const scene = scenes[index];
      const local = elapsed - scene.start;
      ctx.globalAlpha = 1; ctx.drawImage(images[index], 0, 0, 1080, 1920);
      if (index < scenes.length - 1 && local > scene.seconds - transition) {
        ctx.globalAlpha = Math.min(1, (local - (scene.seconds - transition)) / transition);
        ctx.drawImage(images[index + 1], 0, 0, 1080, 1920);
        ctx.globalAlpha = 1;
      }
    };
    const scheduleMusic = (audio, output) => {
      const start = audio.currentTime + .12;
      const bpm = 112;
      const beat = 60 / bpm;
      const chords = [[146.83,220,293.66],[174.61,220,261.63],[130.81,196,261.63],[196,246.94,293.66]];
      const master = audio.createGain(); master.gain.value = .20; master.connect(output);
      for (let bar = 0; bar * beat * 4 < duration; bar++) {
        const at = start + bar * beat * 4;
        const chord = chords[bar % chords.length];
        chord.forEach((frequency) => {
          const oscillator = audio.createOscillator(); const gain = audio.createGain();
          oscillator.type = 'sine'; oscillator.frequency.value = frequency;
          gain.gain.setValueAtTime(0, at); gain.gain.linearRampToValueAtTime(.09, at + .22);
          gain.gain.setValueAtTime(.09, at + beat * 3.5); gain.gain.linearRampToValueAtTime(0, at + beat * 4);
          oscillator.connect(gain); gain.connect(master); oscillator.start(at); oscillator.stop(at + beat * 4);
        });
        for (let step = 0; step < 8; step++) {
          const noteAt = at + step * beat / 2;
          const oscillator = audio.createOscillator(); const gain = audio.createGain();
          oscillator.type = 'triangle'; oscillator.frequency.value = chord[step % chord.length] * 2;
          gain.gain.setValueAtTime(0, noteAt); gain.gain.linearRampToValueAtTime(.14, noteAt + .012);
          gain.gain.exponentialRampToValueAtTime(.001, noteAt + .32);
          oscillator.connect(gain); gain.connect(master); oscillator.start(noteAt); oscillator.stop(noteAt + .34);
        }
      }
      master.gain.setValueAtTime(.20, start + duration - .9);
      master.gain.linearRampToValueAtTime(0, start + duration);
    };
    document.querySelector('#record').addEventListener('click', async () => {
      await ready;
      const audio = new AudioContext({ sampleRate: 44100 });
      const audioOutput = audio.createMediaStreamDestination();
      scheduleMusic(audio, audioOutput);
      const stream = canvas.captureStream(24);
      audioOutput.stream.getAudioTracks().forEach((track) => stream.addTrack(track));
      const mimeType = MediaRecorder.isTypeSupported('video/mp4;codecs=avc1.42E01E,mp4a.40.2')
        ? 'video/mp4;codecs=avc1.42E01E,mp4a.40.2' : 'video/mp4';
      const recorder = new MediaRecorder(stream, {
        mimeType, videoBitsPerSecond: 9000000, audioBitsPerSecond: 160000,
      });
      const chunks = [];
      recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      recorder.onstop = () => {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(new Blob(chunks, { type: mimeType }));
        link.download = 'reel-source.mp4'; link.click();
      };
      const started = performance.now();
      draw(0); recorder.start(500);
      const timer = setInterval(() => {
        const elapsed = (performance.now() - started) / 1000;
        draw(Math.min(elapsed, duration));
        if (elapsed >= duration) { clearInterval(timer); recorder.stop(); setTimeout(() => audio.close(), 600); }
      }, 1000 / 24);
    });
  <\/script></body></html>`;

const sourceRecording = path.join(assetsDirectory, "reel-source.mp4");
const recordingBrowser = await chromium.launch({ executablePath: chromeExecutable, headless: true });
try {
    const context = await recordingBrowser.newContext({ acceptDownloads: true });
    const page = await context.newPage();
    await page.setContent(recorderHtml, { waitUntil: "load" });
    const downloadPromise = page.waitForEvent("download", { timeout: Math.ceil(duration * 1000 + 45000) });
    await page.click("#record");
    const download = await downloadPromise;
    await download.saveAs(sourceRecording);
    await context.close();
} finally {
    await recordingBrowser.close();
}

const finalVideo = path.join(directory, "ONO_Prop_Reel_Piloto_Consorcios_Con_Musica.mp4");
fs.copyFileSync(sourceRecording, finalVideo);

fs.copyFileSync(
    path.join(assetsDirectory, "scene-01.png"),
    path.join(directory, "ONO_Prop_Reel_Piloto_Consorcios_Cover.png"),
);

console.log(JSON.stringify({
    plate: path.join(directory, "ONO_Prop_Piloto_Consorcios_WhatsApp.png"),
    finalVideo,
    duration,
}, null, 2));
