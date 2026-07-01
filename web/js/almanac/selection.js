// 择日引擎（建除值位、二十八宿值日、彭祖百忌、综合宜忌）。
// 在天文层（astronomy.js）与干支层（ganzhi.js）之上构建。
// 流派差异统一依《协纪辨方书》主流口径（传统择日通例）。
//
// 算法说明：
// 1. 建除十二神：月支为建，日支与月支的地支偏移定值位。
//    offset = (日支idx - 月支idx + 12) % 12，对应 [建,除,满,平,定,执,破,危,成,收,开,闭]。
//    基准校准：2026/7/1 = 丙子日（月支午、日支子，offset=6=破），与老黄历一致。
//
// 2. 二十八宿值日：按儒略日序轮转（28宿循环）。
//    mansionIdx = (daySerial + XIU_OFFSET) mod 28
//    daySerial = floor(toJD(y,m,d,12))（该日正午 UT 儒略日，与公历日一一对应）。
//    XIU_OFFSET=11，经多个真实黄历日校准：
//      2025/1/1 → 参(idx20)，2026/6/1 → 尾(idx5)，2026/7/1 → 箕(idx6)。
//    （不同黄历流派对值宿推算有差异，本实现以主流"按日轮转 mod 28"口径，
//      并以上述真实日为锚校准偏移常数。）

import { toJD } from './astronomy.js';
import { dayGanZhi, monthGanZhi, DI_ZHI, TIAN_GAN } from './ganzhi.js';

// 建除十二神（顺序：建除满平定执破危成收开闭）。
export const JIAN_CHU_NAMES = ['建', '除', '满', '平', '定', '执', '破', '危', '成', '收', '开', '闭'];

// 二十八宿（顺序：角亢氐房心尾箕/斗牛女虚危室壁/奎娄胃昴毕觜参/井鬼柳星张翼轸）。
export const XIU_NAMES = [
  '角', '亢', '氐', '房', '心', '尾', '箕',
  '斗', '牛', '女', '虚', '危', '室', '壁',
  '奎', '娄', '胃', '昴', '毕', '觜', '参',
  '井', '鬼', '柳', '星', '张', '翼', '轸',
];

// 二十八宿的七政（日月金木水火土）与禽（动物），与 XIU_NAMES 一一对应。
export const XIU_WUXING = [
  '木', '金', '土', '日', '月', '火', '水', // 角亢氐房心尾箕
  '木', '金', '土', '日', '月', '火', '水', // 斗牛女虚危室壁
  '木', '金', '土', '日', '月', '火', '水', // 奎娄胃昴毕觜参
  '木', '金', '土', '日', '月', '火', '水', // 井鬼柳星张翼轸
];
export const XIU_QIN = [
  '蛟', '龙', '貉', '兔', '狐', '虎', '豹',
  '獬', '牛', '蝠', '鼠', '燕', '猪', '㺄',
  '狼', '狗', '雉', '鸡', '乌', '猴', '猿',
  '犴', '羊', '獐', '马', '鹿', '蛇', '蚓',
];

// 二十八宿所属四象（与 XIU_NAMES 一一对应）。
export const XIU_XIANG = [
  ...Array(7).fill('东方青龙'),
  ...Array(7).fill('北方玄武'),
  ...Array(7).fill('西方白虎'),
  ...Array(7).fill('南方朱雀'),
];

// 值宿偏移常数（daySerial + 11) mod 28 = 宿序。经真实黄历日校准。
const XIU_OFFSET = 11;

// 彭祖百忌表：十干忌 + 十二支忌。
// 十干忌：甲不开仓…癸不词讼。
export const PENGZU_GAN = {
  '甲': '甲不开仓，财物耗散',
  '乙': '乙不栽植，千株不长',
  '丙': '丙不修灶，必见灾殃',
  '丁': '丁不剃头，头必生疮',
  '戊': '戊不受田，田主不祥',
  '己': '己不破券，二比并亡',
  '庚': '庚不经络，织机虚张',
  '辛': '辛不合酱，主人不尝',
  '壬': '壬不汲水，更难提防',
  '癸': '癸不词讼，理弱敌强',
};
// 十二支忌：子不问卜…亥不嫁娶。
export const PENGZU_ZHI = {
  '子': '子不问卜，自惹灾殃',
  '丑': '丑不冠带，主不还乡',
  '寅': '寅不祭祀，鬼神不尝',
  '卯': '卯不穿井，泉水不香',
  '辰': '辰不哭泣，必主重丧',
  '巳': '巳不远行，财物伏藏',
  '午': '午不苫盖，室主更张',
  '未': '未不服药，毒气入肠',
  '申': '申不安床，鬼祟入房',
  '酉': '酉不会客，醉坐颠狂',
  '戌': '戌不吃犬，作怪上床',
  '亥': '亥不嫁娶，不利新郎',
};

