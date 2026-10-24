// 易象图谱入口：只负责数据初始化、全局状态与模式调度。
import {
  bindInterfaceSounds,
  isSoundEnabled,
  playHexagramSound,
  playInterfaceSound,
  setSoundEnabled,
} from './audio-engine.js';
import { createProgressEvent } from './achievement-engine.js';
import { loadAchievementState, processAchievementEvent } from './achievement-storage.js';
import * as dataLoader from './data-loader.js';
import { closeEvolutionLab, showEvolutionLab } from './evolution-lab.js';
import { deliverShareImage, generateHexagramShareImage } from './share-card.js';
import { closeGuaxuWheel, showGuaxuWheel } from './modes/guaxu-mode.js';
import { initCinematicMotion } from './cinematic-motion.js';
import { initMotionSystem } from './motion-system.js';
import { renderHexagramDetail } from './render.js';
import { addReviewCard, loadReviewCards } from './review-engine.js';
import { createReadingState, shouldRecordDeepRead, transitionReading } from './reading-state.js';
import { getHexCodeFromUrl, moveSelection, parseHexagramQuery, withHexCode } from './search-controller.js';
import { buildRelationGraph } from './star-relations.js';
import { describeStarView, resolveStarStage, StarMap } from './star-map.js';
import { hexagramSvg } from './svg-painter.js';
import { installUIIcons } from './ui-icons.js';

const { buildHexagramIndex, searchHexagrams } = dataLoader;

