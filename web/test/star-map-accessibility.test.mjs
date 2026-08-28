import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const main = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../styles/main.css', import.meta.url), 'utf8');

test('Canvas 提供等价文字关系列表和实时状态，不误报浏览器不支持', () => {
  assert.match(html, /id="star-canvas"[^>]+aria-describedby="star-canvas-description star-relation-status"/);
  assert.match(html, /id="star-accessible-list"/);
  assert.match(main, /starMap\?\.focusStar\(relationButton\.dataset\.code\)/);
  assert.match(html, /id="star-relation-status" role="status" aria-live="polite"/);
  assert.doesNotMatch(html, /你的浏览器不支持星图画布/);
  assert.match(main, /updateRelationInterface/);
  assert.match(main, /data-code/);
});

test('移动端主导航以三列两行完整展示六个入口', () => {
  const compactBlock = css.match(/\/\* 移动端主导航完整可见[\s\S]*$/)?.[0] || '';
  assert.match(compactBlock, /grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(compactBlock, /overflow:\s*visible/);
  assert.match(compactBlock, /--header-height:\s*174px/);
});
