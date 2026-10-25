import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import * as engine from '../js/review-engine.js';
import * as session from '../js/review-session.js';
import * as progress from '../js/learning-progress.js';
import { createProgressEvent } from '../js/achievement-engine.js';
import { loadAchievementState, processAchievementEvent } from '../js/achievement-storage.js';
import { renderLearningFeedback } from '../js/learning-feedback.js';
import { getHexagramContentProvenance } from '../js/content-provenance.js';
import { createPageDom } from './helpers/quiz-page-dom.mjs';

const source = readFileSync(new URL('../js/modes/review-mode.js', import.meta.url), 'utf8')
  .replace(/^import[\s\S]*?from '[^']+';\r?\n/gm, '').replaceAll('export function ', 'function ');
const keys = { card: 'yijing-review-cards', activity: 'yijing-activity-v1', achievement: 'yijing.achievements.v1' };
const original = { code: '111111', stage: 2, due: 100, introducedAt: 1, lapses: 0, reps: 2, lastReview: 50 };
function harness({ blocked = [], cards = { '111111': original } } = {}) {
  const dom = createPageDom(), calls = [], values = new Map([[keys.card, JSON.stringify(cards)]]);
  const denied = new Set(blocked), writes = new Map(), submissions = [];
  const storage = { getItem: key => values.get(key) ?? null, setItem(key, value) {
    if (denied.has(key)) throw new Error('synthetic quota');
    values.set(key, String(value)); writes.set(key, (writes.get(key) || 0) + 1);
  } };
  let now = new Date();
  dom.window.setTimeout = callback => dom.window.requestAnimationFrame(callback);
  const context = vm.createContext({ window: dom.window, document: dom.document,
    loadReviewCards: () => engine.loadReviewCards(storage), getDueCards: engine.getDueCards,
    saveReview: (...args) => engine.saveReview(...args, storage),
    createReviewAttempt: session.createReviewAttempt,
    submitReviewAttempt: (token, rating) => { const result = session.submitReviewAttempt(token, rating, { storage, now }); submissions.push(result); return result; },
    createProgressEvent, processAchievementEvent: event => processAchievementEvent(event, { storage }),
    recordActivity: () => progress.recordActivity(now, storage),
    loadLearningRecord: () => progress.loadLearningRecord(storage), getWeakQuestionsError: progress.getWeakQuestionsError,
    getCourseWeakQuestions: progress.getCourseWeakQuestions, getQuizWeakQuestions: progress.getQuizWeakQuestions,
    buildLearningQuestionBank: () => [], getLesson: () => null, loadWrongBook: () => [],
    renderLearningFeedback, getHexagramContentProvenance, hexagramSvg: () => '<svg></svg>',
  });
  vm.runInContext(source, context);
  const hex = { binaryCode: '111111', number: 1, name: '乾', fullName: '乾为天', trigramLower: '111', trigramUpper: '111', judgement: '元，亨，利，贞。' };
  const state = { index: { byCode: new Map([['111111', hex]]) }, trigrams: [{ binaryCode: '111', name: '乾', nature: '天' }] };
  const cleanup = context.renderReviewMode(dom.mount, state, (...args) => calls.push(args));
  const flip = () => { dom.click('.flip-card'); dom.flushFrames(); };
  return { ...dom, values, denied, writes, storage, calls, cleanup, submissions, flip,
    setNow: value => { now = value; }, card: () => JSON.parse(values.get(keys.card))['111111'] };
}

test('评分只能在翻面后提交，明确自评并按结果、依据、记录、行动顺序呈现', () => {
  const h = harness(), early = h.mount.querySelector('[data-rate="2"]');
  h.click(early); assert.equal(h.writes.size, 0, 'hidden rating cannot submit');
  h.flip();
  assert.deepEqual(h.mount.querySelectorAll('[data-rate]').map(button => button.textContent), ['暂未想起', '有些模糊', '能清楚复述']);
  h.click('[data-rate="2"]'); h.flushFrames();
  const feedback = h.mount.querySelector('.review-feedback');
  assert.ok(feedback); assert.equal(feedback.getAttribute('aria-live'), null);
  assert.deepEqual(feedback.querySelectorAll('[data-feedback-section]').map(section => section.dataset.feedbackSection), ['result', 'basis', 'changes', 'actions']);
  assert.match(feedback.textContent, /基于你的自评/); assert.doesNotMatch(feedback.textContent, /回答正确|已经掌握/);
  assert.match(feedback.textContent, /4 日后/); assert.match(feedback.textContent, /待校验/);
  assert.equal(feedback.querySelectorAll('[data-feedback-action="primary"]').length, 1);
  assert.ok(feedback.querySelectorAll('[data-feedback-action="secondary"]').length <= 2);
  assert.equal(h.document.activeElement, feedback.querySelector('[data-review-result]'));
});

