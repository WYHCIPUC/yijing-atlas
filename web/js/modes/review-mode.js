import { hexagramSvg } from '../svg-painter.js';
import { getDueCards, loadReviewCards } from '../review-engine.js';
import { createReviewAttempt, submitReviewAttempt } from '../review-session.js';
import { renderLearningFeedback } from '../learning-feedback.js';
import { getHexagramContentProvenance } from '../content-provenance.js';
import { getCourseWeakQuestions, getQuizWeakQuestions, getWeakQuestionsError, loadLearningRecord } from '../learning-progress.js';
import { buildLearningQuestionBank, getLesson } from '../learning-curriculum.js';
import { loadWrongBook } from '../quiz-engine.js';

function esc(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function resetReviewViewport(mountEl, focusSelector = '[data-page-heading]', current = () => true) {
  const panel = mountEl.closest?.('.detail-panel');
  if (panel) panel.scrollTop = 0;
  mountEl.scrollTop = 0;
  const schedule = window.requestAnimationFrame || ((callback) => callback());
  const target = mountEl.querySelector(focusSelector);
  schedule(() => {
    if (!current() || !target?.focus || target.isConnected === false || mountEl.querySelector(focusSelector) !== target) return;
    if (!['BUTTON', 'A', 'INPUT', 'SUMMARY'].includes(target.tagName)) target.tabIndex = -1;
    if (focusSelector !== '[data-page-heading]') target.scrollIntoView?.({ block: 'center', behavior: 'instant' });
    target.focus({ preventScroll: true });
  });
}

export function renderReviewMode(mountEl, appState, onNavigateMode, entry = {}) {
  const context = { cards: loadReviewCards(), disposed: false, root: null,
    navigate: onNavigateMode, current(root) { return !this.disposed && root?.isConnected !== false && mountEl.querySelector('.mode-panel') === root; } };
  renderDueList(mountEl, appState, context);
  return () => { context.disposed = true; };
}

function renderDueList(mountEl, appState, context, { autoOpen = true, focusSelector = '[data-page-heading]' } = {}) {
  if (context.disposed) return;
  context.cards = loadReviewCards();
  const dueCodes = getDueCards(context.cards);
  const dueHexagrams = dueCodes.map((code) => appState.index.byCode.get(code)).filter(Boolean);
  const record = loadLearningRecord();
  const weakError = getWeakQuestionsError(record.weakQuestions);
  const courseQuestions = getCourseWeakQuestions(record);
  const quizQuestions = getQuizWeakQuestions(record);
  const legacyCodes = loadWrongBook().filter(code => appState.index.byCode.has(code));
  const availableQuestions = new Map(courseQuestions.length
    ? buildLearningQuestionBank(appState).map(question => [question.id, question]) : []);
  appState.starMap?.setReviewDue(dueCodes);
  if (autoOpen && dueHexagrams.length === 1 && !courseQuestions.length && !quizQuestions.length && !legacyCodes.length && !weakError) {
    renderReviewCard(mountEl, appState, dueHexagrams[0].binaryCode, context, true);
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
        <div class="mode-hero-stat"><strong>${weakError ? '待核对' : dueHexagrams.length + courseQuestions.length + quizQuestions.length + legacyCodes.length}</strong><span>今日待温习</span></div>
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
      <section class="course-weak-queue quiz-weak-queue" aria-labelledby="quiz-weak-title">
        <h3 id="quiz-weak-title">测验与术语温习</h3>
        <p>按原规则与原目标回练；查看资料不等于已经纠正。</p>
        ${weakError ? '<p class="assessment-warning" role="status">具体测验温习记录异常，保留原记录；请先备份核对。</p>' : quizQuestions.length
          ? `<div class="course-weak-list">${quizQuestions.map((item, index) => {
            const labels = { opposite: '错卦辨识', reversed: '综卦辨识', interlocking: '互卦辨识', name: '卦名辨识',
              'name-to-meaning': '由名称辨释义', 'meaning-to-name': '由释义辨名称' };
            const target = item.sourceKind === 'almanac' ? appState.almanacTerms?.find(term => term.id === item.termId)?.name
              : appState.index.byCode.get(item.targetCode)?.name;
            return `<article class="course-weak-item" data-quiz-question-id="${esc(item.questionId)}"><h4>${esc(target || (item.sourceKind === 'almanac' ? '原术语（进入后核对）' : '原卦资料（进入后核对）'))}</h4>
              <p>${esc(labels[item.questionType] || '原提问方向')} · 答错 ${item.wrongCount} 次 · 待回练</p>
              <div class="course-weak-actions"><button type="button" class="text-button" data-action="quiz-source-${index}">${item.sourceKind === 'almanac' ? '温习原术语' : '温习对应卦象'}</button>
                <button type="button" class="quick-btn" data-action="quiz-practice-${index}">回练原规则</button></div></article>`;
          }).join('')}</div>` : '<p class="mode-empty">暂无待回练的测验或术语题。</p>'}
      </section>
      ${legacyCodes.length ? `<section class="course-weak-queue legacy-weak-queue" aria-labelledby="legacy-weak-title"><h3 id="legacy-weak-title">旧卦码摘要</h3>
        <p>原题型未保留；这些记录不代表具体原题，不与新错题互相清除。</p><div class="course-weak-list">${legacyCodes.map((code, index) =>
          `<article class="course-weak-item"><h4>${esc(appState.index.byCode.get(code).name)}</h4><p>历史卦码摘要 · 原题型未保留</p><div class="course-weak-actions"><button type="button" class="text-button" data-action="legacy-practice-${index}">练习这一卦</button></div></article>`).join('')}</div></section>` : ''}
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
          <ol><li>先凭卦象回想卦名与上下卦。</li><li>翻面核对卦辞，不急于求快。</li><li>基于你的自评，选择暂未想起、有些模糊或能清楚复述。</li></ol>
        </aside>
      </div>` : ''}
      ${dueHexagrams.length === 0
        ? `<section class="mode-empty review-empty">
            <strong>${Object.keys(context.cards).length ? '今日卦象间隔卡已完成' : '还没有需要复习的卦象'}</strong>
            <p>${Object.keys(context.cards).length ? '下一批内容会在合适的间隔再次出现。' : '阅读任一卦象或在测验中发现薄弱点后，这里会安排第一次温故。'}</p>
            <button type="button" class="quick-btn" data-action="start-learning">继续学习</button>
          </section>`
        : ''}
    </div>
  `;
  const root = mountEl.querySelector('.mode-panel');
  const current = () => context.current(root);
  const navigate = (mode, nextEntry) => { if (current()) context.navigate?.(mode, nextEntry); };
  mountEl.querySelectorAll('[data-code]').forEach((button) => {
    button.addEventListener('click', () => { if (current()) renderReviewCard(mountEl, appState, button.dataset.code, context); });
  });
  mountEl.querySelector('[data-action="start-learning"]')?.addEventListener('click', () => navigate('learning'));
  mountEl.querySelector('[data-action="weak-data"]')?.addEventListener('click', () => navigate('learning', { section: 'data' }));
  courseQuestions.forEach((item, index) => {
    const entry = { lessonId: item.lessonId, requiredQuestionId: item.questionId,
      requiredQuestionVersion: item.questionVersion, returnTo: 'review' };
    mountEl.querySelector(`[data-action="weak-source-${index}"]`)?.addEventListener('click', () => {
      navigate('learning', getLesson(item.lessonId) ? { ...entry, section: 'path' } : { section: 'path' });
    });
    mountEl.querySelector(`[data-action="weak-practice-${index}"]`)?.addEventListener('click', () => navigate('learning', { ...entry, section: 'assessment' }));
  });
  quizQuestions.forEach((item, index) => {
    mountEl.querySelector(`[data-action="quiz-practice-${index}"]`)?.addEventListener('click', () => navigate('quiz', {
      wrongOnly: true, reference: item, returnTo: { mode: 'review' },
    }));
    mountEl.querySelector(`[data-action="quiz-source-${index}"]`)?.addEventListener('click', () => {
      if (!current()) return;
      if (item.sourceKind === 'almanac') navigate('learning', { section: 'almanac', termId: item.termId,
        quizReference: item, returnTo: { mode: 'review' } });
      else if (appState.index.byCode.has(item.targetCode)) renderReviewCard(mountEl, appState, item.targetCode, context, false,
        { sourceOnly: true, returnFocus: `[data-action="quiz-source-${index}"]` });
      else navigate('learning');
    });
  });
  legacyCodes.forEach((legacyCode, index) => mountEl.querySelector(`[data-action="legacy-practice-${index}"]`)?.addEventListener('click', () => navigate('quiz', {
    wrongOnly: true, legacyCode, returnTo: { mode: 'review' },
  })));
  resetReviewViewport(mountEl, mountEl.querySelector(focusSelector) ? focusSelector : '[data-page-heading]', current);
}

function renderReviewCard(mountEl, appState, code, context, singleCard = false, { sourceOnly = false, returnFocus = '[data-page-heading]' } = {}) {
  if (context.disposed) return;
  const hex = appState.index.byCode.get(code);
  if (!hex) return;
  const lower = appState.trigrams?.find((trigram) => trigram.binaryCode === hex.trigramLower);
  const upper = appState.trigrams?.find((trigram) => trigram.binaryCode === hex.trigramUpper);
  const structure = lower && upper
    ? `下卦 ${lower.nature}·${lower.name} · 上卦 ${upper.nature}·${upper.name}`
    : `下卦 ${hex.trigramLower} · 上卦 ${hex.trigramUpper}`;
  const provenance = getHexagramContentProvenance(hex, 'judgement');
  const citation = `${provenance.authorTradition} · ${provenance.location} · ${provenance.validationStatus}`;
  const attempt = sourceOnly ? null : createReviewAttempt(context.cards[code]);
  const canRate = !sourceOnly && Boolean(attempt);

  mountEl.innerHTML = `
    <div class="mode-panel review-card-panel">
      <h2 class="mode-panel-title" data-page-heading>${sourceOnly ? '核对卦象资料' : '今日温故'}</h2>
      ${sourceOnly ? '<p class="review-source-note">此处只读核对资料，不改变错题或间隔复习记录。</p>' : ''}
      ${!sourceOnly && !canRate ? '<p role="status">原复习卡暂不可用，未创建或保存新记录；请返回温故队列核对。</p>' : ''}
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
            <span class="review-answer-text">${esc(hex.judgement || '本卦暂缺卦辞文本。')}</span>
            <span class="content-provenance" title="${esc(provenance.edition)}">${esc(citation)}</span>
          </span>
        </span>
      </button>
      <button type="button" class="text-button" data-action="review-feedback-return" hidden>返回本次反馈</button>
      ${canRate ? `<div class="review-rating" hidden>
        <p>基于你的自评，这次回忆得如何？</p>
        <div class="review-rating-actions">
          <button type="button" class="rate-btn rate-forgot" data-rate="0">暂未想起</button>
          <button type="button" class="rate-btn rate-fuzzy" data-rate="1">有些模糊</button>
          <button type="button" class="rate-btn rate-remember" data-rate="2">能清楚复述</button>
        </div>
      </div><div class="review-feedback" hidden></div>` : ''}
    </div>
  `;

  const root = mountEl.querySelector('.mode-panel');
  const current = () => context.current(root);
  const card = mountEl.querySelector('.flip-card');
  const inner = mountEl.querySelector('.flip-card-inner');
  const front = mountEl.querySelector('.flip-card-front');
  const answer = mountEl.querySelector('#review-answer');
  const rating = mountEl.querySelector('.review-rating');
  const feedback = mountEl.querySelector('.review-feedback');
  const feedbackReturn = mountEl.querySelector('[data-action="review-feedback-return"]');
  let submitted = false, selectedRating = null, lastResult = null;
  const returnToQueue = () => {
    if (current()) renderDueList(mountEl, appState, context, { autoOpen: false, focusSelector: returnFocus });
  };
  const reveal = target => {
    const schedule = window.requestAnimationFrame || (callback => callback());
    schedule(() => {
      if (!current() || !target || target.isConnected === false) return;
      if (!['BUTTON', 'A'].includes(target.tagName)) target.tabIndex = -1;
      target.scrollIntoView?.({ block: 'center', behavior: 'instant' });
      target.focus?.({ preventScroll: true });
    });
  };
  mountEl.querySelector('.review-back')?.addEventListener('click', returnToQueue);
  feedbackReturn.addEventListener('click', () => {
    if (!current() || !lastResult) return;
    feedbackReturn.hidden = true;
    reveal(feedback.querySelector('[data-review-result]'));
  });
  card.addEventListener('click', () => {
    if (!current() || card.getAttribute('aria-expanded') === 'true') return;
    card.setAttribute('aria-expanded', 'true');
    card.setAttribute('aria-label', `答案已展开：${hex.name}，${hex.fullName}`);
    front.setAttribute('aria-hidden', 'true');
    answer.hidden = false;
    answer.setAttribute('aria-hidden', 'false');
    const schedule = window.requestAnimationFrame || ((callback) => callback());
    schedule(() => { if (current()) inner.classList.add('flipped'); });
    window.setTimeout?.(() => { if (current()) front.hidden = true; }, 260);
    if (rating) {
      rating.hidden = false;
      window.setTimeout(() => { if (current() && !submitted) rating.querySelector('.rate-btn')?.focus({ preventScroll: true }); }, 280);
    }
  });
  const save = () => {
    if (!current()) return;
    lastResult = submitReviewAttempt(attempt, selectedRating);
    if (lastResult.changes.card.saved) context.cards[code] = lastResult.card;
    const labels = ['暂未想起', '有些模糊', '能清楚复述'];
    const messages = Object.entries({ card: '复习卡', activity: '学习活动', achievement: '成就记录' })
      .filter(([key]) => lastResult.changes[key].applicable)
      .map(([key, label]) => `${label}${lastResult.changes[key].saved ? '已保存' : '未能保存'}。`);
    const days = lastResult.card ? Math.round((lastResult.card.due - lastResult.reviewedAt) / 86400000) : null;
    messages.push(lastResult.changes.card.saved ? `预计 ${days} 日后再次出现。` : '本轮尚未更新排期。');
    if (lastResult.error) messages.push(lastResult.error);
    const conflict = ['card-conflict', 'card-missing', 'card-invalid', 'invalid-attempt'].includes(lastResult.errorCode);
    const action = lastResult.saved ? 'review-next' : conflict ? 'review-queue' : 'review-retry';
    const label = lastResult.saved ? '继续温故' : conflict ? '返回温故队列' : '重试保存未完成的记录';
    feedback.innerHTML = renderLearningFeedback({
      result: `<p data-review-result>基于你的自评：${esc(labels[selectedRating])}。这是你的回忆判断，不代表系统已经判定掌握。</p>`,
      basis: `<p>核对卦名、上下卦与卦辞后，按实际回忆选择自评。</p><p>${esc(citation)}</p>`,
      changes: `<p class="review-storage-status" role="status" aria-live="polite">${esc(messages.join(' '))}</p>${lastResult.saved ? '' : '<p>本轮答案和原评分暂留在此页；离开后只保留已经保存的记录。</p>'}`,
      primaryAction: `<button type="button" class="quick-btn" data-action="${action}">${label}</button>`,
      secondaryActions: [...(conflict ? [] : ['<button type="button" class="text-button" data-action="review-queue">返回温故队列</button>']),
        '<button type="button" class="text-button" data-action="review-source">核对本卦卦辞</button>'],
    });
    feedback.hidden = false;
    feedbackReturn.hidden = true;
    const bind = (name, handler) => {
      const target = feedback.querySelector(`[data-action="${name}"]`);
      target?.addEventListener('click', () => {
        if (current() && feedback.querySelector(`[data-action="${name}"]`) === target) handler();
      });
    };
    bind('review-retry', () => { if (!lastResult.saved) save(); });
    bind('review-next', () => renderDueList(mountEl, appState, context));
    bind('review-queue', returnToQueue);
    bind('review-source', () => { feedbackReturn.hidden = false; reveal(answer); });
    reveal(feedback.querySelector(lastResult.saved ? '[data-review-result]' : `[data-action="${action}"]`));
  };
  rating?.querySelectorAll('.rate-btn').forEach((button) => {
    button.addEventListener('click', () => {
      if (!current() || submitted || button.disabled || rating.hidden || card.getAttribute('aria-expanded') !== 'true' || !/^[012]$/.test(button.dataset.rate)) return;
      submitted = true; selectedRating = Number(button.dataset.rate);
      rating.querySelectorAll('.rate-btn').forEach(option => {
        option.disabled = true;
        option.setAttribute('aria-pressed', String(option === button));
      });
      save();
    });
  });
  resetReviewViewport(mountEl, '[data-page-heading]', current);
}
