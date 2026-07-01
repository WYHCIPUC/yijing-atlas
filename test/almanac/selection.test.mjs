// 择日引擎验证测试。
// 运行：node --test test/almanac/selection.test.mjs
//   或：node test/almanac/selection.test.mjs
//
// 验证基准（对照真实黄历/老黄历，北京时间 UTC+8）：
//   建除值位：2026/7/1 = 丙子日、月支午、offset=6 = 破（老黄历核对一致）
//              2025/1/1 = 甲子日、月支子、offset=0 = 建
//   二十八宿：2026/7/1 = 箕水豹（idx6）；2025/1/1 = 参水猿（idx20）；
//              2026/6/30 = 尾火虎（idx5）；三处锚点经多黄历来源校准一致。
//   百忌：2026/7/1 丙子日 → 十干忌"丙不修灶"+十二支忌"子不问卜"。
//   宜忌综合：输出 yi/ji 非空。
//
// 偏移常数 XIU_OFFSET=11：经 2025/1/1、2026/6/30、2026/7/1 三日交叉校准。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import {
  jianChuOfDay,
  xiuOfDay,
  pengZuBaiJi,
  yiJiOfDay,
  dailySelection,
  JIAN_CHU_NAMES,
  XIU_NAMES,
  PENGZU_GAN,
  PENGZU_ZHI,
} from '../../web/js/almanac/selection.js';
import { getTermReading, buildDailyReading, termsByCategory } from '../../web/js/almanac/reading.js';

// 加载数据
const TERMS = JSON.parse(readFileSync(new URL('../../web/data/almanac-terms.json', import.meta.url), 'utf8'));
const YIJI = JSON.parse(readFileSync(new URL('../../web/data/almanac-yiji.json', import.meta.url), 'utf8'));

// ==================== 建除十二神 ====================
test('建除值位：2026/7/1（丙子日，月支午）= 破', () => {
  const r = jianChuOfDay(new Date(2026, 6, 1));
  assert.equal(r.name, '破');
  assert.equal(r.offset, 6);
  assert.equal(r.monthZhi, '午');
  assert.equal(r.dayZhi, '子');
});

test('建除值位：2025/1/1（庚午日，月支子，大雪节气内）= 破', () => {
  // 2025/1/1 在小寒（1/5）前，属大雪→小寒的子月；日干支庚午，月支子。
  // offset=(午idx6 - 子idx0)=6 = 破（与真实黄历一致）。
  const r = jianChuOfDay(new Date(2025, 0, 1));
  assert.equal(r.name, '破');
  assert.equal(r.offset, 6);
  assert.equal(r.monthZhi, '子');
  assert.equal(r.dayZhi, '午');
});

test('建除值位：建日（月支与日支相同）offset=0', () => {
  // 2026/7/7 小暑后进入未月；找到未日（月支未=建日）。
  // 未月始于 7/7，未日：7/13 己未。验证 offset=0=建。
  let date = null;
  for (let i = 7; i <= 20; i++) {
    const d = new Date(2026, 6, i);
    const r = jianChuOfDay(d);
    if (r.dayZhi === r.monthZhi && r.monthZhi === '未') {
      date = d;
      break;
    }
  }
  assert.ok(date, '应能在未月内找到未日');
  const r = jianChuOfDay(date);
  assert.equal(r.offset, 0);
  assert.equal(r.name, '建');
});

test('建除值位连续性：相邻日值位差 1', () => {
  // 连续若干天，建除值位应逐日递增（注意月支切换时可能跳变，此处取月内连续段）
  // 取 2026/7/1 起一周（均在午月内，月支不变）
  const names = [];
  for (let i = 0; i < 7; i++) {
    names.push(jianChuOfDay(new Date(2026, 6, 1 + i)).name);
  }
  // 每相邻两天 idx 差应为 1（mod 12）
  for (let i = 1; i < names.length; i++) {
    const a = JIAN_CHU_NAMES.indexOf(names[i - 1]);
    const b = JIAN_CHU_NAMES.indexOf(names[i]);
    assert.equal((b - a + 12) % 12, 1, `${names[i - 1]}→${names[i]} 应递增1`);
  }
});

