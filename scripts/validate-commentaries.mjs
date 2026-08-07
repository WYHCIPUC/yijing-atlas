import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateCommentaryCatalog } from '../web/js/commentary-catalog.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const commentaryRoot = join(root, 'web', 'data', 'commentaries');
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const manifest = readJson(join(commentaryRoot, 'manifest.json'));
const sources = readJson(join(commentaryRoot, 'sources.json'));
const hexagramRoot = join(commentaryRoot, 'hexagrams');
const documents = existsSync(hexagramRoot)
  ? readdirSync(hexagramRoot).filter((name) => name.endsWith('.json')).map((name) => readJson(join(hexagramRoot, name)))
  : [];
const result = validateCommentaryCatalog(manifest, sources, documents);

if (!result.valid || (manifest.releaseReady && !result.canRelease)) {
  console.error(result.errors.join('\n'));
  process.exit(1);
}
console.log(result.canRelease
  ? '✓ 六家注疏发布门禁通过'
  : '✓ 六家注疏目录有效，发布门禁保持关闭');
