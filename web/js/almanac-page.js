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
const MIN_YEAR = 1900;
const MAX_YEAR = 2199;
const CALENDAR_TIME_ZONE = 'Asia/Shanghai';

export function shanghaiCalendarDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: CALENDAR_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return new Date(Number(values.year), Number(values.month) - 1, Number(values.day), 12);
}

export function renderAlmanacPage(mountEl, appState) {
  st = { terms: appState.almanacTerms || [], yiji: appState.almanacYiji || {} };
  draw(mountEl, shanghaiCalendarDate());
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
  const isToday = sameDay(date, shanghaiCalendarDate());

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
        <button type="button" class="alm-nav" id="alm-prev" ${dateKey(date) <= MIN_YEAR * 10000 + 101 ? 'disabled' : ''}>◀ 前一天</button>
        <div class="alm-date">
          <div class="alm-date-main">${dateStr}${isToday ? ' <span class="alm-today">今天</span>' : ''}</div>
          <input type="date" id="alm-picker" min="${MIN_YEAR}-01-01" max="${MAX_YEAR}-12-31" value="${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}" aria-label="选择公历日期">
        </div>
        <button type="button" class="alm-nav" id="alm-next" ${dateKey(date) >= MAX_YEAR * 10000 + 1231 ? 'disabled' : ''}>后一天 ▶</button>
      </div>

      <section class="alm-card alm-calendar-card">
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
      </section>

      <section class="alm-card alm-guidance-card">
        <div class="alm-zhiwei">
          <button type="button" class="zw-item term-clickable alm-term-button" data-term="${esc(jc.name)}" aria-haspopup="dialog">建除：<b>${esc(jc.name)}日</b></button>
          <button type="button" class="zw-item term-clickable alm-term-button" data-term="${esc(xiu.name)}宿" aria-haspopup="dialog">值宿：<b>${esc(xiu.name)}宿</b>${xiu.qin ? '<small>'+esc(xiu.qin)+'</small>' : ''}</button>
        </div>

        <div class="alm-yiji-block">
          <div class="alm-yi"><span class="yj-label">宜</span>
            <div class="yj-items">${yiji.yi.length ? yiji.yi.map(i => `<button type="button" class="yj-tag" data-term="${esc(i)}" aria-haspopup="dialog">${esc(i)}</button>`).join('') : '<span class="yj-empty">无</span>'}</div>
          </div>
          <div class="alm-ji"><span class="yj-label">忌</span>
            <div class="yj-items">${yiji.ji.length ? yiji.ji.map(i => `<button type="button" class="yj-tag" data-term="${esc(i)}" aria-haspopup="dialog">${esc(i)}</button>`).join('') : '<span class="yj-empty">无</span>'}</div>
          </div>
        </div>

        <button type="button" class="alm-pengzu term-clickable alm-term-button" data-term="彭祖百忌" aria-haspopup="dialog">
          <b>彭祖百忌：</b>${esc(pz.all || (pz.ganJi + '；' + pz.zhiJi))}
        </button>
      </section>

      <section class="alm-card alm-reading-card">
        <h4 class="alm-reading-title">今日解读</h4>
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
      </section>
      <p class="alm-foot"><small><b>历法口径：</b>历日统一按 Asia/Shanghai（北京时间，UTC+8）确定；农历年以正月初一换年，干支年以立春换年，日界按午夜 00:00。计算范围为 ${MIN_YEAR}—${MAX_YEAR} 年；自动化结果属于历法计算与民俗资料，仅供文化学习，不作为医疗、法律、财务或其他现实决策依据。</small></p>
    </div>`;

  bindEvents(mountEl);
  window.scrollTo(0, 0);
}

function bindEvents(mountEl) {
  mountEl.querySelector('#alm-prev').onclick = () => {
    const d = new Date(st.date); d.setDate(d.getDate() - 1); draw(mountEl, d);
  };
  mountEl.querySelector('#alm-next').onclick = () => {
    const d = new Date(st.date); d.setDate(d.getDate() + 1); draw(mountEl, d);
  };
  mountEl.querySelector('#alm-picker').onchange = (e) => {
    const [y, m, d] = e.target.value.split('-').map(Number);
    if (y >= MIN_YEAR && y <= MAX_YEAR) draw(mountEl, new Date(y, m - 1, d));
  };
  // 术语点击：弹出解读
  mountEl.querySelectorAll('.term-clickable, .yj-tag').forEach(el => {
    el.onclick = (ev) => {
      ev.stopPropagation();
      showTermPopup(el.dataset.term, el);
    };
  });
}

function showTermPopup(termName, triggerEl) {
  const t = getTermReading(st.terms, termName);
  const overlay = document.createElement('div');
  overlay.className = 'alm-popup-overlay';
  overlay.innerHTML = `
    <div class="alm-popup" role="dialog" aria-modal="true" aria-labelledby="alm-popup-title">
      <button type="button" class="alm-popup-close" aria-label="关闭术语解读">×</button>
      <h3 id="alm-popup-title" tabindex="-1">${esc(t?.name || termName)}${t?.category ? ` <small>${esc(t.category)}</small>` : ''}</h3>
      ${t ? `
        <p>${esc(t.meaning)}</p>
        ${t.yi && t.yi.length ? `<p class="rd-yi">宜：${t.yi.map(i=>esc(i)).join('、')}</p>` : ''}
        ${t.ji && t.ji.length ? `<p class="rd-ji">忌：${t.ji.map(i=>esc(i)).join('、')}</p>` : ''}
        ${t.principle ? `<p class="rd-principle"><small>${esc(t.principle)}</small></p>` : ''}
      ` : `<p class="alm-empty">"${esc(termName)}" 暂无详细解读，可至"学习·黄历知识"查阅相关术语。</p>`}
    </div>`;

  const dialog = overlay.querySelector('.alm-popup');
  const closeButton = overlay.querySelector('.alm-popup-close');
  let closed = false;

  const closePopup = () => {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', handleKeydown);
    overlay.remove();
    triggerEl?.setAttribute('aria-expanded', 'false');
    if (triggerEl?.isConnected !== false && typeof triggerEl?.focus === 'function') {
      triggerEl.focus({ preventScroll: true });
    }
  };

  const handleKeydown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closePopup();
      return;
    }
    if (event.key !== 'Tab') return;

    const focusable = [...dialog.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )];
    if (!focusable.length) {
      event.preventDefault();
      dialog.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) closePopup();
  });
  closeButton.addEventListener('click', closePopup);
  document.addEventListener('keydown', handleKeydown);
  triggerEl?.setAttribute('aria-expanded', 'true');
  document.body.appendChild(overlay);
  closeButton.focus({ preventScroll: true });
}

function sameDay(a, b) { return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate(); }
function dateKey(date) { return date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate(); }
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
