import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getLesson } from '../web/js/learning-curriculum.js';

if (process.argv.includes('--help')) {
  console.log('Usage: node scripts/test-course-weak-questions.mjs\nYIJING_COURSE_WEAK_SCOPE optionally filters scenario names; BROWSER_PATH selects Chromium. Run only after UI/data integration is ready.');
  process.exit(0);
}

// Isolated acceptance probe. Business operations use trusted CDP Input only.
const root = fileURLToPath(new URL('../', import.meta.url));
const candidates = [process.env.BROWSER_PATH,
  process.env['ProgramFiles(x86)'] && join(process.env['ProgramFiles(x86)'], 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
  process.env.ProgramFiles && join(process.env.ProgramFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
  '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean);
const browserPath = candidates.find(existsSync);
assert.ok(browserPath, 'Set BROWSER_PATH to an installed Chromium executable.');
const runStamp = new Date().toISOString().replace(/[:.]/g, '-');
const output = resolve(process.env.YIJING_COURSE_WEAK_EVIDENCE_DIR || join(root, 'docs/development/evidence/2026-10-25-course-weak-input', runStamp));
mkdirSync(output, { recursive: true });
const temporaryRoot = realpathSync(tmpdir());
const profile = mkdtempSync(join(temporaryRoot, 'yijing-course-weak-'));
const achievementKey = 'yijing.achievements.v1';
const learningKey = 'yijing-learning-record-v2';
const activityKey = 'yijing-activity-v1';
const dataKeys = [learningKey, achievementKey, activityKey, 'yijing.study.v1', 'yijing-review-cards'];
const observedFiles = ['web/js/learning-curriculum.js', 'web/js/modes/review-mode.js', 'web/js/main.js', 'web/styles/immersive.css', 'web/data/hexagrams.json', 'web/data/wings.json', 'web/data/almanac-terms.json', 'web/js/learning-progress.js', 'web/js/learning-assessment.js', 'web/js/learning-assessment-page.js', 'web/js/modes/learning-mode.js', 'web/js/user-data.js', 'web/js/study-page.js', 'web/js/achievement-engine.js', 'web/js/achievement-storage.js', 'web/data/theorems.json', 'web/data/trigrams.json', 'scripts/test-course-weak-questions.mjs'];
const hashes = () => Object.fromEntries(observedFiles.map(path => [path,
  createHash('sha256').update(readFileSync(join(root, path))).digest('hex')]));
const report = { startedAt: new Date().toISOString(), command: 'node scripts/test-course-weak-questions.mjs',
  node: process.version, browserPath, profile, head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  sourceHashes: hashes(), scenarios: [], status: 'running',
  limitations: ['Headless Chromium desktop and emulated mobile; not physical mobile, screen-reader or real 200% zoom evidence.',
    'Read-only Debugger breakpoint captures generated public questions. No business function or DOM click is invoked. Storage quota and obsolete-reference fixtures are explicitly marked.',
    'Operating-system IME, physical devices, screen readers and true browser zoom are outside this probe.',
    'Storage inspection reads only generated synthetic study records. Obsolete-reference fixtures explicitly replace one synthetic question reference; they are not ordinary user flows.'] };
const saveTrace = () => writeFileSync(join(output, 'trace.json'), `${JSON.stringify(report, null, 2)}\n`);
saveTrace();
const pause = milliseconds => new Promise(resolvePause => setTimeout(resolvePause, milliseconds));
async function waitFor(check, message, timeout = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (await check()) return;
    await pause(25); // Observe conditions, do not wait a fixed animation duration.
  }
  throw new Error(message);
}
function freePort() {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolvePort(port));
    });
  });
}
async function stopProcess(child) {
  if (!child || child.exitCode !== null) return;
  child.kill();
  await Promise.race([once(child, 'exit'), pause(3000)]);
}
class Client {
  constructor(url) {
    this.socket = new WebSocket(url);
    this.nextId = 1;
    this.pending = new Map();
    this.events = [];
    this.socket.addEventListener('message', ({ data }) => {
      const message = JSON.parse(data);
      if (!message.id) {
        this.events.push(message);
        if (message.method === 'Debugger.paused') void this.onPaused?.(message.params);
        return;
      }
      const pending = this.pending.get(message.id);
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message));
      else pending.resolve(message.result);
    });
  }
  async open() {
    if (this.socket.readyState === WebSocket.OPEN) return;
    await new Promise((resolveOpen, reject) => {
      this.socket.addEventListener('open', resolveOpen, { once: true });
      this.socket.addEventListener('error', reject, { once: true });
    });
  }
  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolveSend, reject) => {
      this.pending.set(id, { resolve: resolveSend, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
  async evaluate(expression) {
    const response = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text);
    return response.result.value;
  }
}
let client;
let server;
let browser;
let current;
let mobile = false;
let observerFailure;
async function pointFor(selector) {
  let point;
  try {
    await waitFor(async () => {
      point = await client.evaluate(`(async () => {
        const element = document.querySelector(${JSON.stringify(selector)});
        if (!element?.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) || element.closest('[inert]') || element.disabled) return null;
        const hit = () => {
          const rect = element.getBoundingClientRect();
          const point = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
          const target = document.elementFromPoint(point.x, point.y);
          return rect.width > 0 && rect.height > 0 && (target === element || element.contains(target)) ? point : null;
        };
        if (!hit()) { element.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' }); return null; }
        const before = element.getBoundingClientRect();
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const after = element.getBoundingClientRect();
        if (['x', 'y', 'width', 'height'].some(key => Math.abs(before[key] - after[key]) > 0.5)) return null;
        return hit();
      })()`);
      return point;
    }, `Cannot hit ${selector}`);
  } catch (error) {
    const detail = await client.evaluate(`(() => {
      const element = document.querySelector(${JSON.stringify(selector)});
      const rect = element?.getBoundingClientRect();
      return { rect: rect?.toJSON(), hidden: element?.closest('[hidden]')?.id, inert: element?.closest('[inert]')?.id,
        hit: rect ? document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)?.outerHTML.slice(0, 350) : null,
        stage: document.body.dataset.readingStage };
    })()`);
    throw new Error(`${error.message}: ${JSON.stringify(detail)}`);
  }
  return point;
}
async function click(selector) {
  const point = await pointFor(selector);
  current?.inputs.push({ selector, kind: mobile ? 'touch' : 'mouse', ...point });
  await client.evaluate(`document.querySelector(${JSON.stringify(selector)}).addEventListener('click', event => {
    window.__courseWeakProbe.inputEvents.push({ selector: ${JSON.stringify(selector)}, trusted: event.isTrusted,
      pointerType: event.pointerType, clientX: event.clientX, clientY: event.clientY });
  }, { once: true })`);
  if (mobile) {
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...point, id: 1 }] });
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } else {
    await client.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point });
    await client.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', buttons: 1, clickCount: 1 });
    await client.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', buttons: 0, clickCount: 1 });
  }
}
async function pressKey(key, modifiers = 0) {
  current?.inputs.push({ kind: 'keyboard', key, modifiers });
  const code = key.length === 1 ? `Key${key.toUpperCase()}` : key;
  const windowsVirtualKeyCode = { a: 65, Enter: 13, Escape: 27, Tab: 9, ArrowDown: 40, ArrowRight: 39, ' ': 32 }[key] || 0;
  await client.send('Input.dispatchKeyEvent', { type: key === 'Enter' ? 'keyDown' : 'rawKeyDown', key, code: key === ' ' ? 'Space' : code, windowsVirtualKeyCode, modifiers,
    ...(key === 'Enter' ? { text: '\r', unmodifiedText: '\r' } : {}),
    ...(key === 'a' && modifiers === 2 ? { commands: ['selectAll'] } : {}) });
  await client.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode, modifiers });
}

