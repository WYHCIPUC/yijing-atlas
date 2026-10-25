import { createProgressEvent } from './achievement-engine.js';
import { processAchievementEvent } from './achievement-storage.js';
import { createAssessmentSession, gradeAssessment, recommendLesson } from './learning-assessment.js';
import {
  buildLearningQuestionBank,
  getLesson,
  getLessonRubric,
  LEARNING_LESSONS,
  LEARNING_LEVELS,
} from './learning-curriculum.js';
import {
  getWeakQuestionsError,
  loadLearningRecord,
  recordLearningAssessment,
  recordOralReview,
} from './learning-progress.js';
import { recordActivity } from './learning-progress.js';
import { evaluateRecitation, loadReviewConfig } from './learning-review.js';
import { renderLearningFeedback } from './learning-feedback.js';

const TOPIC_BY_LESSON = { 'l1-1': 'yin-yang', 'l1-4': 'eight-trigrams' };
const assessmentViews = new WeakMap();
const assessmentPageCleanups = new WeakMap();

function esc(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function sessionTitle(session) {
  if (session.kind === 'spot') return '随机抽查 · 温故';
  if (session.kind === 'exam') return `${LEARNING_LEVELS.find((level) => level.id === session.levelId)?.name || ''}阶段考评`;
  return `${getLesson(session.lessonId)?.title || '课程'} · 课后小试`;
}

function resetAssessmentViewport(container, isCurrent, selector = '[data-page-heading]') {
  if (!isCurrent()) return;
  if (selector === '[data-page-heading]') {
    const detailPanel = container.closest?.('.detail-panel');
    const detailContent = container.closest?.('.detail-content');
    if (detailPanel) detailPanel.scrollTop = 0;
    if (detailContent) detailContent.scrollTop = 0;
    container.scrollTop = 0;
  }
  const schedule = window.requestAnimationFrame || ((callback) => callback());
  const target = container.querySelector(selector);
  schedule(() => {
    if (!isCurrent() || !target || target.isConnected === false || container.querySelector(selector) !== target) return;
    target.tabIndex = -1;
    if (selector !== '[data-page-heading]') target.scrollIntoView?.({ block: 'center', behavior: 'instant' });
    target.focus?.({ preventScroll: true });
  });
}

function renderQuestionForm(container, session, onComplete, draft, backLabel, isCurrent) {
  let submitted = false;
  container.innerHTML = `
    <section class="assessment-sheet" aria-labelledby="assessment-sheet-title" data-assessment-session="${esc(session.id)}">
      <div class="assessment-sheet-head">
        <div><span class="academy-kicker">明辨</span><h3 id="assessment-sheet-title" data-page-heading>${esc(sessionTitle(session))}</h3></div>
        <span>${session.questions.length} 题</span>
      </div>
      <form class="assessment-form">
        ${session.questions.map((item, questionIndex) => `
          <fieldset class="assessment-question">
            <legend><span>${questionIndex + 1}</span>${esc(item.prompt)}</legend>
            <div class="assessment-options">
              ${item.options.map((option, optionIndex) => `
                <label><input type="radio" name="question-${questionIndex}" value="${optionIndex}" ${draft[item.id] === option.value ? 'checked' : ''} />
                  <span>${esc(option.label)}</span></label>
              `).join('')}
            </div>
          </fieldset>
        `).join('')}
        <p class="assessment-status" role="status" aria-live="polite"></p>
        <div class="assessment-actions">
          <button type="button" class="text-button" data-action="cancel">${backLabel}</button>
          <button type="submit" class="quick-btn">交卷评定</button>
        </div>
      </form>
    </section>`;

  const readOption = (selected, question) => {
    const index = Number(selected?.value);
    return selected && Number.isInteger(index) && String(index) === selected.value ? question.options[index] : null;
  };
  const form = container.querySelector('.assessment-form');
  const isCurrentForm = () => !submitted && isCurrent() && form.isConnected !== false &&
    container.querySelector('.assessment-form') === form;
  container.querySelector('[data-action="cancel"]').addEventListener('click', () => {
    if (!isCurrentForm()) return;
    submitted = true;
    onComplete(null);
  });
  form.addEventListener('change', () => {
    if (!isCurrentForm()) return;
    session.questions.forEach((question, index) => {
      const option = readOption(container.querySelector(`input[name="question-${index}"]:checked`), question);
      if (option) draft[question.id] = option.value;
      else delete draft[question.id];
    });
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!isCurrentForm()) return;
    const answers = {};
    for (let index = 0; index < session.questions.length; index += 1) {
      const question = session.questions[index];
      const selected = container.querySelector(`input[name="question-${index}"]:checked`);
      const option = readOption(selected, question);
      if (!option) {
        container.querySelector('.assessment-status').textContent = `请先完成第 ${index + 1} 题。`;
        container.querySelector(`input[name="question-${index}"]`)?.focus();
        return;
      }
      answers[question.id] = option.value;
    }
    const result = gradeAssessment(session, answers);
    if (!result) return;
    submitted = true;
    onComplete(result);
  });
  resetAssessmentViewport(container, isCurrentForm);
}

