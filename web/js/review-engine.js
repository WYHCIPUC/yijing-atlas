// 复习引擎：SM-2 简化版间隔算法 + localStorage 持久化。
// 每个卦一张复习卡，按掌握度安排到期时间。
import { isPlainObject, readJson, writeJson } from './storage.js';

const STORAGE_KEY = 'yijing-review-cards';
const DAY_MS = 86400000;

// SM-2 简化间隔序列（天）
const INTERVALS = [0, 1, 2, 4, 7, 15, 30, 60];

export function isReviewCard(card, code = card?.code) {
  return isPlainObject(card) && card.code === code && /^[01]{6}$/.test(code) &&
    Number.isInteger(card.stage) && card.stage >= 0 && card.stage < INTERVALS.length &&
    Number.isFinite(card.due) && Number.isInteger(card.lapses) && card.lapses >= 0 &&
    Number.isInteger(card.reps) && card.reps >= 0 && Number.isFinite(card.lastReview) &&
    (card.introducedAt === undefined || Number.isFinite(card.introducedAt));
}

export function isReviewCards(value) {
  if (!isPlainObject(value)) return false;
  return Object.entries(value).every(([code, card]) => isReviewCard(card, code));
}

export function loadReviewCards(storage) {
  const cards = readJson(STORAGE_KEY, {}, isReviewCards, storage);
  return Object.fromEntries(Object.entries(cards).filter(([, card]) =>
    card.reps > 0 || Number.isFinite(card.introducedAt),
  ));
}

function saveReviewCards(cards, storage) {
  return writeJson(STORAGE_KEY, cards, storage).ok;
}

export function getOrCreateCard(cards, hexCode) {
  if (!cards[hexCode]) {
    const now = Date.now();
    cards[hexCode] = {
      code: hexCode, stage: 0, due: now, introducedAt: now,
      lapses: 0, reps: 0, lastReview: 0,
    };
  }
  return cards[hexCode];
}

export function addReviewCard(code, storage) {
  if (!/^[01]{6}$/.test(code || '')) return { added: false, saved: false };
  const cards = loadReviewCards(storage);
  const added = !cards[code];
  const card = getOrCreateCard(cards, code);
  return { card, added, saved: added ? saveReviewCards(cards, storage) : true };
}

export function reviewCard(card, rating, now = Date.now()) {
  if (![0, 1, 2].includes(rating)) throw new TypeError('自评评分只能为 0、1 或 2');
  if (!isReviewCard(card) || !Number.isSafeInteger(card.reps) || card.reps >= Number.MAX_SAFE_INTEGER ||
      !Number.isSafeInteger(card.lapses) || (rating === 0 && card.lapses >= Number.MAX_SAFE_INTEGER)) {
    throw new TypeError('复习卡格式或计数无效');
  }
  if (!Number.isFinite(now) || !Number.isFinite(new Date(now).getTime())) throw new TypeError('复习时间无效');
  const next = { ...card, reps: card.reps + 1, lastReview: now };
  if (rating === 0) {
    next.stage = 1;
    next.lapses++;
  } else if (rating === 1) {
    next.stage = Math.max(1, card.stage);
  } else {
    next.stage = Math.min(card.stage + 1, INTERVALS.length - 1);
  }
  next.due = now + INTERVALS[next.stage] * DAY_MS;
  if (!Number.isFinite(new Date(next.due).getTime())) throw new TypeError('下次复习时间超出范围');
  return Object.assign(card, next);
}

function sameSnapshot(left, right) {
  if (left === right) return true;
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object') return false;
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length && keys.every(key =>
    Object.hasOwn(right, key) && sameSnapshot(left[key], right[key]));
}

// 核对本卡原快照并合并最新集合；不以读取失败后的空集合覆盖已有记录。
export function commitReviewCard(previousCard, nextCard, storage) {
  const failure = errorCode => ({ card: nextCard ? structuredClone(nextCard) : null, saved: false, errorCode });
  if (!isReviewCard(nextCard) || (previousCard !== null &&
      (!isReviewCard(previousCard) || previousCard.code !== nextCard.code))) return failure('card-invalid');
  let target, raw;
  try {
    target = storage || globalThis.localStorage;
    if (!target) return failure('storage-unavailable');
    raw = target.getItem(STORAGE_KEY);
  } catch { return failure('card-read-failed'); }
  let cards;
  try { cards = raw === null ? {} : JSON.parse(raw); } catch { return failure('card-store-invalid'); }
  if (!isReviewCards(cards)) return failure('card-store-invalid');
  const current = Object.hasOwn(cards, nextCard.code) ? cards[nextCard.code] : null;
  if (previousCard !== null && current === null) return failure('card-missing');
  if (!sameSnapshot(current, previousCard)) return failure('card-conflict');
  const merged = { ...cards, [nextCard.code]: structuredClone(nextCard) };
  if (!saveReviewCards(merged, target)) return failure('card-write-failed');
  return { card: structuredClone(nextCard), saved: true, errorCode: null };
}

export function getDueCards(cards) {
  const now = Date.now();
  return Object.values(cards).filter(c => c.due <= now).map(c => c.code);
}

export function getDueCount(cards) {
  return getDueCards(cards).length;
}

export function initAllCards(cards, hexCodes, storage) {
  let changed = false;
  for (const code of hexCodes) {
    if (!cards[code]) { getOrCreateCard(cards, code); changed = true; }
  }
  if (changed) saveReviewCards(cards, storage);
  return cards;
}

export function saveReview(cards, code, rating, storage) {
  if (!isPlainObject(cards) || !/^[01]{6}$/.test(code || '') || ![0, 1, 2].includes(rating)) {
    return { card: null, saved: false, errorCode: 'invalid-rating' };
  }
  const previous = cards[code] ? structuredClone(cards[code]) : null;
  const card = previous ? structuredClone(previous) : getOrCreateCard({}, code);
  try { reviewCard(card, rating); } catch { return { card, saved: false, errorCode: 'card-invalid' }; }
  const result = commitReviewCard(previous, card, storage);
  if (result.saved) cards[code] = structuredClone(card);
  return result;
}

export function getMastery(card) {
  if (!card) return 0;
  return Math.min(1, card.stage / (INTERVALS.length - 1));
}