async function tabTo(selector) {
  for (let step = 0; step < 100; step += 1) {
    if (await client.evaluate(`document.activeElement === document.querySelector(${JSON.stringify(selector)})`)) return;
    await pressKey('Tab');
  }
  throw new Error(`Keyboard could not reach ${selector}`);
}
async function screenshot(name, { settle = true } = {}) {
  if (settle) {
    const selection = await client.evaluate('window.getSelection()?.toString() || ""');
    if (selection) {
      const selector = await client.evaluate(`['#assessment-result-title', '.course-weak-queue h3', '.lesson-workspace [data-page-heading]', '.mode-panel-title']
        .find(selector => document.querySelector(selector)?.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }))`);
      assert.ok(selector, 'A visible non-interactive heading is required to clear incidental selection');
      await click(selector);
      const remaining = await client.evaluate('window.getSelection()?.toString() || ""');
      current.checks.push({ label: 'clear-incidental-text-selection-with-real-heading-input', screenshot: name, selector, selection, remaining });
      assert.equal(remaining, '', 'Real heading input must collapse incidental text selection before evidence capture');
    }
  }
  if (settle) await waitFor(() => client.evaluate(`(async () => {
    const panel = document.querySelector('#detail-panel');
    const portal = document.querySelector('.mode-portal');
    if (document.body.classList.contains('mode-transitioning') || panel?.getAttribute('aria-busy') === 'true') return false;
    if (portal && getComputedStyle(portal).visibility !== 'hidden' && Number(getComputedStyle(portal).opacity) > 0.001) return false;
    if ([...document.querySelectorAll('#detail-content [style]')].some(element => /blur\\((?!0(?:px)?\\))/.test(element.style.filter))) return false;
    if (document.getAnimations().some(animation => {
      const target = animation.effect?.target;
      return (animation.pending || animation.playState === 'running') && animation.effect?.getTiming().iterations !== Infinity &&
        target?.checkVisibility?.({ checkOpacity: true, checkVisibilityCSS: true });
    })) return false;
    const surface = document.querySelector('.assessment-result, .course-weak-queue, .lesson-workspace') || panel;
    const before = surface?.getBoundingClientRect();
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const after = surface?.getBoundingClientRect();
    return before && after && ['x', 'y', 'width', 'height'].every(key => Math.abs(before[key] - after[key]) < 0.5);
  })()`), `Screenshot ${name} did not reach a stable surface`);
  const image = await client.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  const file = `${current.name}-${name}.png`;
  writeFileSync(join(output, file), Buffer.from(image.data, 'base64'));
  current.screenshots.push(file);
}
async function snapshot() {
  return client.evaluate(`(() => {
    const p = window.__courseWeakProbe;
    const read = key => JSON.parse(p.storage.getItem(key) || 'null');
    return { record: read(${JSON.stringify(learningKey)}), achievement: read(${JSON.stringify(achievementKey)}), activity: read(${JSON.stringify(activityKey)}), cards: read('yijing-review-cards'),
      writes: p.writes, inputs: p.inputEvents, keyboardEvents: p.keyboardEvents, submits: p.submits, sessionId: document.querySelector('[data-assessment-session]')?.dataset.assessmentSession,
      questions: document.querySelectorAll('.assessment-question').length, score: document.querySelector('.assessment-score')?.textContent,
      message: document.querySelector('.assessment-save-status')?.textContent, status: document.querySelector('.assessment-status')?.textContent,
      focus: { id: document.activeElement?.id, name: document.activeElement?.name, value: document.activeElement?.value, tag: document.activeElement?.tagName },
      retry: !!document.querySelector('[data-action="retry-save"]'), width: innerWidth, selection: window.getSelection()?.toString() || '', content: document.querySelector('#learning-content')?.textContent.slice(0,1000) };
  })()`);
}
const count = (state, key, saved = true) => state.writes.filter(write => write.key === key && write.saved === saved).length;
const probe = `(() => {
  const storage = localStorage;
  const originalSet = Storage.prototype.setItem;
  window.__courseWeakProbe = { storage, originalSet, blocked: [], writes: [], inputEvents: [], keyboardEvents: [], submits: [] };
  Storage.prototype.setItem = function(key, value) {
    const p = window.__courseWeakProbe;
    if (this !== p.storage || !${JSON.stringify(dataKeys)}.includes(key)) return originalSet.call(this, key, value);
    const saved = !p.blocked.includes(key);
    p.writes.push({ key, saved, at: performance.now(), payload: JSON.parse(value) });
    if (!saved) throw new DOMException('Assessment-session quota fixture', 'QuotaExceededError');
    return originalSet.call(this, key, value);
  };
  document.addEventListener('submit', event => {
    if (event.target.matches('.assessment-form')) window.__courseWeakProbe.submits.push({ at: performance.now(), trusted: event.isTrusted,
      sessionId: document.querySelector('[data-assessment-session]')?.dataset.assessmentSession });
  }, true);
  document.addEventListener('keydown', event => {
    window.__courseWeakProbe.keyboardEvents.push({ key: event.key, trusted: event.isTrusted, at: performance.now(),
      target: event.target.name || event.target.id || event.target.tagName });
  }, true);
})();`;
let siteUrl;
async function boot(width, height) {
  mobile = width < 768;
  await client.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile });
  await client.send('Emulation.setTouchEmulationEnabled', { enabled: mobile });
  await client.evaluate(`if (location.origin !== 'null') for (const key of ${JSON.stringify(dataKeys)}) localStorage.removeItem(key)`);
  const previous = await client.evaluate('performance.timeOrigin');
  await client.send('Page.navigate', { url: `${siteUrl}?course-weak-probe=${current.name}` });
  await waitFor(() => client.evaluate(`performance.timeOrigin !== ${previous} && document.querySelector('#loading')?.hidden === true && !!window.__courseWeakProbe`), 'Application did not initialize', 30000);
  if (await client.evaluate('!document.querySelector("#daily-overlay").hidden')) await click('[data-entry="explore"]');
  await click('.mode-btn[data-mode="learning"]');
  await waitFor(() => client.evaluate('!!document.querySelector(".learning-tabs")'), 'Learning did not open');
}
async function hub() {
  if (await client.evaluate('!!document.querySelector(\'[data-action="lesson-quiz"]\')')) return;
  if (await client.evaluate('!!document.querySelector(".lesson-back") && !document.querySelector("#learning-tab-profile").checkVisibility()')) await click('.lesson-back');
  await click('#learning-tab-profile');
  await click('[data-section-target="assessment"]');
  await waitFor(() => client.evaluate('!!document.querySelector(\'[data-action="lesson-quiz"]\')'), 'Assessment hub did not open');
}
async function observedSession() {
  await waitFor(async () => {
    const state = await snapshot();
    return state.questions > 0 && current.sessions.some(session => session?.id === state.sessionId);
  }, 'Question session was not observed');
  const state = await snapshot();
  return current.sessions.find(session => session?.id === state.sessionId);
}
async function startLesson(lessonId = 'l1-4') {
  await click('#learning-tab-path');
  await click(`[data-step="${lessonId}"] [data-action="assess"]`);
  return observedSession();
}
async function answer(session, keyboard = false, wrongIds = new Set()) {
  for (let index = 0; index < session.questions.length; index += 1) {
    const item = session.questions[index];
    const option = item.options.findIndex(entry => wrongIds.has(item.id) ? entry.value !== item.answer : entry.value === item.answer);
    const selector = `input[name="question-${index}"][value="${option}"]`;
    if (keyboard) {
      await tabTo(`input[name="question-${index}"]`);
      const selected = await client.evaluate('Number(document.activeElement.value)');
      for (let step = 0; step < (option - selected + item.options.length) % item.options.length; step += 1) await pressKey('ArrowDown');
      await pressKey(' ');
    } else await click(selector);
    assert.equal(await client.evaluate(`document.querySelector(${JSON.stringify(selector)}).checked`), true);
  }
}
async function submitted() {
  await waitFor(() => client.evaluate('!!document.querySelector(".assessment-result")'), 'Result did not render');
  assert.equal(observerFailure, undefined);
  return snapshot();
}
function assertOne(state, session, attempts = 1) {
  assert.equal(state.record.lessons[session.lessonId].attempts, attempts);
  assert.equal(state.record.processedAssessmentIds.filter(id => id === session.id).length, 1);
  assert.equal(state.record.assessmentSessions.filter(item => item.sessionId === session.id).length, 1);
  assert.equal(state.achievement.processedKeys.filter(id => id === `learning-record:assessed:${session.lessonId}:${session.id}`).length, 1);
  assert.equal(state.record.assessmentSessions.find(item => item.sessionId === session.id).correct, session.questions.length);
}
async function runScenario(name, viewport, fixture, action) {
  if (process.env.YIJING_COURSE_WEAK_SCOPE && !name.includes(process.env.YIJING_COURSE_WEAK_SCOPE)) return;
  current = { name, viewport, fixture, status: 'running', sessions: [], inputs: [], checks: [], screenshots: [] };
  report.scenarios.push(current); saveTrace();
  try {
    await boot(viewport.width, viewport.height);
    await action();
    const final = await snapshot();
    assert.ok(final.inputs.length > 0 && final.inputs.every(input => input.trusted), 'Business click was not trusted');
    assert.ok(final.submits.every(event => event.trusted), 'Submit was not trusted');
    assert.ok(final.keyboardEvents.every(event => event.trusted), 'Keyboard input was not trusted');
    current.trustedInputEvidence = { clicks: final.inputs, keyboard: final.keyboardEvents, submits: final.submits };
    current.status = 'passed'; console.log(`PASS ${name}`);
  } catch (error) {
    current.status = 'failed'; current.failure = { message: error.message, stack: error.stack };
    try { current.failureState = await snapshot(); await screenshot('failure', { settle: false }); } catch {}
    throw error;
  } finally { saveTrace(); }
}

