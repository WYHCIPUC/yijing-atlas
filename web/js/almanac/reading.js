// 术语解读提取与每日解读汇总。
// 在术语库（almanac-terms.json）与择日引擎（selection.js）之上构建。
// 流派差异统一依《协纪辨方书》口径（传统择日通例），解读中注明。

import { currentSolarTerm } from './solar-terms.js';
import { jianChuOfDay, xiuOfDay, pengZuBaiJi, yiJiOfDay } from './selection.js';

// ============================================================
// getTermReading(terms, idOrName)：从术语库按 id 或 name 查单条解读。
// terms 为 almanac-terms.json 解析后的数组。
// 返回匹配的术语条目对象，未找到返回 null。
// ============================================================
export function getTermReading(terms, idOrName) {
  if (!Array.isArray(terms)) return null;
  return (
    terms.find((t) => t.id === idOrName) ||
    terms.find((t) => t.name === idOrName) ||
    null
  );
}

// 便捷：按类别筛选术语。
export function termsByCategory(terms, category) {
  if (!Array.isArray(terms)) return [];
  return terms.filter((t) => t.category === category);
}

// ---- 解读段落构造 ----
// 每段统一结构：{ title, meaning, yi, ji, principle }
function makeBlock(title, term, fallback) {
  const meaning = (term && term.meaning) || (fallback && fallback.meaning) || '';
  return {
    title,
    meaning,
    yi: (term && term.yi) || (fallback && fallback.yi) || [],
    ji: (term && term.ji) || (fallback && fallback.ji) || [],
    principle:
      (term && term.principle) ||
      (fallback && fallback.principle) ||
      '依据传统择日通例（《协纪辨方书》）。',
  };
}

// ============================================================
// buildDailyReading(date, almanacInfo, terms)：汇总某日"今日解读"。
// 把当日建除值位、值宿、百忌、当前节气串联成解读段落数组。
//
// 参数：
//   date        —— Date 对象（北京时间）
//   almanacInfo —— 可选，预计算的择日信息（dailySelection 的结果或部分）。
//                  若不提供，则内部调用 selection.js 计算。
//   terms       —— almanac-terms.json 解析后的数组（用于查释义）
//   yijiMap     —— 可选，almanac-yiji.json 解析后的对象（用于综合宜忌）
//
// 返回 { date, blocks:[{title, meaning, yi, ji, principle}, ...], summary }
// ============================================================
export function buildDailyReading(date, almanacInfo, terms, yijiMap) {
  // 1. 取得（或计算）当日各项择日信息。
  const info = almanacInfo || {};
  const jc =
    info.jianChu ||
    jianChuOfDay(date);
  const xiu = info.xiu || xiuOfDay(date);
  const pz = info.pengZu || pengZuBaiJi(date);
  const yj = info.yiJi || yiJiOfDay(date, yijiMap);
  const term = info.solarTerm || currentSolarTerm(date);

  const blocks = [];

  // 2. 建除值位解读
  const jcTerm = getTermReading(terms, `jianshe-${jc.name}`);
  blocks.push(
    makeBlock(
      `建除值位：${jc.name}`,
      jcTerm,
      {
        meaning: `${jc.name}日（月支${jc.monthZhi}、日支${jc.dayZhi}，偏移${jc.offset}）。`,
        yi: yj.yi,
        ji: yj.ji,
      },
    ),
  );

  // 3. 二十八宿值宿解读
  const xiuTerm = getTermReading(terms, `xiu-${xiu.name}`);
  blocks.push(
    makeBlock(
      `值宿：${xiu.fullName}（${xiu.xiang}）`,
      xiuTerm,
      {
        meaning: `今日值宿为${xiu.fullName}，属${xiu.xiang}，七政${xiu.wuxing}。`,
        yi: (xiuTerm && xiuTerm.yi) || [],
        ji: (xiuTerm && xiuTerm.ji) || [],
      },
    ),
  );

  // 4. 彭祖百忌解读
  blocks.push({
    title: `彭祖百忌`,
    meaning: pz.all || '无',
    yi: [],
    ji: pz.items.map((it) => it.text),
    principle: '《协纪辨方书》彭祖百忌：十干忌与十二支忌，依日干支查表。传统择日通例。',
  });

  // 5. 当前节气解读
  const jqTerm = getTermReading(terms, `jieqi-${term.current}`);
  blocks.push(
    makeBlock(
      `当前节气：${term.current}`,
      jqTerm,
      {
        meaning: `当前为${term.current}（已过${term.daysSince}天，距${term.next}还有${term.daysToNext}天）。`,
        yi: [],
        ji: [],
      },
    ),
  );

  // 6. 汇总宜忌（综合建除值位查 yijiMap）
  blocks.push({
    title: `今日宜忌（综合）`,
    meaning:
      (yj.yi.length ? '宜：' + yj.yi.join('、') : '宜：诸事不宜') +
      '。' +
      (yj.ji.length ? '忌：' + yj.ji.join('、') : '忌：无') +
      '。',
    yi: yj.yi,
    ji: yj.ji,
    principle: `依据当日建除值位"${jc.name}"查宜忌通则（《协纪辨方书》建除家主流口径）。传统择日通例，流派间或有出入。`,
  });

  // 7. 生成一句话摘要
  const auspiceHint = ['破', '危', '闭', '平', '执', '收'].includes(jc.name)
    ? '值位偏凶'
    : '值位偏吉';
  const summary = `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日：${jc.name}日${xiu.fullName}值宿，${pz.all}。综合${auspiceHint}，${yj.yi.length ? '宜' + yj.yi.slice(0, 4).join('、') : '诸事不宜'}；${yj.ji.length ? '忌' + yj.ji.slice(0, 4).join('、') : '无大忌'}。`;

  return { date, blocks, summary };
}
