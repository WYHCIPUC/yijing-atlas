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
const referencedBank = bank.map(item => ({
  ...item, questionVersion: 'curriculum-v1', kind: 'recall', targetCode: null, termId: null,
}));

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
    index === 0 ? item.answer : item.options.find((option) => option.value !== item.answer).value,
  ]));
  const result = gradeAssessment(session, answers);
  assert.equal(result.correct, 1);
  assert.equal(result.total, 3);
  assert.ok(result.results.every((item) => item.lessonId === 'l1-1'));
});

test('同样的随机题序也为新一轮生成独立标识，结果保留本轮标识', () => {
  const first = createAssessmentSession('lesson', bank, { lessonId: 'l1-1', random: fixedRandom });
  const second = createAssessmentSession('lesson', bank, { lessonId: 'l1-1', random: fixedRandom });
  assert.equal(typeof first.id, 'string');
  assert.ok(first.id);
  assert.notEqual(first.id, second.id);
  assert.deepEqual(first.questions, second.questions);
  const answers = Object.fromEntries(first.questions.map((item) => [item.id, item.answer]));
  assert.equal(gradeAssessment(first, answers).sessionId, first.id);
});

test('只评定本卷完整且来自本题选项的答案', () => {
  const session = createAssessmentSession('lesson', bank, { lessonId: 'l1-1', random: fixedRandom });
  const answers = Object.fromEntries(session.questions.map((item) => [item.id, item.answer]));
  assert.equal(gradeAssessment(session, { ...answers, 'foreign-question': 'a' }), null);
  assert.equal(gradeAssessment(session, { ...answers, [session.questions[1].id]: 'tampered-option' }), null);
  delete answers[session.questions[1].id];
  assert.equal(gradeAssessment(session, answers), null);
  assert.equal(gradeAssessment(null, {}), null);
});

