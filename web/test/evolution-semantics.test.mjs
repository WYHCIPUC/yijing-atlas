import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { classicalCitation, evolutionSemantics } from '../js/evolution-semantics.js';

const hexagrams = JSON.parse(readFileSync(new URL('../data/hexagrams.json', import.meta.url), 'utf8'));
const qian = hexagrams.find((hexagram) => hexagram.binaryCode === '111111');
const gou = hexagrams.find((hexagram) => hexagram.binaryCode === '011111');

test('当前卦义随帧解析并带有经传定位', () => {
  const meaning = evolutionSemantics(gou);
  assert.equal(meaning.current.name, '姤');
  assert.equal(meaning.current.evidence.length, 3);
  assert.deepEqual(meaning.current.evidence.map((item) => item.citation), [
    '《周易·姤卦·卦辞》',
    '《周易·彖传·姤卦》',
    '《周易·象传·姤卦》',
  ]);
  assert.match(meaning.sourceNote, /项目自撰/);
});

test('单帧变化同时解析前后爻辞、小象和项目释义', () => {
  const meaning = evolutionSemantics(gou, qian, 1);
  assert.equal(meaning.transition.position, 1);
  assert.equal(meaning.transition.before.hexagramName, '乾');
  assert.equal(meaning.transition.after.hexagramName, '姤');
  assert.equal(meaning.transition.before.textCitation, '《周易·乾卦·初九》');
  assert.equal(meaning.transition.after.imageCitation, '《周易·象传·姤卦·初六》');
  assert.match(meaning.transition.disclaimer, /不等同于传统占筮断法/);
});

test('无效分区、卦象和爻位会被拒绝', () => {
  assert.throws(() => classicalCitation(qian, 'unknown'), /未知经传分区/);
  assert.throws(() => classicalCitation(qian, 'line', 7), /1-6/);
  assert.throws(() => evolutionSemantics(null), /有效卦象/);
  assert.throws(() => evolutionSemantics(qian, gou, 0), /1-6/);
});
