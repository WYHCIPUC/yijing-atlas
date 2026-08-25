import {
  addWrong,
  checkAnswer,
  generateAlmanacQuestion,
  generateQuestion,
  loadStats,
  loadWrongBook,
  recordResult,
  removeWrong,
} from '../quiz-engine.js';
import { recordActivity } from '../learning-progress.js';
import { addReviewCard } from '../review-engine.js';

let currentQuiz = null;

function resetQuizViewport(mountEl, focusSelector = '[data-page-heading]') {
  const panel = mountEl.closest?.('.detail-panel');
  if (panel) panel.scrollTop = 0;
  mountEl.scrollTop = 0;
  const schedule = window.requestAnimationFrame || ((callback) => callback());
  schedule(() => {
    const target = mountEl.querySelector(focusSelector);
    if (!target?.focus) return;
    target.tabIndex = -1;
    target.focus({ preventScroll: true });
  });
}

function revealQuizFeedback(feedback) {
  const schedule = window.requestAnimationFrame || ((callback) => callback());
  schedule(() => {
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    feedback.scrollIntoView?.({
      behavior: reducedMotion ? 'auto' : 'smooth',
      block: 'nearest',
      inline: 'nearest',
    });
    feedback.querySelector('.quiz-next')?.focus({ preventScroll: true });
  });
}

function esc(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderQuizMode(mountEl, appState, wrongOnly = false) {
  const wrongCodes = loadWrongBook().filter((code) => appState.index.byCode.has(code));
  if (wrongOnly && wrongCodes.length) {
    const targetCode = wrongCodes[Math.floor(Math.random() * wrongCodes.length)];
    currentQuiz = generateQuestion(appState.hexagrams, null, targetCode);
  } else if (appState.almanacTerms?.length >= 4 && Math.random() < 0.2) {
    currentQuiz = generateAlmanacQuestion(appState.almanacTerms);
  } else {
    currentQuiz = generateQuestion(appState.hexagrams);
  }
  if (!currentQuiz) currentQuiz = generateQuestion(appState.hexagrams);

  const isAlmanac = currentQuiz.type === 'almanac';
  const answerHex = isAlmanac ? null : appState.index.byCode.get(currentQuiz.answer);
  const stats = loadStats();
  const accuracy = stats.total ? Math.round((stats.correct / stats.total) * 100) : 0;
  const options = isAlmanac
    ? currentQuiz.candidates.map((candidate, index) => `
        <button type="button" class="quiz-option" data-code="${esc(candidate.code)}"><span class="quiz-option-index">${String.fromCharCode(65 + index)}</span><span>${esc(candidate.text)}</span></button>
      `).join('')
    : currentQuiz.candidates.map((code, index) => {
        const hex = appState.index.byCode.get(code);
        return `<button type="button" class="quiz-option" data-code="${code}"><span class="quiz-option-index">${String.fromCharCode(65 + index)}</span><span><strong>${esc(hex.name)}</strong><small>${esc(hex.fullName)}</small></span></button>`;
      }).join('');

  mountEl.innerHTML = `
    <div class="mode-panel quiz-panel">
      <header class="mode-hero quiz-hero">
        <div><span class="academy-kicker">即时考校</span><h2 class="mode-panel-title" data-page-heading>辨象小试</h2>
          <p class="mode-panel-sub">每次一题，即答即释；答错的卦自动回到温故队列。</p></div>
        <div class="mode-hero-stat"><strong data-quiz-rate>${accuracy}%</strong><span>累计正确率</span></div>
      </header>
      <div class="quiz-toolbar">
        <span class="quiz-stats">累计答对 <strong data-quiz-correct>${stats.correct}</strong> / <span data-quiz-total>${stats.total}</span></span>
        <button type="button" class="text-button quiz-mode-toggle" ${wrongCodes.length ? '' : 'disabled'}>
          ${wrongOnly ? '返回随机测验' : `错题回练（${wrongCodes.length}）`}
        </button>
      </div>
      <div class="mode-card quiz-question">
        <span>${isAlmanac ? '历法辨识' : wrongOnly ? '错题回炉' : '卦象辨识'}</span>
        <p>${esc(currentQuiz.question)}</p>
      </div>
      <p class="quiz-instruction">选择你的答案</p>
      <div class="quiz-options">${options}</div>
      <div class="quiz-feedback" aria-live="polite"></div>
      <p class="quiz-storage-status" role="status" aria-live="polite"></p>
    </div>
  `;

  mountEl.querySelector('.quiz-mode-toggle').addEventListener('click', () => {
    renderQuizMode(mountEl, appState, !wrongOnly);
  });
  resetQuizViewport(mountEl);

  mountEl.querySelectorAll('.quiz-option').forEach((button) => {
    button.addEventListener('click', () => {
      const picked = button.dataset.code;
      const correct = checkAnswer(currentQuiz, picked);
      const statsResult = recordResult(correct);
      const activityResult = recordActivity();
      let wrongSaved = true;
      if (!correct && currentQuiz.targetCode) wrongSaved = addWrong(currentQuiz.targetCode);
      if (correct && wrongOnly && currentQuiz.targetCode) wrongSaved = removeWrong(currentQuiz.targetCode);
      const reviewResult = !correct && currentQuiz.targetCode
        ? addReviewCard(currentQuiz.targetCode)
        : { saved: true };
      if (!statsResult.saved || !activityResult.saved || !wrongSaved || !reviewResult.saved) {
        mountEl.querySelector('.quiz-storage-status').textContent = '本次作答完成，但浏览器未能保存全部学习记录。';
      }
      mountEl.querySelector('[data-quiz-correct]').textContent = String(statsResult.correct);
      mountEl.querySelector('[data-quiz-total]').textContent = String(statsResult.total);
      mountEl.querySelector('[data-quiz-rate]').textContent = `${Math.round((statsResult.correct / statsResult.total) * 100)}%`;

      mountEl.querySelectorAll('.quiz-option').forEach((option) => {
        option.classList.toggle('quiz-correct', option.dataset.code === currentQuiz.answer);
        option.classList.toggle('quiz-wrong', option.dataset.code === picked && !correct);
        option.disabled = true;
      });

      const answerName = isAlmanac ? currentQuiz.answerText : answerHex?.name;
      const feedback = mountEl.querySelector('.quiz-feedback');
      feedback.innerHTML = `
        <p class="${correct ? 'feedback-correct' : 'feedback-wrong'}">
          ${correct ? '✓ 回答正确' : `✗ 正确答案是「${esc(answerName || '—')}」`}
        </p>
        <div class="quiz-explanation">
          <strong>为什么</strong>
          <p>${esc(currentQuiz.explanation || '请回到对应课程，结合卦象结构再次核对。')}</p>
          ${!correct && currentQuiz.targetCode ? '<small>这道题对应的卦象已加入复习。</small>' : ''}
        </div>
        <button type="button" class="quiz-next">${wrongOnly && wrongCodes.length === 1 && correct ? '返回随机测验' : '下一题 →'}</button>
      `;
      feedback.querySelector('.quiz-next').addEventListener('click', () => {
        renderQuizMode(mountEl, appState, wrongOnly && !(wrongCodes.length === 1 && correct));
      });
      revealQuizFeedback(feedback);
    });
  });
}
