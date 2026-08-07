// 卦象音律引擎：八卦→五行→五音（宫商角徵羽）映射，Web Audio API 合成。
// 五行：金→商、木→角、水→羽、火→徵、土→宫
// 五音频率（C 调）：宫261.63(Do) 商293.66(Re) 角329.63(Mi) 徵392(Sol) 羽440(La)

// 八卦二进制 → 五行
const TRIGRAM_WUXING = {
  '111': 'metal',  // 乾 金
  '110': 'metal',  // 兑 金
  '101': 'fire',   // 离 火
  '100': 'wood',   // 震 木
  '011': 'wood',   // 巽 木
  '010': 'water',  // 坎 水
  '001': 'earth',  // 艮 土
  '000': 'earth',  // 坤 土
};

// 五行 → 五音频率
const WUXING_FREQ = {
  earth: 261.63,  // 宫 Do
  metal: 293.66,  // 商 Re
  wood: 329.63,   // 角 Mi
  fire: 392.00,   // 徵 Sol
  water: 440.00,  // 羽 La
};

const WUXING_NAME = { earth: '宫', metal: '商', wood: '角', fire: '徵', water: '羽' };
const SOUND_PREFERENCE_KEY = 'yijing-interface-sound';

let audioCtx = null;
const noiseBuffers = new Map();
let soundEnabled = null;
let activeMechanicalSound = null;

function getCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

export function isSoundEnabled() {
  if (soundEnabled !== null) return soundEnabled;
  try {
    soundEnabled = localStorage.getItem(SOUND_PREFERENCE_KEY) !== 'off';
  } catch {
    soundEnabled = true;
  }
  return soundEnabled;
}

export function setSoundEnabled(enabled) {
  soundEnabled = Boolean(enabled);
  try { localStorage.setItem(SOUND_PREFERENCE_KEY, soundEnabled ? 'on' : 'off'); } catch {}
  if (!soundEnabled) activeMechanicalSound?.stop();
  return soundEnabled;
}

export function resolveInterfaceCue({ classNames = [], dataset = {}, contexts = [], disabled = false, type = '' } = {}) {
  if (disabled) return null;
  const classes = new Set(Array.isArray(classNames) ? classNames : String(classNames).split(/\s+/));
  const areas = new Set(contexts);
  if (classes.has('audio-toggle') || classes.has('guaxu-spin') || dataset.guaxuRespin !== undefined) return null;
  if (classes.has('quiz-option')) {
    if (classes.has('quiz-correct')) return 'correct';
    if (classes.has('quiz-wrong')) return 'wrong';
    return 'tap';
  }
  if (classes.has('coin-cast') || classes.has('divine-again')) return 'coin';
  if (classes.has('mh-cast') || classes.has('mh-time')) return 'complete';
  if (dataset.rate !== undefined) {
    if (String(dataset.rate) === '2') return 'correct';
    if (String(dataset.rate) === '0') return 'wrong';
    return 'tap';
  }
  if (dataset.score !== undefined) {
    if (Number(dataset.score) >= 80) return 'correct';
    if (Number(dataset.score) <= 40) return 'wrong';
    return 'study';
  }
  if (dataset.evolutionAction === 'open' || dataset.guaxuOpen !== undefined ||
      classes.has('guaxu-open-detail') || classes.has('search-option') ||
      classes.has('relation-chip')) return 'navigate';
  if (dataset.evolutionLine !== undefined || dataset.evolutionPreset !== undefined ||
      dataset.evolutionPlayback !== undefined || dataset.evolutionAction !== undefined ||
      classes.has('rel-demo-btn') || classes.has('rel-anim-play')) return 'mechanism';
  if (areas.has('almanac')) return 'page';
  if (classes.has('flip-card') || classes.has('history-item') || type === 'summary') return 'page';
  if (classes.has('mode-btn') || classes.has('explore-tool') || classes.has('divine-tab') ||
      classes.has('quiz-next') || classes.has('quiz-mode-toggle')) return 'navigate';
  if (areas.has('assessment') && type === 'submit') return 'complete';
  if (areas.has('learning') || dataset.lessonCheck !== undefined || dataset.action !== undefined) return 'study';
  if (classes.has('zoom-btn') || classes.has('detail-close') || classes.has('detail-size') ||
      classes.has('note-save') || classes.has('share-hexagram') || classes.has('daily-enter') ||
      classes.has('review-back') || classes.has('history-clear') || classes.has('guaxu-close') ||
      classes.has('evolution-close') || classes.has('rel-anim-close') || classes.has('text-button')) return 'tap';
  return null;
}

