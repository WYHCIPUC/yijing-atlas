import assert from 'node:assert/strict';
import test from 'node:test';
import * as searchController from '../js/search-controller.js';

const { getHexCodeFromUrl, moveSelection, withHexCode } = searchController;

test('搜索解析先识别六位码，再识别卦序与第N卦', () => {
  assert.equal(typeof searchController.parseHexagramQuery, 'function');
  const parse = searchController.parseHexagramQuery;
  assert.deepEqual(parse(' 111111 '), { kind: 'code', code: '111111' });
  assert.deepEqual(parse('000001'), { kind: 'code', code: '000001' });
  assert.deepEqual(parse('1'), { kind: 'number', number: 1 });
  assert.deepEqual(parse('11'), { kind: 'number', number: 11 });
  assert.deepEqual(parse('64'), { kind: 'number', number: 64 });
  assert.deepEqual(parse(' 第64卦 '), { kind: 'number', number: 64 });
});

test('上下卦解析保留方向，不猜测无方向卦名', () => {
  assert.equal(typeof searchController.parseHexagramQuery, 'function');
  const parse = searchController.parseHexagramQuery;
  assert.deepEqual(parse('上坤下乾'), { kind: 'trigrams', lowerName: '乾', upperName: '坤' });
  assert.deepEqual(parse('下乾上坤'), { kind: 'trigrams', lowerName: '乾', upperName: '坤' });
  assert.deepEqual(parse('乾坤'), { kind: 'text', text: '乾坤' });
  assert.deepEqual(parse(' 上下无常 '), { kind: 'text', text: '上下无常' });
});

test('空串及非法数字查询不伪装为文本搜索', () => {
  assert.equal(typeof searchController.parseHexagramQuery, 'function');
  const parse = searchController.parseHexagramQuery;
  assert.deepEqual(parse(' \n '), { kind: 'empty' });
  for (const query of ['0', '65', '01', '001', '1111111', '0000001', '101102', '000064', '第0卦', '第65卦', '第01卦', '第000001卦', '第111111卦']) {
    assert.deepEqual(parse(query), { kind: 'invalid' }, query);
  }
  assert.deepEqual(parse({}), { kind: 'invalid' });
  assert.deepEqual(parse(' AbC '), { kind: 'text', text: 'abc' });
});

test('搜索选择支持循环方向键与首尾跳转', () => {
  assert.equal(moveSelection(-1, 'ArrowDown', 3), 0);
  assert.equal(moveSelection(0, 'ArrowUp', 3), 2);
  assert.equal(moveSelection(2, 'ArrowDown', 3), 0);
  assert.equal(moveSelection(1, 'Home', 3), 0);
  assert.equal(moveSelection(1, 'End', 3), 2);
  assert.equal(moveSelection(1, 'Enter', 3), 1);
  assert.equal(moveSelection(0, 'ArrowDown', 0), -1);
});

test('深链接只接受六位阴阳码并保留其他参数', () => {
  const url = withHexCode('https://example.com/app/?lang=zh', '111111');
  assert.equal(getHexCodeFromUrl(url), '111111');
  assert.match(url, /lang=zh/);
  assert.equal(getHexCodeFromUrl('https://example.com/?hex=bad'), null);
  assert.equal(getHexCodeFromUrl('not a url'), null);
  assert.equal(getHexCodeFromUrl(withHexCode(url, null)), null);
});

test('卦象详情与课程锚点不会残留在彼此的阅读场景', () => {
  const detailUrl = withHexCode('https://example.com/app/#lesson-observe', '110011');
  assert.equal(new URL(detailUrl).hash, '');
  assert.equal(new URL(withHexCode('https://example.com/app/#detail-lines', '110011')).hash, '#detail-lines');
  assert.equal(new URL(withHexCode('https://example.com/app/?hex=110011#detail-lines', null)).hash, '');
});