function courseQuestionStatus(item, answer, session, assessment, weakQuestions, error) {
  if (!assessment?.saved) return '本轮成绩与课程温习记录未保存，恢复存储后可重试。';
  if (assessment.evidenceMissing) return '旧记录缺少本轮逐题证据，未补记课程温习。';
  if (error) return '课程温习记录异常，请先导出备份并检查数据。';
  const weak = weakQuestions.find(entry => entry.questionId === item.id);
  if (!weak) return answer.correct ? '本题未产生待温习记录。' : '未读取到本题已保存的课程温习记录。';
  if (weak.sourceKind !== 'course' || weak.questionVersion !== item.questionVersion ||
      weak.lessonId !== item.lessonId || weak.questionType !== item.kind ||
      weak.targetCode !== item.targetCode || weak.termId !== item.termId) {
    return '原有温习记录与本题引用不同，未改动旧记录。';
  }
  if (weak.status === 'resolved') return weak.lastSessionId === session.id && answer.correct
    ? '本轮已纠正；保留此前错误记录。' : '本题已有纠正记录。';
  return weak.lastSessionId === session.id && !answer.correct ? '已加入课程温习。' : '本题仍在课程温习队列中。';
}

function renderResult(container, session, result, onBack, saveState, onRetry, actions = {}) {
  const storedRecord = loadLearningRecord();
  const weakError = getWeakQuestionsError(storedRecord.weakQuestions);
  const weakQuestions = weakError ? [] : Object.values(storedRecord.weakQuestions || {});
  const percent = Math.round(result.correct / result.total * 100);
  const pending = [];
  if (!saveState.assessment?.saved) pending.push('本轮成绩');
  else if (!saveState.assessment.evidenceMissing) {
    if (!saveState.activitySaved) pending.push('学习日记录');
    if (!saveState.achievementsSaved) pending.push('成就证据');
  }
  const missingEvidence = saveState.assessment?.evidenceMissing;
  const receipt = saveState.assessment?.entry;
  const saveMessage = missingEvidence
    ? '本轮标识已处理，未重复计分；旧记录未保留本轮成绩明细，无法补记成就证据。当前答案仅供核对。'
    : pending.length ? `${pending.join('、')}未能保存；答案和分数仍可查看。`
      : saveState.assessment?.duplicate
        ? `本轮已记录，未重复计分；已保存成绩为 ${receipt.correct}/${receipt.total} 题正确，当前答案仅供核对。`
        : '本轮成绩与学习记录已保存。';
  const backAction = '<button type="button" class="quick-btn" data-action="back">返回考评中心</button>';
  const reviewAction = '<button type="button" class="text-button" data-action="return-review">前往温故队列</button>';
  container.innerHTML = `
    <section class="assessment-result" aria-labelledby="assessment-result-title" data-assessment-session="${esc(session.id)}">
      <span class="academy-kicker">考校</span>
      <h3 id="assessment-result-title" data-page-heading>${esc(sessionTitle(session))}</h3>
      ${renderLearningFeedback({
        result: `<div class="assessment-score"><strong>${percent}</strong><span>分</span></div>
          <p>${result.correct}/${result.total} 题正确。${percent >= 80 ? '本轮掌握稳定，可继续温习或进入下一课。' : '建议查看辨析后回到原课温习，再进行一次小试。'}</p>`,
        basis: `<div class="assessment-review-list">
        ${session.questions.map((item, index) => {
          const answer = result.results[index];
          return `<details ${answer.correct ? '' : 'open'}>
            <summary class="${answer.correct ? 'answer-correct' : 'answer-wrong'}">${index + 1}. ${answer.correct ? '答对' : '待温习'} · ${esc(item.prompt)}</summary>
            <p>正答：${esc(item.answer)}</p>
            <p>${esc(item.explanation)}</p>
            <small>依据：${esc(item.source)}</small>
            <p class="course-weak-status">${esc(courseQuestionStatus(item, answer, session, saveState.assessment, weakQuestions, weakError))}</p>
            <div class="course-weak-actions">
              <button type="button" class="text-button" data-action="weak-source-${index}">回原课温习</button>
              ${item.questionVersion ? `<button type="button" class="text-button" data-action="weak-practice-${index}">回练此题</button>` : ''}
            </div>
          </details>`;
        }).join('')}
        </div>`,
        changes: `<p class="assessment-save-status ${pending.length || missingEvidence ? 'assessment-warning' : 'assessment-success'}" role="status" aria-live="polite">${esc(saveMessage)}</p>`,
        primaryAction: pending.length ? '<button type="button" class="text-button" data-action="retry-save">重试保存本轮记录</button>' : backAction,
        secondaryActions: pending.length ? [backAction, reviewAction] : [reviewAction],
      })}
    </section>`;
  container.querySelector('[data-action="back"]').addEventListener('click', onBack);
  container.querySelector('[data-action="retry-save"]')?.addEventListener('click', onRetry);
  container.querySelector('[data-action="return-review"]')?.addEventListener('click', actions.onReview);
  session.questions.forEach((item, index) => {
    container.querySelector(`[data-action="weak-source-${index}"]`)?.addEventListener('click', () => actions.onSource?.(item));
    container.querySelector(`[data-action="weak-practice-${index}"]`)?.addEventListener('click', () => actions.onPractice?.(item));
  });
  resetAssessmentViewport(container, actions.isCurrent,
    pending.length || missingEvidence ? '.assessment-save-status' : '[data-feedback-section="result"]');
}

