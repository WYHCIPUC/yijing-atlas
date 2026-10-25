// 当前页面内的一次自评提交；关闭后不承诺恢复未保存结果。
import { commitReviewCard, isReviewCard, reviewCard } from './review-engine.js';
import { isActivity, recordActivity } from './learning-progress.js';
import { createProgressEvent, isAchievementState, isProgressEvent } from './achievement-engine.js';
import { processAchievementEvent } from './achievement-storage.js';

const rounds = new WeakMap();
const parts = ['card', 'activity', 'achievement'];
let sequence = 0;
const messages = {
  'invalid-attempt': '本次复习会话无效，请重新打开卡片。',
  'invalid-options': '保存参数无效，请重新打开卡片。',
  'invalid-rating': '自评只能选择暂未想起、有些模糊或能清楚复述。',
  'invalid-time': '本次复习时间无效，请核对后重试。',
  'rating-locked': '本轮自评已确定，重试不能更换评分。',
  'storage-unavailable': '本地存储暂不可用，本轮自评仍保留，可重试保存。',
  'storage-changed': '保存环境已变化，请在原环境重试。',
  'card-invalid': '复习卡格式或计数异常，请先备份核对。',
  'card-read-failed': '无法读取原复习卡，未写入本轮记录，可重试。',
  'card-store-invalid': '已有复习卡记录异常，未覆盖原记录，请先备份核对。',
  'card-missing': '原复习卡已不存在，请返回温故重新进入。',
  'card-conflict': '这张卡的记录已变化，未覆盖新记录，请返回温故重新进入。',
  'card-write-failed': '复习卡未能保存，本轮自评仍保留，可重试。',
  'save-incomplete': '部分复习记录未能保存，可重试未完成部分；已保存的记录不会重复累计。',
};

export function createReviewAttempt(cardSnapshot) {
  // 此处仅校验并复制结构；提交时才核对持久卡确实存在且与此快照一致。
  if (!isReviewCard(cardSnapshot)) return null;
  const id = `${Date.now().toString(36)}:${++sequence}:${globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)}`;
  const token = Object.freeze({ id });
  rounds.set(token, { id, previous: structuredClone(cardSnapshot), card: null, rating: null,
    at: null, storage: null, changes: {} });
  return token;
}

function resultFor(round, errorCode = null) {
  const changes = Object.fromEntries(parts.map(name => [name,
    { applicable: false, saved: false, errorCode: null, ...round?.changes[name] }]));
  return { saved: !errorCode && changes.card.saved && parts.every(name => !changes[name].applicable || changes[name].saved),
    rating: round?.rating ?? null, reviewedAt: round?.at?.getTime() ?? null,
    previousCard: round ? structuredClone(round.previous) : null,
    card: round?.card ? structuredClone(round.card) : null, changes,
    errorCode, error: errorCode ? messages[errorCode] : null };
}

function checkedStore(target, key, validate, operation) {
  let raw, value;
  try { raw = target.getItem(key); } catch { return { saved: false, errorCode: 'read-failed' }; }
  try { value = raw === null ? null : JSON.parse(raw); } catch { return { saved: false, errorCode: 'invalid-store' }; }
  if (raw !== null && !validate(value)) return { saved: false, errorCode: 'invalid-store' };
  const checked = { getItem: requested => requested === key ? raw : target.getItem(requested),
    setItem: (requested, text) => target.setItem(requested, text) };
  try {
    const result = operation(checked, value);
    return { saved: result.saved === true, errorCode: result.saved ? null : 'write-failed' };
  } catch { return { saved: false, errorCode: 'write-failed' }; }
}

export function submitReviewAttempt(token, rating, options = {}) {
  const round = token && rounds.get(token);
  if (!round) return resultFor(null, 'invalid-attempt');
  if (!options || typeof options !== 'object' || Array.isArray(options)) return resultFor(round, 'invalid-options');
  if (![0, 1, 2].includes(rating)) return resultFor(round, 'invalid-rating');
  if (round.rating !== null && rating !== round.rating) return resultFor(round, 'rating-locked');
  if (round.rating === null) {
    const now = options.now === undefined ? new Date() : options.now;
    if (!(now instanceof Date) || !Number.isFinite(now.getTime())) return resultFor(round, 'invalid-time');
    const next = structuredClone(round.previous);
    try { reviewCard(next, rating, now.getTime()); } catch { return resultFor(round, 'card-invalid'); }
    round.rating = rating; round.at = new Date(now); round.card = next;
  }
  let target;
  try { target = options.storage || globalThis.localStorage; } catch { return resultFor(round, 'storage-unavailable'); }
  if (!target) return resultFor(round, 'storage-unavailable');
  if (round.storage && round.storage !== target) return resultFor(round, 'storage-changed');
  round.storage = target;
  if (!round.changes.card?.saved) {
    const result = commitReviewCard(round.previous, round.card, target);
    round.changes.card = { applicable: true, saved: result.saved, errorCode: result.errorCode };
    if (!result.saved) return resultFor(round, result.errorCode);
  }
  const save = (name, operation) => {
    if (round.changes[name]?.saved) return;
    round.changes[name] = { applicable: true, ...operation() };
  };
  save('activity', () => checkedStore(target, 'yijing-activity-v1', isActivity, (checked, value) => {
    const day = `${round.at.getFullYear()}-${String(round.at.getMonth() + 1).padStart(2, '0')}-${String(round.at.getDate()).padStart(2, '0')}`;
    return value?.days.includes(day) ? { saved: true } : recordActivity(round.at, checked);
  }));
  save('achievement', () => checkedStore(target, 'yijing.achievements.v1',
    value => isAchievementState(value) || (value?.version === 0 && Array.isArray(value.events) && value.events.every(isProgressEvent)),
    checked => processAchievementEvent(createProgressEvent({ type: 'review.completed', subjectId: round.previous.code,
      outcome: 'completed', occurredAt: round.at.toISOString(), idempotencyKey: `review:${round.previous.code}:${round.id}`,
      metadata: { hexagramCode: round.previous.code, reviewKind: 'spaced' },
    }), { storage: checked })));
  const result = resultFor(round);
  return result.saved ? result : resultFor(round, 'save-incomplete');
}
