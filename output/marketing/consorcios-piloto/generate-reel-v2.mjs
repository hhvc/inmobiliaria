import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
const assetsDirectory = path.join(directory, "assets-v2");
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
  throw new Error("Uso: node generate-reel-v2.mjs <playwright/index.mjs> <chrome.exe> [ffmpeg.exe]");
}

fs.mkdirSync(assetsDirectory, { recursive: true });

const { chromium } = await import(pathToFileURL(playwrightModule).href);
const logoPath = path.join(projectRoot, "public", "assets", "img", "logoONOProp3.png");
const logo = `data:image/png;base64,${fs.readFileSync(logoPath).toString("base64")}`;
const imageUri = (filePath) => `data:image/png;base64,${fs.readFileSync(filePath).toString("base64")}`;

const scenes = [
  {
    seconds: 3.0,
    eyebrow: "GESTIÓN DE CONSORCIOS",
    title: "¿Cada cierre vive entre<br><em>planillas y WhatsApp?</em>",
    subtitle: "Ordená la administración sin sumar más tareas dispersas.",
    visual: `
      <div class="chaos">
        <div class="loose-card loose-a"><span class="doc-icon">XLS</span><div><b>Planilla de expensas</b><small>Versión_final_ahora_sí.xlsx</small></div></div>
        <div class="loose-card loose-b"><span class="doc-icon receipt">≡</span><div><b>Comprobantes</b><small>Archivos y fotos dispersas</small></div></div>
        <div class="loose-card loose-c"><span class="doc-icon chat">…</span><div><b>Mensajes</b><small>Consultas sin seguimiento</small></div></div>
        <div class="solution-pill"><span>→</span> Un circuito claro con ONO Prop</div>
      </div>`,
  },
  {
    seconds: 3.4,
    eyebrow: "UN SOLO CIRCUITO",
    title: "Del gasto al recibo,<br><em>todo queda conectado.</em>",
    subtitle: "Más control y trazabilidad en cada movimiento.",
    visual: `
      <div class="flow">
        <div class="flow-step"><span>01</span><b>Gastos</b><small>Cargá comprobantes</small></div>
        <div class="flow-step"><span>02</span><b>Liquidación</b><small>Distribuí expensas</small></div>
        <div class="flow-step"><span>03</span><b>Cobro</b><small>Registrá pagos</small></div>
        <div class="flow-step"><span>04</span><b>Recibo</b><small>Cerrá el circuito</small></div>
      </div>`,
  },
  {
    seconds: 3.4,
    eyebrow: "PORTAL DEL CONSORCISTA",
    title: "La información llega<br><em>sin depender de vos.</em>",
    subtitle: "Propietarios y ocupantes consultan, informan pagos y envían mensajes.",
    visual: `
      <div class="phone-wrap">
        <div class="phone">
          <div class="phone-notch"></div>
          <div class="phone-head"><img src="${logo}"><span>Mi Consorcio</span></div>
          <div class="account-card"><small>ESTADO DE CUENTA</small><b>Cuenta al día</b><span>✓</span></div>
          <div class="phone-row"><span><b>Última liquidación</b><small>Septiembre 2026</small></span><strong>$85.400</strong></div>
          <div class="phone-actions"><b>Informar pago</b><b>Ver documentos</b></div>
          <div class="phone-message"><span>…</span><div><b>Mensajes a la administración</b><small>Consultas, solicitudes y avisos</small></div></div>
        </div>
        <div class="benefit-stack">
          <span>✓ Cuenta corriente</span>
          <span>✓ Liquidaciones y recibos</span>
          <span>✓ Documentación</span>
          <span>✓ Comunicación con seguimiento</span>
        </div>
      </div>`,
  },
  {
    seconds: 3.2,
    eyebrow: "CONTROL PARA LA ADMINISTRACIÓN",
    title: "Menos consultas repetidas.<br><em>Más claridad.</em>",
    subtitle: "La información importante queda accesible, ordenada y con permisos.",
    visual: `
      <div class="feature-grid">
        <div><span class="feature-icon">₱</span><b>Cuentas corrientes</b><small>Expensas, mora y pagos</small></div>
        <div><span class="feature-icon">▤</span><b>Documentación</b><small>Pólizas, actas y reglamentos</small></div>
        <div><span class="feature-icon">…</span><b>Mensajes y solicitudes</b><small>Historial y seguimiento</small></div>
        <div><span class="feature-icon">✓</span><b>Roles y permisos</b><small>Información para cada perfil</small></div>
      </div>`,
  },
  {
    seconds: 4.3,
    eyebrow: "PILOTO ACOMPAÑADO · 30 DÍAS",
    title: "Empezá con tu<br><em>primer consorcio.</em>",
    subtitle: "La demostración inicial es gratuita.",
    visual: `
      <div class="offer-card">
        <div class="offer-price"><small>PRECIO PILOTO</small><b>$1.000</b><span>por unidad funcional / mes</span></div>
        <div class="offer-detail"><b>Primeros 3 clientes</b><span>Alta bonificada y precio promocional congelado por 6 meses.</span></div>
      </div>
      <div class="dm-cta">ESCRIBÍ <b>“PILOTO”</b> POR DM</div>
      <div class="link-bio">Link en bio · onoprop.com</div>
      <div class="legal">Mínimo mensual $20.000. Beneficio inicial sujeto a disponibilidad y confirmación.</div>`,
  },
];

