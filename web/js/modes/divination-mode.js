import { castHexagram, getReading } from '../divination-engine.js';
import { addDivinationHistory, clearDivinationHistory, loadDivinationHistory } from '../divination-history.js';
import { yaoLabel } from '../hexagram-utils.js';
import { recordActivity } from '../learning-progress.js';
import { analyzeTiYong, castByNumber, castByTime } from '../meihua-engine.js';

let appState = null;
let mountEl = null;

function esc(value) {
  return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function renderDivinationMode(target, state) {
  appState = state;
  mountEl = target;
  mountEl.innerHTML = `
    <div class="mode-panel divine-panel">
      <h2 class="mode-panel-title">占筮问道</h2>
      <p class="mode-panel-sub">传统术数仅供文化学习与自我反思，不替代现实中的专业判断。</p>
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
      <button type="button" class="history-item" data-code="${esc(item.primaryCode)}">
        <span>${esc(primary?.name || item.primaryCode)}${changed ? ` → ${esc(changed.name)}` : ''}</span>
        <small>${item.type === 'meihua' ? '梅花' : '金钱'} · ${esc(dateText)}</small>
      </button>`;
  }).join('') : '<p class="mode-empty">尚无记录；每次起卦后会自动保存在当前浏览器。</p>';
  list.querySelectorAll('.history-item').forEach((button) => {
    button.addEventListener('click', () => appState.starMap?.focusStar(button.dataset.code));
  });
}

function recordCast(entry) {
  const historyResult = addDivinationHistory(entry);
  const activityResult = recordActivity();
  if (!historyResult.saved || !activityResult.saved) {
    mountEl.querySelector('.history-status').textContent = '结果已生成，但浏览器未能保存记录。';
  }
  renderHistory();
}

function renderCoin() {
  const body = mountEl.querySelector('.divine-body');
  body.innerHTML = `
    <p class="divine-intro">三枚铜钱掷六次。心中默念所问之事，静心凝神。</p>
    <button type="button" class="divine-btn coin-cast">☯ 掷卦</button>
    <div class="coin-result" aria-live="polite"></div>
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

function renderMeihuaResult(cast) {
  const primaryHex = appState.index.byCode.get(cast.primaryCode);
  const changedHex = appState.index.byCode.get(cast.changedCode);
  const analysis = analyzeTiYong(cast);
  appState.starMap?.focusStar(cast.primaryCode);
  const result = mountEl.querySelector('.mh-result');
  result.innerHTML = `
    <div class="mode-card divine-result-summary">
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
  `;
  recordCast({
    type: 'meihua',
    primaryCode: cast.primaryCode,
    changedCode: cast.changedCode,
    changingPos: cast.changingPos,
    summary: `${primaryHex.name} → ${changedHex.name} · ${analysis.relationName}`,
  });
}

function renderCoinResult(result) {
  const cast = castHexagram();
  const primaryHex = appState.index.byCode.get(cast.primaryCode);
  const changedHex = cast.hasChange ? appState.index.byCode.get(cast.changedCode) : null;
  const reading = getReading(cast, primaryHex, changedHex);
  appState.starMap?.focusStar(cast.primaryCode);

  const lines = cast.yaos.map((yao, index) => {
    const label = yaoLabel(index + 1, yao.isYang);
    const symbol = yao.isYang ? '━━━━' : '━━  ━━';
    return `<li class="${yao.changing ? 'changing-line' : ''}">${symbol} ${label}${yao.changing ? ' · 变' : ''}</li>`;
  }).reverse().join('');

  result.innerHTML = `
    <ol class="cast-lines" aria-label="六爻，自上而下显示">${lines}</ol>
    <p class="cast-title">
      ${esc(primaryHex.name)}（${esc(primaryHex.fullName)}）
      ${changedHex ? `→ ${esc(changedHex.name)}（${esc(changedHex.fullName)}）` : ''}
    </p>
    <div class="mode-card cast-reading">
      <p>${esc(reading.rule)}</p>
      ${reading.readings.map((item) => `<p><small>${esc(item.src)}</small>${esc(item.text)}</p>`).join('')}
    </div>
    <button type="button" class="divine-btn divine-again">再掷一卦</button>
  `;
  recordCast({
    type: 'coin',
    primaryCode: cast.primaryCode,
    changedCode: changedHex ? cast.changedCode : null,
    changingPos: cast.changingIdxs.length === 1 ? cast.changingIdxs[0] + 1 : null,
    summary: `${primaryHex.name}${changedHex ? ` → ${changedHex.name}` : ''}`,
  });
  result.querySelector('.divine-again').addEventListener('click', () => renderCoinResult(result));
}