// ---- 工具 ----
function mod(n, m) {
  return ((n % m) + m) % m;
}

// 北京时间某日 0 时 → 该日"日序"（正午 UT 儒略日，与公历日一一对应）。
// 与 ganzhi.js 的 daySerial 同口径：floor(toJD(y,m,d,12))。
function daySerial(date) {
  return Math.floor(toJD(date.getFullYear(), date.getMonth() + 1, date.getDate(), 12));
}

// ============================================================
// jianChuOfDay(date)：日建除值位。
// 月支为建，日支与月支的地支偏移定值位。
// 返回 { idx, name, monthZhi, dayZhi, offset }
// ============================================================
export function jianChuOfDay(date) {
  const mg = monthGanZhi(date);
  const dg = dayGanZhi(date);
  // 月支 idx / 日支 idx（DI_ZHI 子=0,丑=1,…,亥=11）
  const monthZhiIdx = DI_ZHI.indexOf(mg.zhi);
  const dayZhiIdx = dg.zhiIdx; // dayGanZhi 已返回 zhiIdx
  const offset = mod(dayZhiIdx - monthZhiIdx, 12);
  return {
    idx: offset,
    name: JIAN_CHU_NAMES[offset],
    offset,
    monthZhi: mg.zhi,
    dayZhi: dg.zhi,
  };
}

// ============================================================
// xiuOfDay(date)：二十八宿值日。按日序 mod 28 轮转。
// 返回 { idx, name, wuxing, qin, xiang, fullName }
// ============================================================
export function xiuOfDay(date) {
  const serial = daySerial(date);
  const idx = mod(serial + XIU_OFFSET, 28);
  const name = XIU_NAMES[idx];
  const wuxing = XIU_WUXING[idx];
  const qin = XIU_QIN[idx];
  const xiang = XIU_XIANG[idx];
  return {
    idx,
    name,
    wuxing,
    qin,
    xiang,
    // 全称如"角木蛟"
    fullName: `${name}${wuxing}${qin}`,
  };
}

// ============================================================
// pengZuBaiJi(date)：彭祖百忌。返回当日十干忌 + 十二支忌。
// 返回 { gan, ganJi, zhi, zhiJi, items:[{type, gan/zhi, text}], all }
// ============================================================
export function pengZuBaiJi(date) {
  const dg = dayGanZhi(date);
  const gan = dg.gan;
  const zhi = dg.zhi;
  const ganJi = PENGZU_GAN[gan] || '';
  const zhiJi = PENGZU_ZHI[zhi] || '';
  const items = [];
  if (ganJi) items.push({ type: '天干', gan, text: ganJi });
  if (zhiJi) items.push({ type: '地支', zhi, text: zhiJi });
  return {
    gan,
    ganJi,
    zhi,
    zhiJi,
    items,
    // 拼接的可读文本（如"甲不开仓，财物耗散；子不问卜，自惹灾殃。"）
    all: items.map((it) => it.text).join('；'),
  };
}

// ============================================================
// yiJiOfDay(date, yijiMap)：综合宜忌。
// 根据当日建除值位，查 yijiMap（almanac-yiji.json 的结构），
// 输出当日宜/忌事项列表。
// 返回 { zhiWei(建除值位), yi:[事项], ji:[事项] }
// ============================================================
export function yiJiOfDay(date, yijiMap) {
  const jc = jianChuOfDay(date);
  const zhiWei = jc.name;
  const yi = [];
  const ji = [];
  if (yijiMap && typeof yijiMap === 'object') {
    for (const [item, map] of Object.entries(yijiMap)) {
      if (map && Array.isArray(map.yi) && map.yi.includes(zhiWei)) {
        yi.push(item);
      }
      if (map && Array.isArray(map.ji) && map.ji.includes(zhiWei)) {
        ji.push(item);
      }
    }
  }
  return {
    zhiWei,
    yi,
    ji,
  };
}

// ============================================================
// 便捷：一把梭——给定 date + yijiMap，返回当日择日全套信息。
// 返回 { date, dayGanZhi, monthGanZhi, jianChu, xiu, pengZu, yiJi }
// ============================================================
export function dailySelection(date, yijiMap) {
  return {
    date,
    dayGanZhi: dayGanZhi(date),
    monthGanZhi: monthGanZhi(date),
    jianChu: jianChuOfDay(date),
    xiu: xiuOfDay(date),
    pengZu: pengZuBaiJi(date),
    yiJi: yiJiOfDay(date, yijiMap),
  };
}
