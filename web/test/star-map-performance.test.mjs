import assert from 'node:assert/strict';
import test from 'node:test';
import {
  chooseRenderFps,
  describeStarView,
  getKeywordDetailLevel,
  layoutStarNameLabels,
  relationPulseProgress,
  resolveStarStage,
  StarMap,
  shouldPlayStarEntrance,
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

test('星空背景在镜头转动和减少动态效果时始终使用有效绘制坐标', () => {
  for (const reducedMotion of [false, true]) {
    const draws = [];
    const map = Object.create(StarMap.prototype);
    Object.assign(map, {
      ctx: {
        setTransform() {},
        scale() {},
        clearRect() {},
        drawImage(image, ...coordinates) {
          assert.ok(coordinates.every(Number.isFinite), '背景绘制坐标必须为有限数值');
          draws.push(coordinates);
        },
      },
      reducedMotion,
      time: 120,
      dpr: 1,
      width: 1280,
      height: 720,
      yaw: 0.4,
      pitch: -0.2,
      view: { x: 0, y: 0, scale: 1 },
      backgroundLayer: {},
      bgStarLayers: [{}, {}],
      bgStarPhase: [0.7, 3.1],
      galaxyDustLayer: {},
      layoutMode: 'project',
      graph: { nodes: [], edges: [] },
      sortedNodes: [],
      trail: [],
      meteors: [],
      _emitSharedView() {},
      _drawGalaxyScaffold() {},
      _drawLayoutGuide() {},
    });

    map._render();
    assert.equal(draws.length, 4);
    const firstFrame = draws.splice(0);
    map.yaw += 0.3;
    map.pitch += 0.1;
    map._render();
    if (reducedMotion) assert.deepEqual(draws, firstFrame);
    else assert.notDeepEqual(draws, firstFrame);
  }
});

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

test('四态观察层级由缩放、焦点和详情阅读状态共同决定', () => {
  assert.equal(resolveStarStage({ scale: 0.7 }), 'galaxy');
  assert.equal(resolveStarStage({ scale: 1 }), 'cluster');
  assert.equal(resolveStarStage({ scale: 1, activeCode: '111111' }), 'hexagram');
  assert.equal(resolveStarStage({ scale: 1, activeCode: '111111', detailOpen: true }), 'yao');
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

function motionLayoutMap() {
  const map = Object.create(StarMap.prototype);
  Object.assign(map, {
    graph: { nodes: [
      { id: '111111', binaryCode: '111111', name: '乾', number: 1, degree: 1 },
      { id: '000000', binaryCode: '000000', name: '坤', number: 2, degree: 1 },
    ], edges: [], occurrences: [] },
    cx: 200, cy: 200, anchorR: 100, width: 400, height: 400, layoutMode: 'project',
    reducedMotion: true, isPaused: false, pauseReasons: new Set(), cameraPos: { x: 0, y: 0, z: 0 },
    cameraTarget: null, view: { x: 0, y: 0, scale: 1 }, callbacks: {},
  });
  return map;
}

function assertStaticTargets(map) {
  for (const node of map.graph.nodes) {
    assert.equal(node.x, node.targetX);
    assert.equal(node.y, node.targetY);
    assert.equal(node.z, node._zBase);
    assert.equal(node.vx, 0);
    assert.equal(node.vy, 0);
  }
}

test('减少动态时初始 D3 布局直接落在目标位置并停止模拟', async () => {
  const map = motionLayoutMap();
  try {
    map._initLayout();
    assertStaticTargets(map);
    const before = map.graph.nodes.map(node => [node.x, node.y, node.z]);
    await new Promise(resolve => setTimeout(resolve, 60));
    assert.deepEqual(map.graph.nodes.map(node => [node.x, node.y, node.z]), before);
  } finally { map.simulation?.stop(); }
});

test('减少动态时切图、resize 与 resume 不重启 D3，焦点相机随新目标同步', () => {
  const originalDocument = globalThis.document;
  const originalRaf = globalThis.requestAnimationFrame;
  globalThis.document = { hidden: false };
  globalThis.requestAnimationFrame = () => 1;
  const map = motionLayoutMap();
  let restarts = 0;
  map.simulation = { force() { return this; }, alpha() { return this; },
    restart() { restarts += 1; return this; }, stop() { return this; } };
  map._nodeViewportPoint = () => null;
  map._initBackground = () => {};
  map._setupDpr = () => { map.anchorR = 200; map.cx = 300; map.cy = 300; };
  try {
    map.setLayoutMode('earlier-heaven');
    assertStaticTargets(map);
    map.activeNode = map.graph.nodes[0];
    map.cameraTarget = { x: 1, y: 2, z: 3 };
    map.labelLayoutCache = {};
    map.resize();
    assertStaticTargets(map);
    assert.equal(map.labelLayoutCache, null);
    assert.deepEqual(map.cameraPos, { x: map.activeNode.targetX - map.cx,
      y: map.activeNode.targetY - map.cy, z: map.activeNode._zBase });
    map.animationFrame = null;
    map.resume('reading');
    assert.equal(restarts, 0);
  } finally { globalThis.document = originalDocument; globalThis.requestAnimationFrame = originalRaf; }
});

test('动态偏好切换立即稳定节点，业务暂停期间取消减少动态也不重启', () => {
  const originalDocument = globalThis.document;
  globalThis.document = { addEventListener() {} };
  const map = motionLayoutMap();
  let restarts = 0;
  map.simulation = { restart() { restarts += 1; }, stop() {} };
  map.canvas = { addEventListener() {} };
  map.motionPreference = { addEventListener() {} };
  map.autoRotate = true;
  map.meteors = [{}];
  map.graph.nodes.forEach((node) => Object.assign(node, { x: 1, y: 2, z: 3, vx: 4, vy: 5,
    targetX: 10, targetY: 20, _zBase: 30 }));
  map.activeNode = map.graph.nodes[0];
  try {
    map._bindEvents();
    map.handleMotionPreferenceChange({ matches: true });
    assertStaticTargets(map);
    assert.equal(map.autoRotate, false);
    assert.deepEqual(map.cameraPos, { x: -190, y: -180, z: 30 });
    map.pauseReasons.add('reading');
    map.isPaused = true;
    map.handleMotionPreferenceChange({ matches: false });
    assert.equal(restarts, 0);
    map.pauseReasons.clear();
    map.isPaused = false;
    map.handleMotionPreferenceChange({ matches: false });
    assert.equal(restarts, 1);
  } finally { globalThis.document = originalDocument; }
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
  map.reducedMotion = true;
  map.addTrail('from-static', 'to-static');
  assert.equal(map.trail.at(-1).t, 1, '减少动态时关系轨迹不逐帧渐显');
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

test('悬停、焦点和八纯卦标签通过换位避免强制叠字', () => {
  const ctx = measuringContext(30);
  const pure = labelNode('乾', { isPure: true, degree: 1, number: 1 });
  const active = labelNode('焦点', { degree: 1, number: 2 });
  const hovered = labelNode('悬停', { degree: 1, number: 3 });
  const hidden = labelNode('普通', { degree: 20, number: 4 });
  const labels = layoutStarNameLabels(ctx, [hidden, pure, active, hovered], {
    activeNode: active,
    hoveredNode: hovered,
  });

  assert.deepEqual(labels.map(label => label.node.id).sort(), ['乾', '焦点', '悬停'].sort());
  for (const [index, label] of labels.entries()) for (const other of labels.slice(index + 1)) {
    assert.ok(label.box.right + 7 <= other.box.left || other.box.right + 7 <= label.box.left
      || label.box.bottom + 7 <= other.box.top || other.box.bottom + 7 <= label.box.top);
  }
});

test('入场每会话一次且减少动态时直接呈现', () => {
  const values = new Map();
  const storage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) };
  assert.equal(shouldPlayStarEntrance(storage, false), true);
  assert.equal(shouldPlayStarEntrance(storage, false), false);
  assert.equal(shouldPlayStarEntrance(null, true), false);
});

test('星核上按下不选卦，抬起才确认，拖动超过 6px 或取消不误选', () => {
  const originalDocument = globalThis.document;
  globalThis.document = { addEventListener() {} };
  const handlers = {};
  const picked = [];
  const map = Object.create(StarMap.prototype);
  Object.assign(map, {
    canvas: { addEventListener: (type, handler) => { handlers[type] = handler; },
      getBoundingClientRect: () => ({ left: 0, top: 0 }), style: {},
      setPointerCapture() {}, releasePointerCapture() {} },
    callbacks: { onPick: code => picked.push(code) }, view: { x: 0, y: 0, scale: 1 },
    yaw: 0, pitch: 0, layoutMode: 'project', motionPreference: { addEventListener() {} },
    _nodeAt: () => ({ id: '111111' }), _nodeViewportPoint: () => ({ x: 100, y: 100 }),
    _nodeInteractionMeta: () => ({}), setAutoRotate() {}, cameraPos: { x: 0, y: 0, z: 0 },
  });
  try {
    map._bindEvents();
    handlers.pointerdown({ clientX: 100, clientY: 100, pointerId: 1 });
    assert.deepEqual(picked, []);
    handlers.pointerup({ clientX: 105, clientY: 100, pointerId: 1 });
    assert.deepEqual(picked, ['111111']);
    handlers.pointerdown({ clientX: 100, clientY: 100, pointerId: 2 });
    handlers.pointermove({ clientX: 107, clientY: 100, pointerId: 2 });
    assert.ok(map.yaw > 0);
    handlers.pointerup({ clientX: 107, clientY: 100, pointerId: 2 });
    handlers.pointerdown({ clientX: 100, clientY: 100, pointerId: 3 });
    handlers.pointercancel({ pointerId: 3 });
    handlers.pointerup({ clientX: 100, clientY: 100, pointerId: 3 });
    assert.deepEqual(picked, ['111111']);
    let exits = 0;
    let cleared = false;
    let propagated = true;
    map.callbacks.onExitFocus = () => { exits += 1; };
    map.clearFocus = () => { cleared = true; };
    handlers.keydown({ key: 'Escape', preventDefault() {}, stopPropagation() { propagated = false; } });
    assert.equal(exits, 1, '应用接管 Escape 逐层返回，星图不提前清除焦点');
    assert.equal(cleared, false);
    assert.equal(propagated, false, '同一次 Escape 不再被全局处理第二遍');
  } finally { globalThis.document = originalDocument; }
});

test('视角快照深复制镜头、焦点、关系、图式与自动巡天', () => {
  const map = Object.create(StarMap.prototype);
  Object.assign(map, {
    view: { x: 12, y: 20, scale: 1.4 }, yaw: 0.4, pitch: 0.2,
    cameraTarget: { x: 10, y: 30, z: 2 }, cameraPos: { x: 5, y: 15, z: 1 },
    cameraTransition: { from: { x: 0, y: 0, z: 0 }, elapsed: 225 },
    layoutMode: 'project', activeNode: { id: '111111' }, hoveredNode: null,
    relationFilter: { type: 'changing', changingPosition: 2 }, focusVisible: new Set(['111111']),
    autoRotate: false, reducedMotion: false, trail: [{ from: '000000', to: '111111', t: 3 }],
    graph: { nodes: [{ id: '111111' }], occurrences: [] }, callbacks: {}, _nodeViewportPoint: () => null,
  });
  const snapshot = map.captureView();
  map.view.x = 100;
  map.cameraPos.x = 100;
  map.cameraTransition.from.x = 100;
  map.trail[0].t = 9;
  assert.equal(snapshot.view.x, 12);
  assert.equal(snapshot.cameraPos.x, 5);
  assert.equal(snapshot.cameraTransition.from.x, 0);
  assert.equal(snapshot.trail[0].t, 3);
  assert.equal(map.restoreView(snapshot), true);
  snapshot.view.x = 99;
  snapshot.cameraPos.x = 99;
  assert.equal(map.view.x, 12);
  assert.equal(map.cameraPos.x, 5);
  assert.equal(map.cameraTransition.elapsed, 225);
  assert.equal(map.activeNode.id, '111111');
  assert.equal(map.restoreView(null), false);
  assert.equal(map.restoreView({ ...snapshot, cameraTarget: { x: NaN, y: 0, z: 0 } }), false);
});

test('快读与全景尺寸变化后恢复镜头按空间半径换算', () => {
  const map = Object.create(StarMap.prototype);
  Object.assign(map, {
    anchorR: 160, view: { x: 12, y: 20, scale: 1.4 }, yaw: 0.4, pitch: 0.2,
    cameraTarget: { x: 10, y: 30, z: 2 }, cameraPos: { x: 5, y: 15, z: 1 },
    cameraTransition: { from: { x: 2, y: 4, z: 6 }, elapsed: 225 },
    layoutMode: 'project', activeNode: { id: '111111' }, hoveredNode: null,
    relationFilter: { type: 'changing', changingPosition: 2 }, focusVisible: new Set(['111111']),
    autoRotate: false, trail: [], graph: { nodes: [{ id: '111111' }], occurrences: [] },
    callbacks: {}, _nodeViewportPoint: () => null,
  });
  const snapshot = map.captureView();
  map.anchorR = 320;
  assert.equal(map.restoreView(snapshot), true);
  assert.deepEqual(map.cameraPos, { x: 10, y: 30, z: 2 });
  assert.deepEqual(map.cameraTarget, { x: 20, y: 60, z: 4 });
  assert.deepEqual(map.cameraTransition.from, { x: 4, y: 8, z: 12 });
  assert.equal(map.view.x, 24);
  assert.equal(map.view.scale, 1.4);
  assert.equal(snapshot.cameraPos.x, 5);
});

test('聚焦镜头在 450ms 完成，减少动态立即完成', () => {
  const map = Object.create(StarMap.prototype);
  Object.assign(map, { cameraPos: { x: 0, y: 0, z: 0 }, cameraTarget: { x: 90, y: 45, z: 9 },
    cameraTransition: { from: { x: 0, y: 0, z: 0 }, elapsed: 0 }, reducedMotion: false });
  map._updateCamera(225);
  assert.equal(map.cameraPos.x, 45);
  map._updateCamera(225);
  assert.deepEqual(map.cameraPos, { x: 90, y: 45, z: 9 });
  map.reducedMotion = true;
  map.cameraTarget = { x: 1, y: 2, z: 3 };
  map._updateCamera(0);
  assert.deepEqual(map.cameraPos, { x: 1, y: 2, z: 3 });
});

test('卦名和关键词共用布局，当前最多三词、关系最多一词', () => {
  const active = labelNode('111111', { x: 220, y: 220 });
  const related = labelNode('000000', { x: 620, y: 220 });
  const words = Array.from({ length: 7 }, (_, i) => ({ text: `词${i}`, level: 1 }));
  const labels = layoutStarNameLabels(measuringContext(20), [active, related], {
    activeNode: active, focusVisible: new Set([active.id, related.id]), zoom: 2,
    keywordLayouts: { [active.id]: words, [related.id]: words }, width: 900, height: 500, avoidStars: true,
  });
  assert.equal(labels.filter(label => label.kind === 'keyword' && label.node.id === active.id).length, 3);
  assert.equal(labels.filter(label => label.kind === 'keyword' && label.node.id === related.id).length, 1);
  for (const [index, label] of labels.entries()) for (const other of labels.slice(index + 1)) {
    assert.ok(label.box.right + 7 <= other.box.left || other.box.right + 7 <= label.box.left
      || label.box.bottom + 7 <= other.box.top || other.box.bottom + 7 <= label.box.top);
  }
});

test('标签布局在 100ms 内复用，焦点或视口显著变化时立即更新', () => {
  const map = Object.create(StarMap.prototype);
  const node = labelNode('乾', { isPure: true, x: 200, y: 200 });
  Object.assign(map, { ctx: measuringContext(), time: 10, view: { scale: 1 }, layoutMode: 'project',
    width: 900, height: 500, yaw: 0, pitch: 0, cameraPos: { x: 0, y: 0, z: 0 },
    appearProgress: 1, activeNode: null, hoveredNode: null, reservedRects: [] });
  const first = map._getSpaceLabels([node]);
  map.time += 3;
  assert.equal(map._getSpaceLabels([node]), first);
  map.time += 4;
  assert.notEqual(map._getSpaceLabels([node]), first);
  const next = map._getSpaceLabels([node]);
  map.activeNode = node;
  assert.notEqual(map._getSpaceLabels([node]), next);
  const focused = map._getSpaceLabels([node]);
  map.cameraPos.x += 12;
  assert.notEqual(map._getSpaceLabels([node]), focused);
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