function shortTone(ctx, {
  frequency,
  endFrequency = frequency,
  type = 'triangle',
  duration = 0.08,
  gainValue = 0.035,
  delay = 0,
}) {
  const start = ctx.currentTime + delay;
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  if (endFrequency !== frequency) oscillator.frequency.exponentialRampToValueAtTime(endFrequency, start + duration);
  gain.gain.setValueAtTime(0.001, start);
  gain.gain.exponentialRampToValueAtTime(gainValue, start + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.01);
}

function getNoiseBuffer(ctx, duration = 0.12, decayPower = 0) {
  const key = `${ctx.sampleRate}:${duration}:${decayPower}`;
  if (noiseBuffers.has(key)) return noiseBuffers.get(key);
  const length = Math.ceil(ctx.sampleRate * duration);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let index = 0; index < samples.length; index += 1) {
    const envelope = decayPower ? (1 - index / samples.length) ** decayPower : 1;
    samples[index] = (Math.random() * 2 - 1) * envelope;
  }
  noiseBuffers.set(key, buffer);
  return buffer;
}

function noiseBurst(ctx, {
  frequency = 900,
  endFrequency = frequency,
  duration = 0.045,
  gainValue = 0.035,
  delay = 0,
  q = 1.2,
  type = 'bandpass',
  decayPower = 3,
} = {}) {
  const start = ctx.currentTime + delay;
  const source = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  source.buffer = getNoiseBuffer(ctx, duration, decayPower);
  filter.type = type;
  filter.frequency.setValueAtTime(frequency, start);
  if (endFrequency !== frequency) filter.frequency.exponentialRampToValueAtTime(endFrequency, start + duration);
  filter.Q.value = q;
  gain.gain.setValueAtTime(0.001, start);
  gain.gain.exponentialRampToValueAtTime(gainValue, start + Math.min(0.004, duration / 4));
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  source.start(start);
  source.stop(start + duration);
}

function modalStrike(ctx, {
  baseFrequency,
  ratios = [1, 1.47, 2.09, 2.63],
  duration = 0.28,
  gainValue = 0.025,
  delay = 0,
}) {
  ratios.forEach((ratio, index) => {
    shortTone(ctx, {
      frequency: baseFrequency * ratio,
      endFrequency: baseFrequency * ratio * (index ? 0.992 : 0.975),
      type: 'sine',
      duration: duration * (1 - index * 0.12),
      gainValue: gainValue / (1 + index * 0.78),
      delay,
    });
  });
}

function playWoodClick(ctx, delay = 0, gainValue = 0.026) {
  noiseBurst(ctx, { frequency: 1280, endFrequency: 720, duration: 0.032, gainValue, delay, q: 0.8 });
  shortTone(ctx, { frequency: 205, endFrequency: 148, duration: 0.07, gainValue: gainValue * 0.72, delay });
}

function playPaperTurn(ctx) {
  noiseBurst(ctx, {
    frequency: 520,
    endFrequency: 1780,
    duration: 0.16,
    gainValue: 0.032,
    q: 0.65,
    decayPower: 0.7,
  });
  noiseBurst(ctx, {
    frequency: 2300,
    endFrequency: 820,
    duration: 0.12,
    gainValue: 0.016,
    delay: 0.055,
    q: 0.8,
    decayPower: 1.4,
  });
}

export function buildCoinImpactSequence() {
  const bases = [1460, 1690, 1575];
  const events = [];
  bases.forEach((baseFrequency, coinIndex) => {
    [
      { offset: coinIndex * 0.038, intensity: 1 },
      { offset: 0.112 + coinIndex * 0.041, intensity: 0.38 },
      { offset: 0.205 + coinIndex * 0.029, intensity: 0.15 },
    ].forEach(({ offset, intensity }, bounceIndex) => {
      events.push({
        delay: offset,
        baseFrequency: baseFrequency * (1 + bounceIndex * 0.035),
        intensity,
        primary: bounceIndex === 0,
      });
    });
  });
  return events.sort((left, right) => left.delay - right.delay);
}

