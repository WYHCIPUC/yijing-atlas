// 占筮引擎：三种起卦法 + 变爻解读规则。
// 纯逻辑模块。爻值：6=老阴(变)、7=少阳、8=少阴、9=老阳(变)。
// 6位爻值数组（自下而上）→ 本卦 binaryCode、变卦 binaryCode、变爻位置。

const _6 = (arr) => arr.map((v) => (v === 6 || v === 9 ? 1 : v === 7 ? 1 : 0)).join('');
// 爻值→阴阳：6老阴(变)、7少阳、8少阴、9老阳(变)
const isYang = (v) => v === 7 || v === 9;
const isChanging = (v) => v === 6 || v === 9;

// 由 6 个爻值（自下而上）算出本卦、变卦、变爻位
export function resolveLineValues(values) {
  // 本卦 binaryCode（自下而上）
  const primary = values.map((v) => (isYang(v) ? '1' : '0')).join('');
  // 变卦：变爻阴阳翻转
  const changed = values.map((v) => {
    if (v === 9) return '0'; // 老阳→阴
    if (v === 6) return '1'; // 老阴→阳
    return isYang(v) ? '1' : '0';
  }).join('');
  const changing = [];
  values.forEach((v, i) => { if (isChanging(v)) changing.push(i + 1); });
  return { primary, changed, changing, values };
}

// ---- 金钱卦 ----
// 三枚铜钱：正面(字)记2，反面(背)记3。总和：6/7/8/9。
// 6=三反(老阴)、7=两反一正(少阳)、8=一反两正(少阴)、9=三正(老阳)。
// 这里铜钱表示：每个 coin true=正面(2分)，false=反面(3分)
function coinToValue(threeCoins) {
  const sum = threeCoins.reduce((s, c) => s + (c ? 2 : 3), 0); // 6..9
  return sum; // 6/7/8/9
}

// 掷一爻（三枚铜钱随机）
function tossOneYao() {
  return [Math.random() < 0.5, Math.random() < 0.5, Math.random() < 0.5];
}

export function castCoins() {
  const values = [];
  const tosses = [];
  for (let i = 0; i < 6; i++) {
    const coins = tossOneYao();
    tosses.push(coins);
    values.push(coinToValue(coins));
  }
  return { method: 'coins', values, tosses, ...resolveLineValues(values) };
}

// ---- 大衍筮法（简化模拟）----
// 传统：50蓍取1用49，四营（分二、挂一、揲四、归奇）三变成一爻。
// 这里按大衍之法概率分布模拟出 6/7/8/9：
// 老阳(9)概率3/16、少阴(8)概率7/16、少阳(7)概率5/16、老阴(6)概率1/16
function yarrowOneYao() {
  const r = Math.random() * 16;
  if (r < 5) return 7;       // 少阳 5/16
  if (r < 12) return 8;      // 少阴 7/16
  if (r < 15) return 9;      // 老阳 3/16
  return 6;                   // 老阴 1/16
}

export function castYarrow() {
  const values = [];
  for (let i = 0; i < 6; i++) values.push(yarrowOneYao());
  return { method: 'yarrow', values, ...resolveLineValues(values) };
}

// ---- 梅花易数（时间起卦，确定性）----
// 以起卦时刻的年月日时数起卦。
// 上卦 = (年+月+日) % 8，下卦 = (年+月+日+时) % 8，动爻 = (年+月+日+时) % 6
// 八卦序：乾1 兑2 离3 震4 巽5 坎6 艮7 坤8（余0当坤8）
const MEIHUA_TRIGRAMS = ['111', '110', '101', '100', '011', '010', '001', '000'];
// index 0=乾(余数1对应index0)，故 (n-1)%8 取数组

