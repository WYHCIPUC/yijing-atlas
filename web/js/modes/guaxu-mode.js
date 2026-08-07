import { createWheelSpin, normalizeDegrees } from '../guaxu-wheel.js';
import { startMechanicalWheelSound } from '../audio-engine.js';
import { hexagramSvg } from '../svg-painter.js';

let overlayEl = null;
let activeSession = null;
let previousFocus = null;

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function polarPoint(radius, degrees) {
  const radians = degrees * Math.PI / 180;
  return {
    x: 180 + Math.cos(radians) * radius,
    y: 180 + Math.sin(radians) * radius,
  };
}

function sectorPath(index, count) {
  const step = 360 / count;
  const start = polarPoint(164, index * step - 90 - step / 2);
  const end = polarPoint(164, index * step - 90 + step / 2);
  return `M 180 180 L ${start.x.toFixed(3)} ${start.y.toFixed(3)} A 164 164 0 0 1 ${end.x.toFixed(3)} ${end.y.toFixed(3)} Z`;
}

function renderWheel(hexagrams) {
  return `
    <svg class="guaxu-draw-wheel" viewBox="0 0 360 360" role="img" aria-label="文王六十四卦卦序随机转盘">
      <defs>
        <radialGradient id="guaxu-hub-glow">
          <stop offset="0" stop-color="#2b2630" />
          <stop offset="1" stop-color="#11172a" />
        </radialGradient>
        <filter id="guaxu-soft-glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="2.4" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <circle cx="180" cy="180" r="172" class="guaxu-wheel-rim" />
      <g class="guaxu-wheel-rotor">
        ${hexagrams.map((hexagram, index) => {
          const angle = index * (360 / hexagrams.length) - 90;
          const name = polarPoint(128, angle);
          const number = polarPoint(151, angle);
          return `
            <g class="guaxu-wheel-sector" data-wheel-index="${index}">
              <path d="${sectorPath(index, hexagrams.length)}" class="${index % 2 ? 'sector-even' : 'sector-odd'}" />
              <text x="${number.x}" y="${number.y}" text-anchor="middle" dominant-baseline="central"
                transform="rotate(${angle + 90}, ${number.x}, ${number.y})" class="guaxu-wheel-number">${hexagram.number}</text>
              <text x="${name.x}" y="${name.y}" text-anchor="middle" dominant-baseline="central"
                transform="rotate(${angle + 90}, ${name.x}, ${name.y})" class="guaxu-wheel-name">${esc(hexagram.name)}</text>
            </g>`;
        }).join('')}
      </g>
      <circle cx="180" cy="180" r="58" class="guaxu-wheel-hub" />
      <text x="180" y="174" text-anchor="middle" class="guaxu-wheel-hub-title">卦序</text>
      <text x="180" y="193" text-anchor="middle" class="guaxu-wheel-hub-sub">一卦一时</text>
      <path d="M180 5 L168 29 Q180 25 192 29 Z" class="guaxu-wheel-pointer" filter="url(#guaxu-soft-glow)" />
    </svg>`;
}

function resultPlaceholder() {
  return `
    <div class="guaxu-result-placeholder">
      <span>待抽</span>
      <h3>让卦序流转起来</h3>
      <p>点击“随机抽取一卦”，转盘将沿文王卦序旋转并停在其中一卦。结果只用于学习探索。</p>
      <ol><li>先看卦名与处境提示</li><li>再读卦辞与序卦脉络</li><li>需要时进入完整经文</li></ol>
    </div>`;
}

function renderResult(hexagram) {
  return `
    <article class="guaxu-result-card" aria-labelledby="guaxu-result-title">
      <div class="guaxu-result-kicker">本次抽得 · 第 ${hexagram.number} 卦</div>
      <div class="guaxu-result-identity">
        <div class="guaxu-result-symbol">${hexagramSvg(hexagram.binaryCode, { size: 82 })}</div>
        <div><h3 id="guaxu-result-title" tabindex="-1">${esc(hexagram.name)}</h3><p>${esc(hexagram.fullName)}</p></div>
      </div>
      ${hexagram.scenario ? `<p class="guaxu-result-scenario">${esc(hexagram.scenario)}</p>` : ''}
      <div class="guaxu-result-reading"><span>卦辞</span><p>${esc(hexagram.judgement)}</p></div>
      <div class="guaxu-result-reading"><span>序卦脉络</span><p>${esc(hexagram.orderRemark)}</p></div>
      <div class="guaxu-result-actions">
        <button type="button" class="guaxu-respin" data-guaxu-respin>再抽一次</button>
        <button type="button" class="guaxu-open-detail" data-guaxu-open>查看完整详解</button>
      </div>
    </article>`;
}

function focusableElements() {
  if (!overlayEl) return [];
  return [...overlayEl.querySelectorAll('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])')]
    .filter((element) => !element.hidden && element.getClientRects().length > 0);
}

