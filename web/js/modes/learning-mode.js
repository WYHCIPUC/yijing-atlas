import { renderAlmanacKnowledgePage } from '../almanac-knowledge.js';
import { renderLearningAssessmentPage } from '../learning-assessment-page.js';
import { LEARNING_LESSONS } from '../learning-curriculum.js';
import { markLessonViewed, recordActivity } from '../learning-progress.js';
import { loadReviewConfig, saveReviewConfig } from '../learning-review.js';
import { renderTrigrams } from '../render.js';
import { renderLearningLessonPage, renderStudyPathPage, renderTheoremsPage, renderWingsPage } from '../study-page.js?v=28';
import { downloadUserData, importUserData, parseUserData } from '../user-data.js';

const sections = [
  { id: 'path', label: '学程' },
  { id: 'assessment', label: '考评' },
  { id: 'trigrams', label: '八卦' },
  { id: 'wings', label: '十翼' },
  { id: 'theorems', label: '象数' },
  { id: 'almanac', label: '黄历知识' },
  { id: 'data', label: '数据' },
];

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

export function renderLearningMode(mountEl, appState, onExplore) {
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
      <div class="learning-content" id="learning-content" role="tabpanel" aria-labelledby="learning-tab-path" tabindex="0"></div>
    </div>
  `;

  const content = mountEl.querySelector('.learning-content');
  const showSection = (sectionId, options = {}) => {
    document.body.classList.remove('lesson-overview-open');
    mountEl.querySelector('.learning-panel').classList.toggle('lesson-active', Boolean(options.lessonId && sectionId === 'path'));
    mountEl.querySelectorAll('.learning-tab').forEach((tab) => {
      const selected = tab.dataset.section === sectionId;
      tab.classList.toggle('active', selected);
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      if (selected) content.setAttribute('aria-labelledby', tab.id);
    });
    if (options.lessonId && sectionId === 'path') {
      renderLearningLessonPage(content, appState, options.lessonId, {
        onBack() { showSection('path'); },
        onAssess(lessonId) { showSection('assessment', { lessonId }); },
      });
    } else if (sectionId === 'assessment') {
      renderLearningAssessmentPage(content, appState, {
        initialLessonId: options.lessonId,
        onNavigate(target, lessonId) {
          if (target === 'explore') onExplore();
          else showSection(target.replace('/', ''), { lessonId });
        },
      });
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
          else onExplore();
        },
        onAssess(lessonId) { showSection('assessment', { lessonId }); },
      });
    }
    if (!options.lessonId && ['trigrams', 'wings', 'theorems', 'almanac'].includes(sectionId)) {
      bindSectionLearning(content, sectionId, (lessonId) => showSection('assessment', { lessonId }));
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
  showSection('path');
}
