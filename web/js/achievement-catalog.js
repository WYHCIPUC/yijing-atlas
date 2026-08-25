export const ABILITY_DIMENSIONS = Object.freeze([
  { id: 'recognition', label: '识象', description: '辨认卦象、上下卦、卦序与结构' },
  { id: 'classics', label: '读经', description: '理解卦爻辞、《易传》及其出处' },
  { id: 'change', label: '观变', description: '分析动爻、本卦、之卦与错综互变' },
  { id: 'discernment', label: '明辨', description: '区分事实、类比、推断与适用边界' },
  { id: 'expression', label: '表达', description: '形成连贯、有依据的说明' },
]);

const rankNames = ['蒙学', '习经', '研传', '明辨', '通用'];
const rankStages = ['初识', '渐悟', '成章'];
const rankRequirements = [
  [0, 0, 0, 0], [1, 8, 0, 1], [2, 12, 0, 2],
  [3, 18, 0, 4], [4, 24, 0, 8], [5, 30, 1, 12],
  [6, 36, 1, 16], [7, 42, 2, 24], [8, 48, 3, 32],
  [9, 54, 3, 40], [10, 60, 4, 48], [10, 64, 5, 56],
  [11, 68, 5, 60], [11, 72, 5, 64], [12, 76, 5, 64],
];

export const GROWTH_RANKS = Object.freeze(rankRequirements.map((requirements, index) => {
  const rankIndex = Math.floor(index / rankStages.length);
  const stageIndex = index % rankStages.length;
  return Object.freeze({
    id: `${['mengxue', 'xijing', 'yanzhuan', 'mingbian', 'tongyong'][rankIndex]}-${['chushi', 'jianwu', 'chengzhang'][stageIndex]}`,
    label: `${rankNames[rankIndex]}·${rankStages[stageIndex]}`,
    rank: rankNames[rankIndex],
    stage: rankStages[stageIndex],
    minAchievements: requirements[0],
    minAbility: requirements[1],
    minAnalyses: requirements[2],
    minHexagrams: requirements[3],
  });
}));

export const ACHIEVEMENT_CATALOG = Object.freeze([
  { id: 'first-lesson', name: '开卷入易', tier: '初阶', target: 1, condition: '完成第一课与小试', reward: '开卷铜印' },
  { id: 'yin-yang', name: '初识两仪', tier: '初阶', target: 80, condition: '阴阳专题掌握度达到 80%', reward: '两仪铜印' },
  { id: 'eight-trigrams', name: '八卦成列', tier: '进阶', target: 2, condition: '两轮正确辨认八卦象、性、符号', reward: '八卦铜印' },
  { id: 'star-path', name: '星图初行', tier: '初阶', target: 8, condition: '深度阅读八个不同卦象及关系', reward: '星路称号' },
  { id: 'sequence', name: '卦序渐明', tier: '进阶', target: 2, condition: '完成上下经卦序阶段检验', reward: '卦序铜印' },
  { id: 'spaced-review', name: '温故知新', tier: '进阶', target: 3, condition: '七天内完成三次间隔复习', reward: '温故称号' },
  { id: 'error-recovery', name: '错中求进', tier: '进阶', target: 10, condition: '十道错题经复习后答对', reward: '求进铜印' },
  { id: 'changing-lines', name: '观变知机', tier: '精研', target: 5, condition: '五次正确分析本卦、动爻、之卦', reward: '观变铜印' },
  { id: 'cited-reading', name: '引经有据', tier: '精研', target: 3, condition: '三次解卦正确引用典籍', reward: '引经称号' },
  { id: 'reasoned-reading', name: '言之成理', tier: '精研', target: 3, condition: '三次自主解卦达到“明辨”', reward: '成理铜印' },
  { id: 'bounded-reading', name: '知止不殆', tier: '精研', target: 5, condition: '五次分析明确现实边界', reward: '知止称号' },
  { id: 'complete-atlas', name: '六十四象', tier: '圆满', target: 64, condition: '完成六十四卦研读、复习与综合考评', reward: '六十四象金印' },
].map(Object.freeze));

export function getAchievementById(id) {
  return ACHIEVEMENT_CATALOG.find((achievement) => achievement.id === id) || null;
}