const css = `
  * { box-sizing: border-box; }
  html, body { width: 1080px; height: 1920px; margin: 0; overflow: hidden; }
  body { font-family: "Segoe UI", Arial, sans-serif; }
  .stage { position: relative; width: 1080px; height: 1920px; overflow: hidden; color: #f8fbff;
    background: radial-gradient(circle at 108% 8%, #16868b 0%, transparent 38%),
      radial-gradient(circle at -8% 95%, #31569a 0%, transparent 42%), #071a31; }
  .stage::before { content: ""; position: absolute; inset: 0; opacity: .09;
    background: repeating-linear-gradient(90deg, transparent 0 89px, #6de4dc 90px, transparent 91px); }
  .glow { position: absolute; width: 520px; height: 520px; right: -250px; top: 760px;
    border-radius: 50%; border: 2px solid rgba(100,225,210,.22); box-shadow: 0 0 80px rgba(100,225,210,.08); }
  .content { position: relative; z-index: 2; height: 100%; padding: 220px 68px 260px; }
  .brand { display: flex; align-items: center; gap: 19px; height: 82px; }
  .brand img { width: 285px; height: 82px; object-fit: contain; object-position: left center; }
  .brand::after { content: "ADMINISTRACIÓN DE CONSORCIOS"; padding-left: 21px; border-left: 2px solid rgba(255,255,255,.28);
    color: #bcd5dc; font-size: 22px; font-weight: 750; letter-spacing: .08em; }
  .eyebrow { margin-top: 69px; color: #ffd37f; font-size: 27px; font-weight: 850; letter-spacing: .13em; }
  h1 { max-width: 945px; margin: 25px 0 22px; font-size: 78px; line-height: 1.01; letter-spacing: -.045em; }
  h1 em { color: #64e1d2; font-style: normal; }
  .subtitle { max-width: 930px; margin: 0; color: #e4f0f3; font-size: 37px; line-height: 1.25; font-weight: 510; }
  .visual { margin-top: 62px; }
  .footer { position: absolute; left: 68px; right: 68px; bottom: 180px; z-index: 3; display: flex; align-items: center; justify-content: space-between;
    padding-top: 24px; border-top: 2px solid rgba(255,255,255,.22); color: #c3d9df; font-size: 25px; font-weight: 650; }
  .footer b { color: #64e1d2; letter-spacing: .05em; }

  .chaos { position: relative; height: 620px; }
  .loose-card { position: absolute; width: 615px; min-height: 128px; display: flex; align-items: center; gap: 24px; padding: 24px 28px;
    color: #102d47; background: #fff; border-radius: 22px; box-shadow: 0 25px 65px rgba(0,0,0,.28); }
  .loose-card b, .loose-card small { display: block; } .loose-card b { font-size: 29px; } .loose-card small { margin-top: 7px; color: #6a7f90; font-size: 21px; }
  .loose-a { left: 16px; top: 5px; transform: rotate(-3deg); } .loose-b { right: 9px; top: 160px; transform: rotate(2.7deg); }
  .loose-c { left: 70px; top: 315px; transform: rotate(-1.5deg); }
  .doc-icon { display: grid; place-items: center; width: 72px; height: 72px; flex: none; border-radius: 18px; color: #fff; background: #20826f; font-size: 21px; font-weight: 900; }
  .doc-icon.receipt { background: #31569a; font-size: 38px; } .doc-icon.chat { background: #169b94; font-size: 43px; }
  .solution-pill { position: absolute; left: 90px; top: 492px; padding: 23px 34px; border-radius: 100px; color: #09243f; background: #ffd174;
    box-shadow: 0 20px 55px rgba(0,0,0,.26); font-size: 28px; font-weight: 850; }
  .solution-pill span { margin-right: 12px; font-size: 35px; }

  .flow { position: relative; display: grid; grid-template-columns: 1fr 1fr; align-items: stretch; gap: 22px; }
  .flow::before { content: ""; position: absolute; left: 25%; right: 25%; top: 50%; height: 3px;
    background: linear-gradient(90deg, transparent, #ffd174 18%, #ffd174 82%, transparent); opacity: .8; }
  .flow-step { min-height: 190px; padding: 24px; border: 2px solid rgba(100,225,210,.5); border-radius: 24px;
    background: linear-gradient(145deg, rgba(255,255,255,.13), rgba(255,255,255,.05)); box-shadow: 0 25px 60px rgba(0,0,0,.18); z-index: 1; }
  .flow-step span { display: grid; place-items: center; width: 43px; height: 43px; border-radius: 50%; color: #09243f; background: #64e1d2; font-size: 18px; font-weight: 900; }
  .flow-step b, .flow-step small { display: block; } .flow-step b { margin-top: 17px; font-size: 30px; } .flow-step small { margin-top: 7px; color: #cbe0e6; font-size: 21px; }

  .phone-wrap { display: grid; grid-template-columns: 510px 1fr; gap: 38px; align-items: center; }
  .phone { position: relative; min-height: 645px; padding: 42px 25px 25px; border: 11px solid #172d43; border-radius: 50px; color: #142b40; background: #f5f8fa;
    box-shadow: 0 34px 90px rgba(0,0,0,.38); }
  .phone-notch { position: absolute; top: 10px; left: 174px; width: 142px; height: 22px; border-radius: 30px; background: #172d43; }
  .phone-head { display: flex; align-items: center; justify-content: space-between; } .phone-head img { width: 155px; height: 46px; object-fit: contain; object-position: left; }
  .phone-head span { color: #637584; font-size: 18px; font-weight: 700; }
  .account-card { position: relative; margin-top: 22px; padding: 22px; border-radius: 20px; color: white; background: linear-gradient(135deg,#0b6e70,#178f86); }
  .account-card small, .account-card b { display: block; } .account-card small { font-size: 15px; letter-spacing: .11em; } .account-card b { margin-top: 7px; font-size: 29px; }
  .account-card span { position: absolute; right: 21px; top: 29px; display: grid; place-items: center; width: 41px; height: 41px; border-radius: 50%; color: #0b6e70; background: white; font-size: 24px; font-weight: 900; }
  .phone-row { display: flex; justify-content: space-between; gap: 18px; margin-top: 17px; padding: 19px; border-radius: 16px; background: #fff; box-shadow: 0 8px 25px rgba(20,48,70,.08); }
  .phone-row b, .phone-row small { display: block; } .phone-row b { font-size: 18px; } .phone-row small { margin-top: 5px; color: #718392; font-size: 15px; } .phone-row strong { font-size: 21px; }
  .phone-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 14px; }
  .phone-actions b { padding: 18px 10px; border-radius: 14px; color: #0b6e70; background: #dff5f1; font-size: 17px; text-align: center; }
  .phone-message { display: flex; align-items: center; gap: 14px; margin-top: 14px; padding: 18px; border-radius: 16px; background: #fff; }
  .phone-message > span { display: grid; place-items: center; width: 43px; height: 43px; border-radius: 13px; color: white; background: #31569a; font-size: 27px; font-weight: 900; }
  .phone-message b, .phone-message small { display: block; } .phone-message b { font-size: 17px; } .phone-message small { margin-top: 4px; color: #718392; font-size: 14px; }
  .benefit-stack { display: grid; gap: 20px; }
  .benefit-stack span { padding: 20px 21px; border-left: 5px solid #64e1d2; border-radius: 0 15px 15px 0; color: #effcfc; background: rgba(255,255,255,.09); font-size: 25px; font-weight: 720; }

  .feature-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 22px; }
  .feature-grid > div { min-height: 225px; padding: 26px; border: 2px solid rgba(255,255,255,.16); border-radius: 25px; background: rgba(255,255,255,.09); box-shadow: 0 25px 60px rgba(0,0,0,.15); }
  .feature-icon { display: grid; place-items: center; width: 61px; height: 61px; border-radius: 18px; color: #09243f; background: #64e1d2; font-size: 32px; font-weight: 900; }
  .feature-grid b, .feature-grid small { display: block; } .feature-grid b { margin-top: 19px; font-size: 27px; } .feature-grid small { margin-top: 8px; color: #cce0e6; font-size: 20px; line-height: 1.25; }

  .offer-card { display: grid; grid-template-columns: 1.05fr .95fr; gap: 25px; padding: 29px; border-radius: 26px; color: #102d47; background: #fff; box-shadow: 0 30px 80px rgba(0,0,0,.28); }
  .offer-price { padding-right: 24px; border-right: 2px solid #dce5ea; } .offer-price small, .offer-price b, .offer-price span { display: block; }
  .offer-price small { color: #0b7d78; font-size: 20px; font-weight: 900; letter-spacing: .1em; } .offer-price b { margin-top: 5px; color: #09243f; font-size: 64px; line-height: 1; }
  .offer-price span { margin-top: 8px; color: #607687; font-size: 20px; font-weight: 650; }
  .offer-detail { padding-top: 8px; } .offer-detail b, .offer-detail span { display: block; } .offer-detail b { color: #0b7d78; font-size: 25px; }
  .offer-detail span { margin-top: 10px; color: #425c6e; font-size: 20px; line-height: 1.35; }
  .dm-cta { margin-top: 27px; padding: 25px; border-radius: 18px; color: #09243f; background: #ffd174; font-size: 31px; font-weight: 790; text-align: center; box-shadow: 0 20px 55px rgba(0,0,0,.24); }
  .dm-cta b { font-weight: 950; } .link-bio { margin-top: 18px; color: #e8f7f7; font-size: 29px; font-weight: 750; text-align: center; }
  .legal { max-width: 880px; margin: 19px auto 0; color: #bcd2d9; font-size: 18px; line-height: 1.3; text-align: center; }
`;

