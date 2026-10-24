import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
const setModeSource = source.match(/^async function setMode\([\s\S]*?^}/m)?.[0];
assert.ok(setModeSource, 'Run the real mode transition without booting WebGL.');

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function createHarness() {
  const noop = () => {};
  const renders = [];
  const cleanups = [];
  const resources = [];
  const pending = [];
  const bodyClasses = new Set();
  const panelAttributes = new Map();
  const panelClasses = new Set();
  const state = { currentMode: 'explore', reading: { stage: 'none' }, celestialStage: { setMode: noop } };
  const panelContent = { innerHTML: '', replaceChildren(node) { this.error = node; } };
  const renderer = name => (...args) => {
    renders.push({ name, args });
    panelContent.innerHTML = `rendered:${name}`;
    if (name === 'learning') return () => cleanups.push(panelContent.innerHTML);
  };
  const context = vm.createContext({
    state, panelContent, modeRequestId: 0, modeCleanup: null,
    disposeMode: noop,
    panel: { scrollTop: 0,
      classList: { remove: name => panelClasses.delete(name) },
      setAttribute: (name, value) => panelAttributes.set(name, value),
      removeAttribute: name => panelAttributes.delete(name),
    },
    document: {
      body: { classList: { add: name => bodyClasses.add(name), remove: name => bodyClasses.delete(name) } },
      createElement: () => ({ setAttribute: noop }),
    },
    modeLoaders: {
      learning: () => pending.length ? pending.shift().promise : Promise.resolve(renderer('learning')),
      review: () => Promise.resolve(renderer('review')),
      divination: () => Promise.resolve(renderer('divination')),
      quiz: () => Promise.resolve(renderer('quiz')),
    },
    loadModeResources: async mode => { resources.push(mode); },
    createReadingState: () => ({ stage: 'none' }),
    rememberReadingDraft: noop, closeDetail: noop, setRelationOptions: noop,
    setFocusMode: noop, updateModeButtons: noop, updateExploreTools: noop,
    resumeCelestialStage: noop, pauseCelestialStage: noop, syncReadingPresentation: noop,
    closeEvolutionLab: noop, closeGuaxuWheel: noop, openPanel: noop,
    updateDetailUrl: noop, installUIIcons: noop, resetPanelViewport: noop,
    cinematicMotion: { beginMode: noop, previewHexagram: noop, enterSurface: noop },
    motionSystem: { reveal: noop },
  });
  const disposeSource = source.match(/^function disposeMode\([\s\S]*?^}/m)?.[0];
  if (disposeSource) vm.runInContext(disposeSource, context);
  vm.runInContext(setModeSource, context);
  return { context, state, renders, resources, pending, renderer, panelContent, cleanups, bodyClasses, panelAttributes };
}

function useRealCloseDetail(harness) {
  const closeSource = source.match(/^function closeDetail\([\s\S]*?^}/m)?.[0];
  assert.ok(closeSource);
  Object.assign(harness.context, {
    transitionReading: () => ({ stage: 'none' }),
    syncStarStage() {}, syncFocusSummary() {},
  });
  vm.runInContext(closeSource, harness.context);
}

const entry = {
  section: 'assessment', lessonId: 'l1-1', requiredQuestionId: 'theory-yinyang-name',
  requiredQuestionVersion: 'curriculum-v1', returnTo: 'review',
};

test('温故入口把课程与原题上下文传给加载完成后的学习页', async () => {
  const h = createHarness();
  await h.context.setMode('review');
  await h.renders[0].args[2](entry);
  assert.equal(h.state.currentMode, 'learning');
  assert.equal(h.renders.at(-1).name, 'learning');
  assert.deepEqual(h.renders.at(-1).args[3], entry);
  assert.deepEqual(h.resources, ['review', 'learning']);
});

test('学习页导航转发可选上下文，普通导航不沿用上一张原题', async () => {
  const h = createHarness();
  await h.context.setMode('learning');
  await h.renders[0].args[2]('learning', entry);
  assert.deepEqual(h.renders.at(-1).args[3], entry);
  await h.context.setMode('learning');
  assert.equal(h.renders.at(-1).args[3]?.requiredQuestionId, undefined);
});

test('较旧的学习加载即使最后完成也不能覆盖新原题入口', async () => {
  const h = createHarness();
  const first = deferred();
  const second = deferred();
  h.pending.push(first, second);
  const next = { ...entry, requiredQuestionId: 'theory-yinyang-desc' };
  const earlier = h.context.setMode('learning', entry);
  const later = h.context.setMode('learning', next);
  second.resolve(h.renderer('learning'));
  await later;
  first.resolve(h.renderer('learning'));
  await earlier;
  assert.equal(h.renders.length, 1);
  assert.deepEqual(h.renders[0].args[3], next);
});

test('课程加载失败不显示原题试卷，重试仍可使用同一入口上下文', async () => {
  const h = createHarness();
  const request = deferred();
  h.pending.push(request);
  const failed = h.context.setMode('learning', entry);
  request.reject(new Error('offline'));
  await failed;
  assert.equal(h.renders.length, 0);
  assert.match(h.panelContent.error.textContent, /内容加载失败.*offline/);
  await h.context.setMode('learning', entry);
  assert.deepEqual(h.renders[0].args[3], entry);
});

