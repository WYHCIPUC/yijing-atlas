import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { createPageDom } from './helpers/quiz-page-dom.mjs';
import * as quizEngine from '../js/quiz-engine.js';
import * as learningProgress from '../js/learning-progress.js';
import * as quizSession from '../js/quiz-session.js';
import { loadAchievementState } from '../js/achievement-storage.js';

const source = readFileSync(new URL('../js/modes/quiz-mode.js', import.meta.url), 'utf8')
  .replace(/^import[\s\S]*?from '[^']+';\r?\n/gm, '').replaceAll('export function ', 'function ');
const reference = { sourceKind: 'quiz', questionId: 'quiz:opposite:111111', questionVersion: 'quiz-v1',
  questionType: 'opposite', targetCode: '111111', termId: null, lessonId: null };
const question = { type: 'opposite', reference, targetCode: '111111', question: '乾的错卦是？',
  answer: '000000', candidates: ['111111', '000000', '101010', '010101'], explanation: '六爻的阴阳全部翻转。' };
const weak = { ...reference, status: 'due', wrongCount: 1, lastWrongAt: '2026-10-25T01:00:00Z' };
const result = (extra = {}) => ({ correct: true, saved: true, stats: { correct: 1, total: 1 },
  changes: Object.fromEntries(['stats', 'weak', 'review', 'activity', 'achievement', 'legacy'].map(key => [key, { saved: true, applicable: key !== 'legacy' }])),
  recovery: null, error: null, ...extra });

function harness({ resolveError = null, resolvedQuestion = question, generated = question, legacy = [], weakItems = [weak], submit, createAttempt, dependencies = {} } = {}) {
  const dom = createPageDom(); const calls = { attempts: [], submits: [], navigation: [], generated: 0, resolved: [], oldWrites: 0 };
  const state = { hexagrams: question.candidates.map(binaryCode => ({ binaryCode, name: binaryCode === '111111' ? '乾' : '坤', fullName: '测试卦' })),
    almanacTerms: [], index: { byCode: new Map() } };
  state.hexagrams.forEach(hex => state.index.byCode.set(hex.binaryCode, hex));
  const context = vm.createContext({ window: dom.window, document: dom.document,
    generateQuestion: () => { calls.generated++; return generated; }, generateAlmanacQuestion: () => generated,
    resolveQuizQuestion: (app, value) => { calls.resolved.push(value); return resolveError ? { ok: false, reason: resolveError } : { ok: true, question: resolvedQuestion }; },
    loadStats: () => ({ correct: 0, total: 0 }), loadWrongBook: () => legacy,
    loadLearningRecord: () => ({ weakQuestions: {} }), getWeakQuestionsError: () => null, getQuizWeakQuestions: () => weakItems,
    createQuizAttempt: (item, options) => { const attempt = createAttempt ? createAttempt(item, options) : { id: `attempt-${calls.attempts.length}`, question: item, ...options }; calls.attempts.push(attempt); return attempt; },
    submitQuizAttempt: (attempt, picked) => { calls.submits.push([attempt, picked]); return submit ? submit(attempt, picked, weakItems) : result(); },
    checkAnswer: (item, picked) => item.answer === picked,
    recordResult: () => { calls.oldWrites++; return { correct: 1, total: 1, saved: true }; },
    recordActivity: () => ({ saved: true }), addWrong: () => true, removeWrong: () => true,
    addReviewCard: () => ({ saved: true }), createProgressEvent: value => value, processAchievementEvent: () => ({ saved: true }),
    ...dependencies,
  });
  vm.runInContext(source, context);
  const render = (entry = {}) => context.renderQuizMode(dom.mount, state, (...args) => calls.navigation.push(args), entry);
  return { ...dom, calls, render, weakItems };
}

test('精确回练使用完整引用，同一题重复输入只交给协调器一次', () => {
  const h = harness(); h.render({ wrongOnly: true, reference });
  assert.equal(h.calls.resolved[0], reference);
  const option = h.mount.querySelector('[data-code="000000"]');
  h.click(option); h.click(option);
  assert.equal(h.calls.submits.length, 1);
  assert.equal(h.calls.oldWrites, 0);
  assert.equal(h.calls.attempts[0].mode, 'review');
});

test('原题失效显示原因并可返回温故，不随机换题', () => {
  const h = harness({ resolveError: '原术语已调整，请回来源温习。' });
  h.render({ wrongOnly: true, reference, returnTo: { mode: 'review' } });
  assert.match(h.mount.textContent, /原术语已调整/);
  assert.equal(h.calls.generated, 0);
  assert.equal(h.mount.querySelectorAll('.quiz-option').length, 0);
  h.click('[data-action="quiz-return"]');
  assert.equal(h.calls.navigation[0][0], 'review');
});

