import { castHexagram, getReading } from '../divination-engine.js';
import { addDivinationHistory, clearDivinationHistory, loadDivinationHistory } from '../divination-history.js';
import { buildCoinInterpretation, buildMeihuaInterpretation } from '../divination-interpretation.js';
import { yaoLabel } from '../hexagram-utils.js';
import { recordActivity } from '../learning-progress.js';
import { analyzeTiYong, castByNumber, castByTime } from '../meihua-engine.js';
import { hexagramSvg } from '../svg-painter.js';

let appState = null;
let mountEl = null;
let openDetail = null;

function esc(value) {
  return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function revealDivinationArea(target, focusSelector) {
  const schedule = window.requestAnimationFrame || ((callback) => callback());
  schedule(() => {
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    target.scrollIntoView?.({
      behavior: reducedMotion ? 'auto' : 'smooth',
      block: 'nearest',
      inline: 'nearest',
    });
    if (!focusSelector) return;
    target.querySelector(focusSelector)?.focus({ preventScroll: true });
  });
}

export function renderDivinationMode(target, state, onOpenDetail) {
  appState = state;
  mountEl = target;
  openDetail = onOpenDetail;
  mountEl.innerHTML = `
    <div class="mode-panel divine-panel">
      <header class="mode-hero divine-hero">
        <div><span class="academy-kicker">文化演练</span><h2 class="mode-panel-title" data-page-heading>占筮问道</h2>
          <p class="mode-panel-sub">从卦象返回经文，以处境、提醒和变化三层理解结果。</p></div>
        <div class="mode-hero-stat"><strong>三层</strong><span>经文 · 义理 · 反思</span></div>
      </header>
      <p class="divine-boundary">传统术数仅供文化学习与自我反思，不替代现实中的专业判断。</p>
      <div class="divine-tabs" role="tablist" aria-label="起卦方式">
        <button type="button" class="divine-tab active" id="divine-tab-coin" role="tab" aria-controls="divine-body"
          aria-selected="true" tabindex="0" data-sub="coin">金钱卦</button>
        <button type="button" class="divine-tab" id="divine-tab-meihua" role="tab" aria-controls="divine-body"
          aria-selected="false" tabindex="-1" data-sub="meihua">梅花易数</button>
      </div>
      <div class="divine-body" id="divine-body" role="tabpanel" aria-labelledby="divine-tab-coin" tabindex="0"></div>
      <section class="divination-history" aria-labelledby="divination-history-title">
        <div class="mode-heading-row">
          <h3 id="divination-history-title">起卦记录</h3>
          <button type="button" class="text-button history-clear">清空</button>
        </div>
        <div class="history-list"></div>
        <p class="history-status" role="status" aria-live="polite"></p>
      </section>
    </div>
  `;

  const tabs = [...mountEl.querySelectorAll('.divine-tab')];
  const activateTab = (tab) => {
    tabs.forEach((item) => {
      const selected = item === tab;
      item.classList.toggle('active', selected);
      item.setAttribute('aria-selected', String(selected));
      item.tabIndex = selected ? 0 : -1;
    });
    mountEl.querySelector('.divine-body').setAttribute('aria-labelledby', tab.id);
    if (tab.dataset.sub === 'coin') renderCoin();
    else renderMeihua();
    revealDivinationArea(mountEl.querySelector('.divine-body'));
  };
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => activateTab(tab));
  });
  mountEl.querySelector('.divine-tabs').addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const current = tabs.indexOf(document.activeElement);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 :
      (current + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    tabs[next].focus();
    activateTab(tabs[next]);
  });
  mountEl.querySelector('.history-clear').addEventListener('click', () => {
    const status = mountEl.querySelector('.history-status');
    status.textContent = clearDivinationHistory() ? '起卦记录已清空。' : '清空失败，请检查浏览器存储权限。';
    renderHistory();
  });
  renderCoin();
  renderHistory();
}

