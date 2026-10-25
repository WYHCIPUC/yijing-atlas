import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { getAchievementStorageKey, loadAchievementState } from '../js/achievement-storage.js';
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
    this.children.forEach((child) => { child.parentElement = null; });
    this.html = value;
    this.children = [...value.matchAll(/<([a-z][\w-]*)\b([^>]*)>/gi)]
      .map((match) => {
        const child = new Control(match[1], match[2]);
        child.parentElement = this;
        return child;
      });
  }

  get innerHTML() { return this.html || ''; }
  append(child) {
    if (child.parentElement) child.parentElement.children = child.parentElement.children.filter((node) => node !== child);
    child.parentElement = this;
    this.children.push(child);
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  removeAttribute(name) { this.attributes.delete(name); }
  setCustomValidity() {}
  scrollIntoView(options) { (this.scrolls ||= []).push(options); }
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
  const writes = [], blocked = new Set();
  return {
    writes, blocked,
    getItem: (key) => values.get(key) ?? null,
    setItem(key, value) {
      writes.push(key);
      if (blocked.has(key)) throw new Error('controlled quota');
      values.set(key, String(value));
    },
    removeItem: (key) => values.delete(key),
  };
}

function environment(t, { deferFrames = false } = {}) {
  const local = storage();
  const frames = [];
  t.mock.method(Date, 'now', (() => { let now = 1000; return () => ++now; })());
  for (const [name, value] of Object.entries({
    localStorage: local,
    window: { requestAnimationFrame: (callback) => deferFrames ? frames.push(callback) : callback() },
    document: { activeElement: null },
  })) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
    t.after(() => previous ? Object.defineProperty(globalThis, name, previous) : delete globalThis[name]);
  }
  const mount = new Control();
  const cleanup = renderDivinationMode(mount, state, () => {});
  return { local, mount, cleanup, flush: () => frames.splice(0).forEach(callback => callback()) };
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

function castCurrent(mount, method = 'coin', dimensions = 2) {
  if (method === 'meihua') mount.querySelector('#divine-tab-meihua').click();
  mount.querySelector(method === 'coin' ? '.coin-cast' : '.mh-cast').click();
  mount.querySelectorAll('[data-analysis-dimension]').forEach((input, index) => { input.checked = index < dimensions; });
  return mount.querySelector('.divine-analysis-submit');
}

