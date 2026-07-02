// 易象图谱入口：模式切换器 + 星图 + 详情抽屉。
import { loadAllData, buildHexagramIndex, searchHexagrams } from './data-loader.js';
import { buildRelationGraph } from './star-relations.js';
import { StarMap } from './star-map.js';
import { renderHexagramDetail } from './render.js';

const state = { hexagrams: [], trigrams: [], index: null, starMap: null, currentDetail: null };

const loadingEl = document.getElementById('loading');
const canvas = document.getElementById('star-canvas');
const panel = document.getElementById('detail-panel');
const panelContent = document.getElementById('detail-content');
const searchInput = document.getElementById('search');

function openDetail(code) {
  const hex = state.index.byCode.get(code);
  if (!hex) return;
  renderHexagramDetail(hex, panelContent, state.hexagrams, (relCode) => {
    openDetail(relCode);
  });
  panel.classList.add('open');
  state.currentDetail = code;
  state.starMap && state.starMap.focusStar(code);
}

function closeDetail() {
  panel.classList.remove('open');
  state.currentDetail = null;
}

function setMode(mode) {
  document.querySelectorAll('.mode-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.mode === mode);
  });
  state.starMap && state.starMap.setMode(mode);
  if (mode !== 'explore') {
    const labels = {review:'复习',quiz:'测验',divination:'占筮',almanac:'黄历'};
    const phase = (mode==='review'||mode==='quiz') ? 2 : 3;
    panelContent.innerHTML = `<div style="padding:60px;text-align:center;color:#7a6a4a">
      <h2 style="color:#a08850;margin-bottom:12px">${labels[mode]}模式</h2>
      <p>此模式将在第 ${phase} 期实现。</p>
      <p style="margin-top:8px">当前请使用「探索」模式漫游星图。</p>
    </div>`;
    panel.classList.add('open');
  } else {
    closeDetail();
  }
}

async function init() {
  try {
    const data = await loadAllData();
    state.hexagrams = data.hexagrams;
    state.trigrams = data.trigrams;
    state.index = buildHexagramIndex(data.hexagrams);

    const graph = buildRelationGraph(data.hexagrams);
    state.starMap = new StarMap(canvas, graph, {
      onPick: (code) => openDetail(code),
      onHover: (code) => {},
    });

    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', () => setMode(btn.dataset.mode));
    });
    document.getElementById('detail-close').addEventListener('click', closeDetail);
    searchInput.addEventListener('input', (e) => {
      const kw = e.target.value.trim();
      if (!kw) return;
      const results = searchHexagrams(state.hexagrams, kw);
      if (results.length > 0) {
        state.starMap.focusStar(results[0].binaryCode);
      }
    });
    window.addEventListener('resize', () => state.starMap && state.starMap.resize());

    // 缩放控件
    const zoomLevel = document.getElementById('zoom-level');
    const updateZoom = () => { if (zoomLevel) zoomLevel.textContent = state.starMap.getZoomPercent() + '%'; };
    document.getElementById('zoom-in').addEventListener('click', () => { state.starMap.zoomBy(1.25); updateZoom(); });
    document.getElementById('zoom-out').addEventListener('click', () => { state.starMap.zoomBy(0.8); updateZoom(); });
    document.getElementById('zoom-reset').addEventListener('click', () => { state.starMap.zoomReset(); updateZoom(); });
    // 滚轮缩放也实时更新百分比
    canvas.addEventListener('wheel', () => setTimeout(updateZoom, 50), { passive: true });

    loadingEl.style.display = 'none';
  } catch (e) {
    loadingEl.innerHTML = `⚠ 数据加载失败：${e.message}`;
    loadingEl.classList.remove('loading-screen');
    loadingEl.classList.add('error-screen');
    console.error(e);
  }
}

init();