const sceneHtml = (scene, index) => `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head>
  <body><section class="stage"><div class="glow"></div><div class="content">
    <div class="brand"><img src="${logo}" alt="ONO Prop"></div>
    <div class="eyebrow">${scene.eyebrow}</div>
    <h1>${scene.title}</h1>
    <p class="subtitle">${scene.subtitle}</p>
    <div class="visual">${scene.visual}</div>
  </div><div class="footer"><b>ONOPROP.COM</b><span>@ono.prop</span></div></section></body></html>`;

const renderBrowser = await chromium.launch({ executablePath: chromeExecutable, headless: true });
try {
  const page = await renderBrowser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  for (let index = 0; index < scenes.length; index += 1) {
    await page.setContent(sceneHtml(scenes[index], index), { waitUntil: "load" });
    await page.screenshot({
      path: path.join(assetsDirectory, `scene-${String(index + 1).padStart(2, "0")}.png`),
    });
  }
} finally {
  await renderBrowser.close();
}

const transition = 0.22;
const duration = scenes.reduce((sum, scene) => sum + scene.seconds, 0) - transition * (scenes.length - 1);
const finalVideo = path.join(directory, "ONO_Prop_Reel_Consorcios_Conversion_v2.mp4");
const cover = path.join(directory, "ONO_Prop_Reel_Consorcios_Conversion_v2_Cover.png");
const musicPath = path.join(assetsDirectory, "music-v2.wav");

