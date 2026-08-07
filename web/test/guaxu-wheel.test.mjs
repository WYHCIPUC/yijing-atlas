import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createWheelSpin,
  normalizeDegrees,
  selectedIndexFromRotation,
} from '../js/guaxu-wheel.js';

function sequence(...values) {
  let index = 0;
  return () => values[index++];
}

test('角度归一化并从顶部指针反推卦序索引', () => {
  assert.equal(normalizeDegrees(370), 10);
  assert.equal(normalizeDegrees(-10), 350);
  assert.equal(selectedIndexFromRotation(0), 0);
  assert.equal(selectedIndexFromRotation(-360 / 64), 1);
  assert.equal(selectedIndexFromRotation(360 / 64), 63);
});

test('随机边界可抽中首卦与末卦并精确停在指针下', () => {
  const first = createWheelSpin({ random: sequence(0, 0), minTurns: 5, maxTurns: 8 });
  assert.equal(first.selectedIndex, 0);
  assert.equal(first.turns, 5);
  assert.equal(first.deltaRotation, 1800);
  assert.equal(selectedIndexFromRotation(first.targetRotation), 0);

  const last = createWheelSpin({ random: sequence(0.999999, 0.999999), minTurns: 5, maxTurns: 8 });
  assert.equal(last.selectedIndex, 63);
  assert.equal(last.turns, 8);
  assert.equal(selectedIndexFromRotation(last.targetRotation), 63);
});

test('连续抽取从当前角度向前旋转且保持映射稳定', () => {
  const first = createWheelSpin({ currentRotation: -725, count: 8, random: sequence(0.5, 0) });
  const second = createWheelSpin({ currentRotation: normalizeDegrees(first.targetRotation), count: 8, random: sequence(0.25, 0) });
  assert.ok(first.deltaRotation >= 5 * 360);
  assert.ok(second.deltaRotation >= 5 * 360);
  assert.equal(selectedIndexFromRotation(first.targetRotation, 8), 4);
  assert.equal(selectedIndexFromRotation(second.targetRotation, 8), 2);
});

test('全部六十四个索引都能映射到固定指针', () => {
  for (let index = 0; index < 64; index += 1) {
    const rotation = -index * (360 / 64);
    assert.equal(selectedIndexFromRotation(rotation), index);
  }
});

test('非法角度、数量、随机值和圈数会被拒绝', () => {
  assert.throws(() => normalizeDegrees(Number.NaN), /角度/);
  assert.throws(() => selectedIndexFromRotation(0, 1), /项目数/);
  assert.throws(() => createWheelSpin({ currentRotation: Infinity }), /当前角度/);
  assert.throws(() => createWheelSpin({ random: null }), /random/);
  assert.throws(() => createWheelSpin({ random: () => 1 }), /随机函数/);
  assert.throws(() => createWheelSpin({ minTurns: 0, maxTurns: 1 }), /圈数/);
  assert.throws(() => createWheelSpin({ minTurns: 8, maxTurns: 5 }), /圈数/);
});
