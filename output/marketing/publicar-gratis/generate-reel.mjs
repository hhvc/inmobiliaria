import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
const assetsDirectory = path.join(directory, "assets");
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
  throw new Error("Uso: node generate-reel.mjs <playwright/index.mjs> <chrome.exe> [ffmpeg.exe]");
}

fs.mkdirSync(assetsDirectory, { recursive: true });

const { chromium } = await import(pathToFileURL(playwrightModule).href);
const logoPath = path.join(projectRoot, "public", "assets", "img", "logoONOProp3.png");
const logo = `data:image/png;base64,${fs.readFileSync(logoPath).toString("base64")}`;
const exterior = `data:image/png;base64,${fs.readFileSync(path.join(assetsDirectory, "casa-exterior.png")).toString("base64")}`;
const interior = `data:image/png;base64,${fs.readFileSync(path.join(assetsDirectory, "departamento-interior.png")).toString("base64")}`;

const scenes = [
  {
    seconds: 2.7,
    theme: "photo dark-photo",
    photo: exterior,
    eyebrow: "¿QUERÉS VENDER O ALQUILAR?",
    title: "TU INMUEBLE<br><strong>MERECE VERSE.</strong>",
    subtitle: "Llegá a personas que están buscando una propiedad.",
    visual: "",
  },
  {
    seconds: 2.5,
    theme: "lime",
    eyebrow: "ONO PROP",
    title: "PUBLICÁ TU<br><strong>INMUEBLE GRATIS.</strong>",
    subtitle: "Desde el celular y sin costo de publicación.",
    visual: `<div class="free-stamp">PUBLICACIÓN GRATUITA</div>`,
  },
  {
    seconds: 2.7,
    theme: "navy",
    eyebrow: "DATOS PRINCIPALES",
    titleClass: "wide-title",
    title: "UBICACIÓN.<br>PRECIO.<br><strong>CARACTERÍSTICAS.</strong>",
    subtitle: "Completá la información esencial paso a paso.",
    visual: `<div class="step-line"><b>01</b><span>DATOS DEL INMUEBLE</span></div>`,
  },
  {
    seconds: 2.6,
    theme: "photo light-photo",
    photo: interior,
    eyebrow: "MOSTRALO MEJOR",
    title: "SUMÁ FOTOS<br><strong>O VIDEO.</strong>",
    subtitle: "Una presentación clara ayuda a recibir mejores consultas.",
    visual: "",
  },
  {
    seconds: 2.7,
    theme: "blue",
    eyebrow: "ASISTENCIA DE IA",
    title: "MEJORÁ EL TEXTO<br><strong>ANTES DE PUBLICAR.</strong>",
    subtitle: "La IA propone. Vos revisás y decidís.",
    visual: `<div class="ai-lockup"><b>IA</b><span>DESCRIPCIÓN<br>MÁS CLARA</span></div>`,
  },
  {
    seconds: 3.8,
    theme: "night",
    eyebrow: "EMPEZÁ AHORA",
    title: "PUBLICÁ DESDE<br><strong>TU CELULAR.</strong>",
    subtitle: "Registrate y cargá tu inmueble gratis.",
    visual: `
      <div class="call-to-action">ONOPROP.COM/PUBLICAR</div>
      <div class="dm-line">O escribinos <b>“PUBLICAR”</b> por mensaje directo</div>
      <div class="conditions">Las publicaciones están sujetas a revisión.</div>`,
  },
];

