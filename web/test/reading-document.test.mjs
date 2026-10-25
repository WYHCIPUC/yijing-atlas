import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { renderHexagramDetail } from '../js/render.js';
import { hexagramSvg } from '../js/svg-painter.js';

const hexagrams = JSON.parse(readFileSync(new URL('../data/hexagrams.json', import.meta.url), 'utf8'));

function renderDetail(hex = hexagrams[0]) {
  const mount = {
    innerHTML: '',
    querySelector: () => null,
    querySelectorAll: () => [],
  };
  renderHexagramDetail(hex, mount, hexagrams, () => {});
  return mount.innerHTML;
}

test('研读正文提供同一份目录、暖纸主体和出处边注', () => {
  const html = renderDetail();
  assert.match(html, /<div class="reading-document" data-hex-code="111111">/);
  assert.match(html, /<aside class="reading-outline" aria-label="研读目录">/);
  assert.match(html, /<details class="reading-disclosure reading-outline-disclosure" open>/);
  assert.match(html, /<summary>研读目录<\/summary>/);
  assert.match(html, /<article class="reading-paper" aria-labelledby="hexagram-detail-title">/);
  assert.match(html, /<aside class="reading-notes" aria-label="出处与研读提示">/);
  assert.match(html, /<summary>出处与研读提示<\/summary>/);
  assert.ok(html.indexOf('class="reading-outline"') < html.indexOf('class="reading-paper"'));
  assert.ok(html.indexOf('class="reading-paper"') < html.indexOf('class="reading-notes"'));
  assert.equal((html.match(/id="note-input"/g) || []).length, 1);
  assert.equal((html.match(/id="detail-judgement"/g) || []).length, 1);
  assert.match(html, /data-layer="本经原文"[^>]*>原典 · 待校验/);
  assert.match(html, /data-layer="易传"[^>]*>原典 · 待校验/);
  assert.match(html, /项目导读 · 项目自撰/);
});

test('快读的五个入口对应可见章节，目录保留所有原有锚点', () => {
  const html = renderDetail({ ...hexagrams[0], scenario: '' });
  for (const section of ['overview', 'judgement', 'commentary', 'lines', 'relations']) {
    assert.match(html, new RegExp(`data-reading-section="${section}"`));
  }
  for (const id of ['detail-identity', 'detail-scenario', 'detail-judgement', 'detail-lines', 'detail-relations', 'detail-commentary', 'detail-notes']) {
    assert.match(html, new RegExp(`href="#${id}"`));
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.doesNotMatch(html, /data-reading-section="[^"]+"[^>]*\shidden(?:\s|>)/);
  assert.match(html, /<label[^>]+for="note-input"[^>]*>我的笔记<\/label>/);
  assert.match(html, /<button type="button" class="note-save" id="note-save">/);
});

test('六爻正文按初爻至上爻阅读且保留卦象原始画法', () => {
  const source = hexagrams[0];
  const hex = { ...source, lines: [source.lines[5], source.lines[1], source.lines[4], source.lines[0], source.lines[3], source.lines[2]] };
  const orderBefore = hex.lines.map(line => line.position);
  const html = renderDetail(hex);
  const positions = Array.from(html.matchAll(/class="yao-item" data-line-position="(\d)"/g), match => Number(match[1]));
  assert.deepEqual(positions, [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(hex.lines.map(line => line.position), orderBefore);
  assert.ok(html.includes(hexagramSvg(hex.binaryCode, { size: 140 })));
});

test('窄屏目录与出处默认折叠，宽屏默认展开', () => {
  const previousWindow = globalThis.window;
  const disclosures = [{ open: true }, { open: true }];
  const mount = {
    innerHTML: '',
    querySelector: () => null,
    querySelectorAll: selector => selector === '.reading-disclosure' ? disclosures : [],
  };
  try {
    globalThis.window = { matchMedia: () => ({ matches: true }) };
    renderHexagramDetail(hexagrams[0], mount, hexagrams, () => {});
    assert.deepEqual(disclosures.map(item => item.open), [false, false]);
    globalThis.window = { matchMedia: () => ({ matches: false }) };
    renderHexagramDetail(hexagrams[0], mount, hexagrams, () => {});
    assert.deepEqual(disclosures.map(item => item.open), [true, true]);
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});

test('正文新增的爻位属性不接受注入标记', () => {
  const hex = {
    ...hexagrams[0],
    lines: [{ ...hexagrams[0].lines[0], position: '1" onmouseover="unexpected()' }],
  };
  const html = renderDetail(hex);
  assert.doesNotMatch(html, /\sonmouseover="/);
  assert.match(html, /data-line-position="1&quot; onmouseover=&quot;unexpected\(\)"/);
});

test('阅读正文继续加载与保存原有笔记，并保留关系回调', (context) => {
  const timers = [];
  context.mock.method(globalThis, 'setTimeout', handler => timers.push(handler));
  const previousStorage = globalThis.localStorage;
  const values = new Map([['yijing-notes', JSON.stringify({ '111111': '已保存的记录', '000000': '另一卦的记录' })]]);
  const handlers = new Map();
  const noteInput = { value: '' };
  const noteSave = { textContent: '保存笔记', addEventListener: (type, handler) => handlers.set(`save:${type}`, handler) };
  const chip = { dataset: { code: '000000' }, addEventListener: (type, handler) => handlers.set(`relation:${type}`, handler) };
  const picked = [];
  const mount = {
    innerHTML: '',
    querySelector(selector) {
      if (selector === '#note-input') return noteInput;
      if (selector === '#note-save') return noteSave;
      return null;
    },
    querySelectorAll: selector => selector === '.relation-chip' ? [chip] : [],
  };
  try {
    globalThis.localStorage = {
      getItem: key => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    };
    renderHexagramDetail(hexagrams[0], mount, hexagrams, code => picked.push(code));
    assert.equal(noteInput.value, '已保存的记录');
    assert.deepEqual([...values.keys()], ['yijing-notes']);
    handlers.get('relation:click')();
    assert.deepEqual(picked, ['000000']);
    noteInput.value = '本次修订的笔记';
    handlers.get('save:click')();
    assert.deepEqual(JSON.parse(values.get('yijing-notes')), { '111111': '本次修订的笔记', '000000': '另一卦的记录' });
    assert.equal(noteSave.textContent, '已保存 ✓');
    timers[0]();
    assert.equal(noteSave.textContent, '保存笔记');
  } finally {
    if (previousStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previousStorage;
  }
});
