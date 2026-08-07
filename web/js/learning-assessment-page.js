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

function renderQuestionForm(container, session, onComplete) {
  container.innerHTML = `
    <section class="assessment-sheet" aria-labelledby="assessment-sheet-title">
      <div class="assessment-sheet-head">
        <div><span class="academy-kicker">明辨</span><h3 id="assessment-sheet-title">${esc(sessionTitle(session))}</h3></div>
        <span>${session.questions.length} 题</span>
      </div>
      <form class="assessment-form">
        ${session.questions.map((item, questionIndex) => `
          <fieldset class="assessment-question">
            <legend><span>${questionIndex + 1}</span>${esc(item.prompt)}</legend>
            <div class="assessment-options">
              ${item.options.map((option, optionIndex) => `
                <label><input type="radio" name="question-${questionIndex}" value="${optionIndex}" />
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

  container.querySelector('[data-action="cancel"]').addEventListener('click', () => onComplete(null));
  container.querySelector('.assessment-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const answers = {};
    for (let index = 0; index < session.questions.length; index += 1) {
      const selected = container.querySelector(`input[name="question-${index}"]:checked`);
      if (!selected) {
        container.querySelector('.assessment-status').textContent = `请先完成第 ${index + 1} 题。`;
        selected || container.querySelector(`input[name="question-${index}"]`)?.focus();
        return;
      }
      const question = session.questions[index];
      answers[question.id] = question.options[Number(selected.value)].value;
    }
    onComplete(gradeAssessment(session, answers));
  });
}

function renderResult(container, session, result, onBack) {
  const percent = Math.round(result.correct / result.total * 100);
  container.innerHTML = `
    <section class="assessment-result" aria-labelledby="assessment-result-title">
      <span class="academy-kicker">考校</span>
      <h3 id="assessment-result-title">${esc(sessionTitle(session))}</h3>
      <div class="assessment-score"><strong>${percent}</strong><span>分</span></div>
      <p>${result.correct}/${result.total} 题正确。${percent >= 80 ? '本轮掌握稳定，可继续温习或进入下一课。' : '建议查看辨析后回到原课温习，再进行一次小试。'}</p>
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
  const record = loadLearningRecord();
  const recommended = recommendLesson(record);

  const renderHub = () => {
    mountEl.innerHTML = `
      <div class="academy-heading">
        <div><span class="academy-kicker">书院考校</span><h3>日课与考评</h3></div>
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
  };

  const startSession = (kind, options) => {
    const session = createAssessmentSession(kind, questionBank, options);
    if (!session) {
      mountEl.innerHTML = '<p class="mode-empty">当前课程还没有足够的题目，请先返回学习内容。</p>';
      return;
    }
    renderQuestionForm(mountEl, session, (result) => {
      if (!result) {
        renderHub();
        return;
      }
      const saved = recordLearningAssessment(kind, result);
      recordActivity();
      renderResult(mountEl, session, result, () => renderLearningAssessmentPage(mountEl, appState, { onNavigate }));
      if (!saved.saved) mountEl.querySelector('.assessment-result p').insertAdjacentHTML(
        'afterend', '<p class="assessment-warning">本次已完成，但浏览器未能保存考评记录。</p>',
      );
    });
  };

  if (initialLessonId && getLesson(initialLessonId)) startSession('lesson', { lessonId: initialLessonId });
  else renderHub();
}