test('无可用题显示空态和返回学习，未创建作答', () => {
  const h = harness({ generated: null, weakItems: [] }); h.render();
  assert.match(h.mount.textContent, /暂无可用题|没有可用题/);
  assert.equal(h.calls.attempts.length, 0);
  h.click('[data-action="quiz-learning"]'); assert.equal(h.calls.navigation[0][0], 'learning');
});

test('保存失败逐项说明，重试保留原题原答案，不重新判第二次作答', () => {
  let count = 0;
  const h = harness({ submit: () => ++count === 1 ? result({ saved: false,
    changes: { stats: { saved: true, applicable: true }, weak: { saved: false, applicable: true },
      review: { saved: false, applicable: true }, activity: { saved: true, applicable: true }, achievement: { saved: false, applicable: true } } }) : result() });
  h.render({ wrongOnly: true, reference }); h.click('[data-code="000000"]');
  assert.match(h.mount.textContent, /错题.*未.*保存|薄弱.*未.*保存/);
  assert.match(h.mount.textContent, /卦象.*未.*保存|复习卡.*未.*保存/);
  assert.match(h.mount.textContent, /成就.*未.*保存/);
  assert.doesNotMatch(h.mount.textContent, /已加入复习/);
  h.click('[data-action="quiz-retry"]');
  assert.equal(h.calls.attempts.length, 1); assert.equal(h.calls.submits.length, 2);
  assert.equal(h.calls.submits[0][0], h.calls.submits[1][0]); assert.equal(h.calls.submits[1][1], '000000');
});

test('末项以实际保存队列决定返回随机，失败不提前宣称清空', () => {
  const items = [weak];
  const h = harness({ weakItems: items, submit: () => { items.length = 0; return result(); } });
  h.render({ wrongOnly: true, reference }); h.click('[data-code="000000"]');
  assert.match(h.mount.querySelector('.quiz-next').textContent, /返回随机测验/);
  h.click('.quiz-next'); assert.equal(h.calls.attempts.at(-1).mode, 'random');
});

test('销毁后旧按钮与排队焦点回调不会写入或影响下一页面', () => {
  const h = harness(); const cleanup = h.render();
  const option = h.mount.querySelector('[data-code="000000"]');
  assert.equal(typeof cleanup, 'function'); cleanup(); cleanup();
  h.mount.innerHTML = '<h3 data-page-heading>新页面</h3>';
  h.click(option); h.flushFrames();
  assert.equal(h.calls.submits.length, 0); assert.equal(h.mount.querySelector('h3').focusCount, 0);
});

test('旧摘要单独标明未知题型并按legacy身份回练', () => {
  const h = harness({ legacy: ['111111'], weakItems: [] });
  h.render({ wrongOnly: true, legacyCode: '111111' });
  assert.match(h.mount.textContent, /原题型未保留/);
  assert.equal(h.calls.attempts[0]?.mode, 'legacy');
  assert.equal(h.calls.resolved.length, 0);
});

test('题目不能建立有效作答身份时显示不可用，不留可提交选项', () => {
  const h = harness({ createAttempt: () => null });
  h.render({ reference, returnTo: { mode: 'review' } });
  assert.equal(h.mount.querySelectorAll('.quiz-option').length, 0);
  assert.match(h.mount.textContent, /作答.*不可用|题目.*不可用/);
  h.click('[data-action="quiz-return"]'); assert.equal(h.calls.navigation[0][0], 'review');
  assert.equal(h.calls.submits.length, 0);
});

test('旧版本冲突保留原项，显示保留而不是已保存具体错题或已纠正', () => {
  const h = harness({ submit: () => result({ changes: { stats: { saved: true, applicable: true },
    weak: { saved: true, applicable: true, outcome: 'reference-mismatch' } },
    error: '原错题版本不同，已保留原记录；本次不会标记为已纠正。' }) });
  h.render({ reference }); h.click('[data-code="000000"]');
  const status = h.mount.querySelector('.quiz-storage-status').textContent;
  assert.match(status, /保留原记录/); assert.doesNotMatch(status, /具体错题记录已保存/);
  assert.equal(h.mount.querySelector('[data-action="quiz-retry"]').hidden, true);
  assert.equal(h.mount.querySelector('.quiz-next').textContent, '下一题 →');
});

