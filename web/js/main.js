// 易象图谱入口：只负责数据初始化、全局状态与模式调度。
import {
  bindInterfaceSounds,
  isSoundEnabled,
  playHexagramSound,
  playInterfaceSound,
  setSoundEnabled,
} from './audio-engine.js';
import * as dataLoader from './data-loader.js';
import { closeEvolutionLab, showEvolutionLab } from './evolution-lab.js';
import { deliverShareImage, generateHexagramShareImage } from './share-card.js';
import { closeGuaxuWheel, showGuaxuWheel } from './modes/guaxu-mode.js';
import { initCelestialStage } from './celestial-stage.js';
import { initCinematicMotion } from './cinematic-motion.js';
import { initMotionSystem } from './motion-system.js';
import { renderHexagramDetail } from './render.js';
import { addReviewCard } from './review-engine.js';
import { getHexCodeFromUrl, moveSelection, withHexCode } from './search-controller.js';
import { buildRelationGraph } from './star-relations.js';
import { describeStarView, StarMap } from './star-map.js';
import { hexagramSvg } from './svg-painter.js';

const { buildHexagramIndex, searchHexagrams } = dataLoader;

const modeLoaders = {
  almanac: () => import('./almanac-page.js?v=48').then((module) => module.renderAlmanacPage),
  divination: () => import('./modes/divination-mode.js?v=48').then((module) => module.renderDivinationMode),
  learning: () => import('./modes/learning-mode.js?v=48').then((module) => module.renderLearningMode),
  quiz: () => import('./modes/quiz-mode.js?v=48').then((module) => module.renderQuizMode),
  review: () => import('./modes/review-mode.js?v=48').then((module) => module.renderReviewMode),
};

const state = {
  hexagrams: [],
  trigrams: [],
  wings: [],
  theorems: [],
  almanacTerms: [],
  almanacYiji: {},
  index: null,
  starMap: null,
  celestialStage: null,
  currentDetail: null,
  currentMode: 'explore',
  commentaryReleaseReady: false,
};

const loadingEl = document.getElementById('loading');
const canvas = document.getElementById('star-canvas');
const celestialCanvas = document.getElementById('celestial-canvas');
const panel = document.getElementById('detail-panel');
const panelContent = document.getElementById('detail-content');
const panelLayoutSelect = document.getElementById('detail-layout');
const panelSizeButton = document.getElementById('detail-size');
const searchInput = document.getElementById('search');
const searchResultsEl = document.getElementById('search-results');
const dailyOverlay = document.getElementById('daily-overlay');
const modeSwitcher = document.getElementById('mode-switcher');
const exploreTools = document.getElementById('explore-tools');
const audioToggle = document.getElementById('audio-toggle');
const hintEl = document.getElementById('hint');
const viewLevelEl = hintEl?.querySelector('[data-view-level]');
const viewAngleEl = hintEl?.querySelector('[data-view-angle]');
const viewRotationEl = hintEl?.querySelector('[data-view-rotation]');
const relationLayersEl = document.getElementById('relation-layers');
const relationStatusEl = document.getElementById('star-relation-status');
const relationListEl = document.getElementById('star-accessible-list');
const changingPositionsEl = relationLayersEl?.querySelector('.changing-position-buttons');
const starLayoutSelect = document.getElementById('star-layout-mode');
const starLayoutSource = document.getElementById('star-layout-source');
const starLayoutDescription = document.getElementById('star-layout-description');
const autoRotateButton = document.getElementById('auto-rotate');
const workspaceInsightBar = document.querySelector('.workspace-insight-bar');
const compactPanelQuery = window.matchMedia('(max-width: 900px)');
const motionSystem = initMotionSystem();
const cinematicMotion = initCinematicMotion({ panel, panelContent });
let modeRequestId = 0;
let panelReturnFocus = null;
let searchResults = [];
let searchIndex = -1;
let lastViewHudKey = '';

const DAILY_SEEN_KEY = 'yijing-daily-seen';
const PANEL_LAYOUT_KEY = 'yijing-panel-layout';
const DRAWER_SIZE_KEY = 'yijing-drawer-size';
const DRAWER_SIZES = ['compact', 'medium', 'large'];
const FOCUS_MODES = new Set(['learning', 'review', 'quiz']);
const WORKSPACE_MODES = new Set(['almanac', 'learning', 'review', 'quiz', 'divination']);
const WORKSPACE_INSIGHTS = {
  almanac: [
    ['今日历法', '把节气、干支与宜忌放回时间现场'],
    ['阅读方法', '先辨日期，再看节气与建除'],
    ['核心能力', '辨时 · 识名 · 明边界'],
    ['每日建议', '5 分钟'],
  ],
  learning: [
    ['本课对应卦象', '乾为天 · 坤为地'],
    ['学习目标', '理解阴阳是万物变化的根源'],
    ['核心能力', '观象 · 察变 · 明理'],
    ['推荐专注时长', '25 分钟'],
  ],
  review: [
    ['今日温故', '先忆象，再对经，后自评'],
    ['记忆方法', '主动提取，而非重复浏览'],
    ['核心能力', '提取 · 核对 · 自评'],
    ['每卦建议', '2 分钟'],
  ],
  quiz: [
    ['即时小试', '用判断暴露真正的薄弱点'],
    ['错题去向', '自动进入温故队列'],
    ['核心能力', '辨象 · 纠错 · 回炉'],
    ['每题建议', '60 秒'],
  ],
  divination: [
    ['文化演练', '从经文理解处境与变化'],
    ['研读次序', '定问 · 起卦 · 读经'],
    ['使用边界', '辅助反思，不替代现实判断'],
    ['一次建议', '8 分钟'],
  ],
};

