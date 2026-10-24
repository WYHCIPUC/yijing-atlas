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
  const resources = [];
  const pending = [];
  const state = { currentMode: 'explore', reading: { stage: 'none' }, celestialStage: { setMode: noop } };
  const panelContent = { innerHTML: '', replaceChildren(node) { this.error = node; } };
  const renderer = name => (...args) => renders.push({ name, args });
  const context = vm.createContext({
    state, panelContent, modeRequestId: 0,
    panel: { setAttribute: noop, removeAttribute: noop },
    document: {
      body: { classList: { add: noop, remove: noop } },
      createElement: () => ({ setAttribute: noop }),
    },
    modeLoaders: {
      learning: () => pending.length ? pending.shift().promise : Promise.resolve(renderer('learning')),
      review: () => Promise.resolve(renderer('review')),
      divination: () => Promise.resolve(renderer('divination')),
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
  vm.runInContext(setModeSource, context);
  return { context, state, renders, resources, pending, renderer, panelContent };
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
