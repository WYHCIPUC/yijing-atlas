import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
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
  await client.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  await waitFor(() => client.evaluate('document.querySelector("#loading")?.hidden === true'), '应用初始化超时');
  await assertNoChineseOrphans(client, '1280x720 欢迎页');

  await client.evaluate(`(() => {
    const overlay = document.querySelector('#daily-overlay');
    const exploreEntry = document.querySelector('[data-entry="explore"]');
    if (!overlay.hidden) {
      if (!exploreEntry) throw new Error('探索星图入口不存在');
      exploreEntry.click();
    }
    return true;
  })()`);
  await waitFor(() => client.evaluate('document.querySelector("#daily-overlay").hidden === true'), '今日卦入口未关闭');
  await assertNoChineseOrphans(client, '1280x720 探索');

  const navigation = await client.evaluate(`(() => ({
    modes: [...document.querySelectorAll('.mode-btn')].map((button) => button.dataset.mode),
    hasLegacyGuaxuMode: Boolean(document.querySelector('[data-mode="guaxu"]')),
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
    await client.evaluate(`document.querySelector('[data-mode="${mode}"]').click()`);
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

  await client.evaluate('document.querySelector("[data-mode=divination]").click()');
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

  await client.evaluate('document.querySelector("[data-sub=meihua]").click()');
  await waitFor(() => client.evaluate('document.querySelector(".mh-cast") !== null'), '梅花易数页未加载');
  await assertNoChineseOrphans(client, '1280x720 梅花易数', '.divine-panel');
  await client.evaluate('document.querySelector(".mh-cast").click()');
  await waitFor(() => client.evaluate(`(() => {
    const panel = document.querySelector('.mh-result .divine-interpretation');
    return panel?.textContent.includes('按八取卦') && panel.textContent.includes('体卦');
  })()`), '梅花易数未说明起卦公式与体用术语');
  await client.evaluate('document.querySelector("[data-mode=explore]").click()');
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
  await client.evaluate('document.querySelector("#detail-close").click()');
  await client.send('Emulation.setEmulatedMedia', { features: [] });

  const resultCount = await client.evaluate(`(() => {
    const input = document.querySelector('#search');
    input.value = '乾';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return document.querySelectorAll('.search-option').length;
  })()`);
  if (resultCount < 1) throw new Error('搜索没有返回结果');
  await client.evaluate('document.querySelector(".search-option").click()');
  await waitFor(() => client.evaluate('document.querySelector("#detail-panel").classList.contains("open") && location.search.includes("hex=")'), '详情深链接未打开');
  await assertNoChineseOrphans(client, '1280x720 卦象详情');

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
  await client.evaluate(`(() => {
    const select = document.querySelector('#detail-layout');
    select.value = 'bottom';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  await waitFor(() => client.evaluate(`(() => {
    const panel = document.querySelector('#detail-panel').getBoundingClientRect();
    const canvas = document.querySelector('#star-canvas').getBoundingClientRect();
    return Math.abs(panel.top - canvas.bottom) < 2;
  })()`), '桌面底部详情抽屉动画未完成');

  const desktopLayout = await client.evaluate(`(() => {
    const panel = document.querySelector('#detail-panel').getBoundingClientRect();
    const canvas = document.querySelector('#star-canvas').getBoundingClientRect();
    const controls = document.querySelector('.zoom-controls').getBoundingClientRect();
    return {
      panelWidth: panel.width,
      panelHeight: panel.height,
      panelTop: panel.top,
      panelBottom: panel.bottom,
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      canvasBottom: canvas.bottom,
      controlsBottom: controls.bottom,
      layout: document.querySelector('#detail-layout').value,
      columns: getComputedStyle(document.querySelector('#detail-content')).gridTemplateColumns.split(' ').length,
      ariaModal: document.querySelector('#detail-panel').getAttribute('aria-modal'),
      viewportWidth: innerWidth,
      viewportHeight: innerHeight,
    };
  })()`);
  if (Math.abs(desktopLayout.panelWidth - desktopLayout.viewportWidth) > 2) throw new Error('桌面底部抽屉未横向铺满');
  if (desktopLayout.panelHeight < 330 || desktopLayout.panelHeight > 470) throw new Error('桌面底部抽屉默认高度越界');
  if (Math.abs(desktopLayout.canvasHeight + desktopLayout.panelHeight - desktopLayout.viewportHeight) > 2) throw new Error('底部抽屉未与星图形成上下分区');
  if (desktopLayout.layout !== 'bottom' || desktopLayout.columns !== 2) throw new Error('底部抽屉未使用默认双栏阅读布局');
  if (desktopLayout.controlsBottom >= desktopLayout.canvasBottom) throw new Error('底部抽屉遮挡了星图控件');
  if (desktopLayout.ariaModal !== 'false') throw new Error('桌面分栏不应声明为模态对话框');

  await client.evaluate('document.querySelector("#detail-size").click()');
  await waitFor(() => client.evaluate(`document.querySelector('#detail-panel').getBoundingClientRect().height > ${desktopLayout.panelHeight + 40}`), '底部抽屉高度未切换');
  const drawerPreference = await client.evaluate(`({
    size: document.querySelector('#detail-panel').dataset.drawerSize,
    stored: localStorage.getItem('yijing-drawer-size'),
  })`);
  if (drawerPreference.size !== 'large' || drawerPreference.stored !== 'large') throw new Error('底部抽屉高度偏好未保存');

  await client.evaluate(`(() => {
    const select = document.querySelector('#detail-layout');
    select.value = 'left';
    select.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  await waitFor(() => client.evaluate(`(() => {
    const panel = document.querySelector('#detail-panel').getBoundingClientRect();
    const canvas = document.querySelector('#star-canvas').getBoundingClientRect();
    return Math.abs(panel.right - canvas.left) < 2;
  })()`), '详情面板未切换到左侧');

  await client.evaluate(`(() => {
    const select = document.querySelector('#detail-layout');
    select.value = 'right';
    select.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  await waitFor(() => client.evaluate(`(() => {
    const panel = document.querySelector('#detail-panel').getBoundingClientRect();
    const canvas = document.querySelector('#star-canvas').getBoundingClientRect();
    const controls = document.querySelector('.zoom-controls').getBoundingClientRect();
    return Math.abs(canvas.left) < 2
      && Math.abs(panel.left - canvas.width) < 2
      && controls.right < panel.left;
  })()`), '切换右侧后星图控件未完成避让');
  const rightLayout = await client.evaluate(`(() => {
    const panel = document.querySelector('#detail-panel').getBoundingClientRect();
    const canvas = document.querySelector('#star-canvas').getBoundingClientRect();
    const controls = document.querySelector('.zoom-controls').getBoundingClientRect();
    return {
      panelLeft: panel.left,
      canvasLeft: canvas.left,
      canvasWidth: canvas.width,
      controlsRight: controls.right,
      stored: localStorage.getItem('yijing-panel-layout'),
    };
  })()`);
  if (Math.abs(rightLayout.canvasLeft) > 2 || Math.abs(rightLayout.panelLeft - rightLayout.canvasWidth) > 2) throw new Error('详情栏未切换到右侧');
  if (rightLayout.controlsRight >= rightLayout.panelLeft) throw new Error('右侧详情栏遮挡了星图控件');
  if (rightLayout.stored !== 'right') throw new Error('详情栏位置偏好未保存');
  await client.evaluate(`(() => {
    const select = document.querySelector('#detail-layout');
    select.value = 'bottom';
    select.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  await waitFor(() => client.evaluate(`(() => {
    const panel = document.querySelector('#detail-panel').getBoundingClientRect();
    const canvas = document.querySelector('#star-canvas').getBoundingClientRect();
    return document.querySelector('#detail-panel').dataset.layout === 'bottom'
      && Math.abs(panel.top - canvas.bottom) < 2;
  })()`), '详情栏未切回底部');

  await client.evaluate('document.querySelector(".rel-demo-btn").click()');
  await waitFor(() => client.evaluate('document.querySelector(".rel-anim-overlay.open") !== null'), '关系动画浮层未打开');
  await client.evaluate('document.querySelector(".rel-anim-play").click()');
  await waitFor(
    () => client.evaluate('document.querySelector(".rel-anim-play")?.disabled === false && document.querySelector(".rel-anim-hint")?.textContent.includes("完成")'),
    '关系动画未正常结束或播放按钮未恢复',
  );
  await client.evaluate('document.querySelector(".rel-anim-close").click()');

  await client.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1024, deviceScaleFactor: 1, mobile: false });
  await waitFor(() => client.evaluate(`(() => {
    const panel = document.querySelector('#detail-panel').getBoundingClientRect();
    const canvas = document.querySelector('#star-canvas').getBoundingClientRect();
    return Math.abs(panel.width - innerWidth) < 2
      && Math.abs(canvas.width - innerWidth) < 2
      && Math.abs(canvas.height + panel.height - innerHeight) < 2;
  })()`), '宽屏底部布局高度动画未完成');
  const wideLayout = await client.evaluate(`(() => {
    const panel = document.querySelector('#detail-panel').getBoundingClientRect();
    const canvas = document.querySelector('#star-canvas').getBoundingClientRect();
    return { panelWidth: panel.width, panelHeight: panel.height, canvasWidth: canvas.width, canvasHeight: canvas.height, viewportWidth: innerWidth, viewportHeight: innerHeight };
  })()`);
  if (Math.abs(wideLayout.panelWidth - wideLayout.viewportWidth) > 2 || Math.abs(wideLayout.canvasWidth - wideLayout.viewportWidth) > 2) throw new Error('宽屏底部布局宽度错误');
  if (Math.abs(wideLayout.canvasHeight + wideLayout.panelHeight - wideLayout.viewportHeight) > 2) throw new Error('宽屏底部布局高度错误');
  await assertNoChineseOrphans(client, '1440x1024 卦象详情');

  await client.send('Emulation.setDeviceMetricsOverride', { width: 768, height: 1024, deviceScaleFactor: 1, mobile: true });
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
  await client.evaluate('document.querySelector("#detail-close").click()');
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
      rows: new Set(buttons.map((rect) => Math.round(rect.top))).size,
      scrollable: nav.scrollWidth > nav.clientWidth,
      allVisible: buttons.every((rect) => rect.left >= navRect.left - 1 && rect.right <= navRect.right + 1
        && rect.top >= navRect.top - 1 && rect.bottom <= navRect.bottom + 1),
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  })()`);
  if (mobileHeader.headerHeight > 180 || mobileHeader.navHeight > 104 || mobileHeader.rows !== 2) {
    throw new Error(`手机顶部导航未形成紧凑的三列两行布局：${JSON.stringify(mobileHeader)}`);
  }
  if (mobileHeader.scrollable || !mobileHeader.allVisible) throw new Error('手机顶部导航仍依赖横向滚动或存在屏外入口');
  if (mobileHeader.overflow) throw new Error('390px 视口出现页面级横向溢出');

  const mobileRelations = await client.evaluate(`(() => {
    document.querySelector('#trail-clear').click();
    const details = document.querySelector('.star-text-relations');
    if (!details.open) details.querySelector('summary').click();
    document.querySelector('#star-accessible-list [data-code="111111"]').click();
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

  const mobileResultCount = await client.evaluate(`(() => {
    const input = document.querySelector('#search');
    input.value = '坤';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return document.querySelectorAll('.search-option').length;
  })()`);
  if (mobileResultCount < 1) throw new Error('手机端搜索没有返回结果');
  await client.evaluate('document.querySelector(".search-option").click()');
  await waitFor(() => client.evaluate('document.querySelector("#detail-panel").classList.contains("open")'), '手机详情未打开');
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
  await client.evaluate('document.querySelector("#detail-close").click()');

  await client.evaluate('document.querySelector("[data-mode=learning]").click()');
  await waitFor(() => client.evaluate('document.querySelector(".learning-tabs") !== null'), '学习模式未渲染');
  await client.evaluate('document.querySelector("[data-section=path]").click()');
  await waitFor(() => client.evaluate('document.querySelectorAll(".learning-dashboard > div").length === 5'), '学习仪表板未渲染');
  await assertNoChineseOrphans(client, '390x844 学程');
  const overflow = await client.evaluate('document.documentElement.scrollWidth > document.documentElement.clientWidth');
  if (overflow) throw new Error('390px 视口出现横向溢出');

  const seriousErrors = client.events.filter((event) => event.method === 'Runtime.exceptionThrown' ||
    (event.method === 'Log.entryAdded' && event.params.entry.level === 'error'));
  if (seriousErrors.length) throw new Error(`浏览器捕获 ${seriousErrors.length} 个脚本错误`);
  console.log('✓ Chromium 1440×1024 / 1280×720 / 768×1024 / 390×844 布局与主流程烟雾测试通过');
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
