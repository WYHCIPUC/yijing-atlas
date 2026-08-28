// 阴阳流变动画：点击关系 chip 时，弹出浮层演示卦象如何变化。
// 错卦=逐爻翻转，综卦=整体倒转，互卦=高亮2-3-4/3-4-5爻重组，变卦=指定爻翻转。

let overlayEl = null;
let activeTimer = null;
let previousFocus = null;

const POSITION_NAMES = ['初', '二', '三', '四', '五', '上'];

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

function validateCode(code) {
  if (!/^[01]{6}$/.test(code)) throw new Error(`需要 6 位 0/1 串，得到: ${code}`);
}

function normalizedRelationType(relType) {
  return Object.hasOwn(REL_INFO, relType) ? relType : 'changing';
}

/**
 * 生成动画帧。保持纯函数，便于验证每种关系的转换过程。
 * 每个 frame 的 lines 均按自下而上的顺序存储。
 */
export function createRelationAnimationFrames(fromCode, toCode, relType) {
  validateCode(fromCode);
  validateCode(toCode);
  const type = normalizedRelationType(relType);
  const fromLines = codeToLines(fromCode);
  const toLines = codeToLines(toCode);
  const frames = [];

  if (type === 'reversed') {
    const current = [...fromLines];
    for (let i = 0; i < 3; i++) {
      [current[i], current[5 - i]] = [current[5 - i], current[i]];
      frames.push({ lines: [...current], highlightIdxs: [i, 5 - i], meaningIdx: i });
    }
    return frames;
  }

  if (type === 'interlocking') {
    const lowerComplete = [...fromLines];
    lowerComplete.splice(0, 3, ...toLines.slice(0, 3));
    frames.push({ lines: lowerComplete, highlightIdxs: [0, 1, 2], meaningIdx: 1 });
    frames.push({ lines: [...toLines], highlightIdxs: [3, 4, 5], meaningIdx: 2 });
    return frames;
  }

  const current = [...fromLines];
  for (let i = 0; i < 6; i++) {
    if (current[i] === toLines[i]) continue;
    current[i] = toLines[i];
    frames.push({ lines: [...current], highlightIdxs: [i], meaningIdx: i });
  }
  return frames;
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
  createRelationAnimationFrames(fromCode, toCode, relType);
  _ensureOverlay();
  cancelActiveAnimation();
  const type = normalizedRelationType(relType);
  const info = REL_INFO[type];
  const fromLines = codeToLines(fromCode);
  const toLines = codeToLines(toCode);

  // 计算高亮爻位（哪些爻变化了）
  const changedIdxs = [];
  for (let i = 0; i < 6; i++) {
    if (fromLines[i] !== toLines[i]) changedIdxs.push(i);
  }
  // 互卦特殊：高亮 2-3-4-5 爻（索引1-4）
  const interlockingIdxs = type === 'interlocking' ? [1, 2, 3, 4] : changedIdxs;

  overlayEl.innerHTML = `
    <div class="rel-anim-card" role="dialog" aria-modal="true" aria-labelledby="rel-anim-title">
      <button type="button" class="rel-anim-close" aria-label="关闭关系演示">✕</button>
      <div class="rel-anim-title">
        <span class="rel-anim-badge" id="rel-anim-title" style="background:${info.color}22;color:${info.color}">${info.name}</span>
        <span class="rel-anim-desc">${info.desc}</span>
      </div>
      <div class="rel-anim-stage">
        <div class="rel-anim-hex rel-anim-from">
          ${renderHex(fromLines, interlockingIdxs, 110)}
          <div class="rel-anim-name">${esc(fromName)}</div>
          <div class="rel-anim-label">原卦</div>
        </div>
        <div class="rel-anim-arrow" aria-hidden="true">→</div>
        <div class="rel-anim-hex rel-anim-to">
          ${renderHex(fromLines, interlockingIdxs, 110)}
          <div class="rel-anim-name">${esc(toName)}</div>
          <div class="rel-anim-label">目标</div>
        </div>
      </div>
      <p class="rel-anim-hint" aria-live="polite">点击「变化」观看演示</p>
      <div class="rel-anim-meaning" aria-live="polite"></div>
      <button type="button" class="rel-anim-play">▶ 变化</button>
    </div>
  `;
  if (!overlayEl.classList.contains('open')) previousFocus = document.activeElement;
  overlayEl.setAttribute('aria-hidden', 'false');
  overlayEl.classList.add('open');

  const closeButton = overlayEl.querySelector('.rel-anim-close');
  const playButton = overlayEl.querySelector('.rel-anim-play');
  closeButton.addEventListener('click', closeRelationAnimation);

  // 播放动画
  playButton.addEventListener('click', () => {
    playAnimation(type, fromCode, toCode, fromHex, toHex);
  });
  closeButton.focus();
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
  const el = overlayEl?.querySelector('.rel-anim-meaning');
  if (!el) return;
  const posName = POSITION_NAMES[idx];
  if (relType === 'opposite') {
    const fromYinYang = typeof fromHex?.lines?.[idx]?.isYang === 'boolean' ? (fromHex.lines[idx].isYang ? '阳' : '阴') : '';
    const toYinYang = typeof toHex?.lines?.[idx]?.isYang === 'boolean' ? (toHex.lines[idx].isYang ? '阳' : '阴') : '';
    el.innerHTML = `<span class="mn-pos">${posName}爻</span> 由<span class="mn-from">${fromYinYang}</span>变为<span class="mn-to">${toYinYang}</span><br><span class="mn-quote">「${esc(getYaoText(fromHex, idx))}」→「${esc(getYaoText(toHex, idx))}」</span>`;
  } else if (relType === 'reversed') {
    el.innerHTML = `<span class="mn-pos">${posName}爻</span>与<span class="mn-pos">${POSITION_NAMES[5-idx]}爻</span>互换位置<br><span class="mn-note">视角倒转，上下卦互换，所见不同。</span>`;
  } else if (relType === 'interlocking') {
    el.innerHTML = `<span class="mn-pos">${posName}爻</span>参与构成互卦<br><span class="mn-note">取2-3-4爻为下卦、3-4-5爻为上卦，用于比较卦中所含结构。</span>`;
  } else {
    el.innerHTML = `<span class="mn-pos">${posName}爻</span>发生变动<br><span class="mn-quote">「${esc(getYaoText(fromHex, idx))}」→「${esc(getYaoText(toHex, idx))}」</span>`;
  }
}