const css = `
  * { box-sizing: border-box; }
  html, body { width: 1080px; height: 1920px; margin: 0; overflow: hidden; }
  body { font-family: "Arial Black", "Segoe UI", Arial, sans-serif; }
  .stage { --bg:#071426; --fg:#fff; --accent:#42e0cf; position:relative; width:1080px; height:1920px; overflow:hidden; color:var(--fg); background:var(--bg); }
  .stage::before { content:""; position:absolute; inset:-250px; opacity:.15; transform:rotate(-12deg); background:repeating-linear-gradient(90deg, transparent 0 122px, currentColor 124px 128px, transparent 130px 252px); }
  .stage::after { content:""; position:absolute; width:720px; height:720px; right:-390px; top:-300px; border:82px solid var(--accent); border-radius:50%; opacity:.78; }
  .photo { background-size:cover; background-position:center; }
  .photo::before { inset:0; transform:none; opacity:1; background:linear-gradient(180deg, rgba(3,15,28,.48) 0%, rgba(3,15,28,.18) 38%, rgba(3,15,28,.9) 100%); }
  .light-photo::before { background:linear-gradient(180deg, rgba(5,22,37,.75) 0%, rgba(5,22,37,.28) 45%, rgba(5,22,37,.88) 100%); }
  .photo::after { opacity:.65; }
  .lime { --bg:#d7ff00; --fg:#06182b; --accent:#ff4e70; }
  .navy { --bg:#071a31; --fg:#fff; --accent:#42e0cf; }
  .blue { --bg:#1649ff; --fg:#fff; --accent:#ffe26a; }
  .night { --bg:#061426; --fg:#fff; --accent:#d7ff00; }
  .lime::before { opacity:.08; }
  .lime .brand img { filter:brightness(0); }
  .content { position:relative; z-index:2; height:100%; padding:145px 66px 250px; display:flex; flex-direction:column; }
  .brand { display:flex; align-items:center; justify-content:space-between; min-height:82px; }
  .brand img { width:280px; height:82px; object-fit:contain; object-position:left center; }
  .brand span { padding:14px 22px; border:3px solid currentColor; border-radius:100px; font:800 20px/1 "Segoe UI",Arial,sans-serif; letter-spacing:.1em; }
  .eyebrow { margin-top:125px; font:900 28px/1 "Segoe UI",Arial,sans-serif; letter-spacing:.15em; text-transform:uppercase; }
  h1 { max-width:960px; margin:34px 0 36px; font-size:105px; line-height:.93; letter-spacing:-.064em; text-transform:uppercase; }
  h1.wide-title { font-size:86px; letter-spacing:-.055em; }
  h1 strong { color:var(--accent); font-weight:950; }
  .lime h1 strong { color:var(--fg); text-decoration:underline; text-decoration-color:var(--accent); text-decoration-thickness:16px; text-underline-offset:13px; }
  .subtitle { max-width:895px; margin:0; font:750 39px/1.18 "Segoe UI",Arial,sans-serif; letter-spacing:-.025em; }
  .visual { margin-top:auto; margin-bottom:25px; }
  .footer { position:absolute; z-index:3; left:66px; right:66px; bottom:105px; display:flex; justify-content:space-between; align-items:center; padding-top:25px; border-top:5px solid currentColor; font:900 25px/1 "Segoe UI",Arial,sans-serif; letter-spacing:.05em; }
  .footer strong { color:var(--accent); }
  .lime .footer strong { color:var(--fg); }
  .corner-number { position:absolute; z-index:1; right:-5px; bottom:75px; color:var(--accent); opacity:.1; font-size:590px; line-height:.75; letter-spacing:-.14em; }
  .free-stamp { display:inline-block; padding:29px 34px; color:#fff; background:#06182b; border:6px solid #06182b; box-shadow:20px 20px 0 #ff4e70; font-size:40px; font-weight:950; letter-spacing:.04em; transform:rotate(-2deg); }
  .step-line { display:flex; align-items:center; gap:28px; padding:30px 0 22px; border-bottom:13px solid var(--accent); }
  .step-line b { color:var(--accent); font-size:112px; line-height:.75; }
  .step-line span { font-size:36px; font-weight:950; }
  .ai-lockup { display:flex; align-items:center; gap:32px; padding:30px 0 22px; border-bottom:14px solid var(--accent); }
  .ai-lockup b { color:var(--accent); font-size:150px; line-height:.75; letter-spacing:-.08em; }
  .ai-lockup span { font-size:34px; font-weight:950; line-height:1.02; }
  .call-to-action { padding:30px 25px; color:#061426; background:var(--accent); font:950 38px/1 "Segoe UI",Arial,sans-serif; text-align:center; box-shadow:14px 14px 0 #ff4e70; }
  .dm-line { margin-top:34px; font:800 28px/1.22 "Segoe UI",Arial,sans-serif; text-align:center; }
  .dm-line b { color:var(--accent); }
  .conditions { margin-top:25px; color:#bdcbd8; font:650 18px/1.2 "Segoe UI",Arial,sans-serif; text-align:center; }
`;

const sceneHtml = (scene, index) => {
  const background = scene.photo ? ` style="background-image:url('${scene.photo}')"` : "";
  return `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>
    <section class="stage ${scene.theme}"${background}>
      <div class="corner-number">${index + 1}</div>
      <div class="content">
        <div class="brand"><img src="${logo}" alt="ONO Prop"><span>INMUEBLES</span></div>
        <div class="eyebrow">${scene.eyebrow}</div>
        <h1 class="${scene.titleClass || ""}">${scene.title}</h1>
        <p class="subtitle">${scene.subtitle}</p>
        <div class="visual">${scene.visual}</div>
      </div>
      <div class="footer"><strong>ONOPROP.COM</strong><span>@ono.prop</span></div>
    </section>
  </body></html>`;
};

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
const finalVideo = path.join(directory, "ONO_Prop_Reel_Publicar_Gratis_v1.mp4");
const cover = path.join(directory, "ONO_Prop_Reel_Publicar_Gratis_v1_Cover.png");
const musicPath = path.join(assetsDirectory, "music.wav");

