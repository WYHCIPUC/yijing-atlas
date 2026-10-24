import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Narrow, real-Input acceptance probe; no application methods are called by the driver.
const root = fileURLToPath(new URL('../', import.meta.url));
const candidates = [process.env.BROWSER_PATH,
  process.env['ProgramFiles(x86)'] && join(process.env['ProgramFiles(x86)'], 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
  process.env.ProgramFiles && join(process.env.ProgramFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
  '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean);
const browserPath = candidates.find(existsSync);
assert.ok(browserPath, 'Set BROWSER_PATH to an installed Chromium executable.');
const runStamp = new Date().toISOString().replace(/[:.]/g, '-');
const output = resolve(process.env.YIJING_ENTRY_EVIDENCE_DIR || join(root, 'docs/development/evidence/2026-10-25-entry-input', runStamp));
mkdirSync(output, { recursive: true });
const temporaryRoot = realpathSync(tmpdir());
const profile = mkdtempSync(join(temporaryRoot, 'yijing-entry-input-'));
const report = { startedAt: new Date().toISOString(), node: process.version, browserPath, output,
  command: 'node scripts/test-entry-input.mjs', scenarios: [], status: 'running' };
const observedFiles = ['web/js/star-map.js', 'web/js/main.js', 'scripts/test-entry-input.mjs'];
const sourceHashes = () => Object.fromEntries(observedFiles.map(path => [path,
  createHash('sha256').update(readFileSync(join(root, path))).digest('hex')]));
report.head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
report.sourceHashes = sourceHashes();
const pause = milliseconds => new Promise(resolvePause => setTimeout(resolvePause, milliseconds));

async function waitFor(check, message, timeout = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const value = await check();
    if (value) return value;
    await pause(20); // Poll observable conditions, never wait out an animation to make input pass.
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
    this.pausedHandler = null;
    this.socket.addEventListener('message', ({ data }) => {
      const message = JSON.parse(data);
      if (!message.id) {
        this.events.push(message);
        if (message.method === 'Debugger.paused') this.pausedHandler?.(message.params);
        return;
      }
      const pending = this.pending.get(message.id);
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message));
      else pending.resolve(message.result);
    });
  }

  async open() {
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

const observer = `(() => {
  sessionStorage.removeItem('yijing:star-entrance');
  sessionStorage.removeItem('yijing-daily-seen');
  window.__entryEvents = [];
  window.__entryFrames = 0;
  window.__entryArcs = [];
  window.__entrySnapshot = () => {
    const map = window.__entryObservedMap;
    if (!map) return null;
    return { at: performance.now(), frame: window.__entryFrames, appearProgress: map.appearProgress,
      reducedMotion: map.reducedMotion, autoRotate: map.autoRotate, activeCode: map.activeNode?.id || null,
      cameraPos: { ...map.cameraPos }, cameraTarget: map.cameraTarget ? { ...map.cameraTarget } : null,
      cameraTransition: map.cameraTransition ? { from: { ...map.cameraTransition.from }, elapsed: map.cameraTransition.elapsed } : null,
      yaw: map.yaw, pitch: map.pitch, isDragging: map.isDragging,
      dragStart: map.dragStart ? { pointerId: map.dragStart.pointerId, code: map.dragStart.node?.id || null,
        x: map.dragStart.x, y: map.dragStart.y, moved: map.dragStart.moved } : null,
      readingStage: document.body.dataset.readingStage,
      summaryHidden: document.querySelector('#star-focus-summary')?.hidden,
      summaryName: document.querySelector('[data-focus-name]')?.textContent,
      detailHidden: document.querySelector('#detail-panel')?.getAttribute('aria-hidden') };
  };
  const clear = CanvasRenderingContext2D.prototype.clearRect;
  CanvasRenderingContext2D.prototype.clearRect = function(...args) {
    if (this.canvas.id === 'star-canvas') { window.__entryFrames += 1; window.__entryArcs = []; }
    return clear.apply(this, args);
  };
  const arc = CanvasRenderingContext2D.prototype.arc;
  CanvasRenderingContext2D.prototype.arc = function(x, y, radius, ...args) {
    if (this.canvas.id === 'star-canvas' && radius >= 1.2 && radius <= 8) window.__entryArcs.push({ x, y, radius });
    return arc.call(this, x, y, radius, ...args);
  };
  for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'lostpointercapture', 'click']) {
    for (const capture of [true, false]) document.addEventListener(type, event => {
      if (event.target.id !== 'star-canvas' && !event.target.closest?.('[data-entry]')) return;
      window.__entryEvents.push({ type, phase: capture ? 'before' : 'after', trusted: event.isTrusted,
        pointerType: event.pointerType, pointerId: event.pointerId, x: event.clientX, y: event.clientY,
        target: event.target.id || event.target.dataset.entry, state: window.__entrySnapshot() });
    }, capture);
  }
})();`;

const [sitePort, debugPort] = await Promise.all([freePort(), freePort()]);
const siteUrl = `http://127.0.0.1:${sitePort}/`;
const server = spawn(process.execPath, ['scripts/serve.mjs'], {
  cwd: root, env: { ...process.env, PORT: String(sitePort) }, stdio: 'ignore', windowsHide: true,
});
let browser;
let client;
let current;
let observerError;

async function snapshot() { return client.evaluate('window.__entrySnapshot()'); }

async function screenshot(name) {
  const frame = (await snapshot()).frame;
  await waitFor(() => client.evaluate(`window.__entryFrames > ${frame}`), 'No completed frame for the evidence screenshot.');
  const { data } = await client.send('Page.captureScreenshot', { format: 'png' });
  const path = join(output, `${name}.png`);
  writeFileSync(path, Buffer.from(data, 'base64'));
  current.screenshots.push(path);
}

async function mouse(type, point) {
  await client.send('Input.dispatchMouseEvent', { type, x: point.x, y: point.y, button: 'left',
    buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1 });
}

async function touch(type, point) {
  await client.send('Input.dispatchTouchEvent', { type,
    touchPoints: point ? [{ x: point.x, y: point.y, id: 1 }] : [] });
}

async function starPoint({ exclude = null, entry = false } = {}) {
  return waitFor(() => client.evaluate(`(() => {
    const map = window.__entryObservedMap, canvas = document.querySelector('#star-canvas');
    if (!map || !canvas || map.isPaused || canvas.closest('[inert]')) return null;
    if (${entry} && !(map.appearProgress > 0 && map.appearProgress < 1)) return null;
    const rect = canvas.getBoundingClientRect();
    const nodes = map.graph.nodes.filter(node => node.id !== ${JSON.stringify(exclude)} && node._screen
      && (node.layoutVisible || map.focusVisible?.has(node.id)) && (!map.focusVisible || map.focusVisible.has(node.id))
      && window.__entryArcs.some(arc => Math.hypot(arc.x - node._screen.x, arc.y - node._screen.y) < 0.25))
      .sort((a, b) => a.number - b.number);
    for (const node of nodes) {
      const x = Math.round(rect.left + node._screen.x), y = Math.round(rect.top + node._screen.y);
      if (x < 20 || y < 160 || x > innerWidth - 20 || y > innerHeight - 160 || document.elementFromPoint(x, y) !== canvas) continue;
      return { x, y, code: node.id, name: node.name, frame: window.__entryFrames, state: window.__entrySnapshot() };
    }
    return null;
  })()`), 'No unobscured, actually drawn star is available in the required animation state.', entry ? 900 : 1500);
}

async function openScenario(name, reducedMotion, mobile = false) {
  if (current) {
    current.events = await client.evaluate('window.__entryEvents');
    current.final = await snapshot();
    current.status = 'passed';
    console.log(`PASS ${current.name}`);
  }
  current = { name, reducedMotion, viewport: mobile ? '390x844' : '1280x720', checks: [], screenshots: [], status: 'running' };
  report.scenarios.push(current);
  await client.send('Emulation.setDeviceMetricsOverride', {
    width: mobile ? 390 : 1280, height: mobile ? 844 : 720, deviceScaleFactor: 1, mobile,
  });
  await client.send('Emulation.setTouchEmulationEnabled', { enabled: mobile, maxTouchPoints: 1 });
  await client.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: reducedMotion ? 'reduce' : 'no-preference' }] });
  await client.send('Page.navigate', { url: `${siteUrl}?entry-probe=${encodeURIComponent(name)}` });
  await waitFor(async () => {
    if (observerError) throw observerError;
    try { return await client.evaluate(`document.querySelector('#loading')?.hidden === true
      && Boolean(window.__entryObservedMap) && document.querySelector('#daily-overlay')?.hidden === false`); }
    catch (error) { if (error.message.includes('context')) return false; throw error; }
  }, 'Scenario application / welcome initialization did not finish.');
  current.welcome = await snapshot();
  const point = await client.evaluate(`(() => {
    const button = document.querySelector('[data-entry="explore"]');
    const rect = button.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  })()`);
  if (mobile) { await touch('touchStart', point); await touch('touchEnd'); }
  else { await mouse('mousePressed', point); await mouse('mouseReleased', point); }
  await waitFor(() => client.evaluate(`document.querySelector('#daily-overlay')?.hidden === true
    && window.__entryObservedMap.isPaused === false`), 'Real welcome entry did not resume the star map.');
  current.started = await snapshot();
  assert.equal(current.started.reducedMotion, reducedMotion);
  if (reducedMotion) {
    assert.equal(current.started.appearProgress, 1);
    assert.equal(current.started.autoRotate, false);
  } else assert.ok(current.started.appearProgress < 1, 'Input must begin before the 900ms entrance completes.');
}

