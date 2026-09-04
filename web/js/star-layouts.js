const VALID_CODE = /^[01]{6}$/;

export const STAR_LAYOUTS = Object.freeze({
  project: Object.freeze({
    id: 'project',
    label: '易象银河',
    shortLabel: '易象银河',
    sourceType: '项目银河布局',
    description: '六爻为卫星、六十四卦为恒星，并按下卦聚成八个卦族星团；关系与外轨都围绕真实星群组织。此为项目解释性布局，不是传统固定图式。',
  }),
  'earlier-heaven': Object.freeze({
    id: 'earlier-heaven',
    label: '先天八卦',
    shortLabel: '先天',
    sourceType: '传统方位 · 项目绘制',
    description: '仅保留八纯卦，按乾南坤北、离东坎西的先天方位排列；采用南上、东左的传统图式方向。',
  }),
  'king-wen': Object.freeze({
    id: 'king-wen',
    label: '文王卦序',
    shortLabel: '卦序',
    sourceType: '经典次序 · 项目环排',
    description: '严格依六十四卦文王次序排列；多环形态是项目为比较与定位所作的可视化，不是古代固定图式。',
  }),
  'eight-palaces': Object.freeze({
    id: 'eight-palaces',
    label: '八宫卦序',
    shortLabel: '八宫',
    sourceType: '京房易传统 · 项目环排',
    description: '按八宫分组，并依本宫、一世、二世、三世、四世、五世、游魂、归魂排布；方位角度为项目可视化。',
  }),
  'twelve-messages': Object.freeze({
    id: 'twelve-messages',
    label: '十二消息',
    shortLabel: '消息',
    sourceType: '消息卦传统 · 项目年轮',
    description: '从复卦一阳来复到乾，再由姤卦一阴初生到坤，按常见月令配属形成阴阳消长年轮。',
  }),
});

export const EIGHT_PALACE_STAGES = Object.freeze(['本宫', '一世', '二世', '三世', '四世', '五世', '游魂', '归魂']);

const PALACE_TRIGRAMS = Object.freeze([
  ['111', '乾'], ['110', '兑'], ['101', '离'], ['100', '震'],
  ['011', '巽'], ['010', '坎'], ['001', '艮'], ['000', '坤'],
]);

const EARLIER_HEAVEN = Object.freeze([
  { trigram: '111', name: '乾', direction: '南', x: 0, y: -1 },
  { trigram: '110', name: '兑', direction: '东南', x: -0.71, y: -0.71 },
  { trigram: '101', name: '离', direction: '东', x: -1, y: 0 },
  { trigram: '100', name: '震', direction: '东北', x: -0.71, y: 0.71 },
  { trigram: '000', name: '坤', direction: '北', x: 0, y: 1 },
  { trigram: '001', name: '艮', direction: '西北', x: 0.71, y: 0.71 },
  { trigram: '010', name: '坎', direction: '西', x: 1, y: 0 },
  { trigram: '011', name: '巽', direction: '西南', x: 0.71, y: -0.71 },
]);

export const TWELVE_MESSAGE_HEXAGRAMS = Object.freeze([
  { code: '100000', name: '复', month: '十一月', phase: '一阳复生' },
  { code: '110000', name: '临', month: '十二月', phase: '二阳来临' },
  { code: '111000', name: '泰', month: '正月', phase: '三阳开泰' },
  { code: '111100', name: '大壮', month: '二月', phase: '四阳壮盛' },
  { code: '111110', name: '夬', month: '三月', phase: '五阳决阴' },
  { code: '111111', name: '乾', month: '四月', phase: '六阳纯健' },
  { code: '011111', name: '姤', month: '五月', phase: '一阴初遇' },
  { code: '001111', name: '遁', month: '六月', phase: '二阴渐长' },
  { code: '000111', name: '否', month: '七月', phase: '三阴闭塞' },
  { code: '000011', name: '观', month: '八月', phase: '四阴观变' },
  { code: '000001', name: '剥', month: '九月', phase: '五阴剥阳' },
  { code: '000000', name: '坤', month: '十月', phase: '六阴纯顺' },
]);

function flipAt(code, position) {
  const index = position - 1;
  return `${code.slice(0, index)}${code[index] === '1' ? '0' : '1'}${code.slice(index + 1)}`;
}

export function buildEightPalaceGroups() {
  return PALACE_TRIGRAMS.map(([trigram, name]) => {
    const codes = [`${trigram}${trigram}`];
    for (const position of [1, 2, 3, 4, 5]) codes.push(flipAt(codes.at(-1), position));
    codes.push(flipAt(codes.at(-1), 4));
    let returnCode = codes.at(-1);
    for (const position of [1, 2, 3]) returnCode = flipAt(returnCode, position);
    codes.push(returnCode);
    return {
      id: trigram,
      name: `${name}宫`,
      codes,
      entries: codes.map((code, index) => ({ code, stage: EIGHT_PALACE_STAGES[index], stageIndex: index })),
    };
  });
}

function nodeCode(node) {
  const code = node?.binaryCode || node?.id || '';
  return VALID_CODE.test(code) ? code : null;
}

function position(x, y, z = 0, meta = {}) {
  return { x, y, z, ...meta };
}

export function buildLineStarOrbit(code) {
  if (!VALID_CODE.test(code)) return [];
  const seed = Number.parseInt(code, 2);
  return [...code].map((bit, index) => {
    const positionIndex = index + 1;
    const angle = -Math.PI / 2 + index / 6 * Math.PI * 2 + (seed % 11) * 0.012;
    const radius = 1 + (index % 2) * 0.14;
    return {
      position: positionIndex,
      isYang: bit === '1',
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
      phase: seed * 0.17 + positionIndex * 0.82,
    };
  });
}

