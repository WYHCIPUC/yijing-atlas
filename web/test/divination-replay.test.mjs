import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { loadAchievementState } from '../js/achievement-storage.js';
import { addDivinationHistory, getDivinationHistoryKey, getLegacyDivinationHistoryKey, loadDivinationHistory } from '../js/divination-history.js';
import { castByNumber } from '../js/meihua-engine.js';
import { renderDivinationMode } from '../js/modes/divination-mode.js';
import { exportUserData, importUserData, parseUserData } from '../js/user-data.js';

const hexagrams = JSON.parse(readFileSync(new URL('../data/hexagrams.json', import.meta.url), 'utf8'));
const state = { index: { byCode: new Map(hexagrams.map((hexagram) => [hexagram.binaryCode, hexagram])) } };

// This fixture retains rendered controls and their real event listeners. It does
// not implement browser layout, focus navigation, or the HTML rendering engine.
class Control {
  constructor(tag = 'div', attributes = '') {
    this.tag = tag;
    this.attributes = new Map([...attributes.matchAll(/([\w-]+)(?:="([^"]*)")?/g)]
      .map((match) => [match[1], match[2] ?? '']));
    this.dataset = Object.fromEntries([...this.attributes].filter(([name]) => name.startsWith('data-'))
      .map(([name, value]) => [name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()), value]));
    this.id = this.attributes.get('id');
    this.value = this.attributes.get('value') || '';
    this.checked = false;
    this.children = [];
    this.listeners = new Map();
    this.classList = { toggle() {} };
  }

  set innerHTML(value) {
    this.html = value;
    this.children = [...value.matchAll(/<([a-z][\w-]*)\b([^>]*)>/gi)]
      .map((match) => new Control(match[1], match[2]));
  }

  get innerHTML() { return this.html || ''; }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  removeAttribute(name) { this.attributes.delete(name); }
  setCustomValidity() {}
  focus() { globalThis.document.activeElement = this; }
  addEventListener(type, callback) { this.listeners.set(type, callback); }
  click() { if (!this.disabled) this.listeners.get('click')?.({ target: this }); }

  querySelectorAll(selector) {
    const simple = selector.split(' ').at(-1);
    const matches = (node) => simple.startsWith('.')
      ? (node.attributes.get('class') || '').split(/\s+/).includes(simple.slice(1))
      : simple.startsWith('#') ? node.id === simple.slice(1)
        : simple.startsWith('[') ? node.attributes.has(simple.slice(1, -1)) : node.tag === simple;
    return this.children.flatMap((child) => [child, ...child.querySelectorAll('*')])
      .filter((child) => selector === '*' || matches(child));
  }

  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
}

function storage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

function environment(t) {
  const local = storage();
  t.mock.method(Date, 'now', (() => { let now = 1000; return () => ++now; })());
  for (const [name, value] of Object.entries({
    localStorage: local,
    window: { requestAnimationFrame: (callback) => callback() },
    document: { activeElement: null },
  })) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
    t.after(() => previous ? Object.defineProperty(globalThis, name, previous) : delete globalThis[name]);
  }
  const mount = new Control();
  renderDivinationMode(mount, state, () => {});
  return { local, mount };
}

function addCoin(local) {
  return addDivinationHistory({
    type: 'coin', primaryCode: '111111', changedCode: null,
    yaos: Array.from({ length: 6 }, () => ({
      isYang: true, changing: false, name: '少阳', coins: [3, 2, 2],
    })),
    readingPolicyId: 'zhu-xi-qimeng-v1',
  }, local, new Date('2026-10-24T01:00:00Z')).items[0];
}

function replay(mount, id, dimensions = 5) {
  renderDivinationMode(mount, state, () => {});
  const button = mount.querySelectorAll('.history-item').find((item) => item.dataset.historyId === id);
  assert.ok(button, '历史列表包含该案例');
  button.click();
  mount.querySelectorAll('[data-analysis-dimension]').forEach((input, index) => { input.checked = index < dimensions; });
  mount.querySelector('.divine-analysis-submit')?.click();
}

test('金钱V2同一历史重放重复提交沿用同一subject，导出导入后仍幂等', (t) => {
  const { local, mount } = environment(t);
  const item = addCoin(local);
  replay(mount, item.id);
  const first = Object.keys(loadAchievementState(local).metrics.analyses);
  replay(mount, item.id, 3);
  assert.deepEqual(Object.keys(loadAchievementState(local).metrics.analyses), first,
    '重放时间变化不能产生新的分析subject');
  assert.deepEqual(first, [`history:${item.id}`]);
  assert.equal(loadAchievementState(local).metrics.analyses[first[0]].totalScore, 100);
  assert.equal(loadDivinationHistory(local).length, 1);
  const restored = storage();
  importUserData(parseUserData(JSON.stringify(exportUserData(local))), restored);
  globalThis.localStorage = restored;
  replay(mount, item.id);
  assert.deepEqual(Object.keys(loadAchievementState(restored).metrics.analyses), first);
  assert.equal(loadDivinationHistory(restored).length, 1);
  assert.deepEqual(loadDivinationHistory(restored)[0].privacy, { questionStored: false, noteStored: false });
});

