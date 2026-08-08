import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const out = path.join(root, 'out');
const remotion = path.join(root, 'node_modules', '@remotion', 'cli', 'remotion-cli.js');
const ffmpeg = path.join(root, 'node_modules', '@remotion', 'compositor-win32-x64-msvc', 'ffmpeg.exe');

const jobs = [
  ['YijingAtlasPromo', 'yijing-atlas-promo-1080p.mp4', 'main-bgm.wav', null],
  ['YijingAtlasPromo', 'yijing-atlas-promo-1080p-nobgm.mp4', 'main-nobgm.wav', 'props-nobgm.json'],
  ['YijingAtlasTeaser', 'yijing-atlas-teaser-vertical.mp4', 'teaser-bgm.wav', null],
  ['YijingAtlasTeaser', 'yijing-atlas-teaser-vertical-nobgm.mp4', 'teaser-nobgm.wav', 'props-nobgm.json'],
];

const run = (command, args) => {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
};

for (const [composition, videoName, wavName, props] of jobs) {
  const wav = path.join(out, wavName);
  const renderArgs = [remotion, 'render', 'src/index.ts', composition, wav, '--codec=wav'];
  if (props) renderArgs.push(`--props=${props}`);
  run(process.execPath, renderArgs);

  const video = path.join(out, videoName);
  const remuxed = path.join(out, `${videoName}.remux.mp4`);
  const backup = path.join(out, `${videoName}.previous`);
  run(ffmpeg, [
    '-y', '-v', 'error', '-i', video, '-i', wav,
    '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '320k',
    '-shortest', remuxed,
  ]);
  await fs.rename(video, backup);
  try {
    await fs.rename(remuxed, video);
    await fs.rm(backup);
  } catch (error) {
    await fs.rename(backup, video).catch(() => {});
    throw error;
  }
}

console.log('Rendered updated audio and remuxed four final videos.');
