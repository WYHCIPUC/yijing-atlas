import {
  applyEvolutionPreset,
  changedEvolutionPositions,
  createEvolutionFrames,
  createEvolutionState,
  currentEvolutionCode,
  evolutionSnapshot,
  redoEvolution,
  resetEvolution,
  toggleEvolutionLine,
  undoEvolution,
} from './evolution-state.js';
import { yaoLabel } from './hexagram-utils.js';
import { hexagramSvg } from './svg-painter.js';

let overlayEl = null;
let activeSession = null;
let previousFocus = null;

const PLAYBACK_DELAYS = {
  slow: 900,
  normal: 550,
  fast: 260,
};

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function lineSymbol(isYang) {
  if (isYang) return '<span class="evolution-line-segment evolution-line-whole"></span>';
  return '<span class="evolution-line-segment"></span><span class="evolution-line-segment"></span>';
}

function renderInteractiveLines(snapshot, locked, activePosition) {
  return [6, 5, 4, 3, 2, 1].map((position) => {
    const isYang = snapshot.currentCode[position - 1] === '1';
    const changed = snapshot.changedPositions.includes(position);
    const label = yaoLabel(position, isYang);
    return `<button type="button" class="evolution-line${changed ? ' changed' : ''}${activePosition === position ? ' playback-current' : ''}"
      data-evolution-line="${position}" aria-pressed="${changed}"
      ${locked ? 'disabled' : ''}
      aria-label="${esc(label)}，${isYang ? '阳' : '阴'}爻，点击变为${isYang ? '阴' : '阳'}爻">
      <span class="evolution-line-mark ${isYang ? 'yang' : 'yin'}" aria-hidden="true">${lineSymbol(isYang)}</span>
      <span class="evolution-line-label">${esc(label)}</span>
    </button>`;
  }).join('');
}

function renderChangeNotes(session, snapshot) {
  if (!snapshot.changedPositions.length) {
    if (session.playback.frames.length > 1) {
      return '<p class="evolution-empty">已回到原卦。点击“播放”或“下一步”，逐爻观察变化。</p>';
    }
    return '<p class="evolution-empty">尚未发生变化。点击右侧任一爻，观察阴阳转换。</p>';
  }
  return `<ol class="evolution-change-list">${snapshot.changedPositions.map((position) => {
    const fromYang = session.baseHex.binaryCode[position - 1] === '1';
    const toYang = snapshot.currentCode[position - 1] === '1';
    const line = session.baseHex.lines?.[position - 1];
    return `<li>
      <strong>第 ${position} 爻</strong>
      <span>${fromYang ? '阳' : '阴'} → ${toYang ? '阳' : '阴'}</span>
      ${line?.text ? `<small>${esc(line.text)}</small>` : ''}
    </li>`;
  }).join('')}</ol>`;
}

function createPlayback(session, speed = session.playback?.speed || 'normal') {
  const targetCode = currentEvolutionCode(session.state);
  const frames = createEvolutionFrames(session.baseHex.binaryCode, targetCode);
  return {
    frames,
    index: frames.length - 1,
    isPlaying: false,
    speed,
    timer: null,
  };
}

function clearPlaybackTimer(session = activeSession) {
  if (!session?.playback.timer) return;
  window.clearTimeout(session.playback.timer);
  session.playback.timer = null;
}

function playbackView(session) {
  const target = evolutionSnapshot(session.state, session.hexagrams);
  const playback = session.playback;
  const currentCode = playback.frames[playback.index];
  return {
    ...target,
    currentCode,
    currentHexagram: session.hexagrams.find((hexagram) => hexagram.binaryCode === currentCode) || null,
    changedPositions: changedEvolutionPositions(target.baseCode, currentCode),
  };
}

function currentPlaybackPosition(playback) {
  if (playback.index === 0) return null;
  return changedEvolutionPositions(
    playback.frames[playback.index - 1],
    playback.frames[playback.index],
  )[0] || null;
}