function playCoinScatter(ctx) {
  buildCoinImpactSequence().forEach((impact) => {
    noiseBurst(ctx, {
      frequency: impact.baseFrequency * 1.7,
      endFrequency: impact.baseFrequency,
      duration: 0.032 + impact.intensity * 0.018,
      gainValue: 0.014 * impact.intensity,
      delay: impact.delay,
      q: 2.1,
    });
    modalStrike(ctx, {
      baseFrequency: impact.baseFrequency,
      duration: 0.12 + impact.intensity * 0.24,
      gainValue: 0.011 * impact.intensity,
      delay: impact.delay,
    });
    if (impact.primary) {
      shortTone(ctx, {
        frequency: 132 + impact.baseFrequency / 35,
        endFrequency: 86,
        duration: 0.065,
        gainValue: 0.01,
        delay: impact.delay,
      });
    }
  });
}

function playBell(ctx, frequency, delay = 0, gainValue = 0.025) {
  noiseBurst(ctx, { frequency: frequency * 4.8, duration: 0.018, gainValue: gainValue * 0.42, delay, q: 2.5 });
  modalStrike(ctx, {
    baseFrequency: frequency,
    ratios: [1, 2.01, 2.58, 3.9],
    duration: 0.62,
    gainValue,
    delay,
  });
}

