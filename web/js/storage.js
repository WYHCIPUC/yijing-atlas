// 本地存储适配层：所有功能统一走安全 JSON 读写，避免隐私模式、配额或损坏数据中断界面。

export function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function resolveStorage(storage) {
  if (storage) return storage;
  if (typeof localStorage === 'undefined') return null;
  return localStorage;
}

export function readJson(key, fallback, validate = () => true, storage) {
  const target = resolveStorage(storage);
  if (!target) return fallback;
  try {
    const raw = target.getItem(key);
    if (raw === null) return fallback;
    const value = JSON.parse(raw);
    return validate(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

export function writeJson(key, value, storage) {
  const target = resolveStorage(storage);
  if (!target) return { ok: false, error: new Error('当前环境不支持本地存储') };
  try {
    target.setItem(key, JSON.stringify(value));
    return { ok: true, error: null };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error : new Error('本地存储写入失败'),
    };
  }
}

export function removeStored(key, storage) {
  const target = resolveStorage(storage);
  if (!target) return { ok: false, error: new Error('当前环境不支持本地存储') };
  try {
    target.removeItem(key);
    return { ok: true, error: null };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error : new Error('本地存储删除失败'),
    };
  }
}

