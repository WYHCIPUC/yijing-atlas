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
import { evaluateRecitation } from '../js/learning-review.js';
import { renderLearningFeedback } from '../js/learning-feedback.js';

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
    removeEventListener(type, handler) { if (this.events[type] === handler) delete this.events[type]; },
    focus() { this.focused = true; },
    scrollIntoView(options) { this.scrolled = options; },
    insertAdjacentHTML(position, html) { this.inserted = html; },
  };
}

function createMount() {
  const mount = {
    html: '', nodes: new Map(), radios: [], scores: [], scrollTop: 0,
    set innerHTML(html) {
      this.html = html;
      this.nodes = new Map();
      this.radios = [...html.matchAll(/<input type="radio" name="([^"]+)" value="([^"]+)"([^>]*)/g)]
        .map(([, name, value, rest]) => ({ ...createElement(), name, value, checked: /\bchecked\b/.test(rest) }));
      for (const [, action] of html.matchAll(/data-action="([^"]+)"/g)) this.nodes.set(`[data-action="${action}"]`, createElement());
      for (const [, field] of html.matchAll(/data-field="([^"]+)"/g)) this.nodes.set(`[data-field="${field}"]`, createElement());
      this.scores = [...html.matchAll(/data-score="([^"]+)"[^>]*>([^<]*)/g)]
        .map(([, score, textContent]) => ({ ...createElement(), dataset: { score }, textContent }));
      for (const selector of ['.assessment-form', '.assessment-status', '.assessment-save-status', '[data-page-heading]', '.oral-review-output', '.assessment-result p', '.oral-save-status', '[data-feedback-section="result"]']) {
        this.nodes.set(selector, selector === '.oral-review-output' ? createMount() : createElement());
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
    querySelectorAll(selector) { return selector === '[data-score]' ? this.scores : []; },
    closest() { return null; },
  };
  return mount;
}

function createHarness({ blockedKeys = [], questionBank = bank, deferFrames = false, endpoint = '', fetchImpl } = {}) {
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
  const frames = [];
  const schedule = callback => deferFrames ? frames.push(callback) : callback();
  const context = vm.createContext({
    window: { requestAnimationFrame: schedule },
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
    recordOralReview: (lessonId, score, mode, now) => recordOralReview(lessonId, score, mode, now, storage),
    evaluateRecitation: args => evaluateRecitation(args, fetchImpl),
    renderLearningFeedback,
    loadReviewConfig: () => ({ endpoint }),
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
  const flushFrames = () => {
    for (let round = 0; frames.length && round < 20; round++) frames.splice(0).forEach(callback => callback());
  };
  return { mount, sessions, storage, writes, blocked, render, choose, submit, syncProfile, schedule, flushFrames };
}

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

const reviewPayload = { score: 82, summary: '能说明阴阳变化，仍需补充原典依据。', strengths: ['概念清楚'], improvements: ['补充出处'] };
const reviewResponse = () => ({ ok: true, json: async () => reviewPayload });

function oralControls(h) {
  return {
    select: h.mount.querySelector('[data-field="oral-lesson"]'),
    response: h.mount.querySelector('[data-field="oral-response"]'),
    ai: h.mount.querySelector('[data-action="ai-review"]'),
    self: h.mount.querySelector('[data-action="self-review"]'),
    output: h.mount.querySelector('.oral-review-output'),
  };
}

function startOralRequest(h) {
  const controls = oralControls(h);
  controls.select.value = 'l1-4';
  controls.response.value = '这是公开课程示例复讲，阴阳变化应联系卦象与原文依据共同理解。';
  return { ...controls, completion: controls.ai.events.click() };
}

for (const exit of ['lesson', 'response', 'self', 'quiz', 'hub', 'cleanup']) {
  for (const outcome of ['success', 'failure']) {
    test(`复讲${exit}后旧${outcome}不写记录、不覆盖当前界面或finally状态`, async () => {
      const pending = deferred();
      const h = createHarness({ endpoint: '/api/learning-review', fetchImpl: () => pending.promise });
      const cleanup = h.render({});
      const old = startOralRequest(h);
      if (exit === 'lesson') { old.select.value = 'l5-1'; old.select.events.change?.(); }
      if (exit === 'response') { old.response.value += '新输入'; old.response.events.input?.(); }
      if (exit === 'self') old.self.events.click();
      if (exit === 'quiz') {
        h.mount.querySelector('[data-field="lesson"]').value = 'l1-4';
        h.mount.querySelector('[data-action="lesson-quiz"]').events.click();
      }
      if (exit === 'hub') h.render({});
      if (exit === 'cleanup') { cleanup?.(); cleanup?.(); }
      const expected = { html: h.mount.innerHTML, output: old.output.innerHTML, disabled: old.ai.disabled };
      if (outcome === 'success') pending.resolve(reviewResponse());
      else pending.reject(new Error('受控的旧请求失败'));
      await old.completion;
      if (exit === 'cleanup') assert.equal(typeof cleanup, 'function');
      assert.equal(h.writes.length, 0, '旧请求不得写入成绩或活动');
      assert.equal(h.mount.innerHTML, expected.html);
      assert.equal(old.output.innerHTML, expected.output, '旧成功或catch不能覆盖已切换输出');
      assert.equal(old.ai.disabled, expected.disabled, '旧finally不能改动按钮状态');
    });
  }
}

test('旧复讲finally不能解锁后继请求；双提交只发送一次当前请求', async () => {
  const first = deferred(), second = deferred();
  const requests = [];
  const h = createHarness({ endpoint: '/api/learning-review', fetchImpl: (url, options) => {
    requests.push({ url, options });
    return requests.length === 1 ? first.promise : second.promise;
  } });
  h.render({});
  const old = startOralRequest(h);
  old.response.value += '另一轮'; old.response.events.input?.();
  const current = old.ai.events.click();
  const duplicate = old.ai.events.click();
  first.resolve(reviewResponse()); await old.completion;
  const afterFirst = { disabled: old.ai.disabled, writes: h.writes.length, html: old.output.innerHTML };
  second.resolve(reviewResponse()); await Promise.all([current, duplicate]);
  assert.equal(requests.length, 2, '后继请求重复点击不能再次POST');
  assert.equal(afterFirst.disabled, true);
  assert.equal(afterFirst.writes, 0);
  assert.match(afterFirst.html, /正在.*评阅/);
  assert.equal(old.ai.disabled, false);
  assert.equal(loadLearningRecord(h.storage).oralReviews.length, 1);
  assert.equal(loadLearningRecord(h.storage).oralReviews[0].lessonId, 'l1-4');
});

for (const mode of ['ai', 'self']) {
  for (const failed of ['score', 'activity', 'both']) {
    test(`${mode}复讲${failed}保存失败仅补失败部分，同轮双击不新增POST或成绩`, async () => {
      const keys = { score: getLearningRecordKey(), activity: learningProgress.getActivityKey() };
      let posts = 0;
      const h = createHarness({ endpoint: mode === 'ai' ? '/api/learning-review' : '',
        blockedKeys: failed === 'both' ? Object.values(keys) : [keys[failed]],
        fetchImpl: async () => { posts++; return reviewResponse(); } });
      h.render({});
      const controls = oralControls(h);
      controls.select.value = 'l1-4';
      let scoreButton;
      if (mode === 'ai') await startOralRequest(h).completion;
      else {
        controls.self.events.click();
        scoreButton = controls.output.querySelectorAll('[data-score]').find(button => button.dataset.score === '80');
        scoreButton.events.click();
        scoreButton.events.click();
      }
      assert.equal(posts, mode === 'ai' ? 1 : 0);
      const initialWrites = [...h.writes];
      assert.equal(initialWrites.filter(key => key === keys.score).length, 1, '双击不能重复保存成绩');
      assert.equal(initialWrites.filter(key => key === keys.activity).length, 1);
      assert.equal(loadLearningRecord(h.storage).oralReviews.length, failed === 'activity' ? 1 : 0);
      assert.match(controls.output.innerHTML, /未.*保存|未保存/);
      const retry = controls.output.querySelector('[data-action="oral-retry-save"]');
      assert.ok(retry, '须提供仅重试保存入口');
      h.blocked.clear();
      retry.events.click();
      retry.events.click();
      assert.equal(posts, mode === 'ai' ? 1 : 0);
      assert.equal(h.writes.filter(key => key === keys.score).length, failed === 'activity' ? 1 : 2);
      assert.equal(h.writes.filter(key => key === keys.activity).length, failed === 'score' ? 1 : 2);
      const record = loadLearningRecord(h.storage);
      assert.equal(record.oralReviews.length, 1);
      assert.equal(record.oralReviews[0].mode, mode);
      assert.deepEqual(Object.keys(record.oralReviews[0]).sort(), ['at', 'lessonId', 'mode', 'score']);
      assert.equal(controls.output.querySelector('[data-action="oral-retry-save"]'), null);
      assert.match(controls.output.innerHTML, /已保存/);
    });
  }
}

test('复讲原文不足20字就地说明并聚焦，不POST、不保存', async () => {
  let posts = 0;
  const h = createHarness({ endpoint: '/api/learning-review', fetchImpl: async () => { posts++; return reviewResponse(); } });
  h.render({});
  const controls = oralControls(h);
  controls.select.value = 'l1-4'; controls.response.value = '太短';
  await controls.ai.events.click();
  assert.equal(posts, 0); assert.equal(h.writes.length, 0);
  assert.match(controls.output.innerHTML, /20/);
  assert.equal(controls.response.focused, true);
});

for (const failed of [false, true]) {
  test(`复讲自评${failed ? '保存失败说明' : '结果'}由页面主动显示并获得焦点`, () => {
    const h = createHarness({ deferFrames: true, blockedKeys: failed ? [getLearningRecordKey()] : [] });
    h.render({}); h.flushFrames();
    const controls = oralControls(h);
    controls.select.value = 'l1-4';
    controls.self.events.click();
    controls.output.querySelectorAll('[data-score]')[2].events.click();
    const target = controls.output.querySelector(failed ? '.oral-save-status' : '[data-feedback-section="result"]');
    h.flushFrames();
    assert.equal(target.focused, true, '原评分按钮已移除，焦点不能留在脱离节点');
    assert.ok(target.scrolled, '必须由产品定位结果，不能依赖测试滚动');
  });
}

test('复讲结果定位帧在离页后失效，不抢回焦点', () => {
  const h = createHarness({ deferFrames: true });
  const cleanup = h.render({}); h.flushFrames();
  const controls = oralControls(h);
  controls.select.value = 'l1-4'; controls.self.events.click();
  controls.output.querySelectorAll('[data-score]')[2].events.click();
  const old = controls.output.querySelector('[data-feedback-section="result"]');
  cleanup(); h.flushFrames();
  assert.equal(old.focused, undefined);
  assert.equal(old.scrolled, undefined);
});

test('复讲失败可本地自评；四段反馈依据可读，模型文本转义且不存正文', async () => {
  let posts = 0;
  const h = createHarness({ endpoint: '/api/learning-review', fetchImpl: async () => {
    posts++; throw new Error('服务暂不可用');
  } });
  h.render({});
  const controls = startOralRequest(h); await controls.completion;
  assert.match(controls.output.innerHTML, /服务暂不可用.*本地要点自评/);
  assert.equal(h.writes.length, 0);
  controls.output.querySelectorAll('[data-score]')[2].events.click();
  assert.equal(posts, 1);
  assert.equal(loadLearningRecord(h.storage).oralReviews[0].mode, 'self');
  for (const section of ['result', 'basis', 'changes', 'actions']) {
    assert.match(controls.output.innerHTML, new RegExp(`data-feedback-section="${section}"`));
  }
  assert.match(controls.output.innerHTML, /个人.*自评/);

  const ai = createHarness({ endpoint: '/api/learning-review', fetchImpl: async () => ({ ok: true, json: async () => ({
    ...reviewPayload, summary: '<img src=x onerror=alert(1)>', strengths: ['<b>测试</b>'], improvements: ['<script>bad()</script>'],
  }) }) });
  ai.render({});
  const result = startOralRequest(ai); await result.completion;
  assert.match(result.output.innerHTML, /&lt;img/);
  assert.doesNotMatch(result.output.innerHTML, /<img|<script>|<b>测试/);
  assert.doesNotMatch(ai.storage.getItem(getLearningRecordKey()), /公开课程示例|onerror|bad\(\)/);
});

for (const mode of ['ai', 'self']) {
  for (const failed of [false, true]) {
    test(`${mode}复讲${failed ? '保存失败' : '成功'}结果指向本轮原课，离开不补写或新增评阅`, async () => {
      const calls = [];
      let posts = 0, cleanup;
      const h = createHarness({ endpoint: mode === 'ai' ? '/api/learning-review' : '',
        blockedKeys: failed ? [getLearningRecordKey(), learningProgress.getActivityKey()] : [],
        fetchImpl: async () => { posts++; return reviewResponse(); } });
      cleanup = h.render({ onNavigate: (...args) => { calls.push(args); cleanup(); } });
      const controls = oralControls(h);
      controls.select.value = 'l1-4';
      if (mode === 'ai') await startOralRequest(h).completion;
      else {
        controls.self.events.click();
        controls.output.querySelectorAll('[data-score]')[2].events.click();
      }
      const basis = controls.output.innerHTML.match(/data-feedback-section="basis"[^>]*>([\s\S]*?)<\/section>/)?.[1];
      assert.match(basis || '', /项目课程要点/);
      assert.ok(basis.includes(getLesson('l1-4').title), '结果说明实际原课标题');
      assert.match(basis, /原典出处.*(?:待核对|待校验)/, '不能把课程要点冒称已经校验的原典');
      assert.equal((controls.output.innerHTML.match(/data-feedback-action="primary"/g) || []).length, 1);
      assert.equal((controls.output.innerHTML.match(/data-feedback-action="secondary"/g) || []).length, failed ? 2 : 1);
      const sourceButton = controls.output.querySelector('[data-action="oral-source"]');
      assert.ok(sourceButton, '成功和失败结果均可回原课核对');
      const writes = [...h.writes], record = h.storage.getItem(getLearningRecordKey());
      controls.select.value = 'l5-1';
      sourceButton.events.click();
      assert.deepEqual(calls, [['path', 'l1-4']], '来源使用锁定的本轮课程，不读取后来选项值');
      assert.deepEqual(h.writes, writes);
      assert.equal(h.storage.getItem(getLearningRecordKey()), record);
      assert.equal(posts, mode === 'ai' ? 1 : 0);
      sourceButton.events.click();
      assert.equal(calls.length, 1, '离开后的旧来源控件失效');
    });
  }
}

for (const exit of ['lesson', 'response', 'self', 'new', 'quiz', 'hub', 'cleanup', 'retry']) {
  test(`复讲${exit}后旧来源按钮不导航或保存`, () => {
    const calls = [];
    const h = createHarness({ blockedKeys: [getLearningRecordKey()] });
    const options = { onNavigate: (...args) => calls.push(args) };
    const cleanup = h.render(options);
    const controls = oralControls(h);
    controls.select.value = 'l1-4'; controls.self.events.click();
    controls.output.querySelectorAll('[data-score]')[2].events.click();
    const sourceButton = controls.output.querySelector('[data-action="oral-source"]');
    assert.ok(sourceButton);
    if (exit === 'lesson') { controls.select.value = 'l5-1'; controls.select.events.change(); }
    if (exit === 'response') { controls.response.value = '重新编辑'; controls.response.events.input(); }
    if (exit === 'self') controls.self.events.click();
    if (exit === 'new') controls.output.querySelector('[data-action="oral-new"]').events.click();
    if (exit === 'quiz') {
      h.mount.querySelector('[data-field="lesson"]').value = 'l1-4';
      h.mount.querySelector('[data-action="lesson-quiz"]').events.click();
    }
    if (exit === 'hub') h.render(options);
    if (exit === 'cleanup') cleanup();
    if (exit === 'retry') { h.blocked.clear(); controls.output.querySelector('[data-action="oral-retry-save"]').events.click(); }
    const writes = [...h.writes];
    sourceButton.events.click();
    assert.deepEqual(calls, []);
    assert.deepEqual(h.writes, writes);
  });
}

test('课程考评沿用四段反馈，既有依据、保存重试及返回行动仍可达', () => {
  const h = createHarness({ blockedKeys: [getLearningRecordKey()] });
  h.render();
  for (let index = 0; index < 3; index++) h.choose(index, 'b');
  h.submit();
  for (const section of ['result', 'basis', 'changes', 'actions']) {
    assert.match(h.mount.innerHTML, new RegExp(`data-feedback-section="${section}"`));
  }
  assert.match(h.mount.innerHTML, /正答：/);
  for (const action of ['retry-save', 'back', 'return-review', 'weak-source-0', 'weak-practice-0']) {
    assert.ok(h.mount.querySelector(`[data-action="${action}"]`));
  }
});

test('复讲入口选定具体课程并聚焦复讲，不误开小试或写学习成绩', () => {
  const harness = createHarness();
  harness.render({ initialOralLessonId: 'l5-1' });
  assert.equal(harness.sessions.length, 0);
  assert.equal(harness.mount.querySelector('[data-field="oral-lesson"]').value, 'l5-1');
  assert.equal(harness.mount.querySelector('[data-field="oral-response"]').focused, true);
  assert.equal(harness.writes.length, 0);
});

test('明确复讲入口在外层标题RAF之后获得焦点，并声明本次焦点目标', () => {
  const h = createHarness({ deferFrames: true });
  h.render({ initialOralLessonId: 'l5-1' });
  const response = h.mount.querySelector('[data-field="oral-response"]');
  let active;
  response.focus = () => { active = response; };
  const heading = h.mount.querySelector('[data-page-heading]');
  heading.focus = () => { active = heading; };
  h.schedule(() => heading.focus());
  h.schedule(() => heading.focus());
  h.flushFrames();
  assert.equal(active, response);
  assert.match(h.mount.innerHTML, /data-learning-focus="oral"/);
});

test('复讲入口退出后旧RAF不聚焦已脱离的输入或新页面标题', () => {
  const h = createHarness({ deferFrames: true });
  h.render({ initialOralLessonId: 'l5-1' });
  const response = h.mount.querySelector('[data-field="oral-response"]');
  h.mount.innerHTML = '<h3 data-page-heading>new page</h3>';
  const newHeading = h.mount.querySelector('[data-page-heading]');
  h.flushFrames();
  assert.equal(response.focused, undefined);
  assert.equal(newHeading.focused, undefined);
});

test('容器整体移除后复讲RAF不再聚焦旧内容', () => {
  const h = createHarness({ deferFrames: true });
  h.render({ initialOralLessonId: 'l5-1' });
  const response = h.mount.querySelector('[data-field="oral-response"]');
  response.isConnected = false;
  const heading = h.mount.querySelector('[data-page-heading]');
  heading.isConnected = false;
  h.flushFrames();
  assert.equal(response.focused, undefined);
  assert.equal(heading.focused, undefined);
});

for (const options of [{ initialLessonId: 'l1-4' }, { initialOralLessonId: 'l5-1' }]) {
  test(`清理保留DOM后初始${options.initialOralLessonId ? '复讲入口' : '题卷标题'}RAF不再滚动或聚焦`, () => {
    const h = createHarness({ deferFrames: true });
    const cleanup = h.render(options);
    const heading = h.mount.querySelector('[data-page-heading]');
    const response = h.mount.querySelector('[data-field="oral-response"]');
    cleanup();
    h.mount.scrollTop = 173;
    h.flushFrames();
    assert.equal(heading.focused, undefined, 'cleanup必须取消仍连接的旧标题焦点');
    assert.equal(response?.focused, undefined);
    assert.equal(response?.scrolled, undefined);
    assert.equal(h.mount.scrollTop, 173);
    assert.equal(h.writes.length, 0);
  });
}

test('重绘后旧表单change不读取新控件或改写仍保留的本轮草稿', () => {
  const h = createHarness();
  h.render();
  h.choose(0, 'b');
  const staleChange = h.mount.querySelector('.assessment-form').events.change;
  h.render();
  const question = h.sessions[0].questions[0];
  const currentOption = String(question.options.findIndex(option => option.value === 'a'));
  h.mount.radios.filter(radio => radio.name === 'question-0').forEach(radio => {
    radio.checked = radio.value === currentOption;
  });
  staleChange();
  h.render();
  assert.equal(h.mount.querySelector('input[name="question-0"]:checked').value,
    String(question.options.findIndex(option => option.value === 'b')), '旧change不能把新DOM选择写进共享草稿');
  assert.equal(h.writes.length, 0);
});

test('旧未交卷表单submit不得改写新卷状态或移动新卷焦点', () => {
  const h = createHarness();
  h.render();
  const staleSubmit = h.mount.querySelector('.assessment-form').events.submit;
  h.render({ initialLessonId: 'l1-4', requiredQuestionId: 'q0', requiredQuestionVersion: 'curriculum-v1' });
  assert.equal(h.sessions.length, 2);
  const status = h.mount.querySelector('.assessment-status');
  status.textContent = '新卷保持未提交';
  staleSubmit({ preventDefault() {} });
  assert.equal(status.textContent, '新卷保持未提交');
  assert.ok(h.mount.radios.every(radio => radio.focused === undefined));
  assert.equal(h.writes.length, 0);
});

test('十题全错长卷保存失败定位保存状态，重试成功返回结果焦点', () => {
  const questionBank = Array.from({ length: 10 }, (_, index) => ({ ...bank[0], id: `long-${index}`,
    prompt: `长卷题目${index}`, explanation: '合成的长依据说明。'.repeat(30), source: '合成测试资料' }));
  const h = createHarness({ questionBank, blockedKeys: [getLearningRecordKey()], deferFrames: true });
  h.render({});
  h.mount.querySelector('[data-field="level"]').value = 'L1';
  h.mount.querySelector('[data-action="exam"]').events.click();
  assert.equal(h.sessions[0].questions.length, 10);
  h.flushFrames();
  for (let index = 0; index < 10; index++) h.choose(index, 'b');
  h.submit();
  h.flushFrames();
  assert.equal([...h.mount.innerHTML.matchAll(/<details open>/g)].length, 10);
  const status = h.mount.querySelector('.assessment-save-status');
  assert.equal(status.focused, true, '长依据之后的保存失败状态必须成为焦点目标，不能只滚到卷首');
  assert.equal(status.scrolled?.block, 'center');
  assert.equal(h.mount.querySelector('[data-page-heading]').focused, undefined);
  assert.ok(h.mount.querySelector('[data-action="retry-save"]'));
  h.blocked.clear();
  h.mount.querySelector('[data-action="retry-save"]').events.click();
  h.flushFrames();
  assert.match(h.mount.innerHTML, /本轮成绩与学习记录已保存/);
  assert.equal(h.mount.querySelector('[data-feedback-section="result"]').focused, true);
  assert.equal(loadLearningRecord(h.storage).exams.length, 1);
});

test('结果定位排队后清理页面不滚动或聚焦旧保存状态', () => {
  const h = createHarness({ blockedKeys: [getLearningRecordKey()], deferFrames: true });
  const cleanup = h.render();
  h.flushFrames();
  for (let index = 0; index < 3; index++) h.choose(index);
  h.submit();
  const status = h.mount.querySelector('.assessment-save-status');
  const heading = h.mount.querySelector('[data-page-heading]');
  cleanup();
  h.flushFrames();
  assert.equal(status.focused, undefined);
  assert.equal(status.scrolled, undefined);
  assert.equal(heading.focused, undefined);
});

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
