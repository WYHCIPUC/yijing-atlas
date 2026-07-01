// 干支体系（天干地支）。在天文层 astronomy.js 与节气层 solar-terms.js 之上构建。
//
// 锚点（均经权威历书校准）：
//   - 日干支：以 JD(UT) 直接模 60 推算。校准基准 2000/1/1 = 戊午日(idx54)，
//     与 2026/7/1 = 丙子日(idx12) 交叉验证一致。换算关系：
//       dayIdx = ( floor(JD_noon_UT) + 49 ) mod 60
//     其中 JD_noon 取该日 0 时北京时对应的世界时日序（与公历日一一对应）。
//     （推导：2451545(J2000=2000/1/1正午) mod 60 = 5；54-5 = 49。）
//   - 年干支：1984 = 甲子年(idx0)，以"立春"为岁首（立春前归上一年）。
//   - 月干支：以"节气"为月界，正月建寅。"甲己之年丙作首"定正月天干。
//   - 时干支：子时(23:00-01:00)起。"甲己还加甲"定子时天干。

import { toJD } from './astronomy.js';
import { solarTermDate } from './solar-terms.js';

// 北京时相对 UT 时差（小时）。
const BEIJING_TZ = 8;

// 十天干。
export const TIAN_GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];

// 十二地支。
export const DI_ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

// 十二生肖（与地支一一对应：子鼠 丑牛 … 亥猪）。
export const SHENG_XIAO = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'];

// 六十甲子（顺序：甲子、乙丑、…、癸亥）。
// 第 k 项 = 天干[k%10] + 地支[k%12]，k=0..59。
export const SEXAGENARY = Array.from({ length: 60 }, (_, k) => TIAN_GAN[k % 10] + DI_ZHI[k % 12]);

// 纳音五行（60 项，对应六十甲子每柱）。采用流传最广的"六十甲子纳音歌"口径：
// 甲子乙丑海中金、丙寅丁卯炉中火、戊辰己巳大林木……
export const NAYIN = [
  '海中金', '海中金', // 甲子 乙丑
  '炉中火', '炉中火', // 丙寅 丁卯
  '大林木', '大林木', // 戊辰 己巳
  '路旁土', '路旁土', // 庚午 辛未
  '剑锋金', '剑锋金', // 壬申 癸酉
  '山头火', '山头火', // 甲戌 乙亥
  '涧下水', '涧下水', // 丙子 丁丑
  '城头土', '城头土', // 戊寅 己卯
  '白蜡金', '白蜡金', // 庚辰 辛巳
  '杨柳木', '杨柳木', // 壬午 癸未
  '泉中水', '泉中水', // 甲申 乙酉
  '屋上土', '屋上土', // 丙戌 丁亥
  '霹雳火', '霹雳火', // 戊子 己丑
  '松柏木', '松柏木', // 庚寅 辛卯
  '长流水', '长流水', // 壬辰 癸巳
  '砂石金', '砂石金', // 甲午 乙未
  '山下火', '山下火', // 丙申 丁酉
  '平地木', '平地木', // 戊戌 己亥
  '壁上土', '壁上土', // 庚子 辛丑
  '金箔金', '金箔金', // 壬寅 癸卯
  '佛灯火', '佛灯火', // 甲辰 乙巳
  '天河水', '天河水', // 丙午 丁未
  '大驿土', '大驿土', // 戊申 己酉
  '钗钏金', '钗钏金', // 庚戌 辛亥
  '桑柘木', '桑柘木', // 壬子 癸丑
  '大溪水', '大溪水', // 甲寅 乙卯
  '砂中土', '砂中土', // 丙辰 丁巳
  '天上火', '天上火', // 戊午 己未
  '石榴木', '石榴木', // 庚申 辛酉
  '大海水', '大海水', // 壬戌 癸亥
];

// 月份地支（寅月起 = 正月）。月支按节气推进，固定：寅卯辰巳午未申酉戌亥子丑。
// 即从立春(寅月始)起，依次对应 12 个"节"（非中气）：立春/惊蛰/清明/立夏/芒种/
// 小暑/立秋/白露/寒露/立冬/大雪/小寒。
const MONTH_ZHI = ['寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥', '子', '丑'];

