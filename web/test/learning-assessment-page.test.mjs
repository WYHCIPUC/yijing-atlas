import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { createProgressEvent } from '../js/achievement-engine.js';
import { getAchievementStorageKey, loadAchievementState, processAchievementEvent } from '../js/achievement-storage.js';
import { createAssessmentSession, gradeAssessment, recommendLesson } from '../js/learning-assessment.js';
import { getLesson, getLessonRubric, LEARNING_LESSONS, LEARNING_LEVELS } from '../js/learning-curriculum.js';
import { getLearningRecordKey, loadLearningRecord, recordActivity, recordLearningAssessment, recordOralReview } from '../js/learning-progress.js';

const source = readFileSync(new URL('../js/learning-assessment-page.js', import.meta.url), 'utf8')
  .replace(/^import[\s\S]*?from '[^']+';\r?\n/gm, '')
  .replace('export function renderLearningAssessmentPage', 'function renderLearningAssessmentPage');
const profileSyncSource = readFileSync(new URL('../js/modes/learning-mode.js', import.meta.url), 'utf8')
  .match(/^function syncAchievementEvidence\([\s\S]*?^}/m)[0];
const bank = Array.from({ length: 3 }, (_, index) => ({
  id: `q${index}`, lessonId: 'l1-4', levelId: 'L1', prompt: `题目${index}`,
  answer: 'a', options: [{ value: 'a', label: '正答' }, { value: 'b', label: '误答' }],
}));

function createElement() {
  return {
    events: {}, textContent: '', value: '', dataset: {}, disabled: false,
    addEventListener(type, handler) { this.events[type] = handler; },
    focus() { this.focused = true; },
    insertAdjacentHTML(position, html) { this.inserted = html; },
  };
}

function createMount() {
  const mount = {
    html: '', nodes: new Map(), radios: [], scrollTop: 0,
    set innerHTML(html) {
      this.html = html;
      this.nodes = new Map();
      this.radios = [...html.matchAll(/<input type="radio" name="([^"]+)" value="([^"]+)"([^>]*)/g)]
        .map(([, name, value, rest]) => ({ ...createElement(), name, value, checked: /\bchecked\b/.test(rest) }));
      for (const [, action] of html.matchAll(/data-action="([^"]+)"/g)) this.nodes.set(`[data-action="${action}"]`, createElement());
      for (const [, field] of html.matchAll(/data-field="([^"]+)"/g)) this.nodes.set(`[data-field="${field}"]`, createElement());
      for (const selector of ['.assessment-form', '.assessment-status', '.assessment-save-status', '[data-page-heading]', '.oral-review-output', '.assessment-result p']) {
        this.nodes.set(selector, createElement());
      }
      const marker = html.match(/data-assessment-session="([^"]+)"/);
      if (marker) this.nodes.set('[data-assessment-session]', { dataset: { assessmentSession: marker[1] } });
    },
    get innerHTML() { return this.html; },
    querySelector(selector) {
      const radio = selector.match(/^input\[name="([^"]+)"\](:checked)?$/);
      if (radio) return this.radios.find((item) => item.name === radio[1] && (!radio[2] || item.checked)) || null;
      return this.nodes.get(selector) || null;
    },
    querySelectorAll() { return []; },
    closest() { return null; },
  };
  return mount;
}

