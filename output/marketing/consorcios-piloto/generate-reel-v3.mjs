import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
const assetsDirectory = path.join(directory, "assets-v3");
const projectRoot = path.resolve(directory, "..", "..", "..");
const playwrightModule = process.argv[2];
const chromeExecutable = process.argv[3];
const ffmpegExecutable = process.argv[4] || path.join(
  projectRoot,
  ".codex-tmp",
  "ffmpeg",
  "node_modules",
  "ffmpeg-static",
  "ffmpeg.exe",
);

if (!playwrightModule || !chromeExecutable || !fs.existsSync(ffmpegExecutable)) {
  throw new Error("Uso: node generate-reel-v3.mjs <playwright/index.mjs> <chrome.exe> [ffmpeg.exe]");
}

fs.mkdirSync(assetsDirectory, { recursive: true });

const { chromium } = await import(pathToFileURL(playwrightModule).href);
const logoPath = path.join(projectRoot, "public", "assets", "img", "logoONOProp3.png");
const logo = `data:image/png;base64,${fs.readFileSync(logoPath).toString("base64")}`;

const scenes = [
  {
    seconds: 2.4,
    theme: "lime",
    eyebrow: "ADMINISTRACIÓN DE CONSORCIOS",
    title: "MÁS CLARO.<br><strong>MÁS RÁPIDO.</strong>",
    subtitle: "Un solo circuito para administrar e informar.",
    visual: `<div class="impact-stamp">TODO CONECTADO <span>→</span></div>`,
  },
  {
    seconds: 2.6,
    theme: "ink",
    eyebrow: "LIQUIDACIONES",
    title: "EXPENSAS<br><strong>SIN VUELTAS.</strong>",
    subtitle: "Cargá gastos, distribuí importes y calculá intereses.",
    visual: `<div class="benefit-row"><span>GASTOS</span><span>EXPENSAS</span><span>INTERESES</span></div>`,
  },
  {
    seconds: 2.6,
    theme: "blue",
    eyebrow: "COBRANZAS",
    title: "COBRÁ CON<br><strong>CONTROL.</strong>",
    subtitle: "Pagos, comprobantes, recibos y cuenta corriente.",
    visual: `<div class="big-number"><b>100%</b><span>TRAZABLE</span></div>`,
  },
  {
    seconds: 2.7,
    theme: "coral",
    eyebrow: "MI CONSORCIO",
    title: "MENOS CONSULTAS<br><strong>REPETIDAS.</strong>",
    subtitle: "Cada consorcista encuentra su información cuando la necesita.",
    visual: `<div class="benefit-grid"><span>DEUDA</span><span>PAGOS</span><span>DOCUMENTOS</span><span>AVISOS</span></div>`,
  },
  {
    seconds: 2.7,
    theme: "aqua",
    eyebrow: "TRANSPARENCIA",
    title: "INFORMACIÓN QUE<br><strong>GENERA CONFIANZA.</strong>",
    subtitle: "Historial, permisos, proveedores y comunicaciones ordenadas.",
    visual: `<div class="underline-message">TODO EN UN SOLO LUGAR.</div>`,
  },
  {
    seconds: 3.8,
    theme: "night",
    eyebrow: "PILOTO ACOMPAÑADO · 30 DÍAS",
    title: "PROBALO CON TU<br><strong>PRIMER CONSORCIO.</strong>",
    subtitle: "Demostración inicial gratuita.",
    visual: `
      <div class="price-lockup"><b>$1.000</b><span>POR UNIDAD FUNCIONAL / MES</span></div>
      <div class="call-to-action">ESCRIBÍ <b>“PILOTO”</b> POR DM</div>
      <div class="conditions">Mínimo mensual $20.000 · Condiciones sujetas a confirmación.</div>`,
  },
];

