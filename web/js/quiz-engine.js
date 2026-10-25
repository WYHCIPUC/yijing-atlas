// 测验引擎：出题 + 判题 + 错题记录。
// 题型：错卦辨识、综卦辨识、互卦辨识、卦名辨识。
import { allRelations } from './hexagram-utils.js';
import { isPlainObject, readJson, removeStored, writeJson } from './storage.js';

const QUESTION_TYPES = ['opposite', 'reversed', 'interlocking', 'name'];
const TERM_DIRECTIONS = ['name-to-meaning', 'meaning-to-name'];
const isText = (value, limit) => typeof value === 'string' && value.trim().length > 0 && value.length <= limit;

function quizReference(type, code) {
  return { sourceKind: 'quiz', questionId: `quiz:${type}:${code}`, questionVersion: 'quiz-v1',
    questionType: type, targetCode: code, termId: null, lessonId: null };
}

function termReference(direction, termId) {
  return { sourceKind: 'almanac', questionId: `almanac:${termId}:${direction}`, questionVersion: 'almanac-v1',
    questionType: direction, targetCode: null, termId, lessonId: null };
}

// 生成一道题
// type: 'opposite' | 'reversed' | 'interlocking' | 'name'
export function generateQuestion(hexagrams, type = null, targetCode = null) {
  if (!Array.isArray(hexagrams) || (type !== null && !QUESTION_TYPES.includes(type))) return null;
  hexagrams = [...new Map(hexagrams.filter(hex => CODE_PATTERN.test(hex?.binaryCode || '') &&
    isText(hex.name, 160) && isText(hex.fullName, 160)).map(hex => [hex.binaryCode, hex])).values()];
  if (hexagrams.length < 4) return null;
  const types = type ? [type] : QUESTION_TYPES;
  const qType = types[Math.floor(Math.random() * types.length)];
  const target = targetCode !== null ? hexagrams.find(hexagram => hexagram.binaryCode === targetCode) :
    hexagrams[Math.floor(Math.random() * hexagrams.length)];
  if (!target) return null;
  const rels = allRelations(target.binaryCode);

  let question, answer, candidates;
  if (qType === 'opposite') {
    answer = rels.opposite;
    question = `「${target.name}」的错卦（阴阳全换）是？`;
  } else if (qType === 'reversed') {
    answer = rels.reversed;
    question = `「${target.name}」的综卦（上下倒转）是？`;
  } else if (qType === 'interlocking') {
    answer = rels.interlocking;
    question = `「${target.name}」的互卦（内含之卦）是？`;
  } else {
    answer = target.binaryCode;
    question = `哪个卦是「${target.fullName}」？`;
  }

  if (!hexagrams.some(hex => hex.binaryCode === answer)) return null;
  // 生成 3 个干扰项 + 正确答案，打乱
  const allCodes = hexagrams.map(h => h.binaryCode).filter(c => c !== answer);
  const distractors = [];
  while (distractors.length < 3 && allCodes.length > 0) {
    const idx = Math.floor(Math.random() * allCodes.length);
    const c = allCodes.splice(idx, 1)[0];
    if (!distractors.includes(c)) distractors.push(c);
  }
  candidates = [answer, ...distractors].sort(() => Math.random() - 0.5);

  const answerHex = hexagrams.find((hexagram) => hexagram.binaryCode === answer);
  const explanations = {
    opposite: `错卦要把「${target.name}」六爻的阴阳全部翻转，因此得到「${answerHex?.name || answer}」。`,
    reversed: `综卦要把「${target.name}」的六爻上下倒置，因此得到「${answerHex?.name || answer}」。`,
    interlocking: `互卦取原卦第 2—4 爻组成下卦、第 3—5 爻组成上卦，因此「${target.name}」内含「${answerHex?.name || answer}」。`,
    name: `「${target.fullName}」的六爻编码是 ${target.binaryCode}，对应「${target.name}」卦。`,
  };

  return {
    type: qType,
    question,
    answer,
    candidates,
    targetCode: target.binaryCode,
    explanation: explanations[qType],
    reference: quizReference(qType, target.binaryCode),
  };
}

// 判题
export function checkAnswer(question, pickedCode) {
  return pickedCode === question.answer;
}

// 错题本（localStorage）
const WRONG_KEY = 'yijing-quiz-wrong';
const CODE_PATTERN = /^[01]{6}$/;

export function isWrongBook(value) {
  return Array.isArray(value) && value.every((code) => CODE_PATTERN.test(code));
}

export function isQuizStats(value) {
  return getQuizStatsError(value) === null;
}

function isStatsBase(value) {
  return isPlainObject(value) && Number.isSafeInteger(value.total) && value.total >= 0 &&
    Number.isSafeInteger(value.correct) && value.correct >= 0 && value.correct <= value.total;
}

export function getQuizStatsError(value) {
  if (!isPlainObject(value) || !Number.isSafeInteger(value.total) || value.total < 0) return 'total';
  if (!Number.isSafeInteger(value.correct) || value.correct < 0 || value.correct > value.total) return 'correct';
  if (value.attempts === undefined) return null;
  if (!isPlainObject(value.attempts)) return 'attempts';
  for (const [id, entry] of Object.entries(value.attempts)) {
    const at = `attempts[${id}]`;
    if (!isText(id, 120) || !isPlainObject(entry)) return at;
    if (!isText(entry.questionId, 160)) return `${at}.questionId`;
    if (typeof entry.correct !== 'boolean') return `${at}.correct`;
    if (Object.keys(entry).some(key => !['questionId', 'correct'].includes(key))) return at;
  }
  return null;
}

export function loadWrongBook(storage) {
  const values = readJson(
    WRONG_KEY,
    [],
    isWrongBook,
    storage,
  );
  return [...new Set(values)];
}

