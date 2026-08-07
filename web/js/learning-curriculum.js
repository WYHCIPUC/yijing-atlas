// 数据驱动的学习课程与题库。课程保持开放，题目用于反馈掌握度而非锁课。

export const LEARNING_LEVELS = [
  {
    id: 'L1', name: '蒙学', title: '阴阳八卦', desc: '辨阴阳、识八卦、明爻位',
    lessons: [
      { id: 'l1-1', title: '阴阳之道', type: 'theory', refs: ['yinyang'], target: 'theorems' },
      { id: 'l1-2', title: '八卦生成', type: 'theory', refs: ['bagua-gen'], target: 'theorems' },
      { id: 'l1-3', title: '爻位与当位', type: 'theory', refs: ['yao-positions'], target: 'theorems' },
      { id: 'l1-4', title: '认识八卦符号', type: 'trigrams', target: 'trigrams' },
    ],
  },
  {
    id: 'L2', name: '习经', title: '六十四卦', desc: '按卦序研读本经卦爻辞',
    lessons: [
      { id: 'l2-1', title: '上经前八卦（乾至比）', type: 'hexagrams', range: [1, 8], target: 'explore' },
      { id: 'l2-2', title: '上经中段', type: 'hexagrams', range: [9, 22], target: 'explore' },
      { id: 'l2-3', title: '上经后段', type: 'hexagrams', range: [23, 30], target: 'explore' },
      { id: 'l2-4', title: '下经前段', type: 'hexagrams', range: [31, 47], target: 'explore' },
      { id: 'l2-5', title: '下经后段', type: 'hexagrams', range: [48, 64], target: 'explore' },
    ],
  },
  {
    id: 'L3', name: '研传', title: '十翼精读', desc: '由传文理解义理与卦序',
    lessons: [
      { id: 'l3-1', title: '系辞传', type: 'wings', refs: ['xici-shang', 'xici-xia'], target: 'wings' },
      { id: 'l3-2', title: '文言与说卦', type: 'wings', refs: ['wenyan', 'shuogua'], target: 'wings' },
      { id: 'l3-3', title: '序卦与杂卦', type: 'wings', refs: ['xugua', 'zagua'], target: 'wings' },
    ],
  },
  {
    id: 'L4', name: '明辨', title: '象数义理', desc: '由河洛五行通向卦际关系',
    lessons: [
      { id: 'l4-1', title: '五行生克', type: 'theory', refs: ['wuxing'], target: 'theorems' },
      { id: 'l4-2', title: '河图洛书', type: 'theory', refs: ['hetu-luoshu'], target: 'theorems' },
      { id: 'l4-3', title: '先天与后天八卦', type: 'theory', refs: ['xiantian', 'houtian'], target: 'theorems' },
      { id: 'l4-4', title: '错综互变', type: 'theory', refs: ['cuo-zong'], target: 'theorems' },
    ],
  },
  {
    id: 'L5', name: '通用', title: '历法日用', desc: '辨识黄历术语与使用边界',
    lessons: [
      { id: 'l5-1', title: '建除十二神', type: 'almanac', category: '建除十二神', target: 'almanac' },
      { id: 'l5-2', title: '二十八宿', type: 'almanac', category: '二十八宿', target: 'almanac' },
      { id: 'l5-3', title: '彭祖百忌', type: 'almanac', category: '彭祖百忌', target: 'almanac' },
      { id: 'l5-4', title: '二十四节气', type: 'almanac', category: '二十四节气', target: 'almanac' },
      { id: 'l5-5', title: '神煞基础', type: 'almanac', category: '神煞', target: 'almanac' },
    ],
  },
];

export const LEARNING_LESSONS = LEARNING_LEVELS.flatMap((level) =>
  level.lessons.map((lesson) => ({ ...lesson, levelId: level.id, levelName: level.name })),
);

function compactText(value, size = 32) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > size ? `${text.slice(0, size)}…` : text;
}

function optionSet(correct, pool) {
  const values = [correct, ...pool.filter((value) => value && value !== correct)];
  return [...new Set(values)].slice(0, 4).map((label) => ({ value: label, label }));
}

function question(id, lesson, prompt, answer, distractors, explanation, source) {
  return {
    id,
    lessonId: lesson.id,
    levelId: lesson.levelId,
    prompt,
    answer,
    options: optionSet(answer, distractors),
    explanation,
    source,
  };
}

function entityQuestions(lesson, entity, peers, prefix) {
  const otherNames = peers.map((item) => item.name);
  const otherDescriptions = peers.map((item) => compactText(item.desc || item.meaning));
  const ownDescription = compactText(entity.desc || entity.meaning);
  const ownPoint = compactText(entity.points?.[0] || entity.sections?.[0] || entity.principle || entity.meaning, 44);
  const otherPoints = peers.map((item) => compactText(
    item.points?.[0] || item.sections?.[0] || item.principle || item.meaning,
    44,
  ));
  return [
    question(
      `${prefix}-${entity.id}-name`, lesson, `“${ownDescription}”对应哪一项？`, entity.name,
      otherNames, `${entity.name}：${ownDescription}`, entity.name,
    ),
    question(
      `${prefix}-${entity.id}-desc`, lesson, `以下哪项是“${entity.name}”的核心说明？`, ownDescription,
      otherDescriptions, `${entity.name}：${ownDescription}`, entity.name,
    ),
    question(
      `${prefix}-${entity.id}-point`, lesson, `以下哪一要点属于“${entity.name}”？`, ownPoint,
      otherPoints, ownPoint, entity.name,
    ),
  ];
}

