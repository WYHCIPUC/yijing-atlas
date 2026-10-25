import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// A narrow lifecycle probe. This does not run or replace the full browser smoke.
const browserPath = process.env.BROWSER_PATH;
assert.ok(browserPath && existsSync(browserPath), 'Set BROWSER_PATH to an installed Chromium executable.');
const projectRoot = fileURLToPath(new URL('../../../', import.meta.url));
const temporaryRoot = realpathSync(tmpdir());
const profile = mkdtempSync(join(temporaryRoot, 'yijing-sw-probe-'));
const pause = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

async function waitFor(check, timeout = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try { if (await check()) return true; } catch { /* Navigation replaces the execution context. */ }
    await pause(60);
  }
  return false;
}

class Client {
  constructor(url) {
    this.socket = new WebSocket(url);
    this.nextId = 1;
    this.pending = new Map();
    this.events = [];
    this.socket.addEventListener('message', ({ data }) => {
      const message = JSON.parse(data);
      if (!message.id) { this.events.push(message); return; }
      const pending = this.pending.get(message.id);
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message));
      else pending.resolve(message.result);
    });
  }

  async open() {
    await new Promise((resolve, reject) => {
      this.socket.addEventListener('open', resolve, { once: true });
      this.socket.addEventListener('error', reject, { once: true });
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const response = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (response.exceptionDetails) throw new Error(response.exceptionDetails.text);
    return response.result.value;
  }
}

const [sitePort, debugPort] = await Promise.all([freePort(), freePort()]);
const siteUrl = `http://127.0.0.1:${sitePort}/`;
const server = spawn(process.execPath, ['scripts/serve.mjs'], {
  cwd: projectRoot, env: { ...process.env, PORT: String(sitePort) }, stdio: 'ignore', windowsHide: true,
});
let browser;
let client;

try {
  assert.ok(await waitFor(async () => (await fetch(siteUrl)).ok), 'Static server did not start.');
  browser = spawn(browserPath, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--no-sandbox',
    `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`, 'about:blank',
  ], { stdio: 'ignore', windowsHide: true });
  let target;
  assert.ok(await waitFor(async () => {
    const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
    target = targets.find((item) => item.type === 'page');
    return Boolean(target);
  }), 'Chromium did not start.');
  client = new Client(target.webSocketDebuggerUrl);
  await client.open();
  for (const domain of ['Runtime', 'Page', 'Log', 'Network']) await client.send(`${domain}.enable`);
  console.log(JSON.stringify({ browser: await client.send('Browser.getVersion') }));
  await client.send('Page.navigate', { url: siteUrl });
  assert.ok(await waitFor(() => client.evaluate('document.querySelector("#loading")?.hidden === true')), 'Initial app did not load.');
  assert.ok(await waitFor(() => client.evaluate('Boolean(navigator.serviceWorker?.controller)')), 'Initial worker did not claim the page.');

  async function status() {
    return client.evaluate(`(async () => ({
      url: location.href, timeOrigin: performance.timeOrigin, readyState: document.readyState,
      loadingHidden: document.querySelector('#loading')?.hidden,
      loadingText: document.querySelector('#loading')?.textContent,
      controller: navigator.serviceWorker?.controller?.scriptURL || null,
      canvas: Boolean(document.querySelector('#star-canvas')),
      registrations: navigator.serviceWorker ? (await navigator.serviceWorker.getRegistrations()).map(registration => ({
        active: registration.active?.state, waiting: registration.waiting?.state, installing: registration.installing?.state,
      })) : [],
    }))()`);
  }

  async function reload(label, ignoreCache, { required = true } = {}) {
    const before = await client.evaluate('performance.timeOrigin');
    await client.send('Page.reload', { ignoreCache });
    const loaded = await waitFor(() => client.evaluate(`performance.timeOrigin !== ${before}
      && document.readyState === 'complete' && document.querySelector('#loading')?.hidden === true`));
    const result = { label, ignoreCache, previousTimeOrigin: before, loaded, ...await status() };
    console.log(JSON.stringify(result));
    if (required) {
      assert.ok(loaded, `${label}: a new document must finish application initialization.`);
      assert.notEqual(result.timeOrigin, before);
    }
    return result;
  }

  console.log(JSON.stringify({ label: 'initial-controlled', ...await status() }));
  for (let repetition = 1; repetition <= 2; repetition += 1) {
    const hard = await reload(`online-hard-${repetition}`, true);
    assert.equal(hard.controller, null, 'This Chromium hard reload is expected to bypass the active worker.');
    assert.ok(hard.registrations.some((registration) => registration.active === 'activated'));
    const normal = await reload(`online-normal-${repetition}`, false);
    assert.ok(normal.controller?.endsWith('/sw.js'), 'Normal reload must be controlled.');
  }
  await client.send('Network.setCacheDisabled', { cacheDisabled: true });
  await client.send('Network.emulateNetworkConditions', {
    offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1, connectionType: 'none',
  });
  const offline = await reload('offline-normal-http-cache-disabled', false);
  assert.ok(offline.controller?.endsWith('/sw.js') && offline.canvas, 'Offline normal reload must restore the application through the worker.');
  // Record this browser-specific fallback, but do not require other versions to behave identically.
  await reload('offline-hard-http-cache-disabled', true, { required: false });
  console.log(JSON.stringify({ pageErrors: client.events.filter(({ method }) =>
    method === 'Runtime.exceptionThrown' || method === 'Log.entryAdded').map(({ params }) => params) }));
  console.log('PASS: new-document guard, online hard/normal control difference, offline normal reload with HTTP cache disabled.');
} finally {
  client?.socket.close();
  browser?.kill();
  server.kill();
  await pause(300);
  // Verify the exact generated profile stays under the named temporary parent before recursive cleanup.
  if (dirname(profile) === temporaryRoot && basename(profile).startsWith('yijing-sw-probe-')) {
    try { rmSync(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }); }
    catch (error) { console.warn(`Temporary probe profile cleanup failed: ${error.code}`); }
  }
}