async function canvasEvents() {
  return client.evaluate('window.__entryEvents.filter(event => event.target === "star-canvas")');
}

function eventSince(events, start, type, phase) {
  const event = events.slice(start).find(item => item.type === type && item.phase === phase);
  assert.ok(event, `Missing ${phase} ${type} event`);
  assert.equal(event.trusted, true);
  return event;
}

async function pick(point, { entry = false, touchInput = false, move = 0 } = {}) {
  current.pendingAction = { action: 'pick', point, entry, touchInput, move };
  const start = (await canvasEvents()).length;
  const before = await snapshot();
  if (touchInput) await touch('touchStart', point);
  else await mouse('mousePressed', point);
  const held = await snapshot();
  assert.equal(held.activeCode, before.activeCode, 'Press alone must not select.');
  assert.equal(held.dragStart?.code, point.code, 'Trusted press must hit the observed drawn star.');
  assert.equal(held.appearProgress, 1);
  if (move) await touch('touchMove', { x: point.x + move, y: point.y });
  if (touchInput) await touch('touchEnd');
  else await mouse('mouseReleased', point);
  const after = await snapshot();
  const events = await canvasEvents();
  const down = eventSince(events, start, 'pointerdown', 'before');
  const up = eventSince(events, start, 'pointerup', 'after');
  assert.equal(down.pointerType, touchInput ? 'touch' : 'mouse');
  if (entry) assert.ok(down.state.appearProgress > 0 && down.state.appearProgress < 1);
  assert.equal(after.activeCode, point.code);
  assert.equal(after.summaryHidden, false);
  assert.equal(after.summaryName, point.name);
  assert.equal(after.detailHidden, 'true', 'Selecting must keep reading closed.');
  assert.equal(up.state.activeCode, point.code);
  const releaseDistance = Math.hypot(up.x - down.x, up.y - down.y);
  assert.ok(releaseDistance <= 6, 'Actual release displacement must remain inside the 6 CSS px selection threshold.');
  if (move) assert.equal(releaseDistance, move);
  if (after.reducedMotion) assert.equal(after.cameraTransition, null);
  else assert.ok(after.cameraTransition && after.cameraTransition.elapsed < 450);
  current.checks.push({ action: touchInput ? `touch-release-${move}px` : 'mouse-release', point, before, held, after, down, up, releaseDistance });
  delete current.pendingAction;
  return { start, down, up, after };
}

