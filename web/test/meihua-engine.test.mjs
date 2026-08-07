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

test('时间起卦在同一输入下确定且标记来源', () => {
  const date = new Date(2026, 7, 6, 12, 0, 0);
  const first = castByTime(date);
  const second = castByTime(date);
  assert.equal(first.primaryCode, second.primaryCode);
  assert.equal(first.changedCode, second.changedCode);
  assert.equal(first.method, 'time');
  assert.match(first.source, /2026年8月6日/);
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
