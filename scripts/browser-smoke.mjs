import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

function browserCandidates() {
  const paths = [
    process.env.BROWSER_PATH,
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ];
  if (process.env.ProgramFiles) paths.push(join(process.env.ProgramFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'));
  if (process.env['ProgramFiles(x86)']) paths.push(join(process.env['ProgramFiles(x86)'], 'Microsoft', 'Edge', 'Application', 'msedge.exe'));
  if (process.env.LOCALAPPDATA) paths.push(join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe'));
  return paths.filter(Boolean);
}

function findBrowser() {
  return browserCandidates().find((path) => existsSync(path));
}

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

async function waitFor(check, message, timeout = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    try {
      const value = await check();
      if (value) return value;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(message);
}

async function stopProcess(child) {
  if (!child || child.exitCode !== null) return;
  child.kill();
  await Promise.race([
    once(child, 'exit'),
    new Promise((resolve) => setTimeout(resolve, 3000)),
  ]);
}

class CdpClient {
  constructor(url) {
    this.socket = new WebSocket(url);
    this.nextId = 1;
    this.pending = new Map();
    this.events = [];
    this.socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const pending = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(message.error.message));
        else pending.resolve(message.result);
      } else {
        this.events.push(message);
      }
    });
  }

  async open() {
    if (this.socket.readyState === WebSocket.OPEN) return;
    await new Promise((resolve, reject) => {
      this.socket.addEventListener('open', resolve, { once: true });
      this.socket.addEventListener('error', () => reject(new Error('无法连接浏览器调试端口')), { once: true });
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
    const response = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (response.exceptionDetails) {
      const description = response.exceptionDetails.exception?.description;
      throw new Error(description || response.exceptionDetails.text || '页面脚本执行失败');
    }
    return response.result.value;
  }

  close() {
    this.socket.close();
  }
}

async function elementPoint(client, selector) {
  try {
    return await waitFor(() => client.evaluate(`(async () => {
    const element = document.querySelector(${JSON.stringify(selector)});
    if (!element || !element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) || element.closest('[inert]')) return null;
    const hitPoint = () => {
      const rect = element.getBoundingClientRect();
      const point = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      const hit = document.elementFromPoint(point.x, point.y);
      return rect.width > 0 && rect.height > 0 && hit && (element === hit || element.contains(hit)) ? point : null;
    };
    if (!hitPoint()) {
      element.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
      return null;
    }
    const before = element.getBoundingClientRect();
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const after = element.getBoundingClientRect();
    if (['x', 'y', 'width', 'height'].some(key => Math.abs(before[key] - after[key]) > 0.5)) return null;
    return hitPoint();
    })()`), `真实输入无法命中 ${selector}`);
  } catch (error) {
    const details = await client.evaluate(`(() => {
      const element = document.querySelector(${JSON.stringify(selector)});
      const rect = element?.getBoundingClientRect();
      const hit = rect ? document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2) : null;
      return { exists: Boolean(element), inertAncestor: element?.closest('[inert]')?.id || element?.closest('[inert]')?.className,
        hiddenAncestor: element?.closest('[hidden]')?.id, rect: rect?.toJSON(), hit: hit?.id || hit?.className,
        reading: document.body.dataset.readingStage, mode: document.body.dataset.activeMode,
        panelOpen: document.querySelector('#detail-panel').classList.contains('open'),
        relationExpanded: document.querySelector('#relation-toggle').getAttribute('aria-expanded') };
    })()`);
    throw new Error(`${error.message}：${JSON.stringify(details)}`);
  }
}

async function mouseClick(client, selector) {
  const { x, y } = await elementPoint(client, selector);
  if (selector.startsWith('[data-reading-tab=')) {
    await client.evaluate(`document.querySelector(${JSON.stringify(selector)}).addEventListener('click', event => {
      window.__smokeReadingClick = { trusted: event.isTrusted, tab: event.currentTarget.dataset.readingTab, x: event.clientX, y: event.clientY };
    }, { once: true })`);
  }
  await client.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
  await client.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 });
  await client.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 });
}

async function pressKey(client, key, { modifiers = 0 } = {}) {
  const virtualKeys = { Enter: 13, Escape: 27, Tab: 9, ArrowDown: 40, ArrowRight: 39, Home: 36, End: 35, a: 65 };
  const code = key.length === 1 ? `Key${key.toUpperCase()}` : key;
  const windowsVirtualKeyCode = virtualKeys[key] || 0;
  await client.send('Input.dispatchKeyEvent', {
    type: key === 'Enter' ? 'keyDown' : 'rawKeyDown', key, code, windowsVirtualKeyCode, modifiers,
    ...(key === 'Enter' ? { text: '\r', unmodifiedText: '\r' } : {}),
    ...(key === 'a' && modifiers === 2 ? { commands: ['selectAll'] } : {}),
  });
  await client.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode, modifiers });
}

async function searchByInput(client, text, { keyboard = false } = {}) {
  await mouseClick(client, '#search');
  await pressKey(client, 'a', { modifiers: 2 });
  await client.send('Input.insertText', { text });
  if (await client.evaluate('document.querySelector("#search").value') !== text) throw new Error(`真实搜索输入未替换为「${text}」`);
  await waitFor(() => client.evaluate('document.querySelectorAll(".search-option").length > 0'), `搜索「${text}」没有结果`);
  const targetIndex = await client.evaluate(`Array.from(document.querySelectorAll('.search-option')).findIndex(option => option.querySelector('strong')?.textContent === ${JSON.stringify(text)})`);
  if (targetIndex < 0) throw new Error(`搜索「${text}」未返回同名卦象`);
  if (keyboard) {
    for (let index = 0; index <= targetIndex; index += 1) await pressKey(client, 'ArrowDown');
    await pressKey(client, 'Enter');
  } else {
    await mouseClick(client, `.search-option[data-index="${targetIndex}"]`);
  }
  await waitFor(() => client.evaluate('!document.querySelector("#star-focus-summary").hidden && document.body.dataset.readingStage === "none"'), `搜索「${text}」未进入聚焦`);
  if (await client.evaluate('document.querySelector("[data-focus-name]").textContent') !== text) throw new Error(`搜索「${text}」没有聚焦同名卦象`);
}

async function touchTap(client, selector) {
  const { x, y } = await elementPoint(client, selector);
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

async function touchDrag(client, from, to) {
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...from, id: 1 }] });
  for (let step = 1; step <= 8; step += 1) {
    const t = step / 8;
    await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t, id: 1 }] });
  }
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

async function pickRenderedStar(client, { touch = false } = {}) {
  const attempts = [];
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const sample = await waitFor(() => client.evaluate(`(() => {
    const canvas = document.querySelector('#star-canvas');
    const rect = canvas.getBoundingClientRect();
    const seen = new Set();
    const points = (window.__smokeStarPoints || []).slice().sort((a, b) => b.radius - a.radius)
      .map(point => ({ x: point.x + rect.left, y: point.y + rect.top }))
      .filter(point => {
        const key = Math.round(point.x) + ':' + Math.round(point.y);
        if (seen.has(key) || document.elementFromPoint(point.x, point.y) !== canvas) return false;
        seen.add(key);
        return true;
      }).slice(0, 40);
    return points.length ? { points, frame: window.__smokeRenderCounts.star } : null;
  })()`), '没有可供真实输入选择的星点');
    const { x, y } = sample.points[attempt % sample.points.length];
    if (touch) {
      await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
      await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } else {
      await client.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
      await client.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 });
      await client.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 });
    }
    if (await client.evaluate('!document.querySelector("#star-focus-summary").hidden')) return;
    attempts.push({ x, y, frame: sample.frame });
    await waitFor(() => client.evaluate(`window.__smokeRenderCounts.star > ${sample.frame}`), '选星失败后画布没有绘制新帧');
  }
  throw new Error(`${touch ? '触控' : '鼠标'}未能从画布选择已绘制星点：${JSON.stringify(attempts)}`);
}

const screenshotRun = new Date().toISOString().replace(/[:.]/g, '-');

async function screenshot(client, name) {
  if (process.env.YIJING_SMOKE_SCREENSHOTS !== '1') return;
  const directory = join(process.cwd(), 'docs', 'screenshots', `smoke-${screenshotRun}`);
  mkdirSync(directory, { recursive: true });
  const capture = await client.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  writeFileSync(join(directory, `${name}.png`), Buffer.from(capture.data, 'base64'));
}

async function assertReadingSection(client, section) {
  try {
    await waitFor(() => client.evaluate(`document.querySelector('[data-reading-tab="${section}"]').getAttribute('aria-pressed') === 'true'`), `快读 ${section} 章节未响应真实鼠标`);
  } catch (error) {
    const details = await client.evaluate(`(() => ({
      click: window.__smokeReadingClick,
      panel: document.querySelector('#detail-panel').getBoundingClientRect().toJSON(),
      scroll: document.querySelector('#detail-panel').scrollTop,
      toolbar: document.querySelector('#reading-toolbar').getBoundingClientRect().toJSON(),
      tabs: [...document.querySelectorAll('[data-reading-tab]')].map(el => ({ name: el.dataset.readingTab, current: el.getAttribute('aria-current'), pressed: el.getAttribute('aria-pressed') })),
      sections: [...document.querySelectorAll('[data-reading-section]')].map(el => ({ name: el.dataset.readingSection, margin: getComputedStyle(el).scrollMarginTop, rect: el.getBoundingClientRect().toJSON() })),
    }))()`);
    throw new Error(error.message + '：' + JSON.stringify(details));
  }
  await client.evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
  const status = await client.evaluate(`(() => {
    const current = [...document.querySelectorAll('[data-reading-tab][aria-current="true"]')];
    return { count: current.length, section: current[0]?.dataset.readingTab, pressed: current[0]?.getAttribute('aria-pressed') };
  })()`);
  if (status.count !== 1 || status.section !== section || status.pressed !== 'true') {
    throw new Error(`滚动处理后阅读章节不稳定：${JSON.stringify({ expected: section, ...status })}`);
  }
}

