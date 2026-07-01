// 二十四节气回归测试。
// 运行：node test/almanac/solar-terms.test.mjs
//
// 验证基准（北京时间 UTC+8），以中国科学院紫金山天文台《中国天文年历》/
// 香港天文台二十四节气表为准（任务原始基准经核实存在约 5.6h 系统偏差，
// 疑为 UT→北京时方向取反；本测试采用权威天文台交节时刻）：
//   2026 夏至 6/21 16:24（黄经90°）
//   2026 小暑 7/7 09:57（黄经105°）
//   2026 大暑 7/23 03:13（黄经120°）
//   2026 立秋 8/7 19:42（黄经135°）
//   2025 冬至 12/21 23:02（黄经270°）
// 容差：±1 小时（简化天文算法可接受；实际算法误差通常 <15 分钟）。

import { solarTermDate, currentSolarTerm, SOLAR_TERMS } from '../../web/js/almanac/solar-terms.js';

const asserts = [];

// 单节气校验：年/月/日/时(小时小数) 都在容差内。
function checkTerm(name, date, expM, expD, expH, tolH = 1) {
  const hours = date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
  const ok =
    date.getMonth() + 1 === expM &&
    date.getDate() === expD &&
    Math.abs(hours - expH) <= tolH;
  asserts.push({ name, ok });
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  console.log(
    `${ok ? '✓' : '✗'} ${name}: 北京 ${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()} ${hh}:${mm} (期望 ${expM}/${expD} ${expH.toFixed(2)}h, 容差${tolH}h)`,
  );
}

// ---- 2026 节气基准（权威天文台交节时刻）----
checkTerm('2026夏至', solarTermDate(2026, '夏至'), 6, 21, 16.4); // 16:24
checkTerm('2026小暑', solarTermDate(2026, '小暑'), 7, 7, 9.95); // 09:57
checkTerm('2026大暑', solarTermDate(2026, '大暑'), 7, 23, 3.22); // 03:13（注意 7/23）
checkTerm('2026立秋', solarTermDate(2026, '立秋'), 8, 7, 19.7); // 19:42
// ---- 2025 冬至 ----
checkTerm('2025冬至', solarTermDate(2025, '冬至'), 12, 21, 23.03); // 23:02

// ---- 全年节气日期合理性：每月日落在公历合理区间 ----
// 各节气的公历日期长期落在固定 ±2 天窗口内，校验算法不会算出离谱日期。
function checkRange(name, date, expM, dayMin, dayMax) {
  const ok = date.getMonth() + 1 === expM && date.getDate() >= dayMin && date.getDate() <= dayMax;
  asserts.push({ name, ok });
  console.log(
    `${ok ? '✓' : '✗'} ${name}: ${date.getMonth() + 1}/${date.getDate()} (期望 ${expM}/${dayMin}-${dayMax})`,
  );
}
checkRange('2024立春', solarTermDate(2024, '立春'), 2, 3, 5);
checkRange('2024春分', solarTermDate(2024, '春分'), 3, 19, 21);
checkRange('2024清明', solarTermDate(2024, '清明'), 4, 4, 6);
checkRange('2024冬至', solarTermDate(2024, '冬至'), 12, 21, 23);
checkRange('2026大寒', solarTermDate(2026, '大寒'), 1, 19, 21);
checkRange('2026惊蛰', solarTermDate(2026, '惊蛰'), 3, 5, 7);

// ---- 常量完整性：24 节气，黄经 0/15/.../345 ----
{
  const okLen = SOLAR_TERMS.length === 24;
  asserts.push({ name: '节气常量数量=24', ok: okLen });
  console.log(`${okLen ? '✓' : '✗'} 节气常量数量: ${SOLAR_TERMS.length}`);
  const okChunfen = SOLAR_TERMS[0].name === '春分' && SOLAR_TERMS[0].longitude === 0;
  asserts.push({ name: '春分=0°起点', ok: okChunfen });
  console.log(`${okChunfen ? '✓' : '✗'} 春分起点: ${SOLAR_TERMS[0].name} ${SOLAR_TERMS[0].longitude}°`);
  const okJingzhe = SOLAR_TERMS[23].name === '惊蛰' && SOLAR_TERMS[23].longitude === 345;
  asserts.push({ name: '惊蛰=345°末', ok: okJingzhe });
  console.log(`${okJingzhe ? '✓' : '✗'} 惊蛰末点: ${SOLAR_TERMS[23].name} ${SOLAR_TERMS[23].longitude}°`);
}

// ---- currentSolarTerm：2026/7/1 应落在 夏至(6/21 16:18) 之后、小暑(7/7 09:47) 之前 ----
{
  const info = currentSolarTerm(new Date(2026, 6, 1, 12, 0, 0)); // 2026/7/1 中午
  const okCur = info.current === '夏至' && info.next === '小暑';
  asserts.push({ name: 'currentSolarTerm 2026/7/1 当前=夏至', ok: okCur });
  console.log(`${okCur ? '✓' : '✗'} currentSolarTerm 2026/7/1: current=${info.current} next=${info.next} (期望 夏至→小暑)`);
  // 距 6/21 16:18 约 9.81 天(整9天)，距 7/7 09:47 约 5.9 天(整6天)。
  const okDays = info.daysSince === 9 && info.daysToNext === 6;
  asserts.push({ name: 'currentSolarTerm 天数', ok: okDays });
  console.log(`${okDays ? '✓' : '✗'} currentSolarTerm 天数: since=${info.daysSince} toNext=${info.daysToNext} (期望 9/6)`);
}

// ---- currentSolarTerm：跨年边界（2026/1/5 应在 小寒前、属 冬至→小寒 区间）----
{
  const info = currentSolarTerm(new Date(2026, 0, 3, 0, 0, 0)); // 2026/1/3
  const okCur = info.current === '冬至' && info.next === '小寒';
  asserts.push({ name: 'currentSolarTerm 跨年边界', ok: okCur });
  console.log(`${okCur ? '✓' : '✗'} currentSolarTerm 2026/1/3: current=${info.current} next=${info.next} (期望 冬至→小寒)`);
}

const failed = asserts.filter((a) => !a.ok);
console.log(failed.length ? `\n${failed.length} 项失败` : '\n全部通过');
process.exit(failed.length ? 1 : 0);
