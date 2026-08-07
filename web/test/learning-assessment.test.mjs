import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createAssessmentSession,
  gradeAssessment,
  recommendLesson,
} from '../js/learning-assessment.js';

const bank = [
  ...Array.from({ length: 5 }, (_, index) => ({
    id: `a-${index}`, lessonId: 'l1-1', levelId: 'L1', prompt: `A${index}`,
    answer: 'a', options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }],
  })),
  ...Array.from({ length: 5 }, (_, index) => ({
    id: `b-${index}`, lessonId: 'l1-2', levelId: 'L1', prompt: `B${index}`,
    answer: 'b', options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }],
  })),
  ...Array.from({ length: 4 }, (_, index) => ({
    id: `c-${index}`, lessonId: 'l2-1', levelId: 'L2', prompt: `C${index}`,
    answer: 'c', options: [{ value: 'c', label: 'C' }, { value: 'd', label: 'D' }],
  })),
];
const fixedRandom = () => 0.25;

test('小试、抽查和阶段考评按范围组卷', () => {
  const lesson = createAssessmentSession('lesson', bank, { lessonId: 'l1-1', random: fixedRandom });
  assert.equal(lesson.questions.length, 3);
  assert.ok(lesson.questions.every((item) => item.lessonId === 'l1-1'));

  const spot = createAssessmentSession('spot', bank, {
    record: { lessons: { 'l1-2': { viewedAt: '2026-08-07T00:00:00.000Z' } } },
    random: fixedRandom,
  });
  assert.equal(spot.questions.length, 5);
  assert.ok(spot.questions.every((item) => item.lessonId === 'l1-2'));

  const exam = createAssessmentSession('exam', bank, { levelId: 'L1', random: fixedRandom });
  assert.equal(exam.questions.length, 10);
  assert.ok(exam.questions.every((item) => item.levelId === 'L1'));
  assert.equal(createAssessmentSession('unknown', bank), null);
  assert.equal(createAssessmentSession('lesson', bank, { lessonId: 'missing' }), null);
});

test('交卷会逐题记录课程归属并统计成绩', () => {
  const session = createAssessmentSession('lesson', bank, { lessonId: 'l1-1', random: fixedRandom });
  const answers = Object.fromEntries(session.questions.map((item, index) => [
    item.id,
    index === 0 ? item.answer : 'wrong',
  ]));
  const result = gradeAssessment(session, answers);
  assert.equal(result.correct, 1);
  assert.equal(result.total, 3);
  assert.ok(result.results.every((item) => item.lessonId === 'l1-1'));
});

test('日课先推荐未浏览课程，再推荐小试成绩较低者', () => {
  const lessons = [{ id: 'a' }, { id: 'b' }];
  assert.equal(recommendLesson({ lessons: {} }, lessons).id, 'a');
  assert.equal(recommendLesson({ lessons: {
    a: { viewedAt: '2026-08-06', bestScore: 0.8, lastStudiedAt: '2026-08-06' },
    b: { viewedAt: '2026-08-07', bestScore: 0.4, lastStudiedAt: '2026-08-07' },
  } }, lessons).id, 'b');
  assert.equal(recommendLesson({}, []), null);
});
