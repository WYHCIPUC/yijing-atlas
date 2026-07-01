// 干支体系回归测试。
// 运行：node test/almanac/ganzhi.test.mjs
//
// 验证基准（对照权威黄历/万年历，均经多源交叉校验）：
//
// 【年干支】（立春为界）
//   2026年 = 丙午年(马)
//   2024年 = 甲辰年(龙)
//   2024/2/3(立春前) = 癸卯年
//   2024/2/4 立春后 = 甲辰年
//
// 【日干支】锚点校准（核心）
//   锚点换算关系：dayIdx = (daySerial + 49) mod 60，其中 daySerial = floor(JD正午,UT)。
//   - 2000/1/1 = 戊午日(idx54)  [便民查询网万年历校准]
//   - 2026/7/1 = 丙子日(idx12)  [全民万年历校准]
//   - 2024/2/10(春节) = 甲辰日  [农历网校准]
//   - 2025/1/29(春节) = 戊戌日  [全民万年历校准]
//
// 【月干支】（以节气为界，正月建寅，"甲己之年丙作首"）
//   2024/2/10 = 丙寅月
//   2025/1/29 = 丁丑月
//   2026/7/1  = 甲午月
//
// 【时干支】（"甲己还加甲"）
//   2026/7/1(丙子日) 12:00 午时 = 甲午

import {
  TIAN_GAN,
  DI_ZHI,
  SHENG_XIAO,
  SEXAGENARY,
  NAYIN,
  dayGanZhi,
  yearGanZhi,
  monthGanZhi,
  hourGanZhi,
  baZi,
} from '../../web/js/almanac/ganzhi.js';

const asserts = [];

function check(name, cond, detail = '') {
  asserts.push({ name, ok: cond });
  console.log(`${cond ? '✓' : '✗'} ${name}${detail ? '  ' + detail : ''}`);
}

// ============ 常量完整性 ============
check('天干10项', TIAN_GAN.length === 10 && TIAN_GAN[0] === '甲' && TIAN_GAN[9] === '癸');
check('地支12项', DI_ZHI.length === 12 && DI_ZHI[0] === '子' && DI_ZHI[11] === '亥');
check('生肖12项', SHENG_XIAO.length === 12 && SHENG_XIAO[0] === '鼠' && SHENG_XIAO[11] === '猪');
check('六十甲子60项', SEXAGENARY.length === 60 && SEXAGENARY[0] === '甲子' && SEXAGENARY[59] === '癸亥');
check('纳音60项', NAYIN.length === 60 && NAYIN[0] === '海中金' && NAYIN[59] === '大海水');

// 六十甲子顺序正确性：第k项 = 干[k%10]+支[k%12]
{
  let ok = true;
  for (let k = 0; k < 60; k++) {
    if (SEXAGENARY[k] !== TIAN_GAN[k % 10] + DI_ZHI[k % 12]) ok = false;
  }
  check('六十甲子序=干[k%10]+支[k%12]', ok);
}

// ============ 年干支（立春为界）============
{
  const y2026 = yearGanZhi(new Date(2026, 6, 1));
  check('2026年=丙午年(马)', y2026.name === '丙午' && y2026.animal === '马', `→ ${y2026.name}/${y2026.animal}`);

  const y2024 = yearGanZhi(new Date(2024, 6, 1));
  check('2024年=甲辰年(龙)', y2024.name === '甲辰' && y2024.animal === '龙', `→ ${y2024.name}/${y2024.animal}`);

  // 立春前归上一年：2024/2/3 应为 癸卯年
  const beforeLC = yearGanZhi(new Date(2024, 1, 3, 12));
  check('2024/2/3立春前=癸卯年', beforeLC.name === '癸卯' && beforeLC.animal === '兔', `→ ${beforeLC.name}/${beforeLC.animal}`);

  // 2024/2/4 立春后(16:27)应为甲辰年；用 18:00 确保 在立春后
  const afterLC = yearGanZhi(new Date(2024, 1, 4, 18));
  check('2024/2/4立春后=甲辰年', afterLC.name === '甲辰' && afterLC.animal === '龙', `→ ${afterLC.name}/${afterLC.animal}`);
}

// 1984 = 甲子(idx0) 锚点
{
  const y1984 = yearGanZhi(new Date(1984, 6, 1));
  check('1984年=甲子年(idx0)', y1984.idx === 0 && y1984.name === '甲子', `→ idx${y1984.idx} ${y1984.name}`);
}

