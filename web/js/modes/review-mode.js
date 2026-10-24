import { hexagramSvg } from '../svg-painter.js';
import { createProgressEvent } from '../achievement-engine.js';
import { processAchievementEvent } from '../achievement-storage.js';
import { getDueCards, loadReviewCards, saveReview } from '../review-engine.js';
import { getCourseWeakQuestions, getWeakQuestionsError, loadLearningRecord, recordActivity } from '../learning-progress.js';
import { buildLearningQuestionBank, getLesson } from '../learning-curriculum.js';

let reviewCards = null;

function esc(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function resetReviewViewport(mountEl, focusSelector = '[data-page-heading]') {
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

export function renderReviewMode(mountEl, appState, onStartLearning) {
  reviewCards = loadReviewCards();
  renderDueList(mountEl, appState, onStartLearning);
}

function renderDueList(mountEl, appState, onStartLearning) {
  const dueCodes = getDueCards(reviewCards);
  const dueHexagrams = dueCodes.map((code) => appState.index.byCode.get(code)).filter(Boolean);
  const record = loadLearningRecord();
  const weakError = getWeakQuestionsError(record.weakQuestions);
  const courseQuestions = getCourseWeakQuestions(record);
  const availableQuestions = new Map(courseQuestions.length
    ? buildLearningQuestionBank(appState).map(question => [question.id, question]) : []);
  appState.starMap?.setReviewDue(dueCodes);
  if (dueHexagrams.length === 1 && !courseQuestions.length && !weakError) {
    renderReviewCard(mountEl, appState, dueHexagrams[0].binaryCode, onStartLearning, true);
    return;
  }

  mountEl.innerHTML = `
    <div class="mode-panel review-panel">
      <header class="mode-hero review-hero">
        <div><span class="academy-kicker">书院温故</span><h2 class="mode-panel-title" data-page-heading>温故知新</h2>
          <p class="mode-panel-sub">${dueHexagrams.length
            ? '不重读答案，先从记忆中提取。'
            : '复习内容会从已学、答错或主动加入的卦象中产生。'}</p>
          <p class="review-storage-status" role="status" aria-live="polite"></p></div>
        <div class="mode-hero-stat"><strong>${weakError ? '待核对' : dueHexagrams.length + courseQuestions.length}</strong><span>今日待温习</span></div>
      </header>
      <section class="course-weak-queue" aria-labelledby="course-weak-title">
        <h3 id="course-weak-title">课程温习</h3>
        <p>按原题回练，打开原课不等于已经纠正。卦象间隔卡另列于下方。</p>
        ${weakError ? `<p class="course-weak-status assessment-warning" role="status">课程温习记录异常：${esc(weakError)}。原有成绩仍保留，请先导出备份再检查数据。</p><button type="button" class="text-button" data-action="weak-data">前往数据备份</button>` :
          courseQuestions.length ? `<div class="course-weak-list">${courseQuestions.map((item, index) => {
            const lesson = getLesson(item.lessonId);
            const question = availableQuestions.get(item.questionId);
            const sameReference = question?.questionVersion === item.questionVersion
              && question.lessonId === item.lessonId && question.kind === item.questionType
              && question.targetCode === item.targetCode && question.termId === item.termId;
            return `<article class="course-weak-item" data-weak-question-id="${esc(item.questionId)}">
              <h4>${esc(lesson?.title || '原课程已调整')}</h4>
              <p>${item.questionType === 'evidence' ? '依据辨析' : '概念回忆'} · 答错 ${item.wrongCount} 次 · ${item.status === 'reviewed' ? '已温习，待回练' : '待温习'}</p>
              <p class="course-weak-prompt">${sameReference ? `原题：${esc(question.prompt)}` : `待回练第 ${index + 1} 题 · 进入后加载原题`}</p>
              ${lesson ? '' : '<p>当前课程不可用，保留原记录；可返回学习页选择内容。</p>'}
              <div class="course-weak-actions"><button type="button" class="text-button" data-action="weak-source-${index}">${lesson ? '回原课温习' : '返回学习页'}</button>
                ${lesson ? `<button type="button" class="quick-btn" data-action="weak-practice-${index}">回练原题</button>` : ''}</div>
            </article>`;
          }).join('')}</div>` : '<p class="mode-empty">暂无待回练的课程题。</p>'}
      </section>
      <h3>卦象间隔卡</h3>
      ${dueHexagrams.length ? `<div class="review-queue-layout">
        <div class="review-due-list" aria-label="今日待复习卦">
          ${dueHexagrams.slice(0, 20).map((hex) => `
            <button type="button" class="review-due-item" data-code="${hex.binaryCode}">
              <span class="review-due-symbol" aria-hidden="true">${hexagramSvg(hex.binaryCode, { size: 56 })}</span>
              <span class="review-due-copy"><small>第 ${hex.number} 卦</small><strong>${hex.name}</strong><span>${hex.fullName} · 开始回忆</span></span>
            </button>
          `).join('')}
        </div>
        <aside class="review-method-note">
          <span class="academy-kicker">书院温故法</span>
          <h3>先忆象，再对经，后自评</h3>
          <ol><li>先凭卦象回想卦名与上下卦。</li><li>翻面核对卦辞，不急于求快。</li><li>按真实记忆选择忘了、模糊或记得。</li></ol>
        </aside>
      </div>` : ''}
      ${dueHexagrams.length === 0
        ? `<section class="mode-empty review-empty">
            <strong>${Object.keys(reviewCards).length ? '今日卦象间隔卡已完成' : '还没有需要复习的卦象'}</strong>
            <p>${Object.keys(reviewCards).length ? '下一批内容会在合适的间隔再次出现。' : '阅读任一卦象或在测验中发现薄弱点后，这里会安排第一次温故。'}</p>
            <button type="button" class="quick-btn" data-action="start-learning">继续学习</button>
          </section>`
        : ''}
    </div>
  `;

  mountEl.querySelectorAll('[data-code]').forEach((button) => {
    button.addEventListener('click', () => renderReviewCard(mountEl, appState, button.dataset.code, onStartLearning));
  });
  mountEl.querySelector('[data-action="start-learning"]')?.addEventListener('click', () => onStartLearning?.());
  mountEl.querySelector('[data-action="weak-data"]')?.addEventListener('click', () => onStartLearning?.({ section: 'data' }));
  courseQuestions.forEach((item, index) => {
    const entry = { lessonId: item.lessonId, requiredQuestionId: item.questionId,
      requiredQuestionVersion: item.questionVersion, returnTo: 'review' };
    mountEl.querySelector(`[data-action="weak-source-${index}"]`)?.addEventListener('click', () => {
      onStartLearning?.(getLesson(item.lessonId) ? { ...entry, section: 'path' } : { section: 'path' });
    });
    mountEl.querySelector(`[data-action="weak-practice-${index}"]`)?.addEventListener('click', () => onStartLearning?.({ ...entry, section: 'assessment' }));
  });
  resetReviewViewport(mountEl);
}

function renderReviewCard(mountEl, appState, code, onStartLearning, singleCard = false) {
  const hex = appState.index.byCode.get(code);
  if (!hex) return;
  const lower = appState.trigrams?.find((trigram) => trigram.binaryCode === hex.trigramLower);
  const upper = appState.trigrams?.find((trigram) => trigram.binaryCode === hex.trigramUpper);
  const structure = lower && upper
    ? `下卦 ${lower.nature}·${lower.name} · 上卦 ${upper.nature}·${upper.name}`
    : `下卦 ${hex.trigramLower} · 上卦 ${hex.trigramUpper}`;

  mountEl.innerHTML = `
    <div class="mode-panel review-card-panel">
      <h2 class="mode-panel-title" data-page-heading>今日温故</h2>
      <p class="review-storage-status" role="status" aria-live="polite"></p>
      ${singleCard ? '<p class="review-single-note">今日仅此一卦，完成回忆即可结束温故。</p>' : '<button type="button" class="text-button review-back">← 返回今日复习</button>'}
      <button type="button" class="flip-card" aria-expanded="false" aria-controls="review-answer" aria-label="翻开复习卡片查看答案">
        <span class="flip-card-inner">
          <span class="flip-card-front" aria-hidden="false">
            <span class="review-eyebrow">回忆一下这卦</span>
            ${hexagramSvg(hex.binaryCode, { size: 92 })}
            <span>第 ${hex.number} 卦 · ${structure}</span>
            <span class="review-card-hint">点击翻转看答案</span>
          </span>
          <span class="flip-card-back" id="review-answer" hidden aria-hidden="true">
            ${hexagramSvg(hex.binaryCode, { size: 80 })}
            <span class="review-answer-title compound-title compound-title--hexagram" aria-label="${hex.name} · ${hex.fullName}"><span class="compound-title-primary">${hex.name}</span><span class="compound-title-separator" aria-hidden="true">·</span><span class="compound-title-secondary">${hex.fullName}</span></span>
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
  const front = mountEl.querySelector('.flip-card-front');
  const answer = mountEl.querySelector('#review-answer');
  const rating = mountEl.querySelector('.review-rating');
  mountEl.querySelector('.review-back')?.addEventListener('click', () => renderDueList(mountEl, appState, onStartLearning));
  card.addEventListener('click', () => {
    if (card.getAttribute('aria-expanded') === 'true') return;
    card.setAttribute('aria-expanded', 'true');
    card.setAttribute('aria-label', `答案已展开：${hex.name}，${hex.fullName}`);
    front.setAttribute('aria-hidden', 'true');
    answer.hidden = false;
    answer.setAttribute('aria-hidden', 'false');
    const schedule = window.requestAnimationFrame || ((callback) => callback());
    schedule(() => inner.classList.add('flipped'));
    window.setTimeout?.(() => { front.hidden = true; }, 260);
    rating.hidden = false;
    window.setTimeout(() => rating.querySelector('.rate-btn')?.focus({ preventScroll: true }), 280);
  });
  rating.querySelectorAll('.rate-btn').forEach((button) => {
    button.addEventListener('click', () => {
      const reviewResult = saveReview(reviewCards, code, Number.parseInt(button.dataset.rate, 10));
      const activityResult = recordActivity();
      const achievementResult = reviewResult.saved ? processAchievementEvent(createProgressEvent({
        type: 'review.completed',
        subjectId: code,
        outcome: 'completed',
        idempotencyKey: `review:${code}:${reviewResult.card.lastReview}`,
        metadata: { hexagramCode: code, reviewKind: 'spaced' },
      })) : { saved: false };
      renderDueList(mountEl, appState, onStartLearning);
      const days = Math.max(1, Math.round((reviewResult.card.due - Date.now()) / 86400000));
      const status = mountEl.querySelector('.review-storage-status');
      status.textContent = !reviewResult.saved || !activityResult.saved || !achievementResult.saved
        ? '复习已完成，但浏览器未能保存记录。'
        : `已记录为“${button.textContent.trim()}”，预计 ${days} 日后再次出现。`;
    });
  });
  resetReviewViewport(mountEl);
}
