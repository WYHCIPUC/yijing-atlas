// 黄历知识页：分类浏览所有术语解读。复用学习页折叠展开模式。
function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// 分类显示顺序与中文名
const CATEGORY_ORDER = [
  '建除十二神', '二十八宿', '彭祖百忌', '二十四节气', '神煞',
];

export function renderAlmanacKnowledgePage(mountEl, appState, {
  showBackLink = true, termId = null, onBack, backLabel = '返回温故队列',
} = {}) {
  const terms = appState.almanacTerms || [];
  // 按类分组
  const cats = {};
  terms.forEach((t) => { (cats[t.category] = cats[t.category] || []).push(t); });

  mountEl.innerHTML = `
    ${onBack ? `<button type="button" class="text-button" data-action="term-back">${esc(backLabel)}</button>` :
      showBackLink ? '<a class="back-btn" href="#/almanac">← 返回黄历</a>' : ''}
    <h3 data-page-heading>黄历知识</h3>
    <p class="study-intro">中国传统黄历术语释义。点击展开查看各术语的含义、宜忌与出处依据。</p>
    ${termId && !terms.some(term => term.id === termId) ? '<p class="assessment-warning" role="status">原术语已调整或暂不可用，保留原温习记录；可浏览现有资料后返回。</p>' : ''}
    ${CATEGORY_ORDER.filter(c => cats[c]).map(cat => `
      <div class="study-group">
        <h4 class="group-title">${esc(cat)}（${cats[cat].length}）</h4>
        ${cats[cat].map((t) => `
          <details class="theorem-item" data-content-category="${esc(cat)}" data-term-id="${esc(t.id)}" ${t.id === termId ? 'open' : ''}>
            <summary ${t.id === termId ? 'data-learning-focus="term"' : ''}><b>${esc(t.name)}</b> ${t.yi || t.ji ? '<small>' + (t.yi ? '宜' : '') + (t.yi && t.ji ? '/' : '') + (t.ji ? '忌' : '') + '</small>' : ''}</summary>
            <div class="alm-kn-body">
              <p>${esc(t.meaning)}</p>
              ${t.yi && t.yi.length ? `<p class="rd-yi">宜：${t.yi.map(i=>esc(i)).join('、')}</p>` : ''}
              ${t.ji && t.ji.length ? `<p class="rd-ji">忌：${t.ji.map(i=>esc(i)).join('、')}</p>` : ''}
              ${t.principle ? `<p class="rd-principle"><small>${esc(t.principle)}</small></p>` : ''}
              ${t.related && t.related.length ? `<p class="rd-related"><small>关联：${t.related.map(i=>esc(i)).join('、')}</small></p>` : ''}
            </div>
          </details>
        `).join('')}
      </div>
    `).join('')}
    ${Object.keys(cats).filter(c => !CATEGORY_ORDER.includes(c)).map(cat => `
      <div class="study-group">
        <h4 class="group-title">${esc(cat)}</h4>
        ${cats[cat].map((t) => `
          <details class="theorem-item" data-content-category="${esc(cat)}" data-term-id="${esc(t.id)}" ${t.id === termId ? 'open' : ''}>
            <summary ${t.id === termId ? 'data-learning-focus="term"' : ''}><b>${esc(t.name)}</b></summary>
            <div class="alm-kn-body"><p>${esc(t.meaning)}</p></div>
          </details>`).join('')}
      </div>`).join('')}
  `;
  let disposed = false;
  let frame = null;
  const heading = mountEl.querySelector('[data-page-heading]');
  const current = () => !disposed && heading?.isConnected !== false && mountEl.querySelector('[data-page-heading]') === heading;
  mountEl.querySelector('[data-action="term-back"]')?.addEventListener('click', () => { if (current()) onBack?.(); });
  const target = [...mountEl.querySelectorAll('[data-term-id]')].find(element => element.dataset.termId === termId);
  if (target) {
    const schedule = window.requestAnimationFrame || (callback => callback());
    frame = schedule(() => {
      if (!current()) return;
      frame = schedule(() => {
        frame = null;
        if (!current() || target.isConnected === false) return;
        target.scrollIntoView?.({ block: 'center', behavior: 'auto' });
        target.querySelector('summary')?.focus({ preventScroll: true });
      });
    });
  }
  return () => {
    disposed = true;
    if (frame !== null) window.cancelAnimationFrame?.(frame);
  };
}
