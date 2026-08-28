export const CONTENT_LAYERS = Object.freeze({
  classic: '本经原文',
  wings: '易传',
  commentary: '历代注疏',
  guide: '项目导读',
  imagesNumbers: '象数传统',
  divination: '术数方法',
  calendar: '历法计算',
  folklore: '民俗资料',
});

/**
 * @typedef {Object} ContentProvenance
 * @property {string} layer 内容层级
 * @property {string} edition 底本或数据基础
 * @property {string} authorTradition 作者、时代或流派
 * @property {string} location 原文定位或字段位置
 * @property {'已核结构'|'项目自撰'|'待校验'} validationStatus 校验状态
 * @property {string} disputeNote 解释边界或争议说明
 */

const FIELD_RULES = Object.freeze({
  judgement: { layer: CONTENT_LAYERS.classic, authorTradition: '《周易》经文', location: '卦辞', validationStatus: '待校验' },
  lineText: { layer: CONTENT_LAYERS.classic, authorTradition: '《周易》经文', location: '爻辞', validationStatus: '待校验' },
  useNine: { layer: CONTENT_LAYERS.classic, authorTradition: '《周易》经文', location: '用九', validationStatus: '待校验' },
  useSix: { layer: CONTENT_LAYERS.classic, authorTradition: '《周易》经文', location: '用六', validationStatus: '待校验' },
  tuan: { layer: CONTENT_LAYERS.wings, authorTradition: '《彖传》', location: '彖曰', validationStatus: '待校验' },
  image: { layer: CONTENT_LAYERS.wings, authorTradition: '《象传》', location: '大象', validationStatus: '待校验' },
  lineXiang: { layer: CONTENT_LAYERS.wings, authorTradition: '《象传》', location: '小象', validationStatus: '待校验' },
  orderRemark: { layer: CONTENT_LAYERS.wings, authorTradition: '《序卦传》', location: '卦序说明', validationStatus: '待校验' },
  scenario: { layer: CONTENT_LAYERS.guide, authorTradition: '易象图谱编辑', location: '情境类比', validationStatus: '项目自撰' },
  judgementNote: { layer: CONTENT_LAYERS.guide, authorTradition: '易象图谱编辑', location: '卦辞白话', validationStatus: '项目自撰' },
  tuanNote: { layer: CONTENT_LAYERS.guide, authorTradition: '易象图谱编辑', location: '彖传导读', validationStatus: '项目自撰' },
  imageNote: { layer: CONTENT_LAYERS.guide, authorTradition: '易象图谱编辑', location: '大象导读', validationStatus: '项目自撰' },
  lineNote: { layer: CONTENT_LAYERS.guide, authorTradition: '易象图谱编辑', location: '爻辞白话', validationStatus: '项目自撰' },
});

const DEFAULT_EDITION = '项目通行文本；待完成逐条底本定位与双人校对';
const GUIDE_BOUNDARY = '用于辅助理解，不与原典等同，也不构成对现实事件的确定判断。';
const CLASSIC_BOUNDARY = '原文层只标识文本归属；标点、异文与具体训诂仍须核对所用底本。';

/** @returns {ContentProvenance} */
export function getHexagramContentProvenance(hexagram, field, position = null) {
  const rule = FIELD_RULES[field] || FIELD_RULES.scenario;
  const lineLocation = position ? `第 ${position} 爻 · ` : '';
  return {
    layer: rule.layer,
    edition: DEFAULT_EDITION,
    authorTradition: rule.authorTradition,
    location: `${hexagram?.name || '本卦'} · ${lineLocation}${rule.location}`,
    validationStatus: rule.validationStatus,
    disputeNote: rule.layer === CONTENT_LAYERS.guide ? GUIDE_BOUNDARY : CLASSIC_BOUNDARY,
  };
}

export function getTheoremContentProvenance(theorem) {
  return {
    layer: CONTENT_LAYERS.imagesNumbers,
    edition: '项目知识条目；待逐条补充文献定位',
    authorTradition: theorem?.id === 'najia' ? '汉易象数与京房传统' : '历代象数传统',
    location: theorem?.name || '象数条目',
    validationStatus: '待校验',
    disputeNote: '相关概念的年代、术语和解释范围可能因流派而异，不作为普遍定律。',
  };
}
