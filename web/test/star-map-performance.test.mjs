import assert from 'node:assert/strict';
import test from 'node:test';
import {
  chooseRenderFps,
  describeStarView,
  getKeywordDetailLevel,
  layoutStarNameLabels,
  relationPulseProgress,
  StarMap,
} from '../js/star-map.js';

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

test('关系能量包循环前进并保持三段错峰', () => {
  const progresses = [0, 1, 2].map(index => relationPulseProgress(1000, index, 0.17));
  progresses.forEach(progress => assert.ok(progress >= 0 && progress < 1));
  assert.ok(Math.abs(((progresses[1] - progresses[0] + 1) % 1) - 1 / 3) < 0.001);
  assert.ok(Math.abs(((progresses[2] - progresses[1] + 1) % 1) - 1 / 3) < 0.001);
});

test('关键词按焦点、关系和纯卦语义逐层展开', () => {
  assert.equal(getKeywordDetailLevel({ zoom: 1, depthScale: 1, isFocus: true }), 3);
  assert.equal(getKeywordDetailLevel({ zoom: 1.1, depthScale: 1, isRelated: true }), 1);
  assert.equal(getKeywordDetailLevel({ zoom: 2, depthScale: 1, isPure: false }), 0);
  assert.equal(getKeywordDetailLevel({ zoom: 1.5, depthScale: 1, isPure: true }), 1);
  assert.equal(getKeywordDetailLevel({ zoom: 0.7, depthScale: 1, isFocus: true }), 0);
});

