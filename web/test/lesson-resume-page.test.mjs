import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { LEARNING_LESSONS, LEARNING_LEVELS } from '../js/learning-curriculum.js';

const source = readFileSync(new URL('../js/study-page.js', import.meta.url), 'utf8')
  .replace(/^import[\s\S]*?from '[^']+';\r?\n/gm, '').replaceAll('export function ', 'function ');
const sectionIds = ['lesson-lead', 'lesson-observe', 'lesson-read', 'lesson-explain', 'lesson-apply', 'lesson-test'];
const savedResume = { lessonId: 'l1-1', section: 'explain', scrollTop: 1220, updatedAt: '2026-10-25T08:00:00Z' };

function element() {
  const listeners = new Map();
  let text = '';
  return { textUpdates: [], get textContent() { return text; }, set textContent(value) { text = value; this.textUpdates.push(value); }, dataset: {}, listeners,
    addEventListener(type, fn) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(fn); },
    removeEventListener(type, fn) { listeners.get(type)?.delete(fn); },
    dispatch(type, event = {}) { for (const fn of [...listeners.get(type) || []]) fn({ preventDefault() {}, ...event }); },
    setAttribute() {}, focus() {},
  };
}

function harness({ lessonId = 'l1-1', resume, saved = true, stickyControls = false } = {}) {
  const frames = new Map();
  const timers = new Map();
  let sequence = 0;
  const writes = [], exits = [], assessments = [];
  const panel = { ...element(), scrollTop: 0, scrollHeight: 4000, clientHeight: 600, clientTop: 0,
    getBoundingClientRect: () => ({ top: 0, bottom: 600 }) };
  const window = { ...element(), requestAnimationFrame(fn) { const id = ++sequence; frames.set(id, fn); return id; },
    cancelAnimationFrame: id => frames.delete(id), setTimeout(fn) { const id = ++sequence; timers.set(id, fn); return id; },
    clearTimeout: id => timers.delete(id) };
  const mount = { ...element(), nodes: new Map(), html: '',
    set innerHTML(html) {
      this.html = html; this.nodes.clear();
      for (const selector of ['.lesson-workspace', '.lesson-back', '.lesson-back-secondary', '.lesson-continue', '.lesson-resume-status']) this.nodes.set(selector, element());
      this.assess = [element(), element()];
      this.sections = sectionIds.map((id, index) => ({ ...element(), id,
        getBoundingClientRect: () => ({ top: 120 + index * 400 - panel.scrollTop, bottom: 520 + index * 400 - panel.scrollTop }),
        scrollIntoView() { panel.scrollTop = 120 + index * 400; panel.dispatch('scroll'); },
      }));
      this.links = this.sections.map(section => ({ ...element(), getAttribute: () => `#${section.id}` }));
      if (html.includes('lesson-reader-workspace')) this.nodes.set('.lesson-reader-workspace', this.nodes.get('.lesson-workspace'));
      if (stickyControls && html.includes('lesson-reading-controls')) this.nodes.set('.lesson-reading-controls', {
        getBoundingClientRect: () => ({ top: 64, bottom: 174 }),
      });
      if (html.includes('lesson-overview-workspace')) this.nodes.set('.lesson-overview-workspace', this.nodes.get('.lesson-workspace'));
      this.sections.forEach(section => this.nodes.set(`#${section.id}`, section));
    }, get innerHTML() { return this.html; },
    querySelector(selector) { return this.nodes.get(selector) || null; },
    querySelectorAll(selector) {
      if (selector === '.lesson-assess') return this.assess;
      if (selector === '.lesson-method-rail a') return this.links;
      if (selector === '.lesson-method-section') return this.sections;
      return [];
    }, closest: () => panel,
  };
  let record = { lessons: {}, resume: resume || null };
  const context = vm.createContext({ window, document: { body: { classList: { add() {}, remove() {} } } },
    LEARNING_LESSONS, LEARNING_LEVELS,
    markLessonViewed() {}, recordActivity() {}, loadLearningRecord: () => record,
    getLearningResumeError: value => value?.invalid ? 'resume.section' : null,
    saveLearningResume(value) { writes.push({ ...value }); if (saved) record = { ...record, resume: { ...value, updatedAt: savedResume.updatedAt } }; return { saved, record }; },
    summarizeLearning: () => ({ mastery: 0, viewed: 0, total: 25 }), calculateStreak: () => 0,
    loadActivity: () => ({ days: [] }), hexagramSvg: () => '<svg></svg>',
  });
  vm.runInContext(source, context);
  const cleanup = context.renderLearningLessonPage(mount, {}, lessonId, {
    resume, onBack: () => exits.push('back'), onInvalidResume: () => exits.push('invalid'),
    onAssess: id => { assessments.push(id); record = { ...record, resume: null }; },
  });
  const flushFrames = () => { for (let round = 0; frames.size && round < 20; round++) { const pending = [...frames]; frames.clear(); pending.forEach(([, fn]) => fn()); } };
  const flush = () => { flushFrames(); const pending = [...timers]; timers.clear(); pending.forEach(([, fn]) => fn()); flushFrames(); };
  return { mount, panel, window, writes, exits, assessments, cleanup, flush, flushFrames,
    setSaved(value) { saved = value; }, record: () => record };
}

