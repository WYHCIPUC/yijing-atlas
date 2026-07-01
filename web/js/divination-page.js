// 占筮页：选起卦法 → 起卦 → 展示本卦/变卦/解读 → 历史记录（localStorage）。
import { hexagramSvg } from './svg-painter.js';
import { castCoins, castYarrow, castMeihua, extractReading } from './divination-engine.js';

const HISTORY_KEY = 'yijing.divination.v1';

function esc(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; }
}
function saveHistory(h) {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(h)); } catch {}
}

let st = null;

export function renderDivinationPage(mountEl, appState) {
  st = { index: appState.index };
  drawSetup(mountEl);
}

function drawSetup(mountEl) {
  const history = loadHistory();
  mountEl.innerHTML = `
    <div class="div-panel">
      <h3>占筮</h3>
      <p class="div-intro">"《易》，占也。"择一法起卦，依变爻之数取辞断之。<br/><small>占筮旨在决疑反躬、明天道察人事，非为迷信，贵在自省与开物成务。</small></p>
      <div class="div-methods">
        <button class="method-btn" data-method="coins">💰 金钱卦<br/><small>六次掷铜钱</small></button>
        <button class="method-btn" data-method="yarrow">🌿 大衍筮法<br/><small>蓍草十八变</small></button>
        <button class="method-btn" data-method="meihua">🌺 梅花易数<br/><small>以时起卦</small></button>
      </div>
      <div id="meihua-input" class="meihua-input" style="display:none;">
        <h4>梅花易数 · 时间起卦</h4>
        <p><small>留空则用当前时间。年=年份末两位，月=农历月，日=农历日，时=时辰(1-12)。</small></p>
        <label>年<input id="m-year" type="number" placeholder="自动"></label>
        <label>月<input id="m-month" type="number" placeholder="自动"></label>
        <label>日<input id="m-day" type="number" placeholder="自动"></label>
        <label>时辰<input id="m-hour" type="number" placeholder="自动"></label>
      </div>
      <button class="primary-btn" id="do-cast" style="display:none;">诚心起卦</button>

      ${history.length ? `
        <h4 class="history-title">占卦记录（${history.length}）</h4>
        <ul class="history-list">
          ${history.slice(0, 10).map((r, i) => `
            <li class="history-item" data-idx="${i}">
              <span class="hist-time">${new Date(r.time).toLocaleString('zh-CN', {month:'numeric',day:'numeric',hour:'numeric',minute:'numeric'})}</span>
              <span class="hist-hex">${esc(r.primaryName)}${r.changedName ? ' → ' + esc(r.changedName) : ''}</span>
              <span class="hist-method">${esc(methodLabel(r.method))}</span>
              ${r.question ? `<span class="hist-q">"${esc(r.question)}"</span>` : ''}
            </li>`).join('')}
        </ul>
        <button class="secondary-btn" id="clear-history">清空记录</button>
      ` : ''}
    </div>`;

  let chosen = null;
  mountEl.querySelectorAll('.method-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      chosen = btn.dataset.method;
      mountEl.querySelectorAll('.method-btn').forEach((b) => b.classList.remove('selected'));
      btn.classList.add('selected');
      document.getElementById('meihua-input').style.display = chosen === 'meihua' ? 'block' : 'none';
      document.getElementById('do-cast').style.display = 'block';
    });
  });

  const cast = document.getElementById('do-cast');
  if (cast) cast.addEventListener('click', () => doCast(mountEl, chosen));

  const clear = document.getElementById('clear-history');
  if (clear) clear.addEventListener('click', () => { saveHistory([]); drawSetup(mountEl); });

  // 历史记录点击复现
  mountEl.querySelectorAll('.history-item').forEach((li) => {
    li.addEventListener('click', () => showResult(mountEl, history[Number(li.dataset.idx)], true));
  });
}

function methodLabel(m) {
  return { coins: '金钱卦', yarrow: '大衍', meihua: '梅花' }[m] || m;
}

function doCast(mountEl, method) {
  let result;
  if (method === 'coins') result = castCoins();
  else if (method === 'yarrow') result = castYarrow();
  else if (method === 'meihua') {
    const get = (id) => { const v = document.getElementById(id).value; return v ? Number(v) : undefined; };
    result = castMeihua({ year: get('m-year'), month: get('m-month'), day: get('m-day'), hour: get('m-hour') });
  }
  // 补充卦名
  result.primaryName = st.index.byCode.get(result.primary)?.name || '?';
  result.changedName = result.changed !== result.primary ? (st.index.byCode.get(result.changed)?.name || '?') : null;
  result.time = Date.now();
  result.method = method;

  // 询问所问之事（可选）
  const question = prompt('所欲问之事（可留空）：', '');
  if (question !== null) result.question = question.trim();

  // 存入历史
  const hist = loadHistory();
  hist.unshift(result);
  saveHistory(hist.slice(0, 50));

  showResult(mountEl, result, false);
}

function showResult(mountEl, result, isReplay) {
  const reading = extractReading(result, st.index);
  const primary = st.index.byCode.get(result.primary);
  const changed = result.changed !== result.primary ? st.index.byCode.get(result.changed) : null;

  mountEl.innerHTML = `
    <div class="div-result">
      <a class="back-btn" href="#/divination">← 重新起卦</a>
      ${result.question ? `<p class="div-question">所问：${esc(result.question)}</p>` : ''}
      ${!isReplay ? '<p class="div-time">起卦于 ' + new Date(result.time).toLocaleString('zh-CN') + '</p>' : ''}

      <div class="div-hexagrams">
        <div class="div-hex-box">
          ${hexagramSvg(result.primary, { size: 110, changingPositions: result.changing })}
          <h4>本卦 · ${esc(primary?.name || '?')} ${esc(primary?.fullName || '')}</h4>
          <p class="hex-judge">${esc(primary?.judgement || '')}</p>
        </div>
        ${changed ? `
          <div class="div-arrow">→</div>
          <div class="div-hex-box">
            ${hexagramSvg(result.changed, { size: 110 })}
            <h4>变卦 · ${esc(changed.name)} ${esc(changed.fullName)}</h4>
            <p class="hex-judge">${esc(changed.judgement)}</p>
          </div>
        ` : ''}
      </div>

      <div class="div-reading">
        <h4>占断（${result.changing.length} 爻变）</h4>
        <p class="reading-rule">${esc(reading.rule.desc)}</p>
        <p class="reading-focus">取断：${esc(reading.rule.focus)}</p>
        <div class="reading-refs">
          ${reading.refs.filter(r => r.text).map((r) => `
            <div class="reading-ref">
              <span class="ref-label">${esc(r.label)}</span>
              <p class="ref-text">${esc(r.text)}</p>
              ${r.xiang ? `<p class="ref-xiang">象曰：${esc(r.xiang)}</p>` : ''}
            </div>
          `).join('')}
        </div>
      </div>
      <p class="div-disclaimer"><small>占断取辞依朱子《易学启蒙》变爻通例。辞以明象，象以尽意，得意当忘象，反求诸己。</small></p>
    </div>`;
  window.scrollTo(0, 0);
}
