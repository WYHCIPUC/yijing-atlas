import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { chooseCelestialFps, writeQuadraticArc } from '../js/celestial-stage.js';

test('天象舞台按模式与设备能力限制帧率', () => {
  assert.equal(chooseCelestialFps({ mode: 'explore' }), 45);
  assert.equal(chooseCelestialFps({ mode: 'learning' }), 24);
  assert.equal(chooseCelestialFps({ mode: 'explore', lowPower: true }), 20);
  assert.equal(chooseCelestialFps({ mode: 'quiz', lowPower: true }), 12);
});

test('不可见或减少动态时停止连续渲染', () => {
  assert.equal(chooseCelestialFps({ hidden: true }), 0);
  assert.equal(chooseCelestialFps({ reducedMotion: true }), 0);
});

test('空间系带保持端点准确并在中段抬升', () => {
  const positions = new Float32Array(9);
  writeQuadraticArc(positions, { x: 0, y: 0, z: 0 }, { x: 2, y: 0, z: 0 }, 0.6);
  assert.deepEqual([...positions.slice(0, 3)], [0, 0, 0]);
  assert.deepEqual([...positions.slice(6, 9)], [2, 0, 0]);
  assert.ok(positions[4] > 0);
  assert.ok(positions[5] > 0);
});

test('WebGL 舞台具备上下文恢复与资源释放保护', () => {
  const source = readFileSync(new URL('../js/celestial-stage.js', import.meta.url), 'utf8');
  assert.match(source, /webglcontextlost/);
  assert.match(source, /webglcontextrestored/);
  assert.match(source, /renderer\.setPixelRatio\(Math\.min/);
  assert.match(source, /syncView\(view\)/);
  assert.match(source, /view\.layoutMode === 'project' \? 0 : 1/);
  assert.match(source, /const layoutDepth = 1 - sharedView\.layoutBlend \* 0\.82/);
  assert.match(source, /root\.position\.copy\(layoutAnchor\)/);
  assert.match(source, /galaxyScale \* Math\.pow\(sharedView\.scale/);
  assert.doesNotMatch(source, /IcosahedronGeometry|OctahedronGeometry|networkShell/);
  assert.match(source, /const TRIGRAM_CODES = \['111', '110', '101', '100', '011', '010', '001', '000'\]/);
  assert.match(source, /orbiters\.rotation\.z = 0/);
  assert.match(source, /const detailFade = Math\.max\(0\.5/);
  assert.match(source, /ringMaterial\.opacity = 0\.14 \* detailFade/);
  assert.match(source, /focusHexagram\(code, point\)/);
  assert.match(source, /typeof code === 'string' && \/\^\[01\]\{6\}\$\//);
  assert.match(source, /interaction\.targetFocus = modeState\.name === 'explore' \? 1 : 0/);
  assert.match(source, /selectHexagram\(code, point\)/);
  assert.match(source, /new THREE\.RingGeometry\(1\.24, 1\.29/);
  assert.match(source, /new THREE\.LineSegments\(selectionRayGeometry/);
  assert.match(source, /new THREE\.Points\(selectionBurstGeometry/);
  assert.match(source, /const burstCount = lowPower \? 10 : 20/);
  assert.match(source, /selectionBurst\.visible = false/);
  assert.match(source, /selectionGroup\.position\.copy\(selectionAnchor\)/);
  assert.match(source, /selection\.pulse = motionPreference\.matches \? 0 : 1/);
  assert.match(source, /createSelectionWaveMaterial/);
  assert.match(source, /new THREE\.Line\(tetherGeometry/);
  assert.match(source, /writeQuadraticArc\(tetherPositions/);
  assert.match(source, /clearSelection\(\)/);
  assert.match(source, /object\.geometry\?\.dispose/);
  assert.match(source, /renderer\.dispose\(\)/);
});
