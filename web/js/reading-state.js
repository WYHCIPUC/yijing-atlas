// 阅读呈现与正式阅读互相独立；持久化仍由既有成就、复习模块负责。
const sections = new Set(['overview', 'judgement', 'commentary', 'lines', 'relations']);
const isCode = (code) => typeof code === 'string' && /^[01]{6}$/.test(code);

export function createReadingState() {
  return { focusedCode: null, readingCode: null, stage: 'none', section: 'overview' };
}

export function transitionReading(current, action) {
  if (action.type === 'section') {
    return sections.has(action.section) ? { ...current, section: action.section } : current;
  }
  if (action.type === 'clear') return createReadingState();
  if (action.type === 'close') {
    return { ...current, readingCode: null, stage: 'none' };
  }
  if (action.type === 'back') {
    if (current.stage === 'deep') return { ...current, stage: 'quick' };
    if (current.stage === 'quick') return transitionReading(current, { type: 'close' });
    return createReadingState();
  }
  if (!['focus', 'quick', 'deep'].includes(action.type)) return current;
  const code = action.code === undefined ? current.focusedCode : action.code;
  if (!isCode(code)) return current;
  return {
    focusedCode: code,
    readingCode: action.type === 'focus' ? null : code,
    stage: action.type === 'focus' ? 'none' : action.type,
    section: code === current.focusedCode ? current.section : 'overview',
  };
}

export function shouldRecordDeepRead(previous, next) {
  return next.stage === 'deep' && isCode(next.readingCode)
    && (previous.stage !== 'deep' || previous.readingCode !== next.readingCode);
}