function updateWorkspaceInsight(mode) {
  const insight = WORKSPACE_INSIGHTS[mode];
  if (!workspaceInsightBar || !insight) return;
  workspaceInsightBar.classList.remove('is-updating');
  const labels = workspaceInsightBar.querySelectorAll('[data-insight-label]');
  const values = workspaceInsightBar.querySelectorAll('[data-insight-value]');
  insight.forEach(([label, value], index) => {
    labels[index].textContent = label;
    values[index].textContent = value;
  });
  void workspaceInsightBar.offsetWidth;
  workspaceInsightBar.classList.add('is-updating');
}

function syncStarViewHud(view) {
  if (!hintEl || !viewLevelEl || !viewAngleEl || !view) return;
  const description = describeStarView(view);
  const key = `${description.level}:${description.zoomPercent}:${description.yawDegrees}:${description.pitchDegrees}:${description.rotationText}`;
  if (key === lastViewHudKey) return;
  lastViewHudKey = key;
  viewLevelEl.textContent = description.level;
  viewAngleEl.textContent = `${description.angleText} · ${description.zoomPercent}%`;
  if (viewRotationEl) viewRotationEl.textContent = description.rotationText;
  hintEl.style.setProperty('--view-bearing', `${-view.yaw}rad`);
}

const RELATION_NAMES = { opposite: '错卦', reversed: '综卦', interlocking: '互卦', changing: '变卦' };
const RELATION_BADGES = { opposite: '错', reversed: '综', interlocking: '互', changing: '变' };

function updateAutoRotateButton(active = false) {
  if (!autoRotateButton) return;
  const fixedClassicLayout = autoRotateButton.disabled;
  autoRotateButton.setAttribute('aria-pressed', String(active));
  autoRotateButton.setAttribute('aria-label', fixedClassicLayout ? '经典图式保持固定方位' : (active ? '停止自动巡天' : '开启自动巡天'));
  autoRotateButton.title = fixedClassicLayout ? '经典图式保持固定方位' : (active ? '停止自动巡天' : '开启自动巡天');
  autoRotateButton.classList.toggle('active', active);
}

function layoutEntryMeta(layoutState, code) {
  if (layoutState?.mode === 'eight-palaces') {
    for (const group of layoutState.groups || []) {
      const entry = group.entries?.find((item) => item.code === code);
      if (entry) return `${group.name} · ${entry.stage}`;
    }
  }
  if (layoutState?.mode === 'twelve-messages') {
    const entry = layoutState.groups?.find((item) => item.code === code);
    if (entry) return `${entry.month} · ${entry.phase}`;
  }
  if (layoutState?.mode === 'earlier-heaven') {
    const entry = layoutState.groups?.find((item) => item.code === code);
    if (entry) return `${entry.direction}方`;
  }
  const hexagram = state.index?.byCode.get(code);
  if (layoutState?.mode === 'king-wen' && hexagram) return `第 ${hexagram.number} 卦`;
  return '';
}

function updateLayoutInterface(layoutState = state.starMap?.getLayoutState?.()) {
  if (!layoutState || !starLayoutSelect || !starLayoutDescription || !starLayoutSource) return;
  starLayoutSelect.value = layoutState.mode;
  starLayoutSource.textContent = layoutState.sourceType;
  starLayoutDescription.textContent = layoutState.description;
  const fixedClassicLayout = layoutState.mode !== 'project';
  autoRotateButton.disabled = fixedClassicLayout;
  canvas.setAttribute('aria-label', `${layoutState.label}，可选择卦象并查看当前关系层`);
  updateAutoRotateButton(state.starMap?.isAutoRotating());
}

