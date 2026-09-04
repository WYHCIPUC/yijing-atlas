import { readJson, removeStored, writeJson } from './storage.js';

const HISTORY_KEY = 'yijing-divination-history-v2';
const LEGACY_HISTORY_KEY = 'yijing-divination-history-v1';
const MAX_HISTORY = 50;
const CODE_PATTERN = /^[01]{6}$/;
const INTERPRETATION_VERSION = 'reading-explanation-v1';

function isBaseItem(item) {
  return item && typeof item.id === 'string' && typeof item.createdAt === 'string' &&
    ['coin', 'meihua'].includes(item.type) && CODE_PATTERN.test(item.primaryCode) &&
    (item.changedCode === null || CODE_PATTERN.test(item.changedCode));
}

function isLegacyItem(item) {
  return isBaseItem(item) && !Object.hasOwn(item, 'version');
}

function isYao(item) {
  return item && [0, 1].includes(item.value) && typeof item.isYang === 'boolean' &&
    typeof item.changing === 'boolean' && typeof item.name === 'string' &&
    Array.isArray(item.coins) && item.coins.length === 3 && item.coins.every((coin) => coin === 2 || coin === 3);
}

function isHistoryItem(item) {
  if (!isBaseItem(item) || item.version !== 2 || !Array.isArray(item.changingPositions)) return false;
  if (!item.changingPositions.every((position) => Number.isInteger(position) && position >= 1 && position <= 6)) return false;
  if (item.type === 'coin') return Array.isArray(item.yaos) && item.yaos.length === 6 && item.yaos.every(isYao);
  return item.cast && Number.isInteger(item.cast.changingPos) && item.cast.changingPos >= 1 && item.cast.changingPos <= 6;
}

function isHistory(value) {
  return Array.isArray(value) && value.every(isHistoryItem);
}

function isLegacyHistory(value) {
  return Array.isArray(value) && value.every(isLegacyItem);
}

function text(value, max = 1000) {
  return typeof value === 'string' ? value.slice(0, max) : '';
}

function normalizeYaos(yaos) {
  if (!Array.isArray(yaos) || yaos.length !== 6) return [];
  return yaos.map((yao) => ({
    value: yao?.isYang ? 1 : 0,
    isYang: Boolean(yao?.isYang),
    changing: Boolean(yao?.changing),
    name: text(yao?.name, 8),
    coins: Array.isArray(yao?.coins) ? yao.coins.map(Number).slice(0, 3) : [],
  })).filter(isYao);
}

function normalizeCast(cast) {
  if (!cast || !Number.isInteger(cast.changingPos)) return null;
  return {
    method: cast.method === 'time' ? 'time' : 'number',
    source: text(cast.source, 120),
    upperTrigram: text(cast.upperTrigram, 3),
    lowerTrigram: text(cast.lowerTrigram, 3),
    upperName: text(cast.upperName, 8),
    lowerName: text(cast.lowerName, 8),
    primaryCode: text(cast.primaryCode, 6),
    changedCode: text(cast.changedCode, 6),
    changingPos: cast.changingPos,
  };
}

function normalizeInterpretation(value) {
  if (!value || typeof value !== 'object') return null;
  const normalizeFocus = (item) => ({
    source: text(item?.source, 160), quote: text(item?.quote, 1000), plain: text(item?.plain, 1600),
    xiang: text(item?.xiang, 1000), xiangSource: text(item?.xiangSource, 160),
    priority: item?.priority === 'secondary' ? 'secondary' : 'primary',
  });
  return {
    method: text(value.method, 40), basis: text(value.basis, 1800), terminology: text(value.terminology, 1800),
    situation: text(value.situation, 1800), keyPoint: text(value.keyPoint, 2400), transition: text(value.transition, 1800),
    classic: value.classic ? normalizeFocus(value.classic) : null,
    analogy: text(value.analogy, 2400),
    prompts: Array.isArray(value.prompts) ? value.prompts.map((item) => text(item, 500)).slice(0, 8) : [],
    focus: Array.isArray(value.focus) ? value.focus.map(normalizeFocus).slice(0, 8) : [],
    caveat: text(value.caveat, 1800),
  };
}

function migrateLegacyItem(item) {
  return {
    ...item,
    version: 1,
    legacySummaryOnly: true,
    changingPositions: Number.isInteger(item.changingPos) ? [item.changingPos] : [],
    privacy: { questionStored: false, noteStored: false },
  };
}

export function loadDivinationHistory(storage) {
  const current = readJson(HISTORY_KEY, [], isHistory, storage);
  const legacy = readJson(LEGACY_HISTORY_KEY, [], isLegacyHistory, storage).map(migrateLegacyItem);
  return [...current, ...legacy]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, MAX_HISTORY);
}

export function addDivinationHistory(entry, storage, now = new Date()) {
  const createdAt = now.toISOString();
  const existing = readJson(HISTORY_KEY, [], isHistory, storage);
  const yaos = normalizeYaos(entry.yaos);
  const cast = normalizeCast(entry.cast);
  const changingPositions = entry.type === 'coin'
    ? yaos.flatMap((yao, index) => yao.changing ? [index + 1] : [])
    : (Number.isInteger(cast?.changingPos) ? [cast.changingPos] : []);
  const item = {
    version: 2,
    id: `${createdAt}-${existing.length}`,
    createdAt,
    type: entry.type === 'meihua' ? 'meihua' : 'coin',
    method: entry.type === 'meihua' ? text(cast?.method, 12) : 'three-coins',
    primaryCode: entry.primaryCode,
    changedCode: CODE_PATTERN.test(entry.changedCode) ? entry.changedCode : null,
    yaos,
    cast,
    changingPositions,
    readingPolicyId: entry.type === 'coin' ? text(entry.readingPolicyId, 80) : null,
    interpretationVersion: INTERPRETATION_VERSION,
    interpretation: normalizeInterpretation(entry.interpretation),
    privacy: { questionStored: false, noteStored: false },
    summary: text(entry.summary, 120),
  };
  if (!isHistoryItem(item)) return { items: existing, saved: false };
  const items = [item, ...existing].slice(0, MAX_HISTORY);
  return { items, saved: writeJson(HISTORY_KEY, items, storage).ok };
}

export function clearDivinationHistory(storage) {
  const current = removeStored(HISTORY_KEY, storage).ok;
  const legacy = removeStored(LEGACY_HISTORY_KEY, storage).ok;
  return current && legacy;
}

export function getDivinationHistoryKey() {
  return HISTORY_KEY;
}

export function getLegacyDivinationHistoryKey() {
  return LEGACY_HISTORY_KEY;
}
