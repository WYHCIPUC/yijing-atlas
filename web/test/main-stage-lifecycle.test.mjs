import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { createReadingState, shouldRecordDeepRead, transitionReading } from '../js/reading-state.js';

const source = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
// Execute the real entry-point functions without starting the application or WebGL.
const functions = ['pauseCelestialStage', 'resumeCelestialStage', 'closeDetail', 'enterExplore', 'focusHexagram', 'changeStarLayout', 'openReading', 'openDetail']
  .map((name) => {
    const match = source.match(new RegExp(`^function ${name}\\([\\s\\S]*?^}`, 'm'));
    assert.ok(match, `${name} must be present`);
    return match[0];
  }).join('\n');
const syncStarStageSource = (() => {
  const match = source.match(/^function syncStarStage\([\s\S]*?^}/m);
  assert.ok(match, 'syncStarStage must be present');
  return match[0];
})();

function runReadingScroll({ panelTop, toolbarBottom, toolbarHeight, previousBottom, selectedSection, margin = '140px' }) {
  const start = source.indexOf('  let readingSectionFrame = null;');
  const end = source.indexOf("  canvas.addEventListener('pointerdown'", start);
  assert.ok(start >= 0 && end > start, '真实阅读滚动监听必须存在');
  const frames = [];
  let scroll;
  let tabSyncs = 0;
  const state = { reading: { ...createReadingState(), stage: 'quick', section: selectedSection } };
  const elements = [
    { dataset: { readingSection: selectedSection === 'lines' ? 'commentary' : 'judgement' },
      getBoundingClientRect: () => ({ bottom: previousBottom }) },
    { dataset: { readingSection: selectedSection },
      getBoundingClientRect: () => ({ top: previousBottom, bottom: previousBottom + 400 }) },
  ];
  const context = vm.createContext({
    state,
    transitionReading,
    panel: {
      clientTop: 1,
      getBoundingClientRect: () => ({ top: panelTop }),
      addEventListener: (type, handler) => { assert.equal(type, 'scroll'); scroll = handler; },
    },
    readingToolbar: { getBoundingClientRect: () => ({ bottom: toolbarBottom, height: toolbarHeight }) },
    panelContent: { querySelectorAll: () => elements },
    window: {
      getComputedStyle: () => ({ scrollMarginTop: margin }),
      requestAnimationFrame: (callback) => { frames.push(callback); return frames.length; },
    },
    syncReadingTabs: () => { tabSyncs += 1; },
  });
  vm.runInContext(source.slice(start, end), context);
  scroll();
  scroll();
  assert.equal(frames.length, 1, '同一帧合并滚动检查');
  frames.shift()();
  return { state, tabSyncs };
}

test('真实滚动监听不因边框与亚像素舍入把已定位章节退回上一节', () => {
  const fixtures = [
    { panelTop: 388.8125, toolbarBottom: 498.8125, toolbarHeight: 109, previousBottom: 530.203125, selectedSection: 'lines' },
    { panelTop: 455.765625, toolbarBottom: 565.765625, toolbarHeight: 109, previousBottom: 597.03125, selectedSection: 'commentary' },
    { panelTop: 211, toolbarBottom: 321, toolbarHeight: 109, previousBottom: 352.296875, selectedSection: 'commentary' },
    { panelTop: 211, toolbarBottom: 317, toolbarHeight: 105, previousBottom: 352.046875, selectedSection: 'lines' },
    { panelTop: 211, toolbarBottom: 317, toolbarHeight: 105, previousBottom: 351.734375, selectedSection: 'lines' },
  ];
  for (const fixture of fixtures) {
    const { state, tabSyncs } = runReadingScroll(fixture);
    assert.equal(state.reading.section, fixture.selectedSection, JSON.stringify(fixture));
    assert.equal(tabSyncs, 0, '已正确定位不反复改写页签');
  }
});

