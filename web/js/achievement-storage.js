import {
  applyProgressEvent,
  isAchievementState,
  migrateAchievementState,
} from './achievement-engine.js';
import { writeJson } from './storage.js';

const STORAGE_KEY = 'yijing.achievements.v1';
const EXPORT_FORMAT = 'yijing-achievements';
const EXPORT_VERSION = 1;
const MAX_IMPORT_BYTES = 512 * 1024;

function resolveStorage(storage) {
  if (storage) return storage;
  if (typeof localStorage === 'undefined') return null;
  return localStorage;
}

export function getAchievementStorageKey() {
  return STORAGE_KEY;
}

export function loadAchievementState(storage, options = {}) {
  const target = resolveStorage(storage);
  if (!target) return migrateAchievementState(null, options);
  try {
    const raw = target.getItem(STORAGE_KEY);
    if (raw === null) return migrateAchievementState(null, options);
    return migrateAchievementState(JSON.parse(raw), options);
  } catch {
    return migrateAchievementState(null, options);
  }
}

export function saveAchievementState(state, storage) {
  if (!isAchievementState(state)) return { ok: false, error: new TypeError('成就状态格式无效') };
  return writeJson(STORAGE_KEY, state, storage);
}

export function processAchievementEvent(event, options = {}) {
  const state = loadAchievementState(options.storage, options);
  const result = applyProgressEvent(state, event, options);
  const saved = result.accepted ? saveAchievementState(result.state, options.storage) : { ok: true, error: null };
  return { ...result, saved: saved.ok, error: saved.error };
}

function validateSnapshot(snapshot) {
  if (snapshot?.format !== EXPORT_FORMAT || snapshot?.version !== EXPORT_VERSION ||
      !isAchievementState(snapshot.state)) throw new Error('成就备份格式或版本不受支持');
  return snapshot;
}

export function exportAchievementData(storage, options = {}) {
  const now = options.now || (() => new Date());
  return {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: new Date(now()).toISOString(),
    state: loadAchievementState(storage, options),
  };
}

export function parseAchievementData(text) {
  if (typeof text !== 'string' || new TextEncoder().encode(text).length > MAX_IMPORT_BYTES) {
    throw new Error('成就备份无效或超过 512 KB');
  }
  let snapshot;
  try {
    snapshot = JSON.parse(text);
  } catch {
    throw new Error('成就备份不是有效的 JSON');
  }
  return validateSnapshot(snapshot);
}

export function importAchievementData(snapshot, storage) {
  validateSnapshot(snapshot);
  const result = saveAchievementState(snapshot.state, storage);
  if (!result.ok) throw new Error(`成就备份导入失败：${result.error?.message || '本地存储不可用'}`);
  return loadAchievementState(storage);
}
