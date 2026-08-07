// 卦序转盘纯逻辑：先确定抽中索引，再计算固定顶部指针下的终止角度。

function assertCount(count) {
  if (!Number.isInteger(count) || count < 2) throw new RangeError('转盘项目数必须是不小于 2 的整数');
}

function randomValue(random) {
  const value = random();
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new RangeError('随机函数必须返回 [0, 1) 范围内的数');
  }
  return value;
}

export function normalizeDegrees(value) {
  if (!Number.isFinite(value)) throw new TypeError('角度必须是有限数值');
  return ((value % 360) + 360) % 360;
}

export function selectedIndexFromRotation(rotation, count = 64) {
  assertCount(count);
  const step = 360 / count;
  return Math.round(normalizeDegrees(-rotation) / step) % count;
}

export function createWheelSpin({
  currentRotation = 0,
  count = 64,
  random = Math.random,
  minTurns = 5,
  maxTurns = 8,
} = {}) {
  assertCount(count);
  if (!Number.isFinite(currentRotation)) throw new TypeError('当前角度必须是有限数值');
  if (typeof random !== 'function') throw new TypeError('random 必须是函数');
  if (!Number.isInteger(minTurns) || !Number.isInteger(maxTurns) || minTurns < 1 || maxTurns < minTurns) {
    throw new RangeError('旋转圈数范围无效');
  }

  const selectedIndex = Math.floor(randomValue(random) * count);
  const turns = minTurns + Math.floor(randomValue(random) * (maxTurns - minTurns + 1));
  const step = 360 / count;
  const targetNormalized = normalizeDegrees(-selectedIndex * step);
  const startNormalized = normalizeDegrees(currentRotation);
  const alignment = normalizeDegrees(targetNormalized - startNormalized);
  const deltaRotation = turns * 360 + alignment;
  const targetRotation = currentRotation + deltaRotation;

  return {
    selectedIndex,
    startRotation: currentRotation,
    targetRotation,
    deltaRotation,
    turns,
  };
}
