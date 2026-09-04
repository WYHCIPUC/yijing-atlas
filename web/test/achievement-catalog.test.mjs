import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ABILITY_DIMENSIONS,
  ACHIEVEMENT_CATALOG,
  GROWTH_RANKS,
  getAchievementById,
} from '../js/achievement-catalog.js';

test('首发目录包含十二枚可解释成就且标识唯一', () => {
  assert.equal(ACHIEVEMENT_CATALOG.length, 12);
  assert.equal(new Set(ACHIEVEMENT_CATALOG.map((item) => item.id)).size, 12);
  assert.ok(ACHIEVEMENT_CATALOG.every((item) =>
    item.name && item.condition && item.reward && Number.isFinite(item.target) && Object.isFrozen(item),
  ));
  assert.equal(getAchievementById('complete-atlas').name, '六十四象');
  assert.equal(getAchievementById('missing'), null);
});

test('能力维度和五阶三状态形成完整成长契约', () => {
  assert.deepEqual(ABILITY_DIMENSIONS.map((item) => item.label), ['识象', '读经', '观变', '明辨', '表达']);
  assert.equal(GROWTH_RANKS.length, 15);
  assert.deepEqual([...new Set(GROWTH_RANKS.map((item) => item.rank))], ['蒙学', '习经', '研传', '明辨', '通用']);
  assert.deepEqual([...new Set(GROWTH_RANKS.map((item) => item.stage))], ['初识', '渐悟', '成章']);
  assert.ok(GROWTH_RANKS.every(Object.isFrozen));
});
