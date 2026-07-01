// 复习引擎：SM-2 简化版间隔重复算法 + 卡片库管理。
// 进度持久化到 localStorage。算法基于"艾宾浩斯遗忘曲线"的实用简化。
//
// SM-2 核心：每张卡片有 ease（难度系数，初始 2.5）、interval（天数）、reps（连续正确次数）。
// 用户自评 0-5 分，这里简化为三档：
//   forgot（忘了，~1分）：重置 reps=0，间隔=0（今天再看）
//   fuzzy（模糊，~3分）：间隔略增，ease 略降
//   remembered（记得，~5分）：间隔按 ease 增长，ease 略升

const STORAGE_KEY = 'yijing.review.v1';

// 三档自评 → 对应 SM-2 的 quality 分
const QUALITY = { forgot: 1, fuzzy: 3, remembered: 5 };

// 默认卡片进度
export function defaultCard() {
  return { ease: 2.5, interval: 0, reps: 0, due: Date.now(), lapses: 0, lastReview: 0 };
}

// 根据 quality 更新单卡进度，返回新进度（不修改原对象）
// 返回值含 due（下次到期时间戳，毫秒）
export function scheduleCard(card, qualityKey) {
  const q = QUALITY[qualityKey] ?? 3;
  let { ease, interval, reps, lapses } = card;
  let newEase = ease;

  if (q < 3) {
    // 忘了：重置
    reps = 0;
    interval = 0; // 10 分钟后再看（同日内）
    lapses += 1;
    newEase = Math.max(1.3, ease - 0.2);
  } else {
    // 记得/模糊
    reps += 1;
    if (reps === 1) interval = 1;
    else if (reps === 2) interval = qualityKey === 'fuzzy' ? 2 : 3;
    else interval = Math.round(interval * newEase);
    newEase = newEase + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
    newEase = Math.max(1.3, newEase);
  }

  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  // interval=0 表示 10 分钟后再看
  const dueOffset = interval === 0 ? 10 * 60 * 1000 : interval * dayMs;
  return {
    ease: Math.round(newEase * 100) / 100,
    interval,
    reps,
    lapses,
    due: now + dueOffset,
    lastReview: now,
  };
}

// ---- 卡片库：从 hexagrams 生成全部复习卡片 ----
// 卡片 id 规则：卦级用 "h:<binaryCode>"，爻级用 "y:<binaryCode>:<position>"

export function buildCardIds(hexagrams) {
  const ids = [];
  for (const h of hexagrams) {
    ids.push(`h:${h.binaryCode}`);
    for (const y of h.lines) {
      ids.push(`y:${h.binaryCode}:${y.position}`);
    }
  }
  return ids;
}

// 黄历术语卡片 id：用 "t:<id>" 前缀
export function buildAlmanacCardIds(terms) {
  return (terms || []).map((t) => `t:${t.id || t.name}`);
}

// 进度仓储：读写 localStorage
export function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveProgress(progress) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch (e) {
    console.error('保存复习进度失败', e);
  }
}

// 获取某卡片进度（无则返回默认）
export function getCard(progress, id) {
  return progress[id] || defaultCard();
}

// 今日到期卡片数（due <= now）
export function dueCount(progress, ids) {
  const now = Date.now();
  return ids.filter((id) => (progress[id]?.due ?? 0) <= now).length;
}

// 取今日到期卡片 id 列表
export function dueCards(progress, ids, limit = 20) {
  const now = Date.now();
  return ids.filter((id) => (progress[id]?.due ?? 0) <= now).slice(0, limit);
}

// 掌握度统计：已学习卡片数 / 总卡片数；其中 reps>=3 视为"已掌握"
export function masteryStats(progress, ids) {
  let learned = 0, mastered = 0;
  for (const id of ids) {
    const c = progress[id];
    if (c && c.reps > 0) learned++;
    if (c && c.reps >= 3) mastered++;
  }
  return { total: ids.length, learned, mastered };
}