function projectLayout(nodes) {
  const positions = new Map();
  const groups = PALACE_TRIGRAMS.map(([trigram, name], clusterIndex) => {
    const clusterAngle = -Math.PI / 2 + clusterIndex / PALACE_TRIGRAMS.length * Math.PI * 2;
    const clusterRadius = 0.68;
    const center = position(
      Math.cos(clusterAngle) * clusterRadius,
      Math.sin(clusterAngle) * clusterRadius,
      Math.sin(clusterAngle * 2) * 0.055,
    );
    return { id: trigram, name: `${name}下卦星团`, clusterIndex, center, codes: [] };
  });
  const trigramIndex = new Map(PALACE_TRIGRAMS.map(([trigram], index) => [trigram, index]));

  for (const node of nodes) {
    const code = nodeCode(node);
    if (!code) continue;
    const lower = code.slice(0, 3);
    const upper = code.slice(3, 6);
    const clusterIndex = trigramIndex.get(lower);
    const upperIndex = trigramIndex.get(upper);
    if (!Number.isInteger(clusterIndex) || !Number.isInteger(upperIndex)) continue;
    const group = groups[clusterIndex];
    const pure = lower === upper;
    const seed = Number.parseInt(code, 2);
    const localAngle = -Math.PI / 2 + upperIndex / PALACE_TRIGRAMS.length * Math.PI * 2
      + clusterIndex * 0.075;
    const localRadius = pure ? 0 : 0.135 + (seed % 3) * 0.022;
    positions.set(code, position(
      group.center.x + Math.cos(localAngle) * localRadius,
      group.center.y + Math.sin(localAngle) * localRadius,
      group.center.z + (upperIndex - 3.5) * 0.022,
      {
        group: group.name,
        clusterId: lower,
        clusterIndex,
        orbitalIndex: upperIndex,
        isClusterAnchor: pure,
      },
    ));
    group.codes.push(code);
  }
  return {
    positions,
    visibleCodes: new Set(positions.keys()),
    groups,
  };
}

function earlierHeavenLayout(nodes) {
  const available = new Set(nodes.map(nodeCode).filter(Boolean));
  const entries = EARLIER_HEAVEN.map((entry) => ({ ...entry, code: `${entry.trigram}${entry.trigram}` }))
    .filter((entry) => available.has(entry.code));
  return {
    positions: new Map(entries.map((entry) => [entry.code, position(entry.x * 0.86, entry.y * 0.86, 0, {
      group: '先天八卦', label: `${entry.name} · ${entry.direction}`, direction: entry.direction,
    })])),
    visibleCodes: new Set(entries.map((entry) => entry.code)),
    groups: entries,
  };
}

function kingWenLayout(nodes) {
  const ordered = nodes
    .filter((node) => nodeCode(node) && Number.isInteger(node.number))
    .sort((a, b) => a.number - b.number);
  const positions = new Map();
  for (const node of ordered) {
    const index = node.number - 1;
    const ring = Math.floor(index / 16);
    const slot = index % 16;
    const angle = -Math.PI / 2 + slot / 16 * Math.PI * 2 + ring * 0.035;
    const radius = 0.28 + ring * 0.2;
    positions.set(nodeCode(node), position(Math.cos(angle) * radius, Math.sin(angle) * radius, (ring - 1.5) * 0.025, {
      group: node.number <= 30 ? '上经' : '下经', label: `第 ${node.number} 卦`, ring,
    }));
  }
  return {
    positions,
    visibleCodes: new Set(positions.keys()),
    groups: [
      { name: '上经', range: '1–30' },
      { name: '下经', range: '31–64' },
    ],
  };
}

function eightPalacesLayout(nodes) {
  const available = new Set(nodes.map(nodeCode).filter(Boolean));
  const groups = buildEightPalaceGroups();
  const positions = new Map();
  groups.forEach((group, groupIndex) => {
    const angle = -Math.PI / 2 + groupIndex / groups.length * Math.PI * 2;
    group.entries.forEach((entry) => {
      if (!available.has(entry.code)) return;
      const radius = 0.24 + entry.stageIndex * 0.105;
      positions.set(entry.code, position(Math.cos(angle) * radius, Math.sin(angle) * radius, (entry.stageIndex - 3.5) * 0.018, {
        group: group.name, label: entry.stage, stageIndex: entry.stageIndex,
      }));
    });
  });
  return { positions, visibleCodes: new Set(positions.keys()), groups };
}

function twelveMessagesLayout(nodes) {
  const available = new Set(nodes.map(nodeCode).filter(Boolean));
  const entries = TWELVE_MESSAGE_HEXAGRAMS.filter((entry) => available.has(entry.code));
  const positions = new Map(entries.map((entry, index) => {
    const angle = Math.PI / 2 + index / 12 * Math.PI * 2;
    return [entry.code, position(Math.cos(angle) * 0.82, Math.sin(angle) * 0.82, 0, {
      group: '十二消息', label: entry.month, phase: entry.phase, messageIndex: index,
    })];
  }));
  return { positions, visibleCodes: new Set(positions.keys()), groups: entries };
}

export function buildStarLayout(nodes, requestedMode = 'project') {
  const mode = Object.hasOwn(STAR_LAYOUTS, requestedMode) ? requestedMode : 'project';
  const layout = mode === 'earlier-heaven' ? earlierHeavenLayout(nodes)
    : mode === 'king-wen' ? kingWenLayout(nodes)
      : mode === 'eight-palaces' ? eightPalacesLayout(nodes)
        : mode === 'twelve-messages' ? twelveMessagesLayout(nodes)
          : projectLayout(nodes);
  return { ...STAR_LAYOUTS[mode], ...layout };
}
