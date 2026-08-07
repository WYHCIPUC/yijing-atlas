import assert from 'node:assert/strict';
import test from 'node:test';
import { chooseRenderFps, StarMap } from '../js/star-map.js';

test('星图空闲时降到 30 FPS，交互或相机移动时恢复 60 FPS', () => {
  assert.equal(chooseRenderFps({ reducedMotion: false, isDragging: false, cameraDistance: 0 }), 30);
  assert.equal(chooseRenderFps({ reducedMotion: false, isDragging: true, cameraDistance: 0 }), 60);
  assert.equal(chooseRenderFps({ reducedMotion: false, isDragging: false, cameraDistance: 1 }), 60);
});

test('减少动态效果偏好固定使用低帧率', () => {
  assert.equal(chooseRenderFps({ reducedMotion: true, isDragging: true, cameraDistance: 10 }), 10);
});

test('页面可见性恢复不会覆盖业务层暂停', () => {
  const originalDocument = globalThis.document;
  const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
  const originalCancelAnimationFrame = globalThis.cancelAnimationFrame;
  let nextFrame = 0;
  globalThis.document = { hidden: false };
  globalThis.requestAnimationFrame = () => ++nextFrame;
  globalThis.cancelAnimationFrame = () => {};

  try {
    const map = Object.create(StarMap.prototype);
    map.pauseReasons = new Set();
    map.isPaused = false;
    map.animationFrame = 1;
    map.lastRenderAt = 10;
    map.renderLoop = () => {};

    map.pause();
    map.pause('visibility');
    map.resume('visibility');
    assert.equal(map.isPaused, true);
    assert.deepEqual([...map.pauseReasons], ['manual']);
    assert.equal(map.animationFrame, null);

    map.resume();
    assert.equal(map.isPaused, false);
    assert.equal(map.animationFrame, 1);
    assert.equal(map.lastRenderAt, 0);
  } finally {
    globalThis.document = originalDocument;
    globalThis.requestAnimationFrame = originalRequestAnimationFrame;
    globalThis.cancelAnimationFrame = originalCancelAnimationFrame;
  }
});
