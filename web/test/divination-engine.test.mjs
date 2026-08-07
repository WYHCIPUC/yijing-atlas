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
  lines: Array.from({ length: 6 }, (_, index) => ({
    isYang: true,
    text: `第${index + 1}爻`,
  })),
};
const changedHex = { name: '坤', judgement: '元亨。', lines: primaryHex.lines, useSix: '利永贞。' };

test('无变爻取本卦卦辞，一变爻取对应爻辞', () => {
  const none = getReading({ changingIdxs: [] }, primaryHex, null);
  assert.equal(none.readings[0].text, primaryHex.judgement);
  const one = getReading({ changingIdxs: [4] }, primaryHex, changedHex);
  assert.equal(one.readings[0].text, '第5爻');
  assert.match(one.rule, /一爻变/);
});

test('六爻全变优先取乾坤用辞', () => {
  const reading = getReading({ changingIdxs: [0, 1, 2, 3, 4, 5] }, primaryHex, changedHex);
  assert.equal(reading.readings[0].text, changedHex.useSix);
  assert.match(reading.readings[0].src, /用六/);
});

test('二爻变取上变爻，三爻变合看本卦与变卦', () => {
  const two = getReading({ changingIdxs: [1, 4] }, primaryHex, changedHex);
  assert.equal(two.readings[0].text, '第5爻');
  const three = getReading({ changingIdxs: [0, 2, 5] }, primaryHex, changedHex);
  assert.deepEqual(three.readings.map((item) => item.text), [primaryHex.judgement, changedHex.judgement]);
});

test('四爻变取变卦较下不变爻，五爻变取变卦唯一不变爻', () => {
  const four = getReading({ changingIdxs: [0, 1, 2, 3] }, primaryHex, changedHex);
  assert.equal(four.readings[0].text, '第5爻');
  assert.equal(four.readings[0].position, 5);
  assert.match(four.rule, /较下者/);

  const five = getReading({ changingIdxs: [0, 1, 2, 3, 4] }, primaryHex, changedHex);
  assert.equal(five.readings[0].text, '第6爻');
  assert.equal(five.readings[0].kind, 'line');
});

test('六爻全变且无用辞时回退到变卦卦辞', () => {
  const ordinaryChanged = { ...changedHex, useSix: '' };
  const reading = getReading({ changingIdxs: [0, 1, 2, 3, 4, 5] }, primaryHex, ordinaryChanged);
  assert.equal(reading.readings[0].text, ordinaryChanged.judgement);
});

test('非变爻起卦保持本卦不变', () => {
  const cast = withRandom([0.9, 0.1, 0.1], castHexagram);
  assert.equal(cast.primaryCode, '111111');
  assert.equal(cast.changedCode, cast.primaryCode);
  assert.equal(cast.hasChange, false);
});