const writeMusicWav = (filePath, seconds) => {
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

  const bpm = 118;
  const beat = 60 / bpm;
  const barDuration = beat * 4;
  const chords = [[146.83, 220, 293.66], [174.61, 220, 261.63], [130.81, 196, 261.63], [196, 246.94, 293.66]];
  const triangle = (phase) => 2 * Math.abs(2 * (phase - Math.floor(phase + .5))) - 1;
  for (let sample = 0; sample < sampleCount; sample += 1) {
    const time = sample / sampleRate;
    const barIndex = Math.floor(time / barDuration);
    const barTime = time - barIndex * barDuration;
    const chord = chords[barIndex % chords.length];
    const padEnvelope = Math.min(1, barTime / .18, (barDuration - barTime) / .32);
    const pad = chord.reduce((sum, frequency) => sum + Math.sin(2 * Math.PI * frequency * time), 0) * .035 * Math.max(0, padEnvelope);
    const stepDuration = beat / 2;
    const step = Math.floor(barTime / stepDuration);
    const stepTime = barTime - step * stepDuration;
    const arpeggioFrequency = chord[step % chord.length] * 2;
    const arpeggio = triangle(arpeggioFrequency * time) * .075 * Math.exp(-stepTime * 9);
    const beatTime = time - Math.floor(time / beat) * beat;
    const bass = Math.sin(2 * Math.PI * (chord[0] / 2) * time) * .09 * Math.exp(-beatTime * 10);
    const fade = Math.min(1, time / .35, (seconds - time) / .8);
    const value = Math.max(-1, Math.min(1, (pad + arpeggio + bass) * Math.max(0, fade)));
    const integer = Math.round(value * 32767);
    const offset = 44 + sample * 4;
    buffer.writeInt16LE(integer, offset);
    buffer.writeInt16LE(integer, offset + 2);
  }
  fs.writeFileSync(filePath, buffer);
};

