import { yaoLabel } from './hexagram-utils.js';

const TI_YONG_PLAIN = {
  bihe: '体、用五行相同，表示主体与外部条件较为同调，重点在守住节奏。',
  yongshengti: '用生体，表示外部条件对主体有助益，但仍要核实助力是否真实可持续。',
  tishengyong: '体生用，表示主体正向外投入资源，宜留意时间、精力与成本。',
  tikeyong: '体克用，表示主体能够推动或约束外部条件，但过程通常需要付出。',
  yongketi: '用克体，表示外部条件对主体形成压力，宜先评估边界与承受能力。',
};

const USE_PLAIN = {
  useNine: '群龙并见而不争为首，强调刚健之中仍需协同、谦抑，避免把主动变成争先。',
  useSix: '以柔顺之德长期守正，强调顺势并非失去原则，而是在稳定边界中持续承担。',
};

function findHexagram(reading, primaryHex, changedHex) {
  if (reading.hexCode === primaryHex.binaryCode) return primaryHex;
  if (changedHex && reading.hexCode === changedHex.binaryCode) return changedHex;
  return primaryHex;
}

function sourceFor(hexagram, reading) {
  if (reading.kind === 'judgement') return `《周易·${hexagram.name}卦·卦辞》`;
  if (reading.kind === 'line') {
    const line = hexagram.lines[reading.position - 1];
    return `《周易·${hexagram.name}卦·${yaoLabel(reading.position, line.isYang)}》`;
  }
  return `《周易·${hexagram.name}卦·${reading.kind === 'useNine' ? '用九' : '用六'}》`;
}

function buildFocus(reading, primaryHex, changedHex) {
  return reading.readings.map((item) => {
    const hexagram = findHexagram(item, primaryHex, changedHex);
    const line = item.kind === 'line' ? hexagram.lines[item.position - 1] : null;
    return {
      source: sourceFor(hexagram, item),
      quote: item.text,
      plain: line?.note || USE_PLAIN[item.kind] || hexagram.judgementNote,
      xiang: line?.xiang || '',
      xiangSource: line ? `《周易·${hexagram.name}卦·象传》` : '',
    };
  });
}

function buildShared(primaryHex, changedHex, focus) {
  const keyPoint = focus.map((item) => item.plain).filter(Boolean).join('；');
  const transition = changedHex
    ? `之卦“${changedHex.name}”提示条件变化后的另一种结构：${changedHex.scenario} 它是趋势参照，不是注定发生的结局。`
    : '本次没有形成之卦，可先把注意力放在本卦所示的当前结构，不必为了求变而强行行动。';
  return {
    situation: primaryHex.scenario,
    keyPoint: keyPoint || primaryHex.imageNote,
    transition,
    classic: {
      source: `《周易·${primaryHex.name}卦·象传》`,
      quote: primaryHex.image,
      plain: primaryHex.imageNote,
    },
    analogy: `把所问之事类比为一项正在推进的计划：先核对现实是否符合“${primaryHex.scenario}”这一描述，再用“${keyPoint || primaryHex.imageNote}”检查下一步；若关键条件继续变化，再参考之卦，而不是把卦名直接当成吉凶结论。`,
    prompts: [
      '哪些是已经发生、可以核实的事实？',
      '哪一个条件正在变化，最小可验证的一步是什么？',
      '如果判断错了，怎样保留回旋余地？',
    ],
  };
}

export function buildCoinInterpretation({ cast, primaryHex, changedHex, reading }) {
  const focus = buildFocus(reading, primaryHex, changedHex);
  return {
    method: '金钱卦',
    basis: `${reading.rule} 本卦“${primaryHex.name}”用来观察当前结构${changedHex ? `，之卦“${changedHex.name}”用来参照变爻展开后的可能走向` : ''}。`,
    terminology: `本卦是六次投掷所得的初始卦象；变爻是老阴、老阳所在的位置；之卦是把 ${cast.changingIdxs.length} 个变爻阴阳翻转后的结果。`,
    focus,
    ...buildShared(primaryHex, changedHex, focus),
    caveat: '变爻取辞采用常见的后世简化规则，不是《周易》经文规定的唯一占法；不同学派可能有不同取法。',
  };
}

export function buildMeihuaInterpretation({ cast, primaryHex, changedHex, analysis }) {
  const line = primaryHex.lines[cast.changingPos - 1];
  const reading = {
    readings: [{
      kind: 'line',
      position: cast.changingPos,
      hexCode: primaryHex.binaryCode,
      text: line.text,
    }],
  };
  const focus = buildFocus(reading, primaryHex, changedHex);
  const relation = TI_YONG_PLAIN[analysis.relation] || analysis.verdict;
  return {
    method: '梅花易数',
    basis: `${cast.source}。上、下数分别按八取卦，合数按六取第 ${cast.changingPos} 爻为动爻；因此以本卦该爻为解读重点，并以之卦观察变化方向。`,
    terminology: `体卦（${analysis.bodyPos}，${analysis.bodyWuxingName}）代表所问主体，用卦（${analysis.usePos}，${analysis.useWuxingName}）代表外部条件或所问对象。“${analysis.relationName}”可通俗理解为：${relation}`,
    focus,
    ...buildShared(primaryHex, changedHex, focus),
    caveat: '体用生克属于后世术数解释框架；本项目的数字法与公历时间法是学习性简化演示，不等同于《周易》本经方法或严格历法推演。',
  };
}
