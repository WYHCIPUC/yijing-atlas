// 复习页：翻转卡片 + 自评（忘了/模糊/记得）+ 进度面板。
// 交互由本模块管理，挂载到 #app。
import { hexagramSvg } from './svg-painter.js';
import { yaoLabel } from './hexagram-utils.js';
import {
  buildCardIds, buildAlmanacCardIds, loadProgress, saveProgress, getCard,
  dueCards, scheduleCard, masteryStats,
} from './review-engine.js';

let state = null;

// 根据 cardId 解析出要展示的内容（正面提示 / 背面答案）
function resolveCard(cardId, st) {
  if (cardId.startsWith('h:')) {
    const code = cardId.slice(2);
    const h = st.index.byCode.get(code);
    if (!h) return null;
    return {
      front: `${h.number}.${h.name}（${h.fullName}）的卦辞是？`,
      frontSvg: hexagramSvg(code, { size: 100 }),
      back: h.judgement || '（无卦辞）',
      backExtra: h.image,
    };
  } else if (cardId.startsWith('y:')) {
    const [, code, posStr] = cardId.split(':');
    const h = st.index.byCode.get(code);
    if (!h) return null;
    const yao = h.lines.find((y) => y.position === Number(posStr));
    if (!yao) return null;
    const label = yaoLabel(yao.position, yao.isYang);
    return {
      front: `${h.name}卦 · ${label} 的爻辞是？`,
      frontSvg: hexagramSvg(code, { size: 80 }),
      back: yao.text || '（无爻辞）',
      backExtra: yao.xiang ? `象曰：${yao.xiang}` : '',
    };
  } else if (cardId.startsWith('t:')) {
    const id = cardId.slice(2);
    const t = (st.almanacTerms || []).find((x) => (x.id || x.name) === id);
    if (!t) return null;
    return {
      front: `黄历术语「${t.name}」是什么？`,
      frontSvg: '',
      back: t.meaning || '（无释义）',
      backExtra: [t.yi && t.yi.length ? `宜：${t.yi.join('、')}` : '',
                  t.ji && t.ji.length ? `忌：${t.ji.join('、')}` : '']
        .filter(Boolean).join('；'),
    };
  }
  return null;
}

export function renderReviewPage(mountEl, appState) {
  const { hexagrams, index, almanacTerms } = appState;
  state = {
    hexagrams, index, almanacTerms: almanacTerms || [],
    yiIds: buildCardIds(hexagrams),
    almanacIds: buildAlmanacCardIds(almanacTerms),
    source: 'yi', // 'yi' 易经 | 'almanac' 黄历 | 'all' 全部
    progress: loadProgress(),
    queue: [],
    current: null,
    flipped: false,
    reviewedCount: 0,
  };
  state.allIds = state.yiIds;
  refreshQueue();
  drawDashboard(mountEl);
}

function currentIds() {
  if (state.source === 'almanac') return state.almanacIds;
  if (state.source === 'all') return [...state.yiIds, ...state.almanacIds];
  return state.yiIds;
}
function refreshQueue() {
  state.allIds = currentIds();
  state.queue = dueCards(state.progress, state.allIds, 30);
}

function drawDashboard(mountEl) {
  const stats = masteryStats(state.progress, state.allIds);
  const due = state.queue.length;

  mountEl.innerHTML = `
    <div class="review-panel">
      <div class="source-switch">
        <button class="src-btn ${state.source==='yi'?'active':''}" data-src="yi">易经（${state.yiIds.length}）</button>
        <button class="src-btn ${state.source==='almanac'?'active':''}" data-src="almanac">黄历（${state.almanacIds.length}）</button>
        <button class="src-btn ${state.source==='all'?'active':''}" data-src="all">全部（${state.yiIds.length+state.almanacIds.length}）</button>
      </div>
      <div class="review-stats">
        <div class="stat"><span class="stat-num">${due}</span><span class="stat-label">今日待复习</span></div>
        <div class="stat"><span class="stat-num">${stats.learned}</span><span class="stat-label">已学习</span></div>
        <div class="stat"><span class="stat-num">${stats.mastered}</span><span class="stat-label">已掌握</span></div>
        <div class="stat"><span class="stat-num">${stats.total}</span><span class="stat-label">总卡片</span></div>
      </div>
      <div class="progress-bar">
        <div class="progress-fill" style="width:${Math.round(stats.mastered / stats.total * 100)}%"></div>
      </div>
      <p class="progress-text">掌握度 ${Math.round(stats.mastered / stats.total * 100)}%（${stats.mastered}/${stats.total}）</p>
      ${due > 0
        ? `<button class="primary-btn" id="start-review">开始复习（${due} 张）</button>`
        : `<div class="all-done">🎉 今日复习已完成！<br/><small>下次到期时会出现在这里</small></div>`}
      <p class="review-hint"><small>当前题源共 ${stats.total} 张卡片。易经含「卦级/爻级」，黄历含术语释义。</small></p>
    </div>`;

  const btn = document.getElementById('start-review');
  if (btn) btn.addEventListener('click', () => startCard(mountEl));
  // 题源切换
  mountEl.querySelectorAll('.src-btn').forEach((b) => {
    b.addEventListener('click', () => {
      state.source = b.dataset.src;
      refreshQueue();
      drawDashboard(mountEl);
    });
  });
}

function startCard(mountEl) {
  if (state.queue.length === 0) { drawDashboard(mountEl); return; }
  state.current = state.queue.shift();
  state.flipped = false;
  drawCard(mountEl);
}

function drawCard(mountEl) {
  const content = resolveCard(state.current, state);
  if (!content) { startCard(mountEl); return; }

  mountEl.innerHTML = `
    <div class="card-view">
      <div class="card-counter">第 ${state.reviewedCount + 1} 张 · 剩余 ${state.queue.length}</div>
      <div class="flashcard ${state.flipped ? 'flipped' : ''}" id="flashcard">
        ${state.flipped ? `
          <div class="card-face card-back">
            ${content.frontSvg || ''}
            <p class="card-answer">${esc(content.back)}</p>
            ${content.backExtra ? `<p class="card-extra">${esc(content.backExtra)}</p>` : ''}
          </div>
        ` : `
          <div class="card-face card-front">
            ${content.frontSvg || ''}
            <p class="card-prompt">${esc(content.front)}</p>
            <p class="card-tap-hint">点击卡片查看答案</p>
          </div>
        `}
      </div>
      ${state.flipped ? `
        <div class="rate-buttons">
          <button class="rate-btn rate-forgot" data-rate="forgot">😵 忘了</button>
          <button class="rate-btn rate-fuzzy" data-rate="fuzzy">🤔 模糊</button>
          <button class="rate-btn rate-remembered" data-rate="remembered">😊 记得</button>
        </div>
      ` : ''}
    </div>`;

  // 点击卡片翻转
  const card = document.getElementById('flashcard');
  if (card) {
    card.addEventListener('click', () => {
      if (!state.flipped) {
        state.flipped = true;
        drawCard(mountEl);
      }
    });
  }
  // 自评按钮
  mountEl.querySelectorAll('.rate-btn').forEach((btn) => {
    btn.addEventListener('click', () => rateCard(mountEl, btn.dataset.rate));
  });
}

function rateCard(mountEl, quality) {
  const newProgress = scheduleCard(getCard(state.progress, state.current), quality);
  state.progress[state.current] = newProgress;
  saveProgress(state.progress);
  state.reviewedCount++;
  startCard(mountEl);
}

function esc(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
