// 二十四节气（定气）算法。
// 基于天文层 astronomy.js 的 solarTermJD，求太阳视黄经达指定度数的精确交节时刻。
// 所有对外时刻为北京时间（UTC+8）。
//
// 黄经起点：春分 = 0°，按黄经每 15° 一节气，全年共 24 气。

import { toJD, fromJD, solarTermJD } from './astronomy.js';

// 北京时间相对 UTC 的时差（小时）。
const BEIJING_TZ = 8;

// 二十四节气（按黄经递增排列）。春分为 0°。
// 名称沿用传统，数组顺序对应一年内（自春分起）的太阳黄经递增序列。
export const SOLAR_TERMS = [
  { name: '春分', longitude: 0 },
  { name: '清明', longitude: 15 },
  { name: '谷雨', longitude: 30 },
  { name: '立夏', longitude: 45 },
  { name: '小满', longitude: 60 },
  { name: '芒种', longitude: 75 },
  { name: '夏至', longitude: 90 },
  { name: '小暑', longitude: 105 },
  { name: '大暑', longitude: 120 },
  { name: '立秋', longitude: 135 },
  { name: '处暑', longitude: 150 },
  { name: '白露', longitude: 165 },
  { name: '秋分', longitude: 180 },
  { name: '寒露', longitude: 195 },
  { name: '霜降', longitude: 210 },
  { name: '立冬', longitude: 225 },
  { name: '小雪', longitude: 240 },
  { name: '大雪', longitude: 255 },
  { name: '冬至', longitude: 270 },
  { name: '小寒', longitude: 285 },
  { name: '大寒', longitude: 300 },
  { name: '立春', longitude: 315 },
  { name: '雨水', longitude: 330 },
  { name: '惊蛰', longitude: 345 },
];

// 名称 → 黄经度
const TERM_BY_NAME = Object.fromEntries(SOLAR_TERMS.map((t) => [t.name, t.longitude]));

// 节气在公历年中的近似（月,日），用于给定一个粗略 UT 起点，供迭代收敛。
// 数据来自长期平均，已足够靠近真实交节日（误差通常 <2 天），迭代可稳定收敛。
const TERM_APPROX = {
  小寒: [1, 6],
  大寒: [1, 20],
  立春: [2, 4],
  雨水: [2, 19],
  惊蛰: [3, 6],
  春分: [3, 21],
  清明: [4, 5],
  谷雨: [4, 20],
  立夏: [5, 6],
  小满: [5, 21],
  芒种: [6, 6],
  夏至: [6, 21],
  小暑: [7, 7],
  大暑: [7, 23],
  立秋: [8, 8],
  处暑: [8, 23],
  白露: [9, 8],
  秋分: [9, 23],
  寒露: [10, 8],
  霜降: [10, 23],
  立冬: [11, 7],
  小雪: [11, 22],
  大雪: [12, 7],
  冬至: [12, 22],
};

// 求某年某节气的精确交节时刻，返回 Date 对象（北京时间，本地构造）。
// year 为公历年；termName 为节气名（如 '夏至'）。
export function solarTermDate(year, termName) {
  const target = TERM_BY_NAME[termName];
  const [m, d] = TERM_APPROX[termName];
  // 粗估 UT 起点（北京近似日 - 8h）。给到 0 时即可，迭代会逼近精确时刻。
  const jdApprox = toJD(year, m, d, 0) - BEIJING_TZ / 24;
  const jd = solarTermJD(jdApprox, target);
  // JD(UT) → 北京时间（UT + 8h）
  const g = fromJD(jd + BEIJING_TZ / 24);
  // 用本地时区无关构造：直接用数值构建 Date（按北京时数值）。
  return new Date(g.y, g.m - 1, g.d, g.h, g.mi, g.s);
}

// 获取某日期当前所处的节气及相邻信息。
// 返回 { current, next, daysToNext, daysSince }
//   current/next : 当前节气名 / 下一节气名
//   daysSince    : 距当前节气交节已过整天数
//   daysToNext   : 距下一节气交节的剩余整天数
export function currentSolarTerm(date) {
  const year = date.getFullYear();
  // 一节气可跨年（冬至在年末、小寒大寒在年初等），故收集本年全部 24 气，
  // 并补上一年末尾的冬至与下一年初的小寒，确保任意 date 都落在某个区间内。
  const nodes = [];
  for (const t of SOLAR_TERMS) {
    nodes.push({ name: t.name, longitude: t.longitude, date: solarTermDate(year, t.name) });
  }
  // 补边界
  const prevWinter = { name: '冬至', longitude: 270, date: solarTermDate(year - 1, '冬至') };
  const nextMinorCold = { name: '小寒', longitude: 285, date: solarTermDate(year + 1, '小寒') };
  nodes.push(prevWinter, nextMinorCold);

  // 按时刻排序
  nodes.sort((a, b) => a.date - b.date);

  // 找 date 所在区间：current 是 date 之前最近的节气，next 是其后者
  let current = prevWinter;
  let next = nextMinorCold;
  for (let i = 0; i < nodes.length - 1; i++) {
    if (nodes[i].date <= date && nodes[i + 1].date > date) {
      current = nodes[i];
      next = nodes[i + 1];
      break;
    }
  }
  // 兜底：date 早于所有节点
  if (date < nodes[0].date) {
    current = nodes[0];
    next = nodes[1];
  }

  const msPerDay = 86400000;
  const daysSince = Math.floor((date - current.date) / msPerDay);
  const daysToNext = Math.ceil((next.date - date) / msPerDay);
  return { current: current.name, next: next.name, daysToNext, daysSince };
}