function renderRubric(container, lessonId, appState, onScore, message = '') {
  const rubric = getLessonRubric(lessonId, appState);
  container.innerHTML = `
    ${message ? `<p class="assessment-warning" role="status">${esc(message)}</p>` : ''}
    <div class="oral-rubric">
      <h4>典籍要点核对</h4>
      <p>对照下列要点检查自己的复讲。自评只记录个人温习状态，不作为强制门槛。</p>
      <ul>${rubric.map((item) => `<li>${esc(item)}</li>`).join('')}</ul>
      <div class="oral-self-scores" aria-label="复讲自评">
        <button type="button" data-score="40">初识 · 40</button>
        <button type="button" data-score="60">能述 · 60</button>
        <button type="button" data-score="80">明辨 · 80</button>
        <button type="button" data-score="100">通达 · 100</button>
      </div>
    </div>`;
  container.querySelectorAll('[data-score]').forEach((button) => {
    button.addEventListener('click', () => {
      onScore(Number(button.dataset.score));
    });
  });
}

function recordLessonAchievementEvents(result, saved) {
  if (result.kind !== 'lesson' || !result.lessonId) return true;
  if (!saved.saved) return false;
  const entry = saved.entry;
  if (!entry || (entry.kind && (entry.kind !== 'lesson' || entry.lessonId !== result.lessonId))) return false;
  const occurredAt = entry.at;
  if (!occurredAt) return false;
  const completed = processAchievementEvent(createProgressEvent({
    type: 'lesson.completed',
    subjectId: result.lessonId,
    outcome: 'completed',
    occurredAt,
    idempotencyKey: `learning-record:completed:${result.lessonId}`,
  }));
  const assessed = processAchievementEvent(createProgressEvent({
    type: 'lesson.assessed',
    subjectId: result.lessonId,
    score: entry.correct / entry.total,
    outcome: entry.correct / entry.total >= 0.6 ? 'passed' : 'failed',
    occurredAt,
    idempotencyKey: `learning-record:assessed:${result.lessonId}:${result.sessionId}`,
    metadata: TOPIC_BY_LESSON[result.lessonId] ? { topic: TOPIC_BY_LESSON[result.lessonId] } : {},
  }));
  return completed.saved && assessed.saved;
}

