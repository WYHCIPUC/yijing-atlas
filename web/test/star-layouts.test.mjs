import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  buildEightPalaceGroups,
  buildStarLayout,
  EIGHT_PALACE_STAGES,
  TWELVE_MESSAGE_HEXAGRAMS,
} from '../js/star-layouts.js';

const hexagrams = JSON.parse(readFileSync(new URL('../data/hexagrams.json', import.meta.url), 'utf8'));
const nodes = hexagrams.map(({ binaryCode, name, number }) => ({ id: binaryCode, binaryCode, name, number }));

test('八宫每宫八卦且完整覆盖六十四卦', () => {
  const groups = buildEightPalaceGroups();
  assert.equal(groups.length, 8);
  assert.ok(groups.every((group) => group.codes.length === 8));
  assert.deepEqual(groups[0].codes, ['111111', '011111', '001111', '000111', '000011', '000001', '000101', '111101']);
  assert.deepEqual(groups[0].entries.map((entry) => entry.stage), EIGHT_PALACE_STAGES);
  assert.equal(new Set(groups.flatMap((group) => group.codes)).size, 64);
});

test('十二消息卦保持复至乾、姤至坤的消长次序与常见月令', () => {
  assert.deepEqual(TWELVE_MESSAGE_HEXAGRAMS.map((entry) => entry.name),
    ['复', '临', '泰', '大壮', '夬', '乾', '姤', '遁', '否', '观', '剥', '坤']);
  assert.equal(TWELVE_MESSAGE_HEXAGRAMS[0].month, '十一月');
  assert.equal(TWELVE_MESSAGE_HEXAGRAMS[5].month, '四月');
  assert.equal(TWELVE_MESSAGE_HEXAGRAMS[11].month, '十月');
});

test('先天视图仅显示八纯卦并采用南上东左的传统图式方向', () => {
  const layout = buildStarLayout(nodes, 'earlier-heaven');
  assert.equal(layout.visibleCodes.size, 8);
  assert.ok(layout.positions.get('111111').y < 0);
  assert.ok(layout.positions.get('000000').y > 0);
  assert.ok(layout.positions.get('101101').x < 0);
  assert.ok(layout.positions.get('010010').x > 0);
});

test('文王卦序与八宫布局覆盖六十四卦并保留可解释分组', () => {
  const kingWen = buildStarLayout(nodes, 'king-wen');
  const palaces = buildStarLayout(nodes, 'eight-palaces');
  assert.equal(kingWen.positions.size, 64);
  assert.equal(kingWen.positions.get('111111').label, '第 1 卦');
  assert.equal(kingWen.positions.get('010101').label, '第 64 卦');
  assert.equal(palaces.positions.size, 64);
  assert.equal(palaces.positions.get('111111').group, '乾宫');
  assert.equal(palaces.positions.get('111101').label, '归魂');
});

test('十二消息视图只显示十二卦，未知布局安全回退项目关系球', () => {
  const messages = buildStarLayout(nodes, 'twelve-messages');
  const fallback = buildStarLayout(nodes, 'unknown');
  assert.equal(messages.visibleCodes.size, 12);
  assert.equal(messages.positions.get('111000').label, '正月');
  assert.equal(fallback.id, 'project');
  assert.equal(fallback.visibleCodes.size, 64);
});
