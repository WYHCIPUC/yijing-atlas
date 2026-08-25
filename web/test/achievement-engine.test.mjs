import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyProgressEvent,
  applyProgressEvents,
  calculateAbilities,
  createAchievementState,
  createProgressEvent,
  isAchievementState,
  isProgressEvent,
  migrateAchievementState,
  summarizeAchievements,
} from '../js/achievement-engine.js';

const fixedNow = () => new Date('2026-08-20T08:00:00.000Z');

function event(type, subjectId, key, extras = {}) {
  return createProgressEvent({
    type,
    subjectId,
    idempotencyKey: key,
    occurredAt: extras.occurredAt || '2026-08-14T08:00:00.000Z',
    score: extras.score,
    outcome: extras.outcome,
    metadata: extras.metadata || {},
  }, { now: fixedNow, random: () => 0.25 });
}

test('事件工厂使用可注入时间与随机源并拒绝危险字段', () => {
  const created = createProgressEvent({ type: 'lesson.completed', subjectId: 'l1-1' }, {
    now: fixedNow,
    random: () => 0.5,
  });
  assert.equal(created.occurredAt, '2026-08-20T08:00:00.000Z');
  assert.match(created.idempotencyKey, /^lesson\.completed:l1-1:.*:i$/);
  assert.equal(isProgressEvent(created), true);
  assert.throws(() => createProgressEvent({
    type: 'lesson.completed', subjectId: 'l1-1', metadata: { question: '敏感原文' },
  }, { now: fixedNow, random: () => 0.1 }), /格式无效/);
  assert.throws(() => createProgressEvent({
    type: 'lesson.completed', subjectId: 'l1-1', question: '敏感原文',
  }, { now: fixedNow, random: () => 0.1 }), /格式无效/);
  assert.throws(() => createProgressEvent({
    type: 'hexagram.read', subjectId: '111111', metadata: { deep: 'yes' },
  }, { now: fixedNow, random: () => 0.1 }), /格式无效/);
  assert.throws(() => createProgressEvent({ type: 'lesson.completed', subjectId: 'l1-1' }, {
    now: fixedNow, random: () => 1,
  }), /随机源/);
  assert.throws(() => createProgressEvent({ type: 'unknown', subjectId: 'x' }, {
    now: fixedNow, random: () => 0,
  }), /格式无效/);
});

test('完成首课与小试后解锁且重复事件保持幂等', () => {
  const lesson = event('lesson.completed', 'l1-1', 'lesson:1');
  const quiz = event('lesson.assessed', 'l1-1', 'assessment:1', { score: 0.8, outcome: 'passed' });
  const first = applyProgressEvent(createAchievementState(), lesson, { now: fixedNow });
  const second = applyProgressEvent(first.state, quiz, { now: fixedNow });
  const duplicate = applyProgressEvent(second.state, quiz, { now: fixedNow });
  assert.equal(first.unlocked.length, 0);
  assert.deepEqual(second.unlocked.map((item) => item.id), ['first-lesson']);
  assert.equal(duplicate.accepted, false);
  assert.equal(duplicate.duplicate, true);
  assert.deepEqual(duplicate.state, second.state);
});

