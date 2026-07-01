// 学习区：十翼浏览、象数理论、学习路径（L1-L4 分级课程）。
// 进度（已学章节）存 localStorage。
import { trigramSvg, hexagramSvg } from './svg-painter.js';

const PROGRESS_KEY = 'yijing.study.v1';

function esc(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function loadStudyProgress() {
  try { return JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}'); }
  catch { return {}; }
}
function saveStudyProgress(p) {
  try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(p)); } catch {}
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
          <details class="wing-item">
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
          <details class="theorem-item">
            <summary><b>${esc(t.name)}</b> <small>${esc(t.desc)}</small></summary>
            <ul class="theorem-points">
              ${t.points.map((p) => `<li>${esc(p)}</li>`).join('')}
            </ul>
          </details>
        `).join('')}
      </div>
    `).join('')}`;
}

// ---------- 学习路径（L1-L4）----------
const LEVELS = [
  {
    id: 'L1', name: 'L1 · 入门', desc: '阴阳、八卦、卦的组成',
    steps: [
      { id: 'l1-1', title: '阴阳之道', type: 'theory', ref: 'yinyang' },
      { id: 'l1-2', title: '八卦生成', type: 'theory', ref: 'bagua-gen' },
      { id: 'l1-3', title: '爻位与当位', type: 'theory', ref: 'yao-positions' },
      { id: 'l1-4', title: '认识八卦符号', type: 'trigrams' },
    ],
  },
  {
    id: 'L2', name: 'L2 · 本经', desc: '六十四卦卦爻辞',
    steps: [
      { id: 'l2-1', title: '上经前八卦（乾-比）', type: 'hexagrams', range: [1, 8] },
      { id: 'l2-2', title: '上经中段', type: 'hexagrams', range: [9, 22] },
      { id: 'l2-3', title: '上经后段', type: 'hexagrams', range: [23, 30] },
      { id: 'l2-4', title: '下经前段', type: 'hexagrams', range: [31, 47] },
      { id: 'l2-5', title: '下经后段', type: 'hexagrams', range: [48, 64] },
    ],
  },
  {
    id: 'L3', name: 'L3 · 十翼', desc: '易传精读',
    steps: [
      { id: 'l3-1', title: '系辞传', type: 'wings', ref: 'xici' },
      { id: 'l3-2', title: '文言·说卦', type: 'wings', ref: 'wenyan' },
      { id: 'l3-3', title: '序卦·杂卦', type: 'wings', ref: 'xugua' },
    ],
  },
  {
    id: 'L4', name: 'L4 · 象数', desc: '河洛五行、先后天八卦、卦际关系',
    steps: [
      { id: 'l4-1', title: '五行生克', type: 'theory', ref: 'wuxing' },
      { id: 'l4-2', title: '河图洛书', type: 'theory', ref: 'hetu-luoshu' },
      { id: 'l4-3', title: '先天/后天八卦', type: 'theory', ref: 'xiantian' },
      { id: 'l4-4', title: '错卦与综卦', type: 'theory', ref: 'cuo-zong' },
    ],
  },
];

export function renderStudyPathPage(mountEl, appState) {
  const progress = loadStudyProgress();
  const totalSteps = LEVELS.reduce((s, l) => s + l.steps.length, 0);
  const doneSteps = Object.values(progress).filter(Boolean).length;

  mountEl.innerHTML = `
    <h3>学习路径</h3>
    <div class="study-quick">
      <a class="quick-btn" href="#/wings">📖 十翼（易传）</a>
      <a class="quick-btn" href="#/theorems">🔮 象数理论</a>
      <a class="quick-btn" href="#/almanac-knowledge">📅 黄历知识</a>
    </div>
    <div class="path-overview">
      <div class="progress-bar"><div class="progress-fill" style="width:${Math.round(doneSteps / totalSteps * 100)}%"></div></div>
      <p class="progress-text">总进度 ${doneSteps}/${totalSteps}（${Math.round(doneSteps / totalSteps * 100)}%）</p>
    </div>
    ${LEVELS.map((level) => {
      const lvlDone = level.steps.filter((s) => progress[s.id]).length;
      return `
        <div class="level-block">
          <h4 class="level-title">${esc(level.name)} · ${esc(level.desc)} <small>（${lvlDone}/${level.steps.length}）</small></h4>
          <div class="step-list">
            ${level.steps.map((step) => {
              const done = !!progress[step.id];
              const target = stepTarget(step);
              return `
                <div class="step-row ${done ? 'step-done' : ''}" data-step="${step.id}" data-target="${esc(target)}">
                  <span class="step-check">${done ? '✅' : '⬜'}</span>
                  <span class="step-title">${esc(step.title)}</span>
                  <span class="step-go">前往 →</span>
                </div>`;
            }).join('')}
          </div>
        </div>
      `;
    }).join('')}
    <div class="study-hint"><small>点击章节前往学习；学完可勾选标记，进度自动保存。</small></div>
  `;

  // 点击：跳转 + 标记完成
  mountEl.querySelectorAll('.step-row').forEach((row) => {
    row.addEventListener('click', () => {
      const id = row.dataset.step;
      const p = loadStudyProgress();
      p[id] = true;
      saveStudyProgress(p);
      location.hash = row.dataset.target;
    });
  });
}

// 步骤 → 跳转 hash
function stepTarget(step) {
  if (step.type === 'theory') return '/theorems';
  if (step.type === 'trigrams') return '/trigrams';
  if (step.type === 'hexagrams') return '/library';
  if (step.type === 'wings') return '/wings';
  return '/library';
}
