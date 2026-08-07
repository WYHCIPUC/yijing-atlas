import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getDueCount,
  getDueCards,
  getMastery,
  getOrCreateCard,
  initAllCards,
  loadReviewCards,
  reviewCard,
  saveReview,
} from '../js/review-engine.js';

function createStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

test.beforeEach(() => { globalThis.localStorage = createStorage(); });

test('新卡片立即到期并可持久化', () => {
  const cards = initAllCards({}, ['111111', '000000']);
  assert.deepEqual(new Set(getDueCards(cards)), new Set(['111111', '000000']));
  assert.deepEqual(Object.keys(loadReviewCards()).sort(), ['000000', '111111']);
  assert.equal(getDueCount(cards), 2);
});

test('记得会提升阶段，忘记会记录失误并回到一天间隔', () => {
  const card = getOrCreateCard({}, '111111');
  const before = Date.now();
  reviewCard(card, 2);
  assert.equal(card.stage, 1);
  assert.ok(card.due >= before + 86400000);
  assert.equal(getMastery(card), 1 / 7);

  reviewCard(card, 0);
  assert.equal(card.stage, 1);
  assert.equal(card.lapses, 1);
  assert.equal(card.reps, 2);
});

test('模糊不会把已学习卡片降为未学习', () => {
  const card = { code: '111111', stage: 4, due: 0, lapses: 0, reps: 3, lastReview: 0 };
  reviewCard(card, 1);
  assert.equal(card.stage, 4);
  assert.ok(card.due > Date.now());
});

test('saveReview 创建并保存卡片', () => {
  const cards = {};
  const saved = saveReview(cards, '101010', 2);
  assert.equal(saved.card.code, '101010');
  assert.equal(saved.saved, true);
  assert.equal(loadReviewCards()['101010'].stage, 1);
});

test('阶段达到上限后保持封顶', () => {
  const card = { code: '111111', stage: 7, due: 0, lapses: 0, reps: 8, lastReview: 0 };
  reviewCard(card, 2);
  assert.equal(card.stage, 7);
  assert.equal(getMastery(card), 1);
});

test('损坏存储回退为空，写入失败不影响内存调度', () => {
  const originalWarn = console.warn;
  console.warn = () => {};
  globalThis.localStorage = {
    getItem: () => '{broken',
    setItem: () => { throw new Error('quota'); },
    removeItem: () => {},
  };
  try {
    assert.deepEqual(loadReviewCards(), {});
    const cards = initAllCards({}, ['111111']);
    assert.equal(cards['111111'].code, '111111');
    const result = saveReview(cards, '111111', 1);
    assert.equal(result.card.stage, 1);
    assert.equal(result.saved, false);
  } finally {
    console.warn = originalWarn;
  }
});

test('结构不完整的复习数据会回退为空', () => {
  globalThis.localStorage = createStorage();
  globalThis.localStorage.setItem('yijing-review-cards', JSON.stringify({
    '111111': { code: '111111', stage: 99 },
  }));
  assert.deepEqual(loadReviewCards(), {});
});
