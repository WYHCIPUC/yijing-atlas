import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addReviewCard,
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

test('只有明确加入的卦象才进入新手复习池', () => {
  const added = addReviewCard('111111');
  assert.equal(added.added, true);
  assert.equal(added.saved, true);
  assert.equal(Number.isFinite(added.card.introducedAt), true);
  assert.deepEqual(Object.keys(loadReviewCards()), ['111111']);
  assert.equal(addReviewCard('111111').added, false);
  assert.deepEqual(addReviewCard('bad'), { added: false, saved: false });
});

test('旧版本批量生成但从未复习的卡片不会继续制造 64 项待办', () => {
  globalThis.localStorage.setItem('yijing-review-cards', JSON.stringify({
    '111111': { code: '111111', stage: 0, due: 0, lapses: 0, reps: 0, lastReview: 0 },
    '000000': { code: '000000', stage: 1, due: 0, lapses: 0, reps: 1, lastReview: 1 },
  }));
  assert.deepEqual(Object.keys(loadReviewCards()), ['000000']);
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

test('损坏存储读取兼容空列表，保存失败不推进原内存卡', () => {
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
    const before = structuredClone(cards);
    const result = saveReview(cards, '111111', 1);
    assert.equal(result.card.stage, 1);
    assert.equal(result.saved, false);
    assert.deepEqual(cards, before);
  } finally {
    console.warn = originalWarn;
  }
});

test('非法自评不按记得处理且不修改卡', () => {
  for (const rating of [-1, 3, 0.5, '2', null, undefined, NaN]) {
    const card = { code: '111111', stage: 2, due: 10, lapses: 0, reps: 1, lastReview: 1 };
    const before = structuredClone(card);
    assert.throws(() => reviewCard(card, rating), /评分/);
    assert.deepEqual(card, before);
  }
});

test('一次调度复用显式时间并保留原间隔序列', () => {
  const at = Date.parse('2026-10-25T01:00:00Z');
  for (const [rating, stage, days, lapses] of [[0, 1, 1, 1], [1, 4, 7, 0], [2, 5, 15, 0]]) {
    const card = { code: '111111', stage: 4, due: 10, lapses: 0, reps: 3, lastReview: 1 };
    reviewCard(card, rating, at);
    assert.deepEqual([card.stage, card.due, card.lapses, card.reps, card.lastReview], [stage, at + days * 86400000, lapses, 4, at]);
  }
});

test('保存失败不修改已有卡或凭空加入内存新卡', () => {
  for (const existing of [true, false]) {
    const cards = existing ? { '111111': { code: '111111', stage: 1, due: 10, lapses: 0, reps: 1, lastReview: 1 } } : {};
    const before = structuredClone(cards);
    const storage = { getItem: () => JSON.stringify(before), setItem: () => { throw new Error('quota'); } };
    const result = saveReview(cards, '111111', 2, storage);
    assert.equal(result.saved, false);
    assert.deepEqual(cards, before);
  }
});

test('保存当前卡合并最新其他卡，冲突不覆盖', () => {
  const cards = { '111111': { code: '111111', stage: 1, due: 10, lapses: 0, reps: 1, lastReview: 1 } };
  const other = { code: '000000', stage: 3, due: 20, lapses: 0, reps: 2, lastReview: 2 };
  localStorage.setItem('yijing-review-cards', JSON.stringify({ ...cards, '000000': other }));
  assert.equal(saveReview(cards, '111111', 2).saved, true);
  assert.deepEqual(loadReviewCards()['000000'], other);
  const stale = { '111111': { ...cards['111111'], reps: 0 } };
  const before = localStorage.getItem('yijing-review-cards');
  assert.equal(saveReview(stale, '111111', 2).saved, false);
  assert.equal(localStorage.getItem('yijing-review-cards'), before);
});

test('结构不完整的复习数据会回退为空', () => {
  globalThis.localStorage = createStorage();
  globalThis.localStorage.setItem('yijing-review-cards', JSON.stringify({
    '111111': { code: '111111', stage: 99 },
  }));
  assert.deepEqual(loadReviewCards(), {});
});

test('异常时间或计数溢出不会部分推进卡', () => {
  const cases = [
    [{ code: '111111', stage: 2, due: 0, lapses: 0, reps: 1, lastReview: 0 }, NaN, 2],
    [{ code: '111111', stage: 7, due: 0, lapses: 0, reps: 1, lastReview: 0 }, 8640000000000000, 2],
    [{ code: '111111', stage: 2, due: 0, lapses: 0, reps: Number.MAX_SAFE_INTEGER, lastReview: 0 }, Date.now(), 2],
    [{ code: '111111', stage: 2, due: 0, lapses: Number.MAX_SAFE_INTEGER, reps: 1, lastReview: 0 }, Date.now(), 0],
  ];
  for (const [card, now, rating] of cases) {
    const before = structuredClone(card);
    assert.throws(() => reviewCard(card, rating, now));
    assert.deepEqual(card, before);
  }
});

test('存储损坏时即使写入可用也不从空集合覆盖', () => {
  const cards = { '111111': { code: '111111', stage: 1, due: 1, lapses: 0, reps: 1, lastReview: 1 } };
  localStorage.setItem('yijing-review-cards', '{broken');
  const before = structuredClone(cards);
  assert.equal(saveReview(cards, '111111', 2).errorCode, 'card-store-invalid');
  assert.equal(localStorage.getItem('yijing-review-cards'), '{broken');
  assert.deepEqual(cards, before);
});
