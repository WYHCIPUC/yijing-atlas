import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeTiYong, castByNumber, castByTime } from '../js/meihua-engine.js';

test('数字起卦按八取卦、按六取动爻', () => {
  const cast = castByNumber(1, 2);
  assert.equal(cast.upperName, '乾');
  assert.equal(cast.lowerName, '兑');
  assert.equal(cast.primaryCode, '110111');
  assert.equal(cast.changingPos, 3);
  assert.equal(cast.changedCode, '111111');
});

test('整除时余数取除数本身', () => {
  const cast = castByNumber(8, 8);
  assert.equal(cast.upperName, '坤');
  assert.equal(cast.lowerName, '坤');
  assert.equal(cast.changingPos, 4);
});

test('数字起卦拒绝非正安全整数', () => {
  const invalidValues = [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1];
  for (const value of invalidValues) {
    assert.throws(() => castByNumber(value, 1), /上数必须是 1 以上的安全整数/);
    assert.throws(() => castByNumber(1, value), /下数必须是 1 以上的安全整数/);
  }
});

test('数字起卦拒绝上数与下数溢出安全整数范围', () => {
  assert.throws(
    () => castByNumber(Number.MAX_SAFE_INTEGER, 1),
    /上数与下数之和必须是安全整数/,
  );
});

test('时间起卦在同一输入下确定且标记来源', () => {
  const date = new Date(2026, 7, 6, 12, 0, 0);
  const first = castByTime(date);
  const second = castByTime(date);
  assert.equal(first.primaryCode, second.primaryCode);
  assert.equal(first.changedCode, second.changedCode);
  assert.equal(first.method, 'time');
  assert.match(first.source, /2026年8月6日/);
});

test('时间起卦拒绝无效日期', () => {
  assert.throws(() => castByTime(new Date('invalid')), /起卦时间无效/);
  assert.throws(() => castByTime('2026-08-06'), /起卦时间无效/);
});

test('体用分析返回完整五行关系', () => {
  const analysis = analyzeTiYong(castByNumber(1, 2));
  assert.equal(analysis.bodyWuxingName, '金');
  assert.equal(analysis.useWuxingName, '金');
  assert.equal(analysis.relation, 'bihe');
  assert.equal(analysis.relationName, '比和');
});

test('体用五行覆盖生、克与反向关系', () => {
  const cases = [
    [{ primaryCode: '111010', changingPos: 1 }, 'yongshengti'],
    [{ primaryCode: '010111', changingPos: 1 }, 'tishengyong'],
    [{ primaryCode: '100111', changingPos: 1 }, 'tikeyong'],
    [{ primaryCode: '101111', changingPos: 1 }, 'yongketi'],
    [{ primaryCode: '010111', changingPos: 4 }, 'yongshengti'],
  ];
  for (const [cast, relation] of cases) {
    const analysis = analyzeTiYong(cast);
    assert.equal(analysis.relation, relation);
    assert.ok(analysis.relationName);
    assert.ok(analysis.verdict);
  }
});
