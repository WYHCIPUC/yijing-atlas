// 易象图谱入口：模式切换器 + 星图 + 详情抽屉。
import { loadAllData, buildHexagramIndex, searchHexagrams } from './data-loader.js';
import { buildRelationGraph } from './star-relations.js';
import { StarMap } from './star-map.js';
import { renderHexagramDetail } from './render.js';
import { hexagramSvg } from './svg-painter.js';
import { loadReviewCards, initAllCards, getDueCards, getDueCount, saveReview, getMastery } from './review-engine.js';

const reviewCards = loadReviewCards();

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
  if (mode === 'explore') {
    state.starMap && state.starMap.setReviewDue(null);
    closeDetail();
  } else if (mode === 'review') {
    // 复习模式：初始化复习卡，高亮待复习卦
    initAllCards(reviewCards, state.hexagrams.map(h => h.binaryCode));
    const dueCodes = getDueCards(reviewCards);
    state.starMap && state.starMap.setReviewDue(dueCodes);
    showReviewPanel(dueCodes);
  } else {
    const labels = {quiz:'测验',divination:'占筮',almanac:'黄历'};
    const phase = (mode==='quiz') ? 2 : 3;
    panelContent.innerHTML = `<div style="padding:60px;text-align:center;color:#7a6a4a">
      <h2 style="color:#a08850;margin-bottom:12px">${labels[mode]}模式</h2>
      <p>此模式将在第 ${phase} 期实现。</p>
    </div>`;
    panel.classList.add('open');
  }
}

// 复习模式面板：显示待复习列表 + 翻转卡片
function showReviewPanel(dueCodes) {
  const dueHex = dueCodes.map(c => state.index.byCode.get(c)).filter(Boolean);
  panelContent.innerHTML = `
    <div style="padding:36px 26px">
      <h2 style="color:#e8d09a;font-size:1.4rem;margin-bottom:8px">复习</h2>
      <p style="color:#a89878;font-size:0.88rem;margin-bottom:20px">
        今日待复习 <strong style="color:#e8d09a">${dueHex.length}</strong> 卦。
        点击星图上脉冲闪烁的卦开始复习。
      </p>
      <div style="display:flex;flex-wrap:wrap;gap:8px">
        ${dueHex.slice(0, 20).map(h => `<span class="relation-chip" data-code="${h.binaryCode}">${h.name}</span>`).join('')}
      </div>
      ${dueHex.length === 0 ? '<p style="color:#888;margin-top:20px">今日无待复习卦。明天再来！</p>' : ''}
    </div>
  `;
  panel.classList.add('open');
  // chip 点击进入翻转卡片复习
  panelContent.querySelectorAll('.relation-chip').forEach(chip => {
    chip.addEventListener('click', () => startReviewCard(chip.dataset.code));
  });
}

// 翻转卡片复习某卦
function startReviewCard(code) {
  const hex = state.index.byCode.get(code);
  if (!hex) return;
  panelContent.innerHTML = `
    <div class="flip-card" id="flip-card">
      <div class="flip-card-inner" id="flip-inner">
        <div class="flip-card-front">
          <div style="color:#888;font-size:0.78rem;margin-bottom:12px">回忆一下这卦</div>
          <div style="font-size:0.9rem;color:#a89878;margin-bottom:8px">第 ${hex.number} 卦 · 下${hex.trigramLower} 上${hex.trigramUpper}</div>
          <div style="color:#5a6680;font-size:0.82rem;margin-top:24px">点击翻转看答案</div>
        </div>
        <div class="flip-card-back">
          ${hexagramSvg(hex.binaryCode, { size: 80 })}
          <div style="font-size:1.6rem;color:#e8d09a;font-family:'Ma Shan Zheng',serif;margin:8px 0">${hex.name} · ${hex.fullName}</div>
          <div style="color:#c9a96a;font-size:0.92rem;line-height:1.7">${hex.judgement || ''}</div>
        </div>
      </div>
    </div>
    <div class="review-rating" id="review-rating" style="display:none">
      <p style="color:#888;font-size:0.82rem;text-align:center;margin-bottom:14px">你记得吗？</p>
      <div style="display:flex;gap:10px;justify-content:center">
        <button class="rate-btn rate-forgot" data-rate="0">忘了</button>
        <button class="rate-btn rate-fuzzy" data-rate="1">模糊</button>
        <button class="rate-btn rate-remember" data-rate="2">记得</button>
      </div>
    </div>
  `;
  // 翻转交互
  const flipCard = document.getElementById('flip-card');
  const flipInner = document.getElementById('flip-inner');
  const rating = document.getElementById('review-rating');
  let flipped = false;
  flipCard.addEventListener('click', () => {
    if (!flipped) {
      flipInner.classList.add('flipped');
      rating.style.display = 'block';
      flipped = true;
    }
  });
  // 评分
  rating.querySelectorAll('.rate-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const rate = parseInt(btn.dataset.rate);
      saveReview(reviewCards, code, rate);
      // 返回复习列表
      const dueCodes = getDueCards(reviewCards);
      state.starMap && state.starMap.setReviewDue(dueCodes);
      showReviewPanel(dueCodes);
    });
  });
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
