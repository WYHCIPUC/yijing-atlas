// 易象图谱入口：模式切换器 + 星图 + 详情抽屉。
import { loadAllData, buildHexagramIndex, searchHexagrams } from './data-loader.js';
import { buildRelationGraph } from './star-relations.js';
import { StarMap } from './star-map.js';
import { renderHexagramDetail } from './render.js';
import { hexagramSvg } from './svg-painter.js';

const state = { hexagrams: [], trigrams: [], index: null, starMap: null, currentDetail: null };

// === 今日卦 ===
// 按今年第N天对64取模推算今日卦，每天一卦循环
function getDailyHexagram(hexagrams) {
  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((now - yearStart) / 86400000);
  const idx = dayOfYear % 64;
  return hexagrams[idx];
}

// 选取一句核心爻辞作为今日箴言
function getDailyVerse(hex) {
  // 优先九五/六五，其次卦辞
  const yao5 = hex.lines.find(y => y.position === 5);
  if (yao5 && yao5.text) {
    const text = yao5.text.replace(/^[^：]*：/, '').replace(/。$/, '');
    return { text, src: `${hex.name}·${yao5.position === 5 ? (yao5.isYang ? '九五' : '六五') : ''}` };
  }
  const j = hex.judgement.replace(/^[^：]*：/, '').replace(/。$/, '');
  return { text: j, src: `${hex.name}·卦辞` };
}

function showDailyHexagram() {
  const hex = getDailyHexagram(state.hexagrams);
  if (!hex) return;
  const now = new Date();
  const dateStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;
  document.getElementById('daily-date').textContent = dateStr;
  document.getElementById('daily-hex-svg').innerHTML = hexagramSvg(hex.binaryCode, { size: 100 });
  document.getElementById('daily-hex-name').textContent = hex.name;
  document.getElementById('daily-hex-full').textContent = hex.fullName;
  const verse = getDailyVerse(hex);
  document.getElementById('daily-verse').textContent = `「${verse.text}」`;
  document.getElementById('daily-verse-src').textContent = `—— ${verse.src}`;
  // 进入星图按钮：淡出欢迎层，星图聚焦今日卦
  document.getElementById('daily-enter').addEventListener('click', () => {
    document.getElementById('daily-overlay').classList.add('hidden');
    // 短暂延迟后聚焦今日卦
    setTimeout(() => {
      if (state.starMap) state.starMap.focusStar(hex.binaryCode);
    }, 300);
  });
}

const loadingEl = document.getElementById('loading');
const canvas = document.getElementById('star-canvas');
const panel = document.getElementById('detail-panel');
const panelContent = document.getElementById('detail-content');
const searchInput = document.getElementById('search');

function openDetail(code, fromCode = null) {
  const hex = state.index.byCode.get(code);
  if (!hex) return;
  renderHexagramDetail(hex, panelContent, state.hexagrams, (relCode) => {
    openDetail(relCode, code); // 关系跳转：记录从哪来
  });
  panel.classList.add('open');
  // 记录漫游轨迹
  if (fromCode && state.starMap) state.starMap.addTrail(fromCode, code);
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
    document.getElementById('trail-clear').addEventListener('click', () => { state.starMap.clearTrail(); state.starMap.clearFocus(); });
    // 滚轮缩放也实时更新百分比
    canvas.addEventListener('wheel', () => setTimeout(updateZoom, 50), { passive: true });

    loadingEl.style.display = 'none';
    // 显示今日卦首页
    showDailyHexagram();
  } catch (e) {
    loadingEl.innerHTML = `⚠ 数据加载失败：${e.message}`;
    loadingEl.classList.remove('loading-screen');
    loadingEl.classList.add('error-screen');
    console.error(e);
  }
}

init();