function updateRelationInterface(relationState = {}) {
  if (!relationLayersEl || !relationListEl || !relationStatusEl) return;
  const type = relationState.type || 'opposite';
  const position = relationState.changingPosition || null;
  relationLayersEl.querySelectorAll('[data-relation-layer]').forEach((button) => {
    const active = button.dataset.relationLayer === type;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  changingPositionsEl.hidden = type !== 'changing';
  changingPositionsEl.querySelectorAll('[data-changing-position]').forEach((button) => {
    const active = Number(button.dataset.changingPosition) === position;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });

  if (!relationState.code) {
    relationStatusEl.textContent = `${RELATION_NAMES[type]}层 · 总览仅显示八卦锚点`;
    const layoutState = state.starMap?.getLayoutState?.();
    const codes = layoutState?.mode && layoutState.mode !== 'project'
      ? layoutState.visibleCodes
      : state.hexagrams.filter((hexagram) => hexagram.binaryCode.slice(0, 3) === hexagram.binaryCode.slice(3)).map((hexagram) => hexagram.binaryCode);
    const overviewHexagrams = codes.map((code) => state.index?.byCode.get(code)).filter(Boolean);
    relationStatusEl.textContent = `${layoutState?.shortLabel || '易象银河'} · ${RELATION_NAMES[type]}层 · ${overviewHexagrams.length} 个可选卦`;
    relationListEl.innerHTML = overviewHexagrams.map((hexagram) => {
      const meta = layoutEntryMeta(layoutState, hexagram.binaryCode);
      return `<li><button type="button" data-code="${hexagram.binaryCode}"><span>${hexagram.name} · ${hexagram.fullName}</span>${meta ? `<em>${meta}</em>` : ''}</button></li>`;
    }).join('');
    return;
  }

  const current = state.index?.byCode.get(relationState.code);
  if (type === 'changing' && !position) {
    relationStatusEl.textContent = `${current?.name || relationState.code} · 请先选择一条具体动爻`;
    relationListEl.innerHTML = '<li>变卦只在具体动爻条件成立后显示；请选择初、二、三、四、五或上爻。</li>';
    return;
  }
  const byTarget = new Map();
  for (const occurrence of relationState.occurrences || []) {
    if (!byTarget.has(occurrence.to)) byTarget.set(occurrence.to, []);
    byTarget.get(occurrence.to).push(occurrence);
  }
  relationStatusEl.textContent = `${current?.name || relationState.code} · ${RELATION_NAMES[type]}${position ? ` · 第 ${position} 爻动` : ''} · ${byTarget.size} 个目标`;
  relationListEl.innerHTML = byTarget.size ? [...byTarget].map(([targetCode]) => {
    const target = state.index?.byCode.get(targetCode);
    const completeTypes = [...new Set((state.starMap?.graph.occurrences || [])
      .filter((item) => item.from === relationState.code && item.to === targetCode
        && (!item.conditional || (type === 'changing' && item.changingPositions.includes(position))))
      .map((item) => item.type))];
    const badges = completeTypes.map((item) => `<small>${RELATION_BADGES[item]}</small>`).join('');
    return `<li><button type="button" data-code="${targetCode}"><span>${target?.name || targetCode} · ${target?.fullName || ''}</span><span>${badges}</span></button></li>`;
  }).join('') : '<li>当前关系层没有可显示的目标。</li>';
}

document.addEventListener('yijing:workspace-insight', (event) => {
  const insight = event.detail;
  if (!Array.isArray(insight) || insight.length !== 4) return;
  WORKSPACE_INSIGHTS.learning = insight;
  if (state.currentMode === 'learning') updateWorkspaceInsight('learning');
});

function setFocusMode(mode) {
  const focused = FOCUS_MODES.has(mode);
  const workspace = WORKSPACE_MODES.has(mode);
  panel.dataset.focus = String(focused);
  panel.dataset.presentation = workspace ? (focused ? 'study' : 'workspace') : 'detail';
  panel.dataset.mode = mode;
  document.body.classList.toggle('focus-mode', focused);
  document.body.classList.toggle('workspace-mode', workspace);
  document.body.classList.remove('lesson-overview-open');
  document.body.dataset.activeMode = mode;
  canvas.tabIndex = workspace ? -1 : 0;
  updateWorkspaceInsight(mode);
  if (workspace) {
    panel.removeAttribute('aria-labelledby');
    panel.setAttribute('aria-label', `${mode === 'almanac' ? '黄历' : mode === 'learning' ? '学习' : mode === 'review' ? '复习' : mode === 'quiz' ? '测验' : '占筮'}内容面板`);
  }
}

function resetPanelViewport({ focusHeading = false } = {}) {
  cinematicMotion.resetScroll();
  panelContent.scrollTop = 0;
  if (!focusHeading) return;
  window.requestAnimationFrame(() => {
    const heading = panelContent.querySelector('[data-page-heading], .mode-panel-title, h2, h3');
    if (!heading) return;
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
  });
}

function readPanelLayout() {
  const defaultLayout = compactPanelQuery.matches ? 'bottom' : 'left';
  try {
    const layout = localStorage.getItem(PANEL_LAYOUT_KEY);
    return ['bottom', 'left', 'right'].includes(layout) ? layout : defaultLayout;
  } catch {
    return defaultLayout;
  }
}

function readDrawerSize() {
  try {
    const size = localStorage.getItem(DRAWER_SIZE_KEY);
    return DRAWER_SIZES.includes(size) ? size : 'medium';
  } catch {
    return 'medium';
  }
}

function setPanelLayout(layout, { persist = false } = {}) {
  const nextLayout = ['bottom', 'left', 'right'].includes(layout) ? layout : 'bottom';
  panel.dataset.layout = nextLayout;
  ['bottom', 'left', 'right'].forEach((name) => {
    document.body.classList.toggle(`panel-${name}`, nextLayout === name);
  });
  panelLayoutSelect.value = nextLayout;
  if (persist) {
    try { localStorage.setItem(PANEL_LAYOUT_KEY, nextLayout); } catch {}
  }
  state.starMap?.resize();
}

function setDrawerSize(size, { persist = false } = {}) {
  const nextSize = DRAWER_SIZES.includes(size) ? size : 'medium';
  panel.dataset.drawerSize = nextSize;
  DRAWER_SIZES.forEach((name) => {
    document.body.classList.toggle(`drawer-${name}`, nextSize === name);
  });
  const labels = { compact: '紧凑', medium: '中等', large: '展开' };
  panelSizeButton.setAttribute('aria-label', `切换底部详情高度，当前：${labels[nextSize]}`);
  if (persist) {
    try { localStorage.setItem(DRAWER_SIZE_KEY, nextSize); } catch {}
  }
  state.starMap?.resize();
}

setDrawerSize(readDrawerSize());
setPanelLayout(readPanelLayout());

function getDailyHexagram(hexagrams, now = new Date()) {
  const yearStart = new Date(now.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((now - yearStart) / 86400000);
  return hexagrams[dayOfYear % 64];
}

function getDailyVerse(hex) {
  const fifthLine = hex.lines.find((line) => line.position === 5);
  if (fifthLine?.text) {
    const text = fifthLine.text.replace(/^[^：]*：/, '').replace(/。$/, '');
    return { text, source: `${hex.name}·${fifthLine.isYang ? '九五' : '六五'}` };
  }
  return {
    text: hex.judgement.replace(/^[^：]*：/, '').replace(/。$/, ''),
    source: `${hex.name}·卦辞`,
  };
}

function showDailyHexagram() {
  const hex = getDailyHexagram(state.hexagrams);
  if (!hex) return;
  state.starMap?.pause?.('welcome');
  const now = new Date();
  const verse = getDailyVerse(hex);
  document.getElementById('daily-date').textContent = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;
  document.getElementById('daily-hex-svg').innerHTML = hexagramSvg(hex.binaryCode, { size: 100 });
  document.getElementById('daily-hex-name').textContent = hex.name;
  document.getElementById('daily-hex-full').textContent = hex.fullName;
  document.getElementById('daily-verse').textContent = `「${verse.text}」`;
  document.getElementById('daily-verse-src').textContent = `—— ${verse.source}`;

  const enter = (destination) => {
    try { sessionStorage.setItem(DAILY_SEEN_KEY, '1'); } catch {}
    dailyOverlay.classList.add('hidden');
    setMode(destination === 'beginner' ? 'learning' : 'explore');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.setTimeout(() => {
      dailyOverlay.hidden = true;
      state.starMap?.resume?.('welcome');
      if (destination === 'beginner') return;
      if (destination === 'daily') openDetail(hex.binaryCode);
      else {
        state.starMap?.clearFocus?.();
        canvas.focus();
      }
    }, reducedMotion ? 0 : 180);
  };
  document.querySelector('.daily-entry-actions').addEventListener('click', (event) => {
    const button = event.target.closest('[data-entry]');
    if (!button || dailyOverlay.classList.contains('hidden')) return;
    enter(button.dataset.entry);
  });
  motionSystem.reveal(dailyOverlay);
}

function openPanel() {
  if (!panel.classList.contains('open')) panelReturnFocus = document.activeElement;
  panel.inert = false;
  panel.classList.add('open');
  panel.setAttribute('aria-hidden', 'false');
  panel.setAttribute('aria-modal', String(compactPanelQuery.matches));
  document.body.classList.add('panel-open');
  state.starMap?.resize();
  resetPanelViewport();
}

function updateDetailUrl(code, mode = 'push') {
  const next = withHexCode(window.location.href, code);
  if (next === window.location.href) return;
  window.history[mode === 'replace' ? 'replaceState' : 'pushState']({ hex: code }, '', next);
}

function closeDetail({ restoreFocus = false, resetMode = true, updateUrl = true } = {}) {
  panel.classList.remove('open');
  panel.setAttribute('aria-hidden', 'true');
  panel.inert = true;
  document.body.classList.remove('panel-open');
  state.starMap?.resize();
  state.currentDetail = null;
  if (updateUrl) updateDetailUrl(null);
  if (resetMode && state.currentMode !== 'explore') {
    state.currentMode = 'explore';
    setFocusMode('explore');
    updateModeButtons('explore');
    state.starMap?.setReviewDue(null);
    state.starMap?.setMode('explore');
  }
  if (restoreFocus) {
    const target = panelReturnFocus?.isConnected ? panelReturnFocus : canvas;
    target.focus();
  }
}

function showShareCardDialog(payload, hexagram) {
  document.querySelector('.share-card-overlay')?.remove();
  const returnFocus = document.activeElement;
  const overlay = document.createElement('div');
  overlay.className = 'share-card-overlay';
  overlay.innerHTML = `
    <section class="share-card-dialog" role="dialog" aria-modal="true" aria-labelledby="share-card-title">
      <button type="button" class="share-card-close" aria-label="关闭分享图片预览">✕</button>
      <div class="share-card-copy">
        <small>分享图片已生成</small>
        <h2 id="share-card-title" class="compound-title compound-title--hexagram" aria-label="${hexagram.name} · ${hexagram.fullName}"><span class="compound-title-primary">${hexagram.name}</span><span class="compound-title-separator" aria-hidden="true">·</span><span class="compound-title-secondary">${hexagram.fullName}</span></h2>
        <p>可先检查卡片内容，再发送给朋友或下载 PNG。</p>
      </div>
      <div class="share-card-preview"><img src="${payload.previewUrl}" alt="${hexagram.name}卦分享卡片预览"></div>
      <div class="share-card-actions">
        <button type="button" class="share-card-send">发送图片</button>
        <button type="button" class="share-card-download">下载 PNG</button>
      </div>
      <p class="share-card-status" role="status" aria-live="polite"></p>
    </section>
  `;
  document.body.appendChild(overlay);
  state.starMap?.pause?.('share');
  motionSystem.reveal(overlay);

  const closeButton = overlay.querySelector('.share-card-close');
  const sendButton = overlay.querySelector('.share-card-send');
  const downloadButton = overlay.querySelector('.share-card-download');
  const dialogStatus = overlay.querySelector('.share-card-status');
  let systemShareSupported = false;
  try {
    const file = new File([payload.blob], payload.filename, { type: 'image/png' });
    systemShareSupported = Boolean(navigator.share && navigator.canShare?.({ files: [file] }));
  } catch {}
  if (!systemShareSupported) sendButton.hidden = true;

  const close = () => {
    document.removeEventListener('keydown', onKeydown);
    overlay.remove();
    state.starMap?.resume?.('share');
    returnFocus?.focus?.();
  };
  const onKeydown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = [...overlay.querySelectorAll('button:not([disabled]):not([hidden]), [href], [tabindex]:not([tabindex="-1"])')]
      .filter((element) => element.getClientRects().length > 0);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };
  closeButton.addEventListener('click', close);
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) close();
  });
  document.addEventListener('keydown', onKeydown);
  sendButton.addEventListener('click', async () => {
    sendButton.disabled = true;
    try {
      await deliverShareImage(payload);
      close();
    } catch (error) {
      dialogStatus.textContent = error?.name === 'AbortError' ? '已取消分享' : '发送失败，请改用下载 PNG';
      sendButton.disabled = false;
    }
  });
  downloadButton.addEventListener('click', async () => {
    downloadButton.disabled = true;
    try {
      await deliverShareImage({ ...payload, navigatorRef: {} });
      close();
    } catch {
      dialogStatus.textContent = '下载失败，请稍后重试';
      downloadButton.disabled = false;
    }
  });
  closeButton.focus();
}