test('用户滚回上一节正文时仍按可见内容更新当前章节', () => {
  const { state, tabSyncs } = runReadingScroll({
    panelTop: 211, toolbarBottom: 317, toolbarHeight: 105, previousBottom: 380, selectedSection: 'lines',
  });
  assert.equal(state.reading.section, 'commentary');
  assert.equal(tabSyncs, 1);
});

function createHarness({ loaded = true, extraReason = null } = {}) {
  const noop = () => {};
  const reasons = new Set(['mode', ...(extraReason ? [extraReason] : [])]);
  const stage = {
    mode: 'learning',
    pauseReasons: new Set(reasons),
    setMode(mode) { this.mode = mode; },
    pause(reason) { this.pauseReasons.add(reason); },
    resume(reason) { this.pauseReasons.delete(reason); },
  };
  const hexagram = { binaryCode: '111111', name: '乾' };
  const state = {
    currentMode: 'learning',
    currentDetail: null,
    reading: createReadingState(),
    renderedCode: null,
    readingSnapshot: null,
    readingDrafts: new Map(),
    celestialPauseReasons: reasons,
    celestialStage: loaded ? stage : null,
    starMap: null,
    hexagrams: [hexagram],
    index: { byCode: new Map([[hexagram.binaryCode, hexagram]]) },
  };
  let renderCount = 0;
  let readCount = 0;
  let reviewCount = 0;
  let hasContent = false;
  const focusCalls = [];
  const body = { classList: { remove: noop }, isConnected: true, getClientRects: () => [{}], focus: () => focusCalls.push('body') };
  const context = vm.createContext({
    state,
    modeRequestId: 0,
    readingScroll: { panel: 0, content: 0 },
    panel: { scrollTop: 0, classList: { remove: noop, contains: () => false }, setAttribute: noop, removeAttribute: noop },
    panelContent: { scrollTop: 0, querySelector: () => hasContent ? {} : null },
    document: { body, getElementById: () => ({ focus: () => focusCalls.push('read') }) },
    panelReturnFocus: body,
    focusSummary: { hidden: false },
    canvas: { focus: () => focusCalls.push('canvas') },
    window: { requestAnimationFrame: noop },
    cinematicMotion: { beginMode: noop, enterSurface: noop },
    motionSystem: { reveal: noop },
    syncStarStage: noop,
    updateDetailUrl: noop,
    setFocusMode: noop,
    updateModeButtons: noop,
    updateExploreTools: noop,
    updateLayoutInterface: noop,
    updateRelationInterface: noop,
    renderHexagramDetail: () => { renderCount += 1; hasContent = true; },
    processAchievementEvent: () => { readCount += 1; },
    createProgressEvent: (event) => event,
    bindShareAction: noop,
    addReviewCard: () => { reviewCount += 1; },
    openPanel: noop,
    resetPanelViewport: noop,
    playHexagramSound: noop,
    installUIIcons: noop,
    rememberReadingDraft: noop,
    setRelationOptions: noop,
    syncReadingPresentation: noop,
    syncReadingModality: noop,
    syncReservedRects: noop,
    syncFocusSummary: noop,
    transitionReading,
    createReadingState,
    shouldRecordDeepRead,
  });
  vm.runInContext(functions, context);
  return { context, state, stage, focusCalls, counts: () => ({ renderCount, readCount, reviewCount }) };
}

test('关闭工作台回到探索时恢复天象舞台及其场景', () => {
  const { context, state, stage } = createHarness();
  context.closeDetail();
  assert.equal(state.currentMode, 'explore');
  assert.equal(stage.mode, 'explore');
  assert.equal(state.celestialPauseReasons.size, 0);
  assert.equal(stage.pauseReasons.size, 0);
});

test('工作台搜索只聚焦并恢复天象舞台', () => {
  const { context, state, stage } = createHarness();
  context.focusHexagram('111111');
  assert.equal(state.currentMode, 'explore');
  assert.equal(state.currentDetail, null);
  assert.equal(state.reading.focusedCode, '111111');
  assert.equal(stage.mode, 'explore');
  assert.equal(state.celestialPauseReasons.size, 0);
  assert.equal(stage.pauseReasons.size, 0);
});