function renderHistory() {
  const list = mountEl?.querySelector('.history-list');
  if (!list) return;
  const items = loadDivinationHistory();
  list.innerHTML = items.length ? items.map((item) => {
    const primary = appState.index.byCode.get(item.primaryCode);
    const changed = item.changedCode ? appState.index.byCode.get(item.changedCode) : null;
    const createdAt = new Date(item.createdAt);
    const dateText = Number.isNaN(createdAt.getTime()) ? '' : createdAt.toLocaleString('zh-CN', { hour12: false });
    return `
      <button type="button" class="history-item" data-history-id="${esc(item.id)}">
        <span>${esc(primary?.name || item.primaryCode)}${changed ? ` → ${esc(changed.name)}` : ''}${item.legacySummaryOnly ? '<em>摘要</em>' : ''}</span>
        <small>${item.type === 'meihua' ? '梅花' : '金钱'} · ${esc(dateText)}${item.legacySummaryOnly ? ' · 旧版记录' : ' · 可复现'}</small>
      </button>`;
  }).join('') : '<p class="mode-empty">尚无记录；每次起卦后会自动保存在当前浏览器。</p>';
  list.querySelectorAll('.history-item').forEach((button) => {
    button.addEventListener('click', () => {
      const item = items.find((entry) => entry.id === button.dataset.historyId);
      if (item) replayHistoryItem(item);
    });
  });
}

function activateHistoryTab(type) {
  const tab = mountEl?.querySelector(type === 'meihua' ? '#divine-tab-meihua' : '#divine-tab-coin');
  tab?.click();
}

function replayHistoryItem(item) {
  activateHistoryTab(item.type);
  const status = mountEl.querySelector('.history-status');
  if (item.legacySummaryOnly) {
    const primary = appState.index.byCode.get(item.primaryCode);
    const changed = item.changedCode ? appState.index.byCode.get(item.changedCode) : null;
    const result = mountEl.querySelector(item.type === 'meihua' ? '.mh-result' : '.coin-result');
    result.innerHTML = `
      <section class="mode-card history-legacy-notice" tabindex="-1">
        <span class="academy-kicker">旧版记录 · 仅保留卦象摘要</span>
        <h3>${esc(primary?.name || item.primaryCode)}${changed ? ` → ${esc(changed.name)}` : ''}</h3>
        <p>这条记录没有保存六爻老少、全部动爻、取辞规则与当时解释，因此不能复现原来的推理过程。</p>
        <button type="button" class="text-button history-open-primary">只研读本卦</button>
      </section>`;
    result.querySelector('.history-open-primary')?.addEventListener('click', () => {
      if (openDetail) openDetail(item.primaryCode);
      else appState.starMap?.focusStar(item.primaryCode);
    });
    status.textContent = '旧记录仅保留卦象摘要，未伪造缺失的取辞过程。';
    revealDivinationArea(result, '.history-legacy-notice');
    return;
  }

  if (item.type === 'coin') {
    const cast = {
      yaos: item.yaos.map((yao) => ({ ...yao, coins: [...yao.coins] })),
      primaryCode: item.primaryCode,
      changedCode: item.changedCode || item.primaryCode,
      changingIdxs: item.changingPositions.map((position) => position - 1),
      hasChange: item.changingPositions.length > 0 && Boolean(item.changedCode),
    };
    renderCoinResult(mountEl.querySelector('.coin-result'), cast, {
      record: false,
      interpretation: item.interpretation,
    });
  } else {
    renderMeihuaResult({ ...item.cast }, {
      record: false,
      interpretation: item.interpretation,
    });
  }
  status.textContent = `已按 ${item.interpretationVersion || '保存时版本'} 复现本次卦象、动爻、取辞与解释。`;
}

function recordCast(entry) {
  const historyResult = addDivinationHistory(entry);
  const activityResult = recordActivity();
  if (!historyResult.saved || !activityResult.saved) {
    mountEl.querySelector('.history-status').textContent = '结果已生成，但浏览器未能保存记录。';
  }
  renderHistory();
}

