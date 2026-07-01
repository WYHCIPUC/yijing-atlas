// 入口：初始化、路由、加载数据。
import { loadAllData, buildHexagramIndex, searchHexagrams } from './data-loader.js';
import { renderHexagramList, renderHexagramDetail, renderTrigrams } from './render.js';
import { renderReviewPage } from './review-page.js';
import { renderQuizPage } from './quiz-page.js';
import { renderWingsPage, renderTheoremsPage, renderStudyPathPage } from './study-page.js';
import { renderDivinationPage } from './divination-page.js';
import { renderAlmanacPage } from './almanac-page.js';
import { renderAlmanacKnowledgePage } from './almanac-knowledge.js';

const state = { hexagrams: [], trigrams: [], wings: [], theorems: [], almanacTerms: [], almanacYiji: {}, index: null };
const appEl = document.getElementById('app');

function showError(msg) {
  appEl.innerHTML = `<div class="error">⚠ ${msg}</div>`;
}

// 路由：基于 location.hash
function route() {
  const hash = location.hash || '#/library';
  const path = hash.replace(/^#/, '');

  // 高亮当前 Tab（wings/theorems 归入 study）
  const activeRoute = path.startsWith('/wings') || path.startsWith('/theorems')
      ? 'study'
      : path.split('/')[1];
  document.querySelectorAll('.tab').forEach((t) => {
    t.classList.toggle('active', t.dataset.route === activeRoute);
  });

  if (path.startsWith('/hexagram/')) {
    const code = path.replace('/hexagram/', '');
    showDetail(code);
  } else if (path.startsWith('/trigrams')) {
    showTrigrams();
  } else if (path.startsWith('/study')) {
    renderStudyPathPage(appEl, state);
  } else if (path.startsWith('/wings')) {
    renderWingsPage(appEl, state);
  } else if (path.startsWith('/theorems')) {
    renderTheoremsPage(appEl, state);
  } else if (path.startsWith('/review')) {
    renderReviewPage(appEl, state);
  } else if (path.startsWith('/quiz')) {
    renderQuizPage(appEl, state);
  } else if (path.startsWith('/divination')) {
    renderDivinationPage(appEl, state);
  } else if (path.startsWith('/almanac-knowledge')) {
    renderAlmanacKnowledgePage(appEl, state);
  } else if (path.startsWith('/almanac')) {
    renderAlmanacPage(appEl, state);
  } else {
    showLibrary();
  }
}

function showLibrary() {
  appEl.innerHTML = `
    <div class="search-bar"><input id="search" type="search" placeholder="搜索卦名/卦辞/爻辞…" /></div>
    <div id="list-mount"></div>`;
  const input = document.getElementById('search');
  const listMount = document.getElementById('list-mount');
  const draw = () => {
    const kw = input.value.trim();
    const list = kw ? searchHexagrams(state.hexagrams, kw) : state.hexagrams;
    renderHexagramList(list, listMount, (code) => { location.hash = `/hexagram/${code}`; });
    if (kw && list.length === 0) {
      listMount.insertAdjacentHTML('beforeend', '<p class="loading">未找到匹配的卦</p>');
    }
  };
  input.addEventListener('input', draw);
  draw();
}

function showDetail(code) {
  const hex = state.index.byCode.get(code);
  if (!hex) { showError('未找到该卦'); return; }
  renderHexagramDetail(hex, appEl);
  appEl.insertAdjacentHTML('afterbegin', '<a class="back-btn" href="#/library">← 返回</a>');
  window.scrollTo(0, 0);
}

function showTrigrams() {
  renderTrigrams(state.trigrams, appEl);
}

async function init() {
  try {
    const data = await loadAllData();
    state.hexagrams = data.hexagrams;
    state.trigrams = data.trigrams;
    state.wings = data.wings;
    state.theorems = data.theorems;
    state.almanacTerms = data.almanacTerms;
    state.almanacYiji = data.almanacYiji;
    state.index = buildHexagramIndex(data.hexagrams);
    window.addEventListener('hashchange', route);
    route();
  } catch (e) {
    showError(`数据加载/校验失败：${e.message}`);
    console.error(e);
  }
}

init();
