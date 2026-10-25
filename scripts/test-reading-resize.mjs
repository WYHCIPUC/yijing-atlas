import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Diagnostic only: observe the resize delivery boundary without calling application methods.
const root = fileURLToPath(new URL('../', import.meta.url));
const browserPath = [process.env.BROWSER_PATH,
  process.env['ProgramFiles(x86)'] && join(process.env['ProgramFiles(x86)'], 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
  process.env.ProgramFiles && join(process.env.ProgramFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
  '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean).find(existsSync);
assert.ok(browserPath, 'Set BROWSER_PATH to an installed Chromium executable.');
const rounds = Number(process.env.YIJING_RESIZE_ROUNDS || 8);
assert.ok(Number.isInteger(rounds) && rounds >= 1 && rounds <= 100);
const runStamp = new Date().toISOString().replace(/[:.]/g, '-');
const output = resolve(process.env.YIJING_RESIZE_EVIDENCE_DIR || join(root, 'docs/development/evidence/2026-10-25-reading-resize', runStamp));
mkdirSync(output, { recursive: true });
const temporaryRoot = realpathSync(tmpdir());
const profile = mkdtempSync(join(temporaryRoot, 'yijing-reading-resize-'));
const observedFiles = ['web/js/main.js', 'web/styles/immersive.css', 'scripts/browser-smoke.mjs', 'scripts/test-reading-resize.mjs'];
const hashes = () => Object.fromEntries(observedFiles.map(path => [path, createHash('sha256').update(readFileSync(join(root, path))).digest('hex')]));
const report = { startedAt: new Date().toISOString(), command: 'node scripts/test-reading-resize.mjs',
  head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  node: process.version, platform: process.platform, browserPath, rounds, sourceHashes: hashes(),
  motion: 'prefers-reduced-motion: no-preference; no CSS/animation overrides',
  observation: 'Read-only DOM and media-query snapshots, resize/change listeners, MutationObserver. All quick-read and tools actions use trusted CDP Input. No application methods or DOM click().',
  scenarios: [], status: 'running' };
const pause = ms => new Promise(resolvePause => setTimeout(resolvePause, ms));
async function waitFor(check, message, timeout = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeout) { const value = await check(); if (value) return value; await pause(20); }
  throw new Error(message);
}
function freePort() {
  return new Promise((resolvePort, reject) => {
    const server = createServer(); server.once('error', reject);
    server.listen(0, '127.0.0.1', () => { const { port } = server.address(); server.close(() => resolvePort(port)); });
  });
}
async function stop(child) {
  if (!child || child.exitCode !== null) return;
  child.kill(); await Promise.race([once(child, 'exit'), pause(3000)]);
}
class Client {
  constructor(url) {
    this.socket = new WebSocket(url); this.nextId = 1; this.pending = new Map(); this.events = [];
    this.socket.addEventListener('message', ({ data }) => {
      const message = JSON.parse(data);
      if (!message.id) { this.events.push(message); return; }
      const pending = this.pending.get(message.id); this.pending.delete(message.id);
      if (!pending) return;
      clearTimeout(pending.timeout);
      if (message.error) pending.reject(new Error(message.error.message)); else pending.resolve(message.result);
    });
    this.socket.addEventListener('close', () => {
      for (const pending of this.pending.values()) { clearTimeout(pending.timeout); pending.reject(new Error('Diagnostic browser disconnected.')); }
      this.pending.clear();
    });
  }
  async open() { await new Promise((resolveOpen, reject) => { this.socket.addEventListener('open', resolveOpen, { once: true }); this.socket.addEventListener('error', reject, { once: true }); }); }
  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolveSend, reject) => {
      const timeout = setTimeout(() => { this.pending.delete(id); reject(new Error(`CDP request timed out after 30 seconds: ${method}`)); }, 30000);
      this.pending.set(id, { resolve: resolveSend, reject, timeout });
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
  window.__resizeTrace = [];
  const compact = matchMedia('(max-width: 900px)');
  const narrow = matchMedia('(max-width: 1100px)');
  window.__resizeSample = (type, detail = null) => {
    const panel = document.querySelector('#detail-panel');
    const options = document.querySelector('#relation-options');
    const item = { type, at: performance.now(), detail, visibility: document.visibilityState,
      width: innerWidth, height: innerHeight, clientWidth: document.documentElement?.clientWidth,
      visualWidth: visualViewport?.width, compact: compact.matches, narrow: narrow.matches,
      reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
      stage: document.body?.dataset.readingStage, modal: panel?.getAttribute('aria-modal'),
      panelOpen: panel?.classList.contains('open'), panelInert: panel?.inert,
      readingBackInert: Boolean(document.querySelector('#reading-back')?.closest('[inert]')),
      toolsExpanded: document.querySelector('#relation-toggle')?.getAttribute('aria-expanded'),
      toolsHidden: options?.hidden, toolsInert: options?.inert,
      toolsModal: document.querySelector('#relation-layers')?.getAttribute('aria-modal'),
      canvasInert: Boolean(document.querySelector('#star-canvas')?.closest('[inert]')) };
    window.__resizeTrace.push(item); return item;
  };
  for (const [name, query] of [['compact', compact], ['narrow', narrow]]) {
    query.addEventListener('change', event => window.__resizeSample('media-change', { name, matches: event.matches }));
  }
  window.addEventListener('resize', () => window.__resizeSample('resize'));
  document.addEventListener('visibilitychange', () => window.__resizeSample('visibility-change'));
  const mutations = new MutationObserver(records => {
    const relevant = records.filter(record => record.target.id === 'detail-panel' || record.target.id === 'relation-toggle'
      || record.target.id === 'relation-options' || record.target.parentElement === document.body);
    if (relevant.length) window.__resizeSample('mutation', relevant.map(record => ({ target: record.target.id || record.target.tagName,
      attribute: record.attributeName, old: record.oldValue, value: record.target.getAttribute(record.attributeName) })));
  });
  mutations.observe(document, { subtree: true, attributes: true, attributeOldValue: true,
    attributeFilter: ['aria-modal', 'aria-expanded', 'hidden', 'inert', 'data-reading-stage'] });
  document.addEventListener('click', event => {
    if (['reading-quicken', 'relation-toggle'].includes(event.target.closest('button')?.id))
      window.__resizeSample('trusted-input', { target: event.target.closest('button').id, trusted: event.isTrusted });
  }, true);
})();`;
const [sitePort, debugPort] = await Promise.all([freePort(), freePort()]);
const siteUrl = `http://127.0.0.1:${sitePort}/`;
const server = spawn(process.execPath, ['scripts/serve.mjs'], { cwd: root, env: { ...process.env, PORT: String(sitePort) }, stdio: 'ignore', windowsHide: true });
let browser; let client;
async function mouseClick(selector) {
  const point = await waitFor(() => client.evaluate(`(async () => {
    const element = document.querySelector(${JSON.stringify(selector)});
    if (!element || element.hidden || element.disabled || element.closest('[inert]')) return null;
    const before = element.getBoundingClientRect();
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const rect = element.getBoundingClientRect();
    if (['x', 'y', 'width', 'height'].some(key => Math.abs(before[key] - rect[key]) > 0.5)) return null;
    const x = rect.left + rect.width / 2, y = rect.top + rect.height / 2;
    return rect.width && rect.height && element.contains(document.elementFromPoint(x, y)) ? { x, y } : null;
  })()`), `Unclickable ${selector}`);
  await client.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point });
  await client.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', buttons: 1, clickCount: 1 });
  await client.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', buttons: 0, clickCount: 1 });
}
async function keyPress(key, { shift = false } = {}) {
  const code = key === 'Tab' ? 9 : 13;
  await client.send('Input.dispatchKeyEvent', { type: key === 'Enter' ? 'keyDown' : 'rawKeyDown', key, code: key, modifiers: shift ? 8 : 0, windowsVirtualKeyCode: code,
    ...(key === 'Enter' ? { text: '\r', unmodifiedText: '\r' } : {}) });
  await client.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code: key, modifiers: shift ? 8 : 0, windowsVirtualKeyCode: code });
}
async function openToolsByKeyboard() {
  const visited = [];
  for (let step = 0; step < 100; step += 1) {
    const target = await client.evaluate('document.activeElement?.id || document.activeElement?.tagName');
    visited.push(target);
    if (target === 'relation-toggle') break;
    await keyPress('Tab', { shift: true });
  }
  assert.equal(await client.evaluate('document.activeElement.id'), 'relation-toggle', `Keyboard did not reach the tools button: ${visited.join(', ')}`);
  await keyPress('Enter');
  return visited;
}
async function capture(name) {
  const { data } = await client.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  writeFileSync(join(output, `${name}.png`), Buffer.from(data, 'base64'));
  return `${name}.png`;
}
async function resize(width, rate, round) {
  const index = await client.evaluate('window.__resizeTrace.length');
  const before = await client.evaluate('window.__resizeSample("before-metrics")');
  report.pendingResize = { width, rate, round, before };
  writeFileSync(join(output, 'checkpoint.json'), `${JSON.stringify(report, null, 2)}\n`);
  const commandStart = performance.now();
  await client.send('Emulation.setDeviceMetricsOverride', { width, height: 1024, deviceScaleFactor: 1, mobile: width <= 900 });
  const commandEnd = performance.now();
  const immediate = await client.evaluate('window.__resizeSample("immediate-after-metrics")');
  const frames = await client.evaluate(`new Promise((resolve, reject) => {
    if (document.visibilityState !== 'visible') { reject(new Error('Diagnostic page became hidden; do not treat suppressed RAF as an application failure.')); return; }
    const timeout = setTimeout(() => reject(new Error('No two rendering frames within 15 seconds; visibility=' + document.visibilityState)), 15000);
    requestAnimationFrame(() => {
    const first = window.__resizeSample('next-frame');
    requestAnimationFrame(() => { clearTimeout(timeout); resolve([first, window.__resizeSample('second-frame')]); });
  }); })`);
  const events = await client.evaluate(`window.__resizeTrace.slice(${index})`);
  const expectedModal = width <= 900;
  const expected = state => state.width === width && state.compact === expectedModal && state.modal === String(expectedModal)
    && state.stage === 'quick' && !state.panelInert && !state.readingBackInert && state.canvasInert === expectedModal
    && (!expectedModal || state.toolsHidden === true);
  const scenario = { rate, round, width, commandMs: commandEnd - commandStart, before, immediate, frames, events,
    immediateConsistent: expected(immediate), frameConsistent: frames.map(expected), stableConsistent: expected(frames[1]) };
  report.scenarios.push(scenario);
  delete report.pendingResize;
  writeFileSync(join(output, 'checkpoint.json'), `${JSON.stringify(report, null, 2)}\n`);
  assert.ok(scenario.stableConsistent, `Reading modality still inconsistent after two rendering frames: ${JSON.stringify(scenario)}`);
  return scenario;
}
try {
  await waitFor(async () => { try { return (await fetch(siteUrl)).ok; } catch { return false; } }, 'Static server did not start.');
  browser = spawn(browserPath, ['--headless=new', '--disable-gpu', '--disable-extensions', '--no-first-run', '--no-default-browser-check', '--no-sandbox',
    '--window-size=1440,1024', `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore', windowsHide: true });
  const target = await waitFor(async () => { try { return (await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json()).find(item => item.type === 'page'); } catch { return false; } }, 'Chromium did not start.');
  client = new Client(target.webSocketDebuggerUrl); await client.open();
  for (const domain of ['Runtime', 'Page', 'Log']) await client.send(`${domain}.enable`);
  report.browser = await client.send('Browser.getVersion');
  await client.send('Page.addScriptToEvaluateOnNewDocument', { source: observer });
  await client.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1024, deviceScaleFactor: 1, mobile: false });
  await client.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
  await client.send('Page.navigate', { url: `${siteUrl}?hex=111111` });
  await waitFor(() => client.evaluate('document.querySelector("#loading")?.hidden && document.body.dataset.readingStage === "deep"'), 'Deep-link initialization did not finish.');
  await mouseClick('#reading-quicken');
  await waitFor(() => client.evaluate('document.body.dataset.readingStage === "quick" && document.querySelector("#detail-panel").getAttribute("aria-modal") === "false"'), 'Real quick-read button did not open nonmodal reading.');
  report.initial = await client.evaluate('window.__resizeSample("initial-quick")');
  report.quickTools = await client.evaluate(`(() => {
    const button = document.querySelector('#relation-toggle'), layers = button.closest('.relation-layers');
    const rect = button.getBoundingClientRect(), hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return { opacity: getComputedStyle(layers).opacity, pointerEvents: getComputedStyle(layers).pointerEvents,
      tabIndex: button.tabIndex, hitTarget: hit?.id || hit?.tagName, mouseReachable: button.contains(hit) };
  })()`);
  report.toolsInput = 'Quick-read CSS makes tools mouse-inaccessible. Trusted Shift+Tab and Enter are used to test whether the same hidden control remains keyboard-reachable; no focus() or DOM click() is called.';
  report.screenshots = [await capture('initial-desktop-quick')];
  for (const rate of [1, 4]) {
    await client.send('Emulation.setCPUThrottlingRate', { rate });
    for (let round = 1; round <= rounds; round += 1) {
      const keyboardPath = await openToolsByKeyboard();
      await waitFor(() => client.evaluate('document.querySelector("#relation-toggle").getAttribute("aria-expanded") === "true"'), 'Real tools button did not expand desktop tools.');
      const narrow = await resize(768, rate, round);
      narrow.toolsKeyboardPath = keyboardPath;
      if (round === 1 || (!narrow.immediateConsistent && !report.screenshots.some(name => name.includes(`rate-${rate}-race`)))) {
        report.screenshots.push(await capture(`rate-${rate}-${narrow.immediateConsistent ? 'stable' : 'race-observed-then-stable'}-tablet-round-${round}`));
      }
      await resize(1440, rate, round);
    }
    console.log(`Completed ${rounds} bidirectional rounds at CPU rate ${rate}.`);
  }
  report.inputs = await client.evaluate('window.__resizeTrace.filter(item => item.type === "trusted-input")');
  assert.ok(report.inputs.length >= 1 + 2 * rounds && report.inputs.every(item => item.detail.trusted), 'Expected trusted quick/tools clicks were not observed.');
  report.status = 'passed';
} catch (error) {
  report.status = 'failed'; report.failure = { message: error.message, stack: error.stack }; process.exitCode = 1;
  try { report.failureTrace = await client.evaluate('window.__resizeTrace'); report.failureScreenshot = await capture('failure'); } catch {}
  console.error(error.stack);
} finally {
  report.finishedAt = new Date().toISOString(); report.finalSourceHashes = hashes();
  report.sourceStableDuringRun = JSON.stringify(report.sourceHashes) === JSON.stringify(report.finalSourceHashes);
  report.pageErrors = client?.events.filter(({ method }) => method === 'Runtime.exceptionThrown' || method === 'Log.entryAdded') || [];
  report.summary = [1, 4].map(rate => { const items = report.scenarios.filter(item => item.rate === rate); return { rate, total: items.length,
    immediateMismatch: items.filter(item => !item.immediateConsistent).length,
    firstFrameMismatch: items.filter(item => !item.frameConsistent[0]).length,
    stableMismatch: items.filter(item => !item.stableConsistent).length }; });
  try { if (client) await client.send('Browser.close'); } catch {}
  client?.socket.close(); await stop(browser); await stop(server);
  if (dirname(profile) === temporaryRoot && basename(profile).startsWith('yijing-reading-resize-')) {
    try { rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 250 }); report.profileRemoved = !existsSync(profile); }
    catch (error) { report.profileRemoved = false; report.cleanupError = error.code; }
  }
  writeFileSync(join(output, 'trace.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ status: report.status, browser: report.browser?.product, summary: report.summary,
    trace: join(output, 'trace.json'), sourceStableDuringRun: report.sourceStableDuringRun, profileRemoved: report.profileRemoved }));
}
