import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import * as progress from '../js/learning-progress.js';
import { buildLearningQuestionBank, getLesson } from '../js/learning-curriculum.js';
import { createPageDom } from './helpers/quiz-page-dom.mjs';
import { getHexagramContentProvenance } from '../js/content-provenance.js';

const source = readFileSync(new URL('../js/modes/review-mode.js', import.meta.url), 'utf8')
  .replace(/^import[\s\S]*?from '[^']+';\r?\n/gm, '').replaceAll('export function ', 'function ');
const question = (sourceKind, extra = {}) => ({ sourceKind, questionId: sourceKind === 'almanac' ? 'almanac:jian:name-to-meaning' : 'quiz:opposite:111111',
  questionVersion: sourceKind === 'almanac' ? 'almanac-v1' : 'quiz-v1', questionType: sourceKind === 'almanac' ? 'name-to-meaning' : 'opposite',
  targetCode: sourceKind === 'almanac' ? null : '111111', termId: sourceKind === 'almanac' ? 'jian' : null, lessonId: null,
  firstWrongAt: '2026-10-25T01:00:00Z', lastWrongAt: '2026-10-25T01:00:00Z', lastSessionId: 'attempt-1', wrongCount: 1,
  status: 'due', lastReviewedAt: null, resolvedAt: null, ...extra });
function harness(items = [question('quiz'), question('almanac')], { due = ['111111'], legacy = ['000000'], terms, cards = { '111111': { code: '111111' } } } = {}) {
  const dom = createPageDom(), calls = [];
  dom.window.setTimeout = callback => dom.window.requestAnimationFrame(callback);
  const record = { weakQuestions: Object.fromEntries(items.map(item => [item.questionId, item])) };
  const context = vm.createContext({ window: dom.window, document: dom.document,
    loadLearningRecord: () => record, getWeakQuestionsError: progress.getWeakQuestionsError,
    getCourseWeakQuestions: progress.getCourseWeakQuestions, getQuizWeakQuestions: progress.getQuizWeakQuestions,
    buildLearningQuestionBank, getLesson, loadWrongBook: () => legacy,
    loadReviewCards: () => cards, getDueCards: () => due, hexagramSvg: () => '<svg></svg>', getHexagramContentProvenance,
  });
  vm.runInContext(source, context);
  const hexagrams = ['111111', '000000'].map((binaryCode, number) => ({ binaryCode, number, name: number ? '坤' : '乾', fullName: number ? '坤为地' : '乾为天' }));
  const state = { index: { byCode: new Map(hexagrams.map(hex => [hex.binaryCode, hex])) },
    almanacTerms: terms ?? [{ id: 'jian', name: '建日', category: '建除十二神', meaning: '真实释义' }] };
  const cleanup = context.renderReviewMode(dom.mount, state, (...args) => calls.push(args));
  return { ...dom, calls, cleanup, record, context };
}

test('具体测验、术语和旧摘要各自可见，唯一到期卦卡不绕过温习列表', () => {
  const h = harness();
  assert.ok(h.mount.querySelector('.quiz-weak-queue'));
  assert.match(h.mount.textContent, /测验与术语温习/);
  assert.match(h.mount.textContent, /建日/); assert.match(h.mount.textContent, /错卦/);
  assert.match(h.mount.textContent, /原题型未保留/);
  assert.equal(h.mount.querySelector('.mode-hero-stat strong').textContent, '4');
  assert.equal(h.mount.querySelector('.flip-card'), null);
  h.click('[data-action="quiz-practice-0"]');
  assert.equal(h.calls[0][0], 'quiz'); assert.equal(h.calls[0][1].wrongOnly, true);
  assert.ok(h.calls[0][1].reference.questionId); assert.equal(h.calls[0][1].returnTo.mode, 'review');
  h.click('[data-action="legacy-practice-0"]');
  assert.equal(h.calls[1][1].legacyCode, '000000'); assert.equal(h.calls[1][1].reference, undefined);
});

test('术语来源携带真实termId和返回温故，不把打开来源写成纠正', () => {
  const h = harness([question('almanac')], { due: [], legacy: [] });
  const before = JSON.stringify(h.record);
  h.click('[data-action="quiz-source-0"]');
  assert.equal(h.calls[0][0], 'learning');
  assert.equal(h.calls[0][1].section, 'almanac'); assert.equal(h.calls[0][1].termId, 'jian');
  assert.equal(h.calls[0][1].returnTo.mode, 'review'); assert.equal(h.calls[0][1].quizReference.sourceKind, 'almanac');
  assert.equal(JSON.stringify(h.record), before);
});

test('新旧队列全部完成后显示可理解空态，销毁后的按钮不能导航', () => {
  const h = harness([], { due: [], legacy: [] });
  assert.match(h.mount.textContent, /暂无待回练的测验或术语题/);
  assert.equal(typeof h.cleanup, 'function');
  const button = h.mount.querySelector('[data-action="start-learning"]');
  h.cleanup(); h.cleanup(); h.click(button); h.flushFrames();
  assert.deepEqual(h.calls, []); assert.equal(h.document.activeElement, null);
});

test('术语资料尚未加载时显示待核对，来源仍保留真实引用', () => {
  const h = harness([question('almanac')], { due: [], legacy: [], terms: [] });
  assert.match(h.mount.textContent, /原术语（进入后核对）/);
  assert.doesNotMatch(h.mount.textContent, /原题已失效|原术语已调整/);
  h.click('[data-action="quiz-source-0"]');
  assert.equal(h.calls[0][1].termId, 'jian');
  assert.equal(h.calls[0][1].quizReference.questionVersion, 'almanac-v1');
});

test('具体卦题来源进入原卦卡并可返回同一队列，打开来源不更改弱项', () => {
  const h = harness([question('quiz')], { due: [], legacy: [] });
  const before = JSON.stringify(h.record), source = h.mount.querySelector('[data-action="quiz-source-0"]');
  h.click(source); assert.ok(h.mount.querySelector('.flip-card'));
  const card = h.mount.querySelector('.review-card-panel');
  h.click(source); assert.equal(h.mount.querySelector('.review-card-panel'), card);
  h.click('.review-back'); assert.equal(h.mount.querySelectorAll('[data-quiz-question-id]').length, 1);
  assert.equal(JSON.stringify(h.record), before); assert.deepEqual(h.calls, []);
  h.click('[data-action="quiz-practice-0"]'); assert.equal(h.calls[0][1].reference.questionType, 'opposite');
});

test('尚未引入间隔卡的卦题来源只读，翻面不出现评分，返回恢复原来源焦点', () => {
  const cards = {}, h = harness([question('quiz')], { due: [], legacy: [], cards });
  const before = JSON.stringify(h.record);
  h.click('[data-action="quiz-source-0"]'); h.click('.flip-card'); h.flushFrames();
  assert.equal(h.mount.querySelector('.review-rating'), null);
  assert.match(h.mount.textContent, /只读|仅供核对/);
  assert.match(h.mount.textContent, /待校验/);
  h.click('.review-back'); h.flushFrames();
  assert.equal(h.document.activeElement, h.mount.querySelector('[data-action="quiz-source-0"]'));
  assert.equal(h.document.activeElement.scrolled?.block, 'center', 'restored source is brought into view');
  assert.equal(JSON.stringify(h.record), before); assert.deepEqual(cards, {});
});