test('快读与深读复用正文草稿，只有深读触发正式阅读和复习', () => {
  const { context, state, counts } = createHarness();
  context.focusHexagram('111111');
  context.openReading('111111', 'quick');
  assert.deepEqual(counts(), { renderCount: 1, readCount: 0, reviewCount: 0 });
  context.openDetail('111111');
  context.openDetail('111111');
  assert.deepEqual(counts(), { renderCount: 1, readCount: 1, reviewCount: 1 });
  context.openReading('111111', 'quick');
  assert.equal(state.reading.stage, 'quick');
  assert.deepEqual(counts(), { renderCount: 1, readCount: 1, reviewCount: 1 });
});

test('切换图式同步退出快读和聚焦，不保留失效摘要', () => {
  const { context, state } = createHarness();
  let activeCode = null;
  let layout = 'project';
  state.starMap = {
    captureView: () => ({ activeCode }),
    restoreView: (snapshot) => { activeCode = snapshot.activeCode; },
    focusStar(code) { activeCode = code; },
    setLayoutMode(mode) { activeCode = null; layout = mode; return {}; },
    getRelationState: () => ({}),
    resize() {}, setReviewDue() {}, setMode() {},
  };
  context.focusHexagram('111111');
  context.openReading('111111', 'quick');
  context.changeStarLayout('king-wen');
  assert.equal(layout, 'king-wen');
  assert.equal(activeCode, null);
  assert.equal(state.reading.focusedCode, null);
  assert.equal(state.currentDetail, null);
  assert.equal(state.reading.stage, 'none');
});

test('退出阅读恢复复制的星图快照且不修改旧布局偏好', () => {
  const { context, state } = createHarness();
  const original = { view: { scale: 1.7 }, relationFilter: { type: 'changing', position: 4 } };
  let restored = null;
  state.starMap = {
    captureView: () => structuredClone(original),
    restoreView: (snapshot) => { restored = snapshot; },
    resize() {}, setReviewDue() {}, setMode() {}, focusStar() {},
  };
  context.openDetail('111111');
  original.view.scale = 8;
  context.closeDetail();
  assert.equal(restored.view.scale, 1.7);
  assert.equal(restored.relationFilter.position, 4);
  assert.equal(state.reading.focusedCode, '111111');
  assert.equal(state.readingSnapshot, null);
});

test('桌面快读期间的新镜头与关系在关闭时保留', () => {
  const { context, state } = createHarness();
  let scale = 1.7;
  let restored = null;
  state.starMap = {
    captureView: () => ({ view: { scale } }),
    restoreView: (snapshot) => { restored = snapshot; },
    resize() {}, setReviewDue() {}, setMode() {}, focusStar() {},
  };
  context.openReading('111111', 'quick');
  scale = 2.1;
  context.closeDetail();
  assert.equal(restored.view.scale, 2.1);
});

test('快读调整后深入研读，退出恢复深入前的镜头', () => {
  const { context, state } = createHarness();
  let scale = 1.2;
  let restored = null;
  state.starMap = {
    captureView: () => ({ view: { scale } }),
    restoreView: (snapshot) => { restored = snapshot; },
    resize() {}, setReviewDue() {}, setMode() {}, focusStar() {},
  };
  context.openReading('111111', 'quick');
  scale = 2.8;
  context.openDetail('111111');
  scale = 9;
  context.closeDetail();
  assert.equal(restored.view.scale, 2.8);
});