function bindOralReview(mountEl, appState, onNavigate) {
  const lessonSelect = mountEl.querySelector('[data-field="oral-lesson"]');
  const response = mountEl.querySelector('[data-field="oral-response"]');
  const output = mountEl.querySelector('.oral-review-output');
  const aiButton = mountEl.querySelector('[data-action="ai-review"]');
  const selfButton = mountEl.querySelector('[data-action="self-review"]');
  const config = loadReviewConfig();
  let disposed = false;
  let generation = 0;
  let pending = false;
  let submission = null;
  aiButton.disabled = !config.endpoint;
  aiButton.title = config.endpoint ? '' : '请先在“数据”栏目配置安全的服务端评阅地址';

  const isCurrent = token => !disposed && token === generation && response.isConnected !== false &&
    mountEl.querySelector('.oral-review-output') === output;
  const invalidate = () => {
    if (disposed) return;
    generation++;
    pending = false;
    submission = null;
    output.innerHTML = '';
    aiButton.disabled = !config.endpoint;
  };
  const saveSubmission = view => {
    if (!isCurrent(view.generation) || submission !== view) return;
    if (!view.reviewSaved) view.reviewSaved = recordOralReview(view.lessonId, view.score, view.mode, view.at).saved;
    if (!view.activitySaved) view.activitySaved = recordActivity(view.at).saved;
  };
  const showResult = view => {
    if (!isCurrent(view.generation) || submission !== view) return;
    const incomplete = !view.reviewSaved || !view.activitySaved;
    const lesson = getLesson(view.lessonId);
    const rubric = getLessonRubric(view.lessonId, appState);
    const newAction = '<button type="button" class="text-button" data-action="oral-new">开始新的复讲</button>';
    const sourceActions = lesson ? ['<button type="button" class="text-button" data-action="oral-source">回原课温习</button>'] : [];
    output.innerHTML = `
      <div class="oral-ai-result">
        ${renderLearningFeedback({
          result: `<span class="review-mode-badge">${view.mode === 'ai' ? '智能评阅' : '基于要点的自评'}</span><strong>${view.score} 分</strong>
            <p>${esc(view.review?.summary || '这是个人对要点掌握情况的自评，不作为客观考评结果。')}</p>
            ${view.review?.strengths.length ? `<h4>已掌握</h4><ul>${view.review.strengths.map(item => `<li>${esc(item)}</li>`).join('')}</ul>` : ''}
            ${view.review?.improvements.length ? `<h4>再温习</h4><ul>${view.review.improvements.map(item => `<li>${esc(item)}</li>`).join('')}</ul>` : ''}`,
          basis: `<h4>项目课程要点</h4><p>课程：${esc(lesson?.title || '原课暂不可定位')}</p>
            <ul>${rubric.map(item => `<li>${esc(item)}</li>`).join('')}</ul>
            <p class="oral-source-notice">本结果未附原典出处定位，出处与校验状态待核对；请回原课查看。</p>`,
          changes: `<p class="oral-save-status ${incomplete ? 'assessment-warning' : 'assessment-success'}" role="status">复讲成绩${view.reviewSaved ? '已保存' : '未能保存'}；学习日记录${view.activitySaved ? '已保存' : '未能保存'}。</p>`,
          primaryAction: incomplete ? '<button type="button" class="quick-btn" data-action="oral-retry-save">仅重试保存本轮记录</button>' : newAction,
          secondaryActions: incomplete ? [newAction, ...sourceActions] : sourceActions,
        })}
      </div>`;
    output.querySelector('[data-action="oral-retry-save"]')?.addEventListener('click', () => {
      if (!isCurrent(view.generation) || submission !== view) return;
      saveSubmission(view);
      showResult(view);
      output.querySelector(`[data-action="${!view.reviewSaved || !view.activitySaved ? 'oral-retry-save' : 'oral-new'}"]`)?.focus();
    });
    output.querySelector('[data-action="oral-new"]')?.addEventListener('click', () => {
      if (!isCurrent(view.generation) || submission !== view) return;
      invalidate();
      response.focus();
    });
    const sourceButton = output.querySelector('[data-action="oral-source"]');
    sourceButton?.addEventListener('click', () => {
      if (!isCurrent(view.generation) || submission !== view || output.querySelector('[data-action="oral-source"]') !== sourceButton) return;
      onNavigate?.('path', view.lessonId);
    });
  };
  const complete = (token, lessonId, score, mode, review = null) => {
    if (!isCurrent(token) || submission) return;
    submission = { generation: token, lessonId, score, mode, review, at: new Date(), reviewSaved: false, activitySaved: false };
    saveSubmission(submission);
    showResult(submission);
    const view = submission;
    const selector = view.reviewSaved && view.activitySaved ? '[data-feedback-section="result"]' : '.oral-save-status';
    const target = output.querySelector(selector);
    const schedule = window.requestAnimationFrame || (callback => callback());
    schedule(() => {
      if (!isCurrent(token) || submission !== view || !target || target.isConnected === false || output.querySelector(selector) !== target) return;
      target.tabIndex = -1;
      target.scrollIntoView?.({ block: 'center', behavior: 'instant' });
      target.focus?.({ preventScroll: true });
    });
  };
  const showSelfReview = (token, lessonId, message = '') => {
    renderRubric(output, lessonId, appState, score => complete(token, lessonId, score, 'self'), message);
  };
  const selfReview = () => {
    if (disposed) return;
    invalidate();
    showSelfReview(generation, lessonSelect.value);
  };
  const aiReview = async () => {
    if (!isCurrent(generation) || pending || submission || !config.endpoint) return;
    const lesson = getLesson(lessonSelect.value);
    if (!lesson) return;
    if (response.value.trim().length < 20) {
      output.innerHTML = '<p class="assessment-warning" role="status">请至少写下 20 个字，再提交复讲。</p>';
      response.focus();
      return;
    }
    const token = ++generation;
    const rubric = getLessonRubric(lesson.id, appState);
    pending = true;
    aiButton.disabled = true;
    output.innerHTML = '<p class="assessment-status" role="status">正在请先生评阅复讲…</p>';
    try {
      const review = await evaluateRecitation({
        endpoint: config.endpoint,
        lesson,
        response: response.value,
        rubric,
      });
      complete(token, lesson.id, review.score, 'ai', review);
    } catch (error) {
      if (isCurrent(token)) showSelfReview(token, lesson.id, `${error.message}，已切换为本地要点自评。`);
    } finally {
      if (isCurrent(token)) {
        pending = false;
        aiButton.disabled = !config.endpoint;
      }
    }
  };
  selfButton.addEventListener('click', selfReview);
  aiButton.addEventListener('click', aiReview);
  lessonSelect.addEventListener('change', invalidate);
  response.addEventListener('input', invalidate);
  return () => {
    if (disposed) return;
    disposed = true;
    generation++;
    submission = null;
    selfButton.removeEventListener('click', selfReview);
    aiButton.removeEventListener('click', aiReview);
    lessonSelect.removeEventListener('change', invalidate);
    response.removeEventListener('input', invalidate);
  };
}

