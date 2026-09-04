import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../styles/main.css', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const browserSmoke = readFileSync(new URL('../../scripts/browser-smoke.mjs', import.meta.url), 'utf8');

assert.match(css, /\.daily-verse\s*{[^}]*white-space:\s*nowrap/s);
assert.match(css, /\.daily-entry-actions\s*{[^}]*grid-template-columns:\s*repeat\(2/s);
assert.match(css, /@media \(max-width:\s*900px\)[\s\S]*?\.daily-verse\s*{[^}]*font-size:\s*min\(1\.05rem,\s*4vw\)/s);
assert.match(css, /@media \(max-width:\s*600px\)[\s\S]*?\.daily-entry-actions\s*{[^}]*grid-template-columns:\s*1fr/s);
assert.match(html, /data-entry="beginner">零基础开始<\/button>/);
assert.match(html, /data-entry="explore">探索星图<\/button>/);
assert.match(html, /data-entry="daily">阅读今日一卦<\/button>/);
assert.match(browserSmoke, /querySelector\('\[data-entry="explore"\]'\)/);
assert.doesNotMatch(browserSmoke, /#daily-enter/);

console.log('✓ 今日卦引文保持单行并在窄屏缩放');
