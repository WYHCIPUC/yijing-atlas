import assert from 'node:assert/strict';
import test from 'node:test';
import * as assessment from '../js/learning-assessment.js';
import { LEARNING_LESSONS } from '../js/learning-curriculum.js';

const now = Date.parse('2026-10-25T08:00:00Z');
const lessons = LEARNING_LESSONS.slice(0, 3);
const resume = { lessonId: 'l1-2', section: 'explain', scrollTop: 620.5, updatedAt: '2026-10-25T07:00:00Z' };
const card = (code, due = now - 1) => ({ code, due, stage: 0, lapses: 0, reps: 0, lastReview: 0, introducedAt: now - 100 });
const weak = (questionId, lessonId = 'l1-1', lastWrongAt = '2026-10-25T06:00:00Z') => ({
  questionId, questionVersion: 'curriculum-v1', sourceKind: 'course', lessonId,
  questionType: 'recall', targetCode: null, termId: null,
  firstWrongAt: lastWrongAt, lastWrongAt, lastSessionId: 'original', wrongCount: 1,
  status: 'due', lastReviewedAt: null, resolvedAt: null,
});
const allViewed = () => ({ lessons: Object.fromEntries(lessons.map(lesson => [lesson.id, {
  viewedAt: '2026-10-01T01:00:00Z', lastStudiedAt: '2026-10-01T01:00:00Z', bestScore: 0.1,
}])) });
const recommend = (record, options = {}) => {
  assert.equal(typeof assessment.recommendLearningTask, 'function', 'task recommendation must have a separate API');
  return assessment.recommendLearningTask(record, { lessons, now, ...options });
};

test('新用户主行动是首课，课程对象推荐API仍供原下拉框使用', () => {
  const task = recommend({ lessons: {} });
  assert.equal(task.type, 'lesson');
  assert.equal(task.subject, 'l1-1');
  assert.ok(task.reason);
  assert.equal(assessment.recommendLesson({}, lessons).id, 'l1-1');
});

test('明确未完课程优先于到期卦卡、弱项和下一未浏览课', () => {
  const record = { lessons: {}, resume, weakQuestions: { q: weak('q') } };
  const before = JSON.stringify(record);
  const task = recommend(record, { reviewCards: { '111111': card('111111') }, wrongCodes: ['000000'] });
  assert.equal(task.type, 'resume');
  assert.equal(task.subject, 'l1-2');
  assert.deepEqual(task.resume, resume);
  task.resume.scrollTop = 0;
  assert.equal(JSON.stringify(record), before);
});

test('无续读时先处理到期卦卡，按到期时间再编码稳定排序', () => {
  const task = recommend({ resume: null, weakQuestions: { q: weak('q') } }, { reviewCards: {
    '111111': card('111111', now), '000000': card('000000', now - 10),
    '101010': card('101010', now - 10), '010101': card('010101', now + 1),
  } });
  assert.equal(task.type, 'review');
  assert.equal(task.subject, '000000');
  assert.equal(task.count, 3);
  assert.match(task.reason, /3/);
});

test('未引入、损坏和未来卦卡不会抢占下一课', () => {
  const unintroduced = card('111111');
  delete unintroduced.introducedAt;
  assert.equal(recommend({}, { reviewCards: {
    '111111': unintroduced, '000000': card('000000', now + 1), '101010': { due: 0 },
  } }).type, 'lesson');
});

test('课程弱项按最近错误与稳定课序选择，due状态不冒充到期卦卡', () => {
  const entries = [weak('a', 'l1-2'), weak('z', 'l1-1'), weak('recent', 'l1-3', '2026-10-25T07:30:00Z')];
  const record = { weakQuestions: Object.fromEntries(entries.map(entry => [entry.questionId, entry])) };
  const latest = recommend(record);
  assert.equal(latest.type, 'course-weak');
  assert.equal(latest.subject, 'recent');
  latest.question.status = 'resolved';
  assert.equal(record.weakQuestions.recent.status, 'due');
  delete record.weakQuestions.recent;
  assert.equal(recommend(record).subject, 'z');
  assert.equal(recommend(record).count, 2);
});

test('课程薄弱项已纠正后不再推荐；旧测验卦码只进入错题模式', () => {
  const resolved = { ...weak('q'), status: 'resolved', resolvedAt: '2026-10-25T07:00:00Z' };
  const task = recommend({ weakQuestions: { q: resolved } }, { wrongCodes: ['111111', '000000', '111111', 'bad'] });
  assert.equal(task.type, 'quiz-weak');
  assert.equal(task.count, 2);
  assert.equal(task.subject, '000000');
  assert.equal(task.question, undefined);
  assert.equal(task.questionVersion, undefined);
});

test('旧弱项课程已移除时不构造无效课程入口', () => {
  assert.equal(recommend({ weakQuestions: { old: weak('old', 'removed-course') } }).type, 'lesson');
});

test('没有续读与薄弱证据时进入稳定顺序的下一未浏览课', () => {
  const task = recommend({ lessons: { 'l1-1': { viewedAt: '2026-10-01T00:00:00Z' } } });
  assert.equal(task.type, 'lesson');
  assert.equal(task.subject, 'l1-2');
});

test('全部浏览后低分不伪造本轮未完成，进入既有复讲', () => {
  const record = allViewed();
  record.lessons['l1-2'].lastStudiedAt = '2026-10-24T00:00:00Z';
  const task = recommend(record);
  assert.equal(task.type, 'oral');
  assert.equal(task.subject, 'l1-2');
  assert.match(task.reason, /复讲/);
});

test('同级复讲时间相同时保持课程序，反复渲染不改输入', () => {
  const record = allViewed();
  const before = JSON.stringify(record);
  const first = recommend(record);
  assert.equal(first.subject, 'l1-1');
  assert.deepEqual(recommend(record), first);
  assert.equal(JSON.stringify(record), before);
});

test('坏恢复位置给明确提示并正常推荐，不清除成绩', () => {
  for (const broken of [[], { ...resume, lessonId: 'removed' }, { ...resume, scrollTop: -1 }, { ...resume, section: 'quiz' }]) {
    const record = { lessons: {}, resume: broken };
    const before = JSON.stringify(record);
    const task = recommend(record);
    assert.equal(task.type, 'lesson');
    assert.ok(task.notice);
    assert.equal(JSON.stringify(record), before);
  }
});

test('空课程集合有真实空态，不生成00课或虚假入口', () => {
  const task = recommend(null, { lessons: [] });
  assert.equal(task.type, 'empty');
  assert.equal(task.subject, null);
  assert.ok(task.reason);
});

test('注入Date时间与毫秒时间得到相同到期判断', () => {
  const options = { reviewCards: { '111111': card('111111', now) } };
  assert.deepEqual(recommend({}, options), recommend({}, { ...options, now: new Date(now) }));
});