for (const method of ['coin', 'meihua']) {
  test(`${method}解卦结果为四段勾选自评反馈，不冒称结构化检验或添加后置入口`, t => {
    const { mount } = environment(t);
    castCurrent(mount, method).click();
    const feedback = mount.querySelector('.divine-analysis-feedback');
    assert.ok(feedback, '自评后有四段反馈容器');
    const html = feedback.innerHTML;
    for (const section of ['result', 'basis', 'changes', 'actions']) assert.match(html, new RegExp(`data-feedback-section="${section}"`));
    assert.match(html, /勾选自评/);
    assert.match(html, /40/);
    assert.match(html, /不是.*(?:客观|结构)/);
    assert.match(html, /取辞|来源/);
    assert.equal((html.match(/data-feedback-action="primary"/g) || []).length, 1);
    assert.ok((html.match(/data-feedback-action="secondary"/g) || []).length <= 2);
    assert.equal(mount.querySelector('.history-open-primary'), null, '不提前新增正式研读入口');
    assert.equal(feedback.attributes.has('aria-live'), false, '不重复播报整个结果');
  });

  test(`${method}自评保存失败锁定原事件，仅保存重试且成功部分不重写`, t => {
    const { mount, local } = environment(t);
    const submit = castCurrent(mount, method);
    const historyBefore = local.getItem(getDivinationHistoryKey());
    local.writes.length = 0;
    local.blocked.add(getAchievementStorageKey());
    const originalSubmit = submit.listeners.get('click');
    submit.click(); originalSubmit({ target: submit });
    assert.deepEqual(local.writes, [getAchievementStorageKey()], '重复提交不能变成隐式重试');
    const feedback = mount.querySelector('.divine-analysis-feedback');
    assert.ok(feedback);
    assert.match(mount.querySelector('.divine-analysis-status').textContent, /未.*保存/);
    assert.deepEqual(loadAchievementState(local).metrics.analyses, {});
    const retry = feedback.querySelector('.divine-analysis-retry');
    assert.ok(retry);
    const retryHandler = retry.listeners.get('click');
    mount.querySelectorAll('[data-analysis-dimension]').forEach(input => { input.checked = true; });
    local.blocked.clear();
    retry.click(); retryHandler({ target: retry });
    assert.deepEqual(local.writes, [getAchievementStorageKey(), getAchievementStorageKey()]);
    const [analysis] = Object.values(loadAchievementState(local).metrics.analyses);
    assert.equal(analysis.totalScore, 40, '重试沿用已提交分数，不重新读取勾选');
    assert.equal(analysis.subjectId, `history:${loadDivinationHistory(local)[0].id}`);
    assert.equal(local.getItem(getDivinationHistoryKey()), historyBefore);
    assert.equal(feedback.querySelector('.divine-analysis-retry'), null);
    assert.equal(document.activeElement, feedback.querySelector('.divine-analysis-view-basis'));
  });

  test(`${method}首次失败、重试失败与恢复后原状态节点只位于学习记录段`, t => {
    const { mount, local } = environment(t);
    const submit = castCurrent(mount, method);
    const originalStatus = mount.querySelector('.divine-analysis-status');
    const key = getAchievementStorageKey();
    const assertStatus = (saved) => {
      const feedback = mount.querySelector('.divine-analysis-feedback');
      const changes = feedback.innerHTML.match(/data-feedback-section="changes"[^>]*>([\s\S]*?)<\/section>/)?.[1];
      assert.match(changes || '', /class="divine-analysis-save-state"/, '唯一状态容器必须在学习记录段');
      const slot = feedback.querySelector('.divine-analysis-save-state');
      assert.equal(slot.querySelector('.divine-analysis-status'), originalStatus, '重绘仍复用原短播报节点');
      assert.equal(originalStatus.parentElement, slot);
      assert.deepEqual(mount.querySelectorAll('.divine-analysis-status'), [originalStatus], '不得在结果顶部重复保留状态');
      assert.equal(originalStatus.attributes.get('role'), 'status');
      assert.equal(originalStatus.attributes.get('aria-live'), 'polite');
      assert.match(originalStatus.textContent, saved ? /已保存本轮/ : /未能保存/);
      assert.equal(document.activeElement, feedback.querySelector(saved ? '.divine-analysis-view-basis' : '.divine-analysis-retry'));
    };
    local.blocked.add(key);
    submit.click();
    assertStatus(false);
    local.blocked.clear();
    const originalGet = local.getItem;
    local.getItem = requested => {
      if (requested === key) throw new Error('controlled retry read denial');
      return originalGet(requested);
    };
    const writes = local.writes.length;
    mount.querySelector('.divine-analysis-retry').click();
    assert.equal(local.writes.length, writes, '重试读拒绝不尝试写入');
    assertStatus(false);
    local.getItem = originalGet;
    mount.querySelector('.divine-analysis-retry').click();
    assert.equal(local.writes.length, writes + 1);
    assertStatus(true);
    assert.equal(mount.querySelector('.divine-analysis-retry'), null);
    assert.equal(Object.values(loadAchievementState(local).metrics.analyses)[0].totalScore, 40);
  });
}

test('历史案例已有成绩时反馈说明保存的旧分，不声称本次不同自评分已入库', t => {
  const { local, mount } = environment(t);
  const item = addCoin(local);
  replay(mount, item.id, 5);
  const achievementBefore = local.getItem(getAchievementStorageKey());
  replay(mount, item.id, 1);
  const feedback = mount.querySelector('.divine-analysis-feedback');
  assert.ok(feedback);
  assert.match(feedback.innerHTML, /20/);
  assert.match(mount.querySelector('.divine-analysis-status').textContent, /此前.*100.*(?:重复|未改)/);
  assert.equal(local.getItem(getAchievementStorageKey()), achievementBefore);
  const before = local.writes.length;
  feedback.querySelector('.divine-analysis-view-basis').click();
  assert.equal(local.writes.length, before, '回看本页依据不写数据或生成新历史');
});

