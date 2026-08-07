// 占筮引擎：金钱卦起卦法。
// 三枚铜钱掷六次，每次得一爻：老阳(3正) 少阴(2正) 老阴(0正) 少阳(1正)。
// 老阳老阴为变爻。

// 单次掷三枚铜钱（每枚正反面），返回爻象
// 正面=2，反面=3。三枚之和：6=老阴(变) 7=少阳 8=少阴 9=老阳(变)
export function tossCoins() {
  const c1 = Math.random() < 0.5 ? 2 : 3;
  const c2 = Math.random() < 0.5 ? 2 : 3;
  const c3 = Math.random() < 0.5 ? 2 : 3;
  const sum = c1 + c2 + c3;
  // sum 6=老阴(0变阳) 7=少阳(1) 8=少阴(0) 9=老阳(1变阴)
  let yao;
  if (sum === 6) yao = { value: 0, isYang: false, changing: true, name: '老阴', coins: [c1, c2, c3] };
  else if (sum === 7) yao = { value: 1, isYang: true, changing: false, name: '少阳', coins: [c1, c2, c3] };
  else if (sum === 8) yao = { value: 0, isYang: false, changing: false, name: '少阴', coins: [c1, c2, c3] };
  else yao = { value: 1, isYang: true, changing: true, name: '老阳', coins: [c1, c2, c3] };
  return yao;
}

// 完整起卦：掷六次，得本卦 + 变卦
export function castHexagram() {
  const yaos = [];
  for (let i = 0; i < 6; i++) yaos.push(tossCoins());
  // 本卦 binaryCode（自下而上）
  const primaryCode = yaos.map(y => y.value).join('');
  // 变卦：变爻翻转
  const changingIdxs = yaos.map((y, i) => y.changing ? i : -1).filter(i => i >= 0);
  let changedCode = primaryCode;
  if (changingIdxs.length > 0) {
    const arr = primaryCode.split('');
    changingIdxs.forEach(i => { arr[i] = arr[i] === '1' ? '0' : '1'; });
    changedCode = arr.join('');
  }
  return {
    yaos,
    primaryCode,
    changedCode,
    changingIdxs,
    hasChange: changingIdxs.length > 0 && changedCode !== primaryCode,
  };
}

// 变爻取辞规则
// 0 变爻：看本卦卦辞
// 1 变爻：看本卦变爻爻辞
// 2 变爻：看本卦上变爻爻辞 + 变卦下变爻爻辞
// 3 变爻：看本卦卦辞 + 变卦卦辞
// 4 变爻：看变卦下不变爻爻辞
// 5 变爻：看变卦不变爻爻辞
// 6 变爻（全变）：看变卦卦辞（乾坤看用九/用六）
export function getReading(cast, primaryHex, changedHex) {
  const n = cast.changingIdxs.length;
  const readings = [];
  if (n === 0) {
    readings.push(createJudgementReading(primaryHex));
  } else if (n === 1) {
    const pos = cast.changingIdxs[0] + 1;
    readings.push(createLineReading(primaryHex, pos));
  } else if (n === 6) {
    if (changedHex.useNine || changedHex.useSix) {
      const kind = changedHex.useNine ? 'useNine' : 'useSix';
      readings.push(createUseReading(changedHex, kind));
    } else {
      readings.push(createJudgementReading(changedHex));
    }
  } else if (n === 2) {
    const upper = cast.changingIdxs[n - 1];
    readings.push(createLineReading(primaryHex, upper + 1));
  } else if (n === 3) {
    readings.push(createJudgementReading(primaryHex));
    readings.push(createJudgementReading(changedHex));
  } else if (n === 4) {
    const unchangedIdxs = cast.changingIdxs.reduce((items, index) => {
      items.delete(index);
      return items;
    }, new Set([0, 1, 2, 3, 4, 5]));
    const lower = Math.min(...unchangedIdxs);
    readings.push(createLineReading(changedHex, lower + 1));
  } else if (n === 5) {
    const unchanged = [0, 1, 2, 3, 4, 5].find((index) => !cast.changingIdxs.includes(index));
    readings.push(createLineReading(changedHex, unchanged + 1));
  }
  return { n, readings, rule: getRuleText(n) };
}

function createJudgementReading(hexagram) {
  return {
    src: `${hexagram.name}·卦辞`,
    text: hexagram.judgement,
    kind: 'judgement',
    hexCode: hexagram.binaryCode,
  };
}

function createLineReading(hexagram, position) {
  const line = hexagram.lines[position - 1];
  return {
    src: `${hexagram.name}·${yaoLabel(position, line.isYang)}`,
    text: line.text,
    kind: 'line',
    position,
    hexCode: hexagram.binaryCode,
  };
}

function createUseReading(hexagram, kind) {
  const label = kind === 'useNine' ? '用九' : '用六';
  return {
    src: `${hexagram.name}·${label}`,
    text: hexagram[kind],
    kind,
    hexCode: hexagram.binaryCode,
  };
}

function getRuleText(n) {
  const rules = {
    0: '无变爻，以本卦卦辞断之。',
    1: '一爻变，以本卦变爻爻辞断之。',
    2: '二爻变，以本卦上变爻爻辞为主断之。',
    3: '三爻变，以本卦卦辞与变卦卦辞合断之。',
    4: '四爻变，以变卦两个不变爻中较下者的爻辞为主断之。',
    5: '五爻变，以变卦不变爻爻辞断之。',
    6: '六爻全变，乾坤优先参看用九、用六，其余以变卦卦辞断之。',
  };
  return rules[n] || '';
}

function yaoLabel(position, isYang) {
  const names = ['', '初', '二', '三', '四', '五', '上'];
  const yinYang = isYang ? '九' : '六';
  return (position === 1 || position === 6) ? `${names[position]}${yinYang}` : `${yinYang}${names[position]}`;
}
