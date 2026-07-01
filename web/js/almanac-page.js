// 黄历主页：以今天为默认切入，全面解读。
// 日期切换 + 农历/干支/节气/建除/宿/百忌/宜忌 + 今日解读（每项可点击查义）。
import { solarToLunar } from './almanac/lunar.js';
import { dayGanZhi, yearGanZhi, monthGanZhi } from './almanac/ganzhi.js';
import { currentSolarTerm } from './almanac/solar-terms.js';
import { jianChuOfDay, xiuOfDay, pengZuBaiJi, yiJiOfDay } from './almanac/selection.js';
import { getTermReading, buildDailyReading } from './almanac/reading.js';

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

let st = null;

export function renderAlmanacPage(mountEl, appState) {
  st = { terms: appState.almanacTerms || [], yiji: appState.almanacYiji || {} };
  draw(mountEl, new Date());
}

function draw(mountEl, date) {
  st.date = date;
  const lunar = solarToLunar(date);
  const yg = yearGanZhi(date);
  const mg = monthGanZhi(date);
  const dg = dayGanZhi(date);
  const term = currentSolarTerm(date);
  const jc = jianChuOfDay(date);
  const xiu = xiuOfDay(date);
  const pz = pengZuBaiJi(date);
  const yiji = yiJiOfDay(date, st.yiji);

  const dateStr = `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
  const isToday = sameDay(date, new Date());

  // 今日解读（传完整择日对象，供 reading.js 内部读取字段）
  const almanacInfo = {
    jianChu: jc,
    xiu: xiu,
    pengZu: pz,
    yiJi: yiji,
    solarTerm: term,
  };
  const reading = buildDailyReading(date, almanacInfo, st.terms, st.yiji);

  mountEl.innerHTML = `
    <div class="almanac-view">
      <div class="alm-date-bar">
        <button class="alm-nav" id="alm-prev">◀ 前一天</button>
        <div class="alm-date">
          <div class="alm-date-main">${dateStr}${isToday ? ' <span class="alm-today">今天</span>' : ''}</div>
          <input type="date" id="alm-picker" value="${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}">
        </div>
        <button class="alm-nav" id="alm-next">后一天 ▶</button>
      </div>

      <div class="alm-card">
        <div class="alm-lunar">
          <span class="alm-lunar-main">${esc(yg.animal)}年 · ${esc(lunar.isLeap ? '闰' : '')}${esc(lunar.monthName)}${cnNum(lunar.day)}</span>
          <span class="alm-lunar-sub">农历 ${esc(lunar.year)}年</span>
        </div>
        <div class="alm-ganzhi">
          <div class="gz-item"><span class="gz-label">年</span><b>${esc(yg.name)}</b><small>${esc(yg.nayin||'')}</small></div>
          <div class="gz-item"><span class="gz-label">月</span><b>${esc(mg.name)}</b><small>${esc(mg.nayin||'')}</small></div>
          <div class="gz-item"><span class="gz-label">日</span><b>${esc(dg.name)}</b><small>${esc(dg.nayin||'')}</small></div>
        </div>
        <div class="alm-jieqi">节气：<b>${esc(term.current)}</b>（第${term.daysSince + 1}天）· 距${esc(term.next)}${term.daysToNext}天</div>
      </div>

      <div class="alm-card">
        <div class="alm-zhiwei">
          <span class="zw-item term-clickable" data-term="${esc(jc.name)}">建除：<b>${esc(jc.name)}日</b></span>
          <span class="zw-item term-clickable" data-term="${esc(xiu.name)}宿">值宿：<b>${esc(xiu.name)}宿</b>${xiu.qin ? '<small>'+esc(xiu.qin)+'</small>' : ''}</span>
        </div>

        <div class="alm-yiji-block">
          <div class="alm-yi"><span class="yj-label">✅ 宜</span>
            <div class="yj-items">${yiji.yi.length ? yiji.yi.map(i => `<span class="yj-tag" data-term="${esc(i)}">${esc(i)}</span>`).join('') : '<span class="yj-empty">无</span>'}</div>
          </div>
          <div class="alm-ji"><span class="yj-label">❌ 忌</span>
            <div class="yj-items">${yiji.ji.length ? yiji.ji.map(i => `<span class="yj-tag" data-term="${esc(i)}">${esc(i)}</span>`).join('') : '<span class="yj-empty">无</span>'}</div>
          </div>
        </div>

        <div class="alm-pengzu term-clickable" data-term="彭祖百忌">
          <b>彭祖百忌：</b>${esc(pz.all || (pz.ganJi + '；' + pz.zhiJi))}
        </div>
      </div>

      <div class="alm-card">
        <h4 class="alm-reading-title">📖 今日解读</h4>
        <div class="alm-reading-list">
          ${(reading.blocks && reading.blocks.length) ? reading.blocks.map(r => `
            <details class="alm-reading-item">
              <summary><b>${esc(r.title)}</b></summary>
              <div class="alm-reading-body">
                <p>${esc(r.meaning)}</p>
                ${r.yi && r.yi.length ? `<p class="rd-yi">宜：${r.yi.map(i=>esc(i)).join('、')}</p>` : ''}
                ${r.ji && r.ji.length ? `<p class="rd-ji">忌：${r.ji.map(i=>esc(i)).join('、')}</p>` : ''}
                ${r.principle ? `<p class="rd-principle"><small>${esc(r.principle)}</small></p>` : ''}
              </div>
            </details>
          `).join('') : '<p class="alm-empty">暂无解读</p>'}
        </div>
      </div>
      <p class="alm-foot"><small>宜忌依《协纪辨方书》传统择日通例，流派差异已在解读中注明。辞以明象，反求诸己。</small></p>
    </div>`;

  bindEvents(mountEl);
  window.scrollTo(0, 0);
}

function bindEvents(mountEl) {
  document.getElementById('alm-prev').onclick = () => {
    const d = new Date(st.date); d.setDate(d.getDate() - 1); draw(mountEl, d);
  };
  document.getElementById('alm-next').onclick = () => {
    const d = new Date(st.date); d.setDate(d.getDate() + 1); draw(mountEl, d);
  };
  document.getElementById('alm-picker').onchange = (e) => {
    const [y, m, d] = e.target.value.split('-').map(Number);
    if (y) draw(mountEl, new Date(y, m - 1, d));
  };
  // 术语点击：弹出解读
  mountEl.querySelectorAll('.term-clickable, .yj-tag').forEach(el => {
    el.onclick = (ev) => {
      ev.stopPropagation();
      showTermPopup(el.dataset.term);
    };
  });
}

function showTermPopup(termName) {
  const t = getTermReading(st.terms, termName);
  const overlay = document.createElement('div');
  overlay.className = 'alm-popup-overlay';
  overlay.innerHTML = `
    <div class="alm-popup">
      <button class="alm-popup-close">×</button>
      ${t ? `
        <h3>${esc(t.name)} <small>${esc(t.category)}</small></h3>
        <p>${esc(t.meaning)}</p>
        ${t.yi && t.yi.length ? `<p class="rd-yi">宜：${t.yi.map(i=>esc(i)).join('、')}</p>` : ''}
        ${t.ji && t.ji.length ? `<p class="rd-ji">忌：${t.ji.map(i=>esc(i)).join('、')}</p>` : ''}
        ${t.principle ? `<p class="rd-principle"><small>${esc(t.principle)}</small></p>` : ''}
      ` : `<p class="alm-empty">"${esc(termName)}" 暂无详细解读，可至"学习·黄历知识"查阅相关术语。</p>`}
    </div>`;
  overlay.onclick = (e) => { if (e.target === overlay || e.target.classList.contains('alm-popup-close')) overlay.remove(); };
  document.body.appendChild(overlay);
}

function sameDay(a, b) { return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate(); }
function pad(n) { return String(n).padStart(2, '0'); }
function cnNum(n) {
  if (n === 30) return '三十';
  const t = ['','一','二','三','四','五','六','七','八','九','十'];
  if (n <= 10) return '初' + t[n];
  if (n < 20) return '十' + (n===10?'':t[n-10]);
  if (n === 20) return '二十';
  if (n < 30) return '廿' + t[n-20];
  return '三十';
}
