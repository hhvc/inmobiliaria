import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
const ffmpeg = process.argv[2];
if (!ffmpeg) throw new Error("Uso: node add-music.mjs <ffmpeg.exe>");

const sampleRate = 44100;
const duration = 38;
const samples = sampleRate * duration;
const secondsPerBeat = 60 / 128;
const left = new Float32Array(samples);
const right = new Float32Array(samples);
const chords = [
    [293.66, 349.23, 440.00], // Dm
    [233.08, 293.66, 349.23], // Bb
    [261.63, 349.23, 440.00], // F
    [261.63, 329.63, 392.00], // C
];
let randomState = 0x45678bad;
const noise = () => {
    randomState ^= randomState << 13;
    randomState ^= randomState >>> 17;
    randomState ^= randomState << 5;
    return (randomState >>> 0) / 0x80000000 - 1;
};
const wave = (frequency, time) =>
    Math.sin(2 * Math.PI * frequency * time) * 0.68 +
    Math.sin(4 * Math.PI * frequency * time) * 0.25 +
    Math.sin(6 * Math.PI * frequency * time) * 0.07;

const add = (start, length, gain, pan, synth) => {
    const first = Math.round(start * sampleRate);
    const count = Math.max(0, Math.min(Math.round(length * sampleRate), samples - first));
    const lGain = Math.sqrt((1 - pan) / 2) * gain;
    const rGain = Math.sqrt((1 + pan) / 2) * gain;
    for (let index = 0; index < count; index++) {
        const time = index / sampleRate;
        const value = synth(time, length);
        left[first + index] += value * lGain;
        right[first + index] += value * rGain;
    }
};

for (let bar = 0; bar < 20; bar++) {
    const chord = chords[bar % chords.length];
    const start = bar * 4 * secondsPerBeat;
    chord.forEach((frequency, index) => add(
        start, 4 * secondsPerBeat, 0.047, [-0.35, 0.08, 0.35][index],
        (time, length) => wave(frequency, time) *
            Math.min(1, time / 0.18) * Math.min(1, (length - time) / 0.22),
    ));
    for (let eighth = 0; eighth < 8; eighth++) {
        const note = chord[[0, 2, 1, 2, 0, 2, 1, 2][eighth]];
        add(start + eighth * secondsPerBeat / 2, 0.34, 0.13,
            eighth % 2 ? 0.23 : -0.23,
            (time) => wave(note * 2, time) *
                Math.min(1, time / 0.007) * Math.exp(-8.4 * time));
        add(start + eighth * secondsPerBeat / 2, 0.11, 0.024,
            eighth % 2 ? 0.45 : -0.45,
            (time) => noise() * Math.exp(-41 * time));
    }
    for (let beat = 0; beat < 4; beat++) {
        const at = start + beat * secondsPerBeat;
        if (beat % 2 === 0) {
            add(at, 0.32, 0.19, 0,
                (time) => Math.sin(2 * Math.PI * (58 * time +
                    4 * (1 - Math.exp(-25 * time)))) * Math.exp(-18 * time));
        } else {
            add(at, 0.21, 0.075, 0.10,
                (time) => noise() * Math.exp(-22 * time));
        }
        add(at, 0.43, 0.105, 0,
            (time) => Math.sin(2 * Math.PI * (chord[0] / 2) * time) *
                Math.min(1, time / 0.012) * Math.exp(-6 * time));
    }
}

let sum = 0;
let peak = 0;
for (let index = 0; index < samples; index++) {
    const fade = Math.min(1, index / (sampleRate * 0.22),
        (samples - index) / (sampleRate * 1.0));
    left[index] *= fade;
    right[index] *= fade;
    sum += left[index] ** 2 + right[index] ** 2;
    peak = Math.max(peak, Math.abs(left[index]), Math.abs(right[index]));
}
const rms = Math.sqrt(sum / (samples * 2));
const scale = Math.min(0.68 / peak, 0.11 / rms);
const buffer = Buffer.allocUnsafe(44 + samples * 4);
buffer.write("RIFF", 0);
buffer.writeUInt32LE(buffer.length - 8, 4);
buffer.write("WAVEfmt ", 8);
buffer.writeUInt32LE(16, 16);
buffer.writeUInt16LE(1, 20);
buffer.writeUInt16LE(2, 22);
buffer.writeUInt32LE(sampleRate, 24);
buffer.writeUInt32LE(sampleRate * 4, 28);
buffer.writeUInt16LE(4, 32);
buffer.writeUInt16LE(16, 34);
buffer.write("data", 36);
buffer.writeUInt32LE(samples * 4, 40);
for (let index = 0; index < samples; index++) {
    buffer.writeInt16LE(Math.round(left[index] * scale * 32767), 44 + index * 4);
    buffer.writeInt16LE(Math.round(right[index] * scale * 32767), 46 + index * 4);
}

const audio = path.join(directory, "ONO_Prop_Plataforma_Musica_Original.wav");
const video = path.join(directory, "ONO_Prop_Reel_Plataforma_Inmobiliarias.mp4");
const output = path.join(directory, "ONO_Prop_Reel_Plataforma_Inmobiliarias_Con_Musica.mp4");
fs.writeFileSync(audio, buffer);
const result = spawnSync(ffmpeg, [
    "-hide_banner", "-loglevel", "error", "-y",
    "-i", video, "-i", audio,
    "-map", "0:v:0", "-map", "1:a:0",
    "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ar", "44100",
    "-shortest", "-movflags", "+faststart", output,
], { stdio: "inherit" });
if (result.error) throw result.error;
if (result.status !== 0) throw new Error(`FFmpeg terminó con código ${result.status}`);
console.log(`Reel con música: ${output}; RMS ${ (rms * scale).toFixed(3) }`);