function buildTheoryQuestions(lesson, appState) {
  const all = appState.theorems || [];
  return all.filter((item) => lesson.refs.includes(item.id))
    .flatMap((item) => entityQuestions(lesson, item, all.filter((peer) => peer.id !== item.id), 'theory'));
}

function buildWingQuestions(lesson, appState) {
  const all = appState.wings || [];
  return all.filter((item) => lesson.refs.includes(item.id))
    .flatMap((item) => entityQuestions(lesson, item, all.filter((peer) => peer.id !== item.id), 'wing'));
}

function buildTrigramQuestions(lesson, appState) {
  const trigrams = appState.trigrams || [];
  return trigrams.flatMap((trigram) => {
    const peers = trigrams.filter((item) => item.binaryCode !== trigram.binaryCode);
    return [
      question(
        `trigram-${trigram.binaryCode}-nature`, lesson, `自然之象为“${trigram.nature}”的是哪一卦？`,
        trigram.name, peers.map((item) => item.name), `${trigram.name}为${trigram.nature}，德性为${trigram.attribute}。`, '《说卦传》',
      ),
      question(
        `trigram-${trigram.binaryCode}-attribute`, lesson, `德性为“${trigram.attribute}”的是哪一卦？`,
        trigram.name, peers.map((item) => item.name), `${trigram.name}为${trigram.nature}，德性为${trigram.attribute}。`, '《说卦传》',
      ),
      question(
        `trigram-${trigram.binaryCode}-code`, lesson, `三爻编码“${trigram.binaryCode}”（自下而上）是哪一卦？`,
        trigram.name, peers.map((item) => item.name), `${trigram.name}的三爻编码为 ${trigram.binaryCode}。`, '八卦基础数据',
      ),
    ];
  });
}

function buildHexagramQuestions(lesson, appState) {
  const [start, end] = lesson.range;
  const selected = (appState.hexagrams || []).filter((item) => item.number >= start && item.number <= end);
  const all = appState.hexagrams || [];
  return selected.flatMap((hexagram) => {
    const peers = all.filter((item) => item.binaryCode !== hexagram.binaryCode);
    const judgement = compactText(hexagram.judgement, 42);
    return [
      question(
        `hex-${hexagram.binaryCode}-order`, lesson, `第 ${hexagram.number} 卦是哪一卦？`, hexagram.name,
        peers.map((item) => item.name), `第 ${hexagram.number} 卦为${hexagram.fullName}。`, '《周易》卦序',
      ),
      question(
        `hex-${hexagram.binaryCode}-full`, lesson, `“${hexagram.name}”的完整卦名是哪一项？`, hexagram.fullName,
        peers.map((item) => item.fullName), `${hexagram.name}：${hexagram.fullName}。`, '《周易》本经',
      ),
      question(
        `hex-${hexagram.binaryCode}-judgement`, lesson, `卦辞“${judgement}”属于哪一卦？`, hexagram.name,
        peers.map((item) => item.name), `${hexagram.name}卦卦辞：${compactText(hexagram.judgement, 80)}`, '《周易》本经',
      ),
    ];
  });
}

function buildAlmanacQuestions(lesson, appState) {
  const all = appState.almanacTerms || [];
  return all.filter((item) => item.category === lesson.category)
    .flatMap((item) => entityQuestions(lesson, item, all.filter((peer) => peer.id !== item.id), 'almanac'));
}

export function buildLearningQuestionBank(appState) {
  return LEARNING_LESSONS.flatMap((lesson) => {
    if (lesson.type === 'theory') return buildTheoryQuestions(lesson, appState);
    if (lesson.type === 'trigrams') return buildTrigramQuestions(lesson, appState);
    if (lesson.type === 'hexagrams') return buildHexagramQuestions(lesson, appState);
    if (lesson.type === 'wings') return buildWingQuestions(lesson, appState);
    if (lesson.type === 'almanac') return buildAlmanacQuestions(lesson, appState);
    return [];
  }).filter((item) => item.options.length >= 2);
}

export function getLesson(lessonId) {
  return LEARNING_LESSONS.find((lesson) => lesson.id === lessonId) || null;
}

export function getLevel(levelId) {
  return LEARNING_LEVELS.find((level) => level.id === levelId) || null;
}

export function getLessonRubric(lessonId, appState) {
  const lesson = getLesson(lessonId);
  if (!lesson) return [];
  if (lesson.type === 'theory') {
    return (appState.theorems || []).filter((item) => lesson.refs.includes(item.id))
      .flatMap((item) => item.points.slice(0, 4));
  }
  if (lesson.type === 'wings') {
    return (appState.wings || []).filter((item) => lesson.refs.includes(item.id))
      .flatMap((item) => item.sections.slice(0, 2));
  }
  if (lesson.type === 'trigrams') {
    return ['能辨认八卦三爻符号', '能说出八卦的自然之象', '能说明八卦的核心德性'];
  }
  if (lesson.type === 'hexagrams') {
    const [start, end] = lesson.range;
    return (appState.hexagrams || []).filter((item) => item.number >= start && item.number <= end)
      .slice(0, 5).map((item) => `能概述${item.name}卦的卦名、卦辞与核心情境`);
  }
  return (appState.almanacTerms || []).filter((item) => item.category === lesson.category)
    .slice(0, 5).map((item) => `能解释“${item.name}”的基本含义与适用边界`);
}
