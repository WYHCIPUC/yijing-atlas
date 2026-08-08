import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '..');
const rawDir = path.join(projectRoot, 'public', 'textures', 'raw');
const outputDir = path.join(projectRoot, 'public', 'textures');

await fs.mkdir(outputDir, { recursive: true });
const files = (await fs.readdir(rawDir)).filter((file) => file.endsWith('.png'));
for (const file of files) {
  const output = path.join(outputDir, file.replace(/\.png$/, '.webp'));
  await sharp(path.join(rawDir, file)).webp({ quality: 91, smartSubsample: true }).toFile(output);
  console.log(`optimized ${path.basename(output)}`);
}
