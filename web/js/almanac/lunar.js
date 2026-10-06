// 农历编排。在天文层 astronomy.js（定朔 newMoonJD / 定气 solarTermJD）之上构建。
//
// 核心算法（严格遵循传统历法规则）：
// 1. 农历月以"朔"（日月黄经相等）为初一，从一朔到下一朔为一个农历月。
// 2. 月序与闰月判定：含"冬至"的朔月为十一月（建子）。从此往后每个朔月，
//    若含某中气（黄经为偶数倍15°的节气：冬至270/大寒300/雨水330/春分0/
//    谷雨30/小满60/夏至90/大暑120/处暑150/秋分180/霜降210/小雪240），
//    则按中气对应序号命名（冬至→十一月、大寒→十二月、雨水→正月、…）；
//    若不含任何中气，则为闰月（紧跟同名前月）。
// 3. 农历年以"正月初一（春节）"为界。春节 = 含"雨水"中气的朔月的初一，
//    亦即从冬至朔月（十一月）起往后数第 3 个朔月（十一→腊→正）。
//
// 约定：所有 Date 输入按本地（实际为北京时 UTC+8）解释；朔/节气时刻也换算到北京时。

import { toJD, fromJD, newMoonJD, solarTermJD } from './astronomy.js';

// 北京时相对 UT 的时差（小时）。
const BEIJING_TZ = 8;

// 中气（黄经为偶数倍 15° 的节气）及其对应的农历月序号。
// 顺序按黄经递增排列：冬至(270)=11月, 大寒(300)=12月, 雨水(330)=1月, 春分(0)=2月,
// 谷雨(30)=3月, 小满(60)=4月, 夏至(90)=5月, 大暑(120)=6月, 处暑(150)=7月,
// 秋分(180)=8月, 霜降(210)=9月, 小雪(240)=10月。
// （这就是"以中气定月"——农历月序由其所含中气决定。）
const ZHONGQI_MONTH = [
  { longitude: 270, month: 11 }, // 冬至 → 十一月
  { longitude: 300, month: 12 }, // 大寒 → 十二月
  { longitude: 330, month: 1 }, // 雨水 → 正月
  { longitude: 0, month: 2 }, // 春分 → 二月
  { longitude: 30, month: 3 }, // 谷雨 → 三月
  { longitude: 60, month: 4 }, // 小满 → 四月
  { longitude: 90, month: 5 }, // 夏至 → 五月
  { longitude: 120, month: 6 }, // 大暑 → 六月
  { longitude: 150, month: 7 }, // 处暑 → 七月
  { longitude: 180, month: 8 }, // 秋分 → 八月
  { longitude: 210, month: 9 }, // 霜降 → 九月
  { longitude: 240, month: 10 }, // 小雪 → 十月
];

// 月序数字 → 中文月名前缀（不含"闰"）。
const MONTH_CN = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二'];

// Date 的字段按项目约定代表北京时间。农历日界按北京时间民用日处理，
// 因而不能直接拿 Date 的时分秒与朔的精确时刻比较。
function civilDateParts(date) {
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
  };
}

function civilDayNumber(year, month, day) {
  return Math.floor(Date.UTC(year, month - 1, day) / 86400000);
}

function civilDayNumberFromDate(date) {
  const parts = civilDateParts(date);
  return civilDayNumber(parts.year, parts.month, parts.day);
}

function civilDateFromJD(jd) {
  const g = fromJD(jd + BEIJING_TZ / 24);
  return {
    year: g.y,
    month: g.m,
    day: g.d,
    dayNumber: civilDayNumber(g.y, g.m, g.d),
  };
}

// 给定一个近似 JD，向前找最近的朔（newMoonJD 收敛到日月黄经相等点）。
// 返回朔的精确 JD(UT)。
function nearestNewMoonBefore(jdApprox) {
  // newMoonJD 以 jdApprox 为起点迭代收敛到"最近的"朔；为保证落在 date 之前，
  // 先估算当前月相：日月黄经差，回退到差>0 后再调 newMoonJD。
  // 简化：直接对 jdApprox 调一次得到一个朔，再视情况回退一个朔周期。
  let nm = newMoonJD(jdApprox);
  // 若返回的朔晚于 jdApprox（不应发生，但保险），回退一周期
  if (nm > jdApprox) nm = newMoonJD(jdApprox - 29.53);
  return nm;
}

// 求某中气（黄经 longitude）在近似时刻附近的精确交节 JD(UT)。
function zhongqiJD(jdApprox, longitude) {
  return solarTermJD(jdApprox, longitude);
}