export function playInterfaceSound(cue) {
  if (!isSoundEnabled()) return false;
  try {
    const ctx = getCtx();
    ctx.resume?.().catch?.(() => {});
    if (cue === 'tap') {
      playWoodClick(ctx);
    } else if (cue === 'navigate') {
      playWoodClick(ctx, 0, 0.018);
      modalStrike(ctx, { baseFrequency: 620, ratios: [1, 1.51], duration: 0.14, gainValue: 0.012, delay: 0.025 });
    } else if (cue === 'page') {
      playPaperTurn(ctx);
    } else if (cue === 'mechanism') {
      playWoodClick(ctx, 0, 0.032);
      modalStrike(ctx, { baseFrequency: 880, ratios: [1, 1.83], duration: 0.09, gainValue: 0.014 });
    } else if (cue === 'correct') {
      playBell(ctx, 523.25, 0, 0.021);
      playBell(ctx, 659.25, 0.085, 0.018);
    } else if (cue === 'wrong') {
      playWoodClick(ctx, 0, 0.034);
      shortTone(ctx, { frequency: 224, endFrequency: 152, duration: 0.16, gainValue: 0.028, delay: 0.025 });
    } else if (cue === 'coin') {
      playCoinScatter(ctx);
    } else if (cue === 'study') {
      playPaperTurn(ctx);
      modalStrike(ctx, { baseFrequency: 392, ratios: [1, 2], duration: 0.18, gainValue: 0.012, delay: 0.045 });
    } else if (cue === 'complete') {
      [392, 523.25, 659.25].forEach((frequency, index) => playBell(ctx, frequency, index * 0.075, 0.016));
    } else {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function bindInterfaceSounds(root = document) {
  const handler = (event) => {
    const element = event.target?.closest?.('button, label, summary');
    if (!element) return;
    const contexts = [];
    if (element.closest('.almanac-view, .alm-popup')) contexts.push('almanac');
    if (element.closest('.learning-panel, .study-path, .data-tools')) contexts.push('learning');
    if (element.closest('.assessment-sheet, .assessment-grid, .oral-review-card')) contexts.push('assessment');
    const cue = resolveInterfaceCue({
      classNames: [...element.classList],
      dataset: { ...element.dataset },
      contexts,
      disabled: Boolean(element.disabled),
      type: element.type || '',
    });
    if (cue) playInterfaceSound(cue);
  };
  root.addEventListener('click', handler);
  return () => root.removeEventListener('click', handler);
}

export function buildMechanicalTickTimes(durationMs = 3400) {
  if (!Number.isFinite(durationMs) || durationMs < 240) {
    throw new RangeError('机械转盘音效时长不能短于 240 毫秒');
  }
  const times = [0];
  let elapsed = 0;
  while (elapsed < durationMs - 90) {
    const progress = elapsed / durationMs;
    const interval = progress < 0.16
      ? 75 - 47 * (progress / 0.16)
      : 28 + 170 * ((progress - 0.16) / 0.84) ** 2.2;
    elapsed += interval;
    if (elapsed < durationMs - 70) times.push(Math.round(elapsed));
  }
  return times;
}

function playMechanicalLock(ctx) {
  noiseBurst(ctx, { frequency: 1850, endFrequency: 620, duration: 0.045, gainValue: 0.055, q: 1.1 });
  shortTone(ctx, { frequency: 168, endFrequency: 88, duration: 0.12, gainValue: 0.065 });
  modalStrike(ctx, { baseFrequency: 760, ratios: [1, 1.72, 2.44], duration: 0.18, gainValue: 0.018, delay: 0.008 });
  shortTone(ctx, { frequency: 112, endFrequency: 76, duration: 0.16, gainValue: 0.026, delay: 0.035 });
}

export function startMechanicalWheelSound(durationMs = 3400) {
  if (!isSoundEnabled()) return { stop() {}, finish() {} };
  try {
    activeMechanicalSound?.stop();
    const ctx = getCtx();
    ctx.resume?.().catch?.(() => {});
    const master = ctx.createGain();
    master.gain.value = 0.16;
    master.connect(ctx.destination);
    const sources = [];
    const startedAt = ctx.currentTime + 0.015;

    const hubSource = ctx.createBufferSource();
    const hubFilter = ctx.createBiquadFilter();
    const hubGain = ctx.createGain();
    hubSource.buffer = getNoiseBuffer(ctx, durationMs / 1000 + 0.08, 0.45);
    hubFilter.type = 'lowpass';
    hubFilter.frequency.value = 190;
    hubGain.gain.setValueAtTime(0.001, startedAt);
    hubGain.gain.exponentialRampToValueAtTime(0.07, startedAt + 0.12);
    hubGain.gain.exponentialRampToValueAtTime(0.001, startedAt + durationMs / 1000);
    hubSource.connect(hubFilter);
    hubFilter.connect(hubGain);
    hubGain.connect(master);
    hubSource.start(startedAt);
    hubSource.stop(startedAt + durationMs / 1000 + 0.02);
    sources.push(hubSource);

    buildMechanicalTickTimes(durationMs).forEach((milliseconds, index) => {
      const source = ctx.createBufferSource();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      const start = startedAt + milliseconds / 1000;
      source.buffer = getNoiseBuffer(ctx, 0.036, 4);
      source.playbackRate.value = 0.9 + (index % 5) * 0.035;
      filter.type = 'bandpass';
      filter.frequency.value = 1060 + (index % 6) * 117;
      filter.Q.value = 1.8;
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.exponentialRampToValueAtTime(index % 8 === 0 ? 0.88 : 0.55 + (index % 3) * 0.055, start + 0.002);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.03);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      source.start(start);
      source.stop(start + 0.034);
      sources.push(source);
    });

    let stopped = false;
    const stopTicks = () => {
      if (stopped) return;
      stopped = true;
      sources.forEach((source) => {
        try { source.stop(); } catch {}
      });
      master.disconnect();
    };
    const cleanupTimer = window.setTimeout(stopTicks, durationMs + 180);

    const controller = {
      stop() {
        window.clearTimeout(cleanupTimer);
        stopTicks();
        if (activeMechanicalSound === controller) activeMechanicalSound = null;
      },
      finish() {
        window.clearTimeout(cleanupTimer);
        stopTicks();
        playMechanicalLock(ctx);
        if (activeMechanicalSound === controller) activeMechanicalSound = null;
      },
    };
    activeMechanicalSound = controller;
    return controller;
  } catch {
    return { stop() {}, finish() {} };
  }
}

// 播放一个带非整数泛音的钟磬音，避免纯正弦波的电子感。
function playNote(freq, duration = 1.2, startTime = 0) {
  if (!isSoundEnabled()) return;
  const ctx = getCtx();
  noiseBurst(ctx, { frequency: freq * 5.2, duration: 0.024, gainValue: 0.012, delay: startTime, q: 3 });
  modalStrike(ctx, {
    baseFrequency: freq,
    ratios: [1, 2.01, 2.74, 4.08],
    duration,
    gainValue: 0.035,
    delay: startTime,
  });
}

// 由卦象播放音律：上下卦各发一声，叠五度泛音
export function playHexagramSound(binaryCode) {
  const lower = binaryCode.slice(0, 3);
  const upper = binaryCode.slice(3, 6);
  const lowerWx = TRIGRAM_WUXING[lower];
  const upperWx = TRIGRAM_WUXING[upper];
  const lowerFreq = WUXING_FREQ[lowerWx];
  const upperFreq = WUXING_FREQ[upperWx];
  // 下卦先响（低音），上卦后响（高音），形成和声
  playNote(lowerFreq, 1.8, 0);
  playNote(upperFreq, 1.8, 0.3);
  // 加一个五度泛音增添空灵感
  playNote(lowerFreq * 1.5, 1.5, 0.15);
  return { lower: WUXING_NAME[lowerWx], upper: WUXING_NAME[upperWx] };
}

// 预热音频上下文（需用户交互后才能播放）
export function initAudio() {
  getCtx();
}
