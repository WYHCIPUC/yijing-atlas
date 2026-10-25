import { renderAlmanacKnowledgePage } from '../almanac-knowledge.js';
import { ABILITY_DIMENSIONS } from '../achievement-catalog.js';
import { createProgressEvent, summarizeAchievements } from '../achievement-engine.js';
import { loadAchievementState, processAchievementEvent } from '../achievement-storage.js';
import { renderLearningAssessmentPage } from '../learning-assessment-page.js';
import { recommendLearningTask } from '../learning-assessment.js';
import { LEARNING_LESSONS } from '../learning-curriculum.js';
import {
  calculateStreak,
  getCourseWeakQuestions,
  getQuizWeakQuestions,
  getLearningResumeError,
  getWeakQuestionsError,
  loadActivity,
  loadLearningRecord,
  markLessonViewed,
  recordActivity,
  summarizeLearning,
} from '../learning-progress.js';
import { loadReviewConfig, saveReviewConfig } from '../learning-review.js';
import { renderTrigrams } from '../render.js';
import { getDueCount, loadReviewCards } from '../review-engine.js';
import { loadWrongBook } from '../quiz-engine.js';
import { renderLearningLessonPage, renderStudyPathPage, renderTheoremsPage, renderWingsPage } from '../study-page.js?v=50';
import { downloadUserData, importUserData, parseUserData } from '../user-data.js';

const sections = [
  { id: 'today', label: '今日修习' },
  { id: 'path', label: '五阶学程' },
  { id: 'library', label: '典籍书库' },
  { id: 'profile', label: '修习谱' },
];

const sectionOwners = {
  assessment: 'profile',
  trigrams: 'library',
  wings: 'library',
  theorems: 'library',
  almanac: 'library',
  data: 'profile',
};

function dispatchInsight(items) {
  if (typeof document.dispatchEvent !== 'function' || typeof CustomEvent !== 'function') return;
  document.dispatchEvent(new CustomEvent('yijing:workspace-insight', { detail: items }));
}