async function drag(point, { entry = false, touchInput = false, distance = 30 } = {}) {
  current.pendingAction = { action: 'drag', point, entry, touchInput, distance };
  const start = (await canvasEvents()).length;
  const before = await snapshot();
  if (touchInput) await touch('touchStart', point);
  else await mouse('mousePressed', point);
  const held = await snapshot();
  const to = { x: point.x + distance, y: point.y };
  if (touchInput) await touch('touchMove', to);
  else await mouse('mouseMoved', to);
  const moved = await snapshot();
  if (touchInput) await touch('touchEnd');
  else await mouse('mouseReleased', to);
  const after = await snapshot();
  const events = await canvasEvents();
  const down = eventSince(events, start, 'pointerdown', 'before');
  const move = eventSince(events, start, 'pointermove', 'after');
  eventSince(events, start, 'pointerup', 'after');
  assert.equal(move.pointerType, touchInput ? 'touch' : 'mouse');
  const moveDistance = Math.hypot(move.x - down.x, move.y - down.y);
  assert.ok(moveDistance > 6, 'Actual pointer movement must exceed 6 CSS px.');
  if (entry) assert.ok(down.state.appearProgress > 0 && down.state.appearProgress < 1);
  assert.equal(held.appearProgress, 1);
  assert.equal(held.cameraTransition, null);
  assert.equal(moved.isDragging, true);
  assert.ok(Math.abs(moved.yaw - held.yaw - distance * 0.006) < 0.000001);
  assert.equal(after.activeCode, before.activeCode, 'Drag must not select.');
  assert.equal(after.dragStart, null);
  assert.equal(after.isDragging, false);
  assert.equal(after.cameraTransition, null);
  assert.deepEqual(after.cameraPos, held.cameraPos, 'Cancelled focus animation must not continue behind dragging.');
  current.checks.push({ action: touchInput ? `touch-drag-${distance}px` : 'mouse-drag', point, before, held, moved, after, down, move, moveDistance });
  delete current.pendingAction;
  return { before, after, down };
}

