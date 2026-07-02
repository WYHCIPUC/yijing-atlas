// 复习引擎：SM-2 简化版间隔算法 + localStorage 持久化。
// 每个卦一张复习卡，按掌握度安排到期时间。

const STORAGE_KEY = 'yijing-review-cards';
const DAY_MS = 86400000;

// SM-2 简化间隔序列（天）
const INTERVALS = [0, 1, 2, 4, 7, 15, 30, 60];

export function loadReviewCards() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch (e) {
    console.warn('复习数据加载失败', e);
    return {};
  }
}

function saveReviewCards(cards) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
  } catch (e) {
    console.warn('复习数据保存失败', e);
  }
}

export function getOrCreateCard(cards, hexCode) {
  if (!cards[hexCode]) {
    cards[hexCode] = {
      code: hexCode, stage: 0, due: Date.now(),
      lapses: 0, reps: 0, lastReview: 0,
    };
  }
  return cards[hexCode];
}

export function reviewCard(card, rating) {
  card.reps++;
  card.lastReview = Date.now();
  if (rating === 0) {
    card.stage = 1;
    card.lapses++;
    card.due = Date.now() + INTERVALS[1] * DAY_MS;
  } else if (rating === 1) {
    card.stage = Math.max(1, card.stage);
    const idx = Math.min(card.stage, INTERVALS.length - 1);
    card.due = Date.now() + INTERVALS[idx] * DAY_MS;
  } else {
    card.stage = Math.min(card.stage + 1, INTERVALS.length - 1);
    card.due = Date.now() + INTERVALS[card.stage] * DAY_MS;
  }
  return card;
}

export function getDueCards(cards) {
  const now = Date.now();
  return Object.values(cards).filter(c => c.due <= now).map(c => c.code);
}

export function getDueCount(cards) {
  return getDueCards(cards).length;
}

export function initAllCards(cards, hexCodes) {
  let changed = false;
  for (const code of hexCodes) {
    if (!cards[code]) { getOrCreateCard(cards, code); changed = true; }
  }
  if (changed) saveReviewCards(cards);
  return cards;
}

export function saveReview(cards, code, rating) {
  const card = getOrCreateCard(cards, code);
  reviewCard(card, rating);
  saveReviewCards(cards);
  return card;
}

export function getMastery(card) {
  if (!card) return 0;
  return Math.min(1, card.stage / (INTERVALS.length - 1));
}