const weakItems = state => Object.values(state.record?.weakQuestions || {});
const pendingItems = state => weakItems(state).filter(item => item.status !== 'resolved');
async function openCourseQueue() {
  await click('.mode-btn[data-mode="review"]');
  await waitFor(() => client.evaluate('!!document.querySelector(".course-weak-queue")'), 'Course queue did not open');
}
async function checkNarrowCourseQueue() {
  await client.send('Emulation.setDeviceMetricsOverride', { width: 320, height: 844, deviceScaleFactor: 1, mobile: true });
  await waitFor(() => client.evaluate('innerWidth === 320 && matchMedia("(max-width: 320px)").matches'), '320 CSS pixel viewport did not apply');
  const controls = [];
  for (const selector of ['[data-action="weak-source-0"]', '[data-action="weak-practice-0"]']) {
    controls.push({ selector, point: await pointFor(selector) });
  }
  const layout = await client.evaluate(`(() => {
    const panel = document.querySelector('#detail-panel');
    const queue = document.querySelector('.course-weak-queue');
    return { width: innerWidth, rootScrollWidth: document.documentElement.scrollWidth,
      rootClientWidth: document.documentElement.clientWidth, panelScrollWidth: panel.scrollWidth,
      panelClientWidth: panel.clientWidth, queue: queue.getBoundingClientRect().toJSON() };
  })()`);
  assert.ok(layout.rootScrollWidth <= layout.rootClientWidth + 1, '320px page must not overflow horizontally');
  assert.ok(layout.panelScrollWidth <= layout.panelClientWidth + 1, '320px review panel must not overflow horizontally');
  assert.ok(layout.queue.left >= -1 && layout.queue.right <= layout.width + 1, '320px course queue must stay inside the viewport');
  current.checks.push({ label: '320-css-viewport-queue-actions-reachable', limitation: 'CSS viewport simulation; not physical device or real browser zoom', layout, controls });
  await screenshot('320-css-review-queue');
  await client.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await waitFor(() => client.evaluate('innerWidth === 390'), '390 CSS pixel viewport did not restore');
}
async function sourceFromQueue(question) {
  const before = await snapshot();
  await click('[data-action="weak-source-0"]');
  await waitFor(() => client.evaluate('!!document.querySelector(".lesson-back")'), 'Original course did not open');
  const source = await snapshot();
  assert.notEqual(source.record.weakQuestions[question.id].status, 'resolved');
  assert.equal(source.record.weakQuestions[question.id].wrongCount, before.record.weakQuestions[question.id].wrongCount);
  assert.equal(source.record.weakQuestions[question.id].lastSessionId, before.record.weakQuestions[question.id].lastSessionId);
  assert.equal(source.record.lessons[question.lessonId].attempts, before.record.lessons[question.lessonId].attempts);
  assert.equal(source.record.weakQuestions[question.id].resolvedAt, null, 'Opening the source must not resolve a weak item');
  assert.ok(await client.evaluate(`document.querySelector('#learning-content')?.textContent.includes(${JSON.stringify(getLesson(question.lessonId).title)})`));
  current.checks.push({ label: 'source-is-review-not-correction', state: source });
  const returnLabel = await client.evaluate('document.querySelector(".lesson-back")?.textContent.trim()');
  current.checks.push({ label: 'original-course-return-label', lessonId: question.lessonId, actual: returnLabel, expected: '返回温故队列' });
  assert.equal(returnLabel, '返回温故队列', 'Original-course exit must describe its actual course-review destination');
  if (question.lessonId === 'l1-1') {
    await click('.lesson-continue');
    await waitFor(() => client.evaluate('!!document.querySelector(".lesson-reader-workspace")'), 'First-course reader did not open');
    assert.equal(await client.evaluate('document.querySelector(".lesson-back")?.textContent.trim()'), '返回课程概览');
    await click('.lesson-back');
    await waitFor(() => client.evaluate('!!document.querySelector(".lesson-overview-workspace")'), 'First-course internal back did not restore its overview');
    assert.equal(await client.evaluate('document.querySelector(".lesson-back")?.textContent.trim()'), '返回温故队列');
    assert.equal((await snapshot()).record.weakQuestions[question.id].status, source.record.weakQuestions[question.id].status);
    current.checks.push({ label: 'first-course-reader-keeps-internal-overview-return', state: await snapshot() });
  } else {
    assert.equal(await client.evaluate('document.querySelector(".lesson-back-secondary")?.textContent.trim()'), '返回温故队列');
  }
  await screenshot('original-course-return');
  await click('.lesson-back');
  await waitFor(() => client.evaluate('!!document.querySelector(".course-weak-queue")'), 'Original course return did not restore the course queue');
  const returned = await snapshot();
  assert.deepEqual(returned.record.weakQuestions, source.record.weakQuestions, 'Returning from the source must keep course weak evidence unchanged');
  assert.equal(await client.evaluate('document.querySelectorAll(".course-weak-queue [data-weak-question-id]").length'), 1);
  current.checks.push({ label: 'original-course-return-restores-review-queue', state: returned });
}
async function beginPractice(question) {
  await click('[data-action="weak-practice-0"]');
  const session = await observedSession();
  assert.equal(session.kind, 'lesson');
  assert.equal(session.lessonId, question.lessonId);
  assert.equal(session.questions.length, 3);
  assert.equal(session.questions.filter(item => item.id === question.id && item.questionVersion === question.questionVersion).length, 1);
  return session;
}
async function wrongCourse(lessonId, { keyboard = false, doubleSubmit = false } = {}) {
  const session = await startLesson(lessonId);
  const question = session.questions[0];
  await answer(session, keyboard, new Set([question.id]));
  if (doubleSubmit && !mobile) {
    const point = await pointFor('.assessment-form button[type="submit"]');
    current.inputs.push({ kind: 'mouse-double-submit', ...point });
    for (let clickCount = 1; clickCount <= 2; clickCount += 1) {
      await client.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', buttons: 1, clickCount });
      await client.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', buttons: 0, clickCount });
    }
  } else await click('.assessment-form button[type="submit"]');
  const state = await submitted();
  const weak = state.record?.weakQuestions?.[question.id];
  assert.ok(weak, 'A real incorrect answer must create a course weak item');
  assert.equal(weak.status, 'due');
  assert.equal(weak.wrongCount, 1);
  assert.equal(weak.lastSessionId, session.id);
  assert.equal(weak.sourceKind, 'course');
  assert.equal(weak.lessonId, question.lessonId);
  assert.equal(weak.questionVersion, question.questionVersion);
  assert.equal(weak.questionType, question.kind);
  assert.equal(weak.targetCode, question.targetCode);
  assert.equal(weak.termId, question.termId);
  assert.equal(pendingItems(state).length, 1);
  assert.equal(state.record.lessons[lessonId].attempts, 1);
  assert.equal(state.record.processedAssessmentIds.filter(id => id === session.id).length, 1);
  assert.equal(state.record.assessmentSessions.filter(item => item.sessionId === session.id).length, 1);
  assert.equal(state.record.assessmentSessions.find(item => item.sessionId === session.id).correct, 2);
  current.checks.push({ label: 'one-wrong-original-rule-queued-once', state });
  return { session, question, state };
}