const writeMusicWav = (filePath, seconds, sceneBoundaries) => {
  const sampleRate = 44100;
  const channels = 2;
  const bitsPerSample = 16;
  const sampleCount = Math.ceil(sampleRate * seconds);
  const dataSize = sampleCount * channels * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * channels * 2, 28);
  buffer.writeUInt16LE(channels * 2, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  const bpm = 128;
  const beat = 60 / bpm;
  const eighth = beat / 2;
  const roots = [55, 65.41, 73.42, 49];
  const bassPattern = [1, 1, 1.5, 1, 2, 1.5, 1, 1.5];
  let seed = 0x5a17e113;
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

    const kickFrequency = 50 + 120 * Math.exp(-beatTime * 27);
    const kick = Math.sin(2 * Math.PI * kickFrequency * beatTime) * Math.exp(-beatTime * 18) * 0.6;
    const backbeat = beatIndex % 4 === 1 || beatIndex % 4 === 3;
    const snare = backbeat && beatTime < 0.18
      ? (noise * 0.21 + Math.sin(2 * Math.PI * 190 * beatTime) * 0.08) * Math.exp(-beatTime * 20)
      : 0;
    const hat = noise * Math.exp(-eighthTime * (eighthIndex % 2 ? 31 : 68)) * 0.085;
    const bassFrequency = root * bassPattern[eighthIndex % bassPattern.length];
    const bass = saw(bassFrequency * time) * Math.exp(-eighthTime * 5.5) * 0.18;
    const offbeat = eighthIndex % 2 === 1 ? Math.exp(-eighthTime * 8) : 0;
    const synth = (saw(root * 4 * time) + saw(root * 5 * time) * 0.5) * offbeat * 0.055;

    let crash = 0;
    for (const boundary of sceneBoundaries) {
      const elapsed = time - boundary;
      if (elapsed >= 0 && elapsed < 0.32) crash += noise * Math.exp(-elapsed * 8) * 0.14;
    }

    const fade = Math.min(1, time / 0.12, (seconds - time) / 0.55);
    const value = Math.tanh((kick + snare + hat + bass + synth + crash) * 1.32) * 0.76 * Math.max(0, fade);
    const pan = 0.04 * Math.sin(time * 1.8);
    const left = Math.round(Math.max(-1, Math.min(1, value * (1 - pan))) * 32767);
    const right = Math.round(Math.max(-1, Math.min(1, value * (1 + pan))) * 32767);
    const offset = 44 + sample * 4;
    buffer.writeInt16LE(left, offset);
    buffer.writeInt16LE(right, offset + 2);
  }

  fs.writeFileSync(filePath, buffer);
};

const boundaries = [];
let boundaryTime = 0;
for (let index = 0; index < scenes.length - 1; index += 1) {
  boundaryTime += scenes[index].seconds - transition;
  boundaries.push(boundaryTime);
}
writeMusicWav(musicPath, duration, boundaries);

const inputArgs = scenes.flatMap((scene, index) => [
  "-loop", "1",
  "-framerate", "30",
  "-t", String(scene.seconds),
  "-i", path.join(assetsDirectory, `scene-${String(index + 1).padStart(2, "0")}.png`),
]);
inputArgs.push("-i", musicPath);

const videoFilters = scenes.map((scene, index) => {
  const direction = index % 2 === 0 ? 1 : -1;
  return `[${index}:v]scale=1160:2063,crop=1080:1920:x='40+${direction * 17}*sin(t*0.82+${index})':y='71+17*cos(t*0.66+${index})',setsar=1,fps=30,trim=duration=${scene.seconds},setpts=PTS-STARTPTS[v${index}]`;
});
const transitionNames = ["slideleft", "wipeup", "slideleft", "circleopen", "slideup"];
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

const encoded = spawnSync(ffmpegExecutable, ffmpegArgs, {
  encoding: "utf8",
  maxBuffer: 30 * 1024 * 1024,
});
if (encoded.status !== 0) {
  throw new Error(`FFmpeg no pudo generar el reel:\n${encoded.stderr || encoded.stdout}`);
}

fs.copyFileSync(path.join(assetsDirectory, "scene-02.png"), cover);
console.log(JSON.stringify({ finalVideo, cover, duration, scenes: scenes.length }, null, 2));