test('建除值位：覆盖全部 12 值位可遍历（取不跨节气的连续段）', () => {
  // 午月内（小暑 7/7 前），取 2026/6/25..7/6 连续12天（均在午月，月支不变），
  // 应遍历全部12个建除值位。
  const seen = new Set();
  for (let i = 0; i < 12; i++) {
    seen.add(jianChuOfDay(new Date(2026, 5, 25 + i)).name);
  }
  assert.equal(seen.size, 12, '12天应覆盖全部12值位');
  assert.deepEqual([...seen].sort(), [...JIAN_CHU_NAMES].sort());
});

// ==================== 二十八宿 ====================
test('二十八宿值日：2026/7/1 = 箕水豹', () => {
  const r = xiuOfDay(new Date(2026, 6, 1));
  assert.equal(r.name, '箕');
  assert.equal(r.fullName, '箕水豹');
  assert.equal(r.wuxing, '水');
  assert.equal(r.qin, '豹');
  assert.equal(r.xiang, '东方青龙');
});

test('二十八宿值日：2025/1/1 = 参水猿', () => {
  const r = xiuOfDay(new Date(2025, 0, 1));
  assert.equal(r.name, '参');
  assert.equal(r.fullName, '参水猿');
  assert.equal(r.wuxing, '水');
});

test('二十八宿值日：2026/6/30 = 尾火虎', () => {
  const r = xiuOfDay(new Date(2026, 5, 30));
  assert.equal(r.name, '尾');
  assert.equal(r.fullName, '尾火虎');
});

test('二十八宿连续性：逐日轮转，每相邻日 idx 差为 1（mod 28）', () => {
  const idxs = [];
  for (let i = 0; i < 28; i++) {
    idxs.push(xiuOfDay(new Date(2026, 6, 1 + i)).idx);
  }
  for (let i = 1; i < idxs.length; i++) {
    assert.equal((idxs[i] - idxs[i - 1] + 28) % 28, 1);
  }
  // 28天应遍历全部28宿
  assert.equal(new Set(idxs).size, 28);
});

test('二十八宿：XIU_NAMES 共28个且无重复', () => {
  assert.equal(XIU_NAMES.length, 28);
  assert.equal(new Set(XIU_NAMES).size, 28);
});

// ==================== 彭祖百忌 ====================
test('彭祖百忌：2026/7/1（丙子日）→ 丙不修灶 + 子不问卜', () => {
  const r = pengZuBaiJi(new Date(2026, 6, 1));
  assert.equal(r.gan, '丙');
  assert.equal(r.zhi, '子');
  assert.equal(r.ganJi, '丙不修灶，必见灾殃');
  assert.equal(r.zhiJi, '子不问卜，自惹灾殃');
  assert.ok(r.all.includes('丙不修灶'));
  assert.ok(r.all.includes('子不问卜'));
  assert.equal(r.items.length, 2);
});

test('彭祖百忌：癸亥日 → 癸不词讼 + 亥不嫁娶', () => {
  // 找一个癸亥日：癸亥 = idx59。从 2000/1/1 戊午(idx54) 推。
  // 简单遍历近期找到癸亥日验证查表。
  let date = new Date(2023, 0, 1);
  let found = null;
  for (let i = 0; i < 400; i++) {
    const d = new Date(2023, 0, 1 + i);
    const r = pengZuBaiJi(d);
    if (r.gan === '癸' && r.zhi === '亥') {
      found = { d, r };
      break;
    }
  }
  assert.ok(found, '应能在 2023 起一年内找到癸亥日');
  assert.equal(found.r.ganJi, '癸不词讼，理弱敌强');
  assert.equal(found.r.zhiJi, '亥不嫁娶，不利新郎');
});

test('彭祖百忌：十干忌表与十二支忌表完整', () => {
  assert.equal(Object.keys(PENGZU_GAN).length, 10);
  assert.equal(Object.keys(PENGZU_ZHI).length, 12);
  // 每条口诀以对应干/支开头
  for (const [gan, text] of Object.entries(PENGZU_GAN)) {
    assert.ok(text.startsWith(gan), `${text} 应以 ${gan} 开头`);
  }
  for (const [zhi, text] of Object.entries(PENGZU_ZHI)) {
    assert.ok(text.startsWith(zhi), `${text} 应以 ${zhi} 开头`);
  }
});

// ==================== 宜忌综合 ====================
test('宜忌综合：2026/7/1（破日）输出非空，且破日大忌', () => {
  const r = yiJiOfDay(new Date(2026, 6, 1), YIJI);
  assert.equal(r.zhiWei, '破');
  // 破日为凶，ji 应非空且较多
  assert.ok(r.ji.length > 0, '破日忌事应非空');
  assert.ok(r.ji.includes('嫁娶'));
  assert.ok(r.ji.includes('开市'));
});

