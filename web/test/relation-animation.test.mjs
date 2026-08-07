import assert from 'node:assert/strict';
import test from 'node:test';
import {
  closeRelationAnimation,
  createRelationAnimationFrames,
  showRelationAnimation,
} from '../js/relation-animation.js';

const asCode = (lines) => lines.map((line) => line ? '1' : '0').join('');

test('错卦逐爻变化并准确到达目标卦', () => {
  const frames = createRelationAnimationFrames('111000', '000111', 'opposite');
  assert.equal(frames.length, 6);
  assert.deepEqual(frames.map((frame) => frame.meaningIdx), [0, 1, 2, 3, 4, 5]);
  assert.equal(asCode(frames.at(-1).lines), '000111');
});

test('综卦只交换三对爻，不会在后续帧撤销翻转', () => {
  const frames = createRelationAnimationFrames('110001', '100011', 'reversed');
  assert.equal(frames.length, 3);
  assert.deepEqual(frames.map((frame) => frame.highlightIdxs), [[0, 5], [1, 4], [2, 3]]);
  assert.equal(asCode(frames.at(-1).lines), '100011');
});

test('互卦依次组成下卦与上卦', () => {
  const frames = createRelationAnimationFrames('110010', '100001', 'interlocking');
  assert.equal(frames.length, 2);
  assert.deepEqual(frames[0].highlightIdxs, [0, 1, 2]);
  assert.deepEqual(frames[1].highlightIdxs, [3, 4, 5]);
  assert.equal(asCode(frames.at(-1).lines), '100001');
});

test('变卦只生成实际变化的爻，未知关系按变卦处理', () => {
  const changing = createRelationAnimationFrames('111111', '110111', 'changing');
  const fallback = createRelationAnimationFrames('111111', '110111', 'unknown');
  assert.equal(changing.length, 1);
  assert.equal(changing[0].meaningIdx, 2);
  assert.deepEqual(fallback, changing);
});

test('无变化与非法卦码得到明确结果', () => {
  assert.deepEqual(createRelationAnimationFrames('111111', '111111', 'changing'), []);
  assert.throws(() => createRelationAnimationFrames('111', '000000', 'opposite'), /6 位/);
  assert.throws(() => createRelationAnimationFrames('111111', '00000x', 'opposite'), /6 位/);
});

class FakeClassList {
  constructor() {
    this.values = new Set();
  }

  add(value) {
    this.values.add(value);
  }

  remove(value) {
    this.values.delete(value);
  }

  contains(value) {
    return this.values.has(value);
  }
}

class FakeElement {
  constructor(document, tagName = 'div') {
    this.document = document;
    this.tagName = tagName;
    this.classList = new FakeClassList();
    this.listeners = new Map();
    this.attributes = new Map();
    this.children = [];
    this.disabled = false;
    this.isConnected = true;
    this.textContent = '';
    this._innerHTML = '';
    this._selectors = new Map();
  }

  set innerHTML(value) {
    this._innerHTML = value;
    if (!value.includes('rel-anim-card')) return;
    const close = new FakeElement(this.document, 'button');
    const play = new FakeElement(this.document, 'button');
    const target = new FakeElement(this.document);
    const hint = new FakeElement(this.document, 'p');
    const meaning = new FakeElement(this.document);
    const svg = new FakeElement(this.document, 'svg');
    svg.outerHTML = '';
    target._selectors.set('svg', svg);
    this._selectors = new Map([
      ['.rel-anim-close', close],
      ['.rel-anim-play', play],
      ['.rel-anim-to', target],
      ['.rel-anim-hint', hint],
      ['.rel-anim-meaning', meaning],
    ]);
  }

  get innerHTML() {
    return this._innerHTML;
  }

  setAttribute(name, value) {
    this.attributes.set(name, value);
  }

  getAttribute(name) {
    return this.attributes.get(name);
  }

  appendChild(child) {
    this.children.push(child);
    return child;
  }

  querySelector(selector) {
    return this._selectors.get(selector) || null;
  }

