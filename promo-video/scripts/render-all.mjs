import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const remotionCli = path.join(root, 'node_modules', '@remotion', 'cli', 'remotion-cli.js');
await fs.mkdir(path.join(root, 'out'), { recursive: true });

const jobs = [
  ['YijingAtlasPromo', 'out/yijing-atlas-promo-1080p.mp4'],
  ['YijingAtlasPromo', 'out/yijing-atlas-promo-1080p-nobgm.mp4', '--props=props-nobgm.json'],
  ['YijingAtlasTeaser', 'out/yijing-atlas-teaser-vertical.mp4'],
  ['YijingAtlasTeaser', 'out/yijing-atlas-teaser-vertical-nobgm.mp4', '--props=props-nobgm.json'],
];

for (const [composition, output, props] of jobs) {
  const args = [remotionCli, 'render', 'src/index.ts', composition, output];
  if (props) args.push(props);
  console.log(`rendering ${output}`);
  const result = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
