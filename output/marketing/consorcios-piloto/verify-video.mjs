import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
const playwrightModule = process.argv[2];
const chromeExecutable = process.argv[3];
const videoFileName = process.argv[4] || "ONO_Prop_Reel_Piloto_Consorcios_Con_Musica.mp4";
const videoPath = path.join(directory, videoFileName);
const isV3 = videoFileName.includes("Impacto_v3");
const isV2 = videoFileName.includes("Conversion_v2");
const verificationDirectory = path.join(directory, isV3 ? "assets-v3" : isV2 ? "assets-v2" : "assets");
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
    await page.waitForFunction(() => document.querySelector("video")?.readyState >= 1);
    await page.evaluate(async () => {
        const video = document.querySelector("video");
        video.muted = true;
        await video.play();
        await new Promise((resolve) => setTimeout(resolve, 650));
        video.pause();
    });
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
    const checkpointCount = isV3 ? 6 : isV2 ? 5 : 6;
    const checkpoints = Array.from({ length: checkpointCount }, (_, index) => (
        metadata.duration * ((index + .5) / checkpointCount)
    ));
    for (const [index, second] of checkpoints.entries()) {
        await page.evaluate(async (time) => {
            const video = document.querySelector("video");
            await new Promise((resolve) => {
                const done = () => resolve();
                video.addEventListener("seeked", done, { once: true });
                video.currentTime = Math.min(time, Math.max(0, video.duration - .1));
            });
        }, second);
        await page.waitForTimeout(180);
        await page.screenshot({
            path: path.join(verificationDirectory, `video-check-${index + 1}.png`),
        });
    }
    fs.writeFileSync(
        path.join(verificationDirectory, "video-metadata.json"),
        JSON.stringify(metadata, null, 2),
    );
    console.log(JSON.stringify(metadata));
} finally {
    await browser.close();
}
