import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { renderHexagramDetail } from '../js/render.js';

const hexagrams = JSON.parse(readFileSync(new URL('../data/hexagrams.json', import.meta.url), 'utf8'));

test('卦象关系入口使用原生按钮并保留演示按钮', () => {
  const mount = {
    innerHTML: '',
    querySelector: () => null,
    querySelectorAll: () => [],
  };
  renderHexagramDetail(hexagrams[0], mount, hexagrams, () => {});
  assert.match(mount.innerHTML, /<button type="button" class="relation-chip"/);
  assert.doesNotMatch(mount.innerHTML, /<span class="relation-chip"/);
  assert.match(mount.innerHTML, /<button class="rel-demo-btn"/);
  assert.match(mount.innerHTML, /<button type="button" class="evolution-launch">进入演变实验室<\/button>/);
});