function renderInterpretation(interpretation) {
  const focusCards = interpretation.focus.map((item) => `
    <article class="divine-evidence-card">
      <small>${esc(item.source)}${interpretation.focus.length > 1 ? ` · ${item.priority === 'secondary' ? '参看' : '主断'}` : ''}</small>
      <blockquote>${esc(item.quote)}</blockquote>
      <p>${esc(item.plain)}</p>
      ${item.xiang ? `<p class="divine-xiang"><small>${esc(item.xiangSource)}</small>${esc(item.xiang)}</p>` : ''}
    </article>
  `).join('');
  return `
    <section class="divine-interpretation" aria-label="占筮结果说明">
      <div class="divine-interpretation-heading">
        <div>
          <small>断辞依据层</small>
          <h3>从经文到当下</h3>
        </div>
        <span>${esc(interpretation.method)}</span>
      </div>
      <div class="divine-insight-grid">
        <article><small>当前处境</small><p>${esc(interpretation.situation)}</p></article>
        <article><small>关键提醒</small><p>${esc(interpretation.keyPoint)}</p></article>
        <article><small>变化方向</small><p>${esc(interpretation.transition)}</p></article>
      </div>
      <details class="divine-reading-details" open>
        <summary>查看取辞方法、经传原文与现实参照</summary>
        <div class="divine-method-grid">
          <article><h4>为什么这样取辞</h4><p>${esc(interpretation.basis)}</p></article>
          <article><h4>专业术语怎么理解</h4><p>${esc(interpretation.terminology)}</p></article>
        </div>
        <section class="divine-evidence" aria-label="经文意象与典籍依据">
          <h4>经文意象与典籍依据</h4>
          ${focusCards}
          <article class="divine-evidence-card divine-classic-reference">
            <small>${esc(interpretation.classic.source)}</small>
            <blockquote>${esc(interpretation.classic.quote)}</blockquote>
            <p>${esc(interpretation.classic.plain)}</p>
          </article>
        </section>
        <section class="divine-analogy">
          <h4>放进现实情境</h4>
          <p>${esc(interpretation.analogy)}</p>
          <p class="divine-analogy-label">这是帮助理解的类比，不是对具体事件的预言。</p>
        </section>
        <section class="divine-prompts">
          <h4>反思三问</h4>
          <ol>${interpretation.prompts.map((prompt) => `<li>${esc(prompt)}</li>`).join('')}</ol>
        </section>
        <p class="divine-method-caveat">方法边界：${esc(interpretation.caveat)}</p>
      </details>
      <p class="divine-safety-note">本解读用于传统文化学习与自我反思，不替代医疗、法律、财务、婚姻或其他现实决策。</p>
    </section>
  `;
}

function renderCoin() {
  const body = mountEl.querySelector('.divine-body');
  body.innerHTML = `
    <section class="divine-cast-stage" aria-labelledby="coin-stage-title">
      <span class="academy-kicker">金钱卦 · 六掷成象</span>
      <h3 id="coin-stage-title">先定所问，再观其变</h3>
      <p>三枚铜钱掷六次。心中只留一个明确问题，所得结果用于阅读经文与梳理处境。</p>
      <ol class="divine-ritual"><li><b>01</b><span>净心<small>放下预设答案</small></span></li><li><b>02</b><span>定问<small>聚焦一件具体之事</small></span></li><li><b>03</b><span>六掷<small>自下而上生成六爻</small></span></li><li><b>04</b><span>读经<small>核对卦辞与动爻</small></span></li></ol>
      <button type="button" class="divine-btn coin-cast">静心掷卦</button>
    </section>
    <div class="coin-result" aria-live="off"></div>
  `;
  body.querySelector('.coin-cast').addEventListener('click', () => renderCoinResult(body.querySelector('.coin-result')));
}

function renderMeihua() {
  const body = mountEl.querySelector('.divine-body');
  body.innerHTML = `
    <p class="divine-intro">以数字或当前时间起卦，观察体用与五行关系。时间法以公历作简化换算，不等同于严格历法推演。</p>
    <div class="meihua-number-row">
      <label>上数<input type="number" class="mh-input mh-upper" min="1" value="${Math.floor(Math.random() * 99) + 1}"></label>
      <label>下数<input type="number" class="mh-input mh-lower" min="1" value="${Math.floor(Math.random() * 99) + 1}"></label>
      <button type="button" class="mh-btn mh-cast">起卦</button>
    </div>
    <button type="button" class="mh-btn mh-time">以当前公历时间起卦（简化）</button>
    <div class="mh-result" aria-live="polite"></div>
  `;
  body.querySelector('.mh-cast').addEventListener('click', () => {
    const upper = Number.parseInt(body.querySelector('.mh-upper').value, 10) || 1;
    const lower = Number.parseInt(body.querySelector('.mh-lower').value, 10) || 1;
    renderMeihuaResult(castByNumber(upper, lower));
  });
  body.querySelector('.mh-time').addEventListener('click', () => renderMeihuaResult(castByTime(new Date())));
}

