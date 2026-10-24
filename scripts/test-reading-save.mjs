import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
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
const output = resolve(process.env.YIJING_SAVE_EVIDENCE_DIR || join(root, 'docs/development/evidence/2026-10-25-reading-save', runStamp));
mkdirSync(output, { recursive: true });
const temporaryRoot = realpathSync(tmpdir());
const profile = mkdtempSync(join(temporaryRoot, 'yijing-reading-save-'));
const achievementKey = 'yijing.achievements.v1';
const reviewKey = 'yijing-review-cards';
const observedFiles = ['web/js/main.js', 'web/js/achievement-storage.js', 'web/js/review-engine.js',
  'web/index.html', 'web/styles/immersive.css', 'scripts/test-reading-save.mjs'];
const hashes = () => Object.fromEntries(observedFiles.map(path => [path,
  createHash('sha256').update(readFileSync(join(root, path))).digest('hex')]));
const report = { startedAt: new Date().toISOString(), command: 'node scripts/test-reading-save.mjs',
  node: process.version, browserPath, head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  sourceHashes: hashes(), scenarios: [], status: 'running',
  limitations: ['Headless Chromium desktop and emulated mobile; not physical mobile, screen-reader or real 200% zoom evidence.',
    'Read-only Debugger breakpoint captures the existing pending event. It does not alter application state or invoke business functions.'] };
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
    window.__saveProbe.inputEvents.push({ selector: ${JSON.stringify(selector)}, trusted: event.isTrusted,
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
  const code = key.length === 1 ? `Key${key.toUpperCase()}` : key;
  const windowsVirtualKeyCode = { a: 65, Enter: 13, Escape: 27 }[key] || 0;
  await client.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key, code, windowsVirtualKeyCode, modifiers,
    ...(key === 'a' && modifiers === 2 ? { commands: ['selectAll'] } : {}) });
  await client.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode, modifiers });
}
async function search(name) {
  await click('#search');
  await pressKey('a', 2);
  await client.send('Input.insertText', { text: name });
  await waitFor(() => client.evaluate(`document.querySelector('#search').value === ${JSON.stringify(name)} &&
    [...document.querySelectorAll('.search-option')].some(el => el.querySelector('strong')?.textContent === ${JSON.stringify(name)})`), `Search did not return ${name}`);
  const index = await client.evaluate(`[...document.querySelectorAll('.search-option')].findIndex(el => el.querySelector('strong')?.textContent === ${JSON.stringify(name)})`);
  await click(`.search-option[data-index="${index}"]`);
  await stage('none');
  assert.equal(await client.evaluate('document.querySelector("[data-focus-name]").textContent'), name);
}
async function stage(expected) {
  await waitFor(() => client.evaluate(`document.body.dataset.readingStage === ${JSON.stringify(expected)}`), `Reading did not reach ${expected}`);
  if (expected !== 'none') {
    await waitFor(() => client.evaluate('Number(getComputedStyle(document.querySelector("#detail-content")).opacity) >= 0.99'), 'Reading content is not visible');
    assert.equal(await client.evaluate('document.querySelector("#detail-panel").getAttribute("aria-modal")'), String(mobile || expected === 'deep'));
    assert.equal(await client.evaluate('new URL(location.href).searchParams.has("hex")'), expected === 'deep');
  }
}
async function snapshot() {
  return client.evaluate(`(() => {
    const probe = window.__saveProbe;
    const storage = probe.storage;
    const status = document.querySelector('#reading-save-status');
    const feedback = document.querySelector('#reading-save-feedback');
    const retry = document.querySelector('#reading-save-retry');
    return { achievement: JSON.parse(storage.getItem(${JSON.stringify(achievementKey)}) || 'null'),
      cards: JSON.parse(storage.getItem(${JSON.stringify(reviewKey)}) || '{}'), writes: probe.writes,
      getterReads: probe.getterReads, inputs: probe.inputEvents, stage: document.body.dataset.readingStage,
      feedbackHidden: feedback.hidden, feedbackVisible: feedback.checkVisibility(), message: status.textContent,
      statusRole: status.getAttribute('role'), live: status.getAttribute('aria-live'),
      retryHidden: retry.hidden, focus: document.activeElement?.id,
      title: document.querySelector('#hexagram-detail-title')?.textContent,
      bodyVisible: document.querySelector('#detail-content').checkVisibility({ checkOpacity: true }),
      bodyCharacters: document.querySelector('#detail-content').textContent.length };
  })()`);
}
async function capture(name) {
  const result = await client.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  writeFileSync(join(output, `${name}.png`), Buffer.from(result.data, 'base64'));
  current?.screenshots.push(`${name}.png`);
}
function counts(state, success = null) {
  return Object.fromEntries([achievementKey, reviewKey].map(key => [key,
    state.writes.filter(write => write.key === key && (success === null || write.saved === success)).length]));
}
function assertPreserved(before, after) {
  for (const [code, card] of Object.entries(before.cards)) assert.deepEqual(after.cards[code], card, `Existing card ${code} changed`);
  for (const key of before.achievement?.processedKeys || []) assert.ok(after.achievement?.processedKeys.includes(key), `Lost event ${key}`);
  for (const code of before.achievement?.metrics.hexagramsRead || []) assert.ok(after.achievement?.metrics.hexagramsRead.includes(code), `Lost reading ${code}`);
  for (const [key, value] of Object.entries(before.achievement?.achievements || {})) assert.deepEqual(after.achievement?.achievements[key], value);
}
function assertSaved(state, code) {
  assert.equal(state.achievement.processedKeys.filter(key => key === `hexagram:read:${code}`).length, 1);
  assert.equal(state.achievement.metrics.hexagramsRead.filter(value => value === code).length, 1);
  assert.equal(Object.values(state.cards).filter(card => card.code === code).length, 1);
  assert.equal(state.cards[code].reps, 0);
}
async function enterQuick(name, before) {
  await search(name);
  const focused = await snapshot();
  assert.deepEqual(counts(focused), counts(before), 'Focus performed a formal-reading write');
  await click('#focus-read');
  await stage('quick');
  const quick = await snapshot();
  assert.deepEqual(counts(quick), counts(before), 'Quick reading performed a formal-reading write');
  assert.equal(quick.feedbackHidden, true);
  current.checks.push({ label: 'focus-and-quick-no-formal-write', focused: counts(focused), quick: counts(quick), modal: mobile });
}
const probe = `(() => {
  const storage = window.localStorage;
  const originalSet = Storage.prototype.setItem;
  const descriptor = Object.getOwnPropertyDescriptor(window, 'localStorage');
  window.__saveProbe = { storage, originalSet, descriptor, blocked: [], writes: [], getterReads: 0, inputEvents: [] };
  Storage.prototype.setItem = function(key, value) {
    const state = window.__saveProbe;
    if (this !== state.storage || ![${JSON.stringify(achievementKey)}, ${JSON.stringify(reviewKey)}].includes(key)) return originalSet.call(this, key, value);
    const saved = !state.blocked.includes(key);
    state.writes.push({ key, saved, payload: JSON.parse(value) });
    if (!saved) throw new DOMException('Reading-save acceptance quota fixture', 'QuotaExceededError');
    return originalSet.call(this, key, value);
  };
})();`;
async function openDocument(url, width, height) {
  mobile = width < 768;
  await client.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile });
  await client.send('Emulation.setTouchEmulationEnabled', { enabled: mobile });
  const oldTime = await client.evaluate('performance.timeOrigin');
  await client.send('Page.navigate', { url });
  await waitFor(() => client.evaluate(`performance.timeOrigin !== ${oldTime} && document.querySelector('#loading')?.hidden === true && Boolean(window.__saveProbe)`), 'Application did not initialize', 30000);
  if (await client.evaluate('!document.querySelector("#daily-overlay").hidden')) await click('[data-entry="explore"]');
  await waitFor(() => client.evaluate('document.querySelector("#daily-overlay").hidden && !document.querySelector("#search").closest("[inert]")'), 'Explore entry did not open');
}