export function castMeihua({ year, month, day, hour }) {
  // year 用地支序或年数；这里用农历年数（简化用公历年份末两位+100 偏移，保证非0）
  const y = year || (new Date().getFullYear() % 100);
  const m = month || (new Date().getMonth() + 1);
  const d = day || new Date().getDate();
  const h = hour || (new Date().getHours() === 0 ? 12 : Math.ceil(new Date().getHours() / 2)); // 时辰(1-12)

  const upperNum = (y + m + d) % 8 || 8;
  const lowerNum = (y + m + d + h) % 8 || 8;
  const changingPos = (y + m + d + h) % 6 || 6;

  // 梅花卦以上卦为外(爻4-6)、下卦为内(爻1-3)
  const upper = MEIHUA_TRIGRAMS[upperNum - 1];
  const lower = MEIHUA_TRIGRAMS[lowerNum - 1];
  const primary = lower + upper; // 自下而上：下卦+上卦

  // 动爻：changingPos 位置阴阳翻转
  const changedArr = primary.split('');
  changedArr[changingPos - 1] = changedArr[changingPos - 1] === '1' ? '0' : '1';
  const changed = changedArr.join('');

  // 构造 values（仅用于统一结构，梅花无6789概念，按翻转标记变爻）
  const values = primary.split('').map((b, i) => {
    const yang = b === '1';
    // 动爻位标为老阳9/老阴6，否则少阳7/少阴8
    if (i + 1 === changingPos) return yang ? 9 : 6;
    return yang ? 7 : 8;
  });

  return {
    method: 'meihua', values,
    meta: { upperNum, lowerNum, changingPos, year: y, month: m, day: d, hour: h },
    primary, changed, changing: [changingPos],
  };
}

// ---- 变爻解读规则 ----
// 经典占断法则（朱熹《启蒙》之说为通行本）：
// 0 变爻：以本卦卦辞断
// 1 变爻：以本卦变爻爻辞断
// 2 变爻：以本卦两变爻爻辞断，以上爻为主
// 3 变爻：以本卦卦辞、变卦卦辞合参
// 4 变爻：以变卦两不变爻爻辞断，以下爻为主
// 5 变爻：以变卦不变爻爻辞断
// 6 变爻：以变卦卦辞断（乾/坤看用九/用六）
export function readingRule(changingCount) {
  const rules = {
    0: { focus: '本卦卦辞', desc: '本卦无变爻，以本卦卦辞为占。' },
    1: { focus: '本卦变爻', desc: '一爻变，以本卦变爻爻辞为占。' },
    2: { focus: '本卦变爻（上为主）', desc: '二爻变，以本卦两变爻爻辞合参，以上变爻为主。' },
    3: { focus: '本卦+变卦卦辞', desc: '三爻变，以本卦卦辞与变卦卦辞合参。' },
    4: { focus: '变卦不变爻（下为主）', desc: '四爻变，以变卦两不变爻爻辞合参，以下不变爻为主。' },
    5: { focus: '变卦不变爻', desc: '五爻变，以变卦不变爻爻辞为占。' },
    6: { focus: '变卦卦辞', desc: '六爻全变，以变卦卦辞为占（乾坤看用九/用六）。' },
  };
  return rules[changingCount] || rules[0];
}

// 根据解读规则 + 卦数据，提取要展示的经文片段
export function extractReading(result, hexIndex) {
  const rule = readingRule(result.changing.length);
  const primary = hexIndex.byCode.get(result.primary);
  const changed = result.changed !== result.primary ? hexIndex.byCode.get(result.changed) : null;
  const out = { rule, primary, changed, refs: [] };

  const n = result.changing.length;
  if (n === 0) {
    out.refs.push({ label: '本卦卦辞', text: primary?.judgement });
  } else if (n === 1) {
    const y = primary?.lines[result.changing[0] - 1];
    out.refs.push({ label: '本卦变爻', text: y?.text, xiang: y?.xiang });
  } else if (n === 2) {
    result.changing.forEach((p) => {
      const y = primary?.lines[p - 1];
      out.refs.push({ label: `本卦·${primary?.lines[p-1] ? yaoLbl(y) : '爻'+p}`, text: y?.text });
    });
  } else if (n === 3) {
    out.refs.push({ label: '本卦卦辞', text: primary?.judgement });
    if (changed) out.refs.push({ label: '变卦卦辞', text: changed.judgement });
  } else if (n === 4 || n === 5) {
    const baseHex = changed;
    const unchanged = [1,2,3,4,5,6].filter((p) => !result.changing.includes(p));
    unchanged.forEach((p) => {
      const y = baseHex?.lines[p - 1];
      out.refs.push({ label: `变卦·爻${p}`, text: y?.text });
    });
  } else if (n === 6) {
    if (changed) out.refs.push({ label: '变卦卦辞', text: changed.judgement });
    if (primary?.name === '乾') out.refs.push({ label: '用九', text: primary.useNine });
    if (primary?.name === '坤') out.refs.push({ label: '用六', text: primary.useSix });
  }
  return out;
}

function yaoLbl(y) {
  if (!y) return '';
  const names = ['', '初', '二', '三', '四', '五', '上'];
  const yy = y.isYang ? '九' : '六';
  return (y.position === 1 || y.position === 6) ? `${names[y.position]}${yy}` : `${yy}${names[y.position]}`;
}

export { isYang, isChanging };