function bindShareAction(hexagram) {
  const button = panelContent.querySelector('.share-hexagram');
  const status = panelContent.querySelector('.share-status');
  if (!button || !status) return;
  button.addEventListener('click', async () => {
    const url = withHexCode(window.location.href, hexagram.binaryCode);
    button.disabled = true;
    button.textContent = '正在生成图片…';
    status.textContent = '';
    try {
      const payload = await generateHexagramShareImage(hexagram, url);
      showShareCardDialog(payload, hexagram);
      status.textContent = '分享图片已生成';
    } catch (error) {
      status.textContent = error?.name === 'AbortError' ? '已取消分享' : '图片生成失败，请稍后重试';
    } finally {
      button.disabled = false;
      button.textContent = '生成分享图片';
    }
  });
}

function openDetail(code, fromCode = null, { historyMode = 'push' } = {}) {
  const hex = state.index.byCode.get(code);
  if (!hex) return;
  state.currentMode = 'explore';
  setFocusMode('explore');
  updateModeButtons('explore');
  state.starMap?.setReviewDue(null);
  state.starMap?.setMode('explore');
  state.celestialStage?.setMode('explore');
  cinematicMotion.beginMode('explore');
  updateExploreTools('star');
  renderHexagramDetail(hex, panelContent, state.hexagrams, (relatedCode) => openDetail(relatedCode, code));
  panel.setAttribute('aria-labelledby', 'hexagram-detail-title');
  panel.removeAttribute('aria-label');
  if (historyMode !== 'none') updateDetailUrl(code, historyMode);
  bindShareAction(hex);
  addReviewCard(code);
  openPanel();
  motionSystem.reveal(panelContent);
  cinematicMotion.enterSurface(panelContent, 'explore');
  resetPanelViewport({ focusHeading: true });
  try { playHexagramSound(code); } catch {}
  if (fromCode) state.starMap?.addTrail(fromCode, code);
  state.currentDetail = code;
  state.starMap?.focusStar(code);
}

