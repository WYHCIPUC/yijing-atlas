import { renderAlmanacKnowledgePage } from '../almanac-knowledge.js';
import { ABILITY_DIMENSIONS } from '../achievement-catalog.js';
import { createProgressEvent, summarizeAchievements } from '../achievement-engine.js';
import { loadAchievementState, processAchievementEvent } from '../achievement-storage.js';
import { renderLearningAssessmentPage } from '../learning-assessment-page.js';
import { recommendLesson } from '../learning-assessment.js';
import { LEARNING_LESSONS } from '../learning-curriculum.js';
import {
  calculateStreak,
  loadActivity,
  loadLearningRecord,
  markLessonViewed,
  recordActivity,
  summarizeLearning,
} from '../learning-progress.js';
import { loadReviewConfig, saveReviewConfig } from '../learning-review.js';
import { renderTrigrams } from '../render.js';
import { getDueCount, loadReviewCards } from '../review-engine.js';
import { renderLearningLessonPage, renderStudyPathPage, renderTheoremsPage, renderWingsPage } from '../study-page.js?v=47';
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

function renderTodaySection(content, onNavigate) {
  const record = loadLearningRecord();
  const summary = summarizeLearning(record, LEARNING_LESSONS);
  const recommended = recommendLesson(record);
  const dueCount = getDueCount(loadReviewCards());
  const streak = calculateStreak(loadActivity().days);
  const recommendedProgress = summary.masteryByLesson[recommended?.id] || 0;
  const lessonAction = recommended ? `data-lesson-id="${recommended.id}"` : 'disabled';
  content.innerHTML = `
    <section class="today-practice" aria-labelledby="today-practice-title">
      <header class="today-practice-head">
        <div><span class="academy-kicker">今日修习</span><h3 id="today-practice-title" data-page-heading>先做最值得做的一步</h3></div>
        <div class="today-practice-rank"><small>当前学阶</small><strong>${summary.rank.label}</strong></div>
      </header>
      <article class="today-primary-card">
        <div class="today-primary-index" aria-hidden="true">${String(LEARNING_LESSONS.indexOf(recommended) + 1).padStart(2, '0')}</div>
        <div class="today-primary-copy">
          <span>${recommended?.levelName || '蒙学'} · 推荐日课</span>
          <h4>${recommended?.title || '从五阶学程选择一课'}</h4>
          <p>${recommendedProgress ? `当前掌握度 ${recommendedProgress}%，继续巩固薄弱环节。` : '先建立清晰印象，再用小试检验是否真正看懂。'}</p>
        </div>
        <button type="button" class="quick-btn today-primary-action" ${lessonAction}>继续研习</button>
      </article>
      <div class="today-support-grid">
        <button type="button" class="today-support-card" data-mode-target="review">
          <span>温故队列</span><strong>${dueCount}</strong><small>${dueCount ? '项已到期，建议先主动回忆' : '今日暂无到期内容'}</small>
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
  content.querySelector('[data-lesson-id]')?.addEventListener('click', (event) => {
    onNavigate('path', { lessonId: event.currentTarget.dataset.lessonId });
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
  Object.entries(record.lessons || {}).forEach(([lessonId, lesson]) => {
    if (!lesson?.viewedAt || !(lesson.attempts > 0)) return;
    processAchievementEvent(createProgressEvent({
      type: 'lesson.completed',
      subjectId: lessonId,
      outcome: 'completed',
      occurredAt: lesson.lastStudiedAt || lesson.viewedAt,
      idempotencyKey: `learning-record:completed:${lessonId}`,
    }));
    if (!Number.isFinite(lesson.bestScore)) return;
    processAchievementEvent(createProgressEvent({
      type: 'lesson.assessed',
      subjectId: lessonId,
      score: lesson.bestScore,
      outcome: lesson.bestScore >= 0.6 ? 'passed' : 'failed',
      occurredAt: lesson.lastStudiedAt || lesson.viewedAt,
      idempotencyKey: `learning-record:assessed:${lessonId}:${lesson.bestScore}`,
      metadata: topicByLesson[lessonId] ? { topic: topicByLesson[lessonId] } : {},
    }));
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

export function renderLearningMode(mountEl, appState, onNavigateMode) {
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
  const showSection = (sectionId, options = {}) => {
    if (sectionId === 'review-mode') {
      onNavigateMode?.('review');
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
      renderTodaySection(content, showSection);
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
      renderLearningLessonPage(content, appState, options.lessonId, {
        onBack() { showSection('path'); },
        onAssess(lessonId) { showSection('assessment', { lessonId }); },
      });
      const lesson = LEARNING_LESSONS.find((item) => item.id === options.lessonId);
      dispatchInsight([
        ['当前课节', lesson ? `${lesson.levelName} · ${lesson.title}` : '五阶学程'],
        ['学习次序', '引 · 观 · 读 · 解 · 用 · 试'],
        ['完成标准', '能复述并通过对应小试'],
        ['推荐专注', '25 分钟'],
      ]);
    } else if (sectionId === 'assessment') {
      renderLearningAssessmentPage(content, appState, {
        initialLessonId: options.lessonId,
        onNavigate(target, lessonId) {
          if (target === 'explore') onNavigateMode?.('explore');
          else showSection(target.replace('/', ''), { lessonId });
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
    else if (sectionId === 'almanac') renderAlmanacKnowledgePage(content, appState, { showBackLink: false });
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
    if (!options.lessonId && ['trigrams', 'wings', 'theorems', 'almanac'].includes(sectionId)) {
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
    const schedule = window.requestAnimationFrame || ((callback) => callback());
    schedule(() => {
      const heading = content.querySelector('[data-page-heading], h3');
      if (!heading) return;
      heading.tabIndex = -1;
      heading.focus?.({ preventScroll: true });
    });
  };

  const tabs = [...mountEl.querySelectorAll('.learning-tab')];
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => showSection(tab.dataset.section));
  });
  mountEl.querySelector('.learning-tabs').addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const current = tabs.indexOf(document.activeElement);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 :
      (current + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    tabs[next].focus();
    showSection(tabs[next].dataset.section);
  });
  showSection('today');
}
