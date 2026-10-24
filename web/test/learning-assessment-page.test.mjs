import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { createProgressEvent } from '../js/achievement-engine.js';
import { getAchievementStorageKey, loadAchievementState, processAchievementEvent } from '../js/achievement-storage.js';
import { createAssessmentSession, gradeAssessment, recommendLesson } from '../js/learning-assessment.js';
import { getLesson, getLessonRubric, LEARNING_LESSONS, LEARNING_LEVELS } from '../js/learning-curriculum.js';
import { getLearningRecordKey, loadLearningRecord, recordActivity, recordLearningAssessment, recordOralReview } from '../js/learning-progress.js';
import * as learningProgress from '../js/learning-progress.js';

const source = readFileSync(new URL('../js/learning-assessment-page.js', import.meta.url), 'utf8')
  .replace(/^import[\s\S]*?from '[^']+';\r?\n/gm, '')
  .replace('export function renderLearningAssessmentPage', 'function renderLearningAssessmentPage');
const profileSyncSource = readFileSync(new URL('../js/modes/learning-mode.js', import.meta.url), 'utf8')
  .match(/^function syncAchievementEvidence\([\s\S]*?^}/m)[0];
const bank = Array.from({ length: 3 }, (_, index) => ({
  id: `q${index}`, lessonId: 'l1-4', levelId: 'L1', prompt: `题目${index}`,
  kind: 'recall', questionVersion: 'curriculum-v1', targetCode: null, termId: null,
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
    getCourseWeakQuestions: (...args) => learningProgress.getCourseWeakQuestions(...args),
    getWeakQuestionsError: (...args) => learningProgress.getWeakQuestionsError(...args),
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

test('原题回练保留默认三题，重绘沿用会话而不同原题开启新卷', () => {
  const questionBank = [...bank, { ...bank[0], id: 'q3' }];
  const harness = createHarness({ questionBank });
  const entry = { initialLessonId: 'l1-4', requiredQuestionId: 'q3', requiredQuestionVersion: 'curriculum-v1', returnTo: 'review' };
  harness.render(entry);
  assert.equal(harness.sessions[0].questions.length, 3);
  assert.equal(harness.sessions[0].questions.filter(item => item.id === 'q3').length, 1);
  harness.choose(0, 'b');
  harness.render(entry);
  assert.equal(harness.sessions.length, 1);
  harness.render({ ...entry, requiredQuestionId: 'q0' });
  assert.equal(harness.sessions.length, 2, '同课不同原题不能复用旧卷');
});

test('失效原题或版本不随机替题，保留回原课和温故的真实回调', () => {
  for (const required of [{ requiredQuestionId: 'removed', requiredQuestionVersion: 'curriculum-v1' },
    { requiredQuestionId: 'q0', requiredQuestionVersion: 'curriculum-v0' }]) {
    const harness = createHarness();
    const calls = [];
    harness.render({ initialLessonId: 'l1-4', ...required, returnTo: 'review', onNavigate: (...args) => calls.push(args) });
    assert.equal(harness.sessions.length, 0);
    assert.match(harness.mount.innerHTML, /题目已调整，请回原课温习/);
    harness.mount.querySelector('[data-action="weak-source"]').events.click();
    assert.equal(calls[0][0], 'path');
    assert.equal(calls[0][1], 'l1-4');
    assert.equal(calls[0][2].requiredQuestionId, required.requiredQuestionId);
    harness.mount.querySelector('[data-action="return-review"]').events.click();
    assert.equal(calls[1][0], 'review-mode');
  }
});

test('错题保存失败不显示已加入，原会话重试成功后按持久化记录显示', () => {
  const harness = createHarness({ blockedKeys: [getLearningRecordKey()] });
  harness.render();
  for (let index = 0; index < 3; index += 1) harness.choose(index, 'b');
  harness.submit();
  assert.match(harness.mount.innerHTML, /课程温习记录未保存/);
  assert.doesNotMatch(harness.mount.innerHTML, /已加入课程温习/);
  const session = harness.sessions[0];
  harness.blocked.clear();
  harness.mount.querySelector('[data-action="retry-save"]').events.click();
  assert.equal(harness.sessions.length, 1);
  assert.equal(loadLearningRecord(harness.storage).weakQuestions.q0.lastSessionId, session.id);
  assert.match(harness.mount.innerHTML, /已加入课程温习/);
  const writes = harness.writes.length;
  harness.render();
  assert.equal(harness.writes.length, writes);
});

test('结果原课携带原题，原题回练新会话答对后才显示本轮已纠正', () => {
  const harness = createHarness();
  const calls = [];
  harness.render({ initialLessonId: 'l1-4', returnTo: 'review', onNavigate: (...args) => calls.push(args) });
  for (let index = 0; index < 3; index += 1) harness.choose(index, 'b');
  harness.submit();
  assert.ok(harness.mount.querySelector('[data-action="weak-source-0"]'));
  harness.mount.querySelector('[data-action="weak-source-0"]').events.click();
  assert.equal(calls[0][0], 'path');
  assert.equal(calls[0][2].requiredQuestionId, harness.sessions[0].questions[0].id);
  const firstId = harness.sessions[0].id;
  harness.mount.querySelector('[data-action="weak-practice-0"]').events.click();
  assert.equal(harness.sessions.length, 2);
  assert.notEqual(harness.sessions[1].id, firstId);
  for (let index = 0; index < 3; index += 1) harness.choose(index);
  harness.submit();
  assert.match(harness.mount.innerHTML, /本轮已纠正/);
  assert.equal(learningProgress.getCourseWeakQuestions(loadLearningRecord(harness.storage)).length, 0);
  harness.mount.querySelector('[data-action="return-review"]').events.click();
  assert.equal(calls.at(-1)[0], 'review-mode');
});

test('结果内新开原题回练后，父页面同入口重绘仍保留该新卷及答案', () => {
  const harness = createHarness();
  harness.render();
  for (let index = 0; index < 3; index += 1) harness.choose(index, 'b');
  harness.submit();
  harness.mount.querySelector('[data-action="weak-practice-0"]').events.click();
  const session = harness.sessions.at(-1);
  harness.choose(0, 'b');
  harness.render();
  assert.equal(harness.sessions.length, 2);
  assert.equal(harness.sessions.at(-1).id, session.id);
  assert.ok(harness.mount.querySelector('input[name="question-0"]:checked'));
});

test('结果重绘从持久化读取状态，不把已移除的旧记录仍说成已加入', () => {
  const harness = createHarness();
  harness.render();
  for (let index = 0; index < 3; index += 1) harness.choose(index, 'b');
  harness.submit();
  const record = loadLearningRecord(harness.storage);
  delete record.weakQuestions;
  harness.storage.setItem(getLearningRecordKey(), JSON.stringify(record));
  harness.render();
  assert.doesNotMatch(harness.mount.innerHTML, /已加入课程温习/);
  assert.match(harness.mount.innerHTML, /未读取到本题已保存/);
  assert.equal(harness.sessions.length, 1);
});

for (const [field, change] of [
  ['questionType', { questionType: 'evidence' }],
  ['targetCode', { targetCode: '111111' }],
  ['termId', { termId: 'old-term' }],
  ['sourceKind', { sourceKind: 'almanac', termId: 'old-term' }],
]) {
  for (const status of ['due', 'resolved']) {
    test(`结果不把 ${field} 不同的 ${status} 旧温习记录归于当前题`, () => {
      const harness = createHarness();
      harness.render();
      for (let index = 0; index < 3; index += 1) harness.choose(index, 'b');
      harness.submit();
      const record = loadLearningRecord(harness.storage);
      const old = { ...record.weakQuestions.q0, ...change, status,
        resolvedAt: status === 'resolved' ? '2026-10-25T08:01:00Z' : null };
      record.weakQuestions.q0 = old;
      harness.storage.setItem(getLearningRecordKey(), JSON.stringify(record));
      harness.mount.querySelector('[data-action="back"]').events.click();
      harness.render();
      const session = harness.sessions.at(-1);
      for (let index = 0; index < 3; index += 1) harness.choose(index, status === 'resolved' ? 'a' : 'b');
      harness.submit();
      const saved = loadLearningRecord(harness.storage);
      assert.deepEqual(saved.weakQuestions.q0, old, '数据层应保留不同引用的原始证据');
      assert.equal(saved.lessons['l1-4'].attempts, 2, '当前交卷本身仍成功保存');
      const questionIndex = session.questions.findIndex(item => item.id === 'q0');
      const statuses = [...harness.mount.innerHTML.matchAll(/<p class="course-weak-status">([^<]+)<\/p>/g)];
      const message = statuses[questionIndex][1];
      assert.equal(message, '原有温习记录与本题引用不同，未改动旧记录。');
      assert.doesNotMatch(message, /已加入|已纠正|已有纠正|本题仍在/);
    });
  }
}

test('温故发起的原题回练取消返回温故且不保存答卷', () => {
  const harness = createHarness();
  const calls = [];
  harness.render({ initialLessonId: 'l1-4', requiredQuestionId: 'q0', requiredQuestionVersion: 'curriculum-v1',
    returnTo: 'review', onNavigate: (...args) => calls.push(args) });
  assert.match(harness.mount.innerHTML, /data-action="cancel">返回温故队列/);
  harness.choose(0);
  harness.mount.querySelector('[data-action="cancel"]').events.click();
  assert.equal(calls[0][0], 'review-mode');
  assert.equal(harness.writes.length, 0);
});

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

test('已处理ID缺少成绩凭据时显示缺证据，不重计分或生成成就', () => {
  const harness = createHarness();
  harness.render();
  const sessionId = harness.sessions[0].id;
  const old = { version: 2, lessons: {}, spotChecks: [], exams: [], oralReviews: [], processedAssessmentIds: [sessionId] };
  harness.storage.setItem(getLearningRecordKey(), JSON.stringify(old));
  for (let index = 0; index < 3; index += 1) harness.choose(index);
  harness.submit();
  assert.deepEqual(loadLearningRecord(harness.storage), old);
  assert.match(harness.mount.innerHTML, /本轮标识已处理/);
  assert.match(harness.mount.innerHTML, /未保留.*成绩.*无法补记成就/);
  assert.equal(harness.mount.querySelector('[data-action="retry-save"]'), null);
  assert.equal(loadAchievementState(harness.storage).metrics.trigramRounds.length, 0);
  harness.syncProfile();
  assert.equal(loadAchievementState(harness.storage).metrics.trigramRounds.length, 0);
  assert.equal(loadAchievementState(harness.storage).processedKeys.length, 0);
});

test('已有正式ID全部带真实凭据时，其他旧课程仍按旧汇总回补', () => {
  const harness = createHarness();
  const at = '2026-10-24T00:00:00Z';
  harness.storage.setItem(getLearningRecordKey(), JSON.stringify({
    version: 2, lessons: { 'l1-4': { viewedAt: at, lastStudiedAt: at, attempts: 1, bestScore: 1 } },
    spotChecks: [], exams: [], oralReviews: [], processedAssessmentIds: ['other-lesson'],
    assessmentSessions: [{ sessionId: 'other-lesson', kind: 'lesson', lessonId: 'l1-1', correct: 0, total: 3, at }],
  }));
  harness.syncProfile();
  assert.deepEqual(loadAchievementState(harness.storage).metrics.trigramRounds, [`learning-record:assessed:l1-4:${at}`]);
});

test('已有真实低分凭据重交高分不改变成绩，也不据当前答案回补高分成就', () => {
  const harness = createHarness();
  harness.render();
  const sessionId = harness.sessions[0].id;
  const at = '2026-10-24T00:00:00Z';
  const old = { version: 2, lessons: { 'l1-4': { viewedAt: at, lastStudiedAt: at, attempts: 1, bestScore: 0 } }, spotChecks: [], exams: [], oralReviews: [], processedAssessmentIds: [sessionId],
    assessmentSessions: [{ sessionId, kind: 'lesson', lessonId: 'l1-4', correct: 0, total: 3, at }] };
  harness.storage.setItem(getLearningRecordKey(), JSON.stringify(old));
  for (let index = 0; index < 3; index += 1) harness.choose(index);
  harness.submit();
  assert.deepEqual(loadLearningRecord(harness.storage), old);
  assert.equal(loadAchievementState(harness.storage).metrics.trigramRounds.length, 0);
  assert.match(harness.mount.innerHTML, /已保存成绩为 0\/3/);
  harness.syncProfile();
  assert.equal(loadAchievementState(harness.storage).metrics.trigramRounds.length, 0);
});

test('正式ID存在但没有凭据时修习谱不拿聚合最高分补造该轮成就', () => {
  const harness = createHarness();
  const at = '2026-10-24T00:00:00Z';
  harness.storage.setItem(getLearningRecordKey(), JSON.stringify({
    version: 2, lessons: { 'l1-4': { viewedAt: at, lastStudiedAt: at, attempts: 1, bestScore: 1 } },
    spotChecks: [], exams: [], oralReviews: [], processedAssessmentIds: ['missing-receipt'],
  }));
  harness.syncProfile();
  assert.equal(loadAchievementState(harness.storage).metrics.trigramRounds.length, 0);
  assert.equal(loadAchievementState(harness.storage).processedKeys.length, 0);
});
