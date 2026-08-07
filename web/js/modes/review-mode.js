import { hexagramSvg } from '../svg-painter.js';
import { getDueCards, initAllCards, loadReviewCards, saveReview } from '../review-engine.js';
import { recordActivity } from '../learning-progress.js';

let reviewCards = null;

export function renderReviewMode(mountEl, appState) {
  if (!reviewCards) reviewCards = loadReviewCards();
  initAllCards(reviewCards, appState.hexagrams.map((hex) => hex.binaryCode));
  renderDueList(mountEl, appState);
}

function renderDueList(mountEl, appState) {
  const dueCodes = getDueCards(reviewCards);
  const dueHexagrams = dueCodes.map((code) => appState.index.byCode.get(code)).filter(Boolean);
  appState.starMap?.setReviewDue(dueCodes);

  mountEl.innerHTML = `
    <div class="mode-panel">
      <h2 class="mode-panel-title">温故知新</h2>
      <p class="mode-panel-sub">
        今日待复习 <strong>${dueHexagrams.length}</strong> 卦。选择一卦开始回忆。
      </p>
      <div class="review-due-list" aria-label="今日待复习卦">
        ${dueHexagrams.slice(0, 20).map((hex) => `
          <button type="button" class="relation-chip" data-code="${hex.binaryCode}">${hex.name}</button>
        `).join('')}
      </div>
      ${dueHexagrams.length === 0
        ? '<p class="mode-empty">今日复习已完成，明日再来温故。</p>'
        : ''}
      <p class="review-storage-status" role="status" aria-live="polite"></p>
    </div>
  `;

  mountEl.querySelectorAll('.relation-chip').forEach((button) => {
    button.addEventListener('click', () => renderReviewCard(mountEl, appState, button.dataset.code));
  });
}

function renderReviewCard(mountEl, appState, code) {
  const hex = appState.index.byCode.get(code);
  if (!hex) return;

  mountEl.innerHTML = `
    <div class="mode-panel review-card-panel">
      <button type="button" class="text-button review-back">← 返回今日复习</button>
      <button type="button" class="flip-card" aria-expanded="false" aria-label="翻开复习卡片查看答案">
        <span class="flip-card-inner">
          <span class="flip-card-front">
            <span class="review-eyebrow">回忆一下这卦</span>
            <span>第 ${hex.number} 卦 · 下${hex.trigramLower} 上${hex.trigramUpper}</span>
            <span class="review-card-hint">点击翻转看答案</span>
          </span>
          <span class="flip-card-back">
            ${hexagramSvg(hex.binaryCode, { size: 80 })}
            <span class="review-answer-title">${hex.name} · ${hex.fullName}</span>
            <span class="review-answer-text">${hex.judgement || ''}</span>
          </span>
        </span>
      </button>
      <div class="review-rating" hidden>
        <p>这次记得如何？</p>
        <div class="review-rating-actions">
          <button type="button" class="rate-btn rate-forgot" data-rate="0">忘了</button>
          <button type="button" class="rate-btn rate-fuzzy" data-rate="1">模糊</button>
          <button type="button" class="rate-btn rate-remember" data-rate="2">记得</button>
        </div>
      </div>
    </div>
  `;

  const card = mountEl.querySelector('.flip-card');
  const inner = mountEl.querySelector('.flip-card-inner');
  const rating = mountEl.querySelector('.review-rating');
  mountEl.querySelector('.review-back').addEventListener('click', () => renderDueList(mountEl, appState));
  card.addEventListener('click', () => {
    if (card.getAttribute('aria-expanded') === 'true') return;
    card.setAttribute('aria-expanded', 'true');
    inner.classList.add('flipped');
    rating.hidden = false;
  });
  rating.querySelectorAll('.rate-btn').forEach((button) => {
    button.addEventListener('click', () => {
      const reviewResult = saveReview(reviewCards, code, Number.parseInt(button.dataset.rate, 10));
      const activityResult = recordActivity();
      renderDueList(mountEl, appState);
      if (!reviewResult.saved || !activityResult.saved) {
        mountEl.querySelector('.review-storage-status').textContent = '复习已完成，但浏览器未能保存记录。';
      }
    });
  });
}
