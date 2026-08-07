import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { getReading } from '../js/divination-engine.js';
import { buildCoinInterpretation, buildMeihuaInterpretation } from '../js/divination-interpretation.js';
import { analyzeTiYong, castByNumber } from '../js/meihua-engine.js';

const hexagrams = JSON.parse(readFileSync(new URL('../data/hexagrams.json', import.meta.url), 'utf8'));
const byCode = new Map(hexagrams.map((hexagram) => [hexagram.binaryCode, hexagram]));

function changeAt(code, index) {
  const bits = code.split('');
  bits[index] = bits[index] === '1' ? '0' : '1';
  return bits.join('');
}

test('金钱卦解释为每一卦提供原文出处、通俗释义和现实边界', () => {
  for (const primaryHex of hexagrams) {
    const changedCode = changeAt(primaryHex.binaryCode, 0);
    const changedHex = byCode.get(changedCode);
    const cast = { changingIdxs: [0], changedCode, hasChange: true };
    const reading = getReading(cast, primaryHex, changedHex);
    const result = buildCoinInterpretation({ cast, primaryHex, changedHex, reading });

    assert.match(result.focus[0].source, new RegExp(`《周易·${primaryHex.name}卦`));
    assert.equal(result.focus[0].plain, primaryHex.lines[0].note);
    assert.equal(result.focus[0].xiang, primaryHex.lines[0].xiang);
    assert.equal(result.classic.quote, primaryHex.image);
    assert.match(result.analogy, /类比/);
    assert.match(result.transition, /不是注定发生的结局/);
    assert.match(result.caveat, /不同学派/);
  }
});

test('无变爻解释当前结构并说明不会形成之卦', () => {
  const primaryHex = byCode.get('111111');
  const cast = { changingIdxs: [], hasChange: false };
  const reading = getReading(cast, primaryHex, null);
  const result = buildCoinInterpretation({ cast, primaryHex, changedHex: null, reading });

  assert.equal(result.focus[0].plain, primaryHex.judgementNote);
  assert.match(result.basis, /当前结构/);
  assert.match(result.transition, /没有形成之卦/);
  assert.match(result.terminology, /0 个变爻/);
});

test('乾坤全变引用用九、用六并给出对应通俗解释', () => {
  for (const [primaryCode, changedCode, label] of [
    ['000000', '111111', '用九'],
    ['111111', '000000', '用六'],
  ]) {
    const primaryHex = byCode.get(primaryCode);
    const changedHex = byCode.get(changedCode);
    const cast = { changingIdxs: [0, 1, 2, 3, 4, 5], changedCode, hasChange: true };
    const reading = getReading(cast, primaryHex, changedHex);
    const result = buildCoinInterpretation({ cast, primaryHex, changedHex, reading });

    assert.match(result.focus[0].source, new RegExp(label));
    assert.ok(result.focus[0].plain.length > 20);
    assert.match(result.basis, /乾坤优先参看/);
  }
});

test('梅花易数解释交代起卦公式、体用术语与简化边界', () => {
  const cast = castByNumber(1, 2);
  const primaryHex = byCode.get(cast.primaryCode);
  const changedHex = byCode.get(cast.changedCode);
  const analysis = analyzeTiYong(cast);
  const result = buildMeihuaInterpretation({ cast, primaryHex, changedHex, analysis });

  assert.match(result.basis, /按八取卦/);
  assert.match(result.terminology, /体卦/);
  assert.match(result.terminology, /比和/);
  assert.equal(result.focus[0].plain, primaryHex.lines[cast.changingPos - 1].note);
  assert.match(result.caveat, /学习性简化演示/);
});

test('梅花易数五种体用关系都有通俗解释', () => {
  const primaryHex = byCode.get('010111');
  const changedHex = byCode.get(changeAt(primaryHex.binaryCode, 0));
  const cast = { changingPos: 1, source: '测试数值' };
  const relations = ['bihe', 'yongshengti', 'tishengyong', 'tikeyong', 'yongketi'];

  for (const relation of relations) {
    const result = buildMeihuaInterpretation({
      cast,
      primaryHex,
      changedHex,
      analysis: {
        relation,
        relationName: relation,
        bodyPos: '上卦',
        usePos: '下卦',
        bodyWuxingName: '金',
        useWuxingName: '木',
        verdict: '传统判断',
      },
    });
    assert.doesNotMatch(result.terminology, /传统判断$/);
  }
});
