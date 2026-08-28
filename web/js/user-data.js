const FORMAT = 'yijing-atlas-user-data';
const VERSION = 1;
const MAX_IMPORT_BYTES = 1024 * 1024;

export const USER_DATA_KEYS = [
  'yijing-review-cards',
  'yijing-quiz-wrong',
  'yijing-quiz-stats',
  'yijing.study.v1',
  'yijing-notes',
  'yijing-activity-v1',
  'yijing-learning-record-v2',
  'yijing-learning-review-config-v1',
  'yijing-divination-history-v1',
  'yijing-divination-history-v2',
];

function getStorage(storage) {
  if (storage) return storage;
  if (typeof localStorage === 'undefined') throw new Error('当前环境不支持本地存储');
  return localStorage;
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validateSnapshot(snapshot) {
  if (snapshot?.format !== FORMAT || snapshot?.version !== VERSION || !isPlainObject(snapshot.data)) {
    throw new Error('备份格式或版本不受支持');
  }
  const expected = {
    'yijing-review-cards': isPlainObject,
    'yijing-quiz-wrong': Array.isArray,
    'yijing-quiz-stats': isPlainObject,
    'yijing.study.v1': isPlainObject,
    'yijing-notes': isPlainObject,
    'yijing-activity-v1': isPlainObject,
    'yijing-learning-record-v2': isPlainObject,
    'yijing-learning-review-config-v1': isPlainObject,
    'yijing-divination-history-v1': Array.isArray,
    'yijing-divination-history-v2': Array.isArray,
  };
  for (const [key, check] of Object.entries(expected)) {
    if (!Object.hasOwn(snapshot.data, key) || snapshot.data[key] === null) continue;
    if (!check(snapshot.data[key])) throw new Error(`备份中的 ${key} 数据类型无效`);
  }
  return snapshot;
}

export function exportUserData(storage) {
  const target = getStorage(storage);
  const data = {};
  for (const key of USER_DATA_KEYS) {
    const raw = target.getItem(key);
    if (raw === null) continue;
    try {
      data[key] = JSON.parse(raw);
    } catch {
      data[key] = null;
    }
  }
  return {
    format: FORMAT,
    version: VERSION,
    exportedAt: new Date().toISOString(),
    data,
  };
}

export function parseUserData(text) {
  if (typeof text !== 'string' || new TextEncoder().encode(text).length > MAX_IMPORT_BYTES) {
    throw new Error('备份文件无效或超过 1 MB');
  }
  let snapshot;
  try {
    snapshot = JSON.parse(text);
  } catch {
    throw new Error('备份文件不是有效的 JSON');
  }
  return validateSnapshot(snapshot);
}

export function importUserData(snapshot, storage) {
  validateSnapshot(snapshot);
  const target = getStorage(storage);
  const previous = new Map(USER_DATA_KEYS.map((key) => [key, target.getItem(key)]));
  try {
    for (const key of USER_DATA_KEYS) {
      if (!Object.hasOwn(snapshot.data, key)) continue;
      const value = snapshot.data[key];
      if (value === null) target.removeItem(key);
      else target.setItem(key, JSON.stringify(value));
    }
  } catch (error) {
    for (const [key, raw] of previous) {
      try {
        if (raw === null) target.removeItem(key);
        else target.setItem(key, raw);
      } catch {}
    }
    throw new Error(`导入失败：${error instanceof Error ? error.message : '本地存储不可用'}`);
  }
}

export function downloadUserData(storage) {
  const snapshot = exportUserData(storage);
  const blob = new Blob([`${JSON.stringify(snapshot, null, 2)}\n`], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `yijing-atlas-backup-${snapshot.exportedAt.slice(0, 10)}.json`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