try {
  await waitFor(async () => { try { return (await fetch(siteUrl)).ok; } catch { return false; } }, 'Static server did not start.');
  browser = spawn(browserPath, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--no-sandbox',
    `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore', windowsHide: true });
  const target = await waitFor(async () => {
    try { return (await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json()).find(item => item.type === 'page'); }
    catch { return false; }
  }, 'Chromium did not start.');
  client = new Client(target.webSocketDebuggerUrl);
  await client.open();
  for (const domain of ['Runtime', 'Page', 'Log', 'Debugger']) await client.send(`${domain}.enable`);
  report.browser = await client.send('Browser.getVersion');
  report.observation = 'One debugger stop in the constructor before _startRenderLoop exposes a read-only instance reference; all later actions use trusted CDP Input. Canvas arcs and event snapshots are observed without calling application methods.';
  const source = readFileSync(join(root, 'web/js/star-map.js'), 'utf8').split(/\r?\n/);
  const lineNumber = source.findIndex(line => line.trim() === 'this._startRenderLoop();');
  assert.ok(lineNumber >= 0);
  await client.send('Debugger.setBreakpointByUrl', { lineNumber, urlRegex: '/js/star-map\\.js$' });
  client.pausedHandler = async ({ callFrames }) => {
    try {
      await client.send('Debugger.evaluateOnCallFrame', { callFrameId: callFrames[0].callFrameId,
        expression: 'window.__entryObservedMap = this', returnByValue: false });
    } catch (error) { observerError = error; }
    finally { await client.send('Debugger.resume'); }
  };
  await client.send('Page.addScriptToEvaluateOnNewDocument', { source: observer });

  await openScenario('normal-entry-pick-focus-interrupt', false);
  const first = await pick(await starPoint({ entry: true }), { entry: true });
  await waitFor(async () => { const state = await snapshot(); return state.cameraTransition?.elapsed > 0 && state.cameraTransition.elapsed < 450; }, 'First camera movement was not observed before interruption.', 450);
  const second = await pick(await starPoint({ exclude: first.after.activeCode }));
  assert.ok(second.down.state.cameraTransition?.elapsed > 0 && second.down.state.cameraTransition.elapsed < 450, 'Second selection must interrupt an active 450ms camera movement.');
  assert.deepEqual(second.up.state.cameraTransition.from, second.up.state.cameraPos, 'Replacement focus starts from current camera position.');
  await waitFor(async () => { const state = await snapshot(); return state.cameraTransition?.elapsed > 0 && state.cameraTransition.elapsed < 450; }, 'Replacement focus did not advance before drag.', 450);
  const focusedDrag = await drag(await starPoint());
  assert.ok(focusedDrag.down.state.cameraTransition?.elapsed > 0 && focusedDrag.down.state.cameraTransition.elapsed < 450);
  const frame = focusedDrag.after.frame;
  await waitFor(() => client.evaluate(`window.__entryFrames > ${frame}`), 'No post-drag frame.');
  assert.deepEqual((await snapshot()).cameraPos, focusedDrag.after.cameraPos);
  await screenshot(current.name);

  await openScenario('normal-entry-drag', false);
  await drag(await starPoint({ entry: true }), { entry: true });
  await screenshot(current.name);

  for (const reduced of [false, true]) {
    await openScenario(`${reduced ? 'reduced' : 'normal'}-touch-boundaries`, reduced, true);
    await drag(await starPoint({ entry: !reduced }), { entry: !reduced, touchInput: true, distance: 7 });
    const tap = await pick(await starPoint(), { touchInput: true, move: 6 });
    // Cancellation does not test an animation interruption. Sample its target after the preceding camera settles.
    await waitFor(async () => (await snapshot()).cameraTransition === null, 'Touch cancellation setup camera did not settle.');
    const cancelPoint = await starPoint({ exclude: tap.after.activeCode });
    current.pendingAction = { action: 'touch-cancel', point: cancelPoint };
    const start = (await canvasEvents()).length;
    const before = await snapshot();
    await touch('touchStart', cancelPoint);
    const held = await snapshot();
    assert.equal(held.dragStart?.code, cancelPoint.code);
    assert.equal(held.activeCode, before.activeCode);
    await touch('touchCancel');
    const after = await snapshot();
    const cancelled = eventSince(await canvasEvents(), start, 'pointercancel', 'after');
    assert.equal(cancelled.pointerType, 'touch');
    assert.equal(after.activeCode, before.activeCode);
    assert.equal(after.dragStart, null);
    assert.equal(after.isDragging, false);
    current.checks.push({ action: 'touch-cancel', point: cancelPoint, before, held, after, cancelled });
    delete current.pendingAction;
    await pick(await starPoint({ exclude: after.activeCode }), { touchInput: true });
    await screenshot(current.name);
  }

  await openScenario('reduced-mouse-immediate', true);
  await pick(await starPoint());
  await drag(await starPoint());
  await screenshot(current.name);
  current.events = await client.evaluate('window.__entryEvents');
  current.final = await snapshot();
  current.status = 'passed';
  console.log(`PASS ${current.name}`);
  report.status = 'passed';
} catch (error) {
  report.status = 'failed';
  report.failure = { message: error.message, stack: error.stack };
  if (current) {
    current.status = 'failed';
    try { current.events = await client.evaluate('window.__entryEvents'); current.final = await snapshot(); await screenshot(`${current.name}-failure`); } catch {}
  }
  console.error(error.stack);
  process.exitCode = 1;
} finally {
  report.finishedAt = new Date().toISOString();
  report.finalSourceHashes = sourceHashes();
  report.sourceStableDuringRun = JSON.stringify(report.sourceHashes) === JSON.stringify(report.finalSourceHashes);
  report.pageErrors = client?.events.filter(({ method }) => method === 'Runtime.exceptionThrown' || method === 'Log.entryAdded') || [];
  client?.socket.close();
  await stopProcess(browser);
  await stopProcess(server);
  // Only remove this exact generated absolute profile after verifying its resolved parent and prefix.
  if (dirname(profile) === temporaryRoot && basename(profile).startsWith('yijing-entry-input-')) {
    try { rmSync(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }); report.profileRemoved = !existsSync(profile); }
    catch (error) { report.profileRemoved = false; report.cleanupError = error.code; }
  }
  writeFileSync(join(output, 'trace.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ status: report.status, browser: report.browser?.product,
    passed: report.scenarios.filter(item => item.status === 'passed').length, total: report.scenarios.length,
    trace: join(output, 'trace.json'), profileRemoved: report.profileRemoved }));
}
