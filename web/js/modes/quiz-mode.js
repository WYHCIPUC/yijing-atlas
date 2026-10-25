import { generateAlmanacQuestion, generateQuestion, loadStats, loadWrongBook, resolveQuizQuestion } from '../quiz-engine.js';
import { getQuizWeakQuestions, getWeakQuestionsError, loadLearningRecord } from '../learning-progress.js';
import { createQuizAttempt, submitQuizAttempt } from '../quiz-session.js';
import { renderLearningFeedback } from '../learning-feedback.js';

function esc(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function revealQuizFeedback(feedback, current, schedule, failed = false) {
  schedule(() => {
    if (!current() || feedback.isConnected === false) return;
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const action = feedback.querySelector(failed ? '[data-action="quiz-retry"]' : '.quiz-next');
    const scrollTarget = failed && action ? action : feedback;
    scrollTarget.scrollIntoView?.({ behavior: reducedMotion ? 'auto' : 'smooth', block: failed ? 'center' : 'nearest', inline: 'nearest' });
    action?.focus({ preventScroll: true });
  });
}

export function renderQuizMode(mountEl, appState, onNavigateMode, entry = {}) {
  let disposed = false;
  let activeRoot = null;
  const frames = new Set();
  const schedule = callback => {
    const frame = window.requestAnimationFrame(() => { frames.delete(frame); callback(); });
    frames.add(frame);
  };
  const cancelFrames = () => { frames.forEach(frame => window.cancelAnimationFrame?.(frame)); frames.clear(); };
  const pendingQuestions = () => getQuizWeakQuestions(loadLearningRecord());
  const legacyCodes = () => loadWrongBook().filter(code => appState.index?.byCode?.has(code));

  function show(roundEntry = {}) {
    if (disposed) return;
    cancelFrames();
    const record = loadLearningRecord();
    const weakError = getWeakQuestionsError(record.weakQuestions);
    const weakItems = getQuizWeakQuestions(record);
    const legacy = legacyCodes();
    const exact = roundEntry.reference;
    const wrongOnly = roundEntry.wrongOnly === true || Boolean(exact) || Boolean(roundEntry.legacyCode);
    let reference = exact;
    let legacyCode = roundEntry.legacyCode;
    let question = null;
    let reason = '';
    if (wrongOnly && !reference && !legacyCode) {
      reference = weakItems[0];
      if (!reference) legacyCode = legacy[0];
    }
    if (reference && legacyCode) reason = '回练来源冲突，请返回温故重新选择。';
    else if (reference) {
      const resolved = resolveQuizQuestion(appState, reference);
      if (resolved.ok) question = resolved.question;
      else reason = resolved.reason;
    } else if (legacyCode) {
      if (legacy.includes(legacyCode)) question = generateQuestion(appState.hexagrams, null, legacyCode);
      else reason = '该旧卦码摘要已不存在或暂不可用，请返回温故核对。';
    } else if (wrongOnly) reason = weakError
      ? '温习记录异常，请先导出备份再核对；原有学习记录仍保留。'
      : '暂无待回练的测验题，可以返回随机测验。';
    else {
      if (appState.almanacTerms?.length >= 4 && Math.random() < 0.2) question = generateAlmanacQuestion(appState.almanacTerms);
      if (!question) question = generateQuestion(appState.hexagrams);
    }
    const isAlmanac = question?.type === 'almanac';
    const candidates = question?.candidates;
    const validQuestion = question && Array.isArray(candidates) && candidates.length >= 2 &&
      candidates.some(candidate => (isAlmanac ? candidate.code : candidate) === question.answer) &&
      (isAlmanac || candidates.every(code => appState.index?.byCode?.has(code)));
    if (!validQuestion) { question = null; reason ||= '暂无可用题，请返回学习页检查资料。'; }
    const attempt = question ? createQuizAttempt(question, { mode: legacyCode ? 'legacy' : wrongOnly ? 'review' : 'random' }) : null;
    if (question && !attempt) { question = null; reason = '题目暂时不可用，无法建立有效作答；请返回温故核对资料。'; }
    const stats = loadStats();
    const totalPending = weakItems.length + legacy.length;
    const options = question ? candidates.map((candidate, index) => {
      const code = isAlmanac ? candidate.code : candidate;
      const hex = isAlmanac ? null : appState.index.byCode.get(code);
      return `<button type="button" class="quiz-option" data-code="${esc(code)}"><span class="quiz-option-index">${String.fromCharCode(65 + index)}</span><span>${isAlmanac
        ? esc(candidate.text) : `<strong>${esc(hex.name)}</strong><small>${esc(hex.fullName)}</small>`}</span></button>`;
    }).join('') : '';
    mountEl.innerHTML = `
      <div class="mode-panel quiz-panel">
        <header class="mode-hero quiz-hero"><div><span class="academy-kicker">即时考校</span><h2 class="mode-panel-title" data-page-heading>辨象小试</h2>
          <p class="mode-panel-sub">每次一题，即答即释；具体错题按原规则温习，黄历术语独立记录。</p></div>
          <div class="mode-hero-stat"><strong data-quiz-rate>${stats.total ? Math.round(stats.correct / stats.total * 100) : 0}%</strong><span>累计正确率</span></div></header>
        <div class="quiz-toolbar"><span class="quiz-stats">累计答对 <strong data-quiz-correct>${stats.correct}</strong> / <span data-quiz-total>${stats.total}</span></span>
          <button type="button" class="text-button quiz-mode-toggle" ${!wrongOnly && !totalPending ? 'disabled' : ''}>${wrongOnly ? '返回随机测验' : `错题回练（${totalPending}）`}</button>
          ${roundEntry.returnTo ? '<button type="button" class="text-button" data-action="quiz-return">返回温故队列</button>' : ''}</div>
        ${legacyCode ? '<p class="assessment-warning">旧卦码摘要：原题型未保留。本次练习不代表原具体错误已纠正。</p>' : ''}
        ${weakError ? '<p class="assessment-warning" role="status">具体温习记录异常，请先备份核对；不会清空原有成绩。</p>' : ''}
        ${question ? `<div class="mode-card quiz-question"><span>${isAlmanac ? '历法辨识' : wrongOnly ? '原规则回练' : '卦象辨识'}</span><p>${esc(question.question)}</p></div>
          <p class="quiz-instruction">选择你的答案</p><div class="quiz-options">${options}</div><div class="quiz-feedback"></div>` :
          `<section class="mode-empty"><p role="status">${esc(reason)}</p><button type="button" class="quick-btn" data-action="quiz-learning">返回学习</button>
            <button type="button" class="text-button" data-action="quiz-review">查看温故队列</button></section>`}
      </div>`;
    activeRoot = mountEl.querySelector('.quiz-panel');
    const root = activeRoot;
    const current = () => !disposed && root.isConnected !== false && root === activeRoot && mountEl.querySelector('.quiz-panel') === root;
    const navigate = (mode, nextEntry) => { if (current()) onNavigateMode?.(mode, nextEntry); };
    mountEl.querySelector('.quiz-mode-toggle')?.addEventListener('click', () => {
      if (current()) show(wrongOnly ? {} : { wrongOnly: true });
    });
    mountEl.querySelector('[data-action="quiz-return"]')?.addEventListener('click', () => {
      if (roundEntry.returnTo?.mode === 'quiz') navigate('quiz', roundEntry.returnTo.entry || {});
      else navigate('review');
    });
    mountEl.querySelector('[data-action="quiz-learning"]')?.addEventListener('click', () => navigate('learning'));
    mountEl.querySelector('[data-action="quiz-review"]')?.addEventListener('click', () => navigate('review'));
    const panel = mountEl.closest?.('.detail-panel');
    if (panel) panel.scrollTop = 0;
    mountEl.scrollTop = 0;
    const heading = mountEl.querySelector('[data-page-heading]');
    schedule(() => { if (current() && heading?.isConnected !== false) { heading.tabIndex = -1; heading.focus?.({ preventScroll: true }); } });
    if (!question) return;

    let submitted = false;
    let picked = null;
    let feedbackReady = false;
    let lastResult = null;
    const feedback = mountEl.querySelector('.quiz-feedback');
    const save = () => {
      if (!current()) return;
      lastResult = submitQuizAttempt(attempt, picked);
      const savedStats = lastResult.changes?.stats?.saved ? lastResult.stats : loadStats();
      mountEl.querySelector('[data-quiz-correct]').textContent = String(savedStats.correct);
      mountEl.querySelector('[data-quiz-total]').textContent = String(savedStats.total);
      mountEl.querySelector('[data-quiz-rate]').textContent = `${savedStats.total ? Math.round(savedStats.correct / savedStats.total * 100) : 0}%`;
      if (!feedbackReady) {
        const answerName = isAlmanac ? question.answerText : appState.index.byCode.get(question.answer)?.name;
        feedback.innerHTML = renderLearningFeedback({
          result: `<p class="${lastResult.correct ? 'feedback-correct' : 'feedback-wrong'}">${lastResult.correct ? '回答正确' : `正确答案是「${esc(answerName || '—')}」`}</p>
            <p>${lastResult.correct ? '单次答对不代表已经掌握，仍需结合依据和后续温习。' : '可先核对依据，再按原规则温习。'}</p>`,
          basis: `<div class="quiz-explanation"><p>${esc(question.explanation)}</p>
            ${isAlmanac ? '<button type="button" class="text-button" data-action="quiz-source">查看原术语</button>' : ''}</div>`,
          changes: '<p class="quiz-storage-status"></p><p class="quiz-feedback-status" role="status" aria-live="polite"></p>',
          primaryAction: '<button type="button" class="quiz-next">下一题 →</button>',
          secondaryActions: [
            '<button type="button" class="text-button" data-action="quiz-retry">重试保存未完成的记录</button>',
            '<button type="button" class="text-button" data-action="quiz-review">查看温故队列</button>',
          ],
        });
        feedbackReady = true;
        feedback.querySelector('[data-action="quiz-retry"]')?.addEventListener('click', () => { if (current() && !lastResult.saved) save(); });
        feedback.querySelector('[data-action="quiz-review"]')?.addEventListener('click', () => navigate('review'));
        feedback.querySelector('[data-action="quiz-source"]')?.addEventListener('click', () => navigate('learning', {
          section: 'almanac', termId: question.reference.termId, quizReference: question.reference,
          returnTo: { mode: 'quiz', entry: { wrongOnly: true, reference: question.reference, returnTo: { mode: 'review' } } },
        }));
        feedback.querySelector('.quiz-next')?.addEventListener('click', () => {
          if (!current()) return;
          const remaining = pendingQuestions().length + legacyCodes().length;
          show(wrongOnly && remaining ? { wrongOnly: true, returnTo: roundEntry.returnTo } : {});
        });
      }
      const labels = { stats: '累计统计', weak: '具体错题记录', review: '卦象复习卡', activity: '学习活动', achievement: '成就记录', legacy: '旧卦码摘要' };
      const messages = Object.entries(labels).filter(([key]) => lastResult.changes?.[key]?.applicable)
        .map(([key, label]) => {
          const change = lastResult.changes[key];
          if (key === 'weak' && change.saved && change.outcome === 'reference-mismatch') return '具体错题版本不同，已保留原记录。';
          if (key === 'weak' && change.saved && change.outcome === 'resolved') return '原规则已有效答对，该项已纠正。';
          return `${label}${change.saved ? '已保存' : '未能保存'}。`;
        });
      if (lastResult.error) messages.push(lastResult.error);
      const status = feedback.querySelector('.quiz-storage-status');
      const message = messages.join(' ');
      if (status.textContent !== message) status.textContent = message;
      const announcement = feedback.querySelector('.quiz-feedback-status');
      const announcementText = !lastResult.saved ? '部分学习记录未能保存，可重试未完成部分。'
        : lastResult.error ? '保存检查完成，请核对记录说明。' : '本次学习记录已保存。';
      if (announcement.textContent !== announcementText) announcement.textContent = announcementText;
      const retry = feedback.querySelector('[data-action="quiz-retry"]');
      retry.hidden = lastResult.saved; retry.disabled = lastResult.saved;
      const remaining = pendingQuestions().length + legacyCodes().length;
      feedback.querySelector('.quiz-next').textContent = wrongOnly && !remaining ? '返回随机测验' : '下一题 →';
      revealQuizFeedback(feedback, current, schedule, !lastResult.saved);
    };
    mountEl.querySelectorAll('.quiz-option').forEach(button => button.addEventListener('click', () => {
      if (!current() || submitted || button.disabled) return;
      submitted = true; picked = button.dataset.code;
      mountEl.querySelectorAll('.quiz-option').forEach(option => {
        option.classList.toggle('quiz-correct', option.dataset.code === question.answer);
        option.classList.toggle('quiz-wrong', option.dataset.code === picked && picked !== question.answer);
        option.disabled = true;
      });
      save();
    }));
  }
  show(entry);
  return () => { disposed = true; cancelFrames(); };
}
