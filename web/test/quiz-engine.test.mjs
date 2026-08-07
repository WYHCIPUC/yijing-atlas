import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addWrong,
  checkAnswer,
  clearWrongBook,
  generateAlmanacQuestion,
  generateQuestion,
  loadStats,
  loadWrongBook,
  recordResult,
  removeWrong,
} from '../js/quiz-engine.js';
import { allRelations } from '../js/hexagram-utils.js';

function storageMock() {
  const data = new Map();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  };
}

const hexagrams = Array.from({ length: 64 }, (_, index) => {
  const binaryCode = index.toString(2).padStart(6, '0');
  return { binaryCode, name: `卦${index}`, fullName: `测试卦${index}` };
});

test.beforeEach(() => { globalThis.localStorage = storageMock(); });

for (const type of ['opposite', 'reversed', 'interlocking', 'name']) {
  test(`生成 ${type} 题时答案和候选项完整`, () => {
    const question = generateQuestion(hexagrams, type);
    assert.equal(question.candidates.length, 4);
    assert.equal(new Set(question.candidates).size, 4);
    assert.ok(question.candidates.includes(question.answer));
    const relations = allRelations(question.targetCode);
    const expected = type === 'name' ? question.targetCode : relations[type];
    assert.equal(question.answer, expected);
    assert.equal(checkAnswer(question, expected), true);
  });
}

test('黄历题生成四个带稳定 id 的候选项', () => {
  const terms = Array.from({ length: 6 }, (_, index) => ({
    id: `term-${index}`,
    name: `术语${index}`,
    category: '测试',
    meaning: `这是第${index}个术语的完整释义`,
  }));
  const question = generateAlmanacQuestion(terms);
  assert.equal(question.type, 'almanac');
  assert.equal(question.candidates.length, 4);
  assert.ok(question.candidates.some((candidate) => candidate.code === question.answer));
});

test('黄历题不足四项时拒绝出题', () => {
  assert.equal(generateAlmanacQuestion([{ id: 'only' }]), null);
});

test('黄历正向与反向题均使用同一稳定答案 id', () => {
  const terms = Array.from({ length: 4 }, (_, index) => ({
    id: `id-${index}`, name: `术语${index}`, category: '测试', meaning: `释义${index}`,
  }));
  const original = Math.random;
  try {
    Math.random = () => 0;
    const reverse = generateAlmanacQuestion(terms);
    assert.match(reverse.question, /是哪个黄历术语/);
    assert.ok(reverse.candidates.some((item) => item.code === reverse.answer));
    Math.random = () => 0.9;
    const forward = generateAlmanacQuestion(terms);
    assert.match(forward.question, /的含义是/);
    assert.ok(forward.candidates.some((item) => item.code === forward.answer));
  } finally {
    Math.random = original;
  }
});

test('统计与错题本可持久化且忽略空 id', () => {
  assert.equal(recordResult(true).saved, true);
  recordResult(false);
  assert.deepEqual(loadStats(), { total: 2, correct: 1 });
  addWrong('111111');
  addWrong('111111');
  addWrong(undefined);
  assert.deepEqual(loadWrongBook(), ['111111']);
  assert.equal(removeWrong('111111'), true);
  assert.deepEqual(loadWrongBook(), []);
  addWrong('000000');
  assert.equal(clearWrongBook(), true);
  assert.deepEqual(loadWrongBook(), []);
});

test('损坏的本地统计和错题数据会安全回退', () => {
  globalThis.localStorage = {
    getItem: () => '{broken',
    setItem: () => {},
    removeItem: () => {},
  };
  assert.deepEqual(loadStats(), { total: 0, correct: 0 });
  assert.deepEqual(loadWrongBook(), []);
});

test('错题回练可指定目标卦，非法结构和写入失败安全回退', () => {
  const question = generateQuestion(hexagrams, 'name', '111111');
  assert.equal(question.targetCode, '111111');
  globalThis.localStorage = {
    getItem: (key) => key.includes('wrong') ? '["bad"]' : '{"total":1,"correct":3}',
    setItem: () => { throw new Error('quota'); },
    removeItem: () => { throw new Error('blocked'); },
  };
  assert.deepEqual(loadWrongBook(), []);
  assert.deepEqual(loadStats(), { total: 0, correct: 0 });
  assert.equal(addWrong('111111'), false);
  assert.equal(removeWrong('111111'), true);
  assert.equal(clearWrongBook(), false);
  assert.equal(recordResult(true).saved, false);
});