function createHarness({ blockedKeys = [], questionBank = bank } = {}) {
  const values = new Map();
  const blocked = new Set(blockedKeys);
  const writes = [];
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem(key, value) {
      writes.push(key);
      if (blocked.has(key)) throw new Error('quota');
      values.set(key, value);
    },
  };
  const sessions = [];
  const context = vm.createContext({
    window: { requestAnimationFrame: (callback) => callback() },
    createProgressEvent,
    processAchievementEvent: (event) => processAchievementEvent(event, { storage }),
    createAssessmentSession: (kind, questions, options) => {
      const session = createAssessmentSession(kind, questions, { ...options, random: () => 0.25 });
      if (session) sessions.push(session);
      return session;
    },
    gradeAssessment, recommendLesson, getLesson, getLessonRubric, LEARNING_LESSONS, LEARNING_LEVELS,
    buildLearningQuestionBank: () => questionBank,
    loadLearningRecord: () => loadLearningRecord(storage),
    recordLearningAssessment: (kind, result) => recordLearningAssessment(kind, result, new Date('2026-10-25T08:00:00Z'), storage),
    recordActivity: () => recordActivity(new Date('2026-10-25T08:00:00Z'), storage),
    recordOralReview,
    loadReviewConfig: () => ({ endpoint: '' }),
  });
  vm.runInContext(source, context);
  vm.runInContext(profileSyncSource, context);
  const mount = createMount();
  const render = (options = { initialLessonId: 'l1-4' }) => context.renderLearningAssessmentPage(mount, {}, options);
  const choose = (index, value = 'a') => {
    const question = sessions.at(-1).questions[index];
    const optionIndex = question.options.findIndex((option) => option.value === value);
    const radio = mount.radios.find((item) => item.name === `question-${index}` && item.value === String(optionIndex));
    mount.radios.filter((item) => item.name === radio.name).forEach((item) => { item.checked = item === radio; });
    mount.querySelector('.assessment-form').events.change?.({ target: radio });
  };
  const submit = () => mount.querySelector('.assessment-form').events.submit({ preventDefault() {} });
  const syncProfile = () => context.syncAchievementEvidence(loadLearningRecord(storage));
  return { mount, sessions, storage, writes, blocked, render, choose, submit, syncProfile };
}

test('真实交卷处理函数重复触发和结果重绘只计一次，新一轮独立', () => {
  const harness = createHarness();
  harness.render();
  for (let index = 0; index < 3; index += 1) harness.choose(index);
  const submit = harness.mount.querySelector('.assessment-form').events.submit;
  submit({ preventDefault() {} });
  submit({ preventDefault() {} });
  harness.render();
  assert.equal(harness.sessions.length, 1);
  assert.match(harness.mount.innerHTML, /assessment-result/);
  assert.equal(loadLearningRecord(harness.storage).lessons['l1-4'].attempts, 1);
  assert.equal(loadAchievementState(harness.storage).metrics.trigramRounds.length, 1);
  harness.mount.querySelector('[data-action="back"]').events.click();
  harness.render();
  assert.equal(harness.sessions.length, 2);
  for (let index = 0; index < 3; index += 1) harness.choose(index);
  harness.submit();
  assert.equal(loadLearningRecord(harness.storage).lessons['l1-4'].attempts, 2);
  assert.equal(loadAchievementState(harness.storage).metrics.trigramRounds.length, 2);
});

test('本轮重绘保留题序与已选答案，离开后不恢复未提交卷', () => {
  const harness = createHarness();
  harness.render();
  harness.choose(0, 'b');
  const first = harness.sessions[0];
  harness.render();
  assert.equal(harness.sessions.length, 1);
  assert.equal(harness.mount.querySelector('input[name="question-0"]:checked').value,
    String(first.questions[0].options.findIndex((option) => option.value === 'b')));
  harness.mount.innerHTML = '<section>其他学习页</section>';
  harness.render();
  assert.equal(harness.sessions.length, 2);
  assert.equal(harness.mount.querySelector('input[name="question-0"]:checked'), null);
});

test('重绘前已脱离页面的取消处理不能撤销已交卷结果', () => {
  const harness = createHarness();
  harness.render();
  const staleCancel = harness.mount.querySelector('[data-action="cancel"]').events.click;
  harness.render();
  for (let index = 0; index < 3; index += 1) harness.choose(index);
  harness.submit();
  staleCancel();
  assert.match(harness.mount.innerHTML, /assessment-result/);
  assert.equal(loadLearningRecord(harness.storage).lessons['l1-4'].attempts, 1);
});