function renderMeihuaResult(cast, options = {}) {
  const primaryHex = appState.index.byCode.get(cast.primaryCode);
  const changedHex = appState.index.byCode.get(cast.changedCode);
  const analysis = analyzeTiYong(cast);
  const interpretation = options.interpretation || buildMeihuaInterpretation({ cast, primaryHex, changedHex, analysis });
  appState.starMap?.focusStar(cast.primaryCode);
  const result = mountEl.querySelector('.mh-result');
  result.innerHTML = `
    <div class="mode-card divine-result-summary" role="group" aria-label="梅花易数起卦结果">
      <div><strong>${esc(primaryHex.name)}</strong><small>${esc(primaryHex.fullName)} · 本卦</small></div>
      <span>→</span>
      <div><strong>${esc(changedHex.name)}</strong><small>${esc(changedHex.fullName)} · 第${cast.changingPos}爻动</small></div>
    </div>
    <div class="mode-card ti-yong-result">
      <p>体：${esc(analysis.bodyWuxingName)} · 用：${esc(analysis.useWuxingName)}</p>
      <strong>${esc(analysis.relationName)}</strong>
      <p>${esc(analysis.verdict)}</p>
    </div>
    <p class="divine-line-text">动爻：${esc(primaryHex.lines[cast.changingPos - 1]?.text || '')}</p>
    ${renderInterpretation(interpretation)}
  `;
  result.querySelector('.divine-interpretation-heading h3')?.setAttribute('tabindex', '-1');
  if (options.record !== false) {
    recordCast({
      type: 'meihua',
      primaryCode: cast.primaryCode,
      changedCode: cast.changedCode,
      cast,
      interpretation,
      summary: `${primaryHex.name} → ${changedHex.name} · ${analysis.relationName}`,
    });
  }
  revealDivinationArea(result, '.divine-interpretation-heading h3');
}

function renderCoinResult(result, cast = castHexagram(), options = {}) {
  const primaryHex = appState.index.byCode.get(cast.primaryCode);
  const changedHex = cast.hasChange ? appState.index.byCode.get(cast.changedCode) : null;
  const reading = getReading(cast, primaryHex, changedHex);
  const interpretation = options.interpretation || buildCoinInterpretation({ cast, primaryHex, changedHex, reading });
  appState.starMap?.focusStar(cast.primaryCode);

  const lines = cast.yaos.map((yao, index) => {
    const label = yaoLabel(index + 1, yao.isYang);
    return `<li class="${yao.changing ? 'changing-line' : ''}"><span>${label}</span><small>${yao.isYang ? '阳爻' : '阴爻'}${yao.changing ? ' · 动' : ' · 静'}</small></li>`;
  }).reverse().join('');

  result.innerHTML = `
    <section class="cast-result-head" aria-labelledby="coin-result-title">
      <div class="cast-result-symbol">${hexagramSvg(cast.primaryCode, { size: 132, changingPositions: cast.changingIdxs.map((index) => index + 1) })}</div>
      <div><span class="academy-kicker">本次得卦</span><h3 id="coin-result-title" class="compound-title compound-title--hexagram" tabindex="-1" aria-label="${esc(primaryHex.name)} · ${esc(primaryHex.fullName)}"><span class="compound-title-primary">${esc(primaryHex.name)}</span><span class="compound-title-separator" aria-hidden="true">·</span><span class="compound-title-secondary">${esc(primaryHex.fullName)}</span></h3>
        <p>${changedHex ? `之卦 <span class="compound-title compound-title--inline" aria-label="${esc(changedHex.name)} · ${esc(changedHex.fullName)}"><span class="compound-title-primary">${esc(changedHex.name)}</span><span class="compound-title-separator" aria-hidden="true">·</span><span class="compound-title-secondary">${esc(changedHex.fullName)}</span></span>` : '六爻皆静，以本卦卦辞为主要研读入口。'}</p></div>
      <ol class="cast-lines" aria-label="六爻，自上而下显示">${lines}</ol>
    </section>
    ${renderInterpretation(interpretation)}
    <button type="button" class="divine-btn divine-again">再掷一卦</button>
  `;
  if (options.record !== false) {
    recordCast({
      type: 'coin',
      primaryCode: cast.primaryCode,
      changedCode: changedHex ? cast.changedCode : null,
      yaos: cast.yaos,
      readingPolicyId: reading.policyId,
      interpretation,
      summary: `${primaryHex.name}${changedHex ? ` → ${changedHex.name}` : ''}`,
    });
  }
  result.querySelector('.divine-again').addEventListener('click', () => renderCoinResult(result));
  revealDivinationArea(result, '#coin-result-title');
}