// 月首"节"（按时间顺序，自立春起）——即每个干支月的起始节气。
const MONTH_TERM_NAMES = [
  '立春', '惊蛰', '清明', '立夏', '芒种', '小暑',
  '立秋', '白露', '寒露', '立冬', '大雪', '小寒',
];

// 中文月名前缀（寅月=正月）。
const MONTH_NUM_CN = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '腊'];

// 时辰地支（子时起）。子 23-1、丑 1-3、…、亥 21-23。
const HOUR_ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

// ---- 工具 ----
function mod(n, m) {
  return ((n % m) + m) % m;
}

// 北京时间的 Date → 该日的"日序"(用于日干支)。
// 干支日以"日"为单位循环，与公历日一一对应，故取该公历日的儒略日数(JDN，以正午为整数日界)。
// 锚点：JDN(2000/1/1)=2451545 → (2451545 + 49) mod 60 = 54 = 戊午（历书校准通过）。
// 时区不影响日序（一个公历日对应一个干支日）。
function daySerial(date) {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  return Math.floor(toJD(y, m, d, 12));
}

// ============================================================
// 日干支 dayGanZhi(jd)：可传 JD(UT) 或 Date。返回 {idx, name, gan, zhi, nayin}
// ============================================================
export function dayGanZhi(input) {
  let serial;
  if (input instanceof Date) {
    serial = daySerial(input);
  } else {
    // 视为 JD(UT)：日序 = floor(jd + 0.5)
    serial = Math.floor(input + 0.5);
  }
  // dayIdx = (serial + 49) mod 60
  const idx = mod(serial + 49, 60);
  return {
    idx,
    name: SEXAGENARY[idx],
    gan: TIAN_GAN[idx % 10],
    zhi: DI_ZHI[idx % 12],
    ganIdx: idx % 10,
    zhiIdx: idx % 12,
    nayin: NAYIN[idx],
  };
}

// ============================================================
// 年干支 yearGanZhi(date)：以立春为界。
// 返回 {idx, name, gan, zhi, ganIdx, zhiIdx, animal, nayin, year}
// ============================================================
export function yearGanZhi(date) {
  const cy = date.getFullYear();
  // 立春时刻（北京时）。date 可能在年初，取当年立春比较。
  const lichun = solarTermDate(cy, '立春');
  // 立春前归上一年
  const gzYear = date < lichun ? cy - 1 : cy;
  // 1984 = 甲子(idx0) → idx = (year - 1984) mod 60 = (year - 4) mod 60
  const idx = mod(gzYear - 1984, 60);
  const zhiIdx = idx % 12;
  return {
    idx,
    name: SEXAGENARY[idx],
    gan: TIAN_GAN[idx % 10],
    zhi: DI_ZHI[zhiIdx],
    ganIdx: idx % 10,
    zhiIdx,
    animal: SHENG_XIAO[zhiIdx],
    nayin: NAYIN[idx],
    year: gzYear,
  };
}

