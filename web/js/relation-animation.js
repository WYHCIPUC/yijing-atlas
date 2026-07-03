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
export function showRelationAnimation(fromCode, toCode, relType, fromName, toName, fromHex, toHex) {
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

  // 爻位名称
  const posNames = ['初', '二', '三', '四', '五', '上'];
  const yinYang = (isYang) => isYang ? '阳' : '阴';

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
      <div class="rel-anim-meaning" id="rel-anim-meaning"></div>
      <button class="rel-anim-play" id="rel-anim-play">▶ 变化</button>
    </div>
  `;
  overlayEl.classList.add('open');

  // 关闭
  document.getElementById('rel-anim-close').addEventListener('click', () => closeRelationAnimation());
  overlayEl.addEventListener('click', (e) => { if (e.target === overlayEl) closeRelationAnimation(); });

  // 播放动画
  document.getElementById('rel-anim-play').addEventListener('click', () => {
    playAnimation(relType, fromLines, toLines, interlockingIdxs, fromHex, toHex);
  });
}

// 获取某爻的爻辞摘要
function getYaoText(hex, idx) {
  if (!hex || !hex.lines || !hex.lines[idx]) return '';
  const yao = hex.lines[idx];
  const text = (yao.text || '').replace(/^[^：]*：/, '').replace(/。$/, '');
  return text.slice(0, 12);
}

// 更新含义说明
function updateMeaning(relType, idx, fromHex, toHex) {
  const el = document.getElementById('rel-anim-meaning');
  if (!el) return;
  const posName = posNames[idx];
  if (relType === 'opposite') {
    const fromYinYang = fromHex ? yinYang(fromHex.lines[idx].isYang) : '';
    const toYinYang = toHex ? yinYang(toHex.lines[idx].isYang) : '';
    el.innerHTML = `<span class="mn-pos">${posName}爻</span> 由<span class="mn-from">${fromYinYang}</span>变为<span class="mn-to">${toYinYang}</span><br><span class="mn-quote">「${getYaoText(fromHex, idx)}」→「${getYaoText(toHex, idx)}」</span>`;
  } else if (relType === 'reversed') {
    el.innerHTML = `<span class="mn-pos">${posName}爻</span>与<span class="mn-pos">${posNames[5-idx]}爻</span>互换位置<br><span class="mn-note">视角倒转，上下卦互换，所见不同。</span>`;
  } else if (relType === 'interlocking') {
    el.innerHTML = `<span class="mn-pos">${posName}爻</span>参与构成互卦<br><span class="mn-note">取2-3-4爻为下卦，3-4-5爻为上卦，揭示内在本质。</span>`;
  } else {
    el.innerHTML = `<span class="mn-pos">${posName}爻</span>发生变动<br><span class="mn-quote">「${getYaoText(fromHex, idx)}」→「${getYaoText(toHex, idx)}」</span>`;
  }
}

// 播放变化动画
function playAnimation(relType, fromLines, toLines, highlightIdxs, fromHex, toHex) {
  const toContainer = document.getElementById('rel-anim-to');
  const hint = document.getElementById('rel-anim-hint');
  const playBtn = document.getElementById('rel-anim-play');
  const meaning = document.getElementById('rel-anim-meaning');
  playBtn.disabled = true;
  if (meaning) meaning.innerHTML = '';

  if (relType === 'reversed') {
    hint.textContent = '上下翻转中…';
    let step = 0;
    const current = [...fromLines];
    const interval = setInterval(() => {
      if (step >= 6) {
        clearInterval(interval);
        toContainer.querySelector('svg').outerHTML = renderHex(toLines, [], 110);
        hint.textContent = '翻转完成。同一卦换个角度看，意义不同。';
        if (meaning) meaning.innerHTML = '<span class="mn-note">综卦是将原卦整体倒转——把卦倒过来看，会得到不同的卦象和含义。事物换个角度，意义便不同。</span>';
        playBtn.disabled = false;
        return;
      }
      const tmp = current[step];
      current[step] = current[5 - step];
      current[5 - step] = tmp;
      toContainer.querySelector('svg').outerHTML = renderHex(current, [step, 5 - step], 110);
      updateMeaning(relType, step, fromHex, toHex);
      step++;
    }, 400);
  } else {
    const changeList = relType === 'interlocking' ? [1, 2, 3, 4] : highlightIdxs;
    let stepIdx = 0;
    const current = [...fromLines];
    hint.textContent = '逐爻变化中…';
    const interval = setInterval(() => {
      if (stepIdx >= changeList.length) {
        clearInterval(interval);
        toContainer.querySelector('svg').outerHTML = renderHex(toLines, [], 110);
        const doneMsg = relType === 'opposite' ? '全部阴阳互换完成。' : (relType === 'interlocking' ? '内含之卦已显现。' : '变卦完成。');
        hint.textContent = doneMsg;
        if (meaning) {
          const summary = relType === 'opposite'
            ? '<span class="mn-note">错卦是每根爻阴阳全换——阳变阴、阴变阳。代表事物走向了对立面，如泰(通)变为否(塞)。</span>'
            : (relType === 'interlocking'
              ? '<span class="mn-note">互卦是取原卦的2-3-4爻为下卦、3-4-5爻为上卦，揭示事物内在的本质和发展趋势。</span>'
              : '<span class="mn-note">变卦是某根爻阴阳转化，代表事物发展的方向变化。</span>');
          meaning.innerHTML = summary;
        }
        playBtn.disabled = false;
        return;
      }
      const idx = changeList[stepIdx];
      current[idx] = toLines[idx];
      toContainer.querySelector('svg').outerHTML = renderHex(current, [idx], 110);
      updateMeaning(relType, idx, fromHex, toHex);
      stepIdx++;
    }, 500);
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
