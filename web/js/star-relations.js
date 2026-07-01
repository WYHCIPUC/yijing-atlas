// 构建 64 卦关系图数据：节点（卦）+ 边（错综互变关系）。
// 供 star-map.js 的力导向布局使用。

import { allRelations } from './hexagram-utils.js';

const RELATION_WEIGHTS = {
  opposite: 3,
  reversed: 3,
  interlocking: 2,
  changing: 1,
};

function edgeKey(a, b) {
  return [a, b].sort().join('-');
}

export function buildRelationGraph(hexagrams) {
  const codeSet = new Set(hexagrams.map(h => h.binaryCode));
  const edgeMap = new Map();

  for (const h of hexagrams) {
    const code = h.binaryCode;
    const rels = allRelations(code);

    const candidates = [
      { target: rels.opposite, type: 'opposite' },
      { target: rels.reversed, type: 'reversed' },
      { target: rels.interlocking, type: 'interlocking' },
      ...rels.changing.map((t) => ({ target: t, type: 'changing' })),
    ];

    for (const { target, type } of candidates) {
      if (target === code) continue;
      if (!codeSet.has(target)) continue;
      const key = edgeKey(code, target);
      if (!edgeMap.has(key)) {
        const [a, b] = key.split('-');
        edgeMap.set(key, { source: a, target: b, types: [], weight: 0 });
      }
      const edge = edgeMap.get(key);
      if (!edge.types.includes(type)) {
        edge.types.push(type);
        edge.weight += RELATION_WEIGHTS[type];
      }
    }
  }

  const edges = Array.from(edgeMap.values());

  const degreeMap = new Map();
  for (const e of edges) {
    degreeMap.set(e.source, (degreeMap.get(e.source) || 0) + 1);
    degreeMap.set(e.target, (degreeMap.get(e.target) || 0) + 1);
  }

  const nodes = hexagrams.map(h => ({
    id: h.binaryCode,
    name: h.name,
    binaryCode: h.binaryCode,
    number: h.number,
    degree: degreeMap.get(h.binaryCode) || 0,
  }));

  return { nodes, edges };
}
