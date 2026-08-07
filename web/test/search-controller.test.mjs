import assert from 'node:assert/strict';
import test from 'node:test';
import { getHexCodeFromUrl, moveSelection, withHexCode } from '../js/search-controller.js';

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
