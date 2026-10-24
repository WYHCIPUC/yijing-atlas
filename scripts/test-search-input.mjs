import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { USER_DATA_KEYS } from '../web/js/user-data.js';

// Isolated real-Input search acceptance. Application functions are never invoked by the driver.
const root = fileURLToPath(new URL('../', import.meta.url));
const candidates = [process.env.BROWSER_PATH,
  process.env['ProgramFiles(x86)'] && join(process.env['ProgramFiles(x86)'], 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
  process.env.ProgramFiles && join(process.env.ProgramFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
  '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean);
const browserPath = candidates.find(existsSync);
assert.ok(browserPath, 'Set BROWSER_PATH to an installed Chromium executable.');
const runStamp = new Date().toISOString().replace(/[:.]/g, '-');
const searchScope = process.env.YIJING_SEARCH_SCOPE || '';
const preUiTrigrams = searchScope === 'pre-ui-trigrams';
const output = resolve(process.env.YIJING_SEARCH_EVIDENCE_DIR || join(root, 'docs/development/evidence/2026-10-25-search-input', runStamp));
mkdirSync(output, { recursive: true });
const temporaryRoot = realpathSync(tmpdir());
const profile = mkdtempSync(join(temporaryRoot, 'yijing-search-input-'));
const observedFiles = ['web/js/data-loader.js', 'web/js/search-controller.js', 'web/js/main.js',
  'web/js/star-map.js', 'web/js/user-data.js', 'web/index.html', 'web/styles/immersive.css', 'scripts/test-search-input.mjs'];
const hashes = () => Object.fromEntries(observedFiles.map(path => [path,
  createHash('sha256').update(readFileSync(join(root, path))).digest('hex')]));
const report = { startedAt: new Date().toISOString(), command: 'node scripts/test-search-input.mjs',
  node: process.version, execPath: process.execPath, uv: process.versions.uv, browserPath,
  head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  sourceHashes: hashes(), scenarios: [], status: 'running',
  limitations: ['Headless desktop and CDP mobile emulation are not physical-device, screen-reader or real 200% zoom evidence.',
    'ASCII search uses trusted key events; Chinese text is committed through CDP Input.insertText, not a real operating-system IME.',
    'One constructor debugger stop exposes a read-only StarMap reference; no business method is called.'] };
if (searchScope) report.command = `YIJING_SEARCH_SCOPE=${searchScope} node scripts/test-search-input.mjs`;
const saveTrace = () => writeFileSync(join(output, 'trace.json'), `${JSON.stringify(report, null, 2)}\n`);
saveTrace();
const pause = milliseconds => new Promise(resolvePause => setTimeout(resolvePause, milliseconds));
async function waitFor(check, message, timeout = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const value = await check();
    if (value) return value;
    await pause(25); // Condition polling, not a fixed animation delay.
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

const observer = `(() => {
  const keys = ${JSON.stringify(USER_DATA_KEYS)};
  const storage = localStorage;
  const probe = window.__searchProbe = { events: [], writes: [], storage };
  for (const method of ['setItem', 'removeItem', 'clear']) {
    const original = Storage.prototype[method];
    Storage.prototype[method] = function(...args) {
      if (this === storage && (method === 'clear' || keys.includes(String(args[0])))) {
        probe.writes.push({ method, key: args[0] ?? null, value: args[1] ?? null, at: performance.now() });
      }
      return Reflect.apply(original, this, args);
    };
  }
  sessionStorage.removeItem('yijing-daily-seen');
  for (const type of ['keydown', 'keyup', 'input', 'click', 'pointerdown', 'pointerup', 'compositionstart', 'compositionend']) {
    document.addEventListener(type, event => {
      const target = event.target;
      if (!target?.closest?.('.search-box, [data-relation-layer], [data-entry], #auto-rotate')) return;
      probe.events.push({ type, trusted: event.isTrusted, key: event.key, pointerType: event.pointerType,
        composing: event.isComposing, target: target.id || target.closest('.search-option')?.id || target.dataset.relationLayer || target.dataset.entry,
        value: target.id === 'search' ? target.value : undefined, at: performance.now() });
    }, true);
  }
  probe.snapshot = () => {
    const map = window.__searchMap;
    const input = document.querySelector('#search');
    return { url: location.href, stage: document.body.dataset.readingStage,
      activeCode: map?.activeNode?.id || null, autoRotate: map?.autoRotate,
      relation: map?.relationFilter ? { ...map.relationFilter } : null,
      camera: map ? { pos: { ...map.cameraPos }, target: map.cameraTarget ? { ...map.cameraTarget } : null,
        transition: map.cameraTransition ? { elapsed: map.cameraTransition.elapsed } : null,
        yaw: map.yaw, pitch: map.pitch, view: { ...map.view } } : null,
      focusName: document.querySelector('[data-focus-name]')?.textContent,
      summaryHidden: document.querySelector('#star-focus-summary')?.hidden,
      detailHidden: document.querySelector('#detail-panel')?.getAttribute('aria-hidden'),
      value: input?.value, expanded: input?.getAttribute('aria-expanded'),
      describedBy: input?.getAttribute('aria-describedby'), help: document.querySelector('#search-help')?.textContent,
      searchStatus: document.querySelector('#search-status')?.textContent,
      statusRole: document.querySelector('#search-status')?.getAttribute('role'),
      activeDescendant: input?.getAttribute('aria-activedescendant'), focus: document.activeElement?.id,
      resultsHidden: document.querySelector('#search-results')?.hidden,
      empty: document.querySelector('.search-empty')?.textContent || null,
      options: [...document.querySelectorAll('.search-option')].map(option => ({ id: option.id,
        index: option.dataset.index, name: option.querySelector('strong')?.textContent,
        fullName: option.querySelector('small')?.textContent, code: option.querySelector('code')?.textContent,
        number: Number(option.querySelector('.search-option-number')?.textContent), selected: option.getAttribute('aria-selected') })),
      data: Object.fromEntries(keys.map(key => [key, storage.getItem(key)])), writes: [...probe.writes],
      history: history.state };
  };
})();`;
let client;
let browser;
let server;
let current;
let mobile = false;
let observerError;
let baseline;
async function snapshot() { return client.evaluate('window.__searchProbe.snapshot()'); }
async function popupRendering() {
  return client.evaluate(`(() => {
    const popup = document.querySelector('#search-popup');
    const popupRect = popup?.getBoundingClientRect();
    const describe = element => {
      if (!element) return null;
      const style = getComputedStyle(element), rect = element.getBoundingClientRect();
      let effectiveOpacity = 1;
      for (let parent = element; parent; parent = parent.parentElement) effectiveOpacity *= Number(getComputedStyle(parent).opacity);
      const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      return { id: element.id, opacity: style.opacity, effectiveOpacity, background: style.background,
        transform: style.transform, position: style.position, zIndex: style.zIndex, rect: rect.toJSON(), scrollTop: element.scrollTop,
        visibleWithinPopup: Boolean(popupRect && rect.bottom > Math.max(popupRect.top, 0) && rect.top < Math.min(popupRect.bottom, innerHeight)
          && rect.right > Math.max(popupRect.left, 0) && rect.left < Math.min(popupRect.right, innerWidth)),
        hit: hit ? { id: hit.id, className: hit.className, text: hit.textContent?.slice(0, 80) } : null,
        hitWithin: Boolean(hit && (hit === element || element.contains(hit))) };
    };
    return { popup: describe(popup), results: describe(document.querySelector('#search-results')),
      options: [...document.querySelectorAll('.search-option')].map(describe),
      runningAnimations: popup?.getAnimations({ subtree: true }).filter(animation => animation.playState === 'running' || animation.pending)
        .map(animation => ({ playState: animation.playState, currentTime: animation.currentTime })) || [] };
  })()`);
}
async function screenshot(name) {
  if (await client.evaluate('document.querySelector("#search-popup")?.hidden === false')) {
    let rendering;
    try {
      await waitFor(async () => {
        rendering = await popupRendering();
        if (rendering.runningAnimations.length || rendering.popup.effectiveOpacity < 0.99 || rendering.results.effectiveOpacity < 0.99 ||
            rendering.options.some(option => option.visibleWithinPopup && option.effectiveOpacity < 0.99)) return false;
        await client.evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
        const next = await popupRendering();
        return JSON.stringify(rendering) === JSON.stringify(next);
      }, 'Search popup did not reach stable visible rendering');
    } finally {
      current.checks.push({ action: 'screenshot-rendering-observation', screenshot: name, rendering: await popupRendering() });
    }
  }
  const { data } = await client.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  writeFileSync(join(output, `${name}.png`), Buffer.from(data, 'base64'));
  current.screenshots.push(`${name}.png`);
}
async function pointFor(selector) {
  return waitFor(() => client.evaluate(`(async () => {
    const element = document.querySelector(${JSON.stringify(selector)});
    if (!element?.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) || element.closest('[inert]') || element.disabled) return null;
    const rect = element.getBoundingClientRect();
    const point = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    const target = document.elementFromPoint(point.x, point.y);
    if (!(target === element || element.contains(target))) return null;
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const after = element.getBoundingClientRect();
    if (['x', 'y', 'width', 'height'].some(key => Math.abs(rect[key] - after[key]) > 0.5)) return null;
    return point;
  })()`), `No stable, unobscured control: ${selector}`);
}
async function click(selector) {
  const point = await pointFor(selector);
  current.inputs.push({ action: mobile ? 'touch' : 'mouse', selector, ...point });
  if (mobile) {
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...point, id: 1 }] });
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } else {
    await client.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point });
    await client.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', buttons: 1, clickCount: 1 });
    await client.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', buttons: 0, clickCount: 1 });
  }
}
async function key(key, modifiers = 0, text) {
  const virtual = { Enter: 13, Escape: 27, Backspace: 8, ArrowDown: 40, ArrowUp: 38, Home: 36, End: 35, a: 65, k: 75, '/': 191 };
  const windowsVirtualKeyCode = virtual[key] ?? (/^\d$/.test(key) ? key.charCodeAt(0) : 0);
  const code = /^\d$/.test(key) ? `Digit${key}` : /^[a-z]$/.test(key) ? `Key${key.toUpperCase()}` : key;
  current.inputs.push({ action: 'key', key, modifiers, text });
  await client.send('Input.dispatchKeyEvent', { type: text ? 'keyDown' : 'rawKeyDown', key, code,
    windowsVirtualKeyCode, modifiers, ...(text ? { text, unmodifiedText: text } : {}),
    ...(key === 'a' && modifiers === 2 ? { commands: ['selectAll'] } : {}) });
  await client.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode, modifiers });
}
function assertNoReading(state) {
  assert.equal(state.stage, 'none');
  assert.equal(state.detailHidden, 'true');
  assert.equal(new URL(state.url).searchParams.has('hex'), false);
  assert.deepEqual(state.data, baseline.data, 'Search modified backed-up learning data');
  assert.deepEqual(state.writes, baseline.writes, 'Search attempted a learning/achievement/review write');
}
function assertRetained(before, after) {
  assert.equal(after.activeCode, before.activeCode);
  assert.equal(after.autoRotate, before.autoRotate);
  assert.deepEqual(after.relation, before.relation);
  assert.deepEqual(after.camera, before.camera);
  assert.equal(after.url, before.url);
  assertNoReading(after);
}
async function settled() {
  await waitFor(async () => !(await snapshot()).camera?.transition, 'Previous focus camera did not settle');
}
async function query(text, { shortcut = !mobile } = {}) {
  if (shortcut) await key('k', 2);
  else await click('#search');
  await waitFor(() => client.evaluate('document.activeElement?.id === "search"'), 'Search was not focused');
  await key('a', 2);
  await key('Backspace');
  if (/^\d+$/.test(text)) for (const character of text) await key(character, 0, character);
  else if (text) {
    current.inputs.push({ action: 'committed-text-CDP', text });
    await client.send('Input.insertText', { text });
  }
  await waitFor(async () => { const state = await snapshot(); return state.value === text &&
    (text.trim() ? state.expanded === 'true' && (state.options.length > 0 || state.empty) : state.expanded === 'false');
  }, `Query did not produce an observable state: ${text}`);
  const state = await snapshot();
  assert.ok(state.options.length <= 8);
  assert.equal(new Set(state.options.map(option => option.code)).size, state.options.length);
  assertNoReading(state);
  return state;
}
async function select(text, expected, usePointer = mobile) {
  const before = await snapshot();
  const results = await query(text);
  assert.equal(results.url, before.url, 'Typing changed the URL');
  assert.equal(results.activeCode, before.activeCode, 'Typing changed the focused hexagram');
  assert.equal(results.autoRotate, before.autoRotate, 'Typing changed the automatic rotation preference');
  assert.equal(results.options[0]?.name, expected.name, `Wrong first search result for ${text}`);
  assert.equal(results.options[0]?.number, expected.number);
  assert.equal(results.options[0]?.code, expected.code);
  if (usePointer) await click('.search-option[data-index="0"]');
  else {
    await key('ArrowDown');
    const navigated = await snapshot();
    assert.equal(navigated.activeDescendant, navigated.options[0].id);
    assert.equal(navigated.options[0].selected, 'true');
    assert.equal(navigated.activeCode, before.activeCode, 'Arrow navigation focused before confirmation');
    await key('Enter');
  }
  await waitFor(async () => (await snapshot()).activeCode === expected.code && (await snapshot()).expanded === 'false', `Selection did not focus ${expected.name}`);
  await settled();
  const after = await snapshot();
  assert.equal(after.focusName, expected.name);
  assert.equal(after.autoRotate, before.autoRotate, 'Search confirmation changed automatic rotation');
  assert.equal(after.summaryHidden, false);
  assertNoReading(after);
  current.checks.push({ action: 'query-and-confirm-focus-only', query: text, pointer: usePointer, results, after });
  saveTrace();
}

