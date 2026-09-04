import assert from 'node:assert/strict';
import test from 'node:test';
import { castHexagram, getReading, tossCoins } from '../js/divination-engine.js';

function withRandom(values, callback) {
  const original = Math.random;
  let index = 0;
  Math.random = () => values[index++ % values.length];
  try { return callback(); } finally { Math.random = original; }
}

test('铜钱和数正确映射四种爻象', () => {
  assert.deepEqual(withRandom([0.1, 0.1, 0.1], tossCoins), {
    value: 0, isYang: false, changing: true, name: '老阴', coins: [2, 2, 2],
  });
  assert.equal(withRandom([0.9, 0.1, 0.1], tossCoins).name, '少阳');
  assert.equal(withRandom([0.9, 0.9, 0.1], tossCoins).name, '少阴');
  assert.equal(withRandom([0.9, 0.9, 0.9], tossCoins).name, '老阳');
});

test('六次老阴得到坤卦并全变为乾卦', () => {
  const cast = withRandom([0.1], castHexagram);
  assert.equal(cast.primaryCode, '000000');
  assert.equal(cast.changedCode, '111111');
  assert.deepEqual(cast.changingIdxs, [0, 1, 2, 3, 4, 5]);
  assert.equal(cast.hasChange, true);
});

const primaryHex = {
  name: '乾', judgement: '元亨利贞。',
  binaryCode: '111111',
  useNine: '见群龙无首，吉。',
  lines: Array.from({ length: 6 }, (_, index) => ({
    isYang: true,
    text: `第${index + 1}爻`,
  })),
};
const changedHex = {
  name: '坤', judgement: '元亨。', binaryCode: '000000',
  lines: primaryHex.lines, useSix: '利永贞。',
};

test('无变爻取本卦卦辞，一变爻取对应爻辞', () => {
  const none = getReading({ changingIdxs: [] }, primaryHex, null);
  assert.equal(none.readings[0].text, primaryHex.judgement);
  const one = getReading({ changingIdxs: [4] }, primaryHex, changedHex);
  assert.equal(one.readings[0].text, '第5爻');
  assert.match(one.rule, /一爻变/);
});

test('乾卦六爻全变取本卦用九，不误取之卦用六', () => {
  const reading = getReading({ changingIdxs: [0, 1, 2, 3, 4, 5] }, primaryHex, changedHex);
  assert.equal(reading.readings[0].text, primaryHex.useNine);
  assert.match(reading.readings[0].src, /乾·用九/);
  assert.equal(reading.policyId, 'zhu-xi-qimeng-v1');
});

test('坤卦六爻全变取本卦用六，不误取之卦用九', () => {
  const reading = getReading({ changingIdxs: [0, 1, 2, 3, 4, 5] }, changedHex, primaryHex);
  assert.equal(reading.readings[0].text, changedHex.useSix);
  assert.match(reading.readings[0].src, /坤·用六/);
});

test('二爻变保留两条爻辞并以上爻为主，三爻变合看两卦', () => {
  const two = getReading({ changingIdxs: [1, 4] }, primaryHex, changedHex);
  assert.deepEqual(two.readings.map((item) => item.text), ['第5爻', '第2爻']);
  assert.deepEqual(two.readings.map((item) => item.priority), ['primary', 'secondary']);
  const three = getReading({ changingIdxs: [0, 2, 5] }, primaryHex, changedHex);
  assert.deepEqual(three.readings.map((item) => item.text), [primaryHex.judgement, changedHex.judgement]);
  assert.deepEqual(three.readings.map((item) => item.priority), ['primary', 'secondary']);
});

test('四爻变保留变卦两条不变爻并以下爻为主，五爻变取唯一不变爻', () => {
  const four = getReading({ changingIdxs: [0, 1, 2, 3] }, primaryHex, changedHex);
  assert.deepEqual(four.readings.map((item) => item.position), [5, 6]);
  assert.deepEqual(four.readings.map((item) => item.priority), ['primary', 'secondary']);
  assert.match(four.rule, /以下爻为主/);

  const five = getReading({ changingIdxs: [0, 1, 2, 3, 4] }, primaryHex, changedHex);
  assert.equal(five.readings[0].text, '第6爻');
  assert.equal(five.readings[0].kind, 'line');
});

test('六爻全变且无用辞时回退到变卦卦辞', () => {
  const ordinaryPrimary = { ...primaryHex, name: '大有', binaryCode: '111101', useNine: '' };
  const ordinaryChanged = { ...changedHex, name: '比', binaryCode: '000010', useSix: '' };
  const reading = getReading({ changingIdxs: [0, 1, 2, 3, 4, 5] }, ordinaryPrimary, ordinaryChanged);
  assert.equal(reading.readings[0].text, ordinaryChanged.judgement);
});

test('非变爻起卦保持本卦不变', () => {
  const cast = withRandom([0.9, 0.1, 0.1], castHexagram);
  assert.equal(cast.primaryCode, '111111');
  assert.equal(cast.changedCode, cast.primaryCode);
  assert.equal(cast.hasChange, false);
});