test('续读首课直接进入正文，外层归零后恢复原位置且不先覆盖为零', () => {
  const h = harness({ resume: savedResume });
  assert.match(h.mount.innerHTML, /lesson-reader-workspace/);
  assert.equal(h.writes.length, 0);
  h.panel.scrollTop = 0;
  h.panel.dispatch('scroll');
  h.flush();
  assert.equal(h.panel.scrollTop, 1220);
  assert.ok(h.writes.every(write => write.scrollTop !== 0));
  assert.equal(typeof h.cleanup, 'function');
});

test('新课保留首课概览，明确开始生成最小指针；锚点保存真实章节与滚动', () => {
  const h = harness();
  assert.match(h.mount.innerHTML, /lesson-overview-workspace/);
  h.flush();
  assert.deepEqual(h.writes.at(-1), { lessonId: 'l1-1', section: 'intro', scrollTop: 0 });
  h.mount.querySelector('.lesson-continue').dispatch('click');
  h.flush();
  h.mount.links[3].dispatch('click');
  h.flush();
  assert.deepEqual(h.writes.at(-1), { lessonId: 'l1-1', section: 'explain', scrollTop: 1320 });
});

test('实际面板滚动保存章节，清理后旧监听与待执行帧不能写新页面', () => {
  const h = harness({ lessonId: 'l5-1' });
  h.flush();
  h.panel.scrollTop = 950;
  h.panel.dispatch('scroll');
  h.cleanup();
  assert.equal(h.writes.at(-1).section, 'read');
  const count = h.writes.length;
  h.mount.innerHTML = '<p>another page</p>';
  h.panel.scrollTop = 2000;
  h.panel.dispatch('scroll');
  h.window.dispatch('pagehide');
  h.flush();
  assert.equal(h.writes.length, count);
  assert.equal(h.panel.listeners.get('scroll')?.size || 0, 0);
});

test('进入小试先收尾课程监听，成功交卷后旧cleanup不复活resume', () => {
  const h = harness({ lessonId: 'l5-1' });
  h.flush();
  h.mount.assess[0].dispatch('click');
  assert.deepEqual(h.assessments, ['l5-1']);
  assert.equal(h.record().resume, null);
  const count = h.writes.length;
  h.cleanup(); h.flush(); h.panel.dispatch('scroll'); h.flush();
  assert.equal(h.writes.length, count);
  assert.equal(h.record().resume, null);
});

test('位置保存失败不阻断课程或覆盖最后有效位置，提供真实反馈', () => {
  const h = harness({ lessonId: 'l5-1', saved: false });
  h.flush();
  assert.match(h.mount.innerHTML, /lesson-reader-workspace/);
  assert.match(h.mount.querySelector('.lesson-resume-status').textContent, /未能保存/);
  assert.equal(h.record().resume, null);
});

test('失效位置走安全回调，不展示或标记替代课程', () => {
  const h = harness({ resume: { ...savedResume, invalid: true } });
  assert.deepEqual(h.exits, ['invalid']);
  assert.equal(h.writes.length, 0);
});

test('practice只定位试段阅读，不自动开启试卷', () => {
  const h = harness({ resume: { ...savedResume, section: 'practice', scrollTop: 2120 } });
  h.flush();
  assert.match(h.mount.innerHTML, /id="lesson-test"/);
  assert.equal(h.panel.scrollTop, 2120);
  assert.deepEqual(h.assessments, []);
});

test('顶部进入小试也保存试段的阅读位置，清理不能将章节改回引', () => {
  const h = harness({ lessonId: 'l5-1' });
  h.flush();
  h.mount.assess[0].dispatch('click');
  assert.deepEqual(h.writes.at(-1), { lessonId: 'l5-1', section: 'practice', scrollTop: 2120 });
});

test('恢复帧执行前退出不覆盖原位置，也不留下后台保存监听', () => {
  const h = harness({ resume: savedResume });
  h.cleanup();
  h.panel.scrollTop = 20;
  h.flush();
  assert.equal(h.panel.scrollTop, 20);
  assert.equal(h.writes.length, 0);
  assert.equal(h.panel.listeners.get('scroll')?.size || 0, 0);
  assert.equal(h.window.listeners.get('pagehide')?.size || 0, 0);
});

