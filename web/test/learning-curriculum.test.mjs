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
