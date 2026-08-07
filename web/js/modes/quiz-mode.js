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

let currentQuiz = null;

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
  const options = isAlmanac
    ? currentQuiz.candidates.map((candidate) => `
        <button type="button" class="quiz-option" data-code="${esc(candidate.code)}">${esc(candidate.text)}</button>
      `).join('')
    : currentQuiz.candidates.map((code) => {
        const hex = appState.index.byCode.get(code);
        return `<button type="button" class="quiz-option" data-code="${code}">${esc(hex.name)} · ${esc(hex.fullName)}</button>`;
      }).join('');

  mountEl.innerHTML = `
    <div class="mode-panel">
      <div class="mode-heading-row">
        <h2 class="mode-panel-title">测验</h2>
        <span class="quiz-stats">正确 ${stats.correct} / ${stats.total}</span>
      </div>
      <div class="quiz-toolbar">
        <button type="button" class="text-button quiz-mode-toggle" ${wrongCodes.length ? '' : 'disabled'}>
          ${wrongOnly ? '返回随机测验' : `错题回练（${wrongCodes.length}）`}
        </button>
      </div>
      <div class="mode-card quiz-question">
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

  mountEl.querySelectorAll('.quiz-option').forEach((button) => {
    button.addEventListener('click', () => {
      const picked = button.dataset.code;
      const correct = checkAnswer(currentQuiz, picked);
      const statsResult = recordResult(correct);
      const activityResult = recordActivity();
      let wrongSaved = true;
      if (!correct && currentQuiz.targetCode) wrongSaved = addWrong(currentQuiz.targetCode);
      if (correct && wrongOnly && currentQuiz.targetCode) wrongSaved = removeWrong(currentQuiz.targetCode);
      if (!statsResult.saved || !activityResult.saved || !wrongSaved) {
        mountEl.querySelector('.quiz-storage-status').textContent = '本次作答完成，但浏览器未能保存全部学习记录。';
      }

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
        <button type="button" class="quiz-next">${wrongOnly && wrongCodes.length === 1 && correct ? '返回随机测验' : '下一题 →'}</button>
      `;
      feedback.querySelector('.quiz-next').addEventListener('click', () => {
        renderQuizMode(mountEl, appState, wrongOnly && !(wrongCodes.length === 1 && correct));
      });
    });
  });
}