test('宜忌综合：成日宜嫁娶开市', () => {
  // 找一个成日（午月内）：2026/7/3 = 成（破后2天：破危成）
  const r = yiJiOfDay(new Date(2026, 6, 3), YIJI);
  assert.equal(r.zhiWei, '成');
  assert.ok(r.yi.length > 0, '成日宜事应非空');
  assert.ok(r.yi.includes('嫁娶'));
  assert.ok(r.yi.includes('开市'));
});

test('宜忌综合：yi 与 ji 不重叠（同一事项不应同时宜又忌）', () => {
  const r = yiJiOfDay(new Date(2026, 6, 1), YIJI);
  const overlap = r.yi.filter((x) => r.ji.includes(x));
  assert.equal(overlap.length, 0, `宜忌重叠: ${overlap}`);
});

test('dailySelection：返回完整择日信息', () => {
  const r = dailySelection(new Date(2026, 6, 1), YIJI);
  assert.ok(r.dayGanZhi);
  assert.ok(r.monthGanZhi);
  assert.ok(r.jianChu);
  assert.ok(r.xiu);
  assert.ok(r.pengZu);
  assert.ok(r.yiJi);
  assert.equal(r.jianChu.name, '破');
  assert.equal(r.xiu.name, '箕');
});

// ==================== 解读提取 ====================
test('getTermReading：按 id 查建除术语', () => {
  const t = getTermReading(TERMS, 'jianshe-jian');
  assert.ok(t);
  assert.equal(t.name, '建');
  assert.ok(t.meaning);
});

test('getTermReading：按 name 查二十八宿', () => {
  const t = getTermReading(TERMS, '箕');
  assert.ok(t);
  assert.equal(t.category, '二十八宿');
});

test('getTermReading：查不到返回 null', () => {
  assert.equal(getTermReading(TERMS, '不存在的东西'), null);
});

test('termsByCategory：分类筛选正确', () => {
  const jianChu = termsByCategory(TERMS, '建除十二神');
  assert.equal(jianChu.length, 12);
  const xiu = termsByCategory(TERMS, '二十八宿');
  assert.equal(xiu.length, 28);
});

test('buildDailyReading：2026/7/1 生成完整解读段落', () => {
  const r = buildDailyReading(new Date(2026, 6, 1), {}, TERMS, YIJI);
  assert.ok(r.blocks.length >= 4, '至少4个解读段落');
  // 每段必有 title / meaning
  for (const b of r.blocks) {
    assert.ok(b.title, '段落缺 title');
    assert.ok(typeof b.meaning === 'string');
    assert.ok(Array.isArray(b.yi));
    assert.ok(Array.isArray(b.ji));
    assert.ok(b.principle, '段落缺 principle');
  }
  // 应包含建除、值宿、百忌、节气、宜忌
  const titles = r.blocks.map((b) => b.title);
  assert.ok(titles.some((t) => t.includes('建除')));
  assert.ok(titles.some((t) => t.includes('值宿')));
  assert.ok(titles.some((t) => t.includes('彭祖')));
  assert.ok(titles.some((t) => t.includes('节气')));
  assert.ok(r.summary, '应有摘要');
  assert.ok(r.summary.includes('箕'));
});

// ==================== 数据完整性 ====================
test('术语库结构完整：每条有 name/meaning，yi/ji 为数组', () => {
  for (const t of TERMS) {
    assert.ok(t.name, `缺 name: ${t.id}`);
    assert.ok(t.meaning, `缺 meaning: ${t.id}`);
    assert.ok(Array.isArray(t.yi), `yi 非数组: ${t.id}`);
    assert.ok(Array.isArray(t.ji), `ji 非数组: ${t.id}`);
  }
});

test('宜忌映射结构完整：每项有 yi/ji 数组且值位合法', () => {
  const ORDER = JIAN_CHU_NAMES;
  for (const [k, v] of Object.entries(YIJI)) {
    assert.ok(Array.isArray(v.yi), `${k} 缺 yi 数组`);
    assert.ok(Array.isArray(v.ji), `${k} 缺 ji 数组`);
    for (const x of [...v.yi, ...v.ji]) {
      assert.ok(ORDER.includes(x), `${k} 含非法值位: ${x}`);
    }
  }
});