test('术语题仍按almanac呈现，来源带真实方向引用并可回原规则', () => {
  const termReference = { sourceKind: 'almanac', questionId: 'almanac:jian:meaning-to-name', questionVersion: 'almanac-v1',
    questionType: 'meaning-to-name', targetCode: null, termId: 'jian', lessonId: null };
  const termQuestion = { type: 'almanac', reference: termReference, question: '该释义指哪个术语？', answer: 'jian', answerText: '建日',
    candidates: [{ code: 'jian', text: '建日' }, { code: 'chu', text: '除日' }, { code: 'man', text: '满日' }, { code: 'ping', text: '平日' }], explanation: '释义依据。' };
  const h = harness({ resolvedQuestion: termQuestion }); h.render({ reference: termReference });
  assert.match(h.mount.querySelector('.quiz-question').textContent, /历法辨识/);
  h.click('[data-code="jian"]'); h.click('[data-action="quiz-source"]');
  const [mode, entry] = h.calls.navigation[0];
  assert.equal(mode, 'learning'); assert.equal(entry.termId, 'jian');
  assert.equal(entry.quizReference, termReference); assert.equal(entry.returnTo.mode, 'quiz');
  assert.equal(entry.returnTo.entry.reference, termReference); assert.equal(entry.returnTo.entry.returnTo.mode, 'review');
});

test('失败的原弱项仍在队列，重复重试成功后旧按钮不能改下一轮', () => {
  let failed = true;
  const h = harness({ submit: () => result({ saved: !failed,
    changes: { stats: { applicable: true, saved: true }, weak: { applicable: true, saved: !failed } } }) });
  h.render({ reference }); h.click('[data-code="000000"]');
  assert.equal(h.mount.querySelector('.quiz-next').textContent, '下一题 →');
  const retry = h.mount.querySelector('[data-action="quiz-retry"]');
  failed = false; h.click(retry); h.click(retry);
  assert.equal(h.calls.submits.length, 2);
  const oldNext = h.mount.querySelector('.quiz-next'); h.click(oldNext);
  const currentPanel = h.mount.querySelector('.quiz-panel');
  h.click(retry); h.click(oldNext);
  assert.equal(h.mount.querySelector('.quiz-panel'), currentPanel); assert.equal(h.calls.submits.length, 2);
});

test('真实协调器与页面联通：错误保存失败只重试未存部分，再按原规则纠正', () => {
  const values = new Map(), blocked = new Set(['yijing-learning-record-v2']);
  const storage = { getItem: key => values.get(key) ?? null,
    setItem(key, value) { if (blocked.has(key)) throw new Error('quota'); values.set(key, value); },
    removeItem(key) { if (blocked.has(key)) throw new Error('quota'); values.delete(key); } };
  const h = harness({ createAttempt: quizSession.createQuizAttempt,
    submit: (attempt, picked) => quizSession.submitQuizAttempt(attempt, picked, { storage }),
    dependencies: { loadStats: () => quizEngine.loadStats(storage), loadWrongBook: () => quizEngine.loadWrongBook(storage),
      loadLearningRecord: () => learningProgress.loadLearningRecord(storage),
      getQuizWeakQuestions: learningProgress.getQuizWeakQuestions, getWeakQuestionsError: learningProgress.getWeakQuestionsError,
      resolveQuizQuestion: quizEngine.resolveQuizQuestion } });
  const dispose = h.render(); h.click('[data-code="111111"]');
  assert.equal(quizEngine.loadStats(storage).total, 1);
  assert.equal(learningProgress.getQuizWeakQuestions(learningProgress.loadLearningRecord(storage)).length, 0);
  assert.match(h.mount.querySelector('.quiz-storage-status').textContent, /具体错题记录未能保存/);
  blocked.clear(); h.click('[data-action="quiz-retry"]');
  assert.equal(quizEngine.loadStats(storage).total, 1);
  const [item] = learningProgress.getQuizWeakQuestions(learningProgress.loadLearningRecord(storage));
  assert.equal(item.questionId, reference.questionId); assert.equal(item.wrongCount, 1);
  assert.equal(values.has('yijing-quiz-wrong'), false);
  dispose(); h.render({ reference: item, returnTo: { mode: 'review' } });
  h.click('[data-code="000000"]');
  assert.equal(quizEngine.loadStats(storage).total, 2);
  assert.equal(learningProgress.loadLearningRecord(storage).weakQuestions[item.questionId].status, 'resolved');
  assert.match(h.mount.querySelector('.quiz-storage-status').textContent, /原规则已有效答对，该项已纠正/);
  assert.equal(h.mount.querySelector('.quiz-next').textContent, '返回随机测验');
  assert.deepEqual(loadAchievementState(storage).metrics.quizRecoveries, [reference.questionId]);
});

test('精确引用与旧摘要同时传入时明确冲突，不生成或选择任一题', () => {
  const h = harness({ legacy: ['111111'] }); h.render({ reference, legacyCode: '111111' });
  assert.match(h.mount.textContent, /回练来源冲突/);
  assert.equal(h.calls.resolved.length, 0); assert.equal(h.calls.generated, 0);
  assert.equal(h.calls.attempts.length, 0); assert.equal(h.mount.querySelectorAll('.quiz-option').length, 0);
});
