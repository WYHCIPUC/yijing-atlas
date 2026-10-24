import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import * as progress from '../js/learning-progress.js';
import { buildLearningQuestionBank, getLesson, LEARNING_LESSONS, LEARNING_LEVELS } from '../js/learning-curriculum.js';

const theorems = JSON.parse(readFileSync(new URL('../data/theorems.json', import.meta.url), 'utf8'));

const source = name => readFileSync(new URL(`../js/modes/${name}.js`, import.meta.url), 'utf8')
  .replace(/^import[\s\S]*?from '[^']+';\r?\n/gm, '').replaceAll('export function ', 'function ');
const weak = (extra = {}) => ({ questionId: 'theory-yinyang-name', questionVersion: 'curriculum-v1',
  sourceKind: 'course', lessonId: 'l1-1', questionType: 'recall', targetCode: null, termId: null,
  firstWrongAt: '2026-10-25T01:00:00Z', lastWrongAt: '2026-10-25T01:00:00Z',
  lastSessionId: 'first-session', wrongCount: 1, status: 'due', lastReviewedAt: null, resolvedAt: null, ...extra });
const recordWith = entry => ({ version: 2, lessons: {}, spotChecks: [], exams: [], oralReviews: [],
  weakQuestions: { [entry.questionId]: entry } });

function element(dataset = {}) {
  return { dataset, events: {}, classList: { toggle() {}, add() {}, remove() {} },
    addEventListener(type, fn) { this.events[type] = fn; }, setAttribute() {}, focus() {},
    querySelector() { return null; }, querySelectorAll() { return []; }, closest() { return null; } };
}
function mount() {
  return { ...element(), html: '', actions: new Map(),
    set innerHTML(html) {
      this.html = html;
      this.actions.clear();
      for (const [, action] of html.matchAll(/data-action="([^"]+)"/g)) this.actions.set(action, element());
    }, get innerHTML() { return this.html; },
    querySelector(selector) {
      const action = selector.match(/^\[data-action="([^"]+)"\]$/);
      if (action) return this.actions.get(action[1]) || null;
      return this.nodes?.[selector] || element();
    },
    querySelectorAll(selector) { return this.lists?.[selector] || []; },
  };
}
function shared(record) {
  return {
    window: { requestAnimationFrame: fn => fn() },
    document: { body: { classList: { remove() {} } } },
    loadLearningRecord: () => record,
    getCourseWeakQuestions: (...args) => progress.getCourseWeakQuestions(...args),
    getWeakQuestionsError: (...args) => progress.getWeakQuestionsError(...args),
    buildLearningQuestionBank, getLesson, LEARNING_LESSONS,
  };
}

test('今日温故入口区分课程与卦卡，不改变课程推荐', () => {
  const record = recordWith(weak());
  const content = mount();
  const reviewButton = element();
  content.nodes = { '[data-mode-target="review"]': reviewButton };
  const navigated = [];
  const context = vm.createContext({ ...shared(record),
    loadReviewCards: () => ({}), getDueCount: () => 2,
    loadActivity: () => ({ days: [] }), calculateStreak: () => 0,
    summarizeLearning: () => ({ masteryByLesson: {}, rank: { label: '初闻' }, checked: 0, total: 25 }),
    recommendLesson: () => LEARNING_LESSONS[0],
  });
  vm.runInContext(source('learning-mode'), context);
  context.renderTodaySection(content, (...args) => navigated.push(args));
  assert.match(content.innerHTML, /卦象间隔卡 2 项/);
  assert.match(content.innerHTML, /课程温习 1 项/);
  reviewButton.events.click();
  assert.equal(navigated[0][0], 'review-mode');
});

function reviewHarness(record, due = ['111111'], appState = {}) {
  const content = mount();
  const calls = [];
  const hex = { binaryCode: '111111', name: '乾', fullName: '乾为天', number: 1 };
  const context = vm.createContext({ ...shared(record), loadReviewCards: () => ({ '111111': {} }),
    getDueCards: () => due, hexagramSvg: () => '<svg></svg>',
  });
  vm.runInContext(source('review-mode'), context);
  // Record whether the real queue decides to bypass itself; card behavior is covered separately.
  vm.runInContext('let openedCard = false; renderReviewCard = () => { openedCard = true; };', context);
  context.renderReviewMode(content, { index: { byCode: new Map([['111111', hex]]) }, ...appState }, entry => calls.push(entry));
  return { content, calls, openedCard: vm.runInContext('openedCard', context) };
}