// ============================================================
// 月干支 monthGanZhi(date)：以节气为界，正月建寅。
// "甲己之年丙作首"：年干甲/己 → 正月天干起丙。规律：
//   年干序 ganYear(0..9)；正月天干序 = (ganYear % 5) * 2 + 2  （甲0→丙2，乙1→戊4…）
// 返回 {idx, name, gan, zhi, ganIdx, zhiIdx, monthIndex(0-11,寅为0), monthName, ...}
// ============================================================
export function monthGanZhi(date) {
  // 1. 确定 date 所在的"干支月"：找 date 之前最近的一个月首节气(节)。
  //    12 个节按时间分布，可能跨年，故枚举当年与上一年的节。
  const cy = date.getFullYear();
  const nodes = [];
  for (let y = cy - 1; y <= cy + 1; y++) {
    for (const tname of MONTH_TERM_NAMES) {
      nodes.push({ name: tname, date: solarTermDate(y, tname) });
    }
  }
  nodes.sort((a, b) => a.date - b.date);

  // 找 date 之前最近的节（含）
  let cur = nodes[0];
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].date <= date) cur = nodes[i];
    else break;
  }
  // 该节在 MONTH_TERM_NAMES 中的下标 = 干支月序 monthIndex(寅=0)
  let monthIndex = MONTH_TERM_NAMES.indexOf(cur.name);
  if (monthIndex < 0) monthIndex = 0;

  // 2. 确定该干支月所属的"年干"（以立春为界）。
  //    某干支月归属哪一年，取决于其起始"节"落在哪个立春之后：
  //    年干年份 = 该月起始"节"时刻之前最近的一次立春所在公历年。
  //    （寅月始于立春，故寅月及其后 11 个月干支月都归属同一年干。）
  let gzYear;
  let lastLC = null;
  for (let y = cy - 1; y <= cy + 1; y++) {
    const lc = solarTermDate(y, '立春');
    if (lc <= cur.date) lastLC = lc;
  }
  gzYear = lastLC ? lastLC.getFullYear() : cy;
  const ganYearIdx = mod(gzYear - 1984, 60) % 10;

  // 3. 正月天干序：(ganYearIdx % 5) * 2 + 2
  //    甲己(0,5)→丙(2)；乙庚(1,6)→戊(4)；丙辛(2,7)→庚(6)；丁壬(3,8)→壬(8)；戊癸(4,9)→甲(0)
  const zhengGan = mod((ganYearIdx % 5) * 2 + 2, 10);
  // 该月天干 = 正月天干 + monthIndex
  const ganIdx = mod(zhengGan + monthIndex, 10);
  const zhiIdx = mod(2 + monthIndex, 12); // 寅=2 起
  const idx = SEXAGENARY.findIndex(
    (s) => s === TIAN_GAN[ganIdx] + DI_ZHI[zhiIdx],
  );
  const monthName = (MONTH_NUM_CN[monthIndex] || '?') + '月';
  return {
    idx,
    name: SEXAGENARY[idx],
    gan: TIAN_GAN[ganIdx],
    zhi: DI_ZHI[zhiIdx],
    ganIdx,
    zhiIdx,
    monthIndex,
    monthName,
    term: cur.name,
    year: gzYear,
  };
}

// ============================================================
// 时干支 hourGanZhi(date)：子时(23-1)起。"甲己还加甲"。
// "甲己还加甲"：日干甲/己 → 子时天干起甲。规律：
//   日干序 ganDay(0..9)；子时天干序 = (ganDay % 5) * 2  （甲0→甲0，乙1→丙2…）
// 返回 {idx, name, gan, zhi, ganIdx, zhiIdx, hourIndex(0-11,子为0)}
// ============================================================
export function hourGanZhi(date) {
  // 1. 时辰地支：23-1=子(0),1-3=丑(1),…,21-23=亥(11)
  //    注意 23:00-24:00 属次日子时（传统分日）。本实现按"当日 0-23"映射，
  //    23 点归为当日子时（早子时）；如需严格"夜子时归次日"可在调用方处理。
  const h = date.getHours();
  const mi = date.getMinutes();
  const hourFrac = h + mi / 60;
  // 23:00 起为子时(0)；其余 (h+1)/2 取整
  let hourIndex;
  if (hourFrac >= 23) hourIndex = 0;
  else hourIndex = Math.floor((hourFrac + 1) / 2); // 1-3→1(丑), …, 21-23→11(亥)
  if (hourIndex > 11) hourIndex = 0;

  // 2. 日干
  const day = dayGanZhi(date);
  const ganDayIdx = day.ganIdx;
  // 子时天干序 = (ganDayIdx % 5) * 2
  //   甲己(0,5)→甲(0)；乙庚(1,6)→丙(2)；丙辛(2,7)→戊(4)；丁壬(3,8)→庚(6)；戊癸(4,9)→壬(8)
  const ziGan = mod((ganDayIdx % 5) * 2, 10);
  const ganIdx = mod(ziGan + hourIndex, 10);
  const zhiIdx = hourIndex;
  const idx = SEXAGENARY.findIndex(
    (s) => s === TIAN_GAN[ganIdx] + DI_ZHI[zhiIdx],
  );
  return {
    idx,
    name: SEXAGENARY[idx],
    gan: TIAN_GAN[ganIdx],
    zhi: DI_ZHI[zhiIdx],
    ganIdx,
    zhiIdx,
    hourIndex,
  };
}

// ============================================================
// 便捷：四柱（年月日时）一把梭。
// 返回 {year, month, day, hour} 各为干支对象。
// ============================================================
export function baZi(date) {
  return {
    year: yearGanZhi(date),
    month: monthGanZhi(date),
    day: dayGanZhi(date),
    hour: hourGanZhi(date),
  };
}
