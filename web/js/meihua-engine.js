// 梅花易数引擎：邵康节所传，以时间/数字起卦，体用生克断吉凶。
// 核心口诀："卦以八除，爻以六除"。

// 先天八卦序：余数 1-8 → 二进制码（自下而上）
const XIANTIAN = ['', '111', '110', '101', '100', '011', '010', '001', '000'];
// 对应卦名
const XIANTIAN_NAME = ['', '乾', '兑', '离', '震', '巽', '坎', '艮', '坤'];

// 八卦 → 五行
const WUXING = {
  '111': 'metal', '110': 'metal',  // 乾兑=金
  '100': 'wood', '011': 'wood',     // 震巽=木
  '010': 'water',                    // 坎=水
  '101': 'fire',                     // 离=火
  '001': 'earth', '000': 'earth',   // 艮坤=土
};
const WUXING_NAME = { metal: '金', wood: '木', water: '水', fire: '火', earth: '土' };

// 五行相生：A生B
function wuxingSheng(a, b) {
  const sheng = { metal: 'water', water: 'wood', wood: 'fire', fire: 'earth', earth: 'metal' };
  return sheng[a] === b;
}
// 五行相克：A克B
function wuxingKe(a, b) {
  const ke = { metal: 'wood', wood: 'earth', earth: 'water', water: 'fire', fire: 'metal' };
  return ke[a] === b;
}

// 取余数（1-8 或 1-6），整除取除数本身
function mod(num, n) {
  const r = num % n;
  return r === 0 ? n : r;
}

/**
 * 数字起卦法
 * @param {number} upperNum - 上数
 * @param {number} lowerNum - 下数
 * @returns 起卦结果
 */
export function castByNumber(upperNum, lowerNum) {
  const upIdx = mod(upperNum, 8);
  const lowIdx = mod(lowerNum, 8);
  const upperTrigram = XIANTIAN[upIdx];  // 上卦
  const lowerTrigram = XIANTIAN[lowIdx]; // 下卦
  // 本卦：下卦(爻1-3) + 上卦(爻4-6)，自下而上
  const primaryCode = lowerTrigram + upperTrigram;
  // 动爻：(上数+下数)÷6 余数
  const yaoPos = mod(upperNum + lowerNum, 6);
  // 变卦：翻转动爻
  const changedArr = primaryCode.split('');
  changedArr[yaoPos - 1] = changedArr[yaoPos - 1] === '1' ? '0' : '1';
  const changedCode = changedArr.join('');
  return {
    upperTrigram, lowerTrigram,
    upperName: XIANTIAN_NAME[upIdx],
    lowerName: XIANTIAN_NAME[lowIdx],
    primaryCode, changedCode,
    changingPos: yaoPos,
    method: 'number',
    source: `上数 ${upperNum}，下数 ${lowerNum}`,
  };
}

// 地支序号（农历年）
const ZHI_NUM = { '子':1,'丑':2,'寅':3,'卯':4,'辰':5,'巳':6,'午':7,'未':8,'申':9,'酉':10,'戌':11,'亥':12 };
// 年干支→年支（简化：用年份推算地支）
function yearZhi(year) {
  const zhis = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
  return zhis[(year - 4) % 12];
}

/**
 * 时间起卦法（用公历近似农历，简化版）
 * 以当前时间的年月日时为依据。
 * @param {Date} date
 * @returns 起卦结果
 */
export function castByTime(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // 1-12
  const day = date.getDate();
  const hour = date.getHours();
  // 时辰数：23-1=子(1)，1-3=丑(2)...
  const hourZhi = Math.floor(((hour + 1) % 24) / 2) + 1;
  // 年支数
  const zhi = yearZhi(year);
  const zhiNum = ZHI_NUM[zhi];
  // 上数 = 年支 + 月 + 日；下数 = 年支 + 月 + 日 + 时辰
  const upperNum = zhiNum + month + day;
  const lowerNum = zhiNum + month + day + hourZhi;
  const result = castByNumber(upperNum, lowerNum);
  result.method = 'time';
  result.source = `${year}年${month}月${day}日 ${zhi}年 时辰${hourZhi}`;
  return result;
}

/**
 * 体用断卦：分析本卦的体卦与用卦的五行生克。
 * @param {Object} cast - castByNumber/castByTime 的结果
 * @returns 体用分析 + 断语
 */
export function analyzeTiYong(cast) {
  const { primaryCode, changingPos } = cast;
  // 动爻在下卦(1-3)→上卦为体、下卦为用；动爻在上卦(4-6)→下卦为体、上卦为用
  let bodyTrigram, useTrigram, bodyPos, usePos;
  if (changingPos <= 3) {
    // 动爻在下卦：上卦为体，下卦为用
    bodyTrigram = primaryCode.slice(3, 6); // 上卦
    useTrigram = primaryCode.slice(0, 3);  // 下卦
    bodyPos = '上卦'; usePos = '下卦';
  } else {
    // 动爻在上卦：下卦为体，上卦为用
    bodyTrigram = primaryCode.slice(0, 3);  // 下卦
    useTrigram = primaryCode.slice(3, 6);   // 上卦
    bodyPos = '下卦'; usePos = '上卦';
  }
  const bodyWx = WUXING[bodyTrigram];
  const useWx = WUXING[useTrigram];
  // 判定生克关系
  let relation, verdict;
  if (bodyWx === useWx) {
    relation = 'bihe'; verdict = '体用比和，五行相同。顺其自然，平稳无碍。';
  } else if (wuxingSheng(useWx, bodyWx)) {
    relation = 'yongshengti'; verdict = '用生体，所测之事助益自己。大吉，事可成，多有助益。';
  } else if (wuxingSheng(bodyWx, useWx)) {
    relation = 'tishengyong'; verdict = '体生用，自己耗费精力。小凶，事难成，劳神费力。';
  } else if (wuxingKe(bodyWx, useWx)) {
    relation = 'tikeyong'; verdict = '体克用，自己能控制局面。小吉，费力可成。';
  } else if (wuxingKe(useWx, bodyWx)) {
    relation = 'yongketi'; verdict = '用克体，所测之事阻碍自己。大凶，不宜妄动，事多不成。';
  }
  return {
    bodyTrigram, useTrigram, bodyPos, usePos,
    bodyWuxing: bodyWx, useWuxing: useWx,
    bodyWuxingName: WUXING_NAME[bodyWx],
    useWuxingName: WUXING_NAME[useWx],
    relation, verdict,
    relationName: { bihe:'比和', yongshengti:'用生体', tishengyong:'体生用', tikeyong:'体克用', yongketi:'用克体' }[relation],
  };
}

export { XIANTIAN, XIANTIAN_NAME, WUXING, WUXING_NAME };
