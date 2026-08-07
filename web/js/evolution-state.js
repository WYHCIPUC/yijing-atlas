import {
  changingCode,
  interlockingCode,
  oppositeCode,
  reversedCode,
} from './hexagram-utils.js';

const PRESET_TRANSFORMS = {
  opposite: { label: '错卦', transform: oppositeCode },
  reversed: { label: '综卦', transform: reversedCode },
  interlocking: { label: '互卦', transform: interlockingCode },
};

function validateCode(code) {
  if (!/^[01]{6}$/.test(code)) throw new Error(`需要 6 位 0/1 串，得到: ${code}`);
}

function validateState(state) {
  if (!state || !Array.isArray(state.steps) || !Number.isInteger(state.cursor)) {
    throw new Error('无效的演变状态');
  }
  validateCode(state.baseCode);
  if (!state.steps[state.cursor]) throw new Error('演变历史游标越界');
}

function commitEvolution(state, code, action) {
  validateState(state);
  validateCode(code);
  if (code === currentEvolutionCode(state)) return state;
  const steps = state.steps.slice(0, state.cursor + 1);
  steps.push({ code, action });
  return { baseCode: state.baseCode, steps, cursor: steps.length - 1 };
}

export function createEvolutionState(baseCode) {
  validateCode(baseCode);
  return {
    baseCode,
    steps: [{ code: baseCode, action: '原卦' }],
    cursor: 0,
  };
}

export function currentEvolutionCode(state) {
  validateState(state);
  return state.steps[state.cursor].code;
}

export function toggleEvolutionLine(state, position) {
  const code = changingCode(currentEvolutionCode(state), position);
  return commitEvolution(state, code, `第 ${position} 爻变`);
}

export function applyEvolutionPreset(state, preset) {
  validateState(state);
  const config = PRESET_TRANSFORMS[preset];
  if (!config) throw new Error(`未知演变预设: ${preset}`);
  return commitEvolution(state, config.transform(state.baseCode), config.label);
}

export function undoEvolution(state) {
  validateState(state);
  if (state.cursor === 0) return state;
  return { ...state, cursor: state.cursor - 1 };
}

export function redoEvolution(state) {
  validateState(state);
  if (state.cursor >= state.steps.length - 1) return state;
  return { ...state, cursor: state.cursor + 1 };
}

export function resetEvolution(state) {
  validateState(state);
  return commitEvolution(state, state.baseCode, '重置为原卦');
}

export function changedEvolutionPositions(baseCode, currentCode) {
  validateCode(baseCode);
  validateCode(currentCode);
  return [...baseCode]
    .map((value, index) => value === currentCode[index] ? 0 : index + 1)
    .filter(Boolean);
}

export function createEvolutionFrames(baseCode, targetCode) {
  validateCode(baseCode);
  validateCode(targetCode);
  const frames = [baseCode];
  let currentCode = baseCode;
  changedEvolutionPositions(baseCode, targetCode).forEach((position) => {
    currentCode = changingCode(currentCode, position);
    frames.push(currentCode);
  });
  return frames;
}

export function evolutionSnapshot(state, hexagrams = []) {
  validateState(state);
  const currentCode = currentEvolutionCode(state);
  return {
    baseCode: state.baseCode,
    currentCode,
    currentHexagram: hexagrams.find((hexagram) => hexagram.binaryCode === currentCode) || null,
    changedPositions: changedEvolutionPositions(state.baseCode, currentCode),
    canUndo: state.cursor > 0,
    canRedo: state.cursor < state.steps.length - 1,
    action: state.steps[state.cursor].action,
    step: state.cursor,
    totalSteps: state.steps.length - 1,
  };
}
