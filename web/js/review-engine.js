// 复习引擎：SM-2 简化版间隔算法 + localStorage 持久化。
// 每个卦一张复习卡，按掌握度安排到期时间。
import { isPlainObject, readJson, writeJson } from './storage.js';

const STORAGE_KEY = 'yijing-review-cards';
const DAY_MS = 86400000;

// SM-2 简化间隔序列（天）
const INTERVALS = [0, 1, 2, 4, 7, 15, 30, 60];

function isReviewCard(card, code) {
  return isPlainObject(card) && card.code === code && /^[01]{6}$/.test(code) &&
    Number.isInteger(card.stage) && card.stage >= 0 && card.stage < INTERVALS.length &&
    Number.isFinite(card.due) && Number.isInteger(card.lapses) && card.lapses >= 0 &&
    Number.isInteger(card.reps) && card.reps >= 0 && Number.isFinite(card.lastReview) &&
    (card.introducedAt === undefined || Number.isFinite(card.introducedAt));
}

function isReviewCards(value) {
  return isPlainObject(value) && Object.entries(value).every(([code, card]) => isReviewCard(card, code));
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

export function initAllCards(cards, hexCodes, storage) {
  let changed = false;
  for (const code of hexCodes) {
    if (!cards[code]) { getOrCreateCard(cards, code); changed = true; }
  }
  if (changed) saveReviewCards(cards, storage);
  return cards;
}

export function saveReview(cards, code, rating, storage) {
  const card = getOrCreateCard(cards, code);
  reviewCard(card, rating);
  return { card, saved: saveReviewCards(cards, storage) };
}

export function getMastery(card) {
  if (!card) return 0;
  return Math.min(1, card.stage / (INTERVALS.length - 1));
}
