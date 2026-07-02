// 测验引擎：出题 + 判题 + 错题记录。
// 题型：错卦辨识、综卦辨识、卦象→卦名、上下卦拆解。
import { allRelations } from './hexagram-utils.js';

// 生成一道题
// type: 'opposite' | 'reversed' | 'interlocking' | 'name'
export function generateQuestion(hexagrams, type = null) {
  const types = type ? [type] : ['opposite', 'reversed', 'interlocking', 'name'];
  const qType = types[Math.floor(Math.random() * types.length)];
  const target = hexagrams[Math.floor(Math.random() * hexagrams.length)];
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

  // 生成 3 个干扰项 + 正确答案，打乱
  const allCodes = hexagrams.map(h => h.binaryCode).filter(c => c !== answer);
  const distractors = [];
  while (distractors.length < 3 && allCodes.length > 0) {
    const idx = Math.floor(Math.random() * allCodes.length);
    const c = allCodes.splice(idx, 1)[0];
    if (!distractors.includes(c)) distractors.push(c);
  }
  candidates = [answer, ...distractors].sort(() => Math.random() - 0.5);

  return { type: qType, question, answer, candidates, targetCode: target.binaryCode };
}

// 判题
export function checkAnswer(question, pickedCode) {
  return pickedCode === question.answer;
}

// 错题本（localStorage）
const WRONG_KEY = 'yijing-quiz-wrong';
export function loadWrongBook() {
  try { return JSON.parse(localStorage.getItem(WRONG_KEY) || '[]'); } catch (e) { return []; }
}
export function addWrong(code) {
  const list = loadWrongBook();
  if (!list.includes(code)) { list.push(code); localStorage.setItem(WRONG_KEY, JSON.stringify(list)); }
}
export function clearWrongBook() { localStorage.removeItem(WRONG_KEY); }

// 统计
const STATS_KEY = 'yijing-quiz-stats';
export function loadStats() {
  try { return JSON.parse(localStorage.getItem(STATS_KEY) || '{"total":0,"correct":0}'); } catch (e) { return {total:0,correct:0}; }
}
export function recordResult(correct) {
  const s = loadStats();
  s.total++;
  if (correct) s.correct++;
  localStorage.setItem(STATS_KEY, JSON.stringify(s));
  return s;
}
