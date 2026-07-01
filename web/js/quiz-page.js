// 测验页：逐题作答 + 即时反馈 + 错题收集 + 结算。
// 交互由本模块管理，挂载到 #app。
import { hexagramSvg } from './svg-painter.js';
import { generateQuiz, generateAlmanacQuiz, checkAnswer } from './quiz-engine.js';

let state = null;

export function renderQuizPage(mountEl, appState) {
  state = {
    hexagrams: appState.hexagrams,
    almanacTerms: appState.almanacTerms || [],
    source: 'yi', // 'yi' | 'almanac'
    quiz: null,
    index: 0,
    score: 0,
    wrongs: [],
    answered: false,
  };
  drawSetup(mountEl);
}

function drawSetup(mountEl) {
  const isYi = state.source === 'yi';
  mountEl.innerHTML = `
    <div class="quiz-panel">
      <h3>测验</h3>
      <div class="source-switch">
        <button class="src-btn ${isYi?'active':''}" data-src="yi">易经（卦象/爻辞）</button>
        <button class="src-btn ${!isYi?'active':''}" data-src="almanac">黄历（术语/建除）</button>
      </div>
      <p class="quiz-desc">${isYi ? '从六十四卦随机出题，即时判分。答错的题会汇总到错题本。' : '从黄历术语随机出题（术语释义/归类/建除宜忌），即时判分。'}</p>
      <div class="quiz-setup">
        <label>题量：
          <select id="quiz-count">
            <option value="5">5 题（速测）</option>
            <option value="10" selected>10 题</option>
            <option value="20">20 题（挑战）</option>
          </select>
        </label>
      </div>
      <button class="primary-btn" id="start-quiz">开始测验</button>
    </div>`;
  // 题源切换
  mountEl.querySelectorAll('.src-btn').forEach((b) => {
    b.addEventListener('click', () => { state.source = b.dataset.src; drawSetup(mountEl); });
  });
  document.getElementById('start-quiz').addEventListener('click', () => {
    const count = Number(document.getElementById('quiz-count').value);
    state.quiz = isYi
      ? generateQuiz(state.hexagrams, count)
      : generateAlmanacQuiz(state.almanacTerms, count);
    state.index = 0;
    state.score = 0;
    state.wrongs = [];
    drawQuestion(mountEl);
  });
}

function drawQuestion(mountEl) {
  if (state.index >= state.quiz.length) { drawResult(mountEl); return; }
  const q = state.quiz[state.index];
  state.answered = false;

  // 根据题型渲染选项（卦象题选项是 binaryCode，需渲染 SVG）
  const optionHtml = q.options.map((opt, i) => {
    if (q.type === 'name-to-image') {
      return `<button class="quiz-option option-svg" data-choice="${esc(opt)}">${hexagramSvg(opt, { size: 60 })}</button>`;
    }
    return `<button class="quiz-option" data-choice="${esc(opt)}">${esc(opt)}</button>`;
  }).join('');

  const promptSvg = q.type === 'image-to-name' ? hexagramSvg(q.binaryCode, { size: 100 }) : '';

  mountEl.innerHTML = `
    <div class="quiz-view">
      <div class="quiz-progress">第 ${state.index + 1} / ${state.quiz.length} 题 · 得分 ${state.score}</div>
      <div class="quiz-question">
        ${promptSvg}
        <p class="quiz-prompt">${esc(q.prompt)}</p>
      </div>
      <div class="quiz-options" id="quiz-options">${optionHtml}</div>
      <div class="quiz-feedback" id="quiz-feedback"></div>
    </div>`;

  document.querySelectorAll('.quiz-option').forEach((btn) => {
    btn.addEventListener('click', () => answer(mountEl, btn.dataset.choice));
  });
}

function answer(mountEl, choice) {
  if (state.answered) return;
  state.answered = true;
  const q = state.quiz[state.index];
  const correct = checkAnswer(q, choice);

  if (correct) state.score++;
  else state.wrongs.push({ question: q, userChoice: choice });

  // 标记正误
  document.querySelectorAll('.quiz-option').forEach((btn) => {
    const isAnswer = btn.dataset.choice === q.answer;
    const isChosen = btn.dataset.choice === choice;
    btn.classList.add(isAnswer ? 'opt-correct' : (isChosen ? 'opt-wrong' : 'opt-dim'));
    btn.disabled = true;
  });

  const fb = document.getElementById('quiz-feedback');
  fb.innerHTML = `
    <p class="${correct ? 'fb-correct' : 'fb-wrong'}">${correct ? '✓ 答对了' : '✗ 答错了'}</p>
    ${!correct ? `<p class="fb-answer">正确答案：<b>${esc(q.type === 'name-to-image' ? q.answerName : q.answer)}</b></p>` : ''}
    <button class="primary-btn" id="next-question">${state.index + 1 < state.quiz.length ? '下一题' : '查看结果'}</button>`;
  document.getElementById('next-question').addEventListener('click', () => {
    state.index++;
    drawQuestion(mountEl);
  });
}

function drawResult(mountEl) {
  const total = state.quiz.length;
  const pct = Math.round(state.score / total * 100);
  let comment = '';
  if (pct === 100) comment = '完美！烂熟于心';
  else if (pct >= 80) comment = '掌握得很好';
  else if (pct >= 60) comment = '还不错，继续巩固';
  else comment = '需要多复习';

  const wrongList = state.wrongs.map((w) => {
    const q = w.question;
    const ans = q.type === 'name-to-image' ? q.answerName : q.answer;
    const userAns = w.userChoice;
    return `<li>${esc(q.prompt)}<br/><span class="wrong-detail">你选：<span class="opt-text">${esc(userAns)}</span> ｜ 正确：<b>${esc(ans)}</b></span></li>`;
  }).join('');

  mountEl.innerHTML = `
    <div class="quiz-result">
      <h3>测验完成</h3>
      <div class="result-score">${state.score} / ${total}</div>
      <div class="result-pct">${pct} 分</div>
      <p class="result-comment">${comment}</p>
      ${state.wrongs.length > 0 ? `
        <h4>错题本（${state.wrongs.length} 题）</h4>
        <ul class="wrong-list">${wrongList}</ul>
      ` : '<p class="all-correct">🎉 全部答对，无错题</p>'}
      <div class="result-actions">
        <button class="primary-btn" id="quiz-again">再来一轮</button>
        <button class="secondary-btn" id="quiz-back">返回</button>
      </div>
    </div>`;

  document.getElementById('quiz-again').addEventListener('click', () => drawSetup(mountEl));
  document.getElementById('quiz-back').addEventListener('click', () => drawSetup(mountEl));
}

function esc(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
