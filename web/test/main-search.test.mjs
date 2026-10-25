import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { buildHexagramIndex, searchHexagrams } from '../js/data-loader.js';
import { moveSelection, parseHexagramQuery } from '../js/search-controller.js';

const mainSource = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
const start = mainSource.indexOf('  const closeSearch = () => {');
const end = mainSource.indexOf("  window.addEventListener('popstate'", start);
assert.ok(start >= 0 && end > start, '执行真实入口搜索绑定，不复制搜索处理逻辑');
const searchSource = mainSource.slice(start, end);
const hexagrams = JSON.parse(readFileSync(new URL('../data/hexagrams.json', import.meta.url), 'utf8'));
const trigrams = JSON.parse(readFileSync(new URL('../data/trigrams.json', import.meta.url), 'utf8'));

// This small event/DOM fixture executes the production listeners. It is a logic
// regression harness, not evidence of trusted browser input or IME compatibility.
class Element {
  constructor(document, tagName = 'div') {
    this.ownerDocument = document;
    this.tagName = tagName.toUpperCase();
    this.parentElement = null;
    this.children = [];
    this.attributes = new Map();
    this.listeners = new Map();
    this.dataset = {};
    this.hidden = false;
    this.inert = false;
    this.disabled = false;
    this.value = '';
    this.id = '';
    this.className = '';
    this.textContent = '';
    this.isConnected = true;
    this.isContentEditable = false;
    this.focusAttempts = 0;
    this.selectCalls = 0;
    this.classList = {
      contains: name => this.className.split(/\s+/).includes(name),
      toggle: (name, enabled) => {
        const classes = new Set(this.className.split(/\s+/).filter(Boolean));
        if (enabled) classes.add(name); else classes.delete(name);
        this.className = [...classes].join(' ');
      },
    };
  }

  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  removeAttribute(name) { this.attributes.delete(name); }
  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) || [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }
  append(...children) {
    for (const child of children) {
      child.parentElement = this;
      this.children.push(child);
    }
  }
  appendChild(child) { this.append(child); return child; }
  replaceChildren(...children) {
    this.children.forEach(child => { child.parentElement = null; });
    this.children = [];
    this.append(...children);
  }
  contains(node) { return node === this || this.children.some(child => child.contains(node)); }
  matches(selector) {
    if (selector === '[inert]') return this.inert;
    if (selector === '[hidden]') return this.hidden;
    if (selector.startsWith('.')) return this.classList.contains(selector.slice(1));
    if (selector.startsWith('#')) return this.id === selector.slice(1);
    return this.tagName.toLowerCase() === selector;
  }
  closest(selector) {
    if (this.matches(selector)) return this;
    return this.parentElement?.closest(selector) || null;
  }
  querySelectorAll(selector) {
    return this.children.flatMap(child => [
      ...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector),
    ]);
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  getClientRects() { return this.hidden || this.closest('[hidden]') ? [] : [{}]; }
  focus() {
    this.focusAttempts += 1;
    if (this.closest('[inert]') || this.hidden || this.disabled || this.ownerDocument.activeElement === this) return;
    this.ownerDocument.activeElement = this;
    this.ownerDocument.dispatch(this, 'focus', {}, false);
  }
  select() { this.selectCalls += 1; }
  scrollIntoView() {}
}

class InputElement extends Element {}
class TextAreaElement extends Element {}

