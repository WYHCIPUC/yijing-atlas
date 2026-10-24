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
  loadLearningRecord,
  recordLearningAssessment,
  recordOralReview,
} from './learning-progress.js';
import { recordActivity } from './learning-progress.js';
import { evaluateRecitation, loadReviewConfig } from './learning-review.js';

const TOPIC_BY_LESSON = { 'l1-1': 'yin-yang', 'l1-4': 'eight-trigrams' };
const assessmentViews = new WeakMap();

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

function resetAssessmentViewport(container) {
  const detailPanel = container.closest?.('.detail-panel');
  const detailContent = container.closest?.('.detail-content');
  if (detailPanel) detailPanel.scrollTop = 0;
  if (detailContent) detailContent.scrollTop = 0;
  container.scrollTop = 0;
  const schedule = window.requestAnimationFrame || ((callback) => callback());
  schedule(() => {
    const heading = container.querySelector('[data-page-heading]');
    if (!heading) return;
    heading.tabIndex = -1;
    heading.focus?.({ preventScroll: true });
  });
}

function renderQuestionForm(container, session, onComplete, draft = {}) {
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
          <button type="button" class="text-button" data-action="cancel">返回考评中心</button>
          <button type="submit" class="quick-btn">交卷评定</button>
        </div>
      </form>
    </section>`;

  const readOption = (selected, question) => {
    const index = Number(selected?.value);
    return selected && Number.isInteger(index) && String(index) === selected.value ? question.options[index] : null;
  };
  container.querySelector('[data-action="cancel"]').addEventListener('click', () => {
    if (submitted) return;
    submitted = true;
    onComplete(null);
  });
  const form = container.querySelector('.assessment-form');
  form.addEventListener('change', () => {
    session.questions.forEach((question, index) => {
      const option = readOption(container.querySelector(`input[name="question-${index}"]:checked`), question);
      if (option) draft[question.id] = option.value;
      else delete draft[question.id];
    });
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (submitted) return;
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
  resetAssessmentViewport(container);
}

function renderResult(container, session, result, onBack, saveState, onRetry) {
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
  container.innerHTML = `
    <section class="assessment-result" aria-labelledby="assessment-result-title" data-assessment-session="${esc(session.id)}">
      <span class="academy-kicker">考校</span>
      <h3 id="assessment-result-title" data-page-heading>${esc(sessionTitle(session))}</h3>
      <div class="assessment-score"><strong>${percent}</strong><span>分</span></div>
      <p>${result.correct}/${result.total} 题正确。${percent >= 80 ? '本轮掌握稳定，可继续温习或进入下一课。' : '建议查看辨析后回到原课温习，再进行一次小试。'}</p>
      <p class="assessment-save-status ${pending.length || missingEvidence ? 'assessment-warning' : 'assessment-success'}" role="status" aria-live="polite">${esc(saveMessage)}</p>
      ${pending.length ? '<button type="button" class="text-button" data-action="retry-save">重试保存本轮记录</button>' : ''}
      <div class="assessment-review-list">
        ${session.questions.map((item, index) => {
          const answer = result.results[index];
          return `<details ${answer.correct ? '' : 'open'}>
            <summary class="${answer.correct ? 'answer-correct' : 'answer-wrong'}">${index + 1}. ${answer.correct ? '答对' : '待温习'} · ${esc(item.prompt)}</summary>
            <p>正答：${esc(item.answer)}</p>
            <p>${esc(item.explanation)}</p>
            <small>依据：${esc(item.source)}</small>
          </details>`;
        }).join('')}
      </div>
      <button type="button" class="quick-btn" data-action="back">返回考评中心</button>
    </section>`;
  container.querySelector('[data-action="back"]').addEventListener('click', onBack);
  container.querySelector('[data-action="retry-save"]')?.addEventListener('click', onRetry);
  resetAssessmentViewport(container);
}

function renderRubric(container, lessonId, appState, message = '') {
  const rubric = getLessonRubric(lessonId, appState);
  container.innerHTML = `
    ${message ? `<p class="assessment-warning">${esc(message)}</p>` : ''}
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
      const result = recordOralReview(lessonId, Number(button.dataset.score), 'self');
      recordActivity();
      container.innerHTML = `<p class="assessment-success">本次复讲已按“${esc(button.textContent)}”记录${result.saved ? '。' : '，但浏览器未能保存记录。'}</p>`;
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

function bindOralReview(mountEl, appState) {
  const lessonSelect = mountEl.querySelector('[data-field="oral-lesson"]');
  const response = mountEl.querySelector('[data-field="oral-response"]');
  const output = mountEl.querySelector('.oral-review-output');
  const aiButton = mountEl.querySelector('[data-action="ai-review"]');
  const config = loadReviewConfig();
  aiButton.disabled = !config.endpoint;
  aiButton.title = config.endpoint ? '' : '请先在“数据”栏目配置安全的服务端评阅地址';

  mountEl.querySelector('[data-action="self-review"]').addEventListener('click', () => {
    renderRubric(output, lessonSelect.value, appState);
  });
  aiButton.addEventListener('click', async () => {
    const lesson = getLesson(lessonSelect.value);
    const rubric = getLessonRubric(lesson.id, appState);
    aiButton.disabled = true;
    output.innerHTML = '<p class="assessment-status">正在请先生评阅复讲…</p>';
    try {
      const review = await evaluateRecitation({
        endpoint: config.endpoint,
        lesson,
        response: response.value,
        rubric,
      });
      const saved = recordOralReview(lesson.id, review.score, 'ai');
      recordActivity();
      output.innerHTML = `
        <div class="oral-ai-result">
          <span class="review-mode-badge">智能评阅</span><strong>${review.score} 分</strong>
          <p>${esc(review.summary)}</p>
          ${review.strengths.length ? `<h4>已掌握</h4><ul>${review.strengths.map((item) => `<li>${esc(item)}</li>`).join('')}</ul>` : ''}
          ${review.improvements.length ? `<h4>再温习</h4><ul>${review.improvements.map((item) => `<li>${esc(item)}</li>`).join('')}</ul>` : ''}
          ${saved.saved ? '' : '<small>点评已返回，但浏览器未能保存本次记录。</small>'}
        </div>`;
    } catch (error) {
      renderRubric(output, lesson.id, appState, `${error.message}，已切换为本地要点自评。`);
    } finally {
      aiButton.disabled = !config.endpoint;
    }
  });
}

export function renderLearningAssessmentPage(mountEl, appState, { onNavigate, initialLessonId } = {}) {
  const questionBank = buildLearningQuestionBank(appState);

  const renderHub = () => {
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
        <label>我的复讲<textarea data-field="oral-response" rows="6" maxlength="3000" placeholder="例如：这一课主要说明……它与……的关系是……"></textarea></label>
        <div class="assessment-actions">
          <button type="button" class="text-button" data-action="self-review">查看要点并自评</button>
          <button type="button" class="quick-btn" data-action="ai-review">提交智能评阅</button>
        </div>
        <div class="oral-review-output" aria-live="polite"></div>
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
    bindOralReview(mountEl, appState);
    resetAssessmentViewport(mountEl);
  };

  const showSession = (view) => {
    if (view.result) {
      renderResult(mountEl, view.session, view.result, renderHub, view, () => {
        saveSubmission(view);
        showSession(view);
      });
      return;
    }
    renderQuestionForm(mountEl, view.session, (result) => {
      if (view.result || assessmentViews.get(mountEl) !== view) return;
      if (!result) {
        renderHub();
        return;
      }
      view.result = result;
      saveSubmission(view);
      showSession(view);
    }, view.answers);
  };

  const saveSubmission = (view) => {
    if (!view.assessment?.saved) view.assessment = recordLearningAssessment(view.session.kind, view.result);
    if (!view.assessment.saved || view.assessment.evidenceMissing) return;
    if (!view.activitySaved) view.activitySaved = recordActivity().saved;
    if (!view.achievementsSaved) view.achievementsSaved = recordLessonAchievementEvents(view.result, view.assessment);
  };

  const startSession = (kind, options) => {
    const session = createAssessmentSession(kind, questionBank, options);
    if (!session) {
      const unviewed = kind === 'spot' && !Object.values(options.record?.lessons || {}).some((lesson) => lesson?.viewedAt);
      mountEl.innerHTML = `<p class="mode-empty">${unviewed ? '请先浏览一课，再进行随机抽查。' : '当前范围暂无可用题目，请先返回学习内容。'}</p><button type="button" class="quick-btn" data-action="back">返回考评中心</button>`;
      mountEl.querySelector('[data-action="back"]').addEventListener('click', renderHub);
      return;
    }
    const view = { session, answers: {} };
    assessmentViews.set(mountEl, view);
    showSession(view);
  };

  const active = assessmentViews.get(mountEl);
  const displayedSessionId = mountEl.querySelector('[data-assessment-session]')?.dataset.assessmentSession;
  if (active && active.session.id === displayedSessionId && (!initialLessonId || initialLessonId === active.session.lessonId)) showSession(active);
  else if (initialLessonId && getLesson(initialLessonId)) startSession('lesson', { lessonId: initialLessonId });
  else renderHub();
}