  querySelectorAll(selector) {
    if (selector !== 'button:not(:disabled)') return [];
    return ['.rel-anim-close', '.rel-anim-play']
      .map((key) => this._selectors.get(key))
      .filter((element) => element && !element.disabled);
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) || [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  dispatch(type, event = {}) {
    const payload = { target: this, preventDefault() {}, ...event };
    for (const listener of this.listeners.get(type) || []) listener(payload);
  }

  focus() {
    this.document.activeElement = this;
  }
}

test('浮层支持减少动态效果、焦点管理、Esc 与计时器清理', () => {
  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;
  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;
  let reducedMotion = true;
  let nextTimerId = 0;
  const timers = new Map();
  const fakeDocument = {
    activeElement: null,
    createElement(tagName) {
      return new FakeElement(fakeDocument, tagName);
    },
  };
  fakeDocument.body = new FakeElement(fakeDocument, 'body');
  const trigger = new FakeElement(fakeDocument, 'button');
  fakeDocument.activeElement = trigger;
  globalThis.document = fakeDocument;
  globalThis.window = { matchMedia: () => ({ matches: reducedMotion }) };
  globalThis.setTimeout = (callback) => {
    const id = ++nextTimerId;
    timers.set(id, callback);
    return id;
  };
  globalThis.clearTimeout = (id) => timers.delete(id);

  const flushTimers = () => {
    while (timers.size > 0) {
      const [id, callback] = timers.entries().next().value;
      timers.delete(id);
      callback();
    }
  };
  const hexagram = (code) => ({
    lines: [...code].map((value, index) => ({ isYang: value === '1', text: `第${index + 1}爻：测试爻辞。` })),
  });

  try {
    assert.throws(
      () => showRelationAnimation('111', '000000', 'opposite', '原', '目标'),
      /6 位/,
    );

    showRelationAnimation(
      '111000', '000111', 'opposite', '<原卦>', '<目标卦>',
      hexagram('111000'), hexagram('000111'),
    );
    const overlay = fakeDocument.body.children[0];
    const close = overlay.querySelector('.rel-anim-close');
    const play = overlay.querySelector('.rel-anim-play');
    assert.equal(overlay.classList.contains('open'), true);
    assert.equal(overlay.getAttribute('aria-hidden'), 'false');
    assert.match(overlay.innerHTML, /&lt;原卦&gt;/);
    assert.equal(fakeDocument.activeElement, close);

    play.dispatch('click');
    assert.equal(timers.size, 0);
    assert.equal(play.disabled, false);
    assert.equal(overlay.querySelector('.rel-anim-hint').textContent, '全部阴阳互换完成。');

    let prevented = false;
    fakeDocument.activeElement = close;
    overlay.dispatch('keydown', { key: 'Tab', shiftKey: true, preventDefault: () => { prevented = true; } });
    assert.equal(prevented, true);
    assert.equal(fakeDocument.activeElement, play);
    overlay.dispatch('keydown', { key: 'Tab', shiftKey: false });
    assert.equal(fakeDocument.activeElement, close);

    reducedMotion = false;
    const cases = [
      ['110001', '100011', 'reversed', '翻转完成。同一卦换个角度看，意义不同。'],
      ['110010', '100001', 'interlocking', '内含之卦已显现。'],
      ['111111', '110111', 'changing', '变卦完成。'],
    ];
    for (const [from, to, type, message] of cases) {
      showRelationAnimation(from, to, type, '原', '目标', hexagram(from), hexagram(to));
      overlay.querySelector('.rel-anim-play').dispatch('click');
      flushTimers();
      assert.equal(overlay.querySelector('.rel-anim-hint').textContent, message);
    }

    showRelationAnimation('111000', '000111', 'opposite', '原', '目标');
    overlay.querySelector('.rel-anim-play').dispatch('click');
    assert.equal(timers.size, 1);
    overlay.dispatch('keydown', { key: 'Escape' });
    assert.equal(timers.size, 0);
    assert.equal(overlay.classList.contains('open'), false);
    assert.equal(fakeDocument.activeElement, trigger);

    showRelationAnimation('111000', '000111', 'opposite', '原', '目标');
    overlay.dispatch('keydown', { key: 'ArrowLeft' });
    overlay.querySelector('.rel-anim-close').disabled = true;
    overlay.querySelector('.rel-anim-play').disabled = true;
    overlay.dispatch('keydown', { key: 'Tab' });
    closeRelationAnimation();

    globalThis.window = {};
    fakeDocument.activeElement = null;
    showRelationAnimation('111000', '000111', 'opposite', '原', '目标');
    overlay.querySelector('.rel-anim-play').dispatch('click');
    assert.equal(timers.size, 1);
    closeRelationAnimation();

    showRelationAnimation('111000', '000111', 'opposite', '原', '目标');
    overlay._selectors.delete('.rel-anim-hint');
    overlay.querySelector('.rel-anim-play').dispatch('click');
    closeRelationAnimation();

    showRelationAnimation('111000', '000111', 'opposite', '原', '目标');
    overlay.dispatch('click', { target: overlay });
    assert.equal(overlay.classList.contains('open'), false);
    closeRelationAnimation();
  } finally {
    closeRelationAnimation();
    globalThis.document = originalDocument;
    globalThis.window = originalWindow;
    globalThis.setTimeout = originalSetTimeout;
    globalThis.clearTimeout = originalClearTimeout;
  }
});