try {
  const [sitePort, debugPort] = await Promise.all([freePort(), freePort()]);
  const siteUrl = `http://127.0.0.1:${sitePort}/`;
  server = spawn(process.execPath, ['scripts/serve.mjs'], { cwd: root, env: { ...process.env, PORT: String(sitePort) }, stdio: 'ignore' });
  await waitFor(async () => { try { return (await fetch(siteUrl)).ok; } catch { return false; } }, 'Local server did not start');
  browser = spawn(browserPath, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--no-sandbox',
    `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
  let target;
  await waitFor(async () => {
    try { target = (await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json()).find(item => item.type === 'page'); return target; }
    catch { return false; }
  }, 'Browser debugging target did not start', 30000);
  client = new Client(target.webSocketDebuggerUrl);
  await client.open();
  await client.send('Runtime.enable');
  await client.send('Log.enable');
  await client.send('Page.enable');
  report.browser = await client.send('Browser.getVersion');
  await client.send('Page.addScriptToEvaluateOnNewDocument', { source: probe });
  await client.send('Debugger.enable');
  const mainLines = readFileSync(join(root, 'web/js/main.js'), 'utf8').split(/\r?\n/);
  const functionLine = mainLines.findIndex(line => line === 'function persistReadingSave(code) {');
  assert.ok(functionLine >= 0, 'Pending reading save function not found');
  await client.send('Debugger.setBreakpointByUrl', { urlRegex: '/js/main\\.js(?:\\?.*)?$', lineNumber: functionLine + 1 });
  client.onPaused = async params => {
    try {
      const result = await client.send('Debugger.evaluateOnCallFrame', {
        callFrameId: params.callFrames[0].callFrameId, returnByValue: true,
        expression: '({ code, event: state.readingSaves.get(code)?.event })',
      });
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
      current?.pendingEvents.push(result.result.value);
    } catch (error) { observerFailure = error.message; }
    finally { await client.send('Debugger.resume'); }
  };

  // Establish old records through the UI, not a fabricated achievement snapshot.
  current = { name: 'baseline-real-deep-read', inputs: [], checks: [], screenshots: [], pendingEvents: [] };
  await openDocument(siteUrl, 1440, 1024);
  await enterQuick('乾', await snapshot());
  await click('#reading-deepen');
  await stage('deep');
  const baseline = await snapshot();
  assertSaved(baseline, '111111');
  report.baseline = baseline;
  await click('#reading-back');
  await stage('none');

  const fixtures = JSON.parse(readFileSync(join(root, 'web/data/hexagrams.json'), 'utf8')).filter(hex => hex.binaryCode !== '111111');
  let fixtureIndex = 0;
  for (const viewport of [{ width: 1440, height: 1024 }, { width: 390, height: 844 }]) {
    for (const mode of ['achievement-only', 'review-only', 'both', 'getter-denied']) {
      const hex = fixtures[fixtureIndex++];
      current = { name: `${viewport.width}-${mode}`, mode, viewport, code: hex.binaryCode, hexagram: hex.name,
        inputs: [], checks: [], screenshots: [], pendingEvents: [], status: 'running' };
      report.scenarios.push(current);
      await openDocument(`${siteUrl}?save-probe=${current.name}`, viewport.width, viewport.height);
      const before = await snapshot();
      assert.equal(before.cards[hex.binaryCode], undefined);
      const blocked = mode === 'both' ? [achievementKey, reviewKey]
        : mode === 'achievement-only' ? [achievementKey] : mode === 'review-only' ? [reviewKey] : [];
      await client.evaluate(`window.__saveProbe.blocked = ${JSON.stringify(blocked)}`);
      if (mode === 'getter-denied') {
        await client.evaluate(`void Object.defineProperty(window, 'localStorage', { configurable: true, get() {
          window.__saveProbe.getterReads += 1;
          throw new DOMException('Reading-save acceptance getter fixture', 'SecurityError');
        } })`);
      }
      await enterQuick(hex.name, before);
      await click('#reading-deepen');
      await stage('deep');
      const failed = await snapshot();
      const expectedMissing = mode === 'achievement-only' ? '阅读记录未保存' : mode === 'review-only' ? '复习卡未保存' : '阅读记录与复习卡未保存';
      assert.ok(failed.message.startsWith(expectedMissing), `Incorrect failure message: ${failed.message}`);
      assert.equal(failed.feedbackHidden, false);
      assert.equal(failed.feedbackVisible, true);
      assert.equal(failed.retryHidden, false);
      assert.equal(failed.statusRole, 'status');
      assert.equal(failed.live, 'polite');
      assert.equal(failed.bodyVisible, true);
      assert.ok(failed.bodyCharacters > 500, 'Failed persistence removed the reading body');
      assertPreserved(before, failed);
      current.checks.push({ label: 'deep-failure-readable-and-specific', state: failed });
      await capture(`${current.name}-failure-visible`);

      // A failed retry must leave its already-saved half untouched.
      await click('#reading-save-retry');
      const stillFailed = await snapshot();
      assert.equal(stillFailed.message, failed.message);
      for (const key of [achievementKey, reviewKey]) {
        const expectedIncrease = blocked.includes(key) ? 1 : 0;
        assert.equal(counts(stillFailed)[key], counts(failed)[key] + expectedIncrease, `Retry rewrote successful half ${key}`);
        assert.equal(counts(stillFailed, true)[key], counts(failed, true)[key]);
      }
      current.checks.push({ label: 'failed-retry-only-unsaved-half', counts: counts(stillFailed), savedCounts: counts(stillFailed, true) });

      if (mode === 'getter-denied') {
        assert.ok(stillFailed.getterReads > 0);
        await click('#reading-back');
        await stage('none');
        await click('#focus-read');
        await stage('quick');
        const closed = await snapshot();
        assert.equal(closed.feedbackHidden, true);
        assert.deepEqual(counts(closed), counts(stillFailed));
        await client.evaluate(`void Object.defineProperty(window, 'localStorage', window.__saveProbe.descriptor)`);
        await click('#reading-deepen');
        await stage('deep');
      } else {
        // Close while quota is still denied, then re-enter the same pending read.
        await click('#reading-back');
        await stage('none');
        await click('#focus-read');
        await stage('quick');
        const pendingQuick = await snapshot();
        assert.equal(pendingQuick.feedbackHidden, true);
        assert.deepEqual(counts(pendingQuick), counts(stillFailed), 'Pending quick read retried a formal save');
        await click('#reading-deepen');
        await stage('deep');
        const pendingDeep = await snapshot();
        assert.equal(pendingDeep.message, failed.message);
        assert.equal(pendingDeep.feedbackHidden, false);
        assert.equal(pendingDeep.retryHidden, false);
        assert.equal(pendingDeep.bodyVisible, true);
        for (const key of [achievementKey, reviewKey]) {
          assert.equal(counts(pendingDeep)[key], counts(stillFailed)[key] + (blocked.includes(key) ? 1 : 0),
            `Pending re-entry rewrote successful half ${key}`);
          assert.equal(counts(pendingDeep, true)[key], counts(stillFailed, true)[key]);
        }
        assertPreserved(before, pendingDeep);
        current.checks.push({ label: 'quota-still-denied-close-quick-deep-preserves-successful-half', state: pendingDeep });
        await capture(`${current.name}-pending-reentry`);
        await client.evaluate('window.__saveProbe.blocked = []');
        await click('#reading-save-retry');
      }
      const recovered = await snapshot();
      assert.equal(recovered.message, '阅读记录与复习卡已保存。');
      assert.equal(recovered.retryHidden, true);
      if (mode !== 'getter-denied') assert.equal(recovered.focus, 'reading-save-status', 'Focus was not restored when retry disappeared');
      assertSaved(recovered, hex.binaryCode);
      assertPreserved(before, recovered);
      for (const key of [achievementKey, reviewKey]) assert.equal(counts(recovered, true)[key], 1, `Expected exactly one successful write to ${key}`);
      assert.ok(current.pendingEvents.length >= 3);
      const firstEvent = current.pendingEvents[0];
      for (const event of current.pendingEvents) assert.deepEqual(event, firstEvent, 'Retry/re-entry replaced the original pending event');
      current.checks.push({ label: 'recovered-single-event-and-card-old-records-intact', state: recovered });
      await capture(`${current.name}-recovered`);

      // Normal close/re-entry does not add another event/card or rewrite earlier records.
      await click('#reading-back');
      await stage('none');
      await click('#focus-read');
      await stage('quick');
      await click('#reading-deepen');
      await stage('deep');
      const reentered = await snapshot();
      assertSaved(reentered, hex.binaryCode);
      assert.deepEqual(counts(reentered), counts(recovered));
      assert.deepEqual(reentered.cards, recovered.cards);
      assert.deepEqual(reentered.achievement, recovered.achievement);
      assert.equal(reentered.feedbackHidden, true);
      assert.equal(reentered.inputs.length, current.inputs.length, 'A business input did not deliver a click event');
      assert.ok(reentered.inputs.every(input => input.trusted), 'Untrusted business input');
      assert.ok(reentered.inputs.every(input => input.pointerType === (mobile ? 'touch' : 'mouse')));
      current.checks.push({ label: 'normal-reentry-idempotent-and-trusted-input', counts: counts(reentered), inputs: reentered.inputs });
      assert.equal(observerFailure, undefined);
      current.status = 'passed';
      saveTrace(); // Preserve completed scenarios even if the host runtime aborts natively.
      console.log(`PASS ${current.name}`);
    }
  }
  report.status = 'passed';
} catch (error) {
  report.status = 'failed';
  report.failure = { message: error.message, stack: error.stack };
  if (current) {
    current.status = 'failed';
    try { current.failureState = await snapshot(); await capture(`${current.name}-failure`); } catch {}
  }
  console.error(error.stack);
  process.exitCode = 1;
} finally {
  report.finishedAt = new Date().toISOString();
  report.finalSourceHashes = hashes();
  report.sourceStableDuringRun = JSON.stringify(report.sourceHashes) === JSON.stringify(report.finalSourceHashes);
  report.pageErrors = client?.events.filter(event => event.method === 'Runtime.exceptionThrown') || [];
  report.browserLogs = client?.events.filter(event => event.method === 'Log.entryAdded').map(event => event.params.entry) || [];
  if (report.status === 'passed' && (report.pageErrors.length || !report.sourceStableDuringRun)) {
    report.status = 'failed';
    report.failure = { message: report.pageErrors.length ? 'Uncaught page errors were observed' : 'Source changed during run; rerun with stable sources' };
    process.exitCode = 1;
  }
  client?.socket.close();
  await stopProcess(browser);
  await stopProcess(server);
  if (dirname(profile) === temporaryRoot && basename(profile).startsWith('yijing-reading-save-')) {
    try { rmSync(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }); report.profileRemoved = !existsSync(profile); }
    catch (error) { report.profileRemoved = false; report.cleanupError = error.code; }
  }
  saveTrace();
  console.log(JSON.stringify({ status: report.status, browser: report.browser?.product,
    passed: report.scenarios.filter(item => item.status === 'passed').length, total: report.scenarios.length,
    trace: join(output, 'trace.json'), profileRemoved: report.profileRemoved }));
}