function createHarness({ coreReady = true, hexagramData = hexagrams } = {}) {
  const document = {
    listeners: new Map(), activeElement: null,
    addEventListener: Element.prototype.addEventListener,
    createElement(tagName) { return new Element(this, tagName); },
    querySelector(selector) { return this.body.querySelector(selector); },
    querySelectorAll(selector) { return this.body.querySelectorAll(selector); },
    dispatch(target, type, properties = {}, bubbles = true) {
      const event = {
        target, currentTarget: null, defaultPrevented: false, propagationStopped: false,
        key: '', isComposing: false, keyCode: 0, ctrlKey: false, metaKey: false, altKey: false,
        preventDefault() { this.defaultPrevented = true; },
        stopPropagation() { this.propagationStopped = true; },
        ...properties,
      };
      const path = [target];
      if (bubbles) {
        for (let parent = target.parentElement; parent; parent = parent.parentElement) path.push(parent);
        if (target !== this) path.push(this);
      }
      for (const node of path) {
        event.currentTarget = node;
        for (const listener of node.listeners?.get(type) || []) listener(event);
        if (event.propagationStopped) break;
      }
      return event;
    },
  };
  document.body = new Element(document, 'body');
  const searchBox = new Element(document);
  searchBox.className = 'search-box';
  const input = new InputElement(document, 'input');
  input.id = 'search';
  input.setAttribute('aria-expanded', 'false');
  const popup = new Element(document);
  popup.id = 'search-popup';
  popup.hidden = true;
  const results = new Element(document);
  results.id = 'search-results';
  results.hidden = true;
  const help = new Element(document, 'p');
  help.id = 'search-help';
  const status = new Element(document, 'p');
  status.id = 'search-status';
  popup.append(help, status, results);
  searchBox.append(input, popup);
  const outside = new Element(document, 'div');
  document.body.append(searchBox, outside);
  const focusedCodes = [];
  const requests = [];
  const resolveKeywords = value => requests.at(-1).resolve(value);
  const rejectKeywords = error => requests.at(-1).reject(error);
  const state = {
    hexagrams: hexagramData, trigrams, index: coreReady ? buildHexagramIndex(hexagramData) : null,
    reading: { stage: 'none', focusedCode: '001011' },
  };
  const context = vm.createContext({
    document, state, searchInput: input, searchResultsEl: results,
    searchPopupEl: popup, searchHelpEl: help, searchStatusEl: status,
    searchResults: [], searchIndex: -1, searchHexagrams, moveSelection, parseHexagramQuery,
    HTMLInputElement: InputElement, HTMLTextAreaElement: TextAreaElement,
    focusHexagram(code) { focusedCodes.push(code); },
    dataLoader: {
      loadHexagramKeywords() {
        return new Promise((resolve, reject) => requests.push({ resolve, reject }));
      },
    },
    window: { requestAnimationFrame: callback => callback() },
    console,
  });
  vm.runInContext(searchSource, context);
  const fire = (target, type, properties) => document.dispatch(target, type, properties);
  const key = (value, properties = {}) => fire(input, 'keydown', { key: value, ...properties });
  const query = value => {
    input.focus();
    input.value = value;
    fire(input, 'input');
  };
  const options = () => results.querySelectorAll('.search-option');
  const codes = () => options().map(option => option.querySelector('code')?.textContent);
  return {
    document, input, popup, results, help, status, searchBox, outside, state,
    requests, resolveKeywords, rejectKeywords, focusedCodes, fire, key, query, options, codes,
  };
}

const flushPromises = () => new Promise(resolve => setImmediate(resolve));

test('搜索查询更换清除旧 aria-activedescendant 与选项选择状态', () => {
  const app = createHarness();
  app.query('乾');
  app.key('ArrowDown');
  assert.ok(app.input.getAttribute('aria-activedescendant'));
  app.query('坤');
  assert.equal(app.input.getAttribute('aria-activedescendant'), null);
  assert.ok(app.options().length > 0);
  assert.ok(app.options().every(option => option.getAttribute('aria-selected') === 'false'));
});

test('搜索关闭后 Enter 不确认旧结果，方向键不操作隐藏选项', () => {
  const app = createHarness();
  app.query('乾');
  app.key('ArrowDown');
  app.key('Escape');
  assert.equal(app.input.getAttribute('aria-expanded'), 'false');
  const enter = app.key('Enter');
  assert.deepEqual(app.focusedCodes, []);
  assert.equal(enter.defaultPrevented, false);
  const down = app.key('ArrowDown');
  assert.equal(down.defaultPrevented, false);
  assert.equal(app.input.getAttribute('aria-activedescendant'), null);
});

for (const key of ['Enter', 'Escape']) {
  test(`输入法组合期间 ${key} 保留原生输入，不触发搜索动作`, () => {
    for (const properties of [{ isComposing: true }, { keyCode: 229 }, {}]) {
      const app = createHarness();
      app.query('乾');
      app.fire(app.input, 'compositionstart');
      const beforeExpanded = app.input.getAttribute('aria-expanded');
      const event = app.key(key, properties);
      assert.equal(event.defaultPrevented, false);
      assert.deepEqual(app.focusedCodes, []);
      assert.equal(app.input.getAttribute('aria-expanded'), beforeExpanded);
    }
  });
}

test('展开搜索的 Escape 只关建议，第二次 Escape 可冒泡给阅读返回', () => {
  const app = createHarness();
  app.query('乾');
  let bubbled = 0;
  app.document.addEventListener('keydown', event => {
    if (event.key === 'Escape') bubbled += 1;
  });
  const first = app.key('Escape');
  assert.equal(first.defaultPrevented, true);
  assert.equal(first.propagationStopped, true);
  assert.equal(bubbled, 0);
  const second = app.key('Escape');
  assert.equal(second.propagationStopped, false);
  assert.equal(bubbled, 1);
  assert.deepEqual(app.focusedCodes, []);
});