function renderLab(focusSelector = null) {
  if (!overlayEl || !activeSession) return;
  const snapshot = playbackView(activeSession);
  const playback = activeSession.playback;
  const playbackTotal = playback.frames.length - 1;
  const playbackLocked = playback.index < playbackTotal;
  const playbackStatus = playbackLocked
    ? `演示第 ${playback.index}/${playbackTotal} 步`
    : `${snapshot.action} · 历史第 ${snapshot.step}/${snapshot.totalSteps} 步`;
  const result = snapshot.currentHexagram;
  const body = overlayEl.querySelector('.evolution-body');
  if (!body) return;
  body.innerHTML = `
    <div class="evolution-presets" role="group" aria-label="关系预设">
      <span>从原卦生成</span>
      <button type="button" data-evolution-preset="opposite" ${playbackLocked ? 'disabled' : ''}>错卦</button>
      <button type="button" data-evolution-preset="reversed" ${playbackLocked ? 'disabled' : ''}>综卦</button>
      <button type="button" data-evolution-preset="interlocking" ${playbackLocked ? 'disabled' : ''}>互卦</button>
    </div>
    <div class="evolution-stage">
      <figure class="evolution-figure evolution-original">
        <div class="evolution-static-hex">${hexagramSvg(snapshot.baseCode, { size: 150 })}</div>
        <figcaption><strong>${esc(activeSession.baseHex.name)}</strong><span>原卦 · ${snapshot.baseCode}</span></figcaption>
      </figure>
      <div class="evolution-direction" aria-hidden="true"><span>→</span><small>${snapshot.changedPositions.length} 爻变化</small></div>
      <figure class="evolution-figure evolution-result">
        <div class="evolution-lines" role="group" aria-label="可编辑六爻">${renderInteractiveLines(snapshot, playbackLocked, currentPlaybackPosition(playback))}</div>
        <figcaption><strong>${esc(result?.name || '未知卦')}</strong><span>结果 · ${snapshot.currentCode}</span></figcaption>
      </figure>
    </div>
    <section class="evolution-playback" aria-label="变化演示控制">
      <div class="evolution-playback-label">
        <strong>变化演示</strong>
        <span aria-live="polite">${playback.index}/${playbackTotal}</span>
      </div>
      <div class="evolution-playback-actions" role="group" aria-label="播放控制">
        <button type="button" data-evolution-playback="previous" ${playback.index === 0 || playbackTotal === 0 ? 'disabled' : ''} aria-label="上一步">←</button>
        <button type="button" class="evolution-play-toggle" data-evolution-playback="play" ${playbackTotal === 0 ? 'disabled' : ''}>${playback.isPlaying ? 'Ⅱ 暂停' : '▶ 播放'}</button>
        <button type="button" data-evolution-playback="next" ${playback.index >= playbackTotal ? 'disabled' : ''} aria-label="下一步">→</button>
      </div>
      <label class="evolution-speed">速度
        <select data-evolution-speed aria-label="演示速度">
          <option value="slow" ${playback.speed === 'slow' ? 'selected' : ''}>慢速</option>
          <option value="normal" ${playback.speed === 'normal' ? 'selected' : ''}>标准</option>
          <option value="fast" ${playback.speed === 'fast' ? 'selected' : ''}>快速</option>
        </select>
      </label>
    </section>
    <section class="evolution-explanation" aria-labelledby="evolution-change-title">
      <div class="evolution-explanation-head">
        <h3 id="evolution-change-title">变化说明</h3>
        <span aria-live="polite">${esc(playbackStatus)}</span>
      </div>
      ${renderChangeNotes(activeSession, snapshot)}
    </section>
    <div class="evolution-actions">
      <div class="evolution-history-actions" role="group" aria-label="演变历史">
        <button type="button" data-evolution-action="undo" ${snapshot.canUndo && !playbackLocked ? '' : 'disabled'}>↶ 撤销</button>
        <button type="button" data-evolution-action="redo" ${snapshot.canRedo && !playbackLocked ? '' : 'disabled'}>↷ 重做</button>
        <button type="button" data-evolution-action="reset" ${snapshot.currentCode !== snapshot.baseCode && !playbackLocked ? '' : 'disabled'}>重置</button>
      </div>
      <button type="button" class="evolution-open-result" data-evolution-action="open"
        ${result && snapshot.currentCode !== snapshot.baseCode && !playbackLocked ? '' : 'disabled'}>查看结果卦</button>
    </div>
  `;
  if (focusSelector) {
    window.requestAnimationFrame(() => overlayEl?.querySelector(focusSelector)?.focus());
  }
}

function updateState(nextState, focusSelector) {
  if (!activeSession || nextState === activeSession.state) return;
  clearPlaybackTimer();
  activeSession.state = nextState;
  activeSession.playback = createPlayback(activeSession);
  renderLab(focusSelector);
}

function schedulePlayback() {
  const session = activeSession;
  if (!session?.playback.isPlaying) return;
  const playback = session.playback;
  const lastIndex = playback.frames.length - 1;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    playback.index = lastIndex;
    playback.isPlaying = false;
    renderLab();
    return;
  }
  playback.timer = window.setTimeout(() => {
    if (activeSession !== session || !playback.isPlaying) return;
    playback.timer = null;
    playback.index += 1;
    if (playback.index >= lastIndex) playback.isPlaying = false;
    renderLab();
    schedulePlayback();
  }, PLAYBACK_DELAYS[playback.speed]);
}

function handlePlayback(action) {
  if (!activeSession) return;
  const playback = activeSession.playback;
  const lastIndex = playback.frames.length - 1;
  clearPlaybackTimer();
  if (action === 'play') {
    if (playback.isPlaying) {
      playback.isPlaying = false;
    } else {
      if (playback.index >= lastIndex) playback.index = 0;
      playback.isPlaying = true;
    }
  } else {
    playback.isPlaying = false;
    playback.index += action === 'previous' ? -1 : 1;
    playback.index = Math.max(0, Math.min(lastIndex, playback.index));
  }
  renderLab(`[data-evolution-playback="${action === 'play' ? 'play' : action}"]`);
  schedulePlayback();
}

