import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  buildLearningQuestionBank,
  CURRICULUM_TRACKS,
  getLesson,
  getLessonRubric,
  LEARNING_LESSONS,
  LEARNING_LEVELS,
} from '../js/learning-curriculum.js';

const load = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const appState = {
  hexagrams: load('../data/hexagrams.json'),
  trigrams: load('../data/trigrams.json'),
  wings: load('../data/wings.json'),
  theorems: load('../data/theorems.json'),
  almanacTerms: load('../data/almanac-terms.json'),
};

test('全部学习小节均有至少三道可判分题目', () => {
  const bank = buildLearningQuestionBank(appState);
  const ids = new Set(bank.map((item) => item.id));
  assert.equal(ids.size, bank.length);
  for (const lesson of LEARNING_LESSONS) {
    const questions = bank.filter((item) => item.lessonId === lesson.id);
    assert.ok(questions.length >= 3, `${lesson.id} 题量不足`);
    questions.forEach((question) => {
      assert.ok(question.options.some((option) => option.value === question.answer));
      assert.ok(question.options.length >= 2);
      assert.equal(question.levelId, lesson.levelId);
    });
  }
  assert.ok(bank.some((item) => item.kind === 'evidence' && item.evidenceType === '证据不足'));
  assert.ok(bank.some((item) => item.kind === 'evidence' && item.evidenceType === '卦体'));
  assert.ok(bank.some((item) => item.kind === 'evidence' && item.evidenceType === '经传原文'));
});

test('课程覆盖五阶与所有资料栏目，并能生成复讲要点', () => {
  assert.equal(LEARNING_LEVELS.length, 5);
  assert.deepEqual(new Set(LEARNING_LESSONS.map((lesson) => lesson.type)),
    new Set(['theory', 'trigrams', 'hexagrams', 'wings', 'almanac']));
  for (const lesson of LEARNING_LESSONS) {
    assert.equal(getLesson(lesson.id)?.title, lesson.title);
    assert.ok(getLessonRubric(lesson.id, appState).length > 0, `${lesson.id} 缺少复讲要点`);
  }
  assert.equal(getLesson('missing'), null);
  assert.deepEqual(getLessonRubric('missing', appState), []);
  assert.deepEqual(new Set(LEARNING_LESSONS.map((lesson) => lesson.track)), new Set(Object.keys(CURRICULUM_TRACKS)));
  for (const lessonId of ['l3-4', 'l4-5', 'l4-6', 'l4-7']) assert.ok(getLesson(lessonId), `${lessonId} 未纳入课程`);
});

test('题库公开引用保留真实题型，六爻卦与术语分别使用原始实体标识', () => {
  const bank = buildLearningQuestionBank(appState);
  for (const item of bank) {
    assert.equal(item.questionVersion, 'curriculum-v1', item.id);
    assert.ok(['recall', 'evidence'].includes(item.kind), item.id);
    const lesson = getLesson(item.lessonId);
    if (lesson.type !== 'hexagrams') assert.equal(item.targetCode, null, item.id);
    if (lesson.type !== 'almanac') assert.equal(item.termId, null, item.id);
  }
  for (const hexagram of appState.hexagrams) {
    const questions = bank.filter(item => item.id.startsWith(`hex-${hexagram.binaryCode}-`));
    assert.equal(questions.length, 5);
    assert.ok(questions.every(item => item.targetCode === hexagram.binaryCode));
  }
  for (const term of appState.almanacTerms) {
    const questions = bank.filter(item => item.id.startsWith(`almanac-${term.id}-`));
    assert.equal(questions.length, 4, term.id);
    assert.ok(questions.every(item => item.termId === term.id), term.id);
  }
});

test('术语定位来自实体ID，不从显示名称猜测；三爻题不补造六位码', () => {
  const terms = appState.almanacTerms.map((term, index) => index === 0
    ? { ...term, id: 'public-reference-changed', name: '同一显示名称' } : term);
  const bank = buildLearningQuestionBank({ ...appState, almanacTerms: terms });
  const questions = bank.filter(item => item.id.startsWith('almanac-public-reference-changed-'));
  assert.equal(questions.length, 4);
  assert.ok(questions.every(item => item.termId === 'public-reference-changed'));
  assert.ok(bank.filter(item => item.lessonId === 'l1-4')
    .every(item => item.targetCode === null && item.termId === null));
  const qianOrder = bank.find(item => item.id === 'hex-111111-order');
  assert.equal(qianOrder.prompt, '第 1 卦是哪一卦？');
  assert.equal(qianOrder.answer, '乾');
  assert.equal(qianOrder.source, '《周易》卦序');
});