test('视角读数把缩放层级和球面姿态转换为稳定的五度刻度', () => {
  assert.deepEqual(describeStarView({ scale: 1.5, yaw: 0.11, pitch: -0.09 }), {
    level: '关系层',
    layoutMode: 'project',
    layoutLabel: '易象银河',
    zoomPercent: 150,
    yawDegrees: 5,
    pitchDegrees: -5,
    angleText: '经向 5° · 纬向 -5°',
    rotationText: '手动观测',
  });
  assert.equal(describeStarView({ scale: 0.6 }).level, '总览层');
  assert.equal(describeStarView({ scale: 2.2 }).level, '释义层');
  assert.ok(describeStarView({ yaw: 15.2 }).yawDegrees >= 0 && describeStarView({ yaw: 15.2 }).yawDegrees < 360);
  assert.equal(describeStarView({ autoRotate: true }).rotationText, '自动巡天中');
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

test('星图把可见星群的中心、包围半径和镜头姿态同步给 WebGL 外轨', () => {
  const map = Object.create(StarMap.prototype);
  let emitted = null;
  Object.assign(map, {
    callbacks: { onViewChange: view => { emitted = { ...view }; } },
    canvas: { getBoundingClientRect: () => ({ left: 10, top: 20 }) },
    graph: {
      nodes: [
        { id: 'a', _screen: { x: 100, y: 100 } },
        { id: 'b', _screen: { x: 300, y: 100 } },
        { id: 'hidden', _screen: { x: 900, y: 900 } },
      ],
    },
    focusVisible: new Set(['a', 'b']),
    sharedView: {},
    view: { scale: 1 },
    cx: 200,
    cy: 100,
    anchorR: 200,
    yaw: 0.4,
    pitch: -0.2,
    _worldToScreen: () => ({ x: 200, y: 100, depthFactor: 1 }),
  });

  map._emitSharedView();

  assert.deepEqual(emitted, {
    yaw: 0.4,
    pitch: -0.2,
    scale: 1,
    centerX: 210,
    centerY: 120,
    radius: 108,
    activeCode: null,
    activeX: null,
    activeY: null,
    activeDepth: null,
    hoverCode: null,
    hoverX: null,
    hoverY: null,
    hoverDepth: null,
    autoRotate: false,
    layoutMode: 'project',
  });
});

test('星图尺寸变化时同步缩放当前焦点相机，避免面板开合后坐标漂移', () => {
  const map = Object.create(StarMap.prototype);
  Object.assign(map, {
    width: 1000,
    height: 800,
    cx: 500,
    cy: 400,
    anchorR: 320,
    cameraTarget: { x: 120, y: -80, z: 60 },
    cameraPos: { x: 60, y: -40, z: 30 },
    graph: { nodes: [] },
    simulation: {
      force() { return this; },
      alpha() { return this; },
      restart() { return this; },
    },
    _setupDpr() {
      this.width = 500;
      this.height = 400;
      this.cx = 250;
      this.cy = 200;
      this.anchorR = 160;
    },
    _initBackground() {},
  });

  map.resize();

  assert.deepEqual(map.cameraTarget, { x: 60, y: -40, z: 30 });
  assert.deepEqual(map.cameraPos, { x: 30, y: -20, z: 15 });
});

test('关系漫游只保留最近 5 段轨迹', () => {
  const map = Object.create(StarMap.prototype);
  map.trail = [];
  for (let index = 0; index < 60; index += 1) {
    map.addTrail(`from-${index}`, `to-${index}`);
  }
  assert.equal(map.trail.length, 5);
  assert.equal(map.trail[0].from, 'from-55');
});

test('星图关系层只显示当前有向关系，变卦必须指定动爻', () => {
  const map = Object.create(StarMap.prototype);
  Object.assign(map, {
    graph: {
      occurrences: [
        { from: 'a', to: 'b', type: 'opposite', conditional: false, changingPositions: [] },
        { from: 'a', to: 'c', type: 'changing', conditional: true, changingPositions: [2] },
        { from: 'c', to: 'a', type: 'interlocking', conditional: false, changingPositions: [] },
      ],
    },
    activeNode: { id: 'a' },
    relationFilter: { type: 'opposite', changingPosition: null },
    reducedMotion: true,
    callbacks: {},
  });

  assert.deepEqual(map._relationTargets('a'), ['b']);
  map.setRelationFilter('changing');
  assert.deepEqual(map.getRelationState().targets, []);
  map.setRelationFilter('changing', 2);
  assert.deepEqual(map.getRelationState().targets, ['c']);
  assert.deepEqual([...map.focusVisible], ['a', 'c']);
});

test('普通卦名使用实测宽度防碰撞，并优先保留重要标签', () => {
  const ctx = measuringContext(24);
  const labels = layoutStarNameLabels(ctx, [
    labelNode('普通', { x: 100, degree: 2, number: 2 }),
    labelNode('重要', { x: 105, degree: 10, number: 3 }),
    labelNode('远景', { x: 200, depthFactor: 0.2, number: 4 }),
  ], { activeNode: { id: '虚拟焦点' } });

  assert.deepEqual(labels.map(label => label.node.id), ['远景', '重要']);
  assert.deepEqual(ctx.measured.map(item => item.text), ['普通', '重要', '远景']);
  assert.equal(labels.find(label => label.node.id === '远景').fontSize, 15);
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

test('经典图式总览只常驻结构地标，选卦后展开当前关系节点', () => {
  const ctx = measuringContext(16);
  const landmark = labelNode('本宫', { x: 80, number: 1 });
  landmark.layoutOverviewLabel = true;
  const ordinary = labelNode('中段', { x: 160, number: 2 });
  const related = labelNode('关系', { x: 240, number: 3 });

  assert.deepEqual(
    layoutStarNameLabels(ctx, [landmark, ordinary, related], { classic: true, showAll: true }).map(label => label.node.id),
    ['本宫'],
  );
  const focusedLabels = layoutStarNameLabels(ctx, [landmark, ordinary, related], {
    classic: true,
    showAll: true,
    activeNode: ordinary,
    focusVisible: new Set(['中段', '关系']),
  }).map(label => label.node.id).sort();
  assert.deepEqual(focusedLabels, ['中段', '关系', '本宫'].sort());
});

test('普通卦名碰撞框保持 7px 屏幕间距', () => {
  const ctx = measuringContext(20);
  const base = labelNode('甲', { x: 100, number: 1 });
  const tooClose = labelNode('乙', { x: 126, number: 2 });
  const enoughGap = labelNode('丙', { x: 127, number: 3 });

  const options = { activeNode: { id: '虚拟焦点' } };
  assert.equal(layoutStarNameLabels(ctx, [base, tooClose], options).length, 1);
  assert.equal(layoutStarNameLabels(ctx, [base, enoughGap], options).length, 2);
});

test('相同重要度的碰撞标签优先保留前景卦名', () => {
  const ctx = measuringContext(24);
  const background = labelNode('后景', { depthFactor: 0.5, degree: 5, number: 1 });
  const foreground = labelNode('前景', { depthFactor: 1.5, degree: 5, number: 2 });

  const labels = layoutStarNameLabels(ctx, [background, foreground], { activeNode: { id: '虚拟焦点' } });

  assert.deepEqual(labels.map(label => label.node.id), ['前景']);
});
