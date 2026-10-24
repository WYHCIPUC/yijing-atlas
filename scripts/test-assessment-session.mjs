import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Isolated acceptance probe. Business operations use trusted CDP Input only.
const root = fileURLToPath(new URL('../', import.meta.url));
const candidates = [process.env.BROWSER_PATH,
  process.env['ProgramFiles(x86)'] && join(process.env['ProgramFiles(x86)'], 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
  process.env.ProgramFiles && join(process.env.ProgramFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
  '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean);
const browserPath = candidates.find(existsSync);
assert.ok(browserPath, 'Set BROWSER_PATH to an installed Chromium executable.');
const runStamp = new Date().toISOString().replace(/[:.]/g, '-');
const output = resolve(process.env.YIJING_ASSESSMENT_EVIDENCE_DIR || join(root, 'docs/development/evidence/2026-10-25-assessment-session', runStamp));
mkdirSync(output, { recursive: true });
const temporaryRoot = realpathSync(tmpdir());
const profile = mkdtempSync(join(temporaryRoot, 'yijing-assessment-session-'));
const achievementKey = 'yijing.achievements.v1';
const learningKey = 'yijing-learning-record-v2';
const activityKey = 'yijing-activity-v1';
const dataKeys = [learningKey, achievementKey, activityKey, 'yijing.study.v1'];
const observedFiles = ['web/js/learning-progress.js', 'web/js/learning-assessment.js', 'web/js/learning-assessment-page.js', 'web/js/modes/learning-mode.js', 'web/js/user-data.js', 'web/js/study-page.js', 'web/js/achievement-engine.js', 'web/js/achievement-storage.js', 'web/data/theorems.json', 'web/data/trigrams.json', 'scripts/test-assessment-session.mjs'];
const hashes = () => Object.fromEntries(observedFiles.map(path => [path,
  createHash('sha256').update(readFileSync(join(root, path))).digest('hex')]));
const report = { startedAt: new Date().toISOString(), command: 'node scripts/test-assessment-session.mjs',
  node: process.version, browserPath, profile, head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  sourceHashes: hashes(), scenarios: [], status: 'running',
  limitations: ['Headless Chromium desktop and emulated mobile; not physical mobile, screen-reader or real 200% zoom evidence.',
    'Read-only Debugger breakpoint captures generated public questions. No business function or DOM click is invoked. Storage and tampered-option fixtures are explicitly marked.',
    'Result redraw uses the real save-retry button; viewport resize verifies result retention. Leaving assessment has no public route that restores the previous result; direct repeated-render behavior remains unit-test evidence.'] };
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
    window.__assessmentProbe.inputEvents.push({ selector: ${JSON.stringify(selector)}, trusted: event.isTrusted,
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
  const windowsVirtualKeyCode = { a: 65, Enter: 13, Escape: 27, Tab: 9, ArrowDown: 40, ' ': 32 }[key] || 0;
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
async function screenshot(name) {
  const image = await client.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  const file = `${current.name}-${name}.png`;
  writeFileSync(join(output, file), Buffer.from(image.data, 'base64'));
  current.screenshots.push(file);
}
async function snapshot() {
  return client.evaluate(`(() => {
    const p = window.__assessmentProbe;
    const read = key => JSON.parse(p.storage.getItem(key) || 'null');
    return { record: read(${JSON.stringify(learningKey)}), achievement: read(${JSON.stringify(achievementKey)}), activity: read(${JSON.stringify(activityKey)}),
      writes: p.writes, inputs: p.inputEvents, keyboardEvents: p.keyboardEvents, submits: p.submits, sessionId: document.querySelector('[data-assessment-session]')?.dataset.assessmentSession,
      questions: document.querySelectorAll('.assessment-question').length, score: document.querySelector('.assessment-score')?.textContent,
      message: document.querySelector('.assessment-save-status')?.textContent, status: document.querySelector('.assessment-status')?.textContent,
      focus: { id: document.activeElement?.id, name: document.activeElement?.name, value: document.activeElement?.value, tag: document.activeElement?.tagName },
      retry: !!document.querySelector('[data-action="retry-save"]'), width: innerWidth, content: document.querySelector('#learning-content')?.textContent.slice(0,1000) };
  })()`);
}
const count = (state, key, saved = true) => state.writes.filter(write => write.key === key && write.saved === saved).length;
const probe = `(() => {
  const storage = localStorage;
  const originalSet = Storage.prototype.setItem;
  window.__assessmentProbe = { storage, originalSet, blocked: [], writes: [], inputEvents: [], keyboardEvents: [], submits: [] };
  Storage.prototype.setItem = function(key, value) {
    const p = window.__assessmentProbe;
    if (this !== p.storage || !${JSON.stringify(dataKeys)}.includes(key)) return originalSet.call(this, key, value);
    const saved = !p.blocked.includes(key);
    p.writes.push({ key, saved, at: performance.now(), payload: JSON.parse(value) });
    if (!saved) throw new DOMException('Assessment-session quota fixture', 'QuotaExceededError');
    return originalSet.call(this, key, value);
  };
  document.addEventListener('submit', event => {
    if (event.target.matches('.assessment-form')) window.__assessmentProbe.submits.push({ at: performance.now(), trusted: event.isTrusted,
      sessionId: document.querySelector('[data-assessment-session]')?.dataset.assessmentSession });
  }, true);
  document.addEventListener('keydown', event => {
    window.__assessmentProbe.keyboardEvents.push({ key: event.key, trusted: event.isTrusted, at: performance.now(),
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
  await client.send('Page.navigate', { url: `${siteUrl}?assessment-probe=${current.name}` });
  await waitFor(() => client.evaluate(`performance.timeOrigin !== ${previous} && document.querySelector('#loading')?.hidden === true && !!window.__assessmentProbe`), 'Application did not initialize', 30000);
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
async function answer(session, keyboard = false) {
  for (let index = 0; index < session.questions.length; index += 1) {
    const item = session.questions[index];
    const option = item.options.findIndex(entry => entry.value === item.answer);
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
    try { current.failureState = await snapshot(); await screenshot('failure'); } catch {}
    throw error;
  } finally { saveTrace(); }
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
  await runScenario('1440-normal-unanswered-double-new-round', desktop, 'none', async () => {
    const session = await startLesson();
    await click('.assessment-form button[type="submit"]');
    const missing = await snapshot();
    assert.match(missing.status, /第 1 题/); assert.equal(missing.focus.name, 'question-0'); assert.equal(missing.record, null);
    current.checks.push({ label: 'unanswered-first-focus-no-save', state: missing });
    await answer(session, true);
    const keyboardState = await snapshot();
    assert.ok(keyboardState.keyboardEvents.some(event => event.key === ' ' && event.trusted), 'No trusted keyboard option activation');
    const point = await pointFor('.assessment-form button[type="submit"]');
    const doubleStarted = Date.now();
    for (let clickCount = 1; clickCount <= 2; clickCount += 1) {
      await client.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', buttons: 1, clickCount });
      await client.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', buttons: 0, clickCount });
    }
    const first = await submitted(); assertOne(first, session); assert.equal(count(first, learningKey), 1); assert.equal(count(first, activityKey), 1);
    current.checks.push({ label: 'rapid-double-input-single-round', inputElapsedMs: Date.now() - doubleStarted, state: first }); await screenshot('result');
    await client.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
    const resized = await snapshot(); assert.equal(resized.sessionId, session.id); assert.deepEqual(resized.record, first.record); assert.deepEqual(resized.writes, first.writes);
    await client.send('Emulation.setDeviceMetricsOverride', { ...desktop, deviceScaleFactor: 1, mobile: false });
    await click('#learning-tab-profile');
    const profileState = await snapshot(); assertOne(profileState, session); assert.deepEqual(profileState.achievement, first.achievement);
    await hub(); const hubState = await snapshot(); assert.deepEqual(hubState.record, first.record);
    current.checks.push({ label: 'result-resize-and-profile-return-no-recount', state: hubState });
    const next = await startLesson(); assert.notEqual(next.id, session.id); await answer(next);
    await click('.assessment-form button[type="submit"]'); const second = await submitted(); assertOne(second, next, 2);
    assert.equal(second.achievement.metrics.trigramRounds.length, 2); current.checks.push({ label: 'new-round-independent', state: second });
  });
  await runScenario('1440-empty-and-insufficient-real-pool', desktop, 'none; one course is browsed through its real UI', async () => {
    await hub(); await click('[data-action="spot-check"]'); const empty = await snapshot();
    assert.match(empty.content, /先浏览一课/); assert.equal(empty.record, null); current.checks.push({ label: 'unviewed-empty', state: empty }); await screenshot('empty');
    await click('[data-action="back"]'); await click('#learning-tab-path'); await click('[data-step="l1-1"] [data-action="learn"]');
    await hub(); await click('[data-action="spot-check"]');
    const short = await observedSession();
    assert.equal(short.questions.length, 4); assert.equal((await snapshot()).questions, 4); assert.ok(short.questions.every(item => item.lessonId === 'l1-1'));
    await answer(short); await click('.assessment-form button[type="submit"]'); const result = await submitted();
    assert.equal(result.record.spotChecks.length, 1); assert.equal(result.record.spotChecks[0].total, 4);
    current.checks.push({ label: 'real-four-question-pool-no-fabricated-fifth', state: result }); await screenshot('four-question-result');
  });
  for (const viewport of [desktop, phone]) {
    for (const blocked of [learningKey, achievementKey]) {
      await runScenario(`${viewport.width}-${blocked === learningKey ? 'grade' : 'achievement'}-retry`, viewport, `Storage.setItem throws QuotaExceededError for ${blocked}; other storage remains real`, async () => {
        const session = await startLesson(); await answer(session);
        await client.evaluate(`window.__assessmentProbe.blocked = [${JSON.stringify(blocked)}]`);
        await click('.assessment-form button[type="submit"]'); const failed = await submitted();
        assert.match(failed.message, blocked === learningKey ? /本轮成绩未能保存/ : /成就证据未能保存/); assert.equal(failed.retry, true);
        assert.equal(failed.sessionId, session.id); await screenshot('save-failed');
        await click('[data-action="retry-save"]'); const again = await submitted();
        assert.equal(again.sessionId, session.id); assert.equal(again.message, failed.message);
        for (const targetKey of [learningKey, achievementKey, activityKey]) assert.equal(count(again, targetKey), count(failed, targetKey), 'Failed retry repeated a successful save');
        await client.evaluate('window.__assessmentProbe.blocked = []'); await click('[data-action="retry-save"]');
        const saved = await submitted(); assertOne(saved, session); assert.equal(saved.retry, false); assert.match(saved.message, /已保存/);
        assert.equal(count(saved, learningKey), 1); assert.equal(count(saved, activityKey), 1); assert.equal(count(saved, achievementKey), 2);
        assert.equal(saved.achievement.metrics.trigramRounds.length, 1);
        current.checks.push({ label: 'failure-redraw-retry-only-missing-saves', failed, repeated: again, saved }); await screenshot('recovered');
      });
    }
  }
  await runScenario('390-normal-touch', phone, 'none', async () => {
    const session = await startLesson(); await answer(session); await click('.assessment-form button[type="submit"]');
    const saved = await submitted(); assertOne(saved, session); assert.ok(saved.inputs.every(input => input.pointerType === 'touch'));
    current.checks.push({ label: 'touch-completes-course-quiz', state: saved }); await screenshot('result');
  });
  await runScenario('1440-known-id-without-receipt', desktop, 'Synthetic stored ID added after the real session is created, without grades/receipts', async () => {
    const session = await startLesson();
    const fixture = { version: 2, lessons: {}, spotChecks: [], exams: [], oralReviews: [], processedAssessmentIds: [session.id] };
    await client.evaluate(`window.__assessmentProbe.originalSet.call(localStorage, ${JSON.stringify(learningKey)}, ${JSON.stringify(JSON.stringify(fixture))})`);
    await answer(session); await click('.assessment-form button[type="submit"]'); const result = await submitted();
    assert.deepEqual(result.record, fixture); assert.equal(result.achievement, null); assert.equal(result.activity, null); assert.equal(result.writes.length, 0);
    assert.match(result.message, /本轮标识已处理/); assert.match(result.message, /无法补记成就证据/); assert.equal(result.retry, false); await screenshot('missing-receipt-message');
    await click('#learning-tab-profile'); const profileState = await snapshot(); assert.equal(profileState.achievement, null);
    current.checks.push({ label: 'known-id-does-not-regrade-or-invent-evidence', result, profileState });
  });
  await runScenario('1440-tampered-option-fixture', desktop, 'One checked radio value is deliberately changed to 999; submit still uses trusted Input', async () => {
    const session = await startLesson(); await answer(session);
    const selector = 'input[name="question-1"]:checked';
    const original = await client.evaluate(`document.querySelector(${JSON.stringify(selector)}).value`);
    await client.evaluate(`document.querySelector(${JSON.stringify(selector)}).value = '999'`);
    await click('.assessment-form button[type="submit"]'); const rejected = await snapshot();
    assert.match(rejected.status, /第 2 题/); assert.equal(rejected.focus.name, 'question-1'); assert.equal(rejected.record, null); assert.equal(rejected.writes.length, 0);
    await client.evaluate(`document.querySelector(${JSON.stringify(selector)}).value = ${JSON.stringify(original)}`);
    await click('.assessment-form button[type="submit"]'); assertOne(await submitted(), session);
    current.checks.push({ label: 'invalid-option-rejected-before-grading', state: rejected });
  });
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
  report.profileRetainedReason = 'Automatic approval rejected removal of the first aborted run profile; follow-up instruction requires retaining subsequent isolated profiles without retrying deletion.';
  saveTrace();
  const summary = JSON.stringify({ status: report.status, browser: report.browser?.product, passed: report.scenarios.filter(item => item.status === 'passed').length,
    total: report.scenarios.length, trace: join(output, 'trace.json'), profileRemoved: report.profileRemoved });
  writeFileSync(join(output, 'run.log'), `${report.scenarios.map(item => `${item.status.toUpperCase()} ${item.name}${item.failure ? ': ' + item.failure.stack : ''}`).join('\n')}\n${summary}\n`);
  console.log(summary);
}