writeMusicWav(musicPath, duration);

const inputArgs = scenes.flatMap((_, index) => [
  "-loop", "1",
  "-framerate", "30",
  "-t", String(scenes[index].seconds),
  "-i", path.join(assetsDirectory, `scene-${String(index + 1).padStart(2, "0")}.png`),
]);
inputArgs.push("-i", musicPath);

const videoFilters = scenes.map((scene, index) => (
  `[${index}:v]scale=1080:1920,setsar=1,fps=30,trim=duration=${scene.seconds},setpts=PTS-STARTPTS[v${index}]`
));
let accumulatedDuration = scenes[0].seconds;
let priorLabel = "v0";
const transitionFilters = [];
for (let index = 1; index < scenes.length; index += 1) {
  const offset = accumulatedDuration - transition;
  const outputLabel = `x${index}`;
  transitionFilters.push(
    `[${priorLabel}][v${index}]xfade=transition=fade:duration=${transition}:offset=${offset.toFixed(2)}[${outputLabel}]`,
  );
  accumulatedDuration += scenes[index].seconds - transition;
  priorLabel = outputLabel;
}

const ffmpegArgs = [
  "-y",
  ...inputArgs,
  "-filter_complex",
  [...videoFilters, ...transitionFilters].join(";"),
  "-map", `[${priorLabel}]`,
  "-map", `${scenes.length}:a`,
  "-t", duration.toFixed(2),
  "-r", "30",
  "-c:v", "libx264",
  "-preset", "medium",
  "-crf", "18",
  "-profile:v", "high",
  "-pix_fmt", "yuv420p",
  "-c:a", "aac",
  "-b:a", "160k",
  "-movflags", "+faststart",
  finalVideo,
];
const encoded = spawnSync(ffmpegExecutable, ffmpegArgs, { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 });
if (encoded.status !== 0) {
  throw new Error(`FFmpeg no pudo generar el reel:\n${encoded.stderr || encoded.stdout}`);
}
fs.copyFileSync(path.join(assetsDirectory, "scene-01.png"), cover);

console.log(JSON.stringify({ finalVideo, cover, duration, scenes: scenes.length }, null, 2));