async function assertReadingStage(client, stage, { modal = null } = {}) {
  await waitFor(() => client.evaluate(`document.body.dataset.readingStage === ${JSON.stringify(stage)}`), `阅读层级未切换到 ${stage}`);
  const status = await client.evaluate(`(() => {
    const panel = document.querySelector('#detail-panel');
    return { open: panel.classList.contains('open'), modal: panel.getAttribute('aria-modal'), deepLink: location.search.includes('hex=') };
  })()`);
  if (stage !== 'none' && (!status.open || status.deepLink !== (stage === 'deep'))) throw new Error(`阅读层级或链接异常：${JSON.stringify({ stage, ...status })}`);
  if (modal !== null && status.modal !== String(modal)) throw new Error(`阅读模态状态异常：${JSON.stringify({ stage, ...status })}`);
  if (stage !== 'none') {
    await waitFor(() => client.evaluate('Number(getComputedStyle(document.querySelector("#detail-content")).opacity) >= 0.99'), '阅读正文残留过渡透明度，暖纸与文字被压暗');
  }
}

async function assertReadingGeometry(client, stage, ratio = 1) {
  await waitFor(() => client.evaluate(`(() => {
    const rect = document.querySelector('#detail-panel').getBoundingClientRect();
    return Math.abs(rect.left) < 2 && Math.abs(rect.width - innerWidth) < 2 && Math.abs(rect.height - innerHeight * ${ratio}) < 3
      && Math.abs(rect.bottom - innerHeight) < 2;
  })()`), `${stage} 阅读几何尺寸错误（目标高度 ${ratio} × 视口）`);
}

const renderProbe = `(() => {
  window.__smokeRenderCounts = { star: 0, celestial: 0 };
  window.__smokeStarPoints = [];
  const originalClear = CanvasRenderingContext2D.prototype.clearRect;
  CanvasRenderingContext2D.prototype.clearRect = function(...args) {
    if (this.canvas.id === 'star-canvas') {
      window.__smokeRenderCounts.star += 1;
      window.__smokeStarPoints = [];
    }
    return originalClear.apply(this, args);
  };
  const originalArc = CanvasRenderingContext2D.prototype.arc;
  CanvasRenderingContext2D.prototype.arc = function(x, y, radius, ...args) {
    if (this.canvas.id === 'star-canvas' && radius >= 1.5 && radius <= 8 && window.__smokeStarPoints.length < 500) {
      window.__smokeStarPoints.push({ x, y, radius });
    }
    return originalArc.call(this, x, y, radius, ...args);
  };
  for (const type of [window.WebGLRenderingContext, window.WebGL2RenderingContext].filter(Boolean)) {
    for (const name of ['drawArrays', 'drawElements']) {
      const original = type.prototype[name];
      type.prototype[name] = function(...args) {
        if (this.canvas.id === 'celestial-canvas') window.__smokeRenderCounts.celestial += 1;
        return original.apply(this, args);
      };
    }
  }
})();`;

async function drawDelta(client) {
  return client.evaluate(`new Promise(resolve => {
    const before = { ...window.__smokeRenderCounts };
    setTimeout(() => resolve({
      star: window.__smokeRenderCounts.star - before.star,
      celestial: window.__smokeRenderCounts.celestial - before.celestial,
    }), 350);
  })`);
}

async function stablePanelScroll(client) {
  let previous = -1;
  let stable = 0;
  return waitFor(async () => {
    const current = await client.evaluate('document.querySelector("#detail-panel").scrollTop');
    stable = Math.abs(current - previous) < 0.5 ? stable + 1 : 0;
    previous = current;
    return stable >= 3 && current > 0 ? current : null;
  }, '真实阅读滚动未进入稳定的非零位置');
}