// ============ 日干支（锚点校准，核心）============
{
  // 锚点1: 2000/1/1 = 戊午日(idx54)
  const d2000 = dayGanZhi(new Date(2000, 0, 1, 12));
  check('2000/1/1=戊午日(idx54)', d2000.name === '戊午' && d2000.idx === 54, `→ idx${d2000.idx} ${d2000.name}`);

  // 锚点2: 2026/7/1 = 丙子日(idx12)
  const d2026 = dayGanZhi(new Date(2026, 6, 1, 12));
  check('2026/7/1=丙子日(idx12)', d2026.name === '丙子' && d2026.idx === 12, `→ idx${d2026.idx} ${d2026.name}`);

  // 锚点3: 2024/2/10(春节)=甲辰日
  const d2024sf = dayGanZhi(new Date(2024, 1, 10, 12));
  check('2024/2/10春节=甲辰日', d2024sf.name === '甲辰', `→ ${d2024sf.name}`);

  // 锚点4: 2025/1/29(春节)=戊戌日
  const d2025sf = dayGanZhi(new Date(2025, 0, 29, 12));
  check('2025/1/29春节=戊戌日', d2025sf.name === '戊戌', `→ ${d2025sf.name}`);
}

// 日干支持 JD 输入
{
  // JD 输入与 Date 输入一致：2026/7/1 正午 JD
  const { toJD } = await import('../../web/js/almanac/astronomy.js');
  const jd = toJD(2026, 7, 1, 12);
  const fromJDres = dayGanZhi(jd);
  const fromDate = dayGanZhi(new Date(2026, 6, 1, 12));
  check('日干支JD输入与Date一致', fromJDres.name === fromDate.name, `→ JD:${fromJDres.name} Date:${fromDate.name}`);
}

// ============ 月干支（节气为界，正月建寅）============
{
  const m1 = monthGanZhi(new Date(2024, 1, 10, 12)); // 立春后寅月
  check('2024/2/10=丙寅月', m1.name === '丙寅' && m1.zhi === '寅', `→ ${m1.name}`);

  const m2 = monthGanZhi(new Date(2025, 0, 29, 12)); // 立春前丑月(属2024甲年)
  check('2025/1/29=丁丑月', m2.name === '丁丑' && m2.zhi === '丑', `→ ${m2.name}`);

  const m3 = monthGanZhi(new Date(2026, 6, 1, 12)); // 午月
  check('2026/7/1=甲午月', m3.name === '甲午' && m3.zhi === '午', `→ ${m3.name}`);
}

// 月干"甲己之年丙作首"规律：甲年(2024)正月=丙寅，乙年(2025立春后)正月=戊寅
{
  // 2024甲年，立春后第一个月=寅月，干应为丙
  const zy = monthGanZhi(new Date(2024, 1, 5, 12));
  check('甲年正月丙寅(甲己丙作首)', zy.name === '丙寅', `→ ${zy.name}`);
  // 2025乙年立春后正月=戊寅(乙庚戊为头)
  const ey = monthGanZhi(new Date(2025, 1, 5, 12));
  check('乙年正月戊寅(乙庚戊为头)', ey.name === '戊寅', `→ ${ey.name}`);
}

// ============ 时干支（甲己还加甲）============
{
  // 2026/7/1 丙子日。丙辛日起戊子时。12:00午时 = 戊+6 = 甲午
  const h_noon = hourGanZhi(new Date(2026, 6, 1, 12, 0));
  check('2026/7/1午时=甲午', h_noon.name === '甲午' && h_noon.zhi === '午', `→ ${h_noon.name}`);

  // 子时(23:30)= 戊子
  const h_zi = hourGanZhi(new Date(2026, 6, 1, 23, 30));
  check('2026/7/1子时=戊子', h_zi.name === '戊子' && h_zi.zhi === '子', `→ ${h_zi.name}`);

  // 子时(0:30, 早子)= 戊子
  const h_zi2 = hourGanZhi(new Date(2026, 6, 1, 0, 30));
  check('2026/7/1早子时=戊子', h_zi2.name === '戊子', `→ ${h_zi2.name}`);
}

// 甲日(2024/2/10=甲辰日)子时应为甲子("甲己还加甲")
{
  // 2024/2/10 是甲辰日(甲干)，子时应为甲子
  const h = hourGanZhi(new Date(2024, 1, 10, 0, 30));
  check('甲日子时=甲子(甲己还加甲)', h.name === '甲子', `→ ${h.name}`);
}

// ============ 四柱一致性 baZi ============
{
  const bz = baZi(new Date(2026, 6, 1, 12, 0));
  const ok = bz.year.name === '丙午' && bz.month.name === '甲午' && bz.day.name === '丙子' && bz.hour.name === '甲午';
  check('baZi四柱一致', ok, `→ ${bz.year.name}年 ${bz.month.name}月 ${bz.day.name}日 ${bz.hour.name}时`);
}

const failed = asserts.filter((a) => !a.ok);
console.log(failed.length ? `\n${failed.length} 项失败` : '\n全部通过');
process.exit(failed.length ? 1 : 0);
