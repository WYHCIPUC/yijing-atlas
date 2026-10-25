import assert from 'node:assert/strict';
import test from 'node:test';
import { placeStarLabels, measureStarText } from '../js/star-label-layout.js';

const candidate = (id, x, y, priority = 1, positions = []) => ({
  id, text: id, x, y, width: 40, height: 16, priority, positions,
});

test('卦名与关键词共享 7px 间距，当前卦优先并尝试候选位置', () => {
  const labels = placeStarLabels([
    candidate('keyword', 100, 80, 1),
    candidate('current', 100, 80, 5, [{ x: 100, y: 50 }]),
    candidate('landmark', 105, 80, 2, [{ x: 157, y: 80 }]),
  ], { width: 240, height: 160, reservedRects: [{ left: 70, right: 130, top: 65, bottom: 95 }] });
  assert.equal(labels.find(label => label.id === 'current').y, 50);
  assert.equal(labels.find(label => label.id === 'landmark').x, 157);
  assert.equal(labels.some(label => label.id === 'keyword'), false);
  for (const a of labels) for (const b of labels) {
    if (a === b) continue;
    assert.ok(a.box.right + 7 <= b.box.left || b.box.right + 7 <= a.box.left
      || a.box.bottom + 7 <= b.box.top || b.box.bottom + 7 <= a.box.top);
  }
});

test('长词与强制地标没有可用空间时隐藏，避免边缘裁切和强制叠字', () => {
  const labels = placeStarLabels([
    { ...candidate('long', 50, 20, 5), width: 160 },
    candidate('landmark', 50, 50, 2),
  ], { width: 100, height: 70, reservedRects: [{ left: 0, right: 100, top: 30, bottom: 70 }] });
  assert.deepEqual(labels, []);
});

test('同优先级按稳定标识排序，文字尺寸按字体与文本缓存', () => {
  let measured = 0;
  const ctx = { font: '', measureText: () => { measured += 1; return { width: 24 }; } };
  assert.deepEqual(measureStarText(ctx, '15px serif', '乾'), measureStarText(ctx, '15px serif', '乾'));
  assert.equal(measured, 1);
  const first = placeStarLabels([candidate('b', 70, 50), candidate('a', 70, 50)]);
  const second = placeStarLabels([candidate('a', 70, 50), candidate('b', 70, 50)]);
  assert.deepEqual(first.map(label => label.id), ['a']);
  assert.deepEqual(first, second);
});