function handleOverlayClick(event) {
  if (event.target === overlayEl || event.target.closest?.('.evolution-close')) {
    closeEvolutionLab();
    return;
  }
  if (!activeSession) return;
  const lineButton = event.target.closest?.('[data-evolution-line]');
  if (lineButton) {
    const position = Number.parseInt(lineButton.dataset.evolutionLine, 10);
    updateState(toggleEvolutionLine(activeSession.state, position), `[data-evolution-line="${position}"]`);
    return;
  }
  const presetButton = event.target.closest?.('[data-evolution-preset]');
  if (presetButton) {
    updateState(applyEvolutionPreset(activeSession.state, presetButton.dataset.evolutionPreset), `[data-evolution-preset="${presetButton.dataset.evolutionPreset}"]`);
    return;
  }
  const playbackButton = event.target.closest?.('[data-evolution-playback]');
  if (playbackButton && !playbackButton.disabled) {
    handlePlayback(playbackButton.dataset.evolutionPlayback);
    return;
  }
  const actionButton = event.target.closest?.('[data-evolution-action]');
  if (!actionButton || actionButton.disabled) return;
  const action = actionButton.dataset.evolutionAction;
  if (action === 'undo') updateState(undoEvolution(activeSession.state), '[data-evolution-action="undo"]');
  else if (action === 'redo') updateState(redoEvolution(activeSession.state), '[data-evolution-action="redo"]');
  else if (action === 'reset') updateState(resetEvolution(activeSession.state), '[data-evolution-action="reset"]');
  else if (action === 'open') {
    const code = currentEvolutionCode(activeSession.state);
    const onOpenHexagram = activeSession.onOpenHexagram;
    closeEvolutionLab();
    onOpenHexagram?.(code);
  }
}

function handleOverlayKeydown(event) {
  if (event.key === 'Escape') {
    event.preventDefault();
    closeEvolutionLab();
    return;
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && activeSession) {
    event.preventDefault();
    const next = event.shiftKey ? redoEvolution(activeSession.state) : undoEvolution(activeSession.state);
    updateState(next, event.shiftKey ? '[data-evolution-action="redo"]' : '[data-evolution-action="undo"]');
    return;
  }
  if (event.key !== 'Tab') return;
  const focusable = [...overlayEl.querySelectorAll('button:not(:disabled), select:not(:disabled)')];
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

function ensureOverlay() {
  if (overlayEl) return;
  overlayEl = document.createElement('div');
  overlayEl.className = 'evolution-overlay';
  overlayEl.setAttribute('aria-hidden', 'true');
  overlayEl.addEventListener('click', handleOverlayClick);
  overlayEl.addEventListener('change', (event) => {
    const speedSelect = event.target.closest?.('[data-evolution-speed]');
    if (!activeSession || !speedSelect || !PLAYBACK_DELAYS[speedSelect.value]) return;
    activeSession.playback.speed = speedSelect.value;
    if (activeSession.playback.isPlaying) {
      clearPlaybackTimer();
      schedulePlayback();
    }
  });
  overlayEl.addEventListener('keydown', handleOverlayKeydown);
  document.body.appendChild(overlayEl);
}

export function showEvolutionLab(baseHex, hexagrams, onOpenHexagram) {
  const initialState = createEvolutionState(baseHex?.binaryCode);
  ensureOverlay();
  previousFocus = document.activeElement;
  activeSession = {
    baseHex,
    hexagrams,
    onOpenHexagram,
    state: initialState,
  };
  activeSession.playback = createPlayback(activeSession);
  overlayEl.innerHTML = `
    <div class="evolution-card" role="dialog" aria-modal="true" aria-labelledby="evolution-title">
      <button type="button" class="evolution-close" aria-label="关闭卦象演变实验室">✕</button>
      <header class="evolution-header">
        <span>交互学习</span>
        <h2 id="evolution-title" tabindex="-1">卦象演变实验室</h2>
        <p>点击右侧六爻切换阴阳，观察卦象如何一步步转化。</p>
      </header>
      <div class="evolution-body"></div>
    </div>
  `;
  overlayEl.classList.add('open');
  overlayEl.setAttribute('aria-hidden', 'false');
  renderLab();
  overlayEl.querySelector('.evolution-close')?.focus();
}

export function closeEvolutionLab() {
  if (!overlayEl) return;
  clearPlaybackTimer();
  overlayEl.classList.remove('open');
  overlayEl.setAttribute('aria-hidden', 'true');
  activeSession = null;
  previousFocus?.focus?.();
  previousFocus = null;
}