for (const outcome of ['resolve', 'reject']) {
  test(`关闭仍在加载的学习页立即清除忙碌状态，迟到${outcome}不重开页面`, async () => {
    const h = createHarness();
    useRealCloseDetail(h);
    const request = deferred();
    h.pending.push(request);
    const loading = h.context.setMode('learning', entry);
    assert.equal(h.bodyClasses.has('mode-transitioning'), true);
    assert.equal(h.panelAttributes.get('aria-busy'), 'true');
    h.context.closeDetail();
    assert.equal(h.state.currentMode, 'explore');
    assert.equal(h.bodyClasses.has('mode-transitioning'), false);
    assert.equal(h.panelAttributes.has('aria-busy'), false);
    if (outcome === 'resolve') request.resolve(h.renderer('learning'));
    else request.reject(new Error('offline after close'));
    await loading;
    assert.equal(h.renders.length, 0);
    assert.equal(h.panelContent.error, undefined);
    assert.equal(h.bodyClasses.has('mode-transitioning'), false);
    assert.equal(h.panelAttributes.has('aria-busy'), false);
  });
}

test('关闭后再次打开学习时，旧加载结束不清除新请求的忙碌状态', async () => {
  const h = createHarness();
  useRealCloseDetail(h);
  const first = deferred();
  const second = deferred();
  h.pending.push(first, second);
  const earlier = h.context.setMode('learning');
  h.context.closeDetail();
  const later = h.context.setMode('learning', entry);
  first.resolve(h.renderer('learning'));
  await earlier;
  assert.equal(h.renders.length, 0);
  assert.equal(h.bodyClasses.has('mode-transitioning'), true);
  assert.equal(h.panelAttributes.get('aria-busy'), 'true');
  second.resolve(h.renderer('learning'));
  await later;
  assert.equal(h.renders.length, 1);
  assert.equal(h.bodyClasses.has('mode-transitioning'), false);
  assert.equal(h.panelAttributes.has('aria-busy'), false);
});

test('离开学习时在替换正文之前收尾，回星图重复清理仍只执行一次', async () => {
  const h = createHarness();
  await h.context.setMode('learning');
  await h.context.setMode('review');
  assert.deepEqual(h.cleanups, ['rendered:learning']);
  await h.context.setMode('explore');
  assert.equal(h.cleanups.length, 1);
});

test('较旧加载不会安装清理函数或销毁当前学习实例', async () => {
  const h = createHarness();
  const first = deferred();
  h.pending.push(first);
  const earlier = h.context.setMode('learning');
  await h.context.setMode('learning', entry);
  first.resolve(h.renderer('learning'));
  await earlier;
  assert.equal(h.cleanups.length, 0);
  await h.context.setMode('review');
  assert.deepEqual(h.cleanups, ['rendered:learning']);
});

test('推荐的旧错题入口明确传wrongOnly，普通测验不沿用', async () => {
  const h = createHarness();
  await h.context.setMode('learning');
  await h.renders[0].args[2]('quiz', { wrongOnly: true });
  assert.equal(h.renders.at(-1).args[2], true);
  await h.context.setMode('quiz');
  assert.equal(h.renders.at(-1).args[2], false);
});

test('欢迎的零基础路径直接进入首课，其他两条路径保持原含义', () => {
  const callback = source.match(/  const enter = \(destination\) => \{[\s\S]*?^  };/m)?.[0];
  assert.ok(callback);
  const calls = [];
  const noop = () => {};
  const context = vm.createContext({
    sessionStorage: { setItem: noop }, DAILY_SEEN_KEY: 'seen',
    dailyOverlay: { classList: { add: noop }, setAttribute: noop }, setDailyBackgroundInert: noop,
    setMode: (...args) => calls.push(args), window: { matchMedia: () => ({ matches: true }), setTimeout: noop },
  });
  vm.runInContext(`${callback}\nenter('beginner'); enter('daily'); enter('explore');`, context);
  assert.equal(calls[0][0], 'learning');
  assert.equal(calls[0][1]?.section, 'path');
  assert.equal(calls[0][1]?.lessonId, 'l1-1');
  assert.equal(calls[1][0], 'explore');
  assert.equal(calls[2][0], 'explore');
});

test('模式通用聚焦尊重复讲入口，旧帧不聚焦新页或已移除控件', () => {
  const resetSource = source.match(/^function resetPanelViewport\([\s\S]*?^}/m)?.[0];
  assert.ok(resetSource);
  const frames = [];
  const focused = [];
  const heading = { isConnected: true, focus: () => focused.push('heading') };
  const oral = { isConnected: true, focus: () => focused.push('oral') };
  let currentOral = oral;
  let currentHeading = heading;
  const context = vm.createContext({
    cinematicMotion: { resetScroll() {} },
    panelContent: { scrollTop: 30,
      querySelector: selector => selector.includes('data-learning-focus') ? currentOral : currentHeading,
      contains: element => element === currentOral || element === currentHeading,
    },
    window: { requestAnimationFrame: callback => frames.push(callback) },
  });
  vm.runInContext(resetSource, context);
  context.resetPanelViewport({ focusHeading: true });
  frames.shift()();
  assert.deepEqual(focused, ['oral']);
  context.resetPanelViewport({ focusHeading: true });
  oral.isConnected = false;
  currentOral = null;
  currentHeading = { isConnected: true, focus: () => focused.push('new-page') };
  frames.shift()();
  assert.deepEqual(focused, ['oral'], '旧帧不查找并聚焦新页面标题');
});