const port = await freePort();
const debugPort = await freePort();
const siteUrl = `http://127.0.0.1:${port}/`;
const data = JSON.parse(readFileSync(join(root, 'web/data/hexagrams.json'), 'utf8'));
const expected = name => { const hex = data.find(item => item.name === name); assert.ok(hex); return { name, number: hex.number, code: hex.binaryCode }; };
const cases = [['111111', '乾'], ['1', '乾'], ['64', '未济'], ['第64卦', '未济'],
  ['下乾上坤', '泰'], ['上坤下乾', '泰'], [' 111111 ', '乾'], ['乾', '乾'], ['乾为天', '乾'], ['潜龙勿用', '乾'], ['休复吉', '复']];
try {
  server = spawn(process.execPath, ['scripts/serve.mjs'], {
    cwd: root, env: { ...process.env, PORT: String(port), HOST: '127.0.0.1' }, stdio: 'ignore', windowsHide: true,
  });
  await waitFor(async () => { try { return (await fetch(siteUrl)).ok; } catch { return false; } }, 'Static server did not start');
  browser = spawn(browserPath, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--no-sandbox',
    `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore', windowsHide: true });
  const target = await waitFor(async () => { try { return (await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json()).find(item => item.type === 'page'); } catch { return false; } }, 'Browser did not start');
  client = new Client(target.webSocketDebuggerUrl);
  await client.open();
  for (const domain of ['Runtime', 'Page', 'Log', 'Debugger']) await client.send(`${domain}.enable`);
  report.browser = await client.send('Browser.getVersion');
  await client.send('Page.addScriptToEvaluateOnNewDocument', { source: observer });
  const source = readFileSync(join(root, 'web/js/star-map.js'), 'utf8').split(/\r?\n/);
  const lineNumber = source.findIndex(line => line.trim() === 'this._startRenderLoop();');
  assert.ok(lineNumber >= 0);
  await client.send('Debugger.setBreakpointByUrl', { lineNumber, urlRegex: '/js/star-map\\.js$' });
  client.onPaused = async ({ callFrames }) => {
    try { await client.send('Debugger.evaluateOnCallFrame', { callFrameId: callFrames[0].callFrameId, expression: 'window.__searchMap = this' }); }
    catch (error) { observerError = error; }
    finally { await client.send('Debugger.resume'); }
  };
  const widths = searchScope === 'visual-geometry' ? [320, 390, 768] : (searchScope ? [1440] : [1440, 390]);
  for (const width of widths) {
    mobile = width <= 430;
    current = { name: `${width}-${searchScope || 'search-real-input'}`, viewport: { width, height: mobile ? 844 : 1024 },
      inputs: [], checks: [], screenshots: [], status: 'running' };
    report.scenarios.push(current);
    await client.send('Emulation.setDeviceMetricsOverride', { ...current.viewport, deviceScaleFactor: 1, mobile });
    await client.send('Emulation.setTouchEmulationEnabled', { enabled: mobile, maxTouchPoints: 1 });
    await client.send('Page.navigate', { url: `${siteUrl}?search-probe=${width}` });
    await waitFor(async () => { if (observerError) throw observerError; try { return await client.evaluate('document.querySelector("#loading")?.hidden === true && Boolean(window.__searchMap) && document.querySelector("#daily-overlay")?.hidden === false'); } catch { return false; } }, 'Application/welcome did not initialize');
    await click('[data-entry="explore"]');
    await waitFor(() => client.evaluate('document.querySelector("#daily-overlay")?.hidden === true'), 'Welcome did not close');
    baseline = await snapshot();
    current.baseline = baseline;
    if (preUiTrigrams) {
      await select('上坤下乾', expected('泰'));
      current.final = await snapshot();
      current.events = await client.evaluate('window.__searchProbe.events');
      await screenshot(current.name);
      current.status = 'passed';
      console.log(`PASS ${current.name}`);
      saveTrace();
      continue;
    }
    assert.ok(baseline.help?.trim(), 'Search syntax help is missing');
    assert.ok(baseline.describedBy?.split(/\s+/).includes('search-help'), 'Search help is not associated with the input');
    assert.equal(baseline.statusRole, 'status');
    if (searchScope === 'visual-geometry') {
      await select('上坤下乾', expected('泰'));
      const results = await query('君子');
      await screenshot(`${width}-search-open-help`);
      const geometry = await client.evaluate(`(() => {
        const popup = document.querySelector('#search-popup'), help = document.querySelector('#search-help');
        return { viewport: { width: innerWidth, height: innerHeight }, rect: popup.getBoundingClientRect().toJSON(),
          documentWidth: document.documentElement.scrollWidth, popupClientWidth: popup.clientWidth,
          popupScrollWidth: popup.scrollWidth, helpFontSize: getComputedStyle(help).fontSize,
          helpVisible: help.checkVisibility(), statusRole: document.querySelector('#search-status').getAttribute('role') };
      })()`);
      assert.ok(geometry.rect.left >= 0 && geometry.rect.right <= width, 'Search popup overflows the viewport horizontally');
      assert.ok(geometry.rect.top >= 0 && geometry.rect.bottom <= current.viewport.height, 'Search popup overflows the viewport vertically');
      assert.ok(geometry.documentWidth <= width);
      assert.ok(geometry.popupScrollWidth <= geometry.popupClientWidth);
      assert.ok(Number.parseFloat(geometry.helpFontSize) >= 15);
      assert.equal(geometry.helpVisible, true);
      assert.equal(geometry.statusRole, 'status');
      const codeObservations = [];
      for (const [index, option] of results.options.entries()) {
        await key(index === 0 ? 'Home' : 'ArrowDown');
        const observation = await client.evaluate(`(() => {
          const option = document.querySelector('.search-option[data-index="${option.index}"]');
          const code = option.querySelector('code'), popup = document.querySelector('#search-popup');
          const rect = code.getBoundingClientRect(), bounds = popup.getBoundingClientRect(), style = getComputedStyle(code);
          const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
          return { text: code.textContent, display: style.display, visibility: style.visibility, opacity: style.opacity,
            visible: code.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }), rect: rect.toJSON(),
            popupScrollTop: popup.scrollTop, popupClientHeight: popup.clientHeight, popupScrollHeight: popup.scrollHeight,
            optionClientWidth: option.clientWidth, optionScrollWidth: option.scrollWidth,
            inPopup: rect.left >= Math.max(bounds.left, 0) && rect.right <= Math.min(bounds.right, innerWidth)
              && rect.top >= Math.max(bounds.top, 0) && rect.bottom <= Math.min(bounds.bottom, innerHeight),
            hitWithinCode: Boolean(hit && (hit === code || code.contains(hit))), hitId: hit?.id, hitClass: hit?.className };
        })()`);
        codeObservations.push({ index, number: option.number, expectedCode: data.find(hex => hex.number === option.number)?.binaryCode, ...observation });
        current.checks.push({ action: 'visible-result-code-observed', observation: codeObservations.at(-1) });
        assert.equal(observation.text, codeObservations.at(-1).expectedCode, 'Visible result code does not match its hexagram');
        assert.match(observation.text, /^[01]{6}$/);
        assert.equal(observation.visible, true, `Result ${option.number} code is hidden at ${width}px`);
        assert.ok(observation.rect.width > 0 && observation.rect.height > 0, 'Result code has no rendered area');
        assert.equal(observation.inPopup, true, 'Focused result code is clipped or outside the viewport');
        assert.equal(observation.hitWithinCode, true, 'Rendered result code is obstructed');
        assert.ok(observation.optionScrollWidth <= observation.optionClientWidth, 'Result row overflows horizontally');
      }
      assert.ok(codeObservations.at(-1).popupScrollTop > 0, 'Keyboard navigation did not scroll to the last result');
      const last = results.options.at(-1);
      await click(`.search-option[data-index="${last.index}"]`);
      await waitFor(async () => (await snapshot()).activeCode === last.code, 'The visible final result could not be selected');
      assertNoReading(await snapshot());
      current.checks.push({ action: 'search-popup-geometry-and-last-option-reachable', geometry, results, codeObservations, selected: await snapshot() });
      await screenshot(`${width}-search-last-selected`);
      current.final = await snapshot();
      current.events = await client.evaluate('window.__searchProbe.events');
      assert.ok(current.events.every(event => event.trusted));
      current.status = 'passed';
      console.log(`PASS ${current.name}`);
      saveTrace();
      continue;
    }
    if (searchScope === 'ime-contract') {
      await select('渐', expected('渐'));
      await click('#auto-rotate');
      await query('64');
      const before = await snapshot();
      await client.evaluate(`document.querySelector('#search').dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, data: '64' }))`);
      const during = await snapshot();
      assert.equal(during.expanded, 'false');
      assertRetained(before, during);
      for (const event of [
        { key: 'ArrowDown', isComposing: true }, { key: 'Enter', isComposing: true },
        { key: 'Escape', isComposing: true }, { key: 'Escape', keyCode: 229 },
      ]) {
        await client.evaluate(`document.querySelector('#search').dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...${JSON.stringify(event)} }))`);
        assertRetained(before, await snapshot());
      }
      await client.evaluate(`document.querySelector('#search').dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '64' }))`);
      await waitFor(async () => { const state = await snapshot(); return state.expanded === 'true' && state.options[0]?.name === '未济'; }, 'Committed composition did not refresh current-query results');
      const committed = await snapshot();
      assertRetained(before, committed);
      await key('Enter');
      await waitFor(async () => (await snapshot()).activeCode === expected('未济').code, 'Real confirmation did not work after synthetic composition');
      assertNoReading(await snapshot());
      current.checks.push({ action: 'synthetic-composition-contract-not-real-ime', before, during, committed, after: await snapshot() });
      current.final = await snapshot();
      current.events = await client.evaluate('window.__searchProbe.events');
      assert.ok(current.events.some(event => event.type === 'compositionstart' && event.trusted === false));
      await screenshot('1440-synthetic-composition-completed');
      current.status = 'passed';
      console.log(`PASS ${current.name} (synthetic contract only)`);
      saveTrace();
      continue;
    }
    for (const [text, name] of cases) await select(text, expected(name), mobile || text === '乾为天');

    // Exact original card context: Jian + interlocking must survive invalid queries and cancellation.
    await select('渐', expected('渐'));
    await click('[data-relation-layer="interlocking"]');
    await settled();
    // Establish a still-camera precondition through the existing user control; normal focus motion stays enabled.
    if (await client.evaluate('document.querySelector("#auto-rotate").getAttribute("aria-pressed") === "true"')) {
      await click('#auto-rotate');
      await waitFor(() => client.evaluate('document.querySelector("#auto-rotate").getAttribute("aria-pressed") === "false"'), 'Automatic rotation did not stop');
    }
    const original = await snapshot();
    assert.equal(original.relation.type, 'interlocking');
    for (const invalid of ['0', '65', '1111111']) {
      const result = await query(invalid);
      assert.deepEqual(result.options, []);
      assert.ok(result.empty);
      assertRetained(original, result);
      await key('Enter');
      const afterEnter = await snapshot();
      assertRetained(original, afterEnter);
      await key('Escape');
      const afterEscape = await snapshot();
      assert.equal(afterEscape.expanded, 'false');
      assert.equal(afterEscape.activeDescendant, null);
      assert.equal(afterEscape.focus, 'search');
      assertRetained(original, afterEscape);
      current.checks.push({ action: 'invalid-enter-escape-preserves-focus-and-relation', query: invalid, result, afterEnter, afterEscape });
    }
    const blank = await query('   ');
    assert.equal(blank.resultsHidden, true);
    assertRetained(original, blank);
    current.checks.push({ action: 'whitespace-closes-suggestions', state: blank });

    const fullText = await query('君子');
    assert.ok(fullText.options.length > 1);
    assert.deepEqual(fullText.options.map(option => option.number), fullText.options.map(option => option.number).sort((a, b) => a - b));
    for (const [navigation, index] of [['End', fullText.options.length - 1], ['Home', 0], ['ArrowDown', 1], ['ArrowUp', 0]]) {
      await key(navigation);
      const state = await snapshot();
      assert.equal(state.activeDescendant, state.options[index].id);
      assert.equal(state.options[index].selected, 'true');
      assert.equal(state.options.filter(option => option.selected === 'true').length, 1);
      assertRetained(original, state);
      current.checks.push({ action: 'keyboard-navigation-without-focusing', key: navigation, state });
    }
    await screenshot(`${width}-search-keyboard-aria`);
    await key('Escape');
    assertRetained(original, await snapshot());
    await query('无此卦象搜索词');
    await click('#relation-toggle');
    const outside = await snapshot();
    assert.equal(outside.expanded, 'false');
    assertRetained(original, outside);
    current.checks.push({ action: 'outside-control-closes-suggestions-without-exiting-focus', state: outside });
    await click('#relation-toggle');
    if (!mobile) {
      await key('/');
      assert.equal((await snapshot()).focus, 'search');
      current.checks.push({ action: 'slash-shortcut-focuses-search', state: await snapshot() });
      await key('Escape');
    }
    await screenshot(`${width}-search-cancel-preserved`);
    await query('无此卦象搜索词');
    await key('Escape');
    const firstEscape = await snapshot();
    assertRetained(original, firstEscape);
    assert.equal(firstEscape.expanded, 'false');
    await key('Escape');
    await waitFor(async () => (await snapshot()).activeCode === null, 'Second Escape did not leave focused exploration');
    const secondEscape = await snapshot();
    assert.equal(secondEscape.summaryHidden, true);
    assertNoReading(secondEscape);
    current.checks.push({ action: 'first-escape-cancels-second-exits-focus', firstEscape, secondEscape });
    current.final = await snapshot();
    current.events = await client.evaluate('window.__searchProbe.events');
    assert.ok(current.events.length > 0 && current.events.every(event => event.trusted), 'Unexpected untrusted input event');
    assert.ok(current.events.some(event => event.type === 'click' && event.pointerType === (mobile ? 'touch' : 'mouse')));
    assertNoReading(current.final);
    current.status = 'passed';
    console.log(`PASS ${current.name}`);
    saveTrace();
  }
  report.status = 'passed';
} catch (error) {
  report.status = 'failed';
  report.failure = { message: error.message, stack: error.stack };
  if (current) {
    current.status = 'failed';
    try { current.final = await snapshot(); current.events = await client.evaluate('window.__searchProbe.events'); await screenshot(`${current.name}-failure`); } catch {}
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
    report.failure = { message: report.pageErrors.length ? 'Uncaught page errors observed' : 'Sources changed during run' };
    process.exitCode = 1;
  }
  client?.socket.close();
  await stopProcess(browser);
  await stopProcess(server);
  if (dirname(profile) === temporaryRoot && basename(profile).startsWith('yijing-search-input-')) {
    try { rmSync(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }); report.profileRemoved = !existsSync(profile); }
    catch (error) { report.profileRemoved = false; report.cleanupError = error.code; }
  }
  saveTrace();
  console.log(JSON.stringify({ status: report.status, passed: report.scenarios.filter(item => item.status === 'passed').length,
    total: report.scenarios.length, trace: join(output, 'trace.json'), profileRemoved: report.profileRemoved }));
}
