import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
const playwrightModule = process.argv[2];
const chromeExecutable = process.argv[3];
const videoPath = path.join(directory, "ONO_Prop_Reel_Piloto_Consorcios_Con_Musica.mp4");
const { chromium } = await import(pathToFileURL(playwrightModule).href);
const browser = await chromium.launch({
    executablePath: chromeExecutable,
    headless: true,
    args: ["--allow-file-access-from-files"],
});

try {
    const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
    await page.goto(pathToFileURL(videoPath).href, { waitUntil: "load" });
    await page.waitForSelector("video");
    const metadata = await page.evaluate(() => {
        const video = document.querySelector("video");
        video.controls = false;
        Object.assign(video.style, {
            width: "1080px",
            height: "1920px",
            objectFit: "contain",
            margin: "0",
        });
        document.body.style.margin = "0";
        return {
            duration: video.duration,
            videoWidth: video.videoWidth,
            videoHeight: video.videoHeight,
            hasAudio: Boolean(video.webkitAudioDecodedByteCount || video.mozHasAudio),
        };
    });
    for (const second of [1.2, 5.2, 9.3, 13.4, 17.5, 21.5]) {
        await page.evaluate(async (time) => {
            const video = document.querySelector("video");
            await new Promise((resolve) => {
                const done = () => resolve();
                video.addEventListener("seeked", done, { once: true });
                video.currentTime = Math.min(time, Math.max(0, video.duration - .1));
            });
        }, second);
        await page.screenshot({
            path: path.join(directory, "assets", `video-check-${String(second).replace(".", "-")}.png`),
        });
    }
    fs.writeFileSync(
        path.join(directory, "assets", "video-metadata.json"),
        JSON.stringify(metadata, null, 2),
    );
    console.log(JSON.stringify(metadata));
} finally {
    await browser.close();
}
