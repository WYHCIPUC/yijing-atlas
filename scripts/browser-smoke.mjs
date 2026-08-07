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
  }, '浏览器页面启动超时');

  client = new CdpClient(target.webSocketDebuggerUrl);
  await client.open();
  await client.send('Runtime.enable');
  await client.send('Log.enable');
  await client.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  await waitFor(() => client.evaluate('document.querySelector("#loading")?.hidden === true'), '应用初始化超时');

  await client.evaluate(`(() => {
    const overlay = document.querySelector('#daily-overlay');
    if (!overlay.hidden) document.querySelector('#daily-enter').click();
    return true;
  })()`);
  await waitFor(() => client.evaluate('document.querySelector("#daily-overlay").hidden === true'), '今日卦入口未关闭');

  const resultCount = await client.evaluate(`(() => {
    const input = document.querySelector('#search');
    input.value = '乾';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return document.querySelectorAll('.search-option').length;
  })()`);
  if (resultCount < 1) throw new Error('搜索没有返回结果');
  await client.evaluate('document.querySelector(".search-option").click()');
  await waitFor(() => client.evaluate('document.querySelector("#detail-panel").classList.contains("open") && location.search.includes("hex=")'), '详情深链接未打开');

  await client.evaluate('document.querySelector(".evolution-launch").click()');
  await waitFor(() => client.evaluate('document.querySelector(".evolution-overlay.open") !== null'), '卦象演变实验室未打开');
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
    const controls = document.querySelector('.zoom-controls').getBoundingClientRect();
    return controls.right < panel.left;
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
  await waitFor(() => client.evaluate('document.querySelector("#detail-panel").dataset.layout === "bottom"'), '详情栏未切回底部');

  await client.evaluate('document.querySelector(".rel-demo-btn").click()');
  await waitFor(() => client.evaluate('document.querySelector(".rel-anim-overlay.open") !== null'), '关系动画浮层未打开');
  await client.evaluate('document.querySelector(".rel-anim-play").click()');
  await waitFor(
    () => client.evaluate('document.querySelector(".rel-anim-play")?.disabled === false && document.querySelector(".rel-anim-hint")?.textContent.includes("完成")'),
    '关系动画未正常结束或播放按钮未恢复',
  );
  await client.evaluate('document.querySelector(".rel-anim-close").click()');

  await client.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await waitFor(() => client.evaluate(`(() => {
    const panel = document.querySelector('#detail-panel').getBoundingClientRect();
    const canvas = document.querySelector('#star-canvas').getBoundingClientRect();
    return Math.abs(canvas.height + panel.height - innerHeight) < 2;
  })()`), '宽屏底部布局高度动画未完成');
  const wideLayout = await client.evaluate(`(() => {
    const panel = document.querySelector('#detail-panel').getBoundingClientRect();
    const canvas = document.querySelector('#star-canvas').getBoundingClientRect();
    return { panelWidth: panel.width, panelHeight: panel.height, canvasWidth: canvas.width, canvasHeight: canvas.height, viewportWidth: innerWidth, viewportHeight: innerHeight };
  })()`);
  if (Math.abs(wideLayout.panelWidth - wideLayout.viewportWidth) > 2 || Math.abs(wideLayout.canvasWidth - wideLayout.viewportWidth) > 2) throw new Error('宽屏底部布局宽度错误');
  if (Math.abs(wideLayout.canvasHeight + wideLayout.panelHeight - wideLayout.viewportHeight) > 2) throw new Error('宽屏底部布局高度错误');

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
    return {
      headerHeight: document.querySelector('.topbar').getBoundingClientRect().height,
      navHeight: nav.getBoundingClientRect().height,
      rows: new Set(buttons.map((rect) => Math.round(rect.top))).size,
      scrollable: nav.scrollWidth > nav.clientWidth,
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  })()`);
  if (mobileHeader.headerHeight > 132 || mobileHeader.navHeight > 54 || mobileHeader.rows !== 1) throw new Error('手机顶部导航发生换行或高度异常');
  if (!mobileHeader.scrollable) throw new Error('手机顶部导航未启用横向滚动');
  if (mobileHeader.overflow) throw new Error('390px 视口出现页面级横向溢出');

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
  await waitFor(() => client.evaluate('document.querySelectorAll(".learning-dashboard > div").length === 5'), '学习仪表板未渲染');
  const overflow = await client.evaluate('document.documentElement.scrollWidth > document.documentElement.clientWidth');
  if (overflow) throw new Error('390px 视口出现横向溢出');

  const seriousErrors = client.events.filter((event) => event.method === 'Runtime.exceptionThrown' ||
    (event.method === 'Log.entryAdded' && event.params.entry.level === 'error'));
  if (seriousErrors.length) throw new Error(`浏览器捕获 ${seriousErrors.length} 个脚本错误`);
  console.log('✓ Chromium 1440/1280/768/390px 布局与主流程烟雾测试通过');
} finally {
  client?.close();
  await stopProcess(browser);
  await stopProcess(server);
  rmSync(profileDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
}
