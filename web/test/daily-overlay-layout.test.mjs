import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../styles/main.css', import.meta.url), 'utf8');
const immersiveCSS = readFileSync(new URL('../styles/immersive.css', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const main = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
const browserSmoke = readFileSync(new URL('../../scripts/browser-smoke.mjs', import.meta.url), 'utf8');

assert.match(immersiveCSS, /\.daily-verse\s*{[^}]*white-space:\s*normal[^}]*overflow-wrap:\s*anywhere/s);
assert.match(css, /\.daily-entry-actions\s*{[^}]*grid-template-columns:\s*repeat\(2/s);
assert.match(css, /@media \(max-width:\s*900px\)[\s\S]*?\.daily-verse\s*{[^}]*font-size:\s*min\(1\.05rem,\s*4vw\)/s);
assert.match(css, /@media \(max-width:\s*600px\)[\s\S]*?\.daily-entry-actions\s*{[^}]*grid-template-columns:\s*1fr/s);
const entryLabels = new Map([...html.matchAll(/<button[^>]*data-entry="([^"]+)"[^>]*>([\s\S]*?)<\/button>/g)]
  .map((match) => [match[1], match[2].replace(/<[^>]+>/g, '').trim()]));
assert.equal(entryLabels.get('beginner'), '零基础开始');
assert.equal(entryLabels.get('explore'), '探索星图');
assert.equal(entryLabels.get('daily'), '阅读今日一卦');
assert.match(html, /class="daily-card"[^>]*role="dialog"[^>]*aria-modal="true"/);
assert.match(html, /rel="preload" as="image" href="assets\/academy-astrolabe-bg\.webp" fetchpriority="high"/);
assert.match(main, /function setDailyBackgroundInert\(inert\)/);
assert.match(main, /function trapDailyFocus\(event\)/);
assert.match(main, /motionSystem\.reveal\(dailyOverlay, \{ animate: false \}\)/);
assert.match(main, /dailyOverlay\.dataset\.motionInstant = 'true'/);
assert.match(css, /\.daily-overlay\[data-motion-instant="true"\] \.motion-item-enter/);
assert.match(browserSmoke, /mouseClick\(client, '\[data-entry="explore"\]'\)/);
assert.doesNotMatch(browserSmoke, /#daily-enter/);

console.log('✓ 欢迎三入口保留名称与模态交互，今日卦引文在窄屏可换行');
