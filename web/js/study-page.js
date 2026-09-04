// 学习区：十翼浏览、象数理论与书院式分级课程。
import { CURRICULUM_TRACKS, LEARNING_LEVELS, LEARNING_LESSONS } from './learning-curriculum.js';
import {
  calculateStreak,
  loadActivity,
  loadLearningRecord,
  markLessonViewed,
  recordActivity,
  summarizeLearning,
} from './learning-progress.js';
import { loadStats, loadWrongBook } from './quiz-engine.js';
import { getDueCount, loadReviewCards } from './review-engine.js';
import { isPlainObject, readJson, writeJson } from './storage.js';
import { hexagramSvg } from './svg-painter.js';
import { getTheoremContentProvenance } from './content-provenance.js';

const PROGRESS_KEY = 'yijing.study.v1';

function esc(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function loadStudyProgress(storage) {
  return readJson(
    PROGRESS_KEY,
    {},
    (value) => isPlainObject(value) && Object.values(value).every((done) => typeof done === 'boolean'),
    storage,
  );
}

export function saveStudyProgress(progress, storage) {
  return writeJson(PROGRESS_KEY, progress, storage).ok;
}

// ---------- 十翼浏览 ----------
export function renderWingsPage(mountEl, appState) {
  const wings = appState.wings || [];
  const cats = {};
  wings.forEach((w) => { (cats[w.category] = cats[w.category] || []).push(w); });

  mountEl.innerHTML = `
    <h3>十翼（《易传》）</h3>
    <p class="study-intro">"十翼"为阐释《周易》本经的十篇传文，相传孔子所作。彖、象已随各卦展示，此处汇总独立成篇的传文。</p>
    ${Object.entries(cats).map(([cat, list]) => `
      <div class="study-group">
        <h4 class="group-title">${esc(cat)}</h4>
        ${list.map((w) => `
          <details class="wing-item" data-content-id="${esc(w.id)}">
            <summary><b>${esc(w.name)}</b> <small>${esc(w.desc)}</small><span class="content-provenance" data-layer="易传">易传 · 待校验</span></summary>
            <div class="wing-sections">
              ${w.sections.map((s, i) => `<p class="wing-sec"><span class="sec-num">§${i + 1}</span> ${esc(s)}</p>`).join('')}
            </div>
          </details>
        `).join('')}
      </div>
    `).join('')}`;
}

// ---------- 象数理论 ----------
export function renderTheoremsPage(mountEl, appState) {
  const theorems = appState.theorems || [];
  const cats = {};
  theorems.forEach((t) => { (cats[t.category] = cats[t.category] || []).push(t); });

  mountEl.innerHTML = `
    <h3>象数理论</h3>
    <p class="study-intro">《易》之义理与象数。掌握基础理论，方能深入理解卦爻辞与占筮。</p>
    ${Object.entries(cats).map(([cat, list]) => `
      <div class="study-group">
        <h4 class="group-title">${esc(cat)}</h4>
        ${list.map((t) => `
          <details class="theorem-item" data-content-id="${esc(t.id)}">
            <summary><b>${esc(t.name)}</b> <small>${esc(t.desc)}</small><span class="content-provenance" data-layer="${esc(getTheoremContentProvenance(t).layer)}" title="${esc(getTheoremContentProvenance(t).disputeNote)}">${esc(getTheoremContentProvenance(t).layer)} · ${esc(getTheoremContentProvenance(t).validationStatus)}</span></summary>
            <ul class="theorem-points">
              ${t.points.map((p) => `<li>${esc(p)}</li>`).join('')}
            </ul>
          </details>
        `).join('')}
      </div>
    `).join('')}`;
}

// ---------- 学习路径与掌握度 ----------
function getLessonReading(lesson, appState) {
  if (lesson.type === 'theory') {
    const entries = (appState.theorems || []).filter((item) => lesson.refs?.includes(item.id));
    const xici = (appState.wings || []).find((item) => item.id === 'xici-shang');
    const quoteNeedle = lesson.refs?.includes('yinyang') ? '一阴一阳之谓道' :
      lesson.refs?.includes('bagua-gen') ? '易有太极' : '';
    const quote = quoteNeedle ? xici?.sections?.find((section) => section.includes(quoteNeedle)) : '';
    return {
      entries,
      source: quote ? '《周易·系辞上传》' : '易象图谱 · 象数资料',
      quote: quote || entries[0]?.desc || lesson.title,
      layer: quote ? '易传' : '象数传统',
    };
  }
  if (lesson.type === 'wings') {
    const entries = (appState.wings || []).filter((item) => lesson.refs?.includes(item.id));
    return { entries, source: entries[0]?.name || '《易传》', quote: entries[0]?.sections?.[0] || entries[0]?.desc || '', layer: '易传' };
  }
  if (lesson.type === 'trigrams') {
    return {
      entries: appState.trigrams || [],
      source: '《周易·说卦传》与八卦基础资料',
      quote: '天地定位，山泽通气，雷风相薄，水火不相射，八卦相错。',
      layer: '易传 · 基础资料',
    };
  }
  if (lesson.type === 'hexagrams') {
    const [start, end] = lesson.range;
    const entries = (appState.hexagrams || []).filter((item) => item.number >= start && item.number <= end);
    return { entries, source: '《周易》本经', quote: `${entries[0]?.name || start}至${entries.at(-1)?.name || end}，依通行卦序研读卦辞与爻辞。`, layer: '本经原文' };
  }
  const entries = (appState.almanacTerms || []).filter((item) => item.category === lesson.category);
  return { entries, source: '传统历法与民俗术语资料', quote: entries[0]?.meaning || lesson.title, layer: '历法计算 · 民俗资料' };
}

export function renderLearningLessonPage(mountEl, appState, lessonId, { onBack, onAssess } = {}) {
  const lesson = LEARNING_LESSONS.find((item) => item.id === lessonId);
  if (!lesson) {
    onBack?.();
    return;
  }
  const level = LEARNING_LEVELS.find((item) => item.id === lesson.levelId);
  const reading = getLessonReading(lesson, appState);
  const primary = reading.entries[0];
  const points = primary?.points || primary?.sections?.slice(0, 5) || [];
  const lessonIndex = level.lessons.findIndex((item) => item.id === lesson.id);
  markLessonViewed(lesson.id);
  recordActivity();
  const progress = summarizeLearning(loadLearningRecord(), LEARNING_LESSONS);
  const streak = calculateStreak(loadActivity().days);
  const sourceExcerpt = reading.quote.match(/^[^。]+。(?:[^。]+。)?/)?.[0] || reading.quote;
  const observation = lesson.type === 'hexagrams'
    ? '先看上下卦、六爻阴阳和位置，再进入卦名与卦辞；不要先用一句白话替代卦体。'
    : lesson.type === 'wings'
      ? '先辨认传文正在解释卦名、卦体、爻位还是卦序，再判断它与本经原文的关系。'
      : lesson.type === 'almanac'
        ? '先核对日期、时区与历法口径，再阅读术语；民俗宜忌不直接等同现实建议。'
        : '先找出定义所依据的卦体、爻位、原文或象数规则，再进入解释。';
  const application = `尝试用“${esc(lesson.title)}”分析一个例子，并分别写下可核实事实、文本依据和仍不确定之处。`;
  const methodRail = `
    <nav class="lesson-method-rail" aria-label="本课六步学习方法">
      <a href="#lesson-lead">引</a><a href="#lesson-observe">观</a><a href="#lesson-read">读</a>
      <a href="#lesson-explain">解</a><a href="#lesson-apply">用</a><a href="#lesson-test">试</a>
    </nav>`;
  const stageRail = `
    <nav class="lesson-stage-rail" aria-label="五阶学程">
      ${LEARNING_LEVELS.map((item, index) => `<span class="${item.id === level.id ? 'active' : ''}"><i aria-hidden="true">${index + 1}</i><b>${esc(item.name)}</b><small>${esc(item.title)}</small></span>`).join('')}
    </nav>`;

  const polarity = lesson.id === 'l1-1' ? `
    <section class="lesson-polarity" aria-label="乾坤阴阳对照">
      <article>${hexagramSvg('111111', { size: 88 })}<div><small>阳 · 乾</small><strong>健、动、明、升</strong><p>阳爻以一长横表示，重在刚健与发动。</p></div></article>
      <article>${hexagramSvg('000000', { size: 88 })}<div><small>阴 · 坤</small><strong>顺、静、藏、降</strong><p>阴爻以两短横表示，重在柔顺与承载。</p></div></article>
    </section>` : '';

  function leaveLesson() {
    document.body.classList.remove('lesson-overview-open');
    onBack?.();
  }

  function beginAssessment() {
    document.body.classList.remove('lesson-overview-open');
    onAssess?.(lesson.id);
  }

  function showOverview() {
    document.body.classList.add('lesson-overview-open');
    mountEl.innerHTML = `
      <article class="lesson-workspace lesson-overview-workspace">
        <header class="lesson-overview-heading">
          <div><span class="academy-kicker">${esc(level.name)} · 入门启蒙</span><h3 data-page-heading>${esc(level.name)} · ${esc(lesson.title)}</h3></div>
          <button type="button" class="text-button lesson-back">切换课程</button>
        </header>
        ${stageRail}
        <section class="lesson-concept-card">
          <div class="lesson-thesis">
            <span class="academy-kicker">本节要义</span>
            <h4>阴阳者，易之根本也</h4>
            <p>${esc(primary?.desc || level.desc)}</p>
            <blockquote>${esc(sourceExcerpt)}</blockquote>
            <div class="lesson-core-note"><small>要旨</small><p>${esc(points[2] || points[0] || reading.quote)}</p></div>
          </div>
          <div class="lesson-taiji-study">
            <span class="academy-kicker">阴阳关系图示</span>
            <div class="lesson-taiji-map">
              <div class="lesson-polar-label lesson-polar-yang"><b>阳</b><span>动 · 健 · 明 · 升</span></div>
              <img src="assets/taiji-mechanism.webp" alt="铜质太极阴阳仪" width="1254" height="1254" />
              <div class="lesson-polar-label lesson-polar-yin"><b>阴</b><span>静 · 顺 · 藏 · 降</span></div>
            </div>
            <p class="lesson-taiji-cycle">相互依存 · 彼此转化 · 消长不息</p>
          </div>
        </section>
        <section class="lesson-progress-strip" aria-label="当前学习进度">
          <div class="lesson-progress-number"><strong>${progress.mastery}%</strong><span>当前掌握度</span></div>
          <div class="lesson-progress-copy"><small>当前阶段</small><b>${esc(level.name)} · 共 ${level.lessons.length} 课</b><div class="progress-bar"><div class="progress-fill" style="width:${progress.mastery}%"></div></div></div>
          <div class="lesson-progress-stats"><span>已浏览 ${progress.viewed} / ${progress.total} 小节</span><span>连续学习 ${streak} 天</span></div>
          <button type="button" class="quick-btn lesson-continue">继续研习</button>
        </section>
      </article>`;

    mountEl.querySelector('.lesson-back').addEventListener('click', leaveLesson);
    mountEl.querySelector('.lesson-continue').addEventListener('click', showReader);
  }

  function showReader() {
    document.body.classList.remove('lesson-overview-open');
    mountEl.innerHTML = `
      <article class="lesson-workspace lesson-reader-workspace">
        <div class="lesson-toolbar">
          <button type="button" class="text-button lesson-back">${lesson.id === 'l1-1' ? '返回课程概览' : '返回学程'}</button>
          <div><span>${esc(level.name)} · 第 ${lessonIndex + 1} 课</span><button type="button" class="quick-btn lesson-assess lesson-assess-top">完成阅读 · 小试</button></div>
        </div>
        ${stageRail}
        <div class="lesson-editorial-grid">
          <main class="lesson-manuscript">
            <p class="academy-kicker">${esc(level.name)} · ${esc(level.title)}</p>
            <h3 data-page-heading>${esc(lesson.title)}</h3>
            <p class="lesson-lede">${esc(primary?.desc || level.desc)}</p>
            ${methodRail}
            ${polarity}
            <section class="lesson-method-section" id="lesson-lead"><span>引</span><h4>先明确本课要解决什么</h4><p>${esc(primary?.desc || level.desc)}</p></section>
            <section class="lesson-method-section" id="lesson-observe"><span>观</span><h4>先看结构，不急着下结论</h4><p>${esc(observation)}</p></section>
            <section class="lesson-method-section" id="lesson-read"><span>读</span><h4>${esc(reading.source)}</h4><blockquote>${esc(reading.quote)}</blockquote><small>${esc(reading.layer)} · 来源状态待逐条校验</small></section>
            <section class="lesson-key-points lesson-method-section" id="lesson-explain">
              <span>解</span><h4>逐条解释，并保留条件</h4>
              ${points.length ? `<ol>${points.map((point) => `<li>${esc(point)}</li>`).join('')}</ol>` : `<p>${esc(reading.quote)}</p>`}
            </section>
            <section class="lesson-method-section lesson-application" id="lesson-apply"><span>用</span><h4>把知识放回可验证的问题</h4><p>${application}</p><div><b>证据检查</b><small>依据来自卦体、爻位、经传原文还是项目类比？若不足，可以明确回答“证据不足”。</small></div></section>
            <section class="lesson-method-section lesson-test-entry" id="lesson-test"><span>试</span><h4>用小试检查依据，而非只背答案</h4><p>题目会要求辨认证据层；答错内容进入复习安排，不锁定后续课程。</p><button type="button" class="quick-btn lesson-assess">开始证据小试</button></section>
          </main>
          <aside class="lesson-margin-notes">
            <section><small>典籍依据</small><h4>${esc(reading.source)}</h4><blockquote>${esc(reading.quote)}</blockquote></section>
            <section><small>学习目标</small><p>能够用自己的话说明“${esc(lesson.title)}”，并辨认其在卦象中的基本表现。</p></section>
            <section><small>本课检验</small><p>完成阅读后进入小试；答错内容会加入复习安排。</p></section>
          </aside>
        </div>
        <footer class="lesson-actions">
          <button type="button" class="text-button lesson-back-secondary">${lesson.id === 'l1-1' ? '暂存并返回概览' : '暂存并返回'}</button>
          <button type="button" class="quick-btn lesson-assess">完成阅读 · 开始小试</button>
        </footer>
      </article>`;

    mountEl.querySelector('.lesson-back').addEventListener('click', lesson.id === 'l1-1' ? showOverview : leaveLesson);
    mountEl.querySelector('.lesson-back-secondary').addEventListener('click', lesson.id === 'l1-1' ? showOverview : leaveLesson);
    mountEl.querySelectorAll('.lesson-assess').forEach((button) => button.addEventListener('click', beginAssessment));
  }

  if (lesson.id === 'l1-1') showOverview();
  else showReader();
}

export function renderStudyPathPage(mountEl, appState, { onNavigate, onAssess } = {}) {
  const record = loadLearningRecord();
  const summary = summarizeLearning(record, LEARNING_LESSONS);
  const quizStats = loadStats();
  const wrongCount = loadWrongBook().length;
  const dueCount = getDueCount(loadReviewCards());
  const streak = calculateStreak(loadActivity().days);
  const levelSummaries = LEARNING_LEVELS.map((level) => ({
    level,
    mastery: Math.round(level.lessons.reduce((total, lesson) =>
      total + summary.masteryByLesson[lesson.id], 0) / level.lessons.length),
  }));

  mountEl.innerHTML = `
    <section class="study-path-overview" aria-labelledby="study-path-title">
      <div class="academy-heading">
        <div><span class="academy-kicker">循序学易</span><h3 id="study-path-title">学习进度</h3></div>
        <p>课程完全开放；小试、抽查与考评只帮助辨明薄弱处，不锁定后续内容。</p>
      </div>
      <section class="academy-rank-card" data-rank="${summary.rank.id}">
        <div class="academy-rank-seal">${summary.rank.label}</div>
        <div><small>当前书院学阶</small><strong>${summary.mastery}% 综合掌握度</strong><p>${summary.rank.hint}</p></div>
        <button type="button" class="quick-btn" data-action="assessment-center">进入日课考评</button>
      </section>
      <div class="learning-dashboard" aria-label="学习概览">
        <div><strong>${summary.viewed}/${summary.total}</strong><span>已浏览小节</span></div>
        <div><strong>${summary.checked}/${summary.total}</strong><span>已完成小试</span></div>
        <div><strong>${streak}</strong><span>连续学习天数</span></div>
        <div><strong>${dueCount}</strong><span>今日待复习</span></div>
        <div><strong>${quizStats.total ? Math.round(quizStats.correct / quizStats.total * 100) : 0}%</strong><span>自由测验正确率</span></div>
      </div>
      <nav class="study-level-rail" aria-label="五阶学程">
        ${levelSummaries.map(({ level, mastery }, index) => `
          <button type="button" class="study-level-node ${mastery >= 80 ? 'mastered' : ''}"
            data-level-target="${esc(level.id)}" aria-label="前往${esc(level.name)}阶段，当前掌握度 ${mastery}%">
            <i aria-hidden="true">${String(index + 1).padStart(2, '0')}</i>
            <span><small>${esc(level.id)} · ${esc(level.name)}</small><strong>${esc(level.title)}</strong></span>
            <em>${mastery}%</em>
          </button>
        `).join('')}
      </nav>
      <div class="path-overview">
        <div class="progress-bar"><div class="progress-fill" style="width:${summary.mastery}%"></div></div>
        <p class="progress-text">综合掌握度由学习 10%、小试 35%、抽查 20%、复讲 15%、阶段考评 20% 组成。</p>
      </div>
    </section>
    <section class="curriculum-track-map" aria-labelledby="curriculum-track-title">
      <div><span class="academy-kicker">分层综合</span><h4 id="curriculum-track-title">一条主干 · 三条旁支</h4></div>
      <div>${Object.entries(CURRICULUM_TRACKS).map(([id, track]) => `<article data-track="${id}"><small>${id === 'core' ? '主干' : '旁支'}</small><strong>${esc(track.name)}</strong><p>${esc(track.desc)}</p></article>`).join('')}</div>
    </section>
    ${levelSummaries.map(({ level, mastery: levelMastery }) => {
      return `
        <div class="level-block" data-level-id="${esc(level.id)}">
          <div class="level-heading"><div><span>${esc(level.id)} · ${esc(level.name)}</span><h4>${esc(level.title)}</h4><small>${esc(level.desc)}</small></div><strong>${levelMastery}%</strong></div>
          <div class="step-list">
            ${level.lessons.map((lesson) => {
              const mastery = summary.masteryByLesson[lesson.id];
              const progress = record.lessons[lesson.id] || {};
              const status = progress.attempts ? `小试 ${Math.round((progress.bestScore || 0) * 100)}%` :
                progress.viewedAt ? '已浏览 · 待小试' : '未开始';
              return `
                <article class="step-row ${mastery >= 80 ? 'step-mastered' : ''}" data-step="${lesson.id}">
                  <span class="step-mastery" aria-label="掌握度 ${mastery}%">${mastery}</span>
                  <div><strong>${esc(lesson.title)}</strong><small>${esc(CURRICULUM_TRACKS[lesson.track]?.name || '')} · ${esc(status)}</small></div>
                  <div class="step-actions">
                    <button type="button" class="text-button" data-action="learn" data-target="${esc(lesson.target)}">学习</button>
                    <button type="button" class="text-button" data-action="assess">小试</button>
                  </div>
                </article>`;
            }).join('')}
          </div>
        </div>
      `;
    }).join('')}
    <section class="study-resources" aria-labelledby="study-resources-title">
      <div><span class="academy-kicker">旁通研读</span><h4 id="study-resources-title">从本经延伸到传、象数与历法</h4></div>
      <div class="study-quick">
        <button type="button" class="quick-btn" data-target="/wings">十翼（易传）</button>
        <button type="button" class="quick-btn" data-target="/theorems">象数理论</button>
        <button type="button" class="quick-btn" data-target="/almanac">黄历知识</button>
      </div>
    </section>
    <div class="academy-source-note"><strong>教学取法</strong><span>“学而时习之”用于日课与温故；《学记》的阶段考校用于小试与考评；保留自我进度，不作排名。</span></div>
    ${wrongCount ? `<div class="study-hint"><small>自由测验另有 ${wrongCount} 道错题待回练。</small></div>` : ''}
  `;

  mountEl.querySelector('[data-action="assessment-center"]').addEventListener('click', () => onAssess?.());
  mountEl.querySelectorAll('[data-level-target]').forEach((button) => {
    button.addEventListener('click', () => {
      const target = mountEl.querySelector(`[data-level-id="${button.dataset.levelTarget}"]`);
      target?.scrollIntoView({
        block: 'start',
        behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      });
    });
  });
  mountEl.querySelectorAll('[data-action="learn"]').forEach((button) => {
    button.addEventListener('click', () => {
      const row = button.closest('[data-step]');
      const result = markLessonViewed(row.dataset.step);
      recordActivity();
      if (!result.saved) row.setAttribute('title', '本地存储不可用，进度未保存');
      if (onNavigate) onNavigate(button.dataset.target, row.dataset.step);
      else location.hash = button.dataset.target === 'explore' ? '#/library' : `#/${button.dataset.target}`;
    });
  });
  mountEl.querySelectorAll('[data-action="assess"]').forEach((button) => {
    button.addEventListener('click', () => onAssess?.(button.closest('[data-step]').dataset.step));
  });
  mountEl.querySelectorAll('.quick-btn').forEach((button) => {
    if (!button.dataset.target) return;
    button.addEventListener('click', () => {
      if (onNavigate) onNavigate(button.dataset.target);
      else location.hash = `#${button.dataset.target}`;
    });
  });
}

export function getStudyStepCount() {
  return LEARNING_LESSONS.length;
}