for (const [part, key] of Object.entries(keys)) {
  test(`${part} 写失败保留答案与原评分，重试仅补失败项且快速重复不重复排期`, () => {
    const h = harness({ blocked: [key] }); h.flip();
    const chosen = h.mount.querySelector('[data-rate="1"]'), other = h.mount.querySelector('[data-rate="2"]');
    h.click(chosen); h.flushFrames();
    assert.ok(h.mount.querySelector('#review-answer'));
    assert.match(h.mount.querySelector('.review-feedback').textContent, /有些模糊/);
    assert.match(h.mount.querySelector('.review-storage-status').textContent, /未能保存/);
    assert.doesNotMatch(h.mount.querySelector('.review-storage-status').textContent, /复习已完成/);
    assert.equal(h.document.activeElement, h.mount.querySelector('[data-action="review-retry"]'));
    h.click(chosen); h.click(other); assert.equal(h.submissions.length, 1);
    const savedWrites = new Map(h.writes), submittedAt = h.submissions[0].reviewedAt;
    if (part === 'card') { assert.deepEqual(h.card(), original); assert.equal(h.values.has(keys.achievement), false); }
    else { assert.equal(h.card().reps, 3); assert.equal(h.card().stage, 2); }
    h.denied.clear(); h.setNow(new Date(submittedAt + 2 * 86400000));
    const retry = h.mount.querySelector('[data-action="review-retry"]'); h.click(retry); h.flushFrames();
    assert.equal(h.submissions.at(-1).reviewedAt, submittedAt);
    assert.equal(h.card().lastReview, submittedAt); assert.equal(h.card().reps, 3); assert.equal(h.card().stage, 2);
    for (const [savedKey, count] of savedWrites) assert.equal(h.writes.get(savedKey), count, savedKey);
    assert.match(h.mount.querySelector('.review-storage-status').textContent, /复习卡已保存/);
    assert.ok(h.mount.querySelector('[data-action="review-next"]'));
    h.click(retry); assert.equal(h.submissions.length, 2);
    assert.equal(loadAchievementState(h.storage).processedKeys.filter(key => key.startsWith('review:')).length, 1);
  });
}

test('成功反馈重显不增加证据，核对卦辞可返回反馈，再继续才离开本卡', () => {
  const h = harness(); h.flip(); h.click('[data-rate="2"]'); h.flushFrames();
  const before = [...h.writes];
  h.click('[data-action="review-source"]'); h.flushFrames();
  assert.equal(h.document.activeElement, h.mount.querySelector('#review-answer'));
  h.click('[data-action="review-feedback-return"]'); h.flushFrames();
  assert.equal(h.document.activeElement, h.mount.querySelector('[data-review-result]'));
  assert.deepEqual([...h.writes], before);
  h.click('[data-action="review-next"]'); h.flushFrames();
  assert.match(h.mount.textContent, /今日卦象间隔卡已完成/);
  assert.equal(h.document.activeElement, h.mount.querySelector('[data-page-heading]'));
});

test('同卡快照被其他页面更新时不覆盖，反馈给返回队列而非成功排期', () => {
  const h = harness(); h.flip();
  h.values.set(keys.card, JSON.stringify({ '111111': { ...original, reps: 8 } }));
  h.click('[data-rate="0"]'); h.flushFrames();
  assert.equal(h.card().reps, 8); assert.equal(h.writes.size, 0);
  assert.match(h.mount.querySelector('.review-storage-status').textContent, /记录已变化/);
  assert.doesNotMatch(h.mount.querySelector('.review-storage-status').textContent, /复习卡已保存/);
  h.click('[data-action="review-queue"]'); h.flushFrames();
  assert.ok(h.mount.querySelector('.review-due-list'));
});

test('非法评分与未翻面评分不写记录；cleanup阻止旧按钮、重试和迟到焦点', () => {
  const h = harness({ blocked: [keys.activity] }); h.flip();
  const invalid = h.mount.querySelector('[data-rate="0"]'); invalid.dataset.rate = '2junk';
  h.click(invalid); assert.equal(h.writes.size, 0);
  h.click('[data-rate="2"]');
  const retry = h.mount.querySelector('[data-action="review-retry"]'), previousFocus = h.document.activeElement;
  const before = [...h.writes]; h.cleanup(); h.denied.clear(); h.click(retry); h.flushFrames();
  assert.deepEqual([...h.writes], before); assert.equal(h.document.activeElement, previousFocus);
});