test('页面被替换后迟到的恢复帧不滚动新内容', () => {
  const h = harness({ resume: savedResume });
  h.mount.innerHTML = '<p>new page</p>';
  h.panel.scrollTop = 30;
  h.flush();
  assert.equal(h.panel.scrollTop, 30);
  assert.equal(h.writes.length, 0);
});

test('已清理课程的旧按钮不导航、不打开正文或开始小试', () => {
  const h = harness();
  h.flush();
  const oldContinue = h.mount.querySelector('.lesson-continue');
  const oldBack = h.mount.querySelector('.lesson-back');
  h.cleanup();
  h.mount.innerHTML = '<p>new page</p>';
  oldContinue.dispatch('click');
  oldBack.dispatch('click');
  assert.equal(h.mount.innerHTML, '<p>new page</p>');
  assert.deepEqual(h.exits, []);
  const reader = harness({ lessonId: 'l5-1' });
  const oldAssess = reader.mount.assess[0];
  reader.cleanup();
  oldAssess.dispatch('click');
  assert.deepEqual(reader.assessments, []);
});

test('首课回概览先保存真实正文位置，不丢失尚未执行的滚动帧', () => {
  const h = harness();
  h.flush();
  h.mount.querySelector('.lesson-continue').dispatch('click');
  h.flush();
  h.panel.scrollTop = 950;
  h.panel.dispatch('scroll');
  h.mount.querySelector('.lesson-back').dispatch('click');
  h.flush();
  assert.deepEqual(h.writes.at(-1), { lessonId: 'l1-1', section: 'read', scrollTop: 950 });
});

test('滚回已保存位置时取消较早待写位置，不把旧滚动覆盖到磁盘', () => {
  const h = harness({ resume: { ...savedResume, section: 'read', scrollTop: 950 } });
  h.flush();
  h.panel.scrollTop = 1500;
  h.panel.dispatch('scroll');
  h.flushFrames();
  h.panel.scrollTop = 950;
  h.panel.dispatch('scroll');
  h.flush();
  assert.equal(h.writes.length, 0);
});

test('恢复帧之前点击章节以本次明确操作为准，不再跳回旧位置', () => {
  const h = harness({ resume: savedResume });
  h.mount.links[5].dispatch('click');
  h.flush();
  assert.equal(h.panel.scrollTop, 2120);
  assert.deepEqual(h.writes.at(-1), { lessonId: 'l1-1', section: 'practice', scrollTop: 2120 });
});

test('正文只在六步阅读控件内显示一份保存反馈，恢复完成后给真实位置反馈', () => {
  const h = harness({ resume: savedResume });
  assert.match(h.mount.innerHTML, /class="lesson-reading-controls">\s*<nav class="lesson-method-rail"[\s\S]*?<\/nav>\s*<p class="lesson-resume-status"/);
  assert.equal((h.mount.innerHTML.match(/class="lesson-resume-status"/g) || []).length, 1);
  assert.equal(h.mount.querySelector('.lesson-resume-status').textContent, '');
  h.flush();
  assert.equal(h.mount.querySelector('.lesson-resume-status').textContent, '已恢复上次阅读位置。');
  assert.equal(h.mount.querySelector('.lesson-resume-status').dataset.state, 'restored');
  assert.equal(h.panel.scrollTop, savedResume.scrollTop);
});

test('保存失败只在状态变化时播报，后续成功可见且不重复播报每次滚动', () => {
  const h = harness({ lessonId: 'l5-1', saved: false });
  h.flush();
  const status = h.mount.querySelector('.lesson-resume-status');
  for (const top of [950, 1500, 1750]) {
    h.panel.scrollTop = top; h.panel.dispatch('scroll'); h.flush();
  }
  assert.equal(status.dataset.state, 'error');
  assert.equal(status.textUpdates.length, 1);
  assert.match(status.textContent, /未能保存/);
  h.setSaved(true);
  h.panel.scrollTop = 1850; h.panel.dispatch('scroll'); h.flush();
  assert.equal(status.dataset.state, 'saved');
  assert.equal(status.textContent, '已记住阅读位置。');
  h.panel.scrollTop = 1950; h.panel.dispatch('scroll'); h.flush();
  assert.equal(status.textUpdates.length, 2);
});

test('滚动章节采集从粘附阅读控件下方判断，位置本身仍保存实际scrollTop', () => {
  const h = harness({ lessonId: 'l5-1', stickyControls: true });
  h.flush();
  h.panel.scrollTop = 750; h.panel.dispatch('scroll'); h.flush();
  assert.deepEqual(h.writes.at(-1), { lessonId: 'l5-1', section: 'read', scrollTop: 750 });
});