function escapeLearningText(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderTodaySection(content, onNavigate, notice = '') {
  const record = loadLearningRecord();
  const summary = summarizeLearning(record, LEARNING_LESSONS);
  const reviewCards = loadReviewCards();
  const task = recommendLearningTask(record, { reviewCards, wrongCodes: loadWrongBook(), now: Date.now() });
  const lessonId = task.type === 'course-weak' ? task.question?.lessonId : task.subject;
  const lesson = LEARNING_LESSONS.find(item => item.id === lessonId);
  const taskViews = {
    resume: ['继续阅读', lesson?.title, '继续研习', '阅读当前课程，并完成本轮小试。'],
    review: ['到期复习', `${task.count || 0} 项卦象间隔卡`, '开始到期复习', '先回忆、再核对，并按真实记忆完成自评。'],
    'course-weak': ['课程温习', lesson?.title, '回练原题', '完成包含原题的小试，以有效答对纠正该项。'],
    'quiz-question': ['测验与术语温习', `课程、测验与术语共 ${task.count || 0} 项待温习`, '回练原规则', '核对原规则与目标，以有效答对纠正该项。'],
    'quiz-weak': ['旧卦码摘要', `${task.count || 0} 卦待温习`, '开始卦象练习', '原题型未保留；完成本次练习，不冒称原具体错误已纠正。'],
    lesson: ['下一课', lesson?.title, '开始研习', '阅读课程并完成一次课后小试。'],
    oral: ['复讲温习', lesson?.title, '开始复讲', '用自己的话复述，再对照要点自评。'],
    empty: ['自由温习', '从五阶学程选择内容', '浏览全部课程', '按自己的需要选择温习内容。'],
  };
  const [typeLabel, title, actionLabel, completion] = taskViews[task.type] || taskViews.empty;
  const dueCount = getDueCount(reviewCards);
  const weakError = getWeakQuestionsError(record.weakQuestions);
  const courseCount = getCourseWeakQuestions(record).length;
  const quizCount = getQuizWeakQuestions(record).length;
  const legacyCount = loadWrongBook().length;
  const streak = calculateStreak(loadActivity().days);
  content.innerHTML = `
    <section class="today-practice" aria-labelledby="today-practice-title">
      <header class="today-practice-head">
        <div><span class="academy-kicker">今日修习</span><h3 id="today-practice-title" data-page-heading>先做最值得做的一步</h3></div>
        <div class="today-practice-rank"><small>当前学阶</small><strong>${summary.rank.label}</strong></div>
      </header>
      <article class="today-primary-card">
        <div class="today-primary-index" aria-hidden="true">${lesson ? String(LEARNING_LESSONS.indexOf(lesson) + 1).padStart(2, '0') : '·'}</div>
        <div class="today-primary-copy">
          <span>${escapeLearningText(typeLabel)}</span>
          <h4>${escapeLearningText(title || '自由温习')}</h4>
          <p>${escapeLearningText(task.reason)}</p>
          <small>完成标准：${escapeLearningText(completion)}</small>
        </div>
        <button type="button" class="quick-btn today-primary-action">${escapeLearningText(actionLabel)}</button>
      </article>
      ${notice || task.notice ? `<p class="assessment-warning" role="status">${escapeLearningText(notice || task.notice)}</p>` : ''}
      <div class="today-support-grid">
        <button type="button" class="today-support-card" data-mode-target="review">
          <span>温故队列</span><strong>${weakError ? '待核对' : dueCount + courseCount + quizCount + legacyCount}</strong>
          <small>卦象间隔卡 ${dueCount} 项 · ${weakError ? '温习记录异常，请先备份核对' : `课程温习 ${courseCount} 项 · 测验与术语 ${quizCount} 项`} · 旧卦码摘要 ${legacyCount} 项</small>
        </button>
        <button type="button" class="today-support-card" data-section-target="assessment">
          <span>即时小试</span><strong>${summary.checked}/${summary.total}</strong><small>用判断发现真正的薄弱点</small>
        </button>
        <button type="button" class="today-support-card" data-section-target="profile">
          <span>修习节律</span><strong>${streak} 天</strong><small>按自己的节奏积累，不作排名</small>
        </button>
      </div>
      <footer class="today-practice-foot">
        <span>今日建议</span><p>一课研读 → 一次小试 → 一项温故，约 25 分钟。</p>
      </footer>
    </section>`;
  content.querySelector('.today-primary-action')?.addEventListener('click', () => {
    if (task.type === 'resume' || task.type === 'lesson') onNavigate('path', { lessonId: task.subject,
      ...(task.type === 'resume' ? { resume: task.resume } : {}) });
    else if (task.type === 'review') onNavigate('review-mode');
    else if (task.type === 'quiz-question') onNavigate('quiz-mode', { wrongOnly: true, reference: task.question, returnTo: { mode: 'review' } });
    else if (task.type === 'quiz-weak') onNavigate('quiz-mode', { wrongOnly: true, legacyCode: task.subject, returnTo: { mode: 'review' } });
    else if (task.type === 'course-weak') onNavigate('assessment', { lessonId: task.question.lessonId,
      requiredQuestionId: task.question.questionId, requiredQuestionVersion: task.question.questionVersion, returnTo: 'review' });
    else if (task.type === 'oral') onNavigate('assessment', { initialOralLessonId: task.subject });
    else onNavigate('path');
  });
  content.querySelectorAll('[data-section-target]').forEach((button) => {
    button.addEventListener('click', () => onNavigate(button.dataset.sectionTarget));
  });
  content.querySelector('[data-mode-target="review"]')?.addEventListener('click', () => onNavigate('review-mode'));
}

function renderLibrarySection(content, onNavigate) {
  const entries = [
    ['trigrams', '八卦', '辨象与卦德', '从乾、坤、震、巽、坎、离、艮、兑建立基础结构。'],
    ['wings', '十翼', '由传解经', '汇读系辞、说卦、序卦与杂卦，理解经典的解释传统。'],
    ['theorems', '象数', '察数明变', '由阴阳、五行、河洛与错综互变建立关系框架。'],
    ['almanac', '历法', '知时明界', '学习节气、建除、值宿与民俗资料的使用边界。'],
  ];
  content.innerHTML = `
    <section class="learning-library" aria-labelledby="learning-library-title">
      <div class="library-heading"><span class="academy-kicker">典籍书库</span><h3 id="learning-library-title" data-page-heading>按知识脉络旁通研读</h3><p>先选择一条阅读线索；每栏都可在研读后直接进入对应小试。</p></div>
      <div class="library-grid">
        ${entries.map(([id, title, kicker, description], index) => `
          <button type="button" class="library-card" data-library-section="${id}">
            <i aria-hidden="true">${String(index + 1).padStart(2, '0')}</i>
            <span>${kicker}</span><strong>${title}</strong><small>${description}</small><b>进入书库 →</b>
          </button>`).join('')}
      </div>
    </section>`;
  content.querySelectorAll('[data-library-section]').forEach((button) => {
    button.addEventListener('click', () => onNavigate(button.dataset.librarySection));
  });
}

function syncAchievementEvidence(record) {
  const topicByLesson = { 'l1-1': 'yin-yang', 'l1-4': 'eight-trigrams' };
  const ids = record.processedAssessmentIds;
  const hasMissingEvidence = ids !== undefined && (!Array.isArray(ids) ||
    ids.some((id) => !record.assessmentSessions?.some((item) => item.sessionId === id)));
  Object.entries(record.lessons || {}).forEach(([lessonId, lesson]) => {
    if (!lesson?.viewedAt || !(lesson.attempts > 0)) return;
    const sessions = (record.assessmentSessions || []).filter((item) => item.kind === 'lesson' && item.lessonId === lessonId);
    const legacy = lesson.legacyAssessment || (!sessions.length && !hasMissingEvidence ? {
      score: lesson.bestScore, at: lesson.lastStudiedAt || lesson.viewedAt,
    } : null);
    const evidence = [
      ...(legacy ? [legacy] : []),
      ...sessions.map((item) => ({ sessionId: item.sessionId, score: item.correct / item.total, at: item.at })),
    ];
    if (!evidence.length) return;
    processAchievementEvent(createProgressEvent({
      type: 'lesson.completed',
      subjectId: lessonId,
      outcome: 'completed',
      occurredAt: lesson.lastStudiedAt || lesson.viewedAt,
      idempotencyKey: `learning-record:completed:${lessonId}`,
    }));
    evidence.forEach((item) => {
      if (!Number.isFinite(item.score)) return;
      processAchievementEvent(createProgressEvent({
        type: 'lesson.assessed',
        subjectId: lessonId,
        score: item.score,
        outcome: item.score >= 0.6 ? 'passed' : 'failed',
        occurredAt: item.at,
        idempotencyKey: `learning-record:assessed:${lessonId}:${item.sessionId || item.at}`,
        metadata: topicByLesson[lessonId] ? { topic: topicByLesson[lessonId] } : {},
      }));
    });
  });
}

function renderProfileSection(content, onNavigate) {
  syncAchievementEvidence(loadLearningRecord());
  const summary = summarizeAchievements(loadAchievementState());
  const unlocked = summary.achievements.filter((item) => item.unlocked);
  const next = summary.achievements.find((item) => !item.unlocked);
  content.innerHTML = `
    <section class="practice-profile" aria-labelledby="practice-profile-title">
      <header class="profile-heading">
        <div><span class="academy-kicker">修习谱</span><h3 id="practice-profile-title" data-page-heading>${summary.rank.label}</h3><p>以学习证据呈现成长，不用积分或排名催促进度。</p></div>
        <div class="profile-seal"><strong>${summary.unlockedCount}</strong><span>/ ${summary.totalAchievements} 枚印记</span></div>
      </header>
      <section class="ability-panel" aria-labelledby="ability-title">
        <div class="profile-section-head"><h4 id="ability-title">五项能力</h4><span>综合 ${summary.abilityAverage}%</span></div>
        <div class="ability-list">
          ${ABILITY_DIMENSIONS.map((dimension) => `
            <div class="ability-row"><div><strong>${dimension.label}</strong><small>${dimension.description}</small></div><div class="ability-meter"><i style="--ability:${summary.abilities[dimension.id]}%"></i></div><b>${summary.abilities[dimension.id]}%</b></div>`).join('')}
        </div>
      </section>
      <section class="seal-panel" aria-labelledby="seal-title">
        <div class="profile-section-head"><h4 id="seal-title">印谱</h4><button type="button" class="text-button" data-section-target="assessment">进入日课考评</button></div>
        ${unlocked.length ? `<div class="seal-list">${unlocked.map((item) => `<article><span aria-hidden="true">印</span><div><strong>${item.name}</strong><small>${item.condition}</small></div></article>`).join('')}</div>` : `<div class="profile-empty"><strong>第一枚铜印仍待落定</strong><p>${next?.name || '开卷入易'}：${next?.condition || '完成第一课与小试'}。每条记录都会附带真实达成证据。</p></div>`}
      </section>
      <div class="profile-actions">
        <button type="button" class="quick-btn" data-section-target="assessment">考评与复讲</button>
        <button type="button" class="text-button" data-section-target="data">数据与评阅设置</button>
      </div>
    </section>`;
  content.querySelectorAll('[data-section-target]').forEach((button) => {
    button.addEventListener('click', () => onNavigate(button.dataset.sectionTarget));
  });
}

function bindSectionLearning(content, sectionId, onAssess) {
  const lessons = LEARNING_LESSONS.filter((lesson) => lesson.target === sectionId);
  if (!lessons.length) return;
  const strip = document.createElement('section');
  strip.className = 'section-check-strip';
  strip.setAttribute('aria-label', '本栏小节检验');
  strip.innerHTML = `
    <div><span class="academy-kicker">学后即试</span><strong>本栏小节检验</strong></div>
    <div>${lessons.map((lesson) => `<button type="button" data-lesson-check="${lesson.id}">${lesson.title}小试</button>`).join('')}</div>`;
  const intro = content.querySelector('.study-intro');
  if (intro) intro.insertAdjacentElement('afterend', strip);
  else content.prepend(strip);
  strip.querySelectorAll('[data-lesson-check]').forEach((button) => {
    button.addEventListener('click', () => onAssess(button.dataset.lessonCheck));
  });

  if (sectionId === 'trigrams') {
    markLessonViewed('l1-4');
    recordActivity();
    return;
  }
  content.querySelectorAll('[data-content-id], [data-content-category]').forEach((item) => {
    item.addEventListener('toggle', () => {
      if (!item.open) return;
      const lesson = lessons.find((candidate) =>
        candidate.refs?.includes(item.dataset.contentId) ||
        candidate.category === item.dataset.contentCategory,
      );
      if (!lesson) return;
      markLessonViewed(lesson.id);
      recordActivity();
    });
  });
}

function renderDataSection(content) {
  const reviewConfig = loadReviewConfig();
  content.innerHTML = `
    <section class="data-tools" aria-labelledby="data-tools-title">
      <h3 id="data-tools-title">学习数据</h3>
      <p class="study-intro">进度、笔记、复习卡和测验记录仅保存在当前浏览器。建议定期导出 JSON 备份。</p>
      <div class="data-actions">
        <button type="button" class="quick-btn" data-action="export">导出备份</button>
        <label class="quick-btn file-button">导入备份<input type="file" accept="application/json,.json" data-action="import" /></label>
      </div>
      <p class="data-status" role="status" aria-live="polite">导入会覆盖备份中包含的同类本地数据。</p>
    </section>
    <section class="data-tools review-config" aria-labelledby="review-config-title">
      <h3 id="review-config-title">智能复讲评阅</h3>
      <p class="study-intro">仅配置安全的服务端代理地址；模型密钥不得填写在这里，也不得提交到仓库。未配置或服务异常时自动使用本地要点自评。</p>
      <label for="review-endpoint">评阅服务地址</label>
      <input id="review-endpoint" type="url" placeholder="/api/learning-review" autocomplete="off" spellcheck="false" />
      <div class="data-actions">
        <button type="button" class="quick-btn" data-action="save-review-endpoint">保存地址</button>
        <button type="button" class="text-button" data-action="clear-review-endpoint">停用智能评阅</button>
      </div>
      <p class="review-config-status" role="status" aria-live="polite">${reviewConfig.endpoint ? '智能评阅已配置；提交复讲时会发送课程、参考要点与复讲文本。' : '当前使用本地要点自评。'}</p>
    </section>`;

  const status = content.querySelector('.data-status');
  content.querySelector('[data-action="export"]').addEventListener('click', () => {
    try {
      downloadUserData();
      status.textContent = '备份已下载。';
    } catch (error) {
      status.textContent = `导出失败：${error.message}`;
    }
  });
  content.querySelector('[data-action="import"]').addEventListener('change', async (event) => {
    const [file] = event.target.files;
    if (!file) return;
    try {
      const snapshot = parseUserData(await file.text());
      importUserData(snapshot);
      status.textContent = '导入完成，刷新页面后全部生效。';
    } catch (error) {
      status.textContent = `导入失败：${error.message}`;
    } finally {
      event.target.value = '';
    }
  });
  const endpoint = content.querySelector('#review-endpoint');
  endpoint.value = reviewConfig.endpoint;
  const reviewStatus = content.querySelector('.review-config-status');
  content.querySelector('[data-action="save-review-endpoint"]').addEventListener('click', () => {
    const result = saveReviewConfig(endpoint.value);
    reviewStatus.textContent = result.ok
      ? '评阅地址已保存。请确保服务端保管模型密钥并按项目协议返回结果。'
      : result.error.message;
  });
  content.querySelector('[data-action="clear-review-endpoint"]').addEventListener('click', () => {
    const result = saveReviewConfig('');
    if (result.ok) endpoint.value = '';
    reviewStatus.textContent = result.ok ? '智能评阅已停用，复讲将使用本地要点自评。' : result.error.message;
  });
}

export function renderLearningMode(mountEl, appState, onNavigateMode, entry = {}) {
  mountEl.innerHTML = `
    <div class="mode-panel learning-panel">
      <h2 class="mode-panel-title" data-page-heading>循序学易</h2>
      <p class="mode-panel-sub">从阴阳八卦入门，逐步阅读本经、十翼与象数理论。</p>
      <div class="learning-tabs" role="tablist" aria-label="学习内容">
        ${sections.map((section, index) => `
          <button type="button" class="learning-tab ${index === 0 ? 'active' : ''}" role="tab"
            id="learning-tab-${section.id}" aria-controls="learning-content" tabindex="${index === 0 ? '0' : '-1'}"
            aria-selected="${index === 0}" data-section="${section.id}">${section.label}</button>
        `).join('')}
      </div>
      <div class="learning-content" id="learning-content" role="tabpanel" aria-labelledby="learning-tab-today" tabindex="0"></div>
    </div>
  `;

  const content = mountEl.querySelector('.learning-content');
  let sectionFocusRequest = 0;
  let lessonCleanup = null;
  let disposed = false;
  const cleanupLesson = () => { lessonCleanup?.(); lessonCleanup = null; };
  const showSection = (sectionId, options = {}) => {
    if (disposed) return;
    cleanupLesson();
    if (sectionId === 'path' && options.resume && (getLearningResumeError(options.resume) || options.resume.lessonId !== options.lessonId)) {
      sectionId = 'today';
      options = { notice: '上次阅读位置已失效，已返回今日修习；原有学习成绩仍保留。' };
    }
    const focusRequest = ++sectionFocusRequest;
    const isActiveSection = () => !disposed && focusRequest === sectionFocusRequest;
    if (sectionId === 'review-mode') {
      onNavigateMode?.('review');
      return;
    }
    if (sectionId === 'quiz-mode') {
      onNavigateMode?.('quiz', { ...options, wrongOnly: true });
      return;
    }
    document.body.classList.remove('lesson-overview-open');
    mountEl.querySelector('.learning-panel').classList.toggle('lesson-active', Boolean(options.lessonId && sectionId === 'path'));
    const ownerId = sectionOwners[sectionId] || sectionId;
    mountEl.querySelectorAll('.learning-tab').forEach((tab) => {
      const selected = tab.dataset.section === ownerId;
      tab.classList.toggle('active', selected);
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      if (selected) content.setAttribute('aria-labelledby', tab.id);
    });
    if (sectionId === 'today') {
      renderTodaySection(content, showSection, options.notice);
      dispatchInsight([
        ['今日次序', '一课 · 一试 · 一温故'],
        ['推荐原则', '继续未完成，再补薄弱项'],
        ['核心能力', '观象 · 读经 · 提取'],
        ['建议时长', '25 分钟'],
      ]);
    } else if (sectionId === 'library') {
      renderLibrarySection(content, showSection);
      dispatchInsight([
        ['书库脉络', '八卦 · 十翼 · 象数 · 历法'],
        ['阅读方法', '先看出处，再做解释'],
        ['核心能力', '读经 · 互证 · 明界'],
        ['单次建议', '10–20 分钟'],
      ]);
    } else if (sectionId === 'profile') {
      renderProfileSection(content, showSection);
      dispatchInsight([
        ['成长依据', '只记录可验证学习证据'],
        ['五项能力', '识象 · 读经 · 观变 · 明辨 · 表达'],
        ['奖励方式', '铜印 · 题名 · 星图表现'],
        ['比较方式', '只与自己的过去比较'],
      ]);
    } else if (options.lessonId && sectionId === 'path') {
      lessonCleanup = renderLearningLessonPage(content, appState, options.lessonId, {
        returnTo: options.returnTo,
        resume: options.resume,
        onInvalidResume() { if (isActiveSection()) showSection('today', { notice: '上次阅读位置已失效，原有学习成绩仍保留。' }); },
        onBack() {
          if (!isActiveSection()) return;
          if (options.returnTo === 'review') onNavigateMode?.('review');
          else showSection('path');
        },
        onAssess(lessonId) { if (isActiveSection()) showSection('assessment', { ...options, lessonId }); },
      });
      const lesson = LEARNING_LESSONS.find((item) => item.id === options.lessonId);
      dispatchInsight([
        ['当前课节', lesson ? `${lesson.levelName} · ${lesson.title}` : '五阶学程'],
        ['学习次序', '引 · 观 · 读 · 解 · 用 · 试'],
        ['完成标准', '能复述并通过对应小试'],
        ['推荐专注', '25 分钟'],
      ]);
    } else if (sectionId === 'assessment') {
      lessonCleanup = renderLearningAssessmentPage(content, appState, {
        initialLessonId: options.lessonId,
        initialOralLessonId: options.initialOralLessonId,
        requiredQuestionId: options.requiredQuestionId,
        requiredQuestionVersion: options.requiredQuestionVersion,
        returnTo: options.returnTo,
        onNavigate(target, lessonId, questionEntry = {}) {
          if (!isActiveSection()) return;
          if (target === 'explore') onNavigateMode?.('explore');
          else showSection(target.replace('/', ''), { ...questionEntry, lessonId });
        },
      });
      dispatchInsight([
        ['当前任务', '用检验暴露真正薄弱点'],
        ['反馈结构', '结果 · 依据 · 变化 · 下一步'],
        ['记录原则', '单次答对不等于已经掌握'],
        ['每题建议', '60 秒'],
      ]);
    } else if (sectionId === 'trigrams') renderTrigrams(appState.trigrams, content);
    else if (sectionId === 'wings') renderWingsPage(content, appState);
    else if (sectionId === 'theorems') renderTheoremsPage(content, appState);
    else if (sectionId === 'almanac') {
      lessonCleanup = renderAlmanacKnowledgePage(content, appState, {
        showBackLink: false, termId: options.termId,
        ...(options.returnTo ? {
          backLabel: options.returnTo.mode === 'quiz' ? '返回错题回练' : '返回温故队列',
          onBack() {
            if (!isActiveSection()) return;
            if (options.returnTo.mode === 'quiz') onNavigateMode?.('quiz', {
              ...options.returnTo.entry, wrongOnly: true, reference: options.quizReference,
            });
            else if (options.returnTo.mode === 'review') onNavigateMode?.('review');
            else showSection('library');
          },
        } : {}),
      });
    }
    else if (sectionId === 'data') renderDataSection(content);
    else {
      renderStudyPathPage(content, appState, {
        onNavigate(target, lessonId) {
          if (lessonId) {
            showSection('path', { lessonId });
            return;
          }
          const section = target.replace('/', '');
          if (['trigrams', 'wings', 'theorems'].includes(section)) showSection(section);
          else if (section === 'almanac') showSection('almanac');
          else onNavigateMode?.('explore');
        },
        onAssess(lessonId) { showSection('assessment', { lessonId }); },
      });
      dispatchInsight([
        ['五阶进路', '蒙学 · 习经 · 研传 · 明辨 · 通用'],
        ['开放规则', '全部课程可浏览，不设锁链'],
        ['掌握依据', '研读 · 小试 · 抽查 · 复讲 · 考评'],
        ['学习节律', '一次只推进一课'],
      ]);
    }
    if (!options.lessonId && !options.quizReference && ['trigrams', 'wings', 'theorems', 'almanac'].includes(sectionId)) {
      bindSectionLearning(content, sectionId, (lessonId) => showSection('assessment', { lessonId }));
      const labels = {
        trigrams: ['当前书库', '八卦 · 象 · 性 · 德'],
        wings: ['当前书库', '十翼 · 传文互证'],
        theorems: ['当前书库', '象数 · 义理 · 变化'],
        almanac: ['当前书库', '历法 · 民俗 · 使用边界'],
      };
      dispatchInsight([
        labels[sectionId],
        ['阅读方法', '先看原始资料，再读项目导读'],
        ['学后行动', '完成对应小节检验'],
        ['返回入口', '典籍书库'],
      ]);
    }
    const panel = mountEl.closest?.('.detail-panel');
    if (panel) panel.scrollTop = 0;
    content.scrollTop = 0;
    if (options.focusContent === false) return;
    const schedule = window.requestAnimationFrame || ((callback) => callback());
    const heading = content.querySelector('[data-page-heading], h3');
    schedule(() => {
      if (disposed || focusRequest !== sectionFocusRequest) return;
      if (content.querySelector('[data-learning-focus="oral"]') || content.querySelector('[data-learning-focus="term"]')) return;
      if (!heading || heading.isConnected === false || content.querySelector('[data-page-heading], h3') !== heading) return;
      heading.tabIndex = -1;
      heading.focus?.({ preventScroll: true });
    });
  };

  const tabs = [...mountEl.querySelectorAll('.learning-tab')];
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => showSection(tab.dataset.section));
  });
  mountEl.querySelector('.learning-tabs').addEventListener('keydown', (event) => {
    if (disposed) return;
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const current = tabs.indexOf(document.activeElement);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 :
      (current + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    tabs[next].focus();
    showSection(tabs[next].dataset.section, { focusContent: false });
  });
  const initialSection = ['path', 'assessment', 'data'].includes(entry?.section) ||
    (entry?.section === 'almanac' && typeof entry.termId === 'string' && entry.termId.trim()) ? entry.section : 'today';
  showSection(initialSection, entry || {});
  return () => {
    if (disposed) return;
    cleanupLesson();
    disposed = true;
    sectionFocusRequest++;
    document.body.classList.remove('lesson-overview-open');
  };
}