test('旧已处理标识缺研读明细时不补造或展示未定义分数', t => {
  const { local, mount } = environment(t);
  const item = addCoin(local);
  const previous = loadAchievementState(local);
  previous.processedKeys.push(`divination-analysis:history:${item.id}`);
  local.setItem(getAchievementStorageKey(), JSON.stringify(previous));
  const before = local.getItem(getAchievementStorageKey());
  replay(mount, item.id, 5);
  const feedback = mount.querySelector('.divine-analysis-feedback');
  assert.match(mount.querySelector('.divine-analysis-status').textContent, /旧记录未保留.*分数/);
  assert.doesNotMatch(feedback.innerHTML, /undefined|此前.*100/);
  assert.equal(local.getItem(getAchievementStorageKey()), before);
});

test('解卦保存失败及成功重试由产品滚动实际主行动再聚焦', t => {
  const { local, mount } = environment(t);
  const submit = castCurrent(mount);
  local.blocked.add(getAchievementStorageKey());
  submit.click();
  const retry = mount.querySelector('.divine-analysis-retry');
  assert.ok(retry.scrolls?.length, '不能只滚动可能高于视口的整块反馈');
  assert.equal(document.activeElement, retry);
  local.blocked.clear(); retry.click();
  const next = mount.querySelector('.divine-analysis-view-basis');
  assert.ok(next.scrolls?.length);
  assert.equal(document.activeElement, next);
});

for (const phase of ['first-submit', 'retry']) {
  for (const fault of ['read-failed', 'invalid-json', 'invalid-legacy']) {
    test(`解卦${phase}遇到${fault}不写成就，恢复后保留原事件与旧证据`, t => {
      const { local, mount } = environment(t);
      const key = getAchievementStorageKey();
      const previous = loadAchievementState(local);
      previous.metrics.hexagramsRead.push('111111');
      previous.processedKeys.push('prior:reading:111111');
      const original = JSON.stringify(previous);
      local.setItem(key, original);
      const submit = castCurrent(mount);
      const subjectId = `history:${loadDivinationHistory(local)[0].id}`;
      const originalGet = local.getItem;
      let unreadable = false;
      local.getItem = requested => {
        if (unreadable && requested === key) throw new Error('controlled read failure');
        return originalGet(requested);
      };
      const submittedAt = '2026-10-25T01:00:00.000Z';
      let clock = submittedAt;
      t.mock.method(Date.prototype, 'toISOString', () => clock);
      if (phase === 'retry') {
        local.blocked.add(key);
        submit.click();
        assert.match(mount.querySelector('.divine-analysis-status').textContent, /未能保存/);
        local.blocked.clear();
      }
      if (fault === 'read-failed') unreadable = true;
      else local.setItem(key, fault === 'invalid-json' ? '{broken-json' : JSON.stringify({ version: 0, events: [{}] }));
      const before = originalGet(key), writes = local.writes.length;
      const control = phase === 'first-submit' ? submit : mount.querySelector('.divine-analysis-retry');
      control.click();
      assert.equal(local.writes.length, writes, '读取失败或旧数据无效时不得尝试写入');
      assert.equal(originalGet(key), before, '不覆盖原始持久值');
      assert.match(mount.querySelector('.divine-analysis-status').textContent, /未能保存/);
      const retry = mount.querySelector('.divine-analysis-retry');
      assert.ok(retry, '失败保留可达重试');
      assert.equal(document.activeElement, retry);
      unreadable = false;
      if (fault !== 'read-failed') local.setItem(key, original);
      clock = '2026-10-27T03:00:00.000Z';
      mount.querySelectorAll('[data-analysis-dimension]').forEach(input => { input.checked = true; });
      const retryWrites = local.writes.length;
      retry.click();
      assert.equal(local.writes.length, retryWrites + 1);
      const saved = loadAchievementState(local);
      assert.deepEqual(saved.metrics.hexagramsRead, ['111111']);
      assert.ok(saved.processedKeys.includes('prior:reading:111111'));
      assert.equal(saved.metrics.analyses[subjectId].totalScore, 40);
      assert.equal(saved.metrics.analyses[subjectId].occurredAt, submittedAt);
      assert.equal(saved.processedKeys.filter(value => value === `divination-analysis:${subjectId}`).length, 1);
      assert.equal(mount.querySelector('.divine-analysis-retry'), null);
      const successfulWrites = local.writes.length;
      retry.listeners.get('click')({ target: retry });
      submit.listeners.get('click')({ target: submit });
      assert.equal(local.writes.length, successfulWrites, '保存成功后旧控件不重复写入');
    });
  }
}

