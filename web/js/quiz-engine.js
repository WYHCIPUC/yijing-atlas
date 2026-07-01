// 测验引擎：从 64 卦数据生成题目、判分、错题收集。
// 纯逻辑模块，不碰 DOM。UI 层调用这些函数。
import { yaoLabel } from './hexagram-utils.js';

// ---- 题型定义 ----
// 1. 'image-to-name'：给卦象(SVG) → 选卦名（4选1）
// 2. 'name-to-image'：给卦名 → 选卦象（4选1）
// 3. 'yao-fill'：给爻辞上下文 → 填卦名/爻题（简化为选择题）

// 工具：从 hexagrams 中随机取 n 个不重复的
function sample(arr, n) {
  const pool = [...arr];
  const out = [];
  for (let i = 0; i < n && pool.length; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    out.push(pool.splice(idx, 1)[0]);
  }
  return out;
}

// 生成一道"卦象→卦名"题
function makeImageToName(hexagrams) {
  const [answer, ...distractors] = sample(hexagrams, 4);
  const options = sample([answer, ...distractors], 4); // 打乱
  return {
    type: 'image-to-name',
    prompt: '这是什么卦？',
    binaryCode: answer.binaryCode, // 用于渲染卦象
    options: options.map((h) => h.name),
    answer: answer.name,
  };
}

// 生成一道"卦名→卦象"题
function makeNameToImage(hexagrams) {
  const [answer, ...distractors] = sample(hexagrams, 4);
  const options = sample([answer, ...distractors], 4);
  return {
    type: 'name-to-image',
    prompt: `"${answer.name}"（${answer.fullName}）的卦象是？`,
    options: options.map((h) => h.binaryCode),
    answer: answer.binaryCode,
    answerName: answer.name,
  };
}

// 生成一道"爻辞→卦名"题（给一句爻辞，问出自哪一卦）
function makeYaoToName(hexagrams) {
  // 只用有爻辞的卦（第1期已全部填全）
  const [answer, ...distractors] = sample(hexagrams, 4);
  const yao = sample(answer.lines, 1)[0];
  const options = sample([answer, ...distractors], 4);
  return {
    type: 'yao-to-name',
    prompt: `爻辞"${yao.text}"出自哪一卦？`,
    options: options.map((h) => h.name),
    answer: answer.name,
  };
}

const MAKERS = [makeImageToName, makeNameToImage, makeYaoToName];

// 生成一套测验题（默认 10 题，题型混合）
export function generateQuiz(hexagrams, count = 10) {
  const quiz = [];
  for (let i = 0; i < count; i++) {
    const maker = MAKERS[i % MAKERS.length]; // 轮流出三种题型
    quiz.push(maker(hexagrams));
  }
  return quiz;
}

// 判分：用户选择是否正确
export function checkAnswer(question, userChoice) {
  return userChoice === question.answer;
}

// ============ 黄历题型 ============

// "术语释义"：给术语名，问其含义（4 选 1，选项是含义片段）
function makeTermMeaning(terms) {
  const pool = terms.filter((t) => t.meaning && t.meaning.length > 6);
  if (pool.length < 4) return null;
  const [answer, ...distractors] = sample(pool, 4);
  const options = sample([answer, ...distractors], 4);
  return {
    type: 'term-meaning',
    prompt: `黄历术语"${answer.name}"的含义是？`,
    options: options.map((t) => t.meaning),
    answer: answer.meaning,
    answerName: answer.name,
  };
}

// "术语归类"：给释义，问是哪个术语（4 选 1，选项是术语名）
function makeTermToName(terms) {
  const pool = terms.filter((t) => t.meaning && t.meaning.length > 6);
  if (pool.length < 4) return null;
  const [answer, ...distractors] = sample(pool, 4);
  const options = sample([answer, ...distractors], 4);
  // 截取释义前 30 字作题干，避免过长
  const brief = answer.meaning.length > 30 ? answer.meaning.slice(0, 30) + '…' : answer.meaning;
  return {
    type: 'term-to-name',
    prompt: `含义"${brief}"是哪个术语？`,
    options: options.map((t) => t.name),
    answer: answer.name,
  };
}

// "建除宜忌"：给建除值位名，问其所宜（4 选 1）
function makeJianChuYi(terms) {
  const pool = terms.filter((t) => t.category === '建除十二神' && t.yi && t.yi.length > 0);
  if (pool.length < 4) return null;
  const [answer, ...distractors] = sample(pool, 4);
  const options = sample([answer, ...distractors], 4);
  // 正确选项用 answer 的一个"宜"项，干扰项用其他值位的宜项
  const correctYi = sample(answer.yi, 1)[0];
  const wrongYi = distractors.map((d) => sample(d.yi, 1)[0]);
  const allOpts = sample([correctYi, ...wrongYi], 4);
  return {
    type: 'jianchu-yi',
    prompt: `建除"${answer.name}"日，宜做什么？`,
    options: allOpts,
    answer: correctYi,
  };
}

const ALMANAC_MAKERS = [makeTermMeaning, makeTermToName, makeJianChuYi];

// 生成一套黄历测验题
export function generateAlmanacQuiz(terms, count = 10) {
  const quiz = [];
  let i = 0;
  while (quiz.length < count && i < count * 3) {
    const maker = ALMANAC_MAKERS[quiz.length % ALMANAC_MAKERS.length];
    const q = maker(terms);
    if (q) quiz.push(q);
    i++;
  }
  return quiz;
}

// 简单洗牌（用于选项乱序，已在 maker 内处理）
export { sample };