export function renderLearningAssessmentPage(mountEl, appState, {
  onNavigate, initialLessonId, requiredQuestionId, requiredQuestionVersion, returnTo, initialOralLessonId,
} = {}) {
  assessmentPageCleanups.get(mountEl)?.();
  let disposed = false;
  let oralCleanup = null;
  const clearOral = () => { oralCleanup?.(); oralCleanup = null; };
  const cleanup = () => {
    if (disposed) return;
    disposed = true;
    clearOral();
    if (assessmentPageCleanups.get(mountEl) === cleanup) assessmentPageCleanups.delete(mountEl);
  };
  assessmentPageCleanups.set(mountEl, cleanup);
  const questionBank = buildLearningQuestionBank(appState);

  const renderHub = () => {
    if (disposed) return;
    clearOral();
    assessmentViews.delete(mountEl);
    const record = loadLearningRecord();
    const recommended = recommendLesson(record);
    mountEl.innerHTML = `
      <div class="academy-heading">
        <div><span class="academy-kicker">书院考校</span><h3 data-page-heading>日课与考评</h3></div>
        <p>学而时习，考而知缺。成绩用于提示温习方向，不限制课程浏览。</p>
      </div>
      <section class="daily-study-card">
        <span class="academy-seal">日课</span>
        <div><small>今日建议</small><strong>${esc(recommended?.title || '自由温习')}</strong><p>${esc(recommended ? `${recommended.levelName} · ${recommended.levelId}` : '已完成全部课程浏览')}</p></div>
        ${recommended ? `<button type="button" class="quick-btn" data-action="daily-study">前往学习</button>` : ''}
      </section>
      <div class="assessment-grid">
        <section class="assessment-launch-card">
          <span class="academy-kicker">每课一试</span><h4>课后小试</h4>
          <p>从当前小节抽取 3 题，立即辨明概念。</p>
          <select data-field="lesson" aria-label="选择小节">
            ${LEARNING_LEVELS.map((level) => `<optgroup label="${esc(`${level.id} ${level.name} · ${level.title}`)}">
              ${level.lessons.map((lesson) => `<option value="${lesson.id}" ${lesson.id === recommended?.id ? 'selected' : ''}>${esc(lesson.title)}</option>`).join('')}
            </optgroup>`).join('')}
          </select>
          <button type="button" class="quick-btn" data-action="lesson-quiz">开始小试</button>
        </section>
        <section class="assessment-launch-card">
          <span class="academy-kicker">温故</span><h4>随机抽查</h4>
          <p>从已浏览课程跨课抽取 5 题，检验记忆保持。</p>
          <button type="button" class="quick-btn" data-action="spot-check">开始抽查</button>
        </section>
        <section class="assessment-launch-card">
          <span class="academy-kicker">考校</span><h4>阶段考评</h4>
          <p>每阶段抽取 10 题，形成综合掌握记录。</p>
          <select data-field="level" aria-label="选择阶段">
            ${LEARNING_LEVELS.map((level) => `<option value="${level.id}">${esc(`${level.id} ${level.name} · ${level.title}`)}</option>`).join('')}
          </select>
          <button type="button" class="quick-btn" data-action="exam">开始考评</button>
        </section>
      </div>
      <section class="oral-review-card">
        <div class="oral-review-head"><div><span class="academy-kicker">复讲</span><h4>以讲促学</h4></div><span class="review-mode-badge">智能可选</span></div>
        <p>不用背标准答案。用自己的话说明一课，再由智能服务或典籍要点清单帮助校准。</p>
        <label>复讲课程<select data-field="oral-lesson">${LEARNING_LESSONS.map((lesson) => `<option value="${lesson.id}">${esc(`${lesson.levelId} · ${lesson.title}`)}</option>`).join('')}</select></label>
        <label>我的复讲<textarea data-field="oral-response" ${initialOralLessonId && getLesson(initialOralLessonId) ? 'data-learning-focus="oral"' : ''} rows="6" maxlength="3000" placeholder="例如：这一课主要说明……它与……的关系是……"></textarea></label>
        <div class="assessment-actions">
          <button type="button" class="text-button" data-action="self-review">查看要点并自评</button>
          <button type="button" class="quick-btn" data-action="ai-review">提交智能评阅</button>
        </div>
        <div class="oral-review-output"></div>
      </section>`;

    mountEl.querySelector('[data-action="daily-study"]')?.addEventListener('click', () => {
      onNavigate?.(recommended.target, recommended.id);
    });
    mountEl.querySelector('[data-action="lesson-quiz"]').addEventListener('click', () => {
      startSession('lesson', { lessonId: mountEl.querySelector('[data-field="lesson"]').value });
    });
    mountEl.querySelector('[data-action="spot-check"]').addEventListener('click', () => {
      startSession('spot', { record });
    });
    mountEl.querySelector('[data-action="exam"]').addEventListener('click', () => {
      startSession('exam', { levelId: mountEl.querySelector('[data-field="level"]').value });
    });
    oralCleanup = bindOralReview(mountEl, appState, onNavigate);
    resetAssessmentViewport(mountEl, () => !disposed);
    if (initialOralLessonId && getLesson(initialOralLessonId)) {
      const select = mountEl.querySelector('[data-field="oral-lesson"]');
      const response = mountEl.querySelector('[data-field="oral-response"]');
      select.value = initialOralLessonId;
      const schedule = window.requestAnimationFrame || ((callback) => callback());
      // Let the parent mode finish its scroll reset and initial heading focus first.
      schedule(() => {
        if (disposed) return;
        schedule(() => {
          if (disposed || response.isConnected === false || mountEl.querySelector('[data-field="oral-response"]') !== response) return;
          response.scrollIntoView?.({ block: 'center', behavior: 'auto' });
          response.focus?.({ preventScroll: true });
        });
      });
    }
  };

  const showSession = (view) => {
    if (disposed) return;
    const isCurrent = () => !disposed && assessmentViews.get(mountEl) === view;
    if (view.result) {
      renderResult(mountEl, view.session, view.result, renderHub, view, () => {
        if (disposed || assessmentViews.get(mountEl) !== view) return;
        saveSubmission(view);
        showSession(view);
      }, {
        isCurrent,
        onReview: () => onNavigate?.('review-mode'),
        onSource: (item) => onNavigate?.('path', item.lessonId, {
          requiredQuestionId: item.id, requiredQuestionVersion: item.questionVersion, returnTo: 'review',
        }),
        onPractice: (item) => startSession('lesson', {
          lessonId: item.lessonId, requiredQuestionId: item.id,
          requiredQuestionVersion: item.questionVersion, returnTo: 'review',
        }),
      });
      return;
    }
    renderQuestionForm(mountEl, view.session, (result) => {
      if (disposed || view.result || assessmentViews.get(mountEl) !== view) return;
      if (!result) {
        if (view.entry.returnTo === 'review') onNavigate?.('review-mode');
        else renderHub();
        return;
      }
      view.result = result;
      saveSubmission(view);
      showSession(view);
    }, view.answers, view.entry.returnTo === 'review' ? '返回温故队列' : '返回考评中心', isCurrent);
  };

  const saveSubmission = (view) => {
    if (disposed) return;
    if (!view.assessment?.saved) view.assessment = recordLearningAssessment(view.session.kind, view.result);
    if (!view.assessment.saved || view.assessment.evidenceMissing) return;
    if (!view.activitySaved) view.activitySaved = recordActivity().saved;
    if (!view.achievementsSaved) view.achievementsSaved = recordLessonAchievementEvents(view.result, view.assessment);
  };

  const startSession = (kind, options) => {
    if (disposed) return;
    clearOral();
    const session = createAssessmentSession(kind, questionBank, options);
    if (!session) {
      assessmentViews.delete(mountEl);
      const unviewed = kind === 'spot' && !Object.values(options.record?.lessons || {}).some((lesson) => lesson?.viewedAt);
      const required = options.requiredQuestionId !== undefined || options.requiredQuestionVersion !== undefined;
      mountEl.innerHTML = `<p class="mode-empty">${required ? '题目已调整，请回原课温习。' : unviewed ? '请先浏览一课，再进行随机抽查。' : '当前范围暂无可用题目，请先返回学习内容。'}</p>
        ${required ? `<button type="button" class="quick-btn" data-action="weak-source">${getLesson(options.lessonId) ? '回原课温习' : '返回学习页'}</button><button type="button" class="text-button" data-action="return-review">返回温故队列</button>` : ''}
        <button type="button" class="text-button" data-action="back">返回考评中心</button>`;
      mountEl.querySelector('[data-action="back"]').addEventListener('click', renderHub);
      mountEl.querySelector('[data-action="weak-source"]')?.addEventListener('click', () => {
        if (getLesson(options.lessonId)) onNavigate?.('path', options.lessonId, { ...options, returnTo: 'review' });
        else onNavigate?.('path');
      });
      mountEl.querySelector('[data-action="return-review"]')?.addEventListener('click', () => onNavigate?.('review-mode'));
      return;
    }
    const view = { session, answers: {}, request: { initialLessonId, requiredQuestionId, requiredQuestionVersion }, entry: {
      requiredQuestionId: options.requiredQuestionId,
      requiredQuestionVersion: options.requiredQuestionVersion,
      returnTo: options.returnTo,
    } };
    assessmentViews.set(mountEl, view);
    showSession(view);
  };

  const active = assessmentViews.get(mountEl);
  const displayedSessionId = mountEl.querySelector('[data-assessment-session]')?.dataset.assessmentSession;
  if (initialOralLessonId) renderHub();
  else if (active && active.session.id === displayedSessionId && active.request.initialLessonId === initialLessonId &&
      active.request.requiredQuestionId === requiredQuestionId && active.request.requiredQuestionVersion === requiredQuestionVersion) showSession(active);
  else if (initialLessonId && (getLesson(initialLessonId) || requiredQuestionId !== undefined)) startSession('lesson', {
    lessonId: initialLessonId, requiredQuestionId, requiredQuestionVersion, returnTo,
  });
  else renderHub();
  return cleanup;
}
