// 易象图谱入口：只负责数据初始化、全局状态与模式调度。
import { playHexagramSound } from './audio-engine.js';
import * as dataLoader from './data-loader.js';
import { renderHexagramDetail } from './render.js';
import { getHexCodeFromUrl, moveSelection, withHexCode } from './search-controller.js';
import { buildRelationGraph } from './star-relations.js';
import { StarMap } from './star-map.js';
import { hexagramSvg } from './svg-painter.js';

const { buildHexagramIndex, searchHexagrams } = dataLoader;

const modeLoaders = {
  almanac: () => import('./almanac-page.js').then((module) => module.renderAlmanacPage),
  divination: () => import('./modes/divination-mode.js').then((module) => module.renderDivinationMode),
  guaxu: () => import('./modes/guaxu-mode.js').then((module) => module.renderGuaxuMode),
  learning: () => import('./modes/learning-mode.js').then((module) => module.renderLearningMode),
  quiz: () => import('./modes/quiz-mode.js').then((module) => module.renderQuizMode),
  review: () => import('./modes/review-mode.js').then((module) => module.renderReviewMode),
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
  currentDetail: null,
  currentMode: 'explore',
};

const loadingEl = document.getElementById('loading');
const canvas = document.getElementById('star-canvas');
const panel = document.getElementById('detail-panel');
const panelContent = document.getElementById('detail-content');
const panelLayoutSelect = document.getElementById('detail-layout');
const panelSizeButton = document.getElementById('detail-size');
const searchInput = document.getElementById('search');
const searchResultsEl = document.getElementById('search-results');
const dailyOverlay = document.getElementById('daily-overlay');
const modeSwitcher = document.getElementById('mode-switcher');
const compactPanelQuery = window.matchMedia('(max-width: 900px)');
let modeRequestId = 0;
let panelReturnFocus = null;
let searchResults = [];
let searchIndex = -1;

const DAILY_SEEN_KEY = 'yijing-daily-seen';
const PANEL_LAYOUT_KEY = 'yijing-panel-layout';
const DRAWER_SIZE_KEY = 'yijing-drawer-size';
const DRAWER_SIZES = ['compact', 'medium', 'large'];

function readPanelLayout() {
  try {
    const layout = localStorage.getItem(PANEL_LAYOUT_KEY);
    return ['bottom', 'left', 'right'].includes(layout) ? layout : 'bottom';
  } catch {
    return 'bottom';
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
  state.starMap?.pause?.();
  const now = new Date();
  const verse = getDailyVerse(hex);
  document.getElementById('daily-date').textContent = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;
  document.getElementById('daily-hex-svg').innerHTML = hexagramSvg(hex.binaryCode, { size: 100 });
  document.getElementById('daily-hex-name').textContent = hex.name;
  document.getElementById('daily-hex-full').textContent = hex.fullName;
  document.getElementById('daily-verse').textContent = `「${verse.text}」`;
  document.getElementById('daily-verse-src').textContent = `—— ${verse.source}`;

  document.getElementById('daily-enter').addEventListener('click', () => {
    try { sessionStorage.setItem(DAILY_SEEN_KEY, '1'); } catch {}
    dailyOverlay.classList.add('hidden');
    setMode('explore');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.setTimeout(() => {
      dailyOverlay.hidden = true;
      state.starMap?.resume?.();
      state.starMap?.focusStar(hex.binaryCode);
      canvas.focus();
    }, reducedMotion ? 0 : 180);
  }, { once: true });
}

function openPanel() {
  if (!panel.classList.contains('open')) panelReturnFocus = document.activeElement;
  panel.inert = false;
  panel.classList.add('open');
  panel.setAttribute('aria-hidden', 'false');
  panel.setAttribute('aria-modal', String(compactPanelQuery.matches));
  document.body.classList.add('panel-open');
  state.starMap?.resize();
  panel.scrollTop = 0;
  window.requestAnimationFrame(() => panel.querySelector('h1, h2, button')?.focus());
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
    updateModeButtons('explore');
    state.starMap?.setReviewDue(null);
    state.starMap?.setMode('explore');
  }
  if (restoreFocus) {
    const target = panelReturnFocus?.isConnected ? panelReturnFocus : canvas;
    target.focus();
  }
}

function bindShareAction(code) {
  const button = panelContent.querySelector('.share-hexagram');
  const status = panelContent.querySelector('.share-status');
  if (!button || !status) return;
  button.addEventListener('click', async () => {
    const url = withHexCode(window.location.href, code);
    try {
      if (navigator.share) await navigator.share({ title: document.title, url });
      else await navigator.clipboard.writeText(url);
      status.textContent = navigator.share ? '已打开分享面板' : '链接已复制';
    } catch (error) {
      if (error?.name !== 'AbortError') status.textContent = '分享失败，请复制浏览器地址';
    }
  });
}

function openDetail(code, fromCode = null, { historyMode = 'push' } = {}) {
  const hex = state.index.byCode.get(code);
  if (!hex) return;
  renderHexagramDetail(hex, panelContent, state.hexagrams, (relatedCode) => openDetail(relatedCode, code));
  if (historyMode !== 'none') updateDetailUrl(code, historyMode);
  bindShareAction(code);
  openPanel();
  try { playHexagramSound(code); } catch {}
  if (fromCode) state.starMap?.addTrail(fromCode, code);
  state.currentDetail = code;
  state.starMap?.focusStar(code);
}

