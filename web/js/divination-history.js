import { readJson, removeStored, writeJson } from './storage.js';

const HISTORY_KEY = 'yijing-divination-history-v1';
const MAX_HISTORY = 50;
const CODE_PATTERN = /^[01]{6}$/;

function isHistoryItem(item) {
  return item && typeof item.id === 'string' && typeof item.createdAt === 'string' &&
    ['coin', 'meihua'].includes(item.type) && CODE_PATTERN.test(item.primaryCode) &&
    (item.changedCode === null || CODE_PATTERN.test(item.changedCode));
}

function isHistory(value) {
  return Array.isArray(value) && value.every(isHistoryItem);
}

export function loadDivinationHistory(storage) {
  return readJson(HISTORY_KEY, [], isHistory, storage).slice(0, MAX_HISTORY);
}

export function addDivinationHistory(entry, storage, now = new Date()) {
  const createdAt = now.toISOString();
  const existing = loadDivinationHistory(storage);
  const item = {
    id: `${createdAt}-${existing.length}`,
    createdAt,
    type: entry.type === 'meihua' ? 'meihua' : 'coin',
    primaryCode: entry.primaryCode,
    changedCode: CODE_PATTERN.test(entry.changedCode) ? entry.changedCode : null,
    changingPos: Number.isInteger(entry.changingPos) ? entry.changingPos : null,
    summary: typeof entry.summary === 'string' ? entry.summary.slice(0, 120) : '',
  };
  if (!isHistoryItem(item)) return { items: existing, saved: false };
  const items = [item, ...existing].slice(0, MAX_HISTORY);
  return { items, saved: writeJson(HISTORY_KEY, items, storage).ok };
}

export function clearDivinationHistory(storage) {
  return removeStored(HISTORY_KEY, storage).ok;
}

export function getDivinationHistoryKey() {
  return HISTORY_KEY;
}