// ---- 核心：构建一个农历月序列（朔月数组），覆盖包含 date 的农历年 ----
// 每个朔月: { nmJD(朔的JD,UT), days(本月天数,下朔-本朔), month(1-12), isLeap, hasZhongQi, year }
function buildLunarMonths(date) {
  // 1. 找出 date 所在公历年的冬至（含上一年的冬至作为农历年起算）。
  //    date 可能落在年初（春节前，属上农历年）或年末。统一做法：
  //    找 date 之前最近的一个冬至，作为该农历年的锚。
  const { year } = civilDateParts(date);
  const dateDay = civilDayNumberFromDate(date);

  // 冬至近似日：12/22 左右。先取 date 当年冬至、上一年的冬至，挑出 <= date 且最近的。
  // 但春节前的日期归属上一年农历年，故用"date 前最近冬至"作锚（这是建子年的起点）。
  let dongzhiYear = year;
  // 近似冬至 JD
  const dzApproxCur = toJD(year, 12, 22, 0) - BEIJING_TZ / 24;
  let dzJD = zhongqiJD(dzApproxCur, 270);
  if (civilDateFromJD(dzJD).dayNumber > dateDay) {
    // date 在本年冬至之前 → 锚用上一年冬至
    dongzhiYear = year - 1;
    dzJD = zhongqiJD(toJD(year - 1, 12, 22, 0) - BEIJING_TZ / 24, 270);
  }

  // 2. 找包含该冬至的朔月（此朔月的初一 <= 冬至 < 下一朔月初一）。即"十一月"。
  //    向前找冬至所在朔：从冬至时刻向前找最近的朔。
  const nm11 = nearestNewMoonBefore(dzJD);

  // 3. 从十一月朔起，向后生成连续 15 个朔（约覆盖整个农历年 + 边界）。
  //    每个朔月的边界为 [nmJD, nextNmJD)。逐月判定中气 → 月序 / 闰月。
  const SYNODIC = 29.53058867; // 朔望月平均
  const newMoons = [nm11];
  let cur = nm11;
  for (let i = 0; i < 15; i++) {
    // 下一朔：从当前朔 + 朔望月 起迭代
    const next = newMoonJD(cur + SYNODIC);
    newMoons.push(next);
    cur = next;
  }

  // 4. 把中气归入其所在朔月区间，赋予月序；无中气的朔月=闰月。
  //    每个朔月的中点距离边界不到 15 天，分别以中点求 12 个中气，
  //    再用精确 JD 严格判断 [朔, 下朔)。这样不会把边界前一天的中气
  //    通过容差误归到下一个月，2033 年冬至/朔的特殊边界也能正确编排。
  const months = [];
  for (let i = 0; i < newMoons.length - 1; i++) {
    const nmStart = newMoons[i];
    const nmEnd = newMoons[i + 1];
    const civilStart = civilDateFromJD(nmStart);
    const civilEnd = civilDateFromJD(nmEnd);
    const midpoint = (nmStart + nmEnd) / 2;
    const zq = ZHONGQI_MONTH.map((item) => ({
      ...item,
      jd: solarTermJD(midpoint, item.longitude),
    })).map((item) => ({
      ...item,
      civilDate: civilDateFromJD(item.jd),
    })).find((item) => (
      item.civilDate.dayNumber >= civilStart.dayNumber
      && item.civilDate.dayNumber < civilEnd.dayNumber
    ));
    months.push({
      nmJD: nmStart,
      nmEnd,
      civilStart,
      civilEnd,
      days: civilEnd.dayNumber - civilStart.dayNumber,
      hasZhongQi: !!zq,
      zhongQiMonth: zq ? zq.month : null,
      month: zq ? zq.month : null,
      isLeap: false,
    });
  }

  // 按相邻冬至之间的朔月数量编排月序。通常每个朔月恰好包含一个中气，
  // 但 2033 这样的特殊年会出现一个无中气月和一个含两个中气的月；
  // 不能把所有无中气月都标成闰月，否则会把闰月错移到二月。
  let cycleStart = 0;
  let cycleYear = dongzhiYear;
  while (cycleStart < months.length) {
    const nextDongzhi = zhongqiJD(
      toJD(cycleYear + 1, 12, 22, 0) - BEIJING_TZ / 24,
      270,
    );
    const nextDongzhiDay = civilDateFromJD(nextDongzhi).dayNumber;
    let cycleEnd = months.findIndex((month, index) => (
      index >= cycleStart
      && nextDongzhiDay >= month.civilStart.dayNumber
      && nextDongzhiDay < month.civilEnd.dayNumber
    ));
    if (cycleEnd < 0) cycleEnd = months.length;

    const cycleLength = cycleEnd - cycleStart;
    let leapOffset = -1;
    if (cycleLength === 13) {
      leapOffset = months
        .slice(cycleStart, cycleEnd)
        .findIndex((month, index) => index > 0 && !month.hasZhongQi);
      if (leapOffset < 0) leapOffset = 1;
    }

    let monthNumber = 11;
    for (let index = cycleStart; index < cycleEnd; index++) {
      const isLeap = index - cycleStart === leapOffset;
      months[index].isLeap = isLeap;
      months[index].month = isLeap ? null : monthNumber;
      if (!isLeap) monthNumber = (monthNumber % 12) + 1;
    }

    cycleStart = cycleEnd;
    cycleYear += 1;
  }

  return { months, dongzhiYear, dzJD };
}