function updateModeButtons(mode) {
  document.querySelectorAll('.mode-btn').forEach((button) => {
    const selected = button.dataset.mode === mode;
    button.classList.toggle('active', selected);
    button.setAttribute('aria-pressed', String(selected));
    button.tabIndex = selected ? 0 : -1;
    if (selected && modeSwitcher.scrollWidth > modeSwitcher.clientWidth) {
      window.requestAnimationFrame(() => button.scrollIntoView({ block: 'nearest', inline: 'center' }));
    }
  });
}

async function loadModeResources(mode) {
  if (mode === 'learning' && dataLoader.loadLearningData) {
    Object.assign(state, await dataLoader.loadLearningData());
  }
  if ((mode === 'almanac' || mode === 'quiz') && dataLoader.loadAlmanacData) {
    Object.assign(state, await dataLoader.loadAlmanacData());
  }
}

async function setMode(mode) {
  const requestId = ++modeRequestId;
  state.currentMode = mode;
  updateModeButtons(mode);
  state.starMap?.setReviewDue(null);
  state.starMap?.setMode(mode);

  if (mode === 'explore') {
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
  panelContent.innerHTML = '<div class="mode-loading" role="status">正在载入内容…</div>';
  try {
    const [renderer] = await Promise.all([loadRenderer(), loadModeResources(mode)]);
    if (requestId !== modeRequestId || state.currentMode !== mode) return;
    if (mode === 'guaxu') {
      renderer(panelContent, state, (code) => {
        setMode('explore');
        openDetail(code);
      });
    } else if (mode === 'learning') {
      renderer(panelContent, state, () => setMode('explore'));
    } else {
      renderer(panelContent, state);
    }
  } catch (error) {
    if (requestId !== modeRequestId) return;
    const errorMessage = document.createElement('div');
    errorMessage.className = 'mode-error';
    errorMessage.setAttribute('role', 'alert');
    errorMessage.textContent = `内容加载失败：${String(error.message || error)}`;
    panelContent.replaceChildren(errorMessage);
  }
}

function bindGlobalInteractions() {
  const modeButtons = [...document.querySelectorAll('.mode-btn')];
  modeButtons.forEach((button) => {
    button.addEventListener('click', () => setMode(button.dataset.mode));
  });
  modeSwitcher.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const current = modeButtons.indexOf(document.activeElement);
    const next = moveSelection(current, event.key === 'ArrowRight' ? 'ArrowDown' :
      event.key === 'ArrowLeft' ? 'ArrowUp' : event.key, modeButtons.length);
    modeButtons[next]?.focus();
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
    if (event.key === 'Escape' && panel.classList.contains('open')) {
      closeDetail({ restoreFocus: true });
      return;
    }
    if (event.key !== 'Tab' || !compactPanelQuery.matches || !panel.classList.contains('open')) return;
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
      empty.textContent = '没有找到相关卦象';
      searchResultsEl.append(empty);
    } else {
      searchResults.forEach((hexagram, index) => {
        const option = document.createElement('button');
        option.type = 'button';
        option.id = `search-option-${index}`;
        option.className = 'search-option';
        option.setAttribute('role', 'option');
        option.dataset.index = String(index);
        option.textContent = `${hexagram.number}. ${hexagram.name} · ${hexagram.fullName}`;
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
  window.addEventListener('resize', () => {
    if (resizeFrame) return;
    resizeFrame = window.requestAnimationFrame(() => {
      resizeFrame = null;
      state.starMap?.resize();
    });
  });

  const zoomLevel = document.getElementById('zoom-level');
  const updateZoom = () => { zoomLevel.textContent = `${state.starMap.getZoomPercent()}%`; };
  document.getElementById('zoom-in').addEventListener('click', () => { state.starMap.zoomBy(1.25); updateZoom(); });
  document.getElementById('zoom-out').addEventListener('click', () => { state.starMap.zoomBy(0.8); updateZoom(); });
  document.getElementById('zoom-reset').addEventListener('click', () => { state.starMap.zoomReset(); updateZoom(); });
  document.getElementById('trail-clear').addEventListener('click', () => {
    state.starMap.clearTrail();
    state.starMap.clearFocus();
  });
  canvas.addEventListener('wheel', () => window.setTimeout(updateZoom, 50), { passive: true });
}

async function init() {
  try {
    // 旧版 Service Worker 可能仍缓存只导出 loadAllData 的模块；首次升级时保持兼容。
    const loadInitialData = dataLoader.loadCoreData || dataLoader.loadAllData;
    if (!loadInitialData) throw new Error('缺少数据加载入口');
    const data = await loadInitialData();
    Object.assign(state, data);
    state.index = buildHexagramIndex(data.hexagrams);
    state.starMap = new StarMap(canvas, buildRelationGraph(data.hexagrams), {
      onPick: (code) => openDetail(code),
      onHover: () => {},
    });
    bindGlobalInteractions();
    updateModeButtons('explore');
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

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).catch((error) => {
      console.warn('离线缓存注册失败', error);
    });
  });
}
