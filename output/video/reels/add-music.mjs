import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
const ffmpeg = process.argv[2] || "ffmpeg";
const sampleRate = 44100;
const duration = 15;
const samples = sampleRate * duration;
const secondsPerBeat = 60 / 128;
const bars = 8;

const scores = [
    {
        source: "ONO_Prop_Reel_Publicar_Gratis.mp4",
        output: "ONO_Prop_Reel_Publicar_Gratis_Con_Musica.mp4",
        audio: "ONO_Prop_Particulares_Musica_Original.wav",
        chords: [
            [261.63, 329.63, 392.00], // C
            [196.00, 246.94, 293.66], // G
            [220.00, 261.63, 329.63], // Am
            [174.61, 220.00, 261.63], // F
        ],
        bright: false,
    },
    {
        source: "ONO_Prop_Reel_Inmobiliarias.mp4",
        output: "ONO_Prop_Reel_Inmobiliarias_Con_Musica.mp4",
        audio: "ONO_Prop_Inmobiliarias_Musica_Original.wav",
        chords: [
            [293.66, 349.23, 440.00], // Dm
            [233.08, 293.66, 349.23], // Bb
            [261.63, 349.23, 440.00], // F
            [261.63, 329.63, 392.00], // C
        ],
        bright: true,
    },
];

const midiWave = (frequency, time, bright = false) => {
    const fundamental = Math.sin(2 * Math.PI * frequency * time);
    const harmonic = Math.sin(4 * Math.PI * frequency * time);
    const high = Math.sin(6 * Math.PI * frequency * time);
    return bright
        ? fundamental * 0.64 + harmonic * 0.27 + high * 0.09
        : fundamental * 0.82 + harmonic * 0.15 + high * 0.03;
};

const renderScore = (score) => {
    const left = new Float32Array(samples);
    const right = new Float32Array(samples);
    let randomState = score.bright ? 0x45678bad : 0x123456ab;
    const noise = () => {
        randomState ^= randomState << 13;
        randomState ^= randomState >>> 17;
        randomState ^= randomState << 5;
        return (randomState >>> 0) / 0x80000000 - 1;
    };

    const add = (start, length, gain, pan, synth) => {
        const first = Math.round(start * sampleRate);
        const count = Math.min(Math.round(length * sampleRate), samples - first);
        const lGain = Math.sqrt((1 - pan) / 2) * gain;
        const rGain = Math.sqrt((1 + pan) / 2) * gain;
        for (let i = 0; i < count; i++) {
            const time = i / sampleRate;
            const value = synth(time, length);
            left[first + i] += value * lGain;
            right[first + i] += value * rGain;
        }
    };

    for (let bar = 0; bar < bars; bar++) {
        const chord = score.chords[bar % score.chords.length];
        const start = bar * 4 * secondsPerBeat;
        chord.forEach((frequency, index) => add(
            start,
            4 * secondsPerBeat,
            score.bright ? 0.050 : 0.059,
            [-0.36, 0.12, 0.36][index],
            (time, length) => {
                const envelope = Math.min(1, time / 0.20) *
                    Math.min(1, (length - time) / 0.30);
                return midiWave(frequency, time) * envelope;
            },
        ));

        const pattern = score.bright
            ? [0, 2, 1, 2, 0, 2, 1, 2]
            : [0, 1, 2, 1, 0, 1, 2, 1];
        pattern.forEach((noteIndex, eighth) => add(
            start + eighth * secondsPerBeat / 2,
            score.bright ? 0.36 : 0.43,
            score.bright ? 0.15 : 0.12,
            eighth % 2 ? 0.18 : -0.18,
            (time) => {
                const envelope = Math.min(1, time / 0.007) * Math.exp(-8.0 * time);
                return midiWave(chord[noteIndex] * 2, time, score.bright) * envelope;
            },
        ));

        for (let beat = 0; beat < 4; beat++) {
            const at = start + beat * secondsPerBeat;
            if (beat % 2 === 0 || score.bright) {
                add(at, 0.33, score.bright ? 0.20 : 0.13, 0,
                    (time) => Math.sin(2 * Math.PI * (59 * time + 4.0 *
                        (1 - Math.exp(-25 * time)))) * Math.exp(-19 * time));
            }
            if (beat % 2 === 1) {
                add(at, 0.22, score.bright ? 0.075 : 0.05, 0.08,
                    (time) => noise() * Math.exp(-22 * time));
            }
            add(at, 0.43, score.bright ? 0.13 : 0.11, 0,
                (time) => Math.sin(2 * Math.PI * (chord[0] / 2) * time) *
                    Math.min(1, time / 0.012) * Math.exp(-6 * time));
        }

        for (let eighth = 0; eighth < 8; eighth++) {
            add(start + eighth * secondsPerBeat / 2, 0.11,
                score.bright ? 0.026 : 0.018,
                eighth % 2 ? 0.45 : -0.45,
                (time) => noise() * Math.exp(-42 * time));
        }
    }

    let sum = 0;
    let peak = 0;
    for (let i = 0; i < samples; i++) {
        const fadeIn = Math.min(1, i / (sampleRate * 0.3));
        const fadeOut = Math.min(1, (samples - i) / (sampleRate * 0.85));
        const fade = Math.min(fadeIn, fadeOut);
        left[i] *= fade;
        right[i] *= fade;
        sum += left[i] ** 2 + right[i] ** 2;
        peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
    }
    const rms = Math.sqrt(sum / (samples * 2));
    const scale = Math.min(0.68 / peak, 0.115 / rms);

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
    for (let i = 0; i < samples; i++) {
        buffer.writeInt16LE(Math.round(left[i] * scale * 32767), 44 + i * 4);
        buffer.writeInt16LE(Math.round(right[i] * scale * 32767), 46 + i * 4);
    }
    return { buffer, rms: rms * scale, peak: peak * scale };
};

for (const score of scores) {
    const { buffer, rms, peak } = renderScore(score);
    const audio = path.join(directory, score.audio);
    const output = path.join(directory, score.output);
    fs.writeFileSync(audio, buffer);
    const result = spawnSync(ffmpeg, [
        "-hide_banner", "-loglevel", "error", "-y",
        "-i", path.join(directory, score.source), "-i", audio,
        "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy",
        "-c:a", "aac", "-b:a", "192k", "-ar", "44100",
        "-t", "15", "-movflags", "+faststart", output,
    ], { stdio: "inherit" });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`FFmpeg terminó con código ${result.status}`);
    console.log(`${score.output}: 15 s, RMS ${rms.toFixed(3)}, pico ${peak.toFixed(3)}`);
}