function completionContent(relType) {
  if (relType === 'opposite') return {
    hint: '全部阴阳互换完成。',
    summary: '错卦是每根爻阴阳全换——阳变阴、阴变阳。象数传统常用它比较结构上的相反条件，如泰与否；这不表示现实必然走向对立。',
  };
  if (relType === 'reversed') return {
    hint: '翻转完成。同一卦换个角度看，意义不同。',
    summary: '综卦是将原卦整体倒转——把卦倒过来看，会得到不同的卦象和含义。事物换个角度，意义便不同。',
  };
  if (relType === 'interlocking') return {
    hint: '内含之卦已显现。',
    summary: '互卦取原卦的2-3-4爻为下卦、3-4-5爻为上卦。部分传统用它考察卦中所含结构，不把它写成唯一的“内在本质”。',
  };
  return {
    hint: '变卦完成。',
    summary: '变卦是某根爻阴阳转化，代表事物发展的方向变化。',
  };
}

function cancelActiveAnimation() {
  if (activeTimer !== null) clearTimeout(activeTimer);
  activeTimer = null;
}

function finishAnimation(relType, toLines, elements) {
  cancelActiveAnimation();
  const content = completionContent(relType);
  const svg = elements.toContainer?.querySelector('svg');
  if (svg) svg.outerHTML = renderHex(toLines, [], 110);
  if (elements.hint) elements.hint.textContent = content.hint;
  if (elements.meaning) elements.meaning.innerHTML = `<span class="mn-note">${content.summary}</span>`;
  if (elements.playButton) elements.playButton.disabled = false;
}

// 播放变化动画
function playAnimation(relType, fromCode, toCode, fromHex, toHex) {
  cancelActiveAnimation();
  const frames = createRelationAnimationFrames(fromCode, toCode, relType);
  const toLines = codeToLines(toCode);
  const elements = {
    toContainer: overlayEl?.querySelector('.rel-anim-to'),
    hint: overlayEl?.querySelector('.rel-anim-hint'),
    playButton: overlayEl?.querySelector('.rel-anim-play'),
    meaning: overlayEl?.querySelector('.rel-anim-meaning'),
  };
  if (!elements.toContainer || !elements.hint || !elements.playButton) return;
  elements.playButton.disabled = true;
  if (elements.meaning) elements.meaning.innerHTML = '';

  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  if (reducedMotion || frames.length === 0) {
    finishAnimation(relType, toLines, elements);
    return;
  }

  elements.hint.textContent = relType === 'reversed' ? '上下翻转中…' : '逐爻变化中…';
  const frameDelay = relType === 'reversed' ? 400 : 500;
  const showFrame = (index) => {
    if (index >= frames.length) {
      finishAnimation(relType, toLines, elements);
      return;
    }
    const frame = frames[index];
    const svg = elements.toContainer.querySelector('svg');
    if (!svg) return;
    svg.outerHTML = renderHex(frame.lines, frame.highlightIdxs, 110);
    updateMeaning(relType, frame.meaningIdx, fromHex, toHex);
    activeTimer = setTimeout(() => {
      activeTimer = null;
      showFrame(index + 1);
    }, frameDelay);
  };
  showFrame(0);
}

export function closeRelationAnimation() {
  cancelActiveAnimation();
  if (!overlayEl) return;
  overlayEl.classList.remove('open');
  overlayEl.setAttribute('aria-hidden', 'true');
  previousFocus?.focus?.();
  previousFocus = null;
}

function _ensureOverlay() {
  if (overlayEl) return;
  overlayEl = document.createElement('div');
  overlayEl.className = 'rel-anim-overlay';
  overlayEl.setAttribute('aria-hidden', 'true');
  overlayEl.addEventListener('click', (event) => {
    if (event.target === overlayEl) closeRelationAnimation();
  });
  overlayEl.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeRelationAnimation();
      return;
    }
    if (event.key !== 'Tab') return;
    const buttons = [...overlayEl.querySelectorAll('button:not(:disabled)')];
    if (buttons.length === 0) return;
    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
  document.body.appendChild(overlayEl);
}