test('核心索引未就绪只显示局部不可用，不确认看似可用的卦', () => {
  const app = createHarness({ coreReady: false });
  assert.doesNotThrow(() => app.query('乾'));
  assert.equal(app.options().length, 0);
  assert.match(app.status.textContent, /未就绪|不可用|未完成|未加载/);
  app.key('Enter');
  assert.deepEqual(app.focusedCodes, []);
});

test('可选关键词迟到不会重新打开已取消的搜索建议', async () => {
  const app = createHarness();
  app.query('只在关键词中的测试词');
  assert.ok(app.requests.length > 0, '真实绑定发起可选关键词加载');
  app.key('Escape');
  app.resolveKeywords({ '111111': [{ text: '只在关键词中的测试词', level: 1 }] });
  await flushPromises();
  assert.equal(app.input.getAttribute('aria-expanded'), 'false');
  assert.equal(app.popup.hidden, true);
  assert.deepEqual(app.focusedCodes, []);
});

test('可选关键词迟到只能更新当前查询，不能覆盖已经输入的新查询', async () => {
  const app = createHarness();
  app.query('只在关键词中的测试词');
  assert.ok(app.requests.length > 0, '真实绑定发起可选关键词加载');
  app.query('坤');
  const keywords = { '111111': [{ text: '只在关键词中的测试词', level: 1 }] };
  app.resolveKeywords(keywords);
  await flushPromises();
  assert.equal(app.input.value, '坤');
  assert.deepEqual(app.codes(), searchHexagrams(hexagrams, '坤', { trigrams, keywords }).slice(0, 8).map(hex => hex.binaryCode));
  assert.equal(app.input.getAttribute('aria-expanded'), 'true');
  assert.deepEqual(app.focusedCodes, []);
});

test('点击外侧非聚焦区域也关闭建议，不改变当前聚焦卦', () => {
  const app = createHarness();
  app.query('乾');
  assert.equal(app.document.activeElement, app.input);
  app.fire(app.outside, 'pointerdown');
  assert.equal(app.input.getAttribute('aria-expanded'), 'false');
  assert.deepEqual(app.focusedCodes, []);
});

test('搜索快捷键不穿透 inert 背景或输入法组合', () => {
  for (const mode of ['inert', 'composing']) {
    const app = createHarness();
    if (mode === 'inert') app.searchBox.inert = true;
    const before = app.input.focusAttempts;
    const event = app.fire(app.outside, 'keydown', { key: 'k', ctrlKey: true, isComposing: mode === 'composing' });
    assert.equal(app.input.focusAttempts, before, mode);
    assert.equal(event.defaultPrevented, false, mode);
    assert.equal(app.input.selectCalls, 0, mode);
  }
});

test('正常键盘和结果按钮确认只提交一次聚焦，不调用阅读入口', () => {
  for (const keyboard of [true, false]) {
    const app = createHarness();
    app.query('乾');
    if (keyboard) {
      app.key('ArrowDown');
      app.key('Enter');
    } else {
      const option = app.options()[0];
      app.fire(option, 'pointerdown');
      app.fire(option, 'mousedown');
      app.fire(option, 'click');
    }
    assert.deepEqual(app.focusedCodes, ['111111']);
    assert.equal(app.input.getAttribute('aria-expanded'), 'false');
    assert.equal(app.input.getAttribute('aria-activedescendant'), null);
  }
});

test('组合结束后按最终文本检索，但只有后续正常确认才聚焦', () => {
  const app = createHarness();
  app.query('乾');
  app.key('ArrowDown');
  app.fire(app.input, 'compositionstart');
  app.input.value = '坤';
  app.fire(app.input, 'input', { isComposing: true });
  assert.equal(app.input.getAttribute('aria-expanded'), 'false');
  assert.equal(app.input.getAttribute('aria-activedescendant'), null);
  app.fire(app.input, 'compositionend');
  assert.equal(app.input.getAttribute('aria-expanded'), 'true');
  assert.equal(app.codes()[0], '000000');
  assert.equal(app.input.getAttribute('aria-activedescendant'), null);
  assert.deepEqual(app.focusedCodes, []);
  for (const properties of [{ isComposing: true }, { keyCode: 229 }]) {
    assert.equal(app.key('Enter', properties).defaultPrevented, false);
    assert.deepEqual(app.focusedCodes, []);
  }
  app.key('Enter');
  assert.deepEqual(app.focusedCodes, ['000000']);
});

test('输入框已经失焦时组合结束不重新打开建议', () => {
  const app = createHarness();
  app.query('乾');
  app.fire(app.input, 'compositionstart');
  app.input.value = '坤';
  app.outside.focus();
  app.fire(app.searchBox, 'focusout', { relatedTarget: app.outside });
  app.fire(app.input, 'compositionend');
  assert.equal(app.input.getAttribute('aria-expanded'), 'false');
  assert.equal(app.popup.hidden, true);
  assert.deepEqual(app.focusedCodes, []);
});

