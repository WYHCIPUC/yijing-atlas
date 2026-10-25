import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const main = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../styles/main.css', import.meta.url), 'utf8');
const immersive = readFileSync(new URL('../styles/immersive.css', import.meta.url), 'utf8');

test('Canvas 提供等价文字关系列表和实时状态，不误报浏览器不支持', () => {
  assert.match(html, /id="star-canvas"[^>]+aria-describedby="star-canvas-description star-layout-description star-relation-status"/);
  assert.match(html, /id="star-accessible-list"/);
  assert.match(main, /focusHexagram\(relationButton\.dataset\.code\)/);
  assert.match(html, /id="star-relation-status" role="status" aria-live="polite"/);
  assert.doesNotMatch(html, /你的浏览器不支持星图画布/);
  assert.match(main, /updateRelationInterface/);
  assert.match(main, /data-code/);
});

test('星图提供五种明确标注来源的阅读图式', () => {
  assert.match(html, /id="star-layout-mode"/);
  for (const mode of ['project', 'earlier-heaven', 'king-wen', 'eight-palaces', 'twelve-messages']) {
    assert.match(html, new RegExp(`value="${mode}"`));
  }
  assert.match(html, /id="star-layout-source"/);
  assert.match(html, /id="star-layout-description"[^>]+aria-live="polite"/);
  assert.match(main, /updateLayoutInterface/);
  assert.match(main, /starMap\?\.setLayoutMode/);
});

test('移动端六个导航入口采用紧凑单行并保留触控高度', () => {
  assert.match(immersive, /\.mode-switcher\s*\{[^}]*display:\s*flex/);
  assert.match(immersive, /--header-height:\s*116px/);
  assert.match(immersive, /\.mode-btn\s*\{[^}]*min-height:\s*44px/);
  assert.match(immersive, /\.mode-btn \[data-icon\]\s*\{\s*display:\s*none/);
  assert.match(css, /\.mode-btn/);
});