const css = `
  * { box-sizing: border-box; }
  html, body { width: 1080px; height: 1920px; margin: 0; overflow: hidden; }
  body { font-family: "Arial Black", "Segoe UI", Arial, sans-serif; }
  .stage { --bg:#101820; --fg:#fff; --accent:#d7ff00; position:relative; width:1080px; height:1920px; overflow:hidden; color:var(--fg); background:var(--bg); }
  .stage::before { content:""; position:absolute; inset:-180px; opacity:.22; transform:rotate(-10deg);
    background:repeating-linear-gradient(90deg, transparent 0 116px, currentColor 118px 121px, transparent 123px 238px); }
  .stage::after { content:""; position:absolute; width:760px; height:760px; right:-380px; top:-310px; border:85px solid var(--accent); border-radius:50%; opacity:.92; }
  .lime { --bg:#d7ff00; --fg:#071221; --accent:#ff375f; }
  .ink { --bg:#08111f; --fg:#fff; --accent:#d7ff00; }
  .blue { --bg:#1748ff; --fg:#fff; --accent:#ffe500; }
  .coral { --bg:#ff3f5f; --fg:#fff; --accent:#071221; }
  .aqua { --bg:#00d6c5; --fg:#071d2c; --accent:#ff375f; }
  .night { --bg:#071426; --fg:#fff; --accent:#d7ff00; }
  .lime .brand img, .aqua .brand img { filter:brightness(0); }
  .lime::before, .aqua::before { opacity:.12; }
  .content { position:relative; z-index:2; height:100%; padding:150px 64px 245px; display:flex; flex-direction:column; }
  .brand { display:flex; align-items:center; justify-content:space-between; min-height:75px; }
  .brand img { width:265px; height:76px; object-fit:contain; object-position:left center; }
  .brand span { padding:13px 20px; border:3px solid currentColor; border-radius:100px; font:800 20px/1 "Segoe UI",Arial,sans-serif; letter-spacing:.1em; }
  .eyebrow { margin-top:125px; font:900 27px/1 "Segoe UI",Arial,sans-serif; letter-spacing:.16em; text-transform:uppercase; }
  h1 { max-width:970px; margin:31px 0 32px; font-size:112px; line-height:.92; letter-spacing:-.066em; text-transform:uppercase; }
  h1 strong { color:var(--accent); font-weight:950; }
  .lime h1 strong, .aqua h1 strong { color:var(--fg); text-decoration:underline; text-decoration-color:var(--accent); text-decoration-thickness:16px; text-underline-offset:12px; }
  .subtitle { max-width:890px; margin:0; font:750 38px/1.18 "Segoe UI",Arial,sans-serif; letter-spacing:-.025em; }
  .visual { margin-top:auto; margin-bottom:20px; }
  .footer { position:absolute; z-index:3; left:64px; right:64px; bottom:110px; display:flex; justify-content:space-between; align-items:center;
    padding-top:25px; border-top:5px solid currentColor; font:900 25px/1 "Segoe UI",Arial,sans-serif; letter-spacing:.05em; }
  .footer strong { color:var(--accent); }
  .lime .footer strong, .aqua .footer strong { color:var(--fg); }
  .corner-number { position:absolute; z-index:1; right:-20px; bottom:70px; color:var(--accent); opacity:.12; font-size:620px; line-height:.75; letter-spacing:-.14em; }

  .impact-stamp { display:inline-flex; align-items:center; gap:25px; padding:28px 34px; color:#fff; background:#071221; border:7px solid #071221;
    box-shadow:20px 20px 0 #ff375f; font-size:43px; font-weight:950; letter-spacing:.025em; transform:rotate(-2deg); }
  .impact-stamp span { color:#d7ff00; font-size:62px; line-height:.7; }
  .benefit-row { display:flex; flex-wrap:wrap; gap:17px; }
  .benefit-row span { padding:22px 27px; border:5px solid var(--accent); color:var(--accent); font-size:31px; font-weight:950; letter-spacing:.05em; }
  .benefit-row span:nth-child(2) { color:#071221; background:var(--accent); transform:rotate(-2deg); }
  .big-number { display:flex; align-items:flex-end; gap:28px; padding:28px 0 10px; border-bottom:15px solid var(--accent); }
  .big-number b { color:var(--accent); font-size:150px; line-height:.72; letter-spacing:-.08em; }
  .big-number span { max-width:230px; padding-bottom:3px; font-size:37px; line-height:.86; }
  .benefit-grid { display:grid; grid-template-columns:1fr 1fr; gap:15px; }
  .benefit-grid span { padding:25px 24px; color:#071221; background:#fff; border:5px solid #071221; box-shadow:10px 10px 0 #071221; font-size:31px; font-weight:950; text-align:center; }
  .benefit-grid span:nth-child(2), .benefit-grid span:nth-child(3) { color:#fff; background:#071221; }
  .underline-message { display:inline-block; padding:24px 28px; color:#fff; background:#071d2c; border-left:18px solid var(--accent); font-size:39px; font-weight:950; box-shadow:14px 14px 0 rgba(7,29,44,.22); }
  .price-lockup { display:flex; align-items:flex-end; gap:27px; padding-bottom:24px; border-bottom:9px solid var(--accent); }
  .price-lockup b { color:var(--accent); font-size:138px; line-height:.76; letter-spacing:-.075em; }
  .price-lockup span { max-width:310px; font:900 28px/.96 "Segoe UI",Arial,sans-serif; }
  .call-to-action { margin-top:29px; padding:27px 23px; color:#071426; background:var(--accent); font:900 35px/1 "Segoe UI",Arial,sans-serif; text-align:center; box-shadow:13px 13px 0 #ff375f; }
  .call-to-action b { font-weight:1000; }
  .conditions { margin-top:25px; color:#c7d2de; font:650 18px/1.25 "Segoe UI",Arial,sans-serif; text-align:center; }
`;

