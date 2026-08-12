import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const qaDir = path.join(root, 'out', 'qa');
await fs.mkdir(qaDir, { recursive: true });

const remotionCli = path.join(root, 'node_modules', '@remotion', 'cli', 'remotion-cli.js');
const tscCli = path.join(root, 'node_modules', 'typescript', 'bin', 'tsc');
const run = (entry, args) => {
  const result = spawnSync(process.execPath, [entry, ...args], { cwd: root, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
};

run(tscCli, ['--noEmit']);

const mainShots = {
  hook: [0, 135], opening: [135, 195], starMap: [330, 360], evolution: [690, 345],
  wheel: [1035, 300], almanac: [1335, 300], breath: [1635, 150], learning: [1785, 450],
  assessment: [2235, 330], divination: [2565, 300], outro: [2865, 135],
};
const teaserShots = {
  hook: [0, 90], opening: [90, 90], starMap: [180, 120], evolution: [300, 120],
  almanac: [420, 105], learning: [525, 105], assessment: [630, 120], outro: [750, 150],
};
const samples = (shots) => Object.entries(shots).flatMap(([name, [from, duration]]) => [
  [`${name}-entry`, from + Math.min(12, Math.floor(duration * 0.12))],
  [`${name}-peak`, from + Math.round(duration * 0.58)],
  [`${name}-settle`, from + duration - Math.min(32, Math.floor(duration * 0.22))],
]);
const mainFrames = samples(mainShots);
const teaserFrames = samples(teaserShots);
for (const [name, frame] of mainFrames) {
  run(remotionCli, ['still', 'src/index.ts', 'YijingAtlasPromo', `out/qa/main-${name}-f${frame}.png`, `--frame=${frame}`]);
}
for (const [name, frame] of teaserFrames) {
  run(remotionCli, ['still', 'src/index.ts', 'YijingAtlasTeaser', `out/qa/teaser-${name}-f${frame}.png`, `--frame=${frame}`]);
}

run(remotionCli, ['still', 'src/index.ts', 'YijingAtlasPromo', 'out/qa/determinism-a.png', '--frame=1210']);
run(remotionCli, ['still', 'src/index.ts', 'YijingAtlasPromo', 'out/qa/determinism-b.png', '--frame=1210']);
const hash = async (file) => crypto.createHash('sha256').update(await fs.readFile(file)).digest('hex');
const [hashA, hashB] = await Promise.all([hash(path.join(qaDir, 'determinism-a.png')), hash(path.join(qaDir, 'determinism-b.png'))]);
if (hashA !== hashB) throw new Error('determinism check failed: repeated frame hashes differ');

for (const [name, frame] of mainFrames) {
  const metadata = await sharp(path.join(qaDir, `main-${name}-f${frame}.png`)).metadata();
  if (metadata.width !== 1920 || metadata.height !== 1080) throw new Error(`invalid main still dimensions at frame ${frame}`);
}
for (const [name, frame] of teaserFrames) {
  const metadata = await sharp(path.join(qaDir, `teaser-${name}-f${frame}.png`)).metadata();
  if (metadata.width !== 1080 || metadata.height !== 1920) throw new Error(`invalid teaser still dimensions at frame ${frame}`);
}

for (const [name, [from]] of Object.entries(mainShots)) {
  const beatError = Math.min(from % 15, 15 - (from % 15));
  if (beatError > 3) throw new Error(`main shot ${name} is ${beatError} frames away from a beat`);
}
for (const [name, [from]] of Object.entries(teaserShots)) {
  const beatError = Math.min(from % 15, 15 - (from % 15));
  if (beatError > 3) throw new Error(`teaser shot ${name} is ${beatError} frames away from a beat`);
}

const sources = await Promise.all((await fs.readdir(path.join(root, 'src')))
  .filter((file) => file.endsWith('.ts') || file.endsWith('.tsx'))
  .map((file) => fs.readFile(path.join(root, 'src', file), 'utf8')));
if (/Math\.random\(|Date\.now\(/.test(sources.join('\n'))) throw new Error('non-deterministic API found in Remotion source');

const report = {
  mainShots: Object.keys(mainShots).length,
  teaserShots: Object.keys(teaserShots).length,
  sampledStills: mainFrames.length + teaserFrames.length,
  effectiveBpm: 120,
  beatIntervalFrames: 15,
  maximumCutBeatErrorFrames: 0,
  deterministicFrameSha256: hashA,
};
await fs.writeFile(path.join(qaDir, 'qa-report.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(`QA passed: ${report.sampledStills} key stills and deterministic frame hash ${hashA.slice(0, 12)}`);
