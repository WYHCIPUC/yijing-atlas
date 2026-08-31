import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { renderHexagramDetail } from '../js/render.js';
import { hexagramSvg, trigramSvg } from '../js/svg-painter.js';

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

test('卦象详情提供稳定页面标题与可同步的六爻折叠按钮', () => {
  const toggleClasses = new Set();
  const bodyClasses = new Set();
  const attributes = new Map();
  let onToggle = null;
  const toggle = {
    classList: {
      toggle(name) {
        if (toggleClasses.has(name)) {
          toggleClasses.delete(name);
          return false;
        }
        toggleClasses.add(name);
        return true;
      },
    },
    addEventListener(type, listener) {
      if (type === 'click') onToggle = listener;
    },
    setAttribute(name, value) {
      attributes.set(name, value);
    },
  };
  const body = {
    classList: {
      toggle(name, force) {
        if (force) bodyClasses.add(name);
        else bodyClasses.delete(name);
      },
    },
  };
  const mount = {
    innerHTML: '',
    querySelector(selector) {
      if (selector === '#yao-toggle') return toggle;
      if (selector === '#yao-body') return body;
      return null;
    },
    querySelectorAll: () => [],
  };

  renderHexagramDetail(hexagrams[0], mount, hexagrams, () => {});

  assert.match(mount.innerHTML, /<h1 id="hexagram-detail-title" class="compound-title compound-title--hexagram" data-page-heading tabindex="-1" aria-label="乾 · 乾为天">/);
  assert.match(mount.innerHTML, /<span class="compound-title-primary">乾<\/span><span class="compound-title-separator" aria-hidden="true">·<\/span><span class="compound-title-secondary">乾为天<\/span>/);
  assert.match(mount.innerHTML, /<button[^>]+id="yao-toggle"[^>]+aria-expanded="true"[^>]+aria-controls="yao-body"/);
  assert.match(mount.innerHTML, /id="yao-body" role="region" aria-labelledby="yao-toggle"/);
  assert.match(mount.innerHTML, /class="seven-step-slip"/);
  assert.match(mount.innerHTML, /本经原文 · 待校验/);
  assert.match(mount.innerHTML, /项目导读 · 项目自撰/);
  assert.ok(mount.innerHTML.indexOf('id="detail-lines"') < mount.innerHTML.indexOf('id="detail-relations"'));

  toggleClasses.add('open');
  bodyClasses.add('open');

  onToggle();
  assert.equal(attributes.get('aria-expanded'), 'false');
  assert.equal(toggleClasses.has('open'), false);
  assert.equal(bodyClasses.has('open'), false);

  onToggle();
  assert.equal(attributes.get('aria-expanded'), 'true');
  assert.equal(toggleClasses.has('open'), true);
  assert.equal(bodyClasses.has('open'), true);
});

test('卦象与八卦 SVG 爻线继承当前文字颜色', () => {
  assert.match(hexagramSvg('111111'), /<g stroke="currentColor"/);
  assert.match(trigramSvg('111'), /<g stroke="currentColor"/);
});
