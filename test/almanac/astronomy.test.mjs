// 天文基础回归测试。
// 运行：node test/almanac/astronomy.test.mjs
//
// 验证基准（北京时间 UTC+8）—— 以中国科学院紫金山天文台《中国天文年历》/
// 香港天文台二十四节气表为准（任务原始基准经核实存在约 5.6h 系统偏差，
// 疑为 UT→北京时方向取反；本测试采用权威天文台交节时刻）：
//   2026 夏至 6/21 16:24（黄经90°）
//   2026 小暑 7/7 09:57（黄经105°）
//   2026 大暑 7/23 03:13（黄经120°）
//   2026 立秋 8/7 19:42（黄经135°）
//   2025 冬至 12/21 23:02（黄经270°）
//   2024/7/1 太阳黄经约 99.7°
//   JD 往返 2000/1/1 12:00
// 容差：±1 小时（简化天文算法可接受；实际算法误差通常 <15 分钟）。

import {
  toJD,
  fromJD,
  sunLongitude,
  moonLongitude,
  solarTermJD,
  newMoonJD,
} from '../../web/js/almanac/astronomy.js';

const asserts = [];
function approx(name, val, expect, tol) {
  const ok = Math.abs(val - expect) <= tol;
  asserts.push({ name, val, expect, tol, ok });
  console.log(
    `${ok ? '✓' : '✗'} ${name}: ${typeof val === 'number' ? val.toFixed(4) : val} (期望≈${expect}, 容差${tol})`,
  );
}

// ---- JD 往返 ----
{
  const jd = toJD(2000, 1, 1, 12, 0, 0);
  approx('JD 2000/1/1 12:00 值', jd, 2451545.0, 0.0001);
  const d = fromJD(jd);
  approx('JD往返-年', d.y, 2000, 0);
  approx('JD往返-月', d.m, 1, 0);
  approx('JD往返-日', d.d, 1, 0);
  approx('JD往返-时', d.h, 12, 0);
  approx('JD往返-分', d.mi, 0, 0);
}

// ---- JD 往返：另一组含时分 ----
{
  const jd = toJD(2026, 7, 1, 8, 30, 15);
  const d = fromJD(jd);
  approx('JD往返2-年', d.y, 2026, 0);
  approx('JD往返2-月', d.m, 7, 0);
  approx('JD往返2-日', d.d, 1, 0);
  approx('JD往返2-时', d.h, 8, 0);
  approx('JD往返2-分', d.mi, 30, 0);
}

// ---- 太阳黄经基本范围（2024/7/1 约 99°）----
// 2024/7/1 0时 UT = 北京时间 8:00，黄经应在夏至(90°)后约10天 ≈ 99-100°
{
  const lon = sunLongitude(toJD(2024, 7, 1, 0));
  approx('2024/7/1 太阳黄经', lon, 99.6, 3);
}

// ---- 定气（节气时刻），北京时间 = UT+8 ----
// 验证函数：给定目标黄经，求精确 jd(UT)，再转北京时校验月日时。
const BEIJING_OFFSET_HOURS = 8;

function checkSolarTerm(name, approxUT, targetLon, expBJ_M, expBJ_D, expBJ_H, tolH) {
  const jd = solarTermJD(approxUT, targetLon);
  const bj = fromJD(jd + BEIJING_OFFSET_HOURS / 24);
  const hours = bj.h + bj.mi / 60 + bj.s / 3600;
  const okDate = bj.m === expBJ_M && bj.d === expBJ_D;
  const okTime = Math.abs(hours - expBJ_H) <= tolH;
  const ok = okDate && okTime;
  asserts.push({ name, ok });
  console.log(
    `${ok ? '✓' : '✗'} ${name}: 北京 ${bj.y}/${bj.m}/${bj.d} ${String(bj.h).padStart(2, '0')}:${String(bj.mi).padStart(2, '0')} (期望 ${expBJ_M}/${expBJ_D} ${expBJ_H}h, 容差${tolH}h)`,
  );
}

// 用近似 UT 起点（北京时间近似日 - 8h 给 UT）。
// 2026 夏至 6/21 16:24 北京 → 近似 UT 6/21 08:24
checkSolarTerm('2026夏至(90°)', toJD(2026, 6, 21, 8, 24), 90, 6, 21, 16.4, 1);
// 2026 小暑 7/7 09:57 北京
checkSolarTerm('2026小暑(105°)', toJD(2026, 7, 7, 1, 57), 105, 7, 7, 9.95, 1);
// 2026 大暑 7/23 03:13 北京（注意是 7/23，非 7/22）
checkSolarTerm('2026大暑(120°)', toJD(2026, 7, 22, 19, 13), 120, 7, 23, 3.22, 1);
// 2026 立秋 8/7 19:42 北京
checkSolarTerm('2026立秋(135°)', toJD(2026, 8, 7, 11, 42), 135, 8, 7, 19.7, 1);
// 2025 冬至 12/21 23:02 北京
checkSolarTerm('2025冬至(270°)', toJD(2025, 12, 21, 15, 2), 270, 12, 21, 23.03, 1);

// ---- 定朔基本合理性：2026 春节(正月初一)为 2026/2/17 ----
// 给一个 2026/2/17 附近 UT，定朔应落在该日左右。
{
  const jd = newMoonJD(toJD(2026, 2, 17, 0));
  const bj = fromJD(jd + BEIJING_OFFSET_HOURS / 24);
  const ok = bj.y === 2026 && bj.m === 2 && bj.d === 17;
  asserts.push({ name: '定朔-2026春节', ok });
  console.log(`${ok ? '✓' : '✗'} 定朔-2026春节: 北京 ${bj.y}/${bj.m}/${bj.d} (期望 2026/2/17)`);
}

// ---- 月亮黄经范围合法 ----
{
  const ml = moonLongitude(toJD(2026, 7, 1, 0));
  const ok = ml >= 0 && ml < 360;
  asserts.push({ name: '月亮黄经范围', ok });
  console.log(`${ok ? '✓' : '✗'} 月亮黄经范围: ${ml.toFixed(2)} (应 0-360)`);
}

const failed = asserts.filter((a) => !a.ok);
console.log(failed.length ? `\n${failed.length} 项失败` : '\n全部通过');
process.exit(failed.length ? 1 : 0);