const sceneHtml = (scene, index) => `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head>
  <body><section class="stage ${scene.theme}"><div class="corner-number">${index + 1}</div><div class="content">
    <div class="brand"><img src="${logo}" alt="ONO Prop"><span>CONSORCIOS</span></div>
    <div class="eyebrow">${scene.eyebrow}</div>
    <h1>${scene.title}</h1>
    <p class="subtitle">${scene.subtitle}</p>
    <div class="visual">${scene.visual}</div>
  </div><div class="footer"><strong>ONOPROP.COM</strong><span>@ono.prop</span></div></section></body></html>`;

const browser = await chromium.launch({ executablePath: chromeExecutable, headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  for (let index = 0; index < scenes.length; index += 1) {
    await page.setContent(sceneHtml(scenes[index], index), { waitUntil: "load" });
    await page.screenshot({
      path: path.join(assetsDirectory, `scene-${String(index + 1).padStart(2, "0")}.png`),
    });
  }
} finally {
  await browser.close();
}

const transition = 0.16;
const duration = scenes.reduce((sum, scene) => sum + scene.seconds, 0) - transition * (scenes.length - 1);
const finalVideo = path.join(directory, "ONO_Prop_Reel_Consorcios_Impacto_v3.mp4");
const cover = path.join(directory, "ONO_Prop_Reel_Consorcios_Impacto_v3_Cover.png");
const musicPath = path.join(assetsDirectory, "music-v3.wav");

const writeEnergeticMusicWav = (filePath, seconds, sceneBoundaries) => {
  const sampleRate = 44100;
  const channels = 2;
  const bitsPerSample = 16;
  const sampleCount = Math.ceil(sampleRate * seconds);
  const dataSize = sampleCount * channels * (bitsPerSample / 8);
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * channels * (bitsPerSample / 8), 28);
  buffer.writeUInt16LE(channels * (bitsPerSample / 8), 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  const bpm = 132;
  const beat = 60 / bpm;
  const eighth = beat / 2;
  const roots = [55, 65.41, 73.42, 49];
  const bassPattern = [1, 1, 1.5, 1, 2, 1.5, 1, 1.5];
  let seed = 0x1a2b3c4d;
  const saw = (phase) => 2 * (phase - Math.floor(phase + 0.5));

  for (let sample = 0; sample < sampleCount; sample += 1) {
    const time = sample / sampleRate;
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const noise = (seed / 0xffffffff) * 2 - 1;
    const beatIndex = Math.floor(time / beat);
    const beatTime = time - beatIndex * beat;
    const eighthIndex = Math.floor(time / eighth);
    const eighthTime = time - eighthIndex * eighth;
    const barIndex = Math.floor(beatIndex / 4);
    const root = roots[barIndex % roots.length];

    const kickFrequency = 48 + 115 * Math.exp(-beatTime * 28);
    const kick = Math.sin(2 * Math.PI * kickFrequency * beatTime) * Math.exp(-beatTime * 18) * 0.62;
    const backbeat = beatIndex % 4 === 1 || beatIndex % 4 === 3;
    const snare = backbeat && beatTime < 0.19
      ? (noise * 0.23 + Math.sin(2 * Math.PI * 185 * beatTime) * 0.09) * Math.exp(-beatTime * 20)
      : 0;
    const hat = noise * Math.exp(-eighthTime * (eighthIndex % 2 ? 32 : 70)) * (eighthIndex % 2 ? 0.075 : 0.105);

    const bassFrequency = root * bassPattern[eighthIndex % bassPattern.length];
    const bass = saw(bassFrequency * time) * Math.exp(-eighthTime * 5.5) * 0.19;
    const offbeatEnvelope = eighthIndex % 2 === 1 ? Math.exp(-eighthTime * 8) : 0;
    const synth = (
      saw(root * 4 * time) +
      saw(root * 5 * time) * 0.55 +
      Math.sin(2 * Math.PI * root * 6 * time) * 0.35
    ) * offbeatEnvelope * 0.055;

    let crash = 0;
    for (const boundary of sceneBoundaries) {
      const sinceBoundary = time - boundary;
      if (sinceBoundary >= 0 && sinceBoundary < 0.34) {
        crash += noise * Math.exp(-sinceBoundary * 8) * 0.15;
      }
    }

    const fade = Math.min(1, time / 0.12, (seconds - time) / 0.55);
    const mixed = (kick + snare + hat + bass + synth + crash) * Math.max(0, fade);
    const value = Math.tanh(mixed * 1.35) * 0.78;
    const pan = 0.04 * Math.sin(time * 1.7);
    const left = Math.round(Math.max(-1, Math.min(1, value * (1 - pan))) * 32767);
    const right = Math.round(Math.max(-1, Math.min(1, value * (1 + pan))) * 32767);
    const offset = 44 + sample * 4;
    buffer.writeInt16LE(left, offset);
    buffer.writeInt16LE(right, offset + 2);
  }

  fs.writeFileSync(filePath, buffer);
};

const sceneBoundaries = [];
let boundaryTime = 0;
for (let index = 0; index < scenes.length - 1; index += 1) {
  boundaryTime += scenes[index].seconds - transition;
  sceneBoundaries.push(boundaryTime);
}
writeEnergeticMusicWav(musicPath, duration, sceneBoundaries);

const inputArgs = scenes.flatMap((scene, index) => [
  "-loop", "1",
  "-framerate", "30",
  "-t", String(scene.seconds),
  "-i", path.join(assetsDirectory, `scene-${String(index + 1).padStart(2, "0")}.png`),
]);
inputArgs.push("-i", musicPath);

const videoFilters = scenes.map((scene, index) => {
  const direction = index % 2 === 0 ? 1 : -1;
  return `[${index}:v]scale=1160:2063,crop=1080:1920:x='40+${direction * 18}*sin(t*0.85+${index})':y='71+18*cos(t*0.68+${index})',setsar=1,fps=30,trim=duration=${scene.seconds},setpts=PTS-STARTPTS[v${index}]`;
});
const transitionNames = ["slideleft", "slideup", "wipeleft", "circleopen", "slideleft"];
let accumulatedDuration = scenes[0].seconds;
let priorLabel = "v0";
const transitionFilters = [];
for (let index = 1; index < scenes.length; index += 1) {
  const offset = accumulatedDuration - transition;
  const outputLabel = `x${index}`;
  transitionFilters.push(
    `[${priorLabel}][v${index}]xfade=transition=${transitionNames[index - 1]}:duration=${transition}:offset=${offset.toFixed(2)}[${outputLabel}]`,
  );
  accumulatedDuration += scenes[index].seconds - transition;
  priorLabel = outputLabel;
}

const ffmpegArgs = [
  "-y",
  ...inputArgs,
  "-filter_complex", [...videoFilters, ...transitionFilters].join(";"),
  "-map", `[${priorLabel}]`,
  "-map", `${scenes.length}:a`,
  "-t", duration.toFixed(2),
  "-r", "30",
  "-c:v", "libx264",
  "-preset", "medium",
  "-crf", "17",
  "-profile:v", "high",
  "-pix_fmt", "yuv420p",
  "-c:a", "aac",
  "-b:a", "192k",
  "-movflags", "+faststart",
  finalVideo,
];
const encoded = spawnSync(ffmpegExecutable, ffmpegArgs, { encoding: "utf8", maxBuffer: 30 * 1024 * 1024 });
if (encoded.status !== 0) {
  throw new Error(`FFmpeg no pudo generar el reel:\n${encoded.stderr || encoded.stdout}`);
}

fs.copyFileSync(path.join(assetsDirectory, "scene-06.png"), cover);
console.log(JSON.stringify({ finalVideo, cover, duration, scenes: scenes.length }, null, 2));