export function addWrong(code, storage) {
  if (!CODE_PATTERN.test(code || '')) return false;
  const list = loadWrongBook(storage);
  if (list.includes(code)) return true;
  return writeJson(WRONG_KEY, [...list, code], storage).ok;
}

export function removeWrong(code, storage) {
  const list = loadWrongBook(storage);
  if (!list.includes(code)) return true;
  return writeJson(WRONG_KEY, list.filter((item) => item !== code), storage).ok;
}

export function clearWrongBook(storage) {
  return removeStored(WRONG_KEY, storage).ok;
}

// 统计
const STATS_KEY = 'yijing-quiz-stats';
export function loadStats(storage) {
  return readJson(
    STATS_KEY,
    { total: 0, correct: 0 },
    isStatsBase,
    storage,
  );
}

export function recordResult(correct, storage, options = {}) {
  const previous = loadStats(storage);
  const failed = error => ({ ...previous, saved: false, duplicate: false, error });
  if (!isPlainObject(options)) return failed(new Error('测验提交参数无效'));
  const identified = options.attemptId !== undefined || options.questionId !== undefined;
  if (typeof correct !== 'boolean' || (identified &&
      (!isText(options.attemptId, 120) || !isText(options.questionId, 160)))) return failed(new Error('测验提交标识无效'));
  try {
    const target = storage || globalThis.localStorage;
    if (!target) return failed(new Error('当前环境不支持本地存储'));
    const raw = target.getItem(STATS_KEY);
    const stored = raw === null ? { total: 0, correct: 0 } : JSON.parse(raw);
    if (!isQuizStats(stored)) return failed(new Error('统计记录异常，请先备份核对'));
    const receipt = identified && stored.attempts && Object.hasOwn(stored.attempts, options.attemptId)
      ? stored.attempts[options.attemptId] : null;
    if (receipt) return receipt.correct === correct && receipt.questionId === options.questionId
      ? { ...stored, saved: true, duplicate: true, error: null } : failed(new Error('提交标识与已有结果冲突'));
    const stats = { ...stored, total: stored.total + 1, correct: stored.correct + (correct ? 1 : 0),
      ...(identified ? { attempts: { ...stored.attempts,
        [options.attemptId]: { questionId: options.questionId, correct } } } : {}) };
    if (!isQuizStats(stats)) return failed(new Error('统计已达到可保存范围'));
    const result = writeJson(STATS_KEY, stats, target);
    return result.ok ? { ...stats, saved: true, duplicate: false, error: null } : failed(result.error);
  } catch (error) {
    return failed(error);
  }
}

// 黄历术语题：给术语名称，选其含义（或反过来）
export function generateAlmanacQuestion(terms, options = {}) {
  if (!isPlainObject(options)) return null;
  const { termId = null, direction = null } = options;
  if (!Array.isArray(terms) || (direction !== null && !TERM_DIRECTIONS.includes(direction))) return null;
  terms = [...new Map(terms.filter(term => isText(term?.id, 120) && isText(term.name, 160) &&
    typeof term.meaning === 'string' && term.meaning.trim()).map(term => [term.id, term])).values()];
  if (terms.length < 4) return null;
  const target = termId !== null ? terms.find(term => term.id === termId) : terms[Math.floor(Math.random() * terms.length)];
  if (!target) return null;
  // 题型：给名称选含义，或给含义选名称
  const reverse = direction ? direction === 'meaning-to-name' : Math.random() < 0.5;
  // 取含义前 20 字作为选项（避免太长）
  const shortMeaning = (target.meaning || '').slice(0, 18);
  // 生成 3 个干扰项
  const others = terms.filter(t => t.id !== target.id).sort(() => Math.random() - 0.5).slice(0, 3);
  const answerObj = reverse
    ? { text: target.name, code: target.id }
    : { text: shortMeaning, code: target.id };
  const distractors = others.map(t => reverse
    ? { text: t.name, code: t.id }
    : { text: (t.meaning || '').slice(0, 18), code: t.id });
  const candidates = [answerObj, ...distractors].sort(() => Math.random() - 0.5);
  return {
    type: 'almanac',
    question: reverse ? `「${shortMeaning}…」是哪个黄历术语？` : `黄历术语「${target.name}」（${target.category}）的含义是？`,
    answer: target.id,
    answerText: target.name,
    candidates,
    explanation: `${target.name}属于“${target.category}”。${target.meaning || '可回到黄历知识页继续辨析这一术语。'}`,
    reference: termReference(reverse ? 'meaning-to-name' : 'name-to-meaning', target.id),
  };
}

export function resolveQuizQuestion(appState, reference) {
  const unavailable = { ok: false, reason: '原题来源或版本暂不可用，请返回温故核对；不会用随机题替代。' };
  if (!isPlainObject(reference) || reference.lessonId !== null) return unavailable;
  let expected;
  let question;
  if (reference.sourceKind === 'quiz' && QUESTION_TYPES.includes(reference.questionType) &&
      CODE_PATTERN.test(reference.targetCode || '') && reference.termId === null) {
    expected = quizReference(reference.questionType, reference.targetCode);
    question = () => generateQuestion(appState?.hexagrams, reference.questionType, reference.targetCode);
  } else if (reference.sourceKind === 'almanac' && TERM_DIRECTIONS.includes(reference.questionType) &&
      isText(reference.termId, 120) && reference.targetCode === null) {
    expected = termReference(reference.questionType, reference.termId);
    question = () => generateAlmanacQuestion(appState?.almanacTerms, { termId: reference.termId, direction: reference.questionType });
  } else return unavailable;
  if (Object.keys(expected).some(field => expected[field] !== reference[field])) return unavailable;
  const resolved = question();
  return resolved ? { ok: true, question: resolved } : unavailable;
}