async function correctFromQueue(question, originalSession) {
  const session = await beginPractice(question);
  assert.notEqual(session.id, originalSession.id);
  await answer(session, !mobile);
  await click('.assessment-form button[type="submit"]');
  const corrected = await submitted();
  const weak = corrected.record.weakQuestions[question.id];
  assert.equal(weak.status, 'resolved');
  assert.ok(weak.resolvedAt);
  assert.equal(weak.wrongCount, 1);
  assert.equal(weak.lastSessionId, session.id);
  assert.equal(corrected.record.lessons[question.lessonId].attempts, 2);
  assert.equal(pendingItems(corrected).length, 0);
  const resultIndex = session.questions.findIndex(item => item.id === question.id);
  assert.match(await client.evaluate(`document.querySelector('[data-action="weak-practice-${resultIndex}"]')?.closest('details')?.querySelector('.course-weak-status')?.textContent || ''`), /纠正/);
  current.checks.push({ label: 'new-normal-lesson-corrects-only-original-rule', state: corrected });
  await screenshot('corrected');
  await click('[data-action="return-review"]');
  await waitFor(() => client.evaluate('!!document.querySelector(".course-weak-queue")'), 'Return after final correction did not open the course queue');
  assert.equal(await client.evaluate('document.querySelectorAll(".course-weak-queue [data-weak-question-id]").length'), 0);
  assert.equal(pendingItems(await snapshot()).length, 0);
  await screenshot('final-item-return');
}