test('关键词失败保留核心搜索，重新聚焦可重试且成功后移除降级提示', async () => {
  const app = createHarness();
  app.query('乾');
  assert.equal(app.requests.length, 1);
  app.rejectKeywords(new Error('optional keywords offline'));
  await flushPromises();
  assert.equal(app.codes()[0], '111111');
  assert.match(app.status.textContent, /关键词暂不可用/);
  app.query('上坤下乾');
  assert.deepEqual(app.codes(), ['111000']);
  assert.equal(app.requests.length, 1, '输入新查询不循环发起失败请求');
  app.key('Enter');
  assert.deepEqual(app.focusedCodes, ['111000'], '可选资料失败不阻断核心结果确认');

  app.outside.focus();
  app.input.focus();
  assert.equal(app.requests.length, 2, '真实重新聚焦开始第二次可选请求');
  app.query('只在关键词中的重试词');
  assert.deepEqual(app.codes(), []);
  app.resolveKeywords({ '111111': [{ text: '只在关键词中的重试词', level: 1 }] });
  await flushPromises();
  assert.deepEqual(app.codes(), ['111111']);
  assert.doesNotMatch(app.status.textContent, /暂不可用/);
  assert.deepEqual(app.focusedCodes, ['111000'], '重试成功只更新建议，不自动选择');
});

test('关键词迟到改变排序后仍按卦码保留键盘选项', async () => {
  const keyword = '键盘选项保持测试词';
  const fixture = hexagrams.filter(hex => [1, 2, 11].includes(hex.number)).map(hex => ({
    ...hex, judgement: hex.number === 1 ? hex.judgement : keyword,
  }));
  const app = createHarness({ hexagramData: fixture });
  app.query(keyword);
  assert.deepEqual(app.codes(), ['000000', '111000']);
  app.key('ArrowDown');
  app.key('ArrowDown');
  const previousActive = app.input.getAttribute('aria-activedescendant');
  app.resolveKeywords({ '111111': [{ text: keyword, level: 1 }] });
  await flushPromises();
  assert.deepEqual(app.codes(), ['111111', '000000', '111000']);
  const selected = app.options().filter(option => option.getAttribute('aria-selected') === 'true');
  assert.equal(selected.length, 1);
  assert.equal(selected[0].querySelector('code').textContent, '111000');
  assert.equal(app.input.getAttribute('aria-activedescendant'), selected[0].id);
  assert.notEqual(app.input.getAttribute('aria-activedescendant'), previousActive, '索引变化时更新活跃选项 ID');
  assert.deepEqual(app.focusedCodes, []);
  app.key('Enter');
  assert.deepEqual(app.focusedCodes, ['111000']);
});

test('入口搜索实际接入序号、六位编码和上下卦结构查询', () => {
  for (const [query, expectedCode] of [
    ['1', '111111'], ['64', '010101'], ['第64卦', '010101'],
    ['000001', '000001'], ['111111', '111111'],
    ['上坤下乾', '111000'], ['下乾上坤', '111000'],
    ['上乾下坤', '000111'], ['上巽下艮', '001011'],
  ]) {
    const app = createHarness();
    app.query(query);
    assert.deepEqual(app.codes(), [expectedCode], query);
    assert.equal(app.options()[0].getAttribute('role'), 'option');
    assert.equal(app.options()[0].tabIndex, -1);
    assert.deepEqual(app.focusedCodes, [], query);
    app.key('Enter');
    assert.deepEqual(app.focusedCodes, [expectedCode], query);
    assert.deepEqual(app.state.reading, { stage: 'none', focusedCode: '001011' }, '搜索绑定不改正式阅读状态');
  }
});

test('非法结构查询清除旧结果并明确提示，空查询关闭建议', () => {
  const app = createHarness();
  for (const query of ['0', '65', '01', '1111111', '第0卦']) {
    app.query('乾');
    app.key('ArrowDown');
    app.query(query);
    assert.deepEqual(app.codes(), [], query);
    assert.equal(app.input.getAttribute('aria-activedescendant'), null, query);
    assert.match(app.status.textContent, /卦序为1—64，卦码须为六位0或1/, query);
    app.key('Enter');
    assert.deepEqual(app.focusedCodes, [], query);
  }
  app.query('   ');
  assert.equal(app.input.getAttribute('aria-expanded'), 'false');
  assert.equal(app.popup.hidden, true);
  assert.equal(app.results.hidden, true);
  assert.equal(app.status.textContent, '');
});
