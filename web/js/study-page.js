// 学习区：十翼浏览、象数理论与书院式分级课程。
import { LEARNING_LEVELS, LEARNING_LESSONS } from './learning-curriculum.js';
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
            <summary><b>${esc(w.name)}</b> <small>${esc(w.desc)}</small></summary>
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
            <summary><b>${esc(t.name)}</b> <small>${esc(t.desc)}</small></summary>
            <ul class="theorem-points">
              ${t.points.map((p) => `<li>${esc(p)}</li>`).join('')}
            </ul>
          </details>
        `).join('')}
      </div>
    `).join('')}`;
}

// ---------- 学习路径与掌握度 ----------
export function renderStudyPathPage(mountEl, appState, { onNavigate, onAssess } = {}) {
  const record = loadLearningRecord();
  const summary = summarizeLearning(record, LEARNING_LESSONS);
  const quizStats = loadStats();
  const wrongCount = loadWrongBook().length;
  const dueCount = getDueCount(loadReviewCards());
  const streak = calculateStreak(loadActivity().days);

  mountEl.innerHTML = `
    <div class="academy-heading">
      <div><span class="academy-kicker">循序学易</span><h3>学习进度</h3></div>
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
    <div class="study-quick">
      <button type="button" class="quick-btn" data-target="/wings">十翼（易传）</button>
      <button type="button" class="quick-btn" data-target="/theorems">象数理论</button>
      <button type="button" class="quick-btn" data-target="/almanac">黄历知识</button>
    </div>
    <div class="path-overview">
      <div class="progress-bar"><div class="progress-fill" style="width:${summary.mastery}%"></div></div>
      <p class="progress-text">综合掌握度由学习 10%、小试 35%、抽查 20%、复讲 15%、阶段考评 20% 组成。</p>
    </div>
    ${LEARNING_LEVELS.map((level) => {
      const levelMastery = Math.round(level.lessons.reduce((total, lesson) =>
        total + summary.masteryByLesson[lesson.id], 0) / level.lessons.length);
      return `
        <div class="level-block">
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
                  <div><strong>${esc(lesson.title)}</strong><small>${esc(status)}</small></div>
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
    <div class="academy-source-note"><strong>教学取法</strong><span>“学而时习之”用于日课与温故；《学记》的阶段考校用于小试与考评；保留自我进度，不作排名。</span></div>
    ${wrongCount ? `<div class="study-hint"><small>自由测验另有 ${wrongCount} 道错题待回练。</small></div>` : ''}
  `;

  mountEl.querySelector('[data-action="assessment-center"]').addEventListener('click', () => onAssess?.());
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
