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

let audioCtx = null;

function getCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

// 播放一个音符（正弦波 + 包络）
function playNote(freq, duration = 1.2, startTime = 0) {
  const ctx = getCtx();
  const t0 = ctx.currentTime + startTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  // 包络：快速起音，缓慢衰减（古琴/钟磬感）
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(0.25, t0 + 0.05);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + duration);
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
