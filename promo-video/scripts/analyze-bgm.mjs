import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const ffmpeg = path.join(root, 'node_modules', '@remotion', 'compositor-win32-x64-msvc', 'ffmpeg.exe');
const input = path.join(root, 'public', 'audio', 'bgm', 'house-vibez.mp3');
const sampleRate = 11025;
const hop = 256;

const decoded = spawnSync(ffmpeg, [
  '-v', 'error', '-i', input, '-ac', '1', '-ar', String(sampleRate),
  '-f', 'wav', '-acodec', 'pcm_s16le', 'pipe:1',
], { encoding: null, maxBuffer: 32 * 1024 * 1024 });
if (decoded.error) throw decoded.error;
if (decoded.status !== 0) throw new Error(decoded.stderr?.toString() || 'BGM decode failed');

const dataTag = decoded.stdout.indexOf(Buffer.from('data'));
if (dataTag < 0) throw new Error('Decoded WAV has no data chunk');
const pcmOffset = dataTag + 8;
const sampleCount = Math.floor((decoded.stdout.byteLength - pcmOffset) / 2);
const samples = new Float32Array(sampleCount);
for (let index = 0; index < sampleCount; index += 1) {
  samples[index] = decoded.stdout.readInt16LE(pcmOffset + index * 2) / 32768;
}
const energy = [];
for (let start = 0; start + hop <= samples.length; start += hop) {
  let sum = 0;
  for (let index = start; index < start + hop; index += 1) sum += samples[index] * samples[index];
  energy.push(Math.sqrt(sum / hop));
}
const onset = energy.map((value, index) => Math.max(0, value - (energy[index - 1] ?? value)));
const secondsPerHop = hop / sampleRate;

let best = { bpm: 0, score: -Infinity, lag: 0 };
for (let bpm = 110; bpm <= 135; bpm += 0.02) {
  const lag = 60 / bpm / secondsPerHop;
  let score = 0;
  for (let index = Math.ceil(lag); index < onset.length; index += 1) {
    const before = Math.floor(index - lag);
    const fraction = index - lag - before;
    const delayed = onset[before] * (1 - fraction) + (onset[before + 1] ?? onset[before]) * fraction;
    score += onset[index] * delayed;
  }
  if (score > best.score) best = { bpm, score, lag };
}

const beatSeconds = 60 / best.bpm;
let bestPhase = { phase: 0, score: -Infinity };
for (let phase = 0; phase < beatSeconds; phase += secondsPerHop / 4) {
  let score = 0;
  for (let time = phase; time < samples.length / sampleRate; time += beatSeconds) {
    const center = Math.round(time / secondsPerHop);
    for (let offset = -1; offset <= 1; offset += 1) score += onset[center + offset] ?? 0;
  }
  if (score > bestPhase.score) bestPhase = { phase, score };
}

const result = {
  sourceBpm: Number(best.bpm.toFixed(2)),
  beatPhaseSeconds: Number(bestPhase.phase.toFixed(3)),
  effectiveBpm: 120,
  playbackRate: Number((120 / best.bpm).toFixed(6)),
  analysis: 'mono RMS-onset autocorrelation, 110–135 BPM search',
};
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