async function verifyNativeBrowserZoom(browserPath, siteUrl) {
  const directory = mkdtempSync(join(tmpdir(), 'yijing-browser-zoom-'));
  const port = await freePort();
  mkdirSync(join(directory, 'Default'), { recursive: true });
  writeFileSync(join(directory, 'Default', 'Preferences'), JSON.stringify({ partition: { default_zoom_level: Math.log(2) / Math.log(1.2) } }));
  let zoomBrowser;
  let zoomClient;
  try {
    zoomBrowser = spawn(browserPath, [
      '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--no-sandbox',
      '--window-size=1280,1024', `--remote-debugging-port=${port}`, `--user-data-dir=${directory}`, `${siteUrl}?hex=111111`,
    ], { stdio: 'ignore' });
    const target = await waitFor(async () => {
      const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      return targets.find(item => item.type === 'page' && item.url.startsWith(siteUrl));
    }, '独立 200% 缩放浏览器未启动', 30000);
    zoomClient = new CdpClient(target.webSocketDebuggerUrl);
    await zoomClient.open();
    await zoomClient.send('Runtime.enable');
    await waitFor(() => zoomClient.evaluate('document.querySelector("#loading")?.hidden === true && document.body.dataset.readingStage === "deep"'), '独立缩放页面未加载');
    const metrics = await zoomClient.evaluate(`({ outerWidth, innerWidth, dpr: devicePixelRatio, visualScale: visualViewport.scale })`);
    const verified = Math.abs(metrics.dpr - 2) < 0.05 && Math.abs(metrics.visualScale - 1) < 0.01
      && metrics.innerWidth >= 620 && metrics.innerWidth <= 660 && metrics.outerWidth >= 1250;
    if (!verified) {
      console.log(`· 浏览器原生 200% 偏好未生效，真实缩放仍未验证：${JSON.stringify(metrics)}`);
      return;
    }
    await assertNoChineseOrphans(zoomClient, '原生浏览器200% 深读');
    await screenshot(zoomClient, '1280x1024-native-200-deep');
    await mouseClick(zoomClient, '#reading-back');
    const layout = await zoomClient.evaluate(`(() => {
      const nav = document.querySelector('#mode-switcher');
      const rect = nav.getBoundingClientRect();
      return {
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        visibleEntries: [...nav.querySelectorAll('.mode-btn')].filter(button => {
          const buttonRect = button.getBoundingClientRect();
          return buttonRect.left >= rect.left - 1 && buttonRect.right <= rect.right + 1
            && buttonRect.top >= rect.top - 1 && buttonRect.bottom <= rect.bottom + 1;
        }).length,
      };
    })()`);
    if (layout.overflow || layout.visibleEntries !== 6) throw new Error(`原生 200% 缩放导航布局异常：${JSON.stringify({ ...metrics, ...layout })}`);
    await screenshot(zoomClient, '1280x1024-native-200-focus');
    console.log(`✓ 原生浏览器 200% 缩放已验证（独立 profile，无 Emulation metrics）：${JSON.stringify(metrics)}`);
  } finally {
    zoomClient?.close();
    await stopProcess(zoomBrowser);
    try {
      rmSync(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
    } catch (error) {
      console.warn(`缩放测试临时目录清理失败，将由系统回收：${error.message}`);
    }
  }
}

async function collectChineseOrphans(client, context, rootSelector = 'body') {
  return client.evaluate(`(() => {
    const root = document.querySelector(${JSON.stringify(rootSelector)});
    if (!root) return [];
    const selectors = [
      'button', 'button > span', 'button > strong',
      'a', 'a > span', 'a > strong', 'summary', 'label', 'figcaption',
      'h1', 'h2', 'h3', 'h4', 'h1 > span', 'h2 > span', 'h3 > span', 'h4 > span',
      '.content-provenance', '.review-mode-badge', '.academy-kicker',
      '.workspace-insight-bar small', '.workspace-insight-bar strong',
      '.daily-roadmap span', '.lesson-stage-rail b', '.lesson-stage-rail small',
      '.study-level-node strong', '.study-level-node small',
      '.profile-section-head > span', '.level-heading > span',
      '.relation-layers-heading > span', '.relation-layers-heading strong',
      '.star-layout-control label', '.changing-position-buttons > span',
      '.hint-guide', '.view-readout small', '.galaxy-legend span'
    ];
    const candidates = [...root.querySelectorAll(selectors.join(','))];
    const cjk = /[\\u3400-\\u4dbf\\u4e00-\\u9fff]/;
    const issues = [];

    for (const element of candidates) {
      if (element.matches('button, a, summary, label, figcaption, h1, h2, h3, h4') && element.children.length) continue;
      const style = getComputedStyle(element);
      const bounds = element.getBoundingClientRect();
      if (!element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) ||
          style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0 ||
          bounds.width < 1 || bounds.height < 1 || element.closest('[hidden]')) continue;

      const chars = [];
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const node = walker.currentNode;
        let offset = 0;
        for (const char of node.data) {
          const start = offset;
          offset += char.length;
          if (!cjk.test(char)) continue;
          const range = document.createRange();
          range.setStart(node, start);
          range.setEnd(node, offset);
          const rect = range.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) chars.push({ char, top: Math.round(rect.top * 2) / 2 });
        }
      }
      if (chars.length < 3 || chars.length > 12) continue;

      const lines = [];
      for (const char of chars) {
        let line = lines.find((item) => Math.abs(item.top - char.top) <= 1);
        if (!line) {
          line = { top: char.top, text: '' };
          lines.push(line);
        }
        line.text += char.char;
      }
      lines.sort((a, b) => a.top - b.top);
      if (lines.length < 2 || !lines.some((line) => line.text.length === 1)) continue;

      const className = typeof element.className === 'string'
        ? element.className.trim().split(/\\s+/).slice(0, 3).join('.')
        : '';
      issues.push({
        context: ${JSON.stringify(context)},
        element: element.tagName.toLowerCase() + (element.id ? '#' + element.id : '') + (className ? '.' + className : ''),
        text: element.textContent.replace(/\\s+/g, ' ').trim().slice(0, 60),
        lines: lines.map((line) => line.text),
        width: Math.round(bounds.width),
      });
    }
    return issues;
  })()`);
}

async function collectTextClipping(client, context, rootSelector = 'body') {
  return client.evaluate(`(() => {
    const root = document.querySelector(${JSON.stringify(rootSelector)});
    if (!root) return [];
    const isVisible = (element) => {
      if (element.closest('[hidden], .sr-only')) return false;
      let current = element;
      while (current instanceof Element) {
        const style = getComputedStyle(current);
        if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
        current = current.parentElement;
      }
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };
    const describe = (element) => {
      const className = typeof element.className === 'string'
        ? element.className.trim().split(/\\s+/).slice(0, 3).join('.')
        : '';
      return element.tagName.toLowerCase() + (element.id ? '#' + element.id : '') + (className ? '.' + className : '');
    };
    const selectors = [
      'h1', 'h2', 'h3', 'h4', 'h1 > span', 'h2 > span', 'h3 > span', 'h4 > span',
      'button', 'button > span', 'button > strong', 'a', 'a > span', 'a > strong',
      'summary', 'label', 'figcaption', 'small', 'strong', 'p',
      '.content-provenance', '.academy-kicker', '.review-mode-badge',
      '.workspace-insight-bar small', '.workspace-insight-bar strong',
      '.study-level-node small', '.study-level-node strong', '.search-option-identity small'
    ];
    const containers = [
      '#detail-panel', '#detail-content', '.mode-panel', '.seven-step-slip',
      '.learning-tabs', '.daily-card', '.evolution-card', '.guaxu-dialog'
    ];
    const candidates = [...new Set([
      ...root.querySelectorAll(selectors.join(',')),
      ...root.querySelectorAll(containers.join(',')),
    ])];
    const issues = [];

    for (const element of candidates) {
      if (!isVisible(element)) continue;
      const text = (element.innerText || '').replace(/\\s+/g, ' ').trim();
      if (!text) continue;
      const style = getComputedStyle(element);
      const widthOverflow = element.scrollWidth - element.clientWidth > 1;
      const heightOverflow = element.scrollHeight - element.clientHeight > 1;
      const isContainer = element.matches(containers.join(','));
      const clippedWidth = widthOverflow && (isContainer || style.whiteSpace === 'nowrap' ||
        style.textOverflow === 'ellipsis' || ['hidden', 'clip'].includes(style.overflowX));
      const clippedHeight = heightOverflow && (Number.parseInt(style.webkitLineClamp, 10) > 0 ||
        ['hidden', 'clip'].includes(style.overflowY));
      if (!clippedWidth && !clippedHeight) continue;
      issues.push({
        context: ${JSON.stringify(context)},
        element: describe(element),
        text: text.slice(0, 70),
        client: [element.clientWidth, element.clientHeight],
        scroll: [element.scrollWidth, element.scrollHeight],
        overflow: [style.overflowX, style.overflowY],
        whiteSpace: style.whiteSpace,
        textOverflow: style.textOverflow,
        lineClamp: style.webkitLineClamp,
      });
    }
    return issues;
  })()`);
}

async function assertNoChineseOrphans(client, context, rootSelector = 'body') {
  const issues = await collectChineseOrphans(client, context, rootSelector);
  if (issues.length) throw new Error(`发现中文短语孤字换行：${JSON.stringify(issues)}`);
  const clipping = await collectTextClipping(client, context, rootSelector);
  if (clipping.length) throw new Error(`发现文字显示不完整或横向溢出：${JSON.stringify(clipping)}`);
}

const browserPath = findBrowser();
if (!browserPath) {
  console.error('未找到 Chromium 浏览器。可通过 BROWSER_PATH 指定 Chrome/Edge/Chromium 可执行文件。');
  process.exit(2);
}

const [sitePort, debugPort] = await Promise.all([freePort(), freePort()]);
const profileDir = mkdtempSync(join(tmpdir(), 'yijing-browser-smoke-'));
const server = spawn(process.execPath, ['scripts/serve.mjs'], {
  cwd: process.cwd(),
  env: { ...process.env, PORT: String(sitePort) },
  stdio: 'ignore',
});
const siteUrl = `http://127.0.0.1:${sitePort}/`;
let browser;
let client;

try {
  await waitFor(async () => (await fetch(siteUrl)).ok, '本地开发服务器启动超时');
  browser = spawn(browserPath, [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--no-sandbox',
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${profileDir}`,
    siteUrl,
  ], { stdio: 'ignore' });

  const target = await waitFor(async () => {
    const response = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
    const targets = await response.json();
    return targets.find((item) => item.type === 'page' && item.url.startsWith(siteUrl));
  }, '浏览器页面启动超时', 30000);

  client = new CdpClient(target.webSocketDebuggerUrl);
  await client.open();
  await client.send('Runtime.enable');
  await client.send('Log.enable');
  await client.send('Accessibility.enable');
  await client.send('Page.enable');
  await client.send('Page.addScriptToEvaluateOnNewDocument', { source: renderProbe });
  await waitFor(() => client.evaluate('document.querySelector("#loading") !== null'), '浏览器初始文档未加载');
  await client.evaluate(`(() => {
    localStorage.setItem('yijing-panel-layout', 'left');
    localStorage.setItem('yijing-drawer-size', 'large');
  })()`);
  await client.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  await client.send('Page.reload', { ignoreCache: true });
  await waitFor(() => client.evaluate('document.querySelector("#loading")?.hidden === true'), '应用初始化超时');
  await assertNoChineseOrphans(client, '1280x720 欢迎页');
  await waitFor(() => client.evaluate('document.activeElement?.dataset.entry === "beginner"'), '欢迎层未聚焦首个入口');
  const welcomeFocus = await client.evaluate(`(() => {
    const overlay = document.querySelector('#daily-overlay');
    const background = [...document.body.children].filter((child) => child !== overlay);
    const buttons = [...overlay.querySelectorAll('[data-entry]')];
    buttons.at(-1).focus();
    overlay.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    return {
      role: document.querySelector('#daily-card')?.getAttribute('role'),
      modal: document.querySelector('#daily-card')?.getAttribute('aria-modal'),
      backgroundInert: background.every((child) => child.inert),
      wrappedFocus: document.activeElement?.dataset.entry === 'beginner',
    };
  })()`);
  if (welcomeFocus.role !== 'dialog' || welcomeFocus.modal !== 'true' ||
      !welcomeFocus.backgroundInert || !welcomeFocus.wrappedFocus) {
    throw new Error(`欢迎层焦点范围或背景隔离异常：${JSON.stringify(welcomeFocus)}`);
  }
  const welcomeAxTree = await client.send('Accessibility.getFullAXTree');
  const welcomeAxNodes = welcomeAxTree.nodes || [];
  const welcomeDialog = welcomeAxNodes.find((node) => node.role?.value === 'dialog');
  const backgroundExploreButton = welcomeAxNodes.some((node) =>
    node.role?.value === 'button' && node.name?.value === '探索',
  );
  if (!welcomeDialog?.name?.value?.includes('从看见卦象') || backgroundExploreButton) {
    throw new Error(`欢迎层可访问性树未隔离背景：${JSON.stringify({
      dialog: welcomeDialog?.name?.value,
      backgroundExploreButton,
    })}`);
  }

  await mouseClick(client, '[data-entry="explore"]');
  await waitFor(() => client.evaluate('document.querySelector("#daily-overlay").hidden === true'), '今日卦入口未关闭');
  await waitFor(() => client.evaluate('document.activeElement?.id === "star-canvas"'), '欢迎层关闭后未将焦点交还星图');
  await assertNoChineseOrphans(client, '1280x720 探索');
  await screenshot(client, '1280x720-overview');
  await pickRenderedStar(client);
  await assertReadingStage(client, 'none');
  if (await client.evaluate('document.querySelector("#detail-panel").classList.contains("open")')) throw new Error('鼠标点击星点绕过聚焦打开了正文');
  await mouseClick(client, '#focus-clear');
  await waitFor(() => client.evaluate('document.querySelector("#star-focus-summary").hidden'), '聚焦未返回全景');

  const navigation = await client.evaluate(`(() => ({
    modes: [...document.querySelectorAll('.mode-btn')].map((button) => button.dataset.mode),
    hasLegacyGuaxuMode: Boolean(document.querySelector('.mode-btn[data-mode="guaxu"]')),
    guaxuToolRight: document.querySelector('[data-explore-tool="guaxu"]').getBoundingClientRect().right,
    viewportRight: innerWidth,
  }))()`);
  if (navigation.modes.join(',') !== 'almanac,explore,learning,review,quiz,divination') {
    throw new Error('主导航顺序不符合黄历优先的产品约定');
  }
  if (navigation.hasLegacyGuaxuMode || navigation.viewportRight - navigation.guaxuToolRight > 180) {
    throw new Error('卦序入口未正确迁移到星图右上角');
  }

  const modeAuditSelectors = {
    almanac: '.almanac-view',
    learning: '.learning-tabs',
    review: '.review-panel',
    quiz: '.quiz-panel',
  };
  for (const [mode, selector] of Object.entries(modeAuditSelectors)) {
    await client.evaluate(`document.querySelector('.mode-btn[data-mode="${mode}"]').click()`);
    await waitFor(() => client.evaluate(`document.querySelector(${JSON.stringify(selector)}) !== null`), `${mode} 模块未加载`);
    await assertNoChineseOrphans(client, `1280x720 ${mode}`);
  }

  const audioPreference = await client.evaluate(`(() => {
    const button = document.querySelector('#audio-toggle');
    button.click();
    const muted = { pressed: button.getAttribute('aria-pressed'), stored: localStorage.getItem('yijing-interface-sound') };
    button.click();
    return {
      muted,
      enabled: { pressed: button.getAttribute('aria-pressed'), stored: localStorage.getItem('yijing-interface-sound') },
    };
  })()`);
  if (audioPreference.muted.pressed !== 'false' || audioPreference.muted.stored !== 'off' ||
      audioPreference.enabled.pressed !== 'true' || audioPreference.enabled.stored !== 'on') {
    throw new Error('界面音效开关未正确持久化');
  }

  await client.evaluate('document.querySelector(".mode-btn[data-mode=divination]").click()');
  await waitFor(() => client.evaluate('document.querySelector(".coin-cast") !== null'), '占筮模块未加载');
  await assertNoChineseOrphans(client, '1280x720 占筮');
  await client.evaluate('document.querySelector(".coin-cast").click()');
  const coinInterpretation = await waitFor(() => client.evaluate(`(() => {
    const panel = document.querySelector('.coin-result .divine-interpretation');
    if (!panel) return null;
    return {
      insights: panel.querySelectorAll('.divine-insight-grid article').length,
      source: panel.querySelector('.divine-evidence-card small')?.textContent,
      hasBoundary: panel.querySelector('.divine-method-caveat')?.textContent.includes('方法边界'),
    };
  })()`), '金钱卦未生成完整解释');
  if (coinInterpretation.insights !== 3 || !coinInterpretation.source?.includes('《周易·') || !coinInterpretation.hasBoundary) {
    throw new Error('金钱卦解释缺少处境、典籍出处或方法边界');
  }
  const analysisRecord = await client.evaluate(`(() => {
    const result = document.querySelector('.coin-result');
    result.querySelectorAll('[data-analysis-dimension]').forEach((input) => { input.checked = true; });
    result.querySelector('.divine-analysis-submit').click();
    const state = JSON.parse(localStorage.getItem('yijing.achievements.v1') || '{}');
    return {
      status: result.querySelector('.divine-analysis-status')?.textContent || '',
      analyses: Object.keys(state.metrics?.analyses || {}).length,
    };
  })()`);
  if (!analysisRecord.status.includes('100') || analysisRecord.analyses !== 1) {
    throw new Error(`占筮研读未写入成就证据：${JSON.stringify(analysisRecord)}`);
  }

  await client.evaluate('document.querySelector("[data-sub=meihua]").click()');
  await waitFor(() => client.evaluate('document.querySelector(".mh-cast") !== null'), '梅花易数页未加载');
  await assertNoChineseOrphans(client, '1280x720 梅花易数', '.divine-panel');
  await client.evaluate('document.querySelector(".mh-cast").click()');
  await waitFor(() => client.evaluate(`(() => {
    const panel = document.querySelector('.mh-result .divine-interpretation');
    return panel?.textContent.includes('按八取卦') && panel.textContent.includes('体卦');
  })()`), '梅花易数未说明起卦公式与体用术语');
  const invalidMeihua = await client.evaluate(`(() => {
    const input = document.querySelector('.mh-upper');
    input.value = '-1';
    document.querySelector('.mh-cast').click();
    return {
      message: document.querySelector('.mh-error')?.textContent || '',
      invalid: input.getAttribute('aria-invalid'),
    };
  })()`);
  if (!invalidMeihua.message.includes('安全整数') || invalidMeihua.invalid !== 'true') {
    throw new Error(`非法梅花输入未显示可恢复错误：${JSON.stringify(invalidMeihua)}`);
  }
  await client.evaluate(`(() => {
    document.querySelector('.mh-upper').value = '1';
    document.querySelector('.mh-lower').value = '2';
    document.querySelector('.mh-cast').click();
  })()`);
  await waitFor(() => client.evaluate('document.querySelector(".mh-result .divine-interpretation") !== null'), '修正梅花输入后未恢复起卦');
  await client.evaluate('document.querySelector(".mode-btn[data-mode=explore]").click()');
  await waitFor(() => client.evaluate('document.querySelector("#star-canvas")?.hidden === false'), '占筮后未返回星图');

  const classicLayouts = await client.evaluate(`(() => {
    const select = document.querySelector('#star-layout-mode');
    const source = document.querySelector('#star-layout-source');
    const description = document.querySelector('#star-layout-description');
    const autoRotate = document.querySelector('#auto-rotate');
    const results = [];
    for (const mode of ['earlier-heaven', 'king-wen', 'eight-palaces', 'twelve-messages']) {
      select.value = mode;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      results.push({
        mode,
        source: source.textContent,
        description: description.textContent,
        disabled: autoRotate.disabled,
        count: document.querySelectorAll('#star-accessible-list [data-code]').length,
      });
    }
    select.value = 'project';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    return {
      results,
      projectEnabled: !autoRotate.disabled,
      projectDescription: description.textContent,
    };
  })()`);
  if (classicLayouts.results.some((item) => !item.source || !item.description || !item.disabled)) {
    throw new Error(`经典图式缺少来源、说明或固定方位约束：${JSON.stringify(classicLayouts.results)}`);
  }
  if (classicLayouts.results.find((item) => item.mode === 'earlier-heaven')?.count !== 8 ||
      classicLayouts.results.find((item) => item.mode === 'twelve-messages')?.count !== 12 ||
      !classicLayouts.projectEnabled || !classicLayouts.projectDescription.includes('项目')) {
    throw new Error(`经典图式可见卦数或项目布局回退异常：${JSON.stringify(classicLayouts)}`);
  }

  await client.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
  });
  await client.evaluate('document.querySelector("[data-explore-tool=guaxu]").click()');
  await waitFor(() => client.evaluate('document.querySelector(".guaxu-overlay.open") !== null'), '卦序转盘未居中打开');
  await assertNoChineseOrphans(client, '1280x720 卦序', '.guaxu-overlay');
  await client.evaluate('document.querySelector(".guaxu-spin").click()');
  const guaxuResult = await waitFor(() => client.evaluate(`(() => {
    const selected = document.querySelectorAll('.guaxu-wheel-sector.selected').length;
    const title = document.querySelector('#guaxu-result-title')?.textContent?.trim();
    const openButton = document.querySelector('[data-guaxu-open]');
    return selected === 1 && title && openButton ? { selected, title } : null;
  })()`), '卦序转盘未生成唯一抽取结果');
  if (!guaxuResult.title) throw new Error('卦序结果摘要缺少卦名');
  await client.evaluate('document.querySelector("[data-guaxu-open]").click()');
  await waitFor(() => client.evaluate('document.querySelector("#detail-panel").classList.contains("open") && location.search.includes("hex=")'), '卦序结果无法打开完整详解');
  await mouseClick(client, '#reading-back');
  await client.send('Emulation.setEmulatedMedia', { features: [] });

  const learningEvidence = await client.evaluate(`({
    read: JSON.parse(localStorage.getItem('yijing.achievements.v1') || '{}').metrics?.hexagramsRead || [],
    review: localStorage.getItem('yijing-review-cards'),
  })`);
  await searchByInput(client, '乾');
  await assertReadingStage(client, 'none');
  if (await client.evaluate('document.querySelector("#detail-panel").classList.contains("open") || location.search.includes("hex=")')) {
    throw new Error('搜索聚焦不应直接打开正式研读或生成深链接');
  }
  const beforeCancelledSearch = await client.evaluate(`({
    name: document.querySelector('[data-focus-name]').textContent,
    relation: document.querySelector('#star-relation-status').textContent,
  })`);
  await mouseClick(client, '#search');
  await pressKey(client, 'a', { modifiers: 2 });
  await client.send('Input.insertText', { text: '坤' });
  await pressKey(client, 'ArrowDown');
  await pressKey(client, 'Escape');
  const afterCancelledSearch = await client.evaluate(`({
    name: document.querySelector('[data-focus-name]').textContent,
    relation: document.querySelector('#star-relation-status').textContent,
    visible: !document.querySelector('#star-focus-summary').hidden,
    closed: document.querySelector('#search-results').hidden,
  })`);
  if (!afterCancelledSearch.visible || !afterCancelledSearch.closed || beforeCancelledSearch.name !== afterCancelledSearch.name || beforeCancelledSearch.relation !== afterCancelledSearch.relation) {
    throw new Error(`搜索取消改写原聚焦或关系：${JSON.stringify({ before: beforeCancelledSearch, after: afterCancelledSearch })}`);
  }
  await screenshot(client, '1280x720-focus');
  await mouseClick(client, '#relation-toggle');
  await waitFor(() => client.evaluate('document.querySelector("#relation-toggle").getAttribute("aria-expanded") === "true" && !document.querySelector("#relation-options").hidden'), '关系工具未展开');
  await mouseClick(client, '[data-relation-layer="changing"]');
  await mouseClick(client, '[data-changing-position="2"]');
  await waitFor(() => client.evaluate(`document.querySelector('[data-changing-position="2"]').getAttribute('aria-pressed') === 'true'`), '真实鼠标未选中第二动爻');
  await mouseClick(client, '[data-relation-layer="opposite"]');
  await mouseClick(client, '#relation-toggle');
  await waitFor(() => client.evaluate('document.querySelector("#relation-options").hidden'), '关系工具未收起');
  await mouseClick(client, '#focus-read');
  await assertReadingStage(client, 'quick', { modal: false });
  await assertReadingGeometry(client, '桌面快读', 0.46);
  const quickEvidence = await client.evaluate(`({
    read: JSON.parse(localStorage.getItem('yijing.achievements.v1') || '{}').metrics?.hexagramsRead || [],
    review: localStorage.getItem('yijing-review-cards'),
  })`);
  if (JSON.stringify(quickEvidence) !== JSON.stringify(learningEvidence)) throw new Error('聚焦或快读提前写入深读成就/复习卡');
  await screenshot(client, '1280x720-quick');
  await mouseClick(client, '[data-reading-tab="lines"]');
  await assertReadingSection(client, 'lines');
  if (!await client.evaluate('document.querySelector(".yao-item").dataset.linePosition === "1"')) throw new Error('六爻正文未从初爻开始');
  await mouseClick(client, '[data-reading-tab="commentary"]');
  await assertReadingSection(client, 'commentary');
  await mouseClick(client, '[data-reading-tab="overview"]');
  await mouseClick(client, '#note-input');
  await client.send('Input.insertText', { text: '烟测草稿：初爻至上爻，快读与深读共用。' });
  const beforeWheel = await client.evaluate('document.querySelector("#detail-panel").scrollTop');
  const wheelPoint = await client.evaluate(`(() => {
    const panel = document.querySelector('#detail-panel').getBoundingClientRect();
    return { x: panel.left + 20, y: panel.bottom - 30 };
  })()`);
  await client.send('Input.dispatchMouseEvent', { type: 'mouseWheel', ...wheelPoint, deltaX: 0, deltaY: Math.min(-80, 480 - beforeWheel) });
  await waitFor(() => client.evaluate(`Math.abs(document.querySelector('#detail-panel').scrollTop - ${beforeWheel}) > 1`), '真实滚轮未滚动阅读容器');
  await stablePanelScroll(client);
  await client.evaluate(`(() => {
    window.__smokeReadingInput = document.querySelector('#note-input');
    window.__smokeReadingScroll = document.querySelector('#detail-panel').scrollTop;
  })()`);
  if (!await client.evaluate('window.__smokeReadingScroll > 0')) throw new Error('滚动保留验收未取得真实非零阅读位置');
  await mouseClick(client, '#reading-deepen');
  await assertReadingStage(client, 'deep', { modal: true });
  await assertReadingGeometry(client, '桌面深读');
  await waitFor(() => client.evaluate('Math.abs(document.querySelector("#detail-panel").scrollTop - window.__smokeReadingScroll) < 2'), '快读升级深读没有恢复真实滚动位置');
  const reusedReading = await client.evaluate(`(() => ({
    sameInput: window.__smokeReadingInput === document.querySelector('#note-input'),
    draft: document.querySelector('#note-input').value,
    scroll: document.querySelector('#detail-panel').scrollTop,
    expectedScroll: window.__smokeReadingScroll,
    read: JSON.parse(localStorage.getItem('yijing.achievements.v1') || '{}').metrics?.hexagramsRead || [],
    layout: localStorage.getItem('yijing-panel-layout'),
    size: localStorage.getItem('yijing-drawer-size'),
  }))()`);
  if (!reusedReading.sameInput || !reusedReading.draft.includes('烟测草稿') || Math.abs(reusedReading.scroll - reusedReading.expectedScroll) > 2) {
    throw new Error(`快读升级深读丢失正文、草稿或滚动：${JSON.stringify(reusedReading)}`);
  }
  if (reusedReading.read.filter(code => code === '111111').length !== 1 || reusedReading.layout !== 'left' || reusedReading.size !== 'large') {
    throw new Error(`深读计数或旧布局偏好兼容异常：${JSON.stringify(reusedReading)}`);
  }
  const historyLength = await client.evaluate('history.length');
  await client.evaluate('history.back()');
  await assertReadingStage(client, 'quick', { modal: false });
  await client.evaluate('history.forward()');
  await assertReadingStage(client, 'deep', { modal: true });
  if (await client.evaluate('history.length') !== historyLength) throw new Error('前进后退重复写入历史');
  if (!await client.evaluate('window.__smokeReadingInput === document.querySelector("#note-input") && document.querySelector("#note-input").value.includes("烟测草稿")')) {
    throw new Error('浏览器前进后退重建了正文或丢失草稿');
  }
  await waitFor(() => client.evaluate('document.querySelector("#detail-panel").getBoundingClientRect().top >= -1'), '深读动画未完成');
  const pausedDrawing = await drawDelta(client);
  if (pausedDrawing.star !== 0 || pausedDrawing.celestial !== 0) throw new Error(`深读时背景仍持续绘制：${JSON.stringify(pausedDrawing)}`);
  await mouseClick(client, '[data-reading-tab="overview"]');
  await screenshot(client, '1280x720-deep');
  await assertNoChineseOrphans(client, '1280x720 卦象详情');
  await client.evaluate('document.querySelector(".rel-demo-btn").click()');
  const relationCount = await client.evaluate(`(() => {
    const state = JSON.parse(localStorage.getItem('yijing.achievements.v1') || '{}');
    return state.metrics?.relationsExamined?.length || 0;
  })()`);
  if (relationCount < 1) throw new Error('关系演示未写入成就证据');
  await client.evaluate('document.querySelector(".rel-anim-close")?.click()');

  await client.evaluate('document.querySelector(".share-hexagram").click()');
  const shareCard = await waitFor(() => client.evaluate(`(() => {
    const image = document.querySelector('.share-card-preview img');
    if (!image?.complete || !image.naturalWidth) return null;
    return {
      width: image.naturalWidth,
      height: image.naturalHeight,
      sendVisible: !document.querySelector('.share-card-send')?.hidden,
      downloadText: document.querySelector('.share-card-download')?.textContent,
    };
  })()`), '分享图片未生成或预览未加载');
  if (shareCard.width !== 1080 || shareCard.height !== 1440 || !shareCard.downloadText?.includes('下载')) {
    throw new Error('分享图片尺寸或下载操作不符合约定');
  }
  await client.evaluate('document.querySelector(".share-card-close").click()');
  await waitFor(() => client.evaluate('document.querySelector(".share-card-overlay") === null'), '分享图片预览未关闭');

  await client.evaluate('document.querySelector(".evolution-launch").click()');
  await waitFor(() => client.evaluate('document.querySelector(".evolution-overlay.open") !== null'), '卦象演变实验室未打开');
  await assertNoChineseOrphans(client, '1280x720 演变实验室', '.evolution-overlay');
  await client.evaluate(`document.querySelector('[data-evolution-line="1"]').click()`);
  await waitFor(() => client.evaluate('document.querySelector(".evolution-result figcaption span")?.textContent.includes("011111")'), '实验室逐爻变化结果错误');
  await client.evaluate('document.querySelector("[data-evolution-action=undo]").click()');
  await waitFor(() => client.evaluate('document.querySelector(".evolution-result figcaption span")?.textContent.includes("111111")'), '实验室撤销失败');
  await client.evaluate('document.querySelector("[data-evolution-action=redo]").click()');
  await waitFor(() => client.evaluate('document.querySelector(".evolution-result figcaption span")?.textContent.includes("011111")'), '实验室重做失败');
  await client.evaluate('document.querySelector("[data-evolution-preset=opposite]").click()');
  await waitFor(() => client.evaluate('document.querySelector(".evolution-result figcaption span")?.textContent.includes("000000")'), '实验室错卦预设失败');
  await client.evaluate(`(() => {
    const speed = document.querySelector('[data-evolution-speed]');
    speed.value = 'fast';
    speed.dispatchEvent(new Event('change', { bubbles: true }));
    document.querySelector('[data-evolution-playback="previous"]').click();
  })()`);
  await waitFor(() => client.evaluate('document.querySelector(".evolution-result figcaption span")?.textContent.includes("000001")'), '实验室上一步演示失败');
  await client.evaluate('document.querySelector("[data-evolution-playback=next]").click()');
  await waitFor(() => client.evaluate('document.querySelector(".evolution-result figcaption span")?.textContent.includes("000000")'), '实验室下一步演示失败');
  await client.evaluate('document.querySelector("[data-evolution-playback=play]").click()');
  await waitFor(() => client.evaluate(`document.querySelector('.evolution-result figcaption span')?.textContent.includes('111111')
    && document.querySelector('[data-evolution-playback=play]')?.textContent.includes('暂停')`), '实验室播放未从原卦开始');
  await client.evaluate('document.querySelector("[data-evolution-playback=play]").click()');
  await waitFor(() => client.evaluate('document.querySelector("[data-evolution-playback=play]")?.textContent.includes("播放")'), '实验室暂停失败');
  await client.evaluate('document.querySelector("[data-evolution-playback=next]").click()');
  await waitFor(() => client.evaluate('document.querySelector(".evolution-result figcaption span")?.textContent.includes("011111")'), '实验室暂停后单步失败');
  await client.evaluate('document.querySelector("[data-evolution-playback=play]").click()');
  await waitFor(() => client.evaluate(`document.querySelector('.evolution-result figcaption span')?.textContent.includes('000000')
    && document.querySelector('[data-evolution-playback=play]')?.textContent.includes('播放')`), '实验室自动播放未完成');
  await client.evaluate('document.querySelector(".evolution-close").click()');
  await mouseClick(client, '#reading-quicken');
  await assertReadingStage(client, 'quick', { modal: false });
  await assertReadingGeometry(client, '桌面快读', 0.46);
  const resumedDrawing = await drawDelta(client);
  if (resumedDrawing.star < 1) throw new Error(`返回快读后星图未恢复绘制：${JSON.stringify(resumedDrawing)}`);
  const readingPreferences = await client.evaluate(`({
    layout: localStorage.getItem('yijing-panel-layout'),
    size: localStorage.getItem('yijing-drawer-size'),
    sameInput: window.__smokeReadingInput === document.querySelector('#note-input'),
    draft: document.querySelector('#note-input').value,
    read: JSON.parse(localStorage.getItem('yijing.achievements.v1') || '{}').metrics?.hexagramsRead || [],
  })`);
  if (readingPreferences.layout !== 'left' || readingPreferences.size !== 'large' || !readingPreferences.sameInput || !readingPreferences.draft.includes('烟测草稿')) {
    throw new Error(`返回快读改写旧偏好或丢失正文草稿：${JSON.stringify(readingPreferences)}`);
  }
  if (readingPreferences.read.filter(code => code === '111111').length !== 1) throw new Error('切换快读重复记录深读成就');
  await mouseClick(client, '#reading-deepen');
  await assertReadingStage(client, 'deep', { modal: true });

  await client.evaluate('document.querySelector(".rel-demo-btn").click()');
  await waitFor(() => client.evaluate('document.querySelector(".rel-anim-overlay.open") !== null'), '关系动画浮层未打开');
  await client.evaluate('document.querySelector(".rel-anim-play").click()');
  await waitFor(
    () => client.evaluate('document.querySelector(".rel-anim-play")?.disabled === false && document.querySelector(".rel-anim-hint")?.textContent.includes("完成")'),
    '关系动画未正常结束或播放按钮未恢复',
  );
  await client.evaluate('document.querySelector(".rel-anim-close").click()');

  await client.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1024, deviceScaleFactor: 1, mobile: false });
  await assertReadingGeometry(client, '1440x1024 深读');
  await assertNoChineseOrphans(client, '1440x1024 卦象详情');
  await screenshot(client, '1440x1024-deep');
  await mouseClick(client, '#reading-quicken');
  await assertReadingStage(client, 'quick', { modal: false });
  await assertReadingGeometry(client, '1440x1024 快读', 0.46);
  await screenshot(client, '1440x1024-quick');
  // 兼容已存在的桌面工具展开状态；resize 后必须交回阅读模态的背景隔离权。
  await client.evaluate('document.querySelector("#relation-toggle").click()');
  await client.send('Emulation.setDeviceMetricsOverride', { width: 768, height: 1024, deviceScaleFactor: 1, mobile: true });
  await assertReadingStage(client, 'quick', { modal: true });
  await assertReadingGeometry(client, '桌面快读转窄屏', 0.75);
  await waitFor(() => client.evaluate('document.querySelector("#relation-options").hidden && !document.querySelector("#detail-panel").inert && !document.querySelector("#reading-back").closest("[inert]")'), '桌面快读工具展开后缩到窄屏发生背景 inert 互锁');
  await client.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
  await touchTap(client, '#reading-back');
  await assertReadingStage(client, 'none');
  await touchTap(client, '#focus-read');
  await assertReadingStage(client, 'quick', { modal: true });
  await assertReadingGeometry(client, '768x1024 快读', 0.75);
  await screenshot(client, '768x1024-quick');
  await touchTap(client, '#reading-deepen');
  await assertReadingStage(client, 'deep', { modal: true });
  await waitFor(() => client.evaluate('[...document.querySelectorAll(".reading-disclosure")].length === 2 && [...document.querySelectorAll(".reading-disclosure")].every(details => !details.open)'), '切到窄屏后目录与出处未默认折叠');
  await waitFor(() => client.evaluate('document.querySelector("#detail-panel").getAttribute("aria-modal") === "true"'), '平板详情栏未切换为模态');
  await waitFor(() => client.evaluate(`(() => {
    const panel = document.querySelector('#detail-panel').getBoundingClientRect();
    return Math.abs(panel.width - innerWidth) < 2 && Math.abs(panel.height - innerHeight) < 2 && Math.abs(panel.top) < 2;
  })()`), '平板详情全屏动画未完成');
  const tabletPanel = await client.evaluate(`(() => {
    const panel = document.querySelector('#detail-panel').getBoundingClientRect();
    return { width: panel.width, top: panel.top, viewportWidth: innerWidth };
  })()`);
  if (Math.abs(tabletPanel.width - tabletPanel.viewportWidth) > 2 || Math.abs(tabletPanel.top) > 2) throw new Error('平板详情栏不是全屏阅读布局');
  await assertNoChineseOrphans(client, '768x1024 卦象详情');
  await screenshot(client, '768x1024-deep');
  await touchTap(client, '#reading-back');
  const tabletHeader = await client.evaluate(`(() => {
    const bar = document.querySelector('.topbar').getBoundingClientRect();
    const buttons = [...document.querySelectorAll('.mode-btn')].map((button) => button.getBoundingClientRect());
    return { height: bar.height, rows: new Set(buttons.map((rect) => Math.round(rect.top))).size };
  })()`);
  if (tabletHeader.height > 140 || tabletHeader.rows !== 1) throw new Error('平板导航未保持紧凑单行');

  await client.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  const mobileHeader = await client.evaluate(`(() => {
    const nav = document.querySelector('#mode-switcher');
    const buttons = [...nav.querySelectorAll('.mode-btn')].map((button) => button.getBoundingClientRect());
    const navRect = nav.getBoundingClientRect();
    return {
      headerHeight: document.querySelector('.topbar').getBoundingClientRect().height,
      navHeight: navRect.height,
      navBounds: { left: navRect.left, right: navRect.right, top: navRect.top, bottom: navRect.bottom },
      buttonBounds: buttons.map(rect => ({ left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, height: rect.height })),
      rows: new Set(buttons.map((rect) => Math.round(rect.top))).size,
      scrollable: nav.scrollWidth > nav.clientWidth,
      allVisible: buttons.every((rect) => rect.left >= navRect.left - 1 && rect.right <= navRect.right + 1
        && rect.top >= navRect.top - 1 && rect.bottom <= navRect.bottom + 1),
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  })()`);
  if (mobileHeader.headerHeight > 140 || mobileHeader.navHeight > 52 || mobileHeader.rows !== 1) {
    throw new Error(`手机顶部六入口未形成紧凑单行布局：${JSON.stringify(mobileHeader)}`);
  }
  await screenshot(client, '390x844-overview');
  if (mobileHeader.scrollable || !mobileHeader.allVisible) throw new Error(`手机顶部导航仍依赖横向滚动或存在屏外入口：${JSON.stringify(mobileHeader)}`);
  if (mobileHeader.buttonBounds.some(rect => rect.height < 44)) throw new Error('手机导航触控目标低于 44px');
  if (mobileHeader.overflow) throw new Error('390px 视口出现页面级横向溢出');

  if (!await client.evaluate('document.querySelector("#star-focus-summary").hidden')) await touchTap(client, '#focus-clear');
  await screenshot(client, '390x844-overview');
  if (await client.evaluate('document.querySelector("#relation-options").hidden')) await touchTap(client, '#relation-toggle');
  if (!await client.evaluate('document.querySelector(".star-text-relations").open')) await touchTap(client, '.star-text-relations summary');
  await touchTap(client, '#star-accessible-list [data-code="111111"]');
  const mobileRelations = await client.evaluate(`(() => {
    const header = document.querySelector('.topbar').getBoundingClientRect();
    const panel = document.querySelector('#relation-layers').getBoundingClientRect();
    return {
      status: document.querySelector('#star-relation-status').textContent,
      autoRotate: document.querySelector('#auto-rotate').getAttribute('aria-pressed'),
      panelTop: panel.top,
      panelRight: panel.right,
      headerBottom: header.bottom,
      viewportWidth: innerWidth,
    };
  })()`);
  if (!mobileRelations.status.includes('乾 · 错卦') || mobileRelations.autoRotate !== 'false') {
    throw new Error('手机文字关系列表未能聚焦卦象或停止自动巡天');
  }
  if (mobileRelations.panelTop < mobileRelations.headerBottom || mobileRelations.panelRight > mobileRelations.viewportWidth + 1) {
    throw new Error('手机关系分层器与导航重叠或超出视口');
  }
  if (!await client.evaluate('document.querySelector("#relation-options").hidden')) await touchTap(client, '#relation-toggle');
  await touchTap(client, '#focus-clear');
  await pickRenderedStar(client, { touch: true });
  const focusedBeforeDrag = await client.evaluate('document.querySelector("[data-focus-name]").textContent');
  const dragPoints = await client.evaluate(`(() => {
    const canvas = document.querySelector('#star-canvas');
    const rect = canvas.getBoundingClientRect();
    for (let y = rect.top + 60; y < rect.bottom - 80; y += 60) {
      for (let x = 40; x < innerWidth - 120; x += 40) {
        if (document.elementFromPoint(x, y) === canvas && document.elementFromPoint(x + 80, y) === canvas) {
          return { from: { x, y }, to: { x: x + 80, y } };
        }
      }
    }
    return null;
  })()`);
  if (!dragPoints) throw new Error('手机没有可拖动的可见星图区域');
  const angleBeforeDrag = await client.evaluate('document.querySelector("[data-view-angle]").textContent');
  await touchDrag(client, dragPoints.from, dragPoints.to);
  await waitFor(() => client.evaluate(`document.querySelector('[data-view-angle]').textContent !== ${JSON.stringify(angleBeforeDrag)}`), '手机拖动没有改变星图视角');
  if (await client.evaluate(`document.querySelector('[data-focus-name]').textContent !== ${JSON.stringify(focusedBeforeDrag)} || document.body.dataset.readingStage !== 'none'`)) {
    throw new Error('超过 6px 的触控拖动误选了卦象或打开正文');
  }
  await screenshot(client, '390x844-focus');
  await searchByInput(client, '坤');
  await touchTap(client, '#focus-read');
  await assertReadingStage(client, 'quick', { modal: true });
  await assertReadingGeometry(client, '手机快读', 0.75);
  await assertNoChineseOrphans(client, '390x844 快读');
  await screenshot(client, '390x844-quick');
  await touchTap(client, '#reading-deepen');
  await assertReadingStage(client, 'deep', { modal: true });
  await waitFor(() => client.evaluate(`(() => {
    const panel = document.querySelector('#detail-panel').getBoundingClientRect();
    return Math.abs(panel.width - innerWidth) < 2 && Math.abs(panel.height - innerHeight) < 2 && Math.abs(panel.top) < 2;
  })()`), '手机详情全屏动画未完成');
  const mobilePanel = await client.evaluate(`(() => {
    const panel = document.querySelector('#detail-panel').getBoundingClientRect();
    return {
      width: panel.width,
      top: panel.top,
      ariaModal: document.querySelector('#detail-panel').getAttribute('aria-modal'),
      sections: document.querySelectorAll('.detail-section').length,
      viewportWidth: innerWidth,
    };
  })()`);
  if (Math.abs(mobilePanel.width - mobilePanel.viewportWidth) > 2 || Math.abs(mobilePanel.top) > 2) throw new Error('手机详情不是全屏阅读布局');
  if (mobilePanel.ariaModal !== 'true' || mobilePanel.sections < 5) throw new Error('手机详情语义或内容分组异常');
  await assertNoChineseOrphans(client, '390x844 卦象详情');
  await screenshot(client, '390x844-deep');
  await client.evaluate('document.querySelector(".evolution-launch").click()');
  await waitFor(() => client.evaluate('document.querySelector(".evolution-overlay.open") !== null'), '手机演变实验室未打开');
  const mobileLab = await client.evaluate(`(() => {
    const card = document.querySelector('.evolution-card').getBoundingClientRect();
    return {
      width: card.width,
      height: card.height,
      viewportWidth: innerWidth,
      viewportHeight: innerHeight,
      lineCount: document.querySelectorAll('[data-evolution-line]').length,
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  })()`);
  if (Math.abs(mobileLab.width - mobileLab.viewportWidth) > 2 || Math.abs(mobileLab.height - mobileLab.viewportHeight) > 2) throw new Error('手机演变实验室不是全屏布局');
  if (mobileLab.lineCount !== 6 || mobileLab.overflow) throw new Error('手机演变实验室交互或宽度异常');
  await client.evaluate(`document.querySelector('[data-evolution-line="6"]').click()`);
  await waitFor(() => client.evaluate('document.querySelectorAll(".evolution-line.changed").length === 1'), '手机演变实验室逐爻操作失败');
  await client.evaluate('document.querySelector(".evolution-close").click()');
  await touchTap(client, '#reading-back');

  await client.evaluate('document.querySelector(".mode-btn[data-mode=learning]").click()');
  await waitFor(() => client.evaluate('document.querySelector(".learning-tabs") !== null'), '学习模式未渲染');
  await client.evaluate('document.querySelector("[data-section=path]").click()');
  await waitFor(() => client.evaluate('document.querySelectorAll(".learning-dashboard > div").length === 5'), '学习仪表板未渲染');
  await assertNoChineseOrphans(client, '390x844 学程');

  await client.evaluate('document.querySelector(".learning-tab").focus()');
  await pressKey(client, 'ArrowRight');
  const learningKeyboard = await client.evaluate(`(() => {
    return {
      active: document.activeElement?.id,
      selected: document.activeElement?.getAttribute('aria-selected'),
    };
  })()`);
  if (learningKeyboard.active !== 'learning-tab-path' || learningKeyboard.selected !== 'true') {
    throw new Error(`学习页签键盘切换异常：${JSON.stringify(learningKeyboard)}`);
  }

  await mouseClick(client, '#detail-close');
  await searchByInput(client, '乾', { keyboard: true });
  await client.evaluate('document.querySelector("#focus-read").focus()');
  await pressKey(client, 'Enter');
  await assertReadingStage(client, 'quick', { modal: true });
  await client.evaluate('document.querySelector("#reading-deepen").focus()');
  await pressKey(client, 'Enter');
  await assertReadingStage(client, 'deep', { modal: true });
  const detailAxTree = await client.send('Accessibility.getFullAXTree');
  const detailDialog = (detailAxTree.nodes || []).find((node) =>
    node.role?.value === 'dialog' && !node.ignored && Boolean(node.name?.value),
  );
  if (!detailDialog) {
    const dialogs = (detailAxTree.nodes || [])
      .filter((node) => node.role?.value === 'dialog')
      .map((node) => ({ name: node.name?.value || '', ignored: node.ignored }));
    throw new Error(`详情打开后未出现在可访问性树中：${JSON.stringify(dialogs)}`);
  }
  await pressKey(client, 'Escape');
  await assertReadingStage(client, 'quick', { modal: true });
  await pressKey(client, 'Escape');
  await assertReadingStage(client, 'none');
  await waitFor(() => client.evaluate('!document.querySelector("#star-focus-summary").hidden && !document.querySelector("#detail-panel").classList.contains("open")'), '第二次 Escape 未返回聚焦');
  await pressKey(client, 'Escape');
  await waitFor(() => client.evaluate('document.querySelector("#star-focus-summary").hidden'), '第三次 Escape 未返回全景');

  await client.evaluate('document.querySelector(".mode-btn[data-mode=quiz]").click()');
  await waitFor(() => client.evaluate('document.querySelectorAll(".quiz-option").length > 0'), '测验选项未渲染');
  await client.evaluate('document.querySelector(".quiz-option").focus()');
  const quizFocus = await client.evaluate(`(() => ({
    tag: document.activeElement?.tagName,
    className: document.activeElement?.className,
    disabled: document.activeElement?.disabled,
  }))()`);
  if (!String(quizFocus.className).split(/\s+/).includes('quiz-option') || quizFocus.disabled) {
    throw new Error(`测验选项未获得键盘焦点：${JSON.stringify(quizFocus)}`);
  }
  await client.send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key: 'Enter',
    code: 'Enter',
    text: '\r',
    unmodifiedText: '\r',
    windowsVirtualKeyCode: 13,
    nativeVirtualKeyCode: 13,
  });
  await client.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await waitFor(
    () => client.evaluate('document.querySelector(".quiz-feedback .quiz-next") !== null'),
    `测验无法用键盘提交：${JSON.stringify(quizFocus)}`,
  );
  await client.evaluate('document.querySelector(".mode-btn[data-mode=learning]").click()');
  await waitFor(() => client.evaluate('document.querySelector(".learning-tabs") !== null'), '键盘验收后学习模式未恢复');
  await client.evaluate('document.querySelector("[data-section=path]").click()');
  await waitFor(() => client.evaluate('document.querySelectorAll(".learning-dashboard > div").length === 5'), '键盘验收后学习页未恢复');

  const overflow = await client.evaluate('document.documentElement.scrollWidth > document.documentElement.clientWidth');
  if (overflow) throw new Error('390px 视口出现横向溢出');

  await client.send('Emulation.setDeviceMetricsOverride', { width: 320, height: 844, deviceScaleFactor: 1, mobile: true });
  const compactMobile = await client.evaluate(`(() => {
    const nav = document.querySelector('#mode-switcher');
    const buttons = [...nav.querySelectorAll('.mode-btn')].map((button) => button.getBoundingClientRect());
    const navRect = nav.getBoundingClientRect();
    return {
      rows: new Set(buttons.map((rect) => Math.round(rect.top))).size,
      allVisible: buttons.every((rect) => rect.left >= navRect.left - 1 && rect.right <= navRect.right + 1
        && rect.top >= navRect.top - 1 && rect.bottom <= navRect.bottom + 1),
      minTargetHeight: Math.min(...buttons.map(rect => rect.height)),
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  })()`);
  if (compactMobile.rows !== 1 || !compactMobile.allVisible || compactMobile.overflow || compactMobile.minTargetHeight < 44) {
    throw new Error(`320px 视口布局异常：${JSON.stringify(compactMobile)}`);
  }
  await screenshot(client, '320x844-learning');
  await mouseClick(client, '#detail-close');
  await searchByInput(client, '渐', { keyboard: true });
  await client.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await waitFor(() => client.evaluate('matchMedia("(prefers-reduced-motion: reduce)").matches'), '减少动态效果偏好未生效');
  await client.evaluate('document.querySelector("#star-canvas").focus()');
  await drawDelta(client);
  await drawDelta(client);
  const reducedBefore = await client.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  await drawDelta(client);
  const reducedAfter = await client.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  if (reducedBefore.data !== reducedAfter.data || await client.evaluate('document.querySelector("#auto-rotate").getAttribute("aria-pressed") !== "false"')) {
    throw new Error('减少动态效果时静止画面仍变化，或自动巡天未停止');
  }
  await touchTap(client, '#focus-read');
  await assertReadingStage(client, 'quick', { modal: true });
  await assertReadingGeometry(client, '320px 减少动态快读', 0.75);
  await assertNoChineseOrphans(client, '320x844 减少动态快读');
  await screenshot(client, '320x844-reduced-motion-quick');
  await touchTap(client, '#reading-deepen');
  await assertReadingStage(client, 'deep', { modal: true });
  await assertReadingGeometry(client, '320px 减少动态深读');
  await assertNoChineseOrphans(client, '320x844 减少动态深读');
  await screenshot(client, '320x844-reduced-motion-deep');
  await touchTap(client, '#reading-back');
  await client.send('Emulation.setEmulatedMedia', { features: [] });
  await mouseClick(client, '.mode-btn[data-mode="learning"]');
  await waitFor(() => client.evaluate('document.querySelector(".learning-tabs") !== null'), '减少动态验收后学习模式未恢复');

  await client.send('Emulation.setDeviceMetricsOverride', { width: 640, height: 844, deviceScaleFactor: 1, mobile: false });
  const zoomEquivalent = await client.evaluate(`(() => ({
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    navOverflow: document.querySelector('#mode-switcher').scrollWidth > document.querySelector('#mode-switcher').clientWidth,
    searchWidth: document.querySelector('#search').getBoundingClientRect().width,
  }))()`);
  if (zoomEquivalent.overflow || zoomEquivalent.navOverflow || zoomEquivalent.searchWidth < 180) {
    throw new Error(`640 CSS 像素等效缩放布局异常：${JSON.stringify(zoomEquivalent)}`);
  }

  await mouseClick(client, '#detail-close');
  await client.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1024, deviceScaleFactor: 1, mobile: false });
  await client.send('Emulation.setTouchEmulationEnabled', { enabled: false });
  for (const [name, slug] of [['渐', 'jian'], ['乾', 'qian'], ['坤', 'kun']]) {
    await mouseClick(client, '#zoom-reset');
    await searchByInput(client, name);
    await waitFor(() => client.evaluate('document.querySelector("#zoom-level").textContent === "100%"'), '星图缩放未恢复100%');
    await drawDelta(client);
    await drawDelta(client);
    await screenshot(client, `1440x1024-${slug}-100`);
    for (let zoom = 0; zoom < 3; zoom += 1) await mouseClick(client, '#zoom-in');
    await waitFor(() => client.evaluate('document.querySelector("#zoom-level").textContent === "195%"'), `${name}星图未放大到约195%`);
    await drawDelta(client);
    await screenshot(client, `1440x1024-${slug}-195`);
    await mouseClick(client, '#zoom-in');
    await waitFor(() => client.evaluate('document.querySelector("#zoom-level").textContent === "244%"'), `${name}星图未放大到约244%`);
    await drawDelta(client);
    await screenshot(client, `1440x1024-${slug}-244`);
  }
  await mouseClick(client, '#focus-clear');
  await mouseClick(client, '#zoom-reset');
  await client.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await client.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });

  await client.send('Network.enable');
  await waitFor(
    () => client.evaluate('navigator.serviceWorker?.ready.then((registration) => Boolean(registration.active))'),
    'Service Worker 未完成安装',
    30000,
  );
  if (!await client.evaluate('Boolean(navigator.serviceWorker?.controller)')) {
    await client.send('Page.reload', { ignoreCache: true });
    await waitFor(
      () => client.evaluate('document.querySelector("#loading")?.hidden === true && Boolean(navigator.serviceWorker?.controller)'),
      'Service Worker 未接管页面',
      30000,
    );
  }

  await client.send('Network.emulateNetworkConditions', {
    offline: true,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1,
    connectionType: 'none',
  });
  await client.send('Page.reload', { ignoreCache: true });
  await waitFor(
    () => client.evaluate('document.querySelector("#loading")?.hidden === true && Boolean(navigator.serviceWorker?.controller)'),
    '断网重开后页面没有恢复',
    30000,
  );
  const offlineReload = await client.evaluate(`(() => {
    const input = document.querySelector('#search');
    input.value = '乾';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return {
      loadingHidden: document.querySelector('#loading')?.hidden === true,
      controller: Boolean(navigator.serviceWorker?.controller),
      canvas: Boolean(document.querySelector('#star-canvas')),
      overviewEntries: document.querySelectorAll('#star-accessible-list [data-code]').length,
      searchResults: document.querySelectorAll('.search-option').length,
    };
  })()`);
  await client.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1,
    connectionType: 'wifi',
  });
  if (!offlineReload.loadingHidden || !offlineReload.controller || !offlineReload.canvas ||
      offlineReload.overviewEntries < 1 || offlineReload.searchResults < 1) {
    throw new Error(`断网重开后核心页面不完整：${JSON.stringify(offlineReload)}`);
  }

  const fallbackErrorStart = client.events.length;
  const fallbackScript = await client.send('Page.addScriptToEvaluateOnNewDocument', { source: `(() => {
    const originalContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type, ...options) {
      if (String(type).includes('webgl')) return null;
      return originalContext.call(this, type, ...options);
    };
  })();` });
  await client.send('Page.navigate', { url: `${siteUrl}?hex=001011` });
  await waitFor(() => client.evaluate('document.querySelector("#loading")?.hidden === true && document.body.dataset.readingStage === "deep" && location.search === "?hex=001011"'), '旧六位编码深链接无法直接进入深读');
  await assertReadingStage(client, 'deep', { modal: true });
  if (await client.evaluate('document.querySelectorAll(".yao-item").length') !== 6) throw new Error('禁用 WebGL 后深链接缺少六爻正文');
  await touchTap(client, '#reading-back');
  await mouseClick(client, '#star-canvas');
  await waitFor(() => client.evaluate('document.body.classList.contains("celestial-fallback")'), 'WebGL 不可用时未进入 Canvas 降级路径');
  await searchByInput(client, '乾', { keyboard: true });
  await touchTap(client, '#focus-read');
  await assertReadingStage(client, 'quick', { modal: true });
  await touchTap(client, '#reading-deepen');
  await assertReadingStage(client, 'deep', { modal: true });
  await assertNoChineseOrphans(client, '390x844 WebGL 降级深读');
  await screenshot(client, '390x844-no-webgl-deep');
  await touchTap(client, '#reading-back');
  if (!await client.evaluate(`location.origin === ${JSON.stringify(new URL(siteUrl).origin)} && !location.search.includes('hex=')`)) {
    throw new Error('直接深链接退出后离开了站点或保留错误深读链接');
  }
  await client.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: fallbackScript.identifier });

  const seriousErrors = client.events.filter((event, index) => {
    if (event.method === 'Runtime.exceptionThrown') return true;
    if (event.method !== 'Log.entryAdded' || event.params.entry.level !== 'error') return false;
    return index < fallbackErrorStart || !event.params.entry.text.includes('Error creating WebGL context');
  });
  if (seriousErrors.length) throw new Error(`浏览器捕获 ${seriousErrors.length} 个脚本错误`);
  console.log('✓ Chromium 1440×1024 / 1280×720 / 768×1024 / 390×844 / 320×844 布局、鼠标/键盘/触控研读、减少动态与 WebGL 降级通过');
  if (process.env.YIJING_SMOKE_NATIVE_ZOOM === '1') await verifyNativeBrowserZoom(browserPath, siteUrl);
} finally {
  client?.close();
  await stopProcess(browser);
  await stopProcess(server);
  try {
    rmSync(profileDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  } catch (error) {
    console.warn(`浏览器临时目录清理失败，将由系统回收：${error.message}`);
  }
}
