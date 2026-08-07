import assert from 'node:assert/strict';
import test from 'node:test';
import {
  bindInterfaceSounds,
  buildCoinImpactSequence,
  buildMechanicalTickTimes,
  isSoundEnabled,
  playHexagramSound,
  playInterfaceSound,
  resolveInterfaceCue,
  setSoundEnabled,
  startMechanicalWheelSound,
} from '../js/audio-engine.js';

class FakeAudioParam {
  constructor() { this.value = 0; }
  setValueAtTime(value) { this.value = value; }
  linearRampToValueAtTime(value) { this.value = value; }
  exponentialRampToValueAtTime(value) { this.value = value; }
}

class FakeAudioNode {
  constructor() {
    this.gain = new FakeAudioParam();
    this.frequency = new FakeAudioParam();
    this.playbackRate = new FakeAudioParam();
    this.Q = new FakeAudioParam();
  }
  connect() { return this; }
  disconnect() {}
  start() { this.started = true; }
  stop() { this.stopped = true; }
}

class FakeAudioContext {
  constructor() {
    this.currentTime = 10;
    this.sampleRate = 8000;
    this.destination = new FakeAudioNode();
    this.bufferSources = [];
    this.oscillators = [];
  }
  resume() { return Promise.resolve(); }
  createGain() { return new FakeAudioNode(); }
  createBiquadFilter() { return new FakeAudioNode(); }
  createBuffer() {
    return { getChannelData: () => new Float32Array(256) };
  }
  createBufferSource() {
    const node = new FakeAudioNode();
    this.bufferSources.push(node);
    return node;
  }
  createOscillator() {
    const node = new FakeAudioNode();
    this.oscillators.push(node);
    return node;
  }
}

test('机械转盘节奏先加速再减速并在落卦前停止', () => {
  const duration = 3400;
  const times = buildMechanicalTickTimes(duration);
  const intervals = times.slice(1).map((time, index) => time - times[index]);

  assert.equal(times[0], 0);
  assert.ok(times.at(-1) < duration - 60);
  assert.ok(times.length > 35);
  assert.ok(Math.min(...intervals) < intervals[0]);
  assert.ok(intervals.at(-1) > Math.min(...intervals) * 3);
  assert.ok(times.every((time, index) => index === 0 || time > times[index - 1]));
});

test('机械转盘节奏拒绝无效和过短时长', () => {
  assert.throws(() => buildMechanicalTickTimes(Number.NaN), /时长/);
  assert.throws(() => buildMechanicalTickTimes(239), /240/);
});

test('各功能区域映射到对应声景且跳过禁用与转盘按钮', () => {
  assert.equal(resolveInterfaceCue({ classNames: ['mode-btn'] }), 'navigate');
  assert.equal(resolveInterfaceCue({ classNames: ['quiz-option', 'quiz-correct'] }), 'correct');
  assert.equal(resolveInterfaceCue({ classNames: ['quiz-option', 'quiz-wrong'] }), 'wrong');
  assert.equal(resolveInterfaceCue({ classNames: ['coin-cast'] }), 'coin');
  assert.equal(resolveInterfaceCue({ classNames: ['mh-time'] }), 'complete');
  assert.equal(resolveInterfaceCue({ dataset: { evolutionLine: '2' } }), 'mechanism');
  assert.equal(resolveInterfaceCue({ dataset: { evolutionAction: 'open' } }), 'navigate');
  assert.equal(resolveInterfaceCue({ dataset: { guaxuOpen: '' } }), 'navigate');
  assert.equal(resolveInterfaceCue({ contexts: ['almanac'] }), 'page');
  assert.equal(resolveInterfaceCue({ contexts: ['learning'] }), 'study');
  assert.equal(resolveInterfaceCue({ type: 'summary' }), 'page');
  assert.equal(resolveInterfaceCue({ dataset: { rate: '2' } }), 'correct');
  assert.equal(resolveInterfaceCue({ dataset: { rate: '0' } }), 'wrong');
  assert.equal(resolveInterfaceCue({ classNames: ['guaxu-spin'] }), null);
  assert.equal(resolveInterfaceCue({ classNames: ['mode-btn'], disabled: true }), null);
});

test('铜钱声由三枚铜钱的初次碰撞与逐级衰减反弹组成', () => {
  const events = buildCoinImpactSequence();
  assert.equal(events.length, 9);
  assert.equal(events.filter((event) => event.primary).length, 3);
  assert.ok(events.every((event, index) => index === 0 || event.delay >= events[index - 1].delay));
  for (const baseFrequency of new Set(events.filter((event) => event.primary).map((event) => event.baseFrequency))) {
    const coinEvents = events.filter((event) => Math.abs(event.baseFrequency / baseFrequency - 1) < 0.08);
    assert.ok(coinEvents.some((event) => event.intensity < 0.2));
  }
});

test('机械转盘合成轮毂与棘轮声并以多层锁止音收尾', () => {
  const context = new FakeAudioContext();
  const clearedTimers = [];
  const stored = new Map();
  globalThis.localStorage = {
    getItem: (key) => stored.get(key) ?? null,
    setItem: (key, value) => stored.set(key, value),
  };
  globalThis.window = {
    AudioContext: class { constructor() { return context; } },
    setTimeout: () => 9,
    clearTimeout: (timer) => clearedTimers.push(timer),
  };

  const controller = startMechanicalWheelSound(400);
  assert.ok(context.bufferSources.length >= 4);
  assert.equal(context.oscillators.length, 0);
  controller.finish();
  assert.equal(context.oscillators.length, 5);
  assert.deepEqual(clearedTimers, [9]);

  const beforeHexagram = context.oscillators.length;
  const tones = playHexagramSound('111000');
  assert.deepEqual(tones, { lower: '商', upper: '宫' });
  assert.equal(context.oscillators.length - beforeHexagram, 12);

  const beforeCues = context.oscillators.length;
  ['tap', 'navigate', 'page', 'mechanism', 'correct', 'wrong', 'coin', 'study', 'complete']
    .forEach((cue) => assert.equal(playInterfaceSound(cue), true));
  assert.ok(context.oscillators.length > beforeCues);
  assert.equal(playInterfaceSound('unknown'), false);

  assert.equal(setSoundEnabled(false), false);
  assert.equal(isSoundEnabled(), false);
  assert.equal(stored.get('yijing-interface-sound'), 'off');
  assert.equal(playInterfaceSound('tap'), false);
  assert.equal(setSoundEnabled(true), true);
  assert.equal(stored.get('yijing-interface-sound'), 'on');

  let listener = null;
  const root = {
    addEventListener: (name, handler) => { if (name === 'click') listener = handler; },
    removeEventListener: (name, handler) => { if (name === 'click' && handler === listener) listener = null; },
  };
  const unbind = bindInterfaceSounds(root);
  assert.equal(typeof listener, 'function');
  unbind();
  assert.equal(listener, null);
  delete globalThis.window;
  delete globalThis.localStorage;
});
