// 加载 hexagrams.json / trigrams.json，并提供启动自检。
// 自检：64 卦数量、binaryCode 唯一、卦序 1-64 连续；八卦 8 条且唯一。

const HEXAGRAM_PATH = 'data/hexagrams.json';
const TRIGRAM_PATH = 'data/trigrams.json';
const WINGS_PATH = 'data/wings.json';
const THEOREMS_PATH = 'data/theorems.json';
const ALMANAC_TERMS_PATH = 'data/almanac-terms.json';
const ALMANAC_YIJI_PATH = 'data/almanac-yiji.json';

let learningDataPromise = null;
let almanacDataPromise = null;

async function fetchJson(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`加载 ${path} 失败：HTTP ${res.status}`);
  return res.json();
}

function validateHexagrams(list) {
  if (list.length !== 64) {
    throw new Error(`卦的数量必须为 64，实际 ${list.length}`);
  }
  const codes = new Set(list.map((h) => h.binaryCode));
  if (codes.size !== 64) {
    throw new Error(`存在重复的 binaryCode，唯一数 ${codes.size}`);
  }
  const numbers = new Set(list.map((h) => h.number));
  for (let i = 1; i <= 64; i++) {
    if (!numbers.has(i)) {
      throw new Error(`卦序必须 1-64 连续，缺失 ${i}`);
    }
  }
  // binaryCode 与 lines 一致性
  list.forEach((h) => {
    for (let i = 0; i < 6; i++) {
      const codeIsYang = h.binaryCode[i] === '1';
      const lineIsYang = h.lines[i].isYang;
      if (codeIsYang !== lineIsYang) {
        throw new Error(`${h.name} 爻${i + 1} binaryCode 与 lines 不一致`);
      }
    }
  });
}

function validateTrigrams(list) {
  if (list.length !== 8) {
    throw new Error(`八卦数量必须为 8，实际 ${list.length}`);
  }
  const codes = new Set(list.map((t) => t.binaryCode));
  if (codes.size !== 8) {
    throw new Error(`存在重复的八卦 binaryCode，唯一数 ${codes.size}`);
  }
}

export async function loadCoreData() {
  const [hexagrams, trigrams] = await Promise.all([
    fetchJson(HEXAGRAM_PATH),
    fetchJson(TRIGRAM_PATH),
  ]);
  validateHexagrams(hexagrams);
  validateTrigrams(trigrams);
  return { hexagrams, trigrams };
}

export function loadLearningData() {
  if (!learningDataPromise) {
    learningDataPromise = Promise.all([fetchJson(WINGS_PATH), fetchJson(THEOREMS_PATH)])
      .then(([wings, theorems]) => ({ wings, theorems }))
      .catch((error) => {
        learningDataPromise = null;
        throw error;
      });
  }
  return learningDataPromise;
}

export function loadAlmanacData() {
  if (!almanacDataPromise) {
    almanacDataPromise = Promise.all([fetchJson(ALMANAC_TERMS_PATH), fetchJson(ALMANAC_YIJI_PATH)])
      .then(([almanacTerms, almanacYiji]) => ({ almanacTerms, almanacYiji }))
      .catch((error) => {
        almanacDataPromise = null;
        throw error;
      });
  }
  return almanacDataPromise;
}

export function resetOptionalDataCache() {
  learningDataPromise = null;
  almanacDataPromise = null;
}

// 完整加载保留给数据校验工具；浏览器启动使用 loadCoreData。
export async function loadAllData() {
  const [core, learning, almanac] = await Promise.all([
    loadCoreData(),
    loadLearningData(),
    loadAlmanacData(),
  ]);
  const { hexagrams, trigrams } = core;
  const { wings, theorems } = learning;
  const { almanacTerms, almanacYiji } = almanac;
  return { hexagrams, trigrams, wings, theorems, almanacTerms, almanacYiji };
}

// 构建查询索引：按 binaryCode / number / name 快速查
export function buildHexagramIndex(hexagrams) {
  const byCode = new Map();
  const byNumber = new Map();
  const byName = new Map();
  hexagrams.forEach((h) => {
    byCode.set(h.binaryCode, h);
    byNumber.set(h.number, h);
    byName.set(h.name, h);
  });
  return { byCode, byNumber, byName };
}

// 全文检索：在卦名/全称/卦辞/大象/彖/序卦/爻辞中查找（不区分大小写）
export function searchHexagrams(hexagrams, keyword) {
  if (!keyword || keyword.trim() === '') return hexagrams;
  const kw = keyword.toLowerCase();
  const hit = (s) => (s || '').toLowerCase().includes(kw);
  return hexagrams.filter((h) => {
    if (hit(h.name) || hit(h.fullName) || hit(h.judgement) ||
        hit(h.image) || hit(h.tuan) || hit(h.orderRemark)) {
      return true;
    }
    return h.lines.some((y) => hit(y.text) || hit(y.xiang));
  });
}
