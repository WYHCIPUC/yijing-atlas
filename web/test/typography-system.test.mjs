import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const css = readFileSync(new URL('../styles/main.css', import.meta.url), 'utf8');
const starMap = readFileSync(new URL('../js/star-map.js', import.meta.url), 'utf8');

test('界面、阅读与标题使用分工明确的中文字体栈', () => {
  assert.match(css, /--font-ui:[^;]+Microsoft YaHei UI[^;]+sans-serif/);
  assert.match(css, /--font-reading:[^;]+Source Han Serif SC[^;]+serif/);
  assert.match(css, /--font-display:[^;]+STKaiti[^;]+serif/);
  assert.match(css, /body \{[\s\S]*?font-family: var\(--font-ui\)/);
  assert.match(css, /\.original-text[^}]+font-family: var\(--font-reading\)/);
});

test('全站字号建立 15px 硬底线并按层级递增', () => {
  assert.match(css, /--type-min: 15px/);
  assert.match(css, /--type-micro: 15px/);
  assert.match(css, /--type-caption: 16px/);
  assert.match(css, /--type-small: 17px/);
  assert.match(css, /--type-body: 18px/);
  assert.match(css, /body :where\(\*\) \{ font-size: var\(--type-min\) !important; \}/);
  assert.match(css, /\.detail-panel small,[\s\S]*?font-size: var\(--type-caption\)/);
  assert.match(css, /body :where\(h1\)[\s\S]*?font-size: clamp\(38px, 4vw, 52px\) !important/);
});

test('中文短语按控件原子、均衡标题和正文三层处理换行', () => {
  assert.match(css, /html \{[\s\S]*?line-break: strict/);
  assert.match(css, /body \{[\s\S]*?word-break: normal/);
  assert.match(css, /\.seven-step-slip span,[\s\S]*?text-wrap: balance/);
  assert.match(css, /:is\(p, li, blockquote,[\s\S]*?text-wrap: pretty/);
  assert.match(css, /#hexagram-detail-title,[\s\S]*?white-space: nowrap;[\s\S]*?word-break: keep-all/);
  assert.match(css, /@media \(max-width: 900px\) \{[\s\S]*?\.detail-panel\[data-layout="bottom"\] \.detail-content \{[\s\S]*?display: block/);
  assert.doesNotMatch(css, /word-break:\s*break-all/);
});

test('Canvas 经典图式标签和图式说明具有清晰的字号下限', () => {
  assert.match(starMap, /const MIN_VISIBLE_FONT_SIZE = 15/);
  assert.match(starMap, /Math\.max\(MIN_VISIBLE_FONT_SIZE, scaledFontSize\)/);
  assert.doesNotMatch(starMap, /ctx\.font = '(?:1[0-4](?:\.\d+)?)px/);
});

test('卦序轮盘仅显示当前扇区，避免 64 个放大标签互相覆盖', () => {
  assert.match(css, /\.guaxu-wheel-name,[\s\S]*?\.guaxu-wheel-number \{ opacity: 0/);
  assert.match(css, /\.guaxu-wheel-sector\.selected \.guaxu-wheel-name,[\s\S]*?font-size: var\(--type-min\) !important/);
});
