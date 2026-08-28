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

test('关键注释和移动端视角读数不再退回不可读的微小字号', () => {
  assert.match(css, /--type-micro: 0\.72rem/);
  assert.match(css, /\.detail-panel small,[\s\S]*?font-size: var\(--type-caption\)/);
  assert.match(css, /\.view-readout small \{ font: 0\.72rem/);
  const mobileTypography = css.slice(css.lastIndexOf('@media (max-width: 600px)'));
  assert.match(mobileTypography, /\.view-readout small \{ font-size: 0\.75rem/);
  assert.doesNotMatch(mobileTypography, /font-size:\s*0\.5rem/);
});

test('Canvas 经典图式标签和图式说明具有清晰的字号下限', () => {
  assert.match(starMap, /node\.layoutForceLabel \? 15 : 12\.5/);
  assert.match(starMap, /ctx\.font = '13px "Microsoft YaHei UI"/);
});
