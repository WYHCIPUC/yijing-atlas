import { readFileSync } from 'node:fs';
import {
  buildRelationGraph,
  getRelationOccurrences,
  relationTypesFrom,
} from '../js/star-relations.js';

const asserts = [];
function ok(name, cond) { asserts.push({name, ok: cond}); console.log(`${cond?'✓':'✗'} ${name}`); }

const testHex = [
  { binaryCode: '111111', name: '乾' },
  { binaryCode: '000000', name: '坤' },
  { binaryCode: '111000', name: '泰' },
  { binaryCode: '000111', name: '否' },
];
const graph = buildRelationGraph(testHex);

ok('节点数=4', graph.nodes.length === 4);
ok('边数>=1', graph.edges.length >= 1);

const qianKun = graph.edges.find(e =>
  (e.source === '111111' && e.target === '000000') ||
  (e.source === '000000' && e.target === '111111')
);
ok('乾→坤存在错卦边', !!qianKun);
ok('乾→坤边含 opposite 类型', qianKun && qianKun.types && qianKun.types.includes('opposite'));

const taiPi = graph.edges.filter(e =>
  (e.source === '111000' && e.target === '000111') ||
  (e.source === '000111' && e.target === '111000')
);
ok('泰→否至少1条边', taiPi.length >= 1);

ok('节点含 degree', typeof graph.nodes[0].degree === 'number');

const hexagrams = JSON.parse(readFileSync(new URL('../data/hexagrams.json', import.meta.url), 'utf8'));
const fullGraph = buildRelationGraph(hexagrams);
function edgeBetween(a, b) {
  return fullGraph.edges.find((edge) => new Set([edge.source, edge.target]).has(a)
    && new Set([edge.source, edge.target]).has(b));
}

for (const [a, b, expected] of [
  ['111000', '000111', ['opposite', 'reversed']],
  ['011001', '100110', ['opposite', 'reversed']],
  ['001011', '110100', ['opposite', 'reversed']],
  ['101010', '010101', ['opposite', 'reversed', 'interlocking']],
]) {
  const edge = edgeBetween(a, b);
  ok(`${a}—${b} 保留多重关系`, expected.every((type) => edge?.types.includes(type)));
  ok(`${a}→${b} 保留有向关系`, expected.every((type) => relationTypesFrom(edge, a).includes(type)));
}

const jijiChanging = getRelationOccurrences(fullGraph, '101010', { type: 'changing', changingPosition: 1 });
ok('变卦关系保存具体动爻条件', jijiChanging.length === 1
  && jijiChanging[0].conditional === true
  && jijiChanging[0].changingPositions[0] === 1);

const interlocking = getRelationOccurrences(fullGraph, '101010', { type: 'interlocking' });
ok('互卦作为有向发生记录保留起点和终点', interlocking.length === 1
  && interlocking[0].from === '101010');

const failed = asserts.filter(a => !a.ok);
console.log(failed.length ? `\n${failed.length} 项失败` : '\n全部通过');
process.exit(failed.length ? 1 : 0);