try {
  const [sitePort, debugPort] = await Promise.all([freePort(), freePort()]);
  siteUrl = `http://127.0.0.1:${sitePort}/`;
  server = spawn(process.execPath, ['scripts/serve.mjs'], { cwd: root, env: { ...process.env, PORT: String(sitePort) }, stdio: 'ignore', windowsHide: true });
  await waitFor(async () => { try { return (await fetch(siteUrl)).ok; } catch { return false; } }, 'Server did not start');
  browser = spawn(browserPath, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--no-sandbox',
    `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore', windowsHide: true });
  let target;
  await waitFor(async () => { try { target = (await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json()).find(item => item.type === 'page'); return target; } catch { return false; } }, 'Browser did not start', 30000);
  client = new Client(target.webSocketDebuggerUrl); await client.open();
  for (const domain of ['Runtime', 'Page', 'Log', 'Debugger']) await client.send(`${domain}.enable`);
  report.browser = await client.send('Browser.getVersion');
  await client.send('Page.addScriptToEvaluateOnNewDocument', { source: probe });
  const lines = readFileSync(join(root, 'web/js/learning-assessment-page.js'), 'utf8').split(/\r?\n/);
  const line = lines.findIndex(value => value.trim() === 'const session = createAssessmentSession(kind, questionBank, options);');
  assert.ok(line >= 0);
  await client.send('Debugger.setBreakpointByUrl', { urlRegex: '/js/learning-assessment-page\\.js(?:\\?.*)?$', lineNumber: line + 1 });
  client.onPaused = async params => {
    try {
      const value = await client.send('Debugger.evaluateOnCallFrame', { callFrameId: params.callFrames[0].callFrameId, expression: 'session', returnByValue: true });
      if (value.exceptionDetails) throw new Error(value.exceptionDetails.text);
      current.sessions.push(value.result.value);
    } catch (error) { observerFailure = error.message; }
    finally { await client.send('Debugger.resume'); }
  };
  const desktop = { width: 1440, height: 1024 }, phone = { width: 390, height: 844 };
  for (const [viewport, lessonId] of [[desktop, 'l1-1'], [phone, 'l5-1']]) {
    await runScenario(`${viewport.width}-${lessonId}-course-cycle`, viewport, 'none; one real wrong answer, then original-course reading and new ordinary lesson practice', async () => {
      const { session, question, state } = await wrongCourse(lessonId, { keyboard: !mobile, doubleSubmit: !mobile });
      assert.equal(question.targetCode, null);
      if (lessonId === 'l5-1') assert.ok(question.termId);
      else assert.equal(question.termId, null);
      assert.equal(state.cards, null, 'Non-hexagram course mistakes must not fabricate spaced hexagram cards');
      assert.equal(count(state, 'yijing-review-cards'), 0);
      await screenshot('wrong-result');
      await click('[data-action="return-review"]');
      await waitFor(() => client.evaluate('document.querySelectorAll(".course-weak-queue [data-weak-question-id]").length === 1'), 'Saved course weak item missing from review queue');
      await screenshot('review-queue');
      if (mobile) await checkNarrowCourseQueue();
      await sourceFromQueue(question);
      await correctFromQueue(question, session);
      const final = await snapshot();
      assert.equal(final.cards, null);
      assert.equal(count(final, 'yijing-review-cards'), 0);
      if (mobile) assert.ok(final.inputs.every(input => input.pointerType === 'touch'));
    });
  }
  for (const viewport of [desktop, phone]) {
    await runScenario(`${viewport.width}-storage-retry`, viewport, 'QuotaExceededError injected only into the synthetic learning-record storage key; business actions use Input', async () => {
      const session = await startLesson('l1-1');
      const question = session.questions[0];
      await answer(session, false, new Set([question.id]));
      const before = await snapshot();
      await client.evaluate(`window.__courseWeakProbe.blocked = [${JSON.stringify(learningKey)}]`);
      await click('.assessment-form button[type="submit"]');
      const failed = await submitted();
      assert.deepEqual(failed.record, before.record);
      assert.equal(failed.sessionId, session.id);
      assert.equal(failed.retry, true);
      assert.match(failed.message, /未能保存|保存失败/);
      assert.equal(pendingItems(failed).length, 0);
      await screenshot('save-failed');
      await click('[data-action="retry-save"]');
      const repeated = await submitted();
      assert.equal(repeated.sessionId, session.id);
      assert.equal(repeated.score, failed.score);
      assert.deepEqual(repeated.record, before.record);
      assert.equal(count(repeated, learningKey), 0);
      await client.evaluate('window.__courseWeakProbe.blocked = []');
      await click('[data-action="retry-save"]');
      const saved = await submitted();
      assert.equal(saved.sessionId, session.id);
      assert.equal(saved.score, failed.score);
      assert.equal(saved.retry, false);
      assert.equal(saved.record.lessons[session.lessonId].attempts, 1);
      assert.equal(saved.record.processedAssessmentIds.filter(id => id === session.id).length, 1);
      assert.equal(saved.record.weakQuestions[question.id].wrongCount, 1);
      assert.equal(saved.record.weakQuestions[question.id].lastSessionId, session.id);
      assert.equal(count(saved, learningKey), 1);
      assert.equal(saved.cards, null);
      current.checks.push({ label: 'retry-same-session-and-answer-atomic-weak-record', failed, repeated, saved });
      await screenshot('save-recovered');
    });
  }
  for (const obsolete of ['question', 'version']) {
    await runScenario(`1440-obsolete-${obsolete}`, desktop, `Explicit fixture: after one real wrong answer, replace only its synthetic ${obsolete} reference; keep the historical weak item`, async () => {
      const { question } = await wrongCourse('l1-1');
      await client.evaluate(`(() => {
        const p = window.__courseWeakProbe;
        const record = JSON.parse(p.storage.getItem(${JSON.stringify(learningKey)}));
        const item = record.weakQuestions[${JSON.stringify(question.id)}];
        ${obsolete === 'version' ? "item.questionVersion = 'curriculum-retired';" : `delete record.weakQuestions[${JSON.stringify(question.id)}]; item.questionId = 'retired-original-question'; record.weakQuestions[item.questionId] = item;`}
        p.originalSet.call(p.storage, ${JSON.stringify(learningKey)}, JSON.stringify(record));
      })()`);
      await openCourseQueue();
      const before = await snapshot();
      await click('[data-action="weak-practice-0"]');
      await waitFor(() => client.evaluate('!!document.querySelector(\'[data-action="weak-source"]\')'), 'Obsolete reference did not offer original-course fallback');
      assert.equal(await client.evaluate('document.querySelectorAll(".assessment-question").length'), 0, 'Obsolete reference must not silently start a random replacement quiz');
      assert.match(await client.evaluate('document.querySelector("#learning-content")?.textContent || document.querySelector("#detail-panel")?.textContent || ""'), /调整|题库|失效|暂不能/);
      assert.deepEqual((await snapshot()).record, before.record);
      await screenshot('obsolete-fallback');
      await click('[data-action="weak-source"]');
      await waitFor(() => client.evaluate('!!document.querySelector(".lesson-back")'), 'Obsolete item fallback did not open its original course');
      assert.ok(await client.evaluate(`document.querySelector('#learning-content')?.textContent.includes(${JSON.stringify(getLesson(question.lessonId).title)})`));
      const after = await snapshot();
      const key = obsolete === 'version' ? question.id : 'retired-original-question';
      assert.ok(after.record.weakQuestions[key]);
      assert.notEqual(after.record.weakQuestions[key].status, 'resolved');
      assert.equal(after.record.lessons['l1-1'].attempts, 1);
      assert.equal(after.record.processedAssessmentIds.length, 1);
      current.checks.push({ label: 'obsolete-reference-kept-safe-original-course-fallback', before, after });
      await screenshot('original-course-fallback');
    });
  }
  assert.ok(report.scenarios.length > 0, 'No scenarios matched YIJING_COURSE_WEAK_SCOPE');
  report.status = 'passed';
} catch (error) {
  report.status = 'failed'; report.failure = { message: error.message, stack: error.stack }; process.exitCode = 1;
  console.error(error.stack);
} finally {
  report.finishedAt = new Date().toISOString(); report.finalSourceHashes = hashes();
  report.sourceStableDuringRun = JSON.stringify(report.sourceHashes) === JSON.stringify(report.finalSourceHashes);
  report.pageErrors = client?.events.filter(event => event.method === 'Runtime.exceptionThrown') || [];
  report.browserLogs = client?.events.filter(event => event.method === 'Log.entryAdded').map(event => event.params.entry) || [];
  if (report.status === 'passed' && (!report.sourceStableDuringRun || report.pageErrors.length || observerFailure)) {
    report.status = 'failed'; report.failure = { message: observerFailure || (!report.sourceStableDuringRun ? 'Source changed during run' : 'Uncaught page errors') }; process.exitCode = 1;
  }
  client?.socket.close(); await stopProcess(browser); await stopProcess(server);
  report.profileRemoved = false;
  report.profileRetainedReason = 'Isolated synthetic profile retained for diagnosis; no user browser profile is used or modified.';
  saveTrace();
  const summary = JSON.stringify({ status: report.status, browser: report.browser?.product, passed: report.scenarios.filter(item => item.status === 'passed').length,
    total: report.scenarios.length, trace: join(output, 'trace.json'), profileRemoved: report.profileRemoved });
  writeFileSync(join(output, 'run.log'), `${report.scenarios.map(item => `${item.status.toUpperCase()} ${item.name}${item.failure ? ': ' + item.failure.stack : ''}`).join('\n')}\n${summary}\n`);
  console.log(summary);
}