function updateModeButtons(mode) {
  let selectedButton = null;
  document.querySelectorAll('.mode-btn').forEach((button) => {
    const selected = button.dataset.mode === mode;
    button.classList.toggle('active', selected);
    button.setAttribute('aria-pressed', String(selected));
    button.tabIndex = selected ? 0 : -1;
    if (selected) selectedButton = button;
    if (selected && modeSwitcher.scrollWidth > modeSwitcher.clientWidth) {
      window.requestAnimationFrame(() => button.scrollIntoView({ block: 'nearest', inline: 'center' }));
    }
  });
  window.requestAnimationFrame(() => cinematicMotion.syncModeIndicator(selectedButton));
}

function updateExploreTools(selected = 'star') {
  exploreTools.hidden = state.currentMode !== 'explore';
  exploreTools.querySelectorAll('.explore-tool').forEach((button) => {
    if (button.dataset.exploreTool === 'evolution') button.hidden = !state.commentaryReleaseReady;
    const active = button.dataset.exploreTool === selected;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}

async function loadModeResources(mode) {
  if (mode === 'learning' && dataLoader.loadLearningData) {
    const resources = [dataLoader.loadLearningData()];
    if (dataLoader.loadAlmanacData) resources.push(dataLoader.loadAlmanacData());
    const [learning, almanac] = await Promise.all(resources);
    Object.assign(state, learning, almanac || {});
  }
  if ((mode === 'almanac' || mode === 'quiz') && dataLoader.loadAlmanacData) {
    Object.assign(state, await dataLoader.loadAlmanacData());
  }
}

async function setMode(mode) {
  const requestId = ++modeRequestId;
  state.currentMode = mode;
  setFocusMode(mode);
  updateModeButtons(mode);
  state.starMap?.setReviewDue(null);
  state.starMap?.setMode(mode);
  state.celestialStage?.setMode(mode);
  cinematicMotion.beginMode(mode);
  if (mode !== 'explore') cinematicMotion.previewHexagram(null);
  if (mode !== 'explore') {
    closeEvolutionLab();
    closeGuaxuWheel({ restoreFocus: false, immediate: true });
  }
  updateExploreTools('star');

  if (mode === 'explore') {
    document.body.classList.remove('mode-transitioning');
    panel.removeAttribute('aria-busy');
    closeDetail({ resetMode: false });
    return;
  }

  if (state.currentDetail) {
    updateDetailUrl(null);
    state.currentDetail = null;
  }

  const loadRenderer = modeLoaders[mode];
  if (!loadRenderer) {
    setMode('explore');
    return;
  }
  openPanel();
  document.body.classList.add('mode-transitioning');
  panel.setAttribute('aria-busy', 'true');
  panelContent.innerHTML = `
    <div class="mode-loading" role="status" aria-live="polite">
      <span class="mode-loading-mark" aria-hidden="true"></span>
      <strong>正在展开${mode === 'almanac' ? '黄历' : mode === 'learning' ? '学习' : mode === 'review' ? '复习' : mode === 'quiz' ? '测验' : '占筮'}工作台</strong>
      <small>整理当前进度与内容…</small>
    </div>`;
  try {
    const [renderer] = await Promise.all([loadRenderer(), loadModeResources(mode)]);
    if (requestId !== modeRequestId || state.currentMode !== mode) return;
    if (mode === 'learning') {
      renderer(panelContent, state, (target = 'explore') => setMode(target));
    } else if (mode === 'review') {
      renderer(panelContent, state, () => setMode('learning'));
    } else if (mode === 'divination') {
      renderer(panelContent, state, (code) => openDetail(code));
    } else {
      renderer(panelContent, state);
    }
    motionSystem.reveal(panelContent);
    cinematicMotion.enterSurface(panelContent, mode);
    resetPanelViewport({ focusHeading: true });
  } catch (error) {
    if (requestId !== modeRequestId) return;
    const errorMessage = document.createElement('div');
    errorMessage.className = 'mode-error';
    errorMessage.setAttribute('role', 'alert');
    errorMessage.textContent = `内容加载失败：${String(error.message || error)}`;
    panelContent.replaceChildren(errorMessage);
  } finally {
    if (requestId === modeRequestId) {
      document.body.classList.remove('mode-transitioning');
      panel.removeAttribute('aria-busy');
    }
  }
}

function bindGlobalInteractions() {
  const updateAudioToggle = () => {
    const enabled = isSoundEnabled();
    const label = enabled ? '关闭界面音效' : '开启界面音效';
    audioToggle.setAttribute('aria-pressed', String(enabled));
    audioToggle.setAttribute('aria-label', label);
    audioToggle.title = label;
  };
  updateAudioToggle();
  audioToggle.addEventListener('click', () => {
    const enabled = setSoundEnabled(!isSoundEnabled());
    updateAudioToggle();
    if (enabled) playInterfaceSound('complete');
  });
  bindInterfaceSounds(document);
  relationLayersEl?.addEventListener('click', (event) => {
    const layerButton = event.target.closest('[data-relation-layer]');
    if (layerButton) {
      state.starMap?.setRelationFilter(layerButton.dataset.relationLayer, null);
      return;
    }
    const positionButton = event.target.closest('[data-changing-position]');
    if (positionButton) {
      state.starMap?.setRelationFilter('changing', Number(positionButton.dataset.changingPosition));
      return;
    }
    const relationButton = event.target.closest('#star-accessible-list [data-code]');
    if (relationButton) {
      state.starMap?.setAutoRotate(false);
      state.starMap?.focusStar(relationButton.dataset.code);
      canvas.focus({ preventScroll: true });
    }
  });
  starLayoutSelect?.addEventListener('change', () => {
    const layoutState = state.starMap?.setLayoutMode(starLayoutSelect.value);
    updateLayoutInterface(layoutState);
    updateRelationInterface(state.starMap?.getRelationState());
    canvas.focus({ preventScroll: true });
  });
  const modeButtons = [...document.querySelectorAll('.mode-btn')];
  modeButtons.forEach((button) => {
    button.addEventListener('click', () => {
      if (button.dataset.mode === state.currentMode && (state.currentMode === 'explore' || panel.classList.contains('open'))) return;
      setMode(button.dataset.mode);
    });
  });
  modeSwitcher.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const current = modeButtons.indexOf(document.activeElement);
    const next = moveSelection(current, event.key === 'ArrowRight' ? 'ArrowDown' :
      event.key === 'ArrowLeft' ? 'ArrowUp' : event.key, modeButtons.length);
    modeButtons[next]?.focus();
  });
  exploreTools.addEventListener('click', (event) => {
    const button = event.target.closest('.explore-tool');
    if (!button) return;
    if (button.dataset.exploreTool === 'star') {
      closeEvolutionLab();
      closeGuaxuWheel({ restoreFocus: false, immediate: true });
      updateExploreTools('star');
      return;
    }
    if (button.dataset.exploreTool === 'guaxu') {
      closeEvolutionLab();
      state.starMap?.pause?.('guaxu');
      updateExploreTools('guaxu');
      showGuaxuWheel(
        state.hexagrams,
        (code) => {
          updateExploreTools('star');
          openDetail(code);
        },
        () => {
          updateExploreTools('star');
          state.starMap?.resume?.('guaxu');
        },
      );
      return;
    }
    if (!state.commentaryReleaseReady) return;
    const code = state.currentDetail || getHexCodeFromUrl(window.location.href) || '111111';
    const baseHex = state.index.byCode.get(code) || state.hexagrams[0];
    updateExploreTools('evolution');
    state.starMap?.pause?.('evolution');
    showEvolutionLab(
      baseHex,
      state.hexagrams,
      (resultCode) => openDetail(resultCode, baseHex.binaryCode),
      () => {
        updateExploreTools('star');
        state.starMap?.resume?.('evolution');
      },
    );
  });
  document.getElementById('detail-close').addEventListener('click', () => closeDetail({ restoreFocus: true }));
  panelLayoutSelect.addEventListener('change', () => {
    setPanelLayout(panelLayoutSelect.value, { persist: true });
  });
  panelSizeButton.addEventListener('click', () => {
    const current = DRAWER_SIZES.indexOf(panel.dataset.drawerSize);
    setDrawerSize(DRAWER_SIZES[(current + 1) % DRAWER_SIZES.length], { persist: true });
  });
  document.addEventListener('keydown', (event) => {
    if (document.querySelector('.share-card-overlay')) return;
    if (event.key === 'Escape' && searchInput.getAttribute('aria-expanded') === 'true') {
      event.preventDefault();
      closeSearch();
      searchInput.focus();
      return;
    }
    if (event.key === 'Escape' && panel.classList.contains('open')) {
      closeDetail({ restoreFocus: true });
      return;
    }
    if (event.key !== 'Tab' || (!compactPanelQuery.matches && panel.dataset.focus !== 'true') ||
      !panel.classList.contains('open')) return;
    const focusable = [...panel.querySelectorAll('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])')]
      .filter((element) => !element.hidden && element.getClientRects().length > 0);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
  const syncPanelModality = () => {
    panel.setAttribute('aria-modal', String(compactPanelQuery.matches));
  };
  if (compactPanelQuery.addEventListener) compactPanelQuery.addEventListener('change', syncPanelModality);
  else compactPanelQuery.addListener?.(syncPanelModality);
  syncPanelModality();

  const closeSearch = () => {
    searchResultsEl.hidden = true;
    searchInput.setAttribute('aria-expanded', 'false');
    searchInput.removeAttribute('aria-activedescendant');
    searchIndex = -1;
  };
  document.addEventListener('keydown', (event) => {
    const target = event.target;
    const isTyping = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target?.isContentEditable;
    const searchShortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k';
    if (!searchShortcut && (event.key !== '/' || isTyping || event.ctrlKey || event.metaKey || event.altKey)) return;
    event.preventDefault();
    searchInput.focus();
    searchInput.select();
  });
  const selectSearchResult = (index) => {
    const result = searchResults[index];
    if (!result) return;
    searchInput.value = result.name;
    closeSearch();
    openDetail(result.binaryCode);
  };
  const renderSearch = () => {
    const keyword = searchInput.value.trim();
    searchResults = keyword ? searchHexagrams(state.hexagrams, keyword).slice(0, 8) : [];
    searchIndex = -1;
    searchResultsEl.replaceChildren();
    if (!keyword) {
      closeSearch();
      return;
    }
    if (!searchResults.length) {
      const empty = document.createElement('p');
      empty.className = 'search-empty';
      empty.setAttribute('role', 'status');
      empty.textContent = '没有找到相关卦象';
      searchResultsEl.append(empty);
    } else {
      searchResults.forEach((hexagram, index) => {
        const option = document.createElement('button');
        option.type = 'button';
        option.id = `search-option-${index}`;
        option.className = 'search-option';
        option.setAttribute('role', 'option');
        option.setAttribute('aria-selected', 'false');
        option.setAttribute('aria-label', `第 ${hexagram.number} 卦，${hexagram.name}，${hexagram.fullName}`);
        option.dataset.index = String(index);
        const number = document.createElement('span');
        number.className = 'search-option-number';
        number.textContent = String(hexagram.number).padStart(2, '0');
        const identity = document.createElement('span');
        identity.className = 'search-option-identity';
        const name = document.createElement('strong');
        name.textContent = hexagram.name;
        const fullName = document.createElement('small');
        fullName.textContent = hexagram.fullName;
        identity.append(name, fullName);
        const code = document.createElement('code');
        code.textContent = hexagram.binaryCode;
        option.append(number, identity, code);
        searchResultsEl.append(option);
      });
      state.starMap?.focusStar(searchResults[0].binaryCode);
    }
    searchResultsEl.hidden = false;
    searchInput.setAttribute('aria-expanded', 'true');
  };
  const updateSearchSelection = () => {
    searchResultsEl.querySelectorAll('.search-option').forEach((option, index) => {
      const selected = index === searchIndex;
      option.classList.toggle('active', selected);
      option.setAttribute('aria-selected', String(selected));
      if (selected) {
        searchInput.setAttribute('aria-activedescendant', option.id);
        option.scrollIntoView({ block: 'nearest' });
        state.starMap?.focusStar(searchResults[index].binaryCode);
      }
    });
  };
  searchInput.addEventListener('input', renderSearch);
  searchInput.addEventListener('focus', renderSearch);
  searchInput.addEventListener('keydown', (event) => {
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      searchIndex = moveSelection(searchIndex, event.key, searchResults.length);
      updateSearchSelection();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      selectSearchResult(searchIndex >= 0 ? searchIndex : 0);
    } else if (event.key === 'Escape') {
      closeSearch();
    }
  });
  searchResultsEl.addEventListener('mousedown', (event) => event.preventDefault());
  searchResultsEl.addEventListener('click', (event) => {
    const option = event.target.closest('.search-option');
    if (option) selectSearchResult(Number.parseInt(option.dataset.index, 10));
  });
  document.querySelector('.search-box').addEventListener('focusout', (event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) closeSearch();
  });
  window.addEventListener('popstate', () => {
    const code = getHexCodeFromUrl(window.location.href);
    if (code && state.index.byCode.has(code)) openDetail(code, null, { historyMode: 'none' });
    else closeDetail({ updateUrl: false });
  });

  let resizeFrame = null;
  const scheduleStarMapResize = () => {
    if (resizeFrame) return;
    resizeFrame = window.requestAnimationFrame(() => {
      resizeFrame = null;
      state.starMap?.resize();
    });
  };
  window.addEventListener('resize', scheduleStarMapResize);
  canvas.addEventListener('transitionend', (event) => {
    if (event.target === canvas && ['width', 'height'].includes(event.propertyName)) {
      scheduleStarMapResize();
    }
  });

  const zoomLevel = document.getElementById('zoom-level');
  const updateZoom = () => { zoomLevel.textContent = `${state.starMap.getZoomPercent()}%`; };
  document.getElementById('zoom-in').addEventListener('click', () => { state.starMap.zoomBy(1.25); updateZoom(); });
  document.getElementById('zoom-out').addEventListener('click', () => { state.starMap.zoomBy(0.8); updateZoom(); });
  document.getElementById('zoom-reset').addEventListener('click', () => { state.starMap.zoomReset(); updateZoom(); });
  autoRotateButton?.addEventListener('click', () => updateAutoRotateButton(state.starMap.toggleAutoRotate()));
  document.getElementById('trail-clear').addEventListener('click', () => {
    state.starMap.clearTrail();
    state.starMap.clearFocus();
  });
  document.getElementById('trail-back').addEventListener('click', () => {
    const code = state.starMap.popTrail();
    if (code) openDetail(code, null);
    else relationStatusEl.textContent = '暂无可返回的关系漫游轨迹。';
  });
  let zoomFrame = null;
  canvas.addEventListener('wheel', () => {
    if (zoomFrame !== null) return;
    zoomFrame = window.requestAnimationFrame(() => {
      zoomFrame = null;
      updateZoom();
    });
  }, { passive: true });
}