function handleOverlayKeydown(event) {
  if (event.key === 'Escape') {
    event.preventDefault();
    closeGuaxuWheel();
    return;
  }
  if (event.key !== 'Tab') return;
  const focusable = focusableElements();
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function finishSpin(session, spin) {
  if (session !== activeSession || !overlayEl) return;
  const rotor = overlayEl.querySelector('.guaxu-wheel-rotor');
  session.animation?.cancel();
  session.animation = null;
  session.sound?.finish();
  session.sound = null;
  session.rotation = normalizeDegrees(spin.targetRotation);
  rotor.style.transform = `rotate(${session.rotation}deg)`;
  overlayEl.querySelectorAll('.guaxu-wheel-sector').forEach((sector, index) => {
    sector.classList.toggle('selected', index === spin.selectedIndex);
  });
  session.selected = session.hexagrams[spin.selectedIndex];
  session.spinning = false;
  overlayEl.querySelector('.guaxu-dialog').setAttribute('aria-busy', 'false');
  overlayEl.querySelector('.guaxu-spin').disabled = false;
  const result = overlayEl.querySelector('.guaxu-result');
  result.innerHTML = renderResult(session.selected);
  result.querySelector('[data-guaxu-respin]').addEventListener('click', spinWheel);
  result.querySelector('[data-guaxu-open]').addEventListener('click', () => {
    const code = session.selected.binaryCode;
    const openDetail = session.onOpenDetail;
    closeGuaxuWheel({ restoreFocus: false, immediate: true });
    openDetail(code);
  });
}

function spinWheel() {
  const session = activeSession;
  if (!session || session.spinning || !overlayEl) return;
  const spin = createWheelSpin({ currentRotation: session.rotation, count: session.hexagrams.length });
  const rotor = overlayEl.querySelector('.guaxu-wheel-rotor');
  const spinButton = overlayEl.querySelector('.guaxu-spin');
  session.spinning = true;
  session.selected = null;
  session.sound?.stop();
  session.sound = startMechanicalWheelSound(3400);
  spinButton.disabled = true;
  overlayEl.querySelector('.guaxu-dialog').setAttribute('aria-busy', 'true');
  overlayEl.querySelectorAll('.guaxu-wheel-sector').forEach((sector) => sector.classList.remove('selected'));
  overlayEl.querySelector('.guaxu-result').innerHTML = `
    <div class="guaxu-spinning-status" role="status"><span aria-hidden="true">☰</span><strong>卦序流转中</strong><p>六十四卦往来不穷，静候一卦停驻。</p></div>`;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reducedMotion || typeof rotor.animate !== 'function') {
    finishSpin(session, spin);
    return;
  }
  session.animation = rotor.animate([
    { transform: `rotate(${spin.startRotation}deg)` },
    { transform: `rotate(${spin.targetRotation}deg)` },
  ], {
    duration: 3400,
    easing: 'cubic-bezier(0.12, 0.72, 0.12, 1)',
    fill: 'forwards',
  });
  session.animation.finished.then(() => finishSpin(session, spin)).catch(() => {});
}

export function closeGuaxuWheel({ restoreFocus = true, immediate = false } = {}) {
  if (!overlayEl) return;
  const target = previousFocus;
  const closeCallback = activeSession?.onClose;
  activeSession?.animation?.cancel();
  activeSession?.sound?.stop();
  activeSession = null;
  document.removeEventListener('keydown', handleOverlayKeydown);
  const closingOverlay = overlayEl;
  overlayEl = null;
  previousFocus = null;
  closingOverlay.classList.remove('open');
  const remove = () => closingOverlay.remove();
  if (immediate || window.matchMedia('(prefers-reduced-motion: reduce)').matches) remove();
  else window.setTimeout(remove, 180);
  if (restoreFocus) (target?.isConnected ? target : document.getElementById('star-canvas'))?.focus();
  closeCallback?.();
}

export function showGuaxuWheel(hexagrams, onOpenDetail, onClose = () => {}) {
  closeGuaxuWheel({ restoreFocus: false, immediate: true });
  const sorted = [...hexagrams].sort((left, right) => left.number - right.number);
  if (sorted.length !== 64) throw new Error('卦序转盘需要完整的六十四卦数据');
  previousFocus = document.activeElement;
  activeSession = {
    hexagrams: sorted,
    onOpenDetail,
    onClose,
    rotation: 0,
    selected: null,
    spinning: false,
    animation: null,
    sound: null,
  };
  overlayEl = document.createElement('div');
  overlayEl.className = 'guaxu-overlay';
  overlayEl.innerHTML = `
    <section class="guaxu-dialog" role="dialog" aria-modal="true" aria-labelledby="guaxu-title" aria-describedby="guaxu-description" aria-busy="false">
      <button type="button" class="guaxu-close" aria-label="关闭卦序转盘">✕</button>
      <header class="guaxu-header"><span>观其会通</span><h2 id="guaxu-title">卦序转盘</h2><p id="guaxu-description">循文王六十四卦之序，随机抽取一卦作为本次研读入口。</p></header>
      <div class="guaxu-body">
        <div class="guaxu-wheel-stage">
          <div class="guaxu-wheel-frame">${renderWheel(sorted)}</div>
          <button type="button" class="guaxu-spin">随机抽取一卦</button>
          <p class="guaxu-disclaimer">随机结果仅用于学习探索，不用于决策或预测。</p>
        </div>
        <div class="guaxu-result" aria-live="polite">${resultPlaceholder()}</div>
      </div>
    </section>`;
  document.body.appendChild(overlayEl);
  window.requestAnimationFrame(() => overlayEl?.classList.add('open'));
  overlayEl.querySelector('.guaxu-close').addEventListener('click', () => closeGuaxuWheel());
  overlayEl.addEventListener('click', (event) => {
    if (event.target !== overlayEl) return;
    closeGuaxuWheel();
  });
  overlayEl.querySelector('.guaxu-spin').addEventListener('click', spinWheel);
  document.addEventListener('keydown', handleOverlayKeydown);
  overlayEl.querySelector('.guaxu-spin').focus();
}

export function isGuaxuWheelOpen() {
  return Boolean(overlayEl?.classList.contains('open'));
}