test('未答和篡改选项定位首个未答题，取消不保存', () => {
  const harness = createHarness();
  harness.render();
  harness.choose(0);
  harness.submit();
  assert.match(harness.mount.querySelector('.assessment-status').textContent, /第 2 题/);
  assert.equal(harness.mount.querySelector('input[name="question-1"]').focused, true);
  harness.choose(1);
  harness.choose(2);
  harness.mount.querySelector('input[name="question-1"]:checked').value = '999';
  assert.doesNotThrow(() => harness.submit());
  assert.match(harness.mount.querySelector('.assessment-status').textContent, /第 2 题/);
  harness.mount.querySelector('[data-action="cancel"]').events.click();
  assert.equal(harness.writes.length, 0);
});

test('成绩保存失败可读且可重试，重试与重绘复用本轮', () => {
  const harness = createHarness({ blockedKeys: [getLearningRecordKey()] });
  harness.render();
  for (let index = 0; index < 3; index += 1) harness.choose(index);
  harness.submit();
  assert.match(harness.mount.innerHTML, /未能保存/);
  assert.ok(harness.mount.querySelector('[data-action="retry-save"]'));
  assert.equal(loadAchievementState(harness.storage).metrics.trigramRounds.length, 0);
  harness.blocked.clear();
  harness.mount.querySelector('[data-action="retry-save"]').events.click();
  harness.render();
  assert.equal(harness.sessions.length, 1);
  assert.equal(loadLearningRecord(harness.storage).lessons['l1-4'].attempts, 1);
  assert.equal(loadAchievementState(harness.storage).metrics.trigramRounds.length, 1);
});

test('新用户抽查空态说明先学一课并可返回', () => {
  const harness = createHarness();
  harness.render({});
  harness.mount.querySelector('[data-action="spot-check"]').events.click();
  assert.match(harness.mount.innerHTML, /先.*一课/);
  assert.ok(harness.mount.querySelector('[data-action="back"]'));
  assert.equal(harness.writes.length, 0);
});

test('仅成就保存失败时重试不重写成绩，沿用原session证据', () => {
  const harness = createHarness({ blockedKeys: [getAchievementStorageKey()] });
  harness.render();
  for (let index = 0; index < 3; index += 1) harness.choose(index);
  harness.submit();
  assert.match(harness.mount.innerHTML, /成就证据未能保存/);
  assert.equal(loadLearningRecord(harness.storage).lessons['l1-4'].attempts, 1);
  harness.blocked.clear();
  harness.mount.querySelector('[data-action="retry-save"]').events.click();
  assert.equal(harness.writes.filter((key) => key === getLearningRecordKey()).length, 1);
  assert.equal(loadAchievementState(harness.storage).metrics.trigramRounds.length, 1);
  assert.match(harness.mount.innerHTML, /本轮成绩与学习记录已保存/);
});

test('小试交卷后进入修习谱不以旧时间戳再计同轮证据', () => {
  const harness = createHarness();
  harness.render();
  for (let index = 0; index < 3; index += 1) harness.choose(index);
  harness.submit();
  harness.syncProfile();
  harness.syncProfile();
  assert.equal(loadLearningRecord(harness.storage).lessons['l1-4'].attempts, 1);
  assert.equal(loadAchievementState(harness.storage).metrics.trigramRounds.length, 1);
});

test('修习谱回补采用本轮实际成绩，旧无session证据保持兼容', () => {
  const harness = createHarness();
  const originalAt = '2026-08-07T08:00:00.000Z';
  harness.storage.setItem(getLearningRecordKey(), JSON.stringify({
    version: 2,
    lessons: { 'l1-4': { viewedAt: originalAt, lastStudiedAt: originalAt, attempts: 1, bestScore: 1 } },
    spotChecks: [], exams: [], oralReviews: [],
  }));
  harness.render();
  for (let index = 0; index < 3; index += 1) harness.choose(index, 'b');
  harness.submit();
  harness.syncProfile();
  harness.syncProfile();
  const record = loadLearningRecord(harness.storage);
  const achievements = loadAchievementState(harness.storage);
  assert.equal(record.lessons['l1-4'].attempts, 2);
  assert.equal(record.assessmentSessions.length, 1, '只给本次真实题卷保存session');
  assert.deepEqual(achievements.metrics.trigramRounds, [`learning-record:assessed:l1-4:${originalAt}`]);
});