test('抽查没有已浏览课时不回退全库，题目不足按实际数量组卷', () => {
  assert.equal(createAssessmentSession('spot', bank, { record: { lessons: {} } }), null);
  const partial = createAssessmentSession('lesson', bank.slice(0, 2), { lessonId: 'l1-1' });
  assert.equal(partial.questions.length, 2);
  const answers = Object.fromEntries(partial.questions.map((item) => [item.id, item.answer]));
  assert.equal(gradeAssessment(partial, answers).total, 2);
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

test('原题回练仍是新普通三题小试，指定题必入且不重复或改变题义', () => {
  const requiredQuestionId = 'a-4';
  const original = structuredClone(referencedBank);
  for (const random of [() => 0, fixedRandom, () => 0.999]) {
    const options = { lessonId: 'l1-1', requiredQuestionId, requiredQuestionVersion: 'curriculum-v1', random };
    const first = createAssessmentSession('lesson', referencedBank, options);
    const second = createAssessmentSession('lesson', referencedBank, options);
    assert.equal(first.kind, 'lesson');
    assert.equal(first.questions.length, 3);
    assert.equal(first.questions.filter(item => item.id === requiredQuestionId).length, 1);
    assert.equal(new Set(first.questions.map(item => item.id)).size, 3);
    assert.ok(first.questions.every(item => item.lessonId === 'l1-1'));
    assert.notEqual(first.id, second.id);
    for (const question of first.questions) {
      const source = original.find(item => item.id === question.id);
      assert.deepEqual({ ...question, options: source.options }, source);
    }
  }
  assert.deepEqual(referencedBank, original, '组卷不改写题库与原选项');
  const withoutVersion = createAssessmentSession('lesson', referencedBank, { lessonId: 'l1-1', requiredQuestionId, random: () => 0 });
  assert.ok(withoutVersion.questions.some(item => item.id === requiredQuestionId));
});

test('缺失、跨课或版本失效的原题引用明确拒绝，不随机替换题目', () => {
  for (const reference of [
    { requiredQuestionId: 'missing', requiredQuestionVersion: 'curriculum-v1' },
    { requiredQuestionId: 'b-0', requiredQuestionVersion: 'curriculum-v1' },
    { requiredQuestionId: 'a-0', requiredQuestionVersion: 'curriculum-v0' },
    { requiredQuestionId: 'a-0', requiredQuestionVersion: '' },
    { requiredQuestionId: 'a-0', requiredQuestionVersion: null },
    { requiredQuestionId: '' }, { requiredQuestionId: null },
    { requiredQuestionVersion: 'curriculum-v1' },
  ]) {
    assert.equal(createAssessmentSession('lesson', referencedBank, { lessonId: 'l1-1', ...reference }), null, JSON.stringify(reference));
  }
  assert.equal(createAssessmentSession('lesson', bank, {
    lessonId: 'l1-1', requiredQuestionId: 'a-0', requiredQuestionVersion: 'curriculum-v1',
  }), null, '旧题对象缺少版本不能冒充已核对引用');
  assert.equal(createAssessmentSession('exam', referencedBank, {
    levelId: 'L1', requiredQuestionId: 'a-0', requiredQuestionVersion: 'curriculum-v1',
  }), null, '原题回练仅通过普通lesson会话');
});

test('原题回练的可用题不足仍用实际题量，显式题数保持原规则', () => {
  for (const count of [undefined, 1, 2, 5]) {
    const session = createAssessmentSession('lesson', referencedBank.slice(0, 2), {
      lessonId: 'l1-1', requiredQuestionId: 'a-1', requiredQuestionVersion: 'curriculum-v1', count, random: () => 0.999,
    });
    assert.equal(session.questions.length, count === 1 ? 1 : 2);
    assert.equal(session.questions.filter(item => item.id === 'a-1').length, 1);
    const answers = Object.fromEntries(session.questions.map(item => [item.id, item.answer]));
    assert.equal(gradeAssessment(session, answers).total, session.questions.length);
  }
});

test('判分结果传递公开引用和真实题型，不复制题干或私文', () => {
  const fixtures = referencedBank.slice(0, 3).map((item, index) => ({
    ...item, kind: index === 1 ? 'evidence' : 'recall',
    targetCode: index === 0 ? '111111' : null,
    termId: index === 2 ? 'jianshe-jian' : null,
    privateNote: '不得传播的测试私文',
  }));
  const session = createAssessmentSession('lesson', fixtures, { lessonId: 'l1-1', random: fixedRandom });
  const answers = Object.fromEntries(session.questions.map((item, index) => [item.id, index === 0 ? 'b' : 'a']));
  const result = gradeAssessment(session, answers);
  assert.equal(result.total, 3);
  assert.equal(result.correct, 2);
  for (const row of result.results) {
    const item = fixtures.find(question => question.id === row.questionId);
    assert.equal(row.questionVersion, item.questionVersion);
    assert.equal(row.questionType, item.kind);
    assert.equal(row.targetCode, item.targetCode);
    assert.equal(row.termId, item.termId);
    assert.deepEqual(Object.keys(row).sort(), [
      'questionId', 'lessonId', 'questionVersion', 'questionType', 'targetCode', 'termId', 'picked', 'answer', 'correct',
    ].sort());
  }
  assert.ok(!JSON.stringify(result).includes('不得传播的测试私文'));
});

test('旧题对象没有引用元数据时仍按旧形状判分，不补造当前版本', () => {
  const session = createAssessmentSession('lesson', bank, { lessonId: 'l1-1', random: fixedRandom });
  const result = gradeAssessment(session, Object.fromEntries(session.questions.map(item => [item.id, item.answer])));
  assert.ok(result.results.every(row => !Object.hasOwn(row, 'questionVersion') && !Object.hasOwn(row, 'questionType') &&
    !Object.hasOwn(row, 'targetCode') && !Object.hasOwn(row, 'termId')));
});
