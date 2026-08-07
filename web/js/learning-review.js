import { readJson, writeJson } from './storage.js';

const REVIEW_CONFIG_KEY = 'yijing-learning-review-config-v1';
const REQUEST_TIMEOUT_MS = 15000;

function isAllowedEndpoint(endpoint) {
  if (typeof endpoint !== 'string' || !endpoint.trim()) return false;
  if (endpoint.startsWith('/') && !endpoint.startsWith('//')) return true;
  try {
    const url = new URL(endpoint);
    return url.protocol === 'https:' ||
      (url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname));
  } catch {
    return false;
  }
}

export function loadReviewConfig(storage) {
  return readJson(
    REVIEW_CONFIG_KEY,
    { endpoint: '' },
    (value) => value && typeof value.endpoint === 'string' &&
      (!value.endpoint || isAllowedEndpoint(value.endpoint)),
    storage,
  );
}

export function saveReviewConfig(endpoint, storage) {
  const normalized = String(endpoint || '').trim();
  if (normalized && !isAllowedEndpoint(normalized)) {
    return { ok: false, error: new Error('评阅地址必须使用 HTTPS；本地开发可使用 localhost HTTP') };
  }
  return writeJson(REVIEW_CONFIG_KEY, { endpoint: normalized }, storage);
}

function validateReviewResult(value) {
  return value && Number.isFinite(value.score) && value.score >= 0 && value.score <= 100 &&
    typeof value.summary === 'string' && Array.isArray(value.strengths) &&
    Array.isArray(value.improvements) && value.strengths.every((item) => typeof item === 'string') &&
    value.improvements.every((item) => typeof item === 'string');
}

export async function evaluateRecitation({ endpoint, lesson, response, rubric }, fetchImpl = globalThis.fetch) {
  if (!isAllowedEndpoint(endpoint)) throw new Error('尚未配置安全的智能评阅地址');
  if (typeof response !== 'string' || response.trim().length < 20) {
    throw new Error('请至少写下 20 个字，再提交复讲');
  }
  if (typeof fetchImpl !== 'function') throw new Error('当前环境不支持联网评阅');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const result = await fetchImpl(endpoint, {
      method: 'POST',
      credentials: 'omit',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        schemaVersion: 1,
        task: 'yijing-learning-recitation',
        lesson: { id: lesson.id, title: lesson.title },
        rubric,
        response: response.trim(),
      }),
      signal: controller.signal,
    });
    if (!result.ok) throw new Error(`评阅服务返回 HTTP ${result.status}`);
    const payload = await result.json();
    if (!validateReviewResult(payload)) throw new Error('评阅服务返回的数据格式不正确');
    return {
      score: Math.round(payload.score),
      summary: payload.summary,
      strengths: payload.strengths.slice(0, 4),
      improvements: payload.improvements.slice(0, 4),
      mode: 'ai',
    };
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('智能评阅超时，请使用本地要点自评');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function getReviewConfigKey() {
  return REVIEW_CONFIG_KEY;
}