test('十二枚成就均可由真实学习证据达成', () => {
  const events = [
    event('lesson.completed', 'l1-1', 'lesson:first'),
    event('lesson.assessed', 'l1-1', 'lesson:first:quiz', { score: 0.9, outcome: 'passed' }),
    event('lesson.assessed', 'l1-1', 'lesson:yin-yang', { score: 0.85, outcome: 'passed', metadata: { topic: 'yin-yang' } }),
    event('lesson.assessed', 'eight-trigrams', 'trigrams:1', { score: 0.9, outcome: 'passed', metadata: { topic: 'eight-trigrams' } }),
    event('lesson.assessed', 'eight-trigrams', 'trigrams:2', { score: 1, outcome: 'passed', metadata: { topic: 'eight-trigrams' } }),
    event('lesson.assessed', 'sequence-upper', 'sequence:upper', { score: 1, outcome: 'passed', metadata: { assessmentType: 'sequence-exam', examPart: 'upper' } }),
    event('lesson.assessed', 'sequence-lower', 'sequence:lower', { score: 1, outcome: 'passed', metadata: { assessmentType: 'sequence-exam', examPart: 'lower' } }),
    event('lesson.assessed', 'complete-atlas', 'exam:complete', { score: 0.95, outcome: 'passed', metadata: { assessmentType: 'comprehensive-exam' } }),
    event('relation.examined', 'opposite:111111', 'relation:1'),
    ...Array.from({ length: 10 }, (_, index) => event('quiz.recovered', `wrong-${index}`, `recovered:${index}`)),
    ...Array.from({ length: 5 }, (_, index) => event('divination.analysis.submitted', `analysis-${index}`, `analysis:${index}`, {
      metadata: {
        totalScore: 90,
        changingLinesCorrect: true,
        cited: true,
        boundaryAcknowledged: true,
        dimensions: { identification: 20, imagery: 20, citation: 20, reasoning: 20, boundary: 20 },
      },
    })),
  ];
  const codes = Array.from({ length: 64 }, (_, index) => index.toString(2).padStart(6, '0'));
  codes.forEach((code, index) => {
    events.push(event('hexagram.read', code, `read:${code}`, { metadata: { deep: true } }));
    events.push(event('review.completed', code, `review:${code}`, {
      occurredAt: `2026-08-${String(14 + index % 3).padStart(2, '0')}T08:00:00.000Z`,
      metadata: { hexagramCode: code, reviewKind: 'spaced' },
    }));
  });
  const result = applyProgressEvents(createAchievementState(), events, { now: fixedNow });
  const summary = summarizeAchievements(result.state);
  assert.equal(result.accepted, events.length);
  assert.equal(summary.unlockedCount, 12);
  assert.ok(summary.achievements.every((item) => item.unlocked && item.current >= item.target));
  assert.equal(summary.rank.label, '通用·成章');
  assert.deepEqual(summary.abilities, {
    recognition: 100,
    classics: 100,
    change: 100,
    discernment: 100,
    expression: 100,
  });
  assert.equal(isAchievementState(result.state), true);
  assert.doesNotMatch(JSON.stringify(result.state), /问题|原文|answer|prompt/);
});

test('修改重交按同一案例保留较高成绩且独立边界确认按主题去重', () => {
  const dimensions = { identification: 10, imagery: 10, citation: 10, reasoning: 10, boundary: 10 };
  const events = [
    event('divination.analysis.submitted', 'case-1', 'case:1', { metadata: { totalScore: 80, dimensions } }),
    event('divination.analysis.revised', 'case-1', 'case:1:revision', { metadata: { totalScore: 70, dimensions } }),
    event('boundary.acknowledged', 'case-1', 'boundary:1'),
    event('boundary.acknowledged', 'case-1', 'boundary:2'),
  ];
  const { state } = applyProgressEvents(null, events, { now: fixedNow });
  assert.equal(Object.keys(state.metrics.analyses).length, 1);
  assert.equal(state.metrics.analyses['case-1'].totalScore, 80);
  assert.deepEqual(state.metrics.boundedSubjects, ['case-1']);
  assert.equal(summarizeAchievements(state).achievements.find((item) => item.id === 'bounded-reading').current, 1);
});

test('无效状态安全降级、批处理忽略坏事件并支持旧版事件迁移', () => {
  const valid = event('lesson.completed', 'l1-1', 'legacy:1');
  const result = applyProgressEvents({ broken: true }, [null, valid], { now: fixedNow });
  assert.equal(result.accepted, 1);
  assert.equal(isAchievementState(result.state), true);
  assert.throws(() => applyProgressEvent(result.state, { type: 'lesson.completed' }), /格式无效/);
  const migrated = migrateAchievementState({ version: 0, events: [valid, { bad: true }] }, { now: fixedNow });
  assert.deepEqual(migrated.metrics.completedLessons, ['l1-1']);
  assert.deepEqual(migrateAchievementState(migrated), migrated);
  assert.equal(summarizeAchievements(null).rank.label, '蒙学·初识');
  assert.deepEqual(calculateAbilities(null), {
    recognition: 0, classics: 0, change: 0, discernment: 0, expression: 0,
  });
});
