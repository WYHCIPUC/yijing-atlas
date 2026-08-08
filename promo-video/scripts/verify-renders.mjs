import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const binDir = path.join(root, 'node_modules', '@remotion', 'compositor-win32-x64-msvc');
const ffmpeg = path.join(binDir, 'ffmpeg.exe');
const ffprobe = path.join(binDir, 'ffprobe.exe');

const jobs = [
  ['yijing-atlas-promo-1080p.mp4', 1920, 1080, 100],
  ['yijing-atlas-promo-1080p-nobgm.mp4', 1920, 1080, 100],
  ['yijing-atlas-teaser-vertical.mp4', 1080, 1920, 30],
  ['yijing-atlas-teaser-vertical-nobgm.mp4', 1080, 1920, 30],
];

const report = {};
for (const [name, expectedWidth, expectedHeight, expectedDuration] of jobs) {
  const file = path.join(root, 'out', name);
  const probe = spawnSync(ffprobe, ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', file], { encoding: 'utf8' });
  if (probe.error) throw probe.error;
  if (probe.status !== 0) throw new Error(probe.stderr || `ffprobe failed for ${name}`);
  const metadata = JSON.parse(probe.stdout);
  const video = metadata.streams.find((stream) => stream.codec_type === 'video');
  const audio = metadata.streams.find((stream) => stream.codec_type === 'audio');
  const duration = Number(metadata.format.duration);
  if (video?.width !== expectedWidth || video?.height !== expectedHeight) throw new Error(`invalid dimensions: ${name}`);
  if (!audio || Number(audio.sample_rate) !== 48000 || audio.channels !== 2) throw new Error(`invalid audio stream: ${name}`);
  if (Math.abs(duration - expectedDuration) > 0.1) throw new Error(`invalid duration: ${name} (${duration})`);

  const decoded = spawnSync(ffmpeg, ['-v', 'error', '-i', file, '-vn', '-ac', '2', '-ar', '48000', '-f', 'wav', '-acodec', 'pcm_s16le', 'pipe:1'], {
    encoding: null,
    maxBuffer: 48 * 1024 * 1024,
  });
  if (decoded.error) throw decoded.error;
  if (decoded.status !== 0) throw new Error(decoded.stderr?.toString() || `audio decode failed for ${name}`);
  const dataTag = decoded.stdout.indexOf(Buffer.from('data'));
  if (dataTag < 0) throw new Error(`no PCM data in ${name}`);
  let peak = 0;
  let sumSquares = 0;
  let count = 0;
  for (let offset = dataTag + 8; offset + 1 < decoded.stdout.length; offset += 2) {
    const sample = decoded.stdout.readInt16LE(offset);
    peak = Math.max(peak, Math.abs(sample));
    sumSquares += sample * sample;
    count += 1;
  }
  const peakDbfs = 20 * Math.log10(peak / 32768);
  const rmsDbfs = 20 * Math.log10(Math.sqrt(sumSquares / count) / 32768);
  if (peak >= 32767) throw new Error(`audio peak clips in ${name}`);
  report[name] = {
    width: video.width,
    height: video.height,
    durationSeconds: Number(duration.toFixed(3)),
    videoCodec: video.codec_name,
    audioCodec: audio.codec_name,
    sampleRate: Number(audio.sample_rate),
    channels: audio.channels,
    peakDbfs: Number(peakDbfs.toFixed(2)),
    rmsDbfs: Number(rmsDbfs.toFixed(2)),
    bytes: Number(metadata.format.size),
  };
}

await fs.mkdir(path.join(root, 'out', 'qa'), { recursive: true });
await fs.writeFile(path.join(root, 'out', 'qa', 'render-report.json'), `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