const modeLoaders = {
  almanac: () => import('./almanac-page.js?v=51').then((module) => module.renderAlmanacPage),
  divination: () => import('./modes/divination-mode.js?v=51').then((module) => module.renderDivinationMode),
  learning: () => import('./modes/learning-mode.js?v=51').then((module) => module.renderLearningMode),
  quiz: () => import('./modes/quiz-mode.js?v=51').then((module) => module.renderQuizMode),
  review: () => import('./modes/review-mode.js?v=51').then((module) => module.renderReviewMode),
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
  celestialPauseReasons: new Set(),
  currentDetail: null,
  reading: createReadingState(),
  readingSnapshot: null,
  renderedCode: null,
  readingDrafts: new Map(),
  readingSaves: new Map(),
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
const searchPopupEl = document.getElementById('search-popup');
const searchStatusEl = document.getElementById('search-status');
const dailyOverlay = document.getElementById('daily-overlay');
const modeSwitcher = document.getElementById('mode-switcher');
const exploreTools = document.getElementById('explore-tools');
const audioToggle = document.getElementById('audio-toggle');
const hintEl = document.getElementById('hint');
const viewLevelEl = hintEl?.querySelector('[data-view-level]');
const viewAngleEl = hintEl?.querySelector('[data-view-angle]');
const viewRotationEl = hintEl?.querySelector('[data-view-rotation]');
const starStageRail = document.querySelector('.star-map-sequence');
const starStageIndexEl = hintEl?.querySelector('[data-star-stage-index]');
const starStageLabelEl = hintEl?.querySelector('[data-star-stage-label]');
const relationLayersEl = document.getElementById('relation-layers');
const relationStatusEl = document.getElementById('star-relation-status');
const relationListEl = document.getElementById('star-accessible-list');
const changingPositionsEl = relationLayersEl?.querySelector('.changing-position-buttons');
const starLayoutSelect = document.getElementById('star-layout-mode');
const starLayoutSource = document.getElementById('star-layout-source');
const starLayoutDescription = document.getElementById('star-layout-description');
const autoRotateButton = document.getElementById('auto-rotate');
const workspaceInsightBar = document.querySelector('.workspace-insight-bar');
const focusSummary = document.getElementById('star-focus-summary');
const readingToolbar = document.getElementById('reading-toolbar');
const readingSaveFeedback = document.getElementById('reading-save-feedback');
const readingSaveStatus = document.getElementById('reading-save-status');
const readingSaveRetry = document.getElementById('reading-save-retry');
const relationToggle = document.getElementById('relation-toggle');
const relationOptions = document.getElementById('relation-options');
const compactPanelQuery = window.matchMedia('(max-width: 900px)');
const narrowReadingQuery = window.matchMedia('(max-width: 1100px)');
const motionSystem = initMotionSystem();
const cinematicMotion = initCinematicMotion({ panel, panelContent });
let modeRequestId = 0;
let modeCleanup = null;
let panelReturnFocus = null;
let dailyBackgroundInertState = null;
let searchResults = [];
let searchIndex = -1;
let lastViewHudKey = '';
let lastStarView = null;
let lastStarStage = '';
let celestialStageLoader = null;
let readingBackgroundState = null;
let toolsBackgroundState = null;
let readingScroll = { panel: 0, content: 0 };

function pauseCelestialStage(reason = 'manual') {
  state.celestialPauseReasons.add(reason);
  state.celestialStage?.pause?.(reason);
}

function resumeCelestialStage(reason = 'manual') {
  state.celestialPauseReasons.delete(reason);
  state.celestialStage?.resume?.(reason);
}

function ensureCelestialStage() {
  if (state.celestialStage) return Promise.resolve(state.celestialStage);
  if (!celestialStageLoader) {
    celestialStageLoader = import('./celestial-stage.js')
      .then(({ initCelestialStage }) => {
        state.celestialStage = initCelestialStage(celestialCanvas);
        state.celestialStage.setMode(state.currentMode);
        state.celestialStage.syncView(lastStarView);
        state.celestialPauseReasons.forEach((reason) => state.celestialStage.pause?.(reason));
        return state.celestialStage;
      })
      .catch((error) => {
        celestialStageLoader = null;
        throw error;
      });
  }
  return celestialStageLoader;
}

function loadCelestialStageOnIntent() {
  ensureCelestialStage().catch((error) => {
    console.warn('天象舞台按需加载失败', error);
  });
}

const STAR_STAGE_META = {
  galaxy: ['01', '银河巡航'],
  cluster: ['02', '卦族星团'],
  hexagram: ['03', '卦星聚焦'],
  yao: ['04', '六爻近景'],
};

function syncStarStage(view = lastStarView) {
  if (!view) return;
  lastStarView = view;
  const stage = resolveStarStage({
    scale: view.scale,
    activeCode: view.activeCode || state.currentDetail,
    detailOpen: panel.classList.contains('open') && Boolean(state.currentDetail),
  });
  if (stage === lastStarStage) return;
  lastStarStage = stage;
  const [index, label] = STAR_STAGE_META[stage];
  document.body.dataset.starStage = stage;
  if (starStageIndexEl) starStageIndexEl.textContent = index;
  if (starStageLabelEl) starStageLabelEl.textContent = label;
  const stages = Object.keys(STAR_STAGE_META);
  const activeIndex = stages.indexOf(stage);
  starStageRail?.querySelectorAll('[data-star-stage]').forEach((item) => {
    const itemIndex = stages.indexOf(item.dataset.starStage);
    item.classList.toggle('active', itemIndex === activeIndex);
    item.classList.toggle('complete', itemIndex < activeIndex);
    if (itemIndex === activeIndex) item.setAttribute('aria-current', 'step');
    else item.removeAttribute('aria-current');
  });
}

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
  if (!view) return;
  syncStarStage(view);
  if (!hintEl || !viewLevelEl || !viewAngleEl) return;
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
  const heading = panelContent.querySelector('[data-learning-focus]') ||
    panelContent.querySelector('[data-page-heading], .mode-panel-title, h2, h3');
  window.requestAnimationFrame(() => {
    if (!heading?.isConnected || !panelContent.contains(heading) || heading.closest?.('[inert], [hidden]')) return;
    if (!(heading.tabIndex >= 0)) heading.tabIndex = -1;
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

function setDailyBackgroundInert(inert) {
  if (inert) {
    if (dailyBackgroundInertState) return;
    dailyBackgroundInertState = new Map([...document.body.children]
      .filter((child) => child !== dailyOverlay)
      .map((child) => [child, child.inert]));
    dailyBackgroundInertState.forEach((_, child) => { child.inert = true; });
    return;
  }
  if (!dailyBackgroundInertState) return;
  dailyBackgroundInertState.forEach((wasInert, child) => { child.inert = wasInert; });
  dailyBackgroundInertState = null;
}

function getDailyFocusable() {
  return [...dailyOverlay.querySelectorAll('button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])')]
    .filter((element) => !element.hidden && !element.closest('[hidden]') && element.getAttribute('aria-hidden') !== 'true');
}

function trapDailyFocus(event) {
  if (event.key !== 'Tab' || dailyOverlay.hidden || dailyOverlay.classList.contains('hidden')) return;
  const focusable = getDailyFocusable();
  if (!focusable.length) {
    event.preventDefault();
    dailyOverlay.querySelector('.daily-card')?.focus();
    return;
  }
  const currentIndex = focusable.indexOf(document.activeElement);
  const nextIndex = event.shiftKey
    ? (currentIndex <= 0 ? focusable.length - 1 : currentIndex - 1)
    : (currentIndex === -1 || currentIndex === focusable.length - 1 ? 0 : currentIndex + 1);
  if (currentIndex === -1 || (event.shiftKey && currentIndex === 0) || (!event.shiftKey && currentIndex === focusable.length - 1)) {
    event.preventDefault();
    focusable[nextIndex].focus();
  }
}

function showDailyHexagram() {
  const hex = getDailyHexagram(state.hexagrams);
  if (!hex) return;
  dailyOverlay.hidden = false;
  dailyOverlay.setAttribute('aria-hidden', 'false');
  dailyOverlay.dataset.motionInstant = 'true';
  setDailyBackgroundInert(true);
  state.starMap?.pause?.('welcome');
  pauseCelestialStage('welcome');
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
    dailyOverlay.setAttribute('aria-hidden', 'true');
    setDailyBackgroundInert(false);
    setMode(destination === 'beginner' ? 'learning' : 'explore',
      destination === 'beginner' ? { section: 'path', lessonId: 'l1-1' } : {});
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.setTimeout(() => {
      dailyOverlay.hidden = true;
      state.starMap?.resume?.('welcome');
      resumeCelestialStage('welcome');
      if (destination === 'daily') openDetail(hex.binaryCode);
      else if (destination === 'explore') {
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
  motionSystem.reveal(dailyOverlay, { animate: false });
  window.requestAnimationFrame?.(() => dailyOverlay.querySelector('.daily-enter-primary')?.focus({ preventScroll: true }));
}

dailyOverlay.addEventListener('keydown', trapDailyFocus);

function openPanel({ preserveScroll = false } = {}) {
  if (!panel.classList.contains('open')) panelReturnFocus = document.activeElement;
  panel.inert = false;
  panel.classList.add('open');
  panel.setAttribute('aria-hidden', 'false');
  syncReadingModality();
  document.body.classList.add('panel-open');
  state.starMap?.resize();
  if (!preserveScroll) resetPanelViewport();
  syncStarStage();
}

function updateDetailUrl(code, mode = 'push') {
  const next = withHexCode(window.location.href, code);
  const entry = { hex: code, reading: { ...state.reading } };
  const previous = window.history.state?.reading;
  if (next === window.location.href && previous?.stage === state.reading.stage
    && previous?.focusedCode === state.reading.focusedCode && previous?.section === state.reading.section) return;
  window.history[mode === 'replace' ? 'replaceState' : 'pushState'](entry, '', next);
}

function syncReadingModality() {
  const open = panel.classList.contains('open');
  const modal = open && (state.reading.stage === 'deep' || compactPanelQuery.matches);
  panel.setAttribute('aria-modal', String(modal));
  if (modal) {
    state.starMap?.pause?.('panel');
    pauseCelestialStage('panel');
  } else {
    state.starMap?.resume?.('panel');
    resumeCelestialStage('panel');
  }
  if (modal && !readingBackgroundState) {
    readingBackgroundState = new Map([...document.body.children]
      .filter((child) => child !== panel && !child.contains(panel)
        && !child.classList.contains('share-card-overlay'))
      .map((child) => [child, child.inert]));
    readingBackgroundState.forEach((_, child) => { child.inert = true; });
  } else if (!modal && readingBackgroundState) {
    readingBackgroundState.forEach((wasInert, child) => { child.inert = wasInert; });
    readingBackgroundState = null;
  }
}

function syncReadingPresentation() {
  const { stage } = state.reading;
  document.body.dataset.readingStage = stage;
  panel.dataset.readingStage = stage;
  if (readingToolbar) readingToolbar.hidden = stage === 'none';
  const deepen = document.getElementById('reading-deepen');
  const quicken = document.getElementById('reading-quicken');
  if (deepen) deepen.hidden = stage !== 'quick';
  if (quicken) quicken.hidden = stage !== 'deep';
  syncReadingTabs();
  syncReadingSaveFeedback();
  if (stage === 'deep' || (stage === 'quick' && compactPanelQuery.matches)) {
    state.starMap?.pause?.('reading');
    pauseCelestialStage('reading');
  } else {
    state.starMap?.resume?.('reading');
    resumeCelestialStage('reading');
  }
  syncFocusSummary();
  syncReadingModality();
  syncReservedRects();
}

function syncReadingTabs() {
  readingToolbar?.querySelectorAll('[data-reading-tab]').forEach((button) => {
    const current = button.dataset.readingTab === state.reading.section;
    button.setAttribute('aria-pressed', String(current));
    if (current) button.setAttribute('aria-current', 'true');
    else button.removeAttribute('aria-current');
  });
}

function syncFocusSummary() {
  if (!focusSummary) return;
  const hex = state.index?.byCode.get(state.reading.focusedCode);
  focusSummary.hidden = !hex || state.currentMode !== 'explore' || state.reading.stage !== 'none';
  if (!hex) return;
  const trigramName = (code) => state.trigrams.find((item) => item.binaryCode === code)?.name || code;
  const fields = {
    number: String(hex.number).padStart(2, '0'), name: hex.name, full: hex.fullName,
    trigrams: `上卦 ${trigramName(hex.binaryCode.slice(3))} · 下卦 ${trigramName(hex.binaryCode.slice(0, 3))}`,
    description: hex.description || hex.judgement || '由卦象入手，循经文理解处境与变化。',
  };
  Object.entries(fields).forEach(([name, value]) => {
    const target = focusSummary.querySelector(`[data-focus-${name}]`);
    if (target) target.textContent = value;
  });
}

function syncReservedRects() {
  if (!state.starMap?.setReservedRects) return;
  const origin = canvas.getBoundingClientRect();
  const rects = [relationLayersEl, focusSummary, exploreTools, document.querySelector('.zoom-controls'), hintEl]
    .filter((element) => element && !element.hidden && element.getClientRects().length)
    .map((element) => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left - origin.left, top: rect.top - origin.top, right: rect.right - origin.left, bottom: rect.bottom - origin.top };
    });
  state.starMap.setReservedRects(rects);
}

function setRelationOptions(open, { restoreFocus = false } = {}) {
  if (!relationOptions || !relationToggle) return;
  relationToggle.setAttribute('aria-expanded', String(open));
  relationOptions.hidden = !open;
  relationOptions.inert = !open;
  relationLayersEl.classList.toggle('tools-expanded', open);
  const modal = open && compactPanelQuery.matches;
  if (modal) {
    state.starMap?.pause?.('tools');
    pauseCelestialStage('tools');
  } else {
    state.starMap?.resume?.('tools');
    resumeCelestialStage('tools');
  }
  if (modal) {
    relationLayersEl.setAttribute('role', 'dialog');
    relationLayersEl.setAttribute('aria-modal', 'true');
    if (!toolsBackgroundState) {
      toolsBackgroundState = new Map([...document.body.children]
        .filter((child) => child !== relationLayersEl && !child.contains(relationLayersEl))
        .map((child) => [child, child.inert]));
      toolsBackgroundState.forEach((_, child) => { child.inert = true; });
    }
  } else {
    relationLayersEl.removeAttribute('role');
    relationLayersEl.removeAttribute('aria-modal');
    if (toolsBackgroundState) {
      toolsBackgroundState.forEach((wasInert, child) => { child.inert = wasInert; });
      toolsBackgroundState = null;
    }
  }
  if (restoreFocus) relationToggle.focus({ preventScroll: true });
  syncReservedRects();
}

function enterExplore() {
  disposeMode();
  setRelationOptions(false);
  ++modeRequestId;
  state.currentMode = 'explore';
  setFocusMode('explore');
  updateModeButtons('explore');
  state.starMap?.setReviewDue(null);
  state.starMap?.setMode('explore');
  state.celestialStage?.setMode('explore');
  resumeCelestialStage('mode');
  document.body.classList.remove('mode-transitioning');
  panel.removeAttribute('aria-busy');
  updateExploreTools('star');
}

function focusHexagram(code, { historyMode = 'replace' } = {}) {
  if (!state.index?.byCode.has(code)) return;
  enterExplore();
  if (panel.classList.contains('open')) closeDetail({ resetMode: false, updateUrl: false });
  state.reading = transitionReading(state.reading, { type: 'focus', code });
  state.starMap?.focusStar(code);
  syncReadingPresentation();
  if (historyMode !== 'none') updateDetailUrl(null, historyMode);
}

function changeStarLayout(mode) {
  if (state.reading.stage !== 'none') closeDetail({ resetMode: false });
  state.reading = createReadingState();
  const layoutState = state.starMap?.setLayoutMode(mode);
  updateLayoutInterface(layoutState);
  updateRelationInterface(state.starMap?.getRelationState());
  syncReadingPresentation();
  updateDetailUrl(null, 'replace');
  canvas.focus({ preventScroll: true });
}

function closeDetail({ restoreFocus = false, resetMode = true, updateUrl = true } = {}) {
  disposeMode();
  ++modeRequestId;
  document.body.classList.remove('mode-transitioning');
  panel.removeAttribute('aria-busy');
  if (state.reading.stage === 'quick' && state.starMap?.captureView) {
    state.readingSnapshot = state.starMap.captureView();
  }
  readingScroll = { panel: panel.scrollTop, content: panelContent.scrollTop };
  panel.classList.remove('open');
  panel.setAttribute('aria-hidden', 'true');
  panel.inert = true;
  document.body.classList.remove('panel-open');
  state.starMap?.resize();
  state.currentDetail = null;
  state.reading = transitionReading(state.reading, { type: 'close' });
  syncReadingPresentation();
  if (state.readingSnapshot) {
    state.starMap?.restoreView?.(state.readingSnapshot);
    state.readingSnapshot = null;
  }
  syncStarStage();
  if (updateUrl) updateDetailUrl(null, 'replace');
  if (resetMode && state.currentMode !== 'explore') {
    state.currentMode = 'explore';
    setFocusMode('explore');
    updateModeButtons('explore');
    state.starMap?.setReviewDue(null);
    state.starMap?.setMode('explore');
    state.celestialStage?.setMode('explore');
    resumeCelestialStage('mode');
  }
  syncFocusSummary();
  if (restoreFocus) {
    const available = panelReturnFocus?.isConnected && panelReturnFocus !== document.body
      && panelReturnFocus !== document.documentElement && !panelReturnFocus.closest?.('[inert], [hidden]')
      && panelReturnFocus.getClientRects?.().length;
    const target = available ? panelReturnFocus : (!focusSummary?.hidden ? document.getElementById('focus-read') : canvas);
    target?.focus({ preventScroll: true });
  }
}

function showShareCardDialog(payload, hexagram) {
  document.querySelector('.share-card-overlay')?.remove();
  const returnFocus = document.activeElement;
  const overlay = document.createElement('div');
  overlay.className = 'share-card-overlay';
  overlay.innerHTML = `
    <section class="share-card-dialog" role="dialog" aria-modal="true" aria-labelledby="share-card-title">
      <button type="button" class="share-card-close" aria-label="关闭分享图片预览"><span data-icon="x" aria-hidden="true"></span></button>
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
  installUIIcons(overlay);
  state.starMap?.pause?.('share');
  pauseCelestialStage('share');
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
    resumeCelestialStage('share');
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

function syncReadingSaveFeedback() {
  if (!readingSaveFeedback || !readingSaveStatus || !readingSaveRetry) return;
  const entry = state.readingSaves.get(state.reading.readingCode);
  const visible = state.reading.stage === 'deep' && entry?.hadFailure;
  readingSaveFeedback.hidden = !visible;
  if (!visible) return;
  const missing = [];
  if (!entry.achievementSaved) missing.push('阅读记录');
  if (!entry.reviewSaved) missing.push('复习卡');
  readingSaveStatus.textContent = missing.length
    ? `${missing.join('与')}未保存，正文仍可阅读。可恢复浏览器存储后重试。`
    : '阅读记录与复习卡已保存。';
  readingSaveRetry.hidden = missing.length === 0;
}

function persistReadingSave(code) {
  const entry = state.readingSaves.get(code);
  if (!entry) return;
  if (entry.hadFailure) {
    // Import, deletion or another tab can replace a previously saved half.
    if (entry.achievementSaved) entry.achievementSaved = loadAchievementState().processedKeys.includes(entry.event.idempotencyKey);
    if (entry.reviewSaved) entry.reviewSaved = Boolean(loadReviewCards()[code]);
  }
  if (!entry.achievementSaved) entry.achievementSaved = processAchievementEvent(entry.event).saved === true;
  if (!entry.reviewSaved) entry.reviewSaved = addReviewCard(code).saved === true;
  entry.hadFailure ||= !entry.achievementSaved || !entry.reviewSaved;
  syncReadingSaveFeedback();
}

function retryReadingSave() {
  if (state.reading.stage !== 'deep' || readingSaveRetry?.disabled) return;
  const restoreFocus = document.activeElement === readingSaveRetry;
  if (readingSaveRetry) readingSaveRetry.disabled = true;
  try {
    persistReadingSave(state.reading.readingCode);
  } finally {
    if (readingSaveRetry) readingSaveRetry.disabled = false;
  }
  if (restoreFocus && readingSaveRetry?.hidden) readingSaveStatus?.focus({ preventScroll: true });
}

function openReading(code, stage, fromCode = null, { historyMode = 'push' } = {}) {
  const hex = state.index?.byCode.get(code);
  if (!hex) return;
  const previous = state.reading;
  const reuse = state.renderedCode === code && Boolean(panelContent.querySelector('#hexagram-detail-title'));
  if (previous.stage !== 'none') readingScroll = { panel: panel.scrollTop, content: panelContent.scrollTop };
  enterExplore();
  const needsFocus = previous.focusedCode !== code;
  if (needsFocus) state.starMap?.focusStar(code);
  if (fromCode) state.starMap?.addTrail(fromCode, code);
  if (!state.readingSnapshot || needsFocus || (previous.stage === 'quick' && stage === 'deep')) {
    state.readingSnapshot = state.starMap?.captureView?.() || null;
  }
  state.reading = transitionReading(previous, { type: stage, code });
  state.currentDetail = code;
  if (!reuse) {
    rememberReadingDraft();
    renderHexagramDetail(hex, panelContent, state.hexagrams, (relatedCode) => {
      openReading(relatedCode, state.reading.stage === 'quick' ? 'quick' : 'deep', code);
      selectReadingSection('relations');
    });
    state.renderedCode = code;
    const note = panelContent.querySelector('#note-input');
    if (note && state.readingDrafts.has(code)) note.value = state.readingDrafts.get(code);
    bindShareAction(hex);
    installUIIcons(panelContent);
    readingScroll = { panel: 0, content: 0 };
  }
  if (shouldRecordDeepRead(previous, state.reading)) {
    const pending = state.readingSaves.get(code);
    if (!pending || (pending.achievementSaved && pending.reviewSaved)) {
      state.readingSaves.set(code, {
        event: createProgressEvent({
          type: 'hexagram.read', subjectId: code, outcome: 'completed',
          idempotencyKey: `hexagram:read:${code}`,
          metadata: { deep: true, hexagramCode: code },
        }),
        achievementSaved: false, reviewSaved: false, hadFailure: false,
      });
    }
    persistReadingSave(code);
  }
  panel.setAttribute('aria-labelledby', 'hexagram-detail-title');
  panel.removeAttribute('aria-label');
  syncReadingPresentation();
  if (historyMode !== 'none') updateDetailUrl(stage === 'deep' ? code : null, historyMode);
  openPanel({ preserveScroll: reuse });
  cinematicMotion.enterSurface(panelContent, 'explore', { animate: false });
  if (!reuse) {
    motionSystem.reveal(panelContent);
    resetPanelViewport({ focusHeading: true });
    try { playHexagramSound(code); } catch {}
  } else {
    window.requestAnimationFrame(() => {
      panel.scrollTop = readingScroll.panel;
      panelContent.scrollTop = readingScroll.content;
      const target = document.getElementById(stage === 'deep' ? 'reading-quicken' : 'reading-deepen');
      target?.focus({ preventScroll: true });
    });
  }
  syncReadingModality();
  window.requestAnimationFrame(syncReservedRects);
  syncStarStage();
}

function openDetail(code, fromCode = null, options = {}) {
  openReading(code, 'deep', fromCode, options);
}

function rememberReadingDraft() {
  const note = panelContent.querySelector('#note-input');
  if (state.renderedCode && note && typeof note.value === 'string') state.readingDrafts.set(state.renderedCode, note.value);
}

function selectReadingSection(section, { updateHistory = true } = {}) {
  state.reading = transitionReading(state.reading, { type: 'section', section });
  syncReadingPresentation();
  const target = panelContent.querySelector(`[data-reading-section="${state.reading.section}"]`);
  target?.scrollIntoView({ block: 'start', behavior: 'auto' });
  if (updateHistory) updateDetailUrl(state.reading.stage === 'deep' ? state.reading.readingCode : null, 'replace');
}

function stepBackReading() {
  if (state.reading.stage === 'deep') {
    openReading(state.reading.readingCode, 'quick', null, { historyMode: 'replace' });
  } else if (state.reading.stage === 'quick' || panel.classList.contains('open')) {
    closeDetail({ restoreFocus: true });
  } else if (state.reading.focusedCode) {
    state.reading = transitionReading(state.reading, { type: 'clear' });
    state.starMap?.clearFocus();
    syncReadingPresentation();
    updateDetailUrl(null, 'replace');
    canvas.focus({ preventScroll: true });
  }
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
  if (mode === 'review' && dataLoader.loadAlmanacData) {
    try {
      Object.assign(state, await dataLoader.loadAlmanacData());
    } catch (error) {
      // Queue references remain usable; the destination loads and checks the original question.
      console.warn('复习术语资料暂不可用', error);
    }
  }
}

function disposeMode() {
  const cleanup = modeCleanup;
  modeCleanup = null;
  cleanup?.();
}

async function setMode(mode, entry = {}) {
  disposeMode();
  rememberReadingDraft();
  if (state.reading.stage !== 'none') closeDetail({ resetMode: false });
  setRelationOptions(false);
  if (mode !== 'explore') {
    state.reading = createReadingState();
    state.renderedCode = null;
  }
  const requestId = ++modeRequestId;
  if (!state.celestialStage) ensureCelestialStage().catch((error) => {
    console.warn('天象舞台按需加载失败', error);
  });
  state.currentMode = mode;
  setFocusMode(mode);
  updateModeButtons(mode);
  state.starMap?.setReviewDue(null);
  state.starMap?.setMode(mode);
  state.celestialStage?.setMode(mode);
  if (mode === 'explore') resumeCelestialStage('mode');
  else pauseCelestialStage('mode');
  cinematicMotion.beginMode(mode);
  if (mode !== 'explore') cinematicMotion.previewHexagram(null);
  if (mode !== 'explore') {
    closeEvolutionLab();
    closeGuaxuWheel({ restoreFocus: false, immediate: true });
  }
  updateExploreTools('star');
  syncReadingPresentation();

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
    if (['learning', 'review', 'quiz'].includes(mode)) {
      const cleanup = renderer(panelContent, state, (target = 'explore', nextEntry) => setMode(target, nextEntry), entry);
      modeCleanup = typeof cleanup === 'function' ? cleanup : null;
    } else if (mode === 'divination') {
      renderer(panelContent, state, (code) => openDetail(code));
    } else {
      renderer(panelContent, state);
    }
    motionSystem.reveal(panelContent);
    installUIIcons(panelContent);
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
  installUIIcons(document);
  syncReadingPresentation();
  setRelationOptions(false);
  relationToggle?.addEventListener('click', () => {
    setRelationOptions(relationToggle.getAttribute('aria-expanded') !== 'true');
  });
  document.getElementById('focus-read')?.addEventListener('click', () => {
    openReading(state.reading.focusedCode, 'quick');
  });
  document.getElementById('focus-clear')?.addEventListener('click', stepBackReading);
  document.getElementById('reading-back')?.addEventListener('click', () => closeDetail({ restoreFocus: true }));
  document.getElementById('reading-deepen')?.addEventListener('click', () => openDetail(state.reading.readingCode));
  document.getElementById('reading-quicken')?.addEventListener('click', stepBackReading);
  readingSaveRetry?.addEventListener('click', retryReadingSave);
  readingToolbar?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-reading-tab]');
    if (button) selectReadingSection(button.dataset.readingTab);
  });
  panelContent.addEventListener('click', (event) => {
    const link = event.target.closest('.reading-outline a[href^="#"]');
    if (!link) return;
    const target = panelContent.querySelector(link.getAttribute('href'));
    if (!target) return;
    event.preventDefault();
    const section = target.closest('[data-reading-section]')?.dataset.readingSection;
    if (section) {
      state.reading = transitionReading(state.reading, { type: 'section', section });
      syncReadingPresentation();
      updateDetailUrl(state.reading.stage === 'deep' ? state.reading.readingCode : null, 'replace');
    }
    target.scrollIntoView({ block: 'start', behavior: 'auto' });
  });
  let readingSectionFrame = null;
  panel.addEventListener('scroll', () => {
    if (readingSectionFrame !== null || state.reading.stage === 'none') return;
    readingSectionFrame = window.requestAnimationFrame(() => {
      readingSectionFrame = null;
      if (state.reading.stage === 'none') return;
      const sections = [...panelContent.querySelectorAll('[data-reading-section]')];
      if (!sections.length) return;
      const panelTop = panel.getBoundingClientRect().top + panel.clientTop;
      const scrollMargin = Number.parseFloat(window.getComputedStyle(sections[0]).scrollMarginTop) || 0;
      const focusLine = Math.max(
        (readingToolbar?.getBoundingClientRect().bottom || panelTop) + 32,
        panelTop + scrollMargin,
      );
      // scrollIntoView按像素取整；边框和移动工具栏不能让上一节抢回已定位章节。
      const current = sections.find((element) => element.getBoundingClientRect().bottom > focusLine + 2);
      if (!current || current.dataset.readingSection === state.reading.section) return;
      state.reading = transitionReading(state.reading, { type: 'section', section: current.dataset.readingSection });
      syncReadingTabs();
    });
  }, { passive: true });
  canvas.addEventListener('pointerdown', loadCelestialStageOnIntent, { once: true, passive: true });
  canvas.addEventListener('focus', loadCelestialStageOnIntent, { once: true });
  const updateAudioToggle = () => {
    const enabled = isSoundEnabled();
    const label = enabled ? '关闭界面音效' : '开启界面音效';
    audioToggle.setAttribute('aria-pressed', String(enabled));
    audioToggle.setAttribute('aria-label', label);
    audioToggle.title = label;
    const icon = audioToggle.querySelector('[data-icon]');
    if (icon) {
      icon.dataset.icon = enabled ? 'volume-2' : 'volume-x';
      installUIIcons(icon);
    }
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
      if (layerButton.dataset.relationLayer === 'changing') setRelationOptions(true);
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
      focusHexagram(relationButton.dataset.code);
      canvas.focus({ preventScroll: true });
    }
  });
  starLayoutSelect?.addEventListener('change', () => {
    changeStarLayout(starLayoutSelect.value);
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
      pauseCelestialStage('guaxu');
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
          resumeCelestialStage('guaxu');
        },
      );
      return;
    }
    if (!state.commentaryReleaseReady) return;
    const code = state.currentDetail || getHexCodeFromUrl(window.location.href) || '111111';
    const baseHex = state.index.byCode.get(code) || state.hexagrams[0];
    updateExploreTools('evolution');
    state.starMap?.pause?.('evolution');
    pauseCelestialStage('evolution');
    showEvolutionLab(
      baseHex,
      state.hexagrams,
      (resultCode) => openDetail(resultCode, baseHex.binaryCode),
      () => {
        updateExploreTools('star');
        state.starMap?.resume?.('evolution');
        resumeCelestialStage('evolution');
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
    if (event.isComposing || event.keyCode === 229 || searchComposing) return;
    if (document.querySelector('.share-card-overlay')) return;
    if (event.key === 'Escape' && searchInput.getAttribute('aria-expanded') === 'true') {
      event.preventDefault();
      searchInput.focus();
      closeSearch();
      return;
    }
    if (event.key === 'Escape' && relationToggle?.getAttribute('aria-expanded') === 'true') {
      event.preventDefault();
      setRelationOptions(false, { restoreFocus: true });
      return;
    }
    if (event.key === 'Escape' && (panel.classList.contains('open') || state.reading.focusedCode)) {
      event.preventDefault();
      stepBackReading();
      return;
    }
    const modalRoot = panel.getAttribute('aria-modal') === 'true' && panel.classList.contains('open') ? panel
      : relationLayersEl?.getAttribute('aria-modal') === 'true' ? relationLayersEl : null;
    if (event.key !== 'Tab' || !modalRoot) return;
    const focusable = [...modalRoot.querySelectorAll('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])')]
      .filter((element) => !element.hidden && element.getClientRects().length > 0);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!modalRoot.contains(document.activeElement)) {
      event.preventDefault();
      first.focus();
    } else if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
  const syncPanelModality = () => {
    const expanded = relationToggle?.getAttribute('aria-expanded') === 'true';
    setRelationOptions(expanded && !(compactPanelQuery.matches && panel.classList.contains('open')));
    syncReadingPresentation();
  };
  if (compactPanelQuery.addEventListener) compactPanelQuery.addEventListener('change', syncPanelModality);
  else compactPanelQuery.addListener?.(syncPanelModality);
  syncPanelModality();
  const syncReadingDisclosures = () => {
    panelContent.querySelectorAll('.reading-disclosure').forEach((details) => {
      details.open = !narrowReadingQuery.matches;
    });
  };
  if (narrowReadingQuery.addEventListener) narrowReadingQuery.addEventListener('change', syncReadingDisclosures);
  else narrowReadingQuery.addListener?.(syncReadingDisclosures);

  const closeSearch = () => {
    searchPopupEl.hidden = true;
    searchResultsEl.hidden = true;
    searchResults = [];
    searchInput.setAttribute('aria-expanded', 'false');
    searchInput.removeAttribute('aria-activedescendant');
    searchStatusEl.textContent = '';
    searchIndex = -1;
  };
  let searchComposing = false;
  let searchKeywords = null;
  let searchKeywordsAttempted = false;
  let searchKeywordsFailed = false;
  const searchBox = document.querySelector('.search-box');
  document.addEventListener('keydown', (event) => {
    if (event.isComposing || event.keyCode === 229 || searchComposing || searchInput.disabled ||
        searchInput.closest('[inert]') || document.querySelector('.share-card-overlay')) return;
    const target = event.target;
    const isTyping = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target?.isContentEditable;
    const searchShortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k';
    if (!searchShortcut && (event.key !== '/' || isTyping || event.ctrlKey || event.metaKey || event.altKey)) return;
    event.preventDefault();
    searchInput.focus();
    searchInput.select();
  });
  const selectSearchResult = (index) => {
    if (searchComposing || searchInput.getAttribute('aria-expanded') !== 'true') return;
    const result = searchResults[index];
    if (!result) return;
    searchInput.value = result.name;
    closeSearch();
    focusHexagram(result.binaryCode);
  };
  const ensureSearchKeywords = () => {
    if (searchKeywords || searchKeywordsAttempted) return;
    searchKeywordsAttempted = true;
    dataLoader.loadHexagramKeywords().then((keywords) => {
      searchKeywords = keywords;
      searchKeywordsFailed = false;
    }).catch(() => {
      searchKeywordsFailed = true;
    }).finally(() => {
      // Re-read the current query; a late optional response must not reopen a dismissed popup.
      if (searchInput.getAttribute('aria-expanded') === 'true' && !searchComposing) {
        renderSearch({ preserveSelection: true });
      }
    });
  };
  const renderSearch = ({ preserveSelection = false } = {}) => {
    if (searchComposing) return;
    const keyword = searchInput.value.trim();
    const previousCode = preserveSelection ? searchResults[searchIndex]?.binaryCode : null;
    const coreReady = Boolean(state.index?.byCode?.size && state.hexagrams.length && state.trigrams.length);
    const matches = keyword && coreReady ? searchHexagrams(state.hexagrams, keyword, {
      trigrams: state.trigrams,
      keywords: searchKeywords || state.starMap?.keywords || {},
    }) : [];
    searchResults = matches.slice(0, 8);
    searchIndex = -1;
    searchInput.removeAttribute('aria-activedescendant');
    searchResultsEl.replaceChildren();
    if (!keyword) {
      closeSearch();
      return;
    }
    if (!coreReady) {
      searchStatusEl.textContent = '搜索资料尚未就绪，请稍后重试。';
    } else if (!searchResults.length) {
      searchStatusEl.textContent = parseHexagramQuery(keyword).kind === 'invalid'
        ? '没有找到相关卦象。卦序为1—64，卦码须为六位0或1。'
        : '没有找到相关卦象';
    } else {
      searchStatusEl.textContent = matches.length > 8 ? `找到${matches.length}卦，显示前8项。` : `找到${matches.length}卦。`;
      searchResults.forEach((hexagram, index) => {
        const option = document.createElement('button');
        option.type = 'button';
        option.id = `search-option-${index}`;
        option.className = 'search-option';
        option.tabIndex = -1;
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
    }
    if (coreReady && searchKeywordsFailed) {
      searchStatusEl.textContent += ' 关键词暂不可用，卦名、卦序、编码、上下卦和经文仍可检索。';
    }
    searchPopupEl.hidden = false;
    searchResultsEl.hidden = false;
    searchInput.setAttribute('aria-expanded', 'true');
    if (previousCode) {
      searchIndex = searchResults.findIndex((hexagram) => hexagram.binaryCode === previousCode);
      updateSearchSelection();
    }
    if (coreReady) ensureSearchKeywords();
  };
  const updateSearchSelection = () => {
    searchResultsEl.querySelectorAll('.search-option').forEach((option, index) => {
      const selected = index === searchIndex;
      option.classList.toggle('active', selected);
      option.setAttribute('aria-selected', String(selected));
      if (selected) {
        searchInput.setAttribute('aria-activedescendant', option.id);
        option.scrollIntoView({ block: 'nearest' });
      }
    });
  };
  searchInput.addEventListener('compositionstart', () => {
    searchComposing = true;
    closeSearch();
  });
  searchInput.addEventListener('compositionend', () => {
    searchComposing = false;
    if (document.activeElement === searchInput) renderSearch();
  });
  searchInput.addEventListener('input', (event) => {
    if (!event.isComposing) renderSearch();
  });
  searchInput.addEventListener('focus', () => {
    if (searchKeywordsFailed) {
      searchKeywordsAttempted = false;
      searchKeywordsFailed = false;
    }
    renderSearch();
  });
  searchInput.addEventListener('keydown', (event) => {
    if (event.isComposing || event.keyCode === 229 || searchComposing ||
        searchInput.getAttribute('aria-expanded') !== 'true') return;
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      searchIndex = moveSelection(searchIndex, event.key, searchResults.length);
      updateSearchSelection();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      selectSearchResult(searchIndex >= 0 ? searchIndex : 0);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      closeSearch();
    }
  });
  searchResultsEl.addEventListener('mousedown', (event) => event.preventDefault());
  searchResultsEl.addEventListener('click', (event) => {
    const option = event.target.closest('.search-option');
    if (option) selectSearchResult(Number.parseInt(option.dataset.index, 10));
  });
  document.addEventListener('pointerdown', (event) => {
    if (!searchBox.contains(event.target)) closeSearch();
  });
  searchBox.addEventListener('focusout', (event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) closeSearch();
  });
  window.addEventListener('popstate', (event) => {
    const code = getHexCodeFromUrl(window.location.href);
    if (code && state.index.byCode.has(code)) openDetail(code, null, { historyMode: 'none' });
    else if (event.state?.reading?.stage === 'quick' && state.index.byCode.has(event.state.reading.readingCode)) {
      openReading(event.state.reading.readingCode, 'quick', null, { historyMode: 'none' });
    } else {
      closeDetail({ updateUrl: false });
      const focusedCode = event.state?.reading?.focusedCode;
      if (state.index.byCode.has(focusedCode)) focusHexagram(focusedCode, { historyMode: 'none' });
      else {
        state.reading = createReadingState();
        state.starMap?.clearFocus();
        syncReadingPresentation();
      }
    }
    if (state.reading.stage !== 'none' && event.state?.reading?.section) {
      window.requestAnimationFrame(() => selectReadingSection(event.state.reading.section, { updateHistory: false }));
    }
  });

  let resizeFrame = null;
  const scheduleStarMapResize = () => {
    if (resizeFrame) return;
    resizeFrame = window.requestAnimationFrame(() => {
      resizeFrame = null;
      state.starMap?.resize();
      syncReservedRects();
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
    state.reading = createReadingState();
    state.starMap.clearFocus();
    syncReadingPresentation();
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
      onExitFocus: stepBackReading,
      onPick: (code) => {
        cinematicMotion.previewHexagram(null);
        focusHexagram(code);
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
      dailyOverlay.setAttribute('aria-hidden', 'true');
      setDailyBackgroundInert(false);
      openDetail(initialCode, null, { historyMode: 'replace' });
    } else if (dailySeen) {
      dailyOverlay.hidden = true;
      dailyOverlay.setAttribute('aria-hidden', 'true');
      setDailyBackgroundInert(false);
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
