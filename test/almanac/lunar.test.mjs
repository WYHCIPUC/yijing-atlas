// 农历编排回归测试。
// 运行：node test/almanac/lunar.test.mjs
//
// 验证基准（对照官方农历/紫金山天文台《新编万年历》）：
//   2026/7/1  → 丙午年 五月 十七 (非闰)
//   2026/2/17 → 丙午年 正月 初一 (2026 春节)
//   2025/1/29 → 乙巳年 正月 初一 (2025 春节)
//   2023/3/22 → 癸卯年 闰二月 初一 (闰月！关键测试)
//   2025/12/21 → 乙巳年 十一月 初二
//   2024/2/10 → 甲辰年 正月 初一 (2024 春节)
//
// 农历年份以春节(正月初一)为界：农历年的干支标签 = 该农历年春节所在公历年的年干支。
// 故校验时用 ganzhi.js 的 yearGanZhi(春节日) 取标签，再与期望比对。

import { solarToLunar, buildLunarMonths } from '../../web/js/almanac/lunar.js';
import { yearGanZhi } from '../../web/js/almanac/ganzhi.js';

const asserts = [];

function gzLabel(year) {
  // 用该年正月初一前后取年干支（立春界定）。这里只取标签名，直接用年中日期近似即可，
  // 因为农历年的干支标签与"立春~次年立春"的年干支一致（春节总在立春前后15天内，
  // 不跨越立春所在公历年的年干支）。取 3 月 1 日（必在立春后）以稳妥。
  return yearGanZhi(new Date(year, 2, 1)).name;
}

// ---- 用例定义 ----
// [公历y,m,d, 期望农历year标签, 期望month, 期望day, 期望isLeap, 说明]
const cases = [
  { g: [2026, 6, 1], label: '丙午', month: 5, day: 17, leap: false, note: '2026/7/1' },
  { g: [2026, 1, 17], label: '丙午', month: 1, day: 1, leap: false, note: '2026春节' },
  { g: [2025, 0, 29], label: '乙巳', month: 1, day: 1, leap: false, note: '2025春节' },
  { g: [2023, 2, 22], label: '癸卯', month: 2, day: 1, leap: true, note: '2023闰二月初一(关键)' },
  { g: [2025, 11, 21], label: '乙巳', month: 11, day: 2, leap: false, note: '2025冬至次日' },
  { g: [2024, 1, 10], label: '甲辰', month: 1, day: 1, leap: false, note: '2024春节' },
];

for (const c of cases) {
  const date = new Date(c.g[0], c.g[1], c.g[2], 12, 0, 0); // 取正午避免时区/日界抖动
  const r = solarToLunar(date);
  const okYear = gzLabel(r.year) === c.label;
  const okMonth = r.month === c.month;
  const okDay = r.day === c.day;
  const okLeap = r.isLeap === c.leap;
  const ok = okYear && okMonth && okDay && okLeap;
  asserts.push({ name: c.note, ok });
  const tag = `${c.label}年 ${r.isLeap ? '闰' : ''}${r.month}月 ${r.day}日`;
  console.log(
    `${ok ? '✓' : '✗'} ${c.note.padEnd(20)} → ${tag}` +
      ` (期望 ${c.label}年 ${c.leap ? '闰' : ''}${c.month}月 ${c.day}日)` +
      (!ok ? `  [Y:${okYear} M:${okMonth} D:${okDay} L:${okLeap}]` : ''),
  );
}

// ---- 月份天数合理性：每个农历月 29 或 30 天 ----
{
  const { months } = buildLunarMonths(new Date(2026, 6, 1, 12));
  let allValid = true;
  for (const mo of months) {
    if (mo.days !== 29 && mo.days !== 30) allValid = false;
  }
  asserts.push({ name: '朔月天数均为29/30', ok: allValid });
  console.log(`${allValid ? '✓' : '✗'} 朔月天数均为29/30: ${allValid ? '通过' : '存在异常天数'}`);
}

// ---- 全年月序单调递增（每个农历年内 11,12,1,2,...,10 循环正确）----
// 序列跨 ~15 个朔月覆盖两个冬至周期，故月序会出现 11,12,1,..,10,11,12,1 这种
// 跨年循环——这是正确行为（不是 bug）。校验：每个非闰月月序与前一个的差恰为
// (1, 或从12绕回1)，即满足"中气月序"递增关系。
{
  const { months } = buildLunarMonths(new Date(2026, 6, 1, 12));
  const nonLeap = months.filter((m) => !m.isLeap).map((m) => m.month);
  // 相邻非闰月月序差应为 +1（或 12→1 绕回 = +1 mod 12）
  let monotonic = true;
  for (let i = 1; i < nonLeap.length; i++) {
    const prev = nonLeap[i - 1];
    const cur = nonLeap[i];
    const expect = (prev % 12) + 1; // 11→12, 12→1, 1→2, ...
    if (cur !== expect) monotonic = false;
  }
  asserts.push({ name: '非闰月月序按中气递增', ok: monotonic });
  console.log(`${monotonic ? '✓' : '✗'} 非闰月月序按中气递增: ${monotonic ? '通过' : '失败'} (${nonLeap.join(',')})`);
}

// ---- 跨春节边界：2026/2/16（春节前一天）应为上年腊月 ----
{
  // 2026 春节 2/17，前一天 2/16 应属 乙巳年 腊月
  const r = solarToLunar(new Date(2026, 1, 16, 12));
  const ok = gzLabel(r.year) === '乙巳' && r.month === 12;
  asserts.push({ name: '春节前一天=上年腊月', ok });
  console.log(`${ok ? '✓' : '✗'} 2026/2/16(春节前) → ${gzLabel(r.year)}年 ${r.isLeap ? '闰' : ''}${r.month}月 ${r.day}日 (期望 乙巳年 腊月)`);
}

// ---- 闰月区间内部连续性：2023 闰二月内某日仍为闰二月 ----
{
  // 闰二月初一之后几天应仍为闰二月
  const r1 = solarToLunar(new Date(2023, 2, 22, 12)); // 闰二月初一
  const r2 = solarToLunar(new Date(2023, 2, 28, 12)); // 闰二月内
  const ok = r1.isLeap && r1.month === 2 && r2.isLeap && r2.month === 2;
  asserts.push({ name: '闰二月区间连续', ok });
  console.log(`${ok ? '✓' : '✗'} 2023/3/28(闰二月内) → ${r2.isLeap ? '闰' : ''}${r2.month}月 ${r2.day}日`);
}

const failed = asserts.filter((a) => !a.ok);
console.log(failed.length ? `\n${failed.length} 项失败` : '\n全部通过');
process.exit(failed.length ? 1 : 0);