test('单卦卡不遮课程队列，资料未加载仍按原引用进入回课和回练', () => {
  const { content, calls, openedCard } = reviewHarness(recordWith(weak()));
  assert.equal(openedCard, false);
  assert.match(content.innerHTML, /课程温习/);
  assert.doesNotMatch(content.innerHTML, /题目已调整/);
  assert.match(content.innerHTML, /待回练第 1 题 · 进入后加载原题/);
  assert.doesNotMatch(content.innerHTML.replace(/data-weak-question-id="[^"]*"/g, ''), /theory-yinyang-name/);
  assert.ok(content.querySelector('[data-action="weak-source-0"]'));
  content.querySelector('[data-action="weak-source-0"]').events.click();
  content.querySelector('[data-action="weak-practice-0"]').events.click();
  assert.equal(calls[0].section, 'path');
  assert.equal(calls[1].section, 'assessment');
  for (const entry of calls) {
    assert.equal(entry.lessonId, 'l1-1');
    assert.equal(entry.requiredQuestionId, 'theory-yinyang-name');
    assert.equal(entry.requiredQuestionVersion, 'curriculum-v1');
    assert.equal(entry.returnTo, 'review');
  }
});

test('温故使用已加载真实题库的题干，不持久化题干或显示技术编号', () => {
  const record = recordWith(weak());
  const original = JSON.stringify(record);
  const question = buildLearningQuestionBank({ theorems }).find(item => item.id === 'theory-yinyang-name');
  assert.ok(question?.prompt);
  const { content } = reviewHarness(record, [], { theorems });
  assert.ok(content.innerHTML.includes(question.prompt));
  assert.doesNotMatch(content.innerHTML, /进入后加载原题/);
  assert.doesNotMatch(content.innerHTML.replace(/data-weak-question-id="[^"]*"/g, ''), /theory-yinyang-name/);
  assert.equal(JSON.stringify(record), original);
});

test('旧版本或失效引用不冒用当前题干，保留中性文案和进入后核对入口', () => {
  const question = buildLearningQuestionBank({ theorems }).find(item => item.id === 'theory-yinyang-name');
  for (const entry of [weak({ questionVersion: 'curriculum-v0' }), weak({ questionId: 'theory-removed-name' })]) {
    const { content } = reviewHarness(recordWith(entry), [], { theorems });
    assert.match(content.innerHTML, /待回练第 1 题 · 进入后加载原题/);
    assert.ok(!content.innerHTML.includes(question.prompt));
    assert.doesNotMatch(content.innerHTML, /题目已调整/);
    assert.ok(content.querySelector('[data-action="weak-practice-0"]'));
  }
});

test('坏薄弱项显示局部异常，不自动开唯一卦卡或伪称完成', () => {
  const record = { ...recordWith(weak()), weakQuestions: ['broken'] };
  const { content, openedCard } = reviewHarness(record);
  assert.equal(openedCard, false);
  assert.match(content.innerHTML, /课程温习记录异常/);
  assert.match(content.innerHTML, /备份/);
  assert.doesNotMatch(content.innerHTML, /今日温故已经完成/);
});

test('全部纠正后保留空队列返回，旧单卦卡捷径仍可用', () => {
  const record = recordWith(weak({ status: 'resolved', resolvedAt: '2026-10-25T02:00:00Z' }));
  assert.equal(reviewHarness(record).openedCard, true);
  const { content } = reviewHarness(record, []);
  assert.match(content.innerHTML, /课程温习/);
  assert.match(content.innerHTML, /暂无待回练的课程题/);
  assert.ok(content.querySelector('[data-action="start-learning"]'));
});

test('学习入口回原课后试章节保留原题，返回回到温故', () => {
  const outer = mount();
  const content = mount();
  const tabs = ['today', 'path', 'library', 'profile'].map(section => ({ ...element({ section }), id: `learning-tab-${section}` }));
  outer.nodes = { '.learning-content': content, '.learning-panel': element(), '.learning-tabs': element() };
  outer.lists = { '.learning-tab': tabs };
  const record = recordWith(weak());
  const entries = [], assessments = [], exits = [];
  const context = vm.createContext({ ...shared(record),
    renderLearningLessonPage: (node, state, id, options) => entries.push({ id, options }),
    renderLearningAssessmentPage: (node, state, options) => assessments.push(options),
    loadReviewCards: () => ({}), getDueCount: () => 0,
    loadActivity: () => ({ days: [] }), calculateStreak: () => 0,
    summarizeLearning: () => ({ masteryByLesson: {}, rank: { label: '初闻' }, checked: 0, total: 25 }),
    recommendLesson: () => LEARNING_LESSONS[0],
  });
  vm.runInContext(source('learning-mode'), context);
  context.renderLearningMode(outer, {}, (...args) => exits.push(args), {
    section: 'path', lessonId: 'l1-1', requiredQuestionId: 'theory-yinyang-name',
    requiredQuestionVersion: 'curriculum-v1', returnTo: 'review',
  });
  assert.equal(entries.length, 1);
  assert.equal(entries[0].options.returnTo, 'review');
  entries[0].options.onAssess('l1-1');
  assert.equal(assessments[0].requiredQuestionId, 'theory-yinyang-name');
  assert.equal(assessments[0].requiredQuestionVersion, 'curriculum-v1');
  assert.equal(assessments[0].returnTo, 'review');
  entries[0].options.onBack();
  assert.equal(exits[0][0], 'review');
});

function lessonHarness(lessonId, returnTo) {
  const content = mount();
  content.nodes = Object.fromEntries(['.lesson-back', '.lesson-back-secondary', '.lesson-continue'].map(selector => [selector, element()]));
  const exits = [];
  const bodyClasses = new Set();
  const context = vm.createContext({
    LEARNING_LESSONS, LEARNING_LEVELS,
    document: { body: { classList: { add: name => bodyClasses.add(name), remove: name => bodyClasses.delete(name) } } },
    markLessonViewed() {}, recordActivity() {}, loadLearningRecord: () => ({}),
    summarizeLearning: () => ({ mastery: 0, viewed: 0, total: 25 }),
    calculateStreak: () => 0, loadActivity: () => ({ days: [] }), hexagramSvg: () => '<svg></svg>',
  });
  const studySource = readFileSync(new URL('../js/study-page.js', import.meta.url), 'utf8')
    .replace(/^import[\s\S]*?from '[^']+';\r?\n/gm, '').replaceAll('export function ', 'function ');
  vm.runInContext(studySource, context);
  context.renderLearningLessonPage(content, { theorems }, lessonId, { returnTo, onBack: () => exits.push('back') });
  const label = selector => {
    const name = selector.slice(1);
    return content.innerHTML.match(new RegExp(`<button[^>]*class="[^"]*\\b${name}"[^>]*>([^<]+)</button>`))?.[1];
  };
  return { content, exits, bodyClasses, label, click: selector => content.nodes[selector].events.click() };
}

test('温故进入首课概览的退出标签与回温故行为一致', () => {
  const lesson = lessonHarness('l1-1', 'review');
  assert.equal(lesson.label('.lesson-back'), '返回温故队列');
  lesson.click('.lesson-back');
  assert.equal(lesson.exits.length, 1);
  assert.equal(lesson.bodyClasses.has('lesson-overview-open'), false);
});

test('温故进入普通课的两个退出入口都说明回温故，未承诺暂存', () => {
  for (const selector of ['.lesson-back', '.lesson-back-secondary']) {
    const lesson = lessonHarness('l5-1', 'review');
    assert.equal(lesson.label(selector), '返回温故队列');
    assert.doesNotMatch(lesson.content.innerHTML, /暂存/);
    lesson.click(selector);
    assert.equal(lesson.exits.length, 1);
  }
});

test('首课正文仍先回概览，默认课程入口保持原退出层级', () => {
  for (const returnTo of ['review', undefined]) {
    for (const selector of ['.lesson-back', '.lesson-back-secondary']) {
      const lesson = lessonHarness('l1-1', returnTo);
      assert.equal(lesson.label('.lesson-back'), returnTo === 'review' ? '返回温故队列' : '切换课程');
      lesson.click('.lesson-continue');
      assert.equal(lesson.label(selector), '返回课程概览');
      lesson.click(selector);
      assert.equal(lesson.exits.length, 0);
      assert.equal(lesson.bodyClasses.has('lesson-overview-open'), true);
      lesson.click('.lesson-back');
      assert.equal(lesson.exits.length, 1);
    }
  }
  for (const selector of ['.lesson-back', '.lesson-back-secondary']) {
    const lesson = lessonHarness('l5-1');
    assert.equal(lesson.label(selector), '返回学程');
    lesson.click(selector);
    assert.equal(lesson.exits.length, 1);
  }
});
