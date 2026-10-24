import assert from 'node:assert/strict';
import test from 'node:test';
import { StarMap } from '../js/star-map.js';

function pointerHarness(run) {
  const previousDocument = globalThis.document;
  const canvasEvents = new Map();
  const windowEvents = new Map();
  const documentEvents = new Map();
  const captured = new Set();
  const picked = [];
  const pauses = [];
  const ownerWindow = {
    addEventListener: (name, handler) => windowEvents.set(name, handler),
    removeEventListener: (name, handler) => { if (windowEvents.get(name) === handler) windowEvents.delete(name); },
  };
  globalThis.document = {
    hidden: false,
    addEventListener: (name, handler) => documentEvents.set(name, handler),
    removeEventListener: (name, handler) => { if (documentEvents.get(name) === handler) documentEvents.delete(name); },
  };
  const map = Object.create(StarMap.prototype);
  Object.assign(map, {
    canvas: {
      ownerDocument: { defaultView: ownerWindow }, style: {},
      addEventListener: (name, handler) => canvasEvents.set(name, handler),
      getBoundingClientRect: () => ({ left: 0, top: 0 }),
      setPointerCapture: id => captured.add(id),
      hasPointerCapture: id => captured.has(id),
      releasePointerCapture: id => captured.delete(id),
    },
    callbacks: { onPick: code => picked.push(code) }, view: { x: 0, y: 0, scale: 1 },
    yaw: 0, pitch: 0, layoutMode: 'project', cameraPos: { x: 0, y: 0, z: 0 },
    motionPreference: { addEventListener() {}, removeEventListener() {} },
    simulation: { stop() {} }, pause: reason => pauses.push(reason), resume() {},
    _nodeAt: () => ({ id: '111111' }), _nodeViewportPoint: () => ({ x: 100, y: 100 }),
    _nodeInteractionMeta: () => ({}), setAutoRotate() {},
  });
  const send = (name, extra = {}) => canvasEvents.get(name)({
    pointerId: 1, isPrimary: true, button: 0, clientX: 100, clientY: 100, ...extra,
  });
  try { map._bindEvents(); run({ map, send, picked, captured, windowEvents, documentEvents, pauses }); }
  finally { globalThis.document = previousDocument; }
}

test('a second touch cancels the active drag and releases capture without selecting a star', () => {
  pointerHarness(({ map, send, picked, captured }) => {
    send('pointerdown');
    send('pointermove', { clientX: 112 });
    assert.equal(map.isDragging, true);
    send('pointerdown', { pointerId: 2, isPrimary: false, clientX: 150 });
    assert.equal(map.dragStart, null);
    assert.equal(map.isDragging, false);
    assert.equal(captured.size, 0);
    const yaw = map.yaw;
    send('pointermove', { clientX: 180 });
    send('pointerup');
    send('pointerup', { pointerId: 2, isPrimary: false });
    assert.equal(map.yaw, yaw);
    assert.deepEqual(picked, []);
    send('pointerdown', { pointerId: 3 });
    send('pointerup', { pointerId: 3 });
    assert.deepEqual(picked, ['111111'], 'The next independent single touch remains usable.');
  });
});

test('a second touch also cancels a pending tap before the drag threshold', () => {
  pointerHarness(({ map, send, picked }) => {
    send('pointerdown');
    send('pointerdown', { pointerId: 2, isPrimary: false });
    send('pointerup');
    assert.equal(map.dragStart, null);
    assert.deepEqual(picked, []);
  });
});

test('a second pointer outside the canvas also cancels the captured canvas gesture', () => {
  pointerHarness(({ map, send, picked, captured, windowEvents }) => {
    send('pointerdown');
    send('pointermove', { clientX: 112 });
    assert.equal(typeof windowEvents.get('pointerdown'), 'function');
    windowEvents.get('pointerdown')({ pointerId: 2, isPrimary: false, target: { id: 'mode-switcher' } });
    assert.equal(map.dragStart, null);
    assert.equal(map.isDragging, false);
    assert.equal(captured.size, 0);
    send('pointerup');
    assert.deepEqual(picked, []);
  });
});

test('window blur cancels a pending gesture, so a later pointerup cannot select', () => {
  pointerHarness(({ map, send, picked, captured, windowEvents }) => {
    send('pointerdown');
    assert.equal(typeof windowEvents.get('blur'), 'function');
    windowEvents.get('blur')();
    send('pointerup');
    assert.equal(map.dragStart, null);
    assert.equal(map.isDragging, false);
    assert.equal(captured.size, 0);
    assert.deepEqual(picked, []);
  });
});

test('backgrounding clears the drag before pausing the scene', () => {
  pointerHarness(({ map, send, picked, pauses, documentEvents }) => {
    send('pointerdown');
    send('pointermove', { clientX: 112 });
    globalThis.document.hidden = true;
    documentEvents.get('visibilitychange')();
    assert.equal(map.dragStart, null);
    assert.equal(map.isDragging, false);
    assert.deepEqual(pauses, ['visibility']);
    send('pointerup');
    assert.deepEqual(picked, []);
  });
});

test('destroy cancels capture and removes its window blur listener', () => {
  pointerHarness(({ map, send, picked, captured, windowEvents, documentEvents }) => {
    send('pointerdown');
    map.destroy();
    assert.equal(map.dragStart, null);
    assert.equal(captured.size, 0);
    assert.equal(windowEvents.has('blur'), false);
    assert.equal(windowEvents.has('pointerdown'), false);
    assert.equal(documentEvents.has('visibilitychange'), false);
    send('pointerup');
    assert.deepEqual(picked, []);
  });
});
