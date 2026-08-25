import assert from 'node:assert/strict';
import test from 'node:test';
import { chooseRenderFps, layoutStarNameLabels, StarMap } from '../js/star-map.js';

function labelNode(id, {
  x = 100,
  y = 100,
  depthFactor = 1,
  degree = 1,
  isPure = false,
  number = 1,
} = {}) {
  return {
    id,
    name: id,
    binaryCode: isPure ? '111111' : '101010',
    number,
    degree,
    isPure,
    _screen: { x, y, depthFactor },
  };
}

function measuringContext(width = 20) {
  const measured = [];
  return {
    font: '',
    measured,
    measureText(text) {
      measured.push({ text, font: this.font });
      return { width, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2 };
    },
  };
}

test('星图空闲时降到 30 FPS，交互或相机移动时恢复 60 FPS', () => {
  assert.equal(chooseRenderFps({ reducedMotion: false, isDragging: false, cameraDistance: 0 }), 30);
  assert.equal(chooseRenderFps({ reducedMotion: false, isDragging: true, cameraDistance: 0 }), 60);
  assert.equal(chooseRenderFps({ reducedMotion: false, isDragging: false, cameraDistance: 1 }), 60);
});

test('功能工作区把背景星图降到 15 FPS', () => {
  assert.equal(chooseRenderFps({
    reducedMotion: false,
    isDragging: false,
    cameraDistance: 0,
    mode: 'learning',
  }), 15);
  assert.equal(chooseRenderFps({
    reducedMotion: false,
    isDragging: true,
    cameraDistance: 0,
    mode: 'learning',
  }), 60);
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
    map.canvas = { dataset: {} };
    map.simulation = { stop() {}, restart() {} };

    map.pause();
    map.pause('visibility');
    map.resume('visibility');
    assert.equal(map.isPaused, true);
    assert.deepEqual([...map.pauseReasons], ['manual']);
    assert.equal(map.animationFrame, null);
    assert.equal(map.canvas.dataset.animationActive, 'false');

    map.resume();
    assert.equal(map.isPaused, false);
    assert.equal(map.animationFrame, 1);
    assert.equal(map.lastRenderAt, 0);
    assert.equal(map.canvas.dataset.animationActive, 'true');
  } finally {
    globalThis.document = originalDocument;
    globalThis.requestAnimationFrame = originalRequestAnimationFrame;
    globalThis.cancelAnimationFrame = originalCancelAnimationFrame;
  }
});

test('关系漫游只保留最近 48 段轨迹', () => {
  const map = Object.create(StarMap.prototype);
  map.trail = [];
  for (let index = 0; index < 60; index += 1) {
    map.addTrail(`from-${index}`, `to-${index}`);
  }
  assert.equal(map.trail.length, 48);
  assert.equal(map.trail[0].from, 'from-12');
});

test('普通卦名使用实测宽度防碰撞，并优先保留重要标签', () => {
  const ctx = measuringContext(24);
  const labels = layoutStarNameLabels(ctx, [
    labelNode('普通', { x: 100, degree: 2, number: 2 }),
    labelNode('重要', { x: 105, degree: 10, number: 3 }),
    labelNode('远景', { x: 200, depthFactor: 0.2, number: 4 }),
  ]);

  assert.deepEqual(labels.map(label => label.node.id), ['远景', '重要']);
  assert.deepEqual(ctx.measured.map(item => item.text), ['普通', '重要', '远景']);
  assert.equal(labels.find(label => label.node.id === '远景').fontSize, 12);
});

test('悬停、焦点和八纯卦标签即使碰撞也强制显示', () => {
  const ctx = measuringContext(30);
  const pure = labelNode('乾', { isPure: true, degree: 1, number: 1 });
  const active = labelNode('焦点', { degree: 1, number: 2 });
  const hovered = labelNode('悬停', { degree: 1, number: 3 });
  const hidden = labelNode('普通', { degree: 20, number: 4 });
  const labels = layoutStarNameLabels(ctx, [hidden, pure, active, hovered], {
    activeNode: active,
    hoveredNode: hovered,
  });

  assert.deepEqual(labels.map(label => label.node.id), ['乾', '焦点', '悬停']);
});

test('焦点标签不受入场标签延迟影响', () => {
  const ctx = measuringContext();
  const active = labelNode('焦点', { number: 64 });

  const labels = layoutStarNameLabels(ctx, [active], {
    activeNode: active,
    appearProgress: 0,
  });

  assert.deepEqual(labels.map(label => label.node.id), ['焦点']);
});

test('普通卦名碰撞框保持 7px 屏幕间距', () => {
  const ctx = measuringContext(20);
  const base = labelNode('甲', { x: 100, number: 1 });
  const tooClose = labelNode('乙', { x: 126, number: 2 });
  const enoughGap = labelNode('丙', { x: 127, number: 3 });

  assert.equal(layoutStarNameLabels(ctx, [base, tooClose]).length, 1);
  assert.equal(layoutStarNameLabels(ctx, [base, enoughGap]).length, 2);
});

test('相同重要度的碰撞标签优先保留前景卦名', () => {
  const ctx = measuringContext(24);
  const background = labelNode('后景', { depthFactor: 0.5, degree: 5, number: 1 });
  const foreground = labelNode('前景', { depthFactor: 1.5, degree: 5, number: 2 });

  const labels = layoutStarNameLabels(ctx, [background, foreground]);

  assert.deepEqual(labels.map(label => label.node.id), ['前景']);
});
