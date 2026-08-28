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

function makeOccurrence(from, to, type, options = {}) {
  const basis = {
    opposite: '六爻阴阳逐位全反',
    reversed: '六爻次序整体倒转',
    interlocking: '二三四爻成下卦、三四五爻成上卦',
    changing: `第 ${options.position} 爻阴阳翻转`,
  };
  return {
    from,
    to,
    type,
    conditional: type === 'changing',
    changingPositions: type === 'changing' ? [options.position] : [],
    basis: basis[type],
  };
}

export function buildRelationOccurrences(hexagrams) {
  const codeSet = new Set(hexagrams.map(h => h.binaryCode));
  const occurrences = [];

  for (const h of hexagrams) {
    const code = h.binaryCode;
    const rels = allRelations(code);

    const candidates = [
      { target: rels.opposite, type: 'opposite' },
      { target: rels.reversed, type: 'reversed' },
      { target: rels.interlocking, type: 'interlocking' },
      ...rels.changing.map((target, index) => ({ target, type: 'changing', position: index + 1 })),
    ];

    for (const { target, type, position } of candidates) {
      if (target === code) continue;
      if (!codeSet.has(target)) continue;
      occurrences.push(makeOccurrence(code, target, type, { position }));
    }
  }
  return occurrences;
}

export function getRelationOccurrences(graph, fromCode, { type = null, changingPosition = null } = {}) {
  return (graph?.occurrences || []).filter((occurrence) => (
    occurrence.from === fromCode
    && (!type || occurrence.type === type)
    && (occurrence.type !== 'changing' || changingPosition === null || occurrence.changingPositions.includes(changingPosition))
  ));
}

export function relationTypesFrom(edge, fromCode, { includeConditional = false, changingPosition = null } = {}) {
  const types = [];
  for (const occurrence of edge?.occurrences || []) {
    if (occurrence.from !== fromCode) continue;
    if (occurrence.conditional && !includeConditional) continue;
    if (occurrence.type === 'changing' && changingPosition !== null
      && !occurrence.changingPositions.includes(changingPosition)) continue;
    if (!types.includes(occurrence.type)) types.push(occurrence.type);
  }
  return types;
}

export function buildRelationGraph(hexagrams) {
  const edgeMap = new Map();
  const occurrences = buildRelationOccurrences(hexagrams);

  for (const occurrence of occurrences) {
    const { from, to, type } = occurrence;
    const key = edgeKey(from, to);
    if (!edgeMap.has(key)) {
      const [source, target] = key.split('-');
      edgeMap.set(key, { source, target, types: [], occurrences: [], weight: 0 });
    }
    const edge = edgeMap.get(key);
    edge.occurrences.push(occurrence);
    if (!edge.types.includes(type)) {
      edge.types.push(type);
      edge.weight += RELATION_WEIGHTS[type];
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

  return { nodes, edges, occurrences };
}