async function init() {
  try {
    state.celestialStage = initCelestialStage(celestialCanvas);
    // 旧版 Service Worker 可能仍缓存只导出 loadAllData 的模块；首次升级时保持兼容。
    const loadInitialData = dataLoader.loadCoreData || dataLoader.loadAllData;
    if (!loadInitialData) throw new Error('缺少数据加载入口');
    const data = await loadInitialData();
    Object.assign(state, data);
    try {
      const commentaryManifest = await dataLoader.loadCommentaryManifest?.();
      state.commentaryReleaseReady = commentaryManifest?.releaseReady === true;
    } catch {
      state.commentaryReleaseReady = false;
    }
    state.index = buildHexagramIndex(data.hexagrams);
    state.starMap = new StarMap(canvas, buildRelationGraph(data.hexagrams), {
      onPick: (code) => {
        cinematicMotion.previewHexagram(null);
        openDetail(code);
      },
      onFocus: (code, point) => {
        if (code) state.celestialStage?.selectHexagram(code, point);
        else state.celestialStage?.clearSelection();
      },
      onRelationChange: (relationState) => {
        updateRelationInterface(relationState);
        state.celestialStage?.setRelationState?.(relationState);
      },
      onLayoutChange: updateLayoutInterface,
      onAutoRotateChange: updateAutoRotateButton,
      onHover: (code, point, meta) => {
        state.celestialStage?.focusHexagram(code, point);
        cinematicMotion.previewHexagram(code ? state.index.byCode.get(code) : null, meta);
      },
      onViewChange: (view) => {
        state.celestialStage?.syncView(view);
        syncStarViewHud(view);
      },
    });
    state.celestialStage.setMode('explore');
    bindGlobalInteractions();
    updateAutoRotateButton(state.starMap.isAutoRotating());
    updateLayoutInterface(state.starMap.getLayoutState());
    updateRelationInterface(state.starMap.getRelationState());
    updateModeButtons('explore');
    updateExploreTools('star');
    loadingEl.hidden = true;
    const initialCode = getHexCodeFromUrl(window.location.href);
    let dailySeen = false;
    try { dailySeen = sessionStorage.getItem(DAILY_SEEN_KEY) === '1'; } catch {}
    if (initialCode && state.index.byCode.has(initialCode)) {
      dailyOverlay.hidden = true;
      openDetail(initialCode, null, { historyMode: 'replace' });
    } else if (dailySeen) {
      dailyOverlay.hidden = true;
      state.starMap.resume?.();
    } else {
      showDailyHexagram();
    }
  } catch (error) {
    loadingEl.hidden = false;
    loadingEl.textContent = `数据加载失败：${error.message}`;
    loadingEl.className = 'error-screen';
    console.error(error);
  }
}

init();

window.addEventListener('pagehide', (event) => {
  if (!event.persisted) {
    motionSystem.destroy();
    cinematicMotion.destroy();
    state.celestialStage?.destroy();
  }
}, { once: true });

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).catch((error) => {
      console.warn('离线缓存注册失败', error);
    });
  });
}