test('直接深链退出后摘要与星图使用同一个聚焦卦', () => {
  const { context, state } = createHarness();
  let activeCode = null;
  state.starMap = {
    captureView: () => ({ activeCode }),
    restoreView: (snapshot) => { activeCode = snapshot.activeCode; },
    focusStar(code) { activeCode = code; },
    resize() {}, setReviewDue() {}, setMode() {},
  };
  context.openDetail('111111');
  context.closeDetail();
  assert.equal(activeCode, '111111');
  assert.equal(state.reading.focusedCode, activeCode);
});

test('直接深链关闭时不把焦点还给 body，改回聚焦摘要入口', () => {
  const { context, focusCalls } = createHarness();
  context.openDetail('111111');
  context.closeDetail({ restoreFocus: true });
  assert.deepEqual(focusCalls, ['read']);
});

test('深读关系跳转后直接关闭仍保留新漫游轨迹', () => {
  const { context, state } = createHarness();
  const target = { binaryCode: '000000', name: '坤' };
  state.index.byCode.set(target.binaryCode, target);
  state.hexagrams.push(target);
  let trail = [];
  state.starMap = {
    captureView: () => ({ trail: structuredClone(trail) }),
    restoreView: (snapshot) => { trail = snapshot.trail; },
    addTrail(from, to) { trail.push({ from, to }); },
    focusStar() {}, resize() {}, setReviewDue() {}, setMode() {},
  };
  context.openDetail('111111');
  context.openDetail('000000', '111111');
  context.closeDetail();
  assert.deepEqual(trail, [{ from: '111111', to: '000000' }]);
});

test('天象舞台尚未加载时返回探索不会保留过期暂停原因', () => {
  for (const action of ['closeDetail', 'openDetail']) {
    const { context, state } = createHarness({ loaded: false });
    context[action]('111111');
    assert.equal(state.celestialPauseReasons.size, 0, action);
    assert.equal(state.celestialStage, null);
  }
});

test('返回探索只解除工作台暂停，保留仍打开的分享弹窗暂停', () => {
  for (const action of ['closeDetail', 'openDetail']) {
    const { context, state, stage } = createHarness({ extraReason: 'share' });
    context[action]('111111');
    assert.deepEqual([...state.celestialPauseReasons], ['share'], action);
    assert.deepEqual([...stage.pauseReasons], ['share'], action);
  }
});

test('非模式关闭和无效卦码不提前恢复工作台背景', () => {
  const { context, state, stage } = createHarness();
  context.closeDetail({ resetMode: false });
  context.openDetail('invalid');
  assert.equal(state.currentMode, 'learning');
  assert.equal(stage.mode, 'learning');
  assert.deepEqual([...state.celestialPauseReasons], ['mode']);
  assert.deepEqual([...stage.pauseReasons], ['mode']);
});

test('观察层级未变化时不重复改写 HUD DOM', () => {
  let mutations = 0;
  const textNode = () => {
    const node = {};
    Object.defineProperty(node, 'textContent', { set() { mutations += 1; } });
    return node;
  };
  const railItem = {
    dataset: { starStage: 'galaxy' },
    classList: { toggle() { mutations += 1; } },
    setAttribute() { mutations += 1; },
    removeAttribute() { mutations += 1; },
  };
  const context = vm.createContext({
    lastStarView: null,
    lastStarStage: '',
    state: { currentDetail: null },
    panel: { classList: { contains: () => false } },
    resolveStarStage: () => 'galaxy',
    STAR_STAGE_META: { galaxy: ['01', '银河巡航'] },
    document: {
      body: {
        dataset: new Proxy({}, { set(target, key, value) {
          mutations += 1;
          target[key] = value;
          return true;
        } }),
      },
    },
    starStageIndexEl: textNode(),
    starStageLabelEl: textNode(),
    starStageRail: { querySelectorAll: () => [railItem] },
  });
  vm.runInContext(syncStarStageSource, context);

  context.syncStarStage({ scale: 1 });
  const firstPassMutations = mutations;
  context.syncStarStage({ scale: 1 });

  assert.ok(firstPassMutations > 0);
  assert.equal(mutations, firstPassMutations);
});