test('梅花完整历史重放保持既有稳定subject且不新增历史', (t) => {
  const { local, mount } = environment(t);
  const cast = castByNumber(1, 2);
  const item = addDivinationHistory({ type: 'meihua', primaryCode: cast.primaryCode, changedCode: cast.changedCode, cast }, local).items[0];
  replay(mount, item.id);
  replay(mount, item.id);
  assert.deepEqual(Object.keys(loadAchievementState(local).metrics.analyses), [`history:${item.id}`]);
  assert.equal(loadDivinationHistory(local).length, 1);
});

test('旧摘要不生成分析证据或补造六爻；仅保留研读入口', (t) => {
  const { local, mount } = environment(t);
  local.setItem(getLegacyDivinationHistoryKey(), JSON.stringify([{
    id: 'old-summary', createdAt: '2026-01-01T00:00:00Z', type: 'coin',
    primaryCode: '111111', changedCode: '000000', summary: '乾 → 坤',
  }]));
  replay(mount, 'old-summary');
  assert.ok(mount.querySelector('.history-open-primary'));
  assert.equal(mount.querySelector('.divine-analysis-submit'), null);
  assert.deepEqual(loadAchievementState(local).metrics.analyses, {});
  const [item] = loadDivinationHistory(local);
  assert.equal(item.legacySummaryOnly, true);
  assert.equal(item.yaos, undefined);
  assert.equal(item.interpretation, undefined);
});

test('主动新掷相同卦码仍产生独立案例并保留正常自动历史', (t) => {
  const { local, mount } = environment(t);
  t.mock.method(Math, 'random', () => 0.6);
  const cast = () => {
    mount.querySelector('.coin-cast').click();
    mount.querySelectorAll('[data-analysis-dimension]').forEach((input) => { input.checked = true; });
    mount.querySelector('.divine-analysis-submit').click();
  };
  cast();
  const first = Object.keys(loadAchievementState(local).metrics.analyses);
  cast();
  const ids = Object.keys(loadAchievementState(local).metrics.analyses);
  assert.equal(first.length, 1);
  assert.equal(ids.length, 2);
  const items = loadDivinationHistory(local);
  assert.equal(items.length, 2);
  assert.equal(items[0].primaryCode, items[1].primaryCode);
});

for (const method of ['coin', 'meihua']) {
  test(`${method}首次结果与首次历史回看提交属于同一案例`, (t) => {
    const { local, mount } = environment(t);
    if (method === 'meihua') mount.querySelector('#divine-tab-meihua').click();
    mount.querySelector(method === 'coin' ? '.coin-cast' : '.mh-cast').click();
    mount.querySelectorAll('[data-analysis-dimension]').forEach((input) => { input.checked = true; });
    mount.querySelector('.divine-analysis-submit').click();
    const [item] = loadDivinationHistory(local);
    const first = Object.keys(loadAchievementState(local).metrics.analyses);
    replay(mount, item.id);
    assert.deepEqual(Object.keys(loadAchievementState(local).metrics.analyses), first);
    assert.deepEqual(first, [`history:${item.id}`]);
    assert.equal(loadDivinationHistory(local).length, 1);
  });

  test(`${method}历史保存失败时本次分析身份稳定，下一次起卦仍独立`, (t) => {
    const { local, mount } = environment(t);
    t.mock.method(Date, 'now', () => 1000);
    const setItem = local.setItem;
    t.mock.method(local, 'setItem', (key, value) => {
      if (key === getDivinationHistoryKey()) throw new Error('history quota');
      setItem(key, value);
    });
    const cast = () => {
      if (method === 'meihua') mount.querySelector('#divine-tab-meihua').click();
      mount.querySelector(method === 'coin' ? '.coin-cast' : '.mh-cast').click();
      mount.querySelectorAll('[data-analysis-dimension]').forEach((input) => { input.checked = true; });
      const submit = mount.querySelector('.divine-analysis-submit');
      submit.click();
      const before = Object.keys(loadAchievementState(local).metrics.analyses);
      // Native disabled buttons prevent a second submit; a retry of the bound
      // handler must also remain idempotent and must not cast or write history.
      submit.listeners.get('click')({ target: submit });
      assert.deepEqual(Object.keys(loadAchievementState(local).metrics.analyses), before);
    };
    t.mock.method(Math, 'random', () => 0.6);
    cast();
    assert.equal(Object.keys(loadAchievementState(local).metrics.analyses).length, 1);
    cast();
    assert.equal(Object.keys(loadAchievementState(local).metrics.analyses).length, 2,
      '同一毫秒内两次新起卦的临时案例身份不能相同');
    assert.equal(loadDivinationHistory(local).length, 0);
    assert.match(mount.querySelector('.history-status').textContent, /未能保存记录/);
  });
}
