import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const topicRoot = path.join(root, 'docs/development');
const files = [
  path.join(root, 'docs/DEVELOPMENT-MASTER.md'),
  ...fs.readdirSync(topicRoot).filter((name) => name.endsWith('.md')).map((name) => path.join(topicRoot, name)),
  path.join(topicRoot, 'evidence/2026-10-24-validation.md'),
];
const issues = [];
const anchorCache = new Map();
const tasks = new Map();
const taskReferences = new Set();
const requirementIds = new Set();
let linkCount = 0;
let lineCount = 0;

function withoutFences(text) {
  let fence = null;
  return text.split(/\r?\n/).map((line) => {
    const match = line.match(/^\s*(`{3,}|~{3,})/);
    if (match) {
      if (!fence) fence = match[1][0];
      else if (match[1][0] === fence) fence = null;
      return '';
    }
    return fence ? '' : line;
  }).join('\n');
}

function slug(text) {
  return text.toLowerCase().replace(/<[^>]*>/g, '').replace(/[`*]/g, '')
    .replace(/[^\p{L}\p{N}\s_-]/gu, '').trim().replace(/\s/g, '-');
}

function anchors(file) {
  if (anchorCache.has(file)) return anchorCache.get(file);
  const text = withoutFences(fs.readFileSync(file, 'utf8'));
  const result = new Set();
  const duplicates = new Map();
  for (const match of text.matchAll(/^#{1,6}\s+(.+)$/gm)) {
    const base = slug(match[1]);
    const count = duplicates.get(base) || 0;
    result.add(count ? base + '-' + count : base);
    duplicates.set(base, count + 1);
  }
  for (const match of text.matchAll(/<a\s+id="([^"]+)"/g)) result.add(match[1]);
  anchorCache.set(file, result);
  return result;
}

for (const file of files) {
  if (!fs.existsSync(file)) {
    issues.push({ file: path.relative(root, file), error: 'missing document' });
    continue;
  }
  const raw = fs.readFileSync(file, 'utf8');
  const relative = path.relative(root, file).replaceAll('\\', '/');
  const lines = raw.split(/\r?\n/);
  lineCount += lines.length;
  lines.forEach((line, index) => {
    if (/\t| +$/.test(line)) issues.push({ file: relative, line: index + 1, error: 'whitespace' });
  });
  const text = withoutFences(raw);
  const links = /!?\[[^\]\n]*\]\((?:<([^>]+)>|([^\s)]+))(?:\s+"[^"\n]*")?\)/g;
  for (const match of text.matchAll(links)) {
    const reference = match[1] || match[2];
    if (/^[a-z][a-z\d+.-]*:/i.test(reference)) continue;
    linkCount += 1;
    const [relativeTarget, fragment] = reference.split('#');
    let target;
    try {
      target = relativeTarget ? path.resolve(path.dirname(file), decodeURIComponent(relativeTarget)) : file;
    } catch {
      issues.push({ file: relative, reference, error: 'invalid encoded path' });
      continue;
    }
    if (!fs.existsSync(target)) {
      issues.push({ file: relative, reference, error: 'missing target' });
    } else if (fragment && target.endsWith('.md') && !anchors(target).has(decodeURIComponent(fragment))) {
      issues.push({ file: relative, reference, error: 'missing anchor' });
    }
  }
  for (const match of text.matchAll(/12-ai-execution-tasks\.md#(t-[a-z\d-]+)/g)) taskReferences.add(match[1]);
  if (relative.endsWith('/12-ai-execution-tasks.md')) {
    for (const match of text.matchAll(/^\| (REQ-[A-Z\d-]+) \|/gm)) {
      if (requirementIds.has(match[1])) issues.push({ error: 'duplicate requirement', id: match[1] });
      requirementIds.add(match[1]);
    }
    for (const match of text.matchAll(/^\| \[(T-[A-Z\d-]+)\]\(#[^)]+\) \|([^\n]+)$/gm)) {
      const dependencies = [...match[2].matchAll(/\[(T-[A-Z\d-]+)\]\(#/g)].map((item) => item[1]);
      if (tasks.has(match[1])) issues.push({ error: 'duplicate task', id: match[1] });
      tasks.set(match[1], dependencies);
      if (!anchors(file).has(match[1].toLowerCase())) issues.push({ error: 'task anchor missing', id: match[1] });
    }
  }
}

const visited = new Set();
function visit(id, chain = []) {
  if (chain.includes(id)) {
    issues.push({ error: 'dependency cycle', chain: [...chain, id] });
    return;
  }
  if (visited.has(id)) return;
  if (!tasks.has(id)) {
    issues.push({ error: 'undefined dependency', id });
    return;
  }
  for (const dependency of tasks.get(id)) visit(dependency, [...chain, id]);
  visited.add(id);
}
for (const id of tasks.keys()) visit(id);
for (const id of taskReferences) {
  if (!tasks.has(id.toUpperCase())) issues.push({ error: 'undefined task reference', id });
}

let sourceGuard = null;
if (process.argv.includes('--source-guard')) {
  const snapshot = JSON.parse(fs.readFileSync(path.join(topicRoot, 'evidence/2026-10-24-source-snapshot.json'), 'utf8'));
  const allowedDocument = new Set(['web/README.md']);
  sourceGuard = { baseline: snapshot.protectedFiles.length, unchanged: 0, allowedDocumentChanges: [] };
  for (const entry of snapshot.protectedFiles) {
    const file = path.resolve(root, entry.path);
    if (!fs.existsSync(file)) {
      issues.push({ error: 'baseline file missing', file: entry.path });
      continue;
    }
    const hash = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    if (hash === entry.sha256) sourceGuard.unchanged += 1;
    else if (allowedDocument.has(entry.path)) sourceGuard.allowedDocumentChanges.push(entry.path);
    else issues.push({ error: 'source changed during documentation task', file: entry.path });
  }
}

console.log(JSON.stringify({
  documents: files.length,
  lines: lineCount,
  localLinks: linkCount,
  tasks: tasks.size,
  requirements: requirementIds.size,
  sourceGuard,
  issues,
}, null, 2));
if (issues.length) process.exitCode = 1;
