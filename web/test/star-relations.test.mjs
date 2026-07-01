import { buildRelationGraph } from '../js/star-relations.js';

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

const failed = asserts.filter(a => !a.ok);
console.log(failed.length ? `\n${failed.length} 项失败` : '\n全部通过');
process.exit(failed.length ? 1 : 0);