// ---- 对外：solarToLunar(date) ----
// 返回 { year, month(1-12), day, isLeap, monthDays, monthName }
export function solarToLunar(date) {
  const dateDay = civilDayNumberFromDate(date);
  const { months } = buildLunarMonths(date);

  // 找 date 所在的朔月：按北京时间民用日序比较朔日，而非比较输入时刻。
  let idx = months.findIndex((mo) => dateDay >= mo.civilStart.dayNumber && dateDay < mo.civilEnd.dayNumber);
  if (idx < 0) {
    // 兜底：取第一个民用朔日不晚于 date 的月
    idx = months.reduce((best, mo, i) => (mo.civilStart.dayNumber <= dateDay ? i : best), 0);
  }
  const mo = months[idx];

  // ---- 定农历年序号（春节为界）----
  // 正月（春节）= 从十一月朔(建子)起往后第 3 个朔月（十一→腊→正），
  // 即月序号==1 的朔月。该正月初一所在的公历年范围 = 农历年。
  // 但需要"该农历年"的正月：若 date 所在月落在正月之前(十一、腊、或更早的闰)，
  // 则农历年 = 含该月所属春节的年份，春节可能在 date 之后的同公历年或下公历年。
  //
  // 稳健做法：扫描 months，找到月序==1 的朔月(春节)，其公历年即农历年基准；
  // 若 date 所在朔月在春节朔之前(月序为11/12，即建子/建丑)，则归属上一个春节的农历年。
  //
  // 更简单且正确：农历年 = 该农历年春节的公历年份。
  //   - 若 date 所在朔月 month in {1..10} 或 闰正..闰十 → 农历年 = 该月所属春节年；
  //   - 若 month in {11,12}（建子/建丑，即冬月/腊月）→ 农历年 = 下一个春节年减1？
  //     其实冬月/腊月属于"以次年春节为结尾"的那个农历年。
  //   - 若闰冬月/闰腊月(罕见)同理。
  //
  // 统一：找到该 months 序列中"月序==1"(正月/春节)的朔月 zhengIdx。
  // date 所在朔月 idx：
  //   若 idx < zhengIdx（即十一、腊等，在春节之前）→ 农历年 = 春节公历年 - 1
  //   若 idx >= zhengIdx（正月及之后）→ 农历年 = 春节公历年
  const zhengIdx = months.findIndex((mm) => mm.month === 1 && !mm.isLeap);
  let lunarYear;
  if (zhengIdx >= 0) {
    const springYear = months[zhengIdx].civilStart.year;
    if (idx < zhengIdx) {
      lunarYear = springYear - 1;
    } else {
      lunarYear = springYear;
    }
  } else {
    // 兜底（理论上 zhengIdx 必存在）
    lunarYear = date.getFullYear();
  }

  // ---- 月序与闰名 ----
  // 月序已按冬至周期编排；闰月沿用前一个非闰月的月序。
  let monthNum;
  if (mo.isLeap) {
    // 闰月沿用前一个非闰月的月序。
    let p = idx - 1;
    while (p >= 0 && months[p].isLeap) p--;
    monthNum = p >= 0 ? months[p].month : 11;
  } else {
    monthNum = mo.month;
  }

  // ---- 日 ----
  // 初一从朔所在的北京时间民用日开始，月长也按相邻朔日的日序差计算。
  const day = dateDay - mo.civilStart.dayNumber + 1;

  // ---- 月名 ----
  const baseName = MONTH_CN[monthNum - 1] + '月';
  const monthName = mo.isLeap ? '闰' + baseName : baseName;

  return {
    year: lunarYear,
    month: monthNum,
    day,
    isLeap: mo.isLeap,
    monthDays: mo.days,
    monthName,
  };
}

// 额外导出 buildLunarMonths（便于调试/上层"全年月份表"展示）。
export { buildLunarMonths };