test('解卦严格读取仍兼容有效V0成就事件，并只使用一次校验过的原始快照', t => {
  const { local, mount } = environment(t);
  const key = getAchievementStorageKey();
  local.setItem(key, JSON.stringify({ version: 0, events: [{
    type: 'hexagram.read', subjectId: '111111', outcome: 'completed',
    occurredAt: '2026-10-24T01:00:00.000Z', idempotencyKey: 'legacy:reading:111111', metadata: { deep: true },
  }] }));
  const submit = castCurrent(mount);
  const originalGet = local.getItem;
  let reads = 0;
  local.getItem = requested => {
    if (requested === key && ++reads > 1) throw new Error('later read failure');
    return originalGet(requested);
  };
  submit.click();
  assert.equal(reads, 1, '持久层原始值只读取一次，后续迁移使用已校验快照');
  const saved = JSON.parse(originalGet(key));
  assert.deepEqual(saved.metrics.hexagramsRead, ['111111']);
  assert.ok(saved.processedKeys.includes('legacy:reading:111111'));
  assert.equal(Object.keys(saved.metrics.analyses).length, 1);
  assert.equal(mount.querySelector('.divine-analysis-retry'), null);
});

for (const exit of ['cleanup', 'tab', 'recast', 'history', 'rerender']) {
  test(`${exit}后旧解卦提交和重试不写入当前状态`, t => {
    const { local, mount, cleanup } = environment(t);
    const submit = castCurrent(mount);
    local.blocked.add(getAchievementStorageKey());
    submit.click();
    const retry = mount.querySelector('.divine-analysis-retry');
    assert.ok(retry);
    const oldSubmit = submit.listeners.get('click'), oldRetry = retry.listeners.get('click');
    if (exit === 'cleanup') { assert.equal(typeof cleanup, 'function'); cleanup(); cleanup(); }
    if (exit === 'tab') mount.querySelector('#divine-tab-meihua').click();
    if (exit === 'recast') mount.querySelector('.divine-again').click();
    if (exit === 'history') mount.querySelector('.history-item').click();
    if (exit === 'rerender') renderDivinationMode(mount, state, () => {});
    local.blocked.clear();
    const writes = local.writes.length, history = local.getItem(getDivinationHistoryKey());
    oldSubmit({ target: submit }); oldRetry({ target: retry });
    assert.equal(local.writes.length, writes);
    assert.equal(local.getItem(getDivinationHistoryKey()), history);
    assert.deepEqual(loadAchievementState(local).metrics.analyses, {});
  });
}

for (const exit of ['tab', 'recast', 'history', 'rerender']) {
  test(`${exit}后尚未提交的旧勾选控件不能补写旧案例`, t => {
    const { local, mount } = environment(t);
    const submit = castCurrent(mount);
    if (exit === 'tab') mount.querySelector('#divine-tab-meihua').click();
    if (exit === 'recast') mount.querySelector('.divine-again').click();
    if (exit === 'history') mount.querySelector('.history-item').click();
    if (exit === 'rerender') renderDivinationMode(mount, state, () => {});
    const writes = local.writes.length;
    submit.listeners.get('click')({ target: submit });
    assert.equal(local.writes.length, writes, '离开当前结果后不能由旧处理器写成就');
    assert.deepEqual(loadAchievementState(local).metrics.analyses, {});
  });
}

test('离页或换方式后旧起卦控件和排队RAF不写数据或抢焦点', t => {
  for (const exit of ['cleanup', 'tab', 'rerender']) {
    const { local, mount, cleanup, flush } = environment(t, { deferFrames: true });
    const cast = mount.querySelector('.coin-cast');
    cast.click();
    const again = mount.querySelector('.divine-again');
    if (exit === 'cleanup') { assert.equal(typeof cleanup, 'function'); cleanup(); }
    if (exit === 'tab') mount.querySelector('#divine-tab-meihua').click();
    if (exit === 'rerender') renderDivinationMode(mount, state, () => {});
    const writes = local.writes.length;
    const focus = { label: 'current control' }; document.activeElement = focus;
    cast.listeners.get('click')({ target: cast });
    again.listeners.get('click')({ target: again });
    flush();
    assert.equal(local.writes.length, writes);
    assert.equal(document.activeElement, focus);
  }
});
