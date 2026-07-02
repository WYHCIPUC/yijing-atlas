// 阴阳流变动画：点击关系 chip 时，弹出浮层演示卦象如何变化。
// 错卦=逐爻翻转，综卦=整体倒转，互卦=高亮2-3-4/3-4-5爻重组，变卦=指定爻翻转。
import { hexagramSvg } from './svg-painter.js';

let overlayEl = null;

function esc(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// 画一根爻（SVG）。isYang=阳爻(一长横)，阴爻=两短横。highlight=高亮色。
function yaoLine(y, isYang, highlight, width = 120) {
  const stroke = highlight || '#e8d9b8';
  const sw = 10;
  const gap = width * 0.22;
  const half = (width - gap) / 2;
  if (isYang) {
    return `<line x1="0" y1="${y}" x2="${width}" y2="${y}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round"/>`;
  }
  return `<line x1="0" y1="${y}" x2="${half}" y2="${y}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round"/><line x1="${width-half}" y1="${y}" x2="${width}" y2="${y}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round"/>`;
}

// 画完整卦象（6爻）。lines: [bool×6] 自下而上。highlightIdx: 高亮的爻位(0-5)。
function renderHex(lines, highlightIdxs = [], width = 120) {
  const lineH = width / 7;
  const totalH = lineH * 6 + lineH;
  const parts = [];
  for (let i = 0; i < 6; i++) {
    const y = totalH - (i + 1) * lineH; // 自下而上
    const hl = highlightIdxs.includes(i) ? '#e94560' : null;
    parts.push(yaoLine(y, lines[i], hl, width));
  }
  return `<svg width="${width}" height="${totalH}" viewBox="0 0 ${width} ${totalH}">${parts.join('')}</svg>`;
}

// 二进制串 → bool 数组
function codeToLines(code) {
  return code.split('').map(c => c === '1');
}

// 关系说明
const REL_INFO = {
  opposite: { name: '错卦', desc: '阴阳全换——每根爻的阴阳互换', color: '#e8d09a' },
  reversed: { name: '综卦', desc: '上下倒转——整个卦象翻转来看', color: '#d8c0e8' },
  interlocking: { name: '互卦', desc: '取2-3-4爻为下卦、3-4-5爻为上卦', color: '#b8d0e8' },
  changing: { name: '变卦', desc: '动爻翻转——某根爻阴阳转化', color: '#e8c898' },
};

/**
 * 显示流变动画浮层。
 * @param {string} fromCode - 原卦 binaryCode
 * @param {string} toCode - 目标卦 binaryCode
 * @param {string} relType - opposite/reversed/interlocking/changing
 * @param {string} fromName - 原卦名
 * @param {string} toName - 目标卦名
 */
export function showRelationAnimation(fromCode, toCode, relType, fromName, toName) {
  _ensureOverlay();
  const info = REL_INFO[relType] || REL_INFO.changing;
  const fromLines = codeToLines(fromCode);
  const toLines = codeToLines(toCode);

  // 计算高亮爻位（哪些爻变化了）
  const changedIdxs = [];
  for (let i = 0; i < 6; i++) {
    if (fromLines[i] !== toLines[i]) changedIdxs.push(i);
  }
  // 互卦特殊：高亮 2-3-4-5 爻（索引1-4）
  const interlockingIdxs = relType === 'interlocking' ? [1, 2, 3, 4] : changedIdxs;

  overlayEl.innerHTML = `
    <div class="rel-anim-card">
      <button class="rel-anim-close" id="rel-anim-close">✕</button>
      <div class="rel-anim-title">
        <span class="rel-anim-badge" style="background:${info.color}22;color:${info.color}">${info.name}</span>
        <span class="rel-anim-desc">${info.desc}</span>
      </div>
      <div class="rel-anim-stage">
        <div class="rel-anim-hex rel-anim-from">
          ${renderHex(fromLines, interlockingIdxs, 110)}
          <div class="rel-anim-name">${esc(fromName)}</div>
          <div class="rel-anim-label">原卦</div>
        </div>
        <div class="rel-anim-arrow" id="rel-anim-arrow">→</div>
        <div class="rel-anim-hex rel-anim-to" id="rel-anim-to">
          ${renderHex(fromLines, interlockingIdxs, 110)}
          <div class="rel-anim-name">${esc(toName)}</div>
          <div class="rel-anim-label">目标</div>
        </div>
      </div>
      <p class="rel-anim-hint" id="rel-anim-hint">点击「变化」观看演示</p>
      <button class="rel-anim-play" id="rel-anim-play">▶ 变化</button>
    </div>
  `;
  overlayEl.classList.add('open');

  // 关闭
  document.getElementById('rel-anim-close').addEventListener('click', () => closeRelationAnimation());
  overlayEl.addEventListener('click', (e) => { if (e.target === overlayEl) closeRelationAnimation(); });

  // 播放动画
  document.getElementById('rel-anim-play').addEventListener('click', () => {
    playAnimation(relType, fromLines, toLines, interlockingIdxs);
  });
}

// 播放变化动画
function playAnimation(relType, fromLines, toLines, highlightIdxs) {
  const toContainer = document.getElementById('rel-anim-to');
  const hint = document.getElementById('rel-anim-hint');
  const playBtn = document.getElementById('rel-anim-play');
  playBtn.disabled = true;

  if (relType === 'reversed') {
    // 综卦：整体翻转——逐步倒转爻序
    hint.textContent = '上下翻转中…';
    let step = 0;
    const current = [...fromLines];
    const interval = setInterval(() => {
      if (step >= 6) {
        clearInterval(interval);
        toContainer.querySelector('svg').outerHTML = renderHex(toLines, [], 110);
        hint.textContent = '翻转完成。同一卦换个角度看，意义不同。';
        playBtn.disabled = false;
        return;
      }
      // 从两端向中间交换
      const tmp = current[step];
      current[step] = current[5 - step];
      current[5 - step] = tmp;
      toContainer.querySelector('svg').outerHTML = renderHex(current, [step, 5 - step], 110);
      step++;
    }, 250);
  } else {
    // 错卦/变卦/互卦：逐爻翻转变化的部分
    const changeList = relType === 'interlocking' ? [1, 2, 3, 4] : highlightIdxs;
    let stepIdx = 0;
    const current = [...fromLines];
    hint.textContent = '逐爻变化中…';
    const interval = setInterval(() => {
      if (stepIdx >= changeList.length) {
        clearInterval(interval);
        toContainer.querySelector('svg').outerHTML = renderHex(toLines, [], 110);
        hint.textContent = relType === 'opposite' ? '全部阴阳互换完成。' : (relType === 'interlocking' ? '内含之卦已显现。' : '变卦完成。');
        playBtn.disabled = false;
        return;
      }
      const idx = changeList[stepIdx];
      current[idx] = toLines[idx]; // 翻转这一爻
      toContainer.querySelector('svg').outerHTML = renderHex(current, [idx], 110);
      stepIdx++;
    }, 300);
  }
}

export function closeRelationAnimation() {
  if (overlayEl) overlayEl.classList.remove('open');
}

function _ensureOverlay() {
  if (overlayEl) return;
  overlayEl = document.createElement('div');
  overlayEl.className = 'rel-anim-overlay';
  document.body.appendChild(overlayEl);
}
