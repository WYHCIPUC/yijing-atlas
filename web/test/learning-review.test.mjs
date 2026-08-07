import assert from 'node:assert/strict';
import test from 'node:test';
import {
  evaluateRecitation,
  getReviewConfigKey,
  loadReviewConfig,
  saveReviewConfig,
} from '../js/learning-review.js';

function createStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
  };
}

test('评阅配置只接受相对地址、HTTPS 或本地 HTTP', () => {
  const storage = createStorage();
  assert.equal(saveReviewConfig('http://example.com/review', storage).ok, false);
  assert.equal(saveReviewConfig('/api/learning-review', storage).ok, true);
  assert.deepEqual(loadReviewConfig(storage), { endpoint: '/api/learning-review' });
  assert.equal(saveReviewConfig('https://review.example.com/api', storage).ok, true);
  assert.equal(saveReviewConfig('http://localhost:8787/review', storage).ok, true);
  assert.equal(getReviewConfigKey(), 'yijing-learning-review-config-v1');
});

test('智能评阅按固定协议提交并校验返回结果', async () => {
  let request;
  const fetchImpl = async (endpoint, options) => {
    request = { endpoint, options };
    return {
      ok: true,
      json: async () => ({
        score: 82.4,
        summary: '能够说明核心关系。',
        strengths: ['概念清楚'],
        improvements: ['补充典籍依据'],
      }),
    };
  };
  const result = await evaluateRecitation({
    endpoint: '/api/learning-review',
    lesson: { id: 'l1-1', title: '阴阳之道' },
    response: '阴阳不是互相隔绝的两类，而是在变化过程中相互依存。',
    rubric: ['阴阳互根'],
  }, fetchImpl);
  assert.equal(result.score, 82);
  assert.equal(result.mode, 'ai');
  assert.equal(request.endpoint, '/api/learning-review');
  const payload = JSON.parse(request.options.body);
  assert.equal(payload.task, 'yijing-learning-recitation');
  assert.equal(payload.lesson.id, 'l1-1');
});

test('智能评阅拒绝短文本、错误状态与异常数据', async () => {
  const base = {
    endpoint: '/api/review', lesson: { id: 'l1-1', title: '阴阳' }, rubric: [],
  };
  await assert.rejects(() => evaluateRecitation({ ...base, response: '太短' }, async () => ({})), /至少写下/);
  await assert.rejects(() => evaluateRecitation({ ...base, endpoint: '', response: '这是一段足够长的复讲内容，用于说明课程中的主要观点。' }, async () => ({})), /尚未配置/);
  await assert.rejects(() => evaluateRecitation({ ...base, response: '这是一段足够长的复讲内容，用于说明课程中的主要观点。' }, async () => ({ ok: false, status: 503 })), /503/);
  await assert.rejects(() => evaluateRecitation({ ...base, response: '这是一段足够长的复讲内容，用于说明课程中的主要观点。' }, async () => ({ ok: true, json: async () => ({ score: 101 }) })), /格式不正确/);
});
