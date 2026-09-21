import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const directory = path.dirname(fileURLToPath(import.meta.url));
const ffmpeg = process.argv[2] || "ffmpeg";
const logo = path.join(directory, "assets", "logo-ono-prop.png");
const fontBold = "C\\:/Windows/Fonts/segoeuib.ttf";
const fontRegular = "C\\:/Windows/Fonts/segoeui.ttf";

const reels = [
    {
        name: "ONO_Prop_Reel_Publicar_Gratis.mp4",
        cover: "ONO_Prop_Reel_Publicar_Gratis_Cover.png",
        image: "particulares-escena.png",
        audience: "PARA PARTICULARES",
        scenes: [
            ["¿Tenés un inmueble", "para vender o alquilar?"],
            ["Publicalo GRATIS", "en ONO Prop."],
            ["Fotos, precio y datos", "en una sola publicación."],
            ["Compartí tu aviso", "y recibí consultas."],
            ["Empezá hoy", "onoprop.com/publicar"],
        ],
    },
    {
        name: "ONO_Prop_Reel_Inmobiliarias.mp4",
        cover: "ONO_Prop_Reel_Inmobiliarias_Cover.png",
        image: "inmobiliarias-escena.png",
        audience: "PARA INMOBILIARIAS",
        scenes: [
            ["Tu inmobiliaria", "tiene mucho para mostrar."],
            ["Publicá inmuebles", "en ONO Prop."],
            ["Tu marca.", "Tu página propia."],
            ["Gestioná consultas", "y compartí con colegas."],
            ["Sumate hoy", "onoprop.com/inmobiliarias"],
        ],
    },
];

const escapeText = (value) => value
    .replaceAll("\\", "\\\\")
    .replaceAll(":", "\\:")
    .replaceAll("'", "\\'")
    .replaceAll(",", "\\,");

const drawText = ({ text, y, size, color, font = fontBold, enable = "" }) => [
    `drawtext=fontfile='${font}'`,
    `text='${escapeText(text)}'`,
    `x=75:y=${y}`,
    `fontsize=${size}:fontcolor=${color}`,
    "shadowcolor=black@0.65:shadowx=3:shadowy=4",
    ...(enable ? [`enable='${enable}'`] : []),
].join(":");

const run = (args) => {
    const result = spawnSync(ffmpeg, args, { stdio: "inherit" });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`FFmpeg terminó con código ${result.status}`);
};

for (const reel of reels) {
    const photo = path.join(directory, "assets", reel.image);
    const filters = [
        "[0:v]scale=1080:1920",
        "zoompan=z='min(zoom+0.00012,1.045)':d=1:s=1080x1920:fps=24",
        "drawbox=x=0:y=0:w=iw:h=705:color=0x071A31@0.58:t=fill",
        "drawbox=x=0:y=1400:w=iw:h=520:color=0x071A31@0.68:t=fill",
        drawText({ text: reel.audience, y: 325, size: 34, color: "0xFFCA65" }),
    ];

    reel.scenes.forEach(([first, second], index) => {
        const start = index * 3;
        const end = start + 2.999;
        const enable = `between(t\\,${start}\\,${end})`;
        filters.push(drawText({
            text: first,
            y: 415,
            size: index === 4 ? 94 : 76,
            color: "white",
            enable,
        }));
        filters.push(drawText({
            text: second,
            y: index === 4 ? 1490 : 520,
            size: index === 4 ? 59 : 69,
            color: "0xFFCA65",
            enable,
        }));
    });

    filters.push(drawText({
        text: "Imágenes ilustrativas",
        y: 1810,
        size: 26,
        color: "white@0.8",
        font: fontRegular,
    }));

    const filterComplex = `${filters.join(",")}[base];[1:v]scale=360:-1[logo];` +
        "[base][logo]overlay=x=75:y=130:shortest=1,format=yuv420p[v]";

    const video = path.join(directory, reel.name);
    run([
        "-hide_banner", "-loglevel", "error", "-y",
        "-framerate", "24", "-loop", "1", "-i", photo,
        "-framerate", "24", "-loop", "1", "-i", logo,
        "-filter_complex", filterComplex,
        "-map", "[v]", "-t", "15", "-r", "24",
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "22",
        "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", video,
    ]);
    run([
        "-hide_banner", "-loglevel", "error", "-y",
        "-ss", "4.3", "-i", video,
        "-frames:v", "1", path.join(directory, reel.cover),
    ]);
}
