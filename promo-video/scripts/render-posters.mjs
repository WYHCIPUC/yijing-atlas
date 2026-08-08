import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const qaDir = path.join(root, 'out', 'qa');
const readmeAssets = path.resolve(root, '..', 'assets', 'readme');
const remotionCli = path.join(root, 'node_modules', '@remotion', 'cli', 'remotion-cli.js');
await fs.mkdir(qaDir, { recursive: true });
await fs.mkdir(readmeAssets, { recursive: true });

const posters = [
  ['YijingAtlasPromo', '2960', 'promo-poster.png', 'promo-poster.webp'],
  ['YijingAtlasTeaser', '845', 'promo-poster-vertical.png', 'promo-poster-vertical.webp'],
];

for (const [composition, frame, png, webp] of posters) {
  const result = spawnSync(process.execPath, [remotionCli, 'still', 'src/index.ts', composition, path.join('out', 'qa', png), `--frame=${frame}`], { cwd: root, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
  await sharp(path.join(qaDir, png)).webp({ quality: 92 }).toFile(path.join(readmeAssets, webp));
}
