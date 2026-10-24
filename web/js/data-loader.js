// 加载 hexagrams.json / trigrams.json，并提供启动自检。
// 自检：64 卦数量、binaryCode 唯一、卦序 1-64 连续；八卦 8 条且唯一。

import { parseHexagramQuery } from './search-controller.js';

const HEXAGRAM_PATH = 'data/hexagrams.json';
const TRIGRAM_PATH = 'data/trigrams.json';
const WINGS_PATH = 'data/wings.json';
const THEOREMS_PATH = 'data/theorems.json';
const ALMANAC_TERMS_PATH = 'data/almanac-terms.json';
const ALMANAC_YIJI_PATH = 'data/almanac-yiji.json';
const COMMENTARY_MANIFEST_PATH = 'data/commentaries/manifest.json';
const HEXAGRAM_KEYWORDS_PATH = 'data/hexagram-keywords.json';

let learningDataPromise = null;
let almanacDataPromise = null;
let commentaryManifestPromise = null;
let hexagramKeywordsPromise = null;

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
      const lineLabel = h.lines[i].text?.split('：')[0] || '';
      const expectedPolarity = lineIsYang ? '九' : '六';
      if (!lineLabel.includes(expectedPolarity)) {
        throw new Error(`${h.name} 爻${i + 1} 阴阳与爻题不一致`);
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

export function loadCommentaryManifest() {
  if (!commentaryManifestPromise) {
    commentaryManifestPromise = fetchJson(COMMENTARY_MANIFEST_PATH).catch((error) => {
      commentaryManifestPromise = null;
      throw error;
    });
  }
  return commentaryManifestPromise;
}

// 关键词是搜索和星图共享的可选资料；失败不缓存，下一次请求可重试。
export function loadHexagramKeywords() {
  if (!hexagramKeywordsPromise) {
    hexagramKeywordsPromise = fetchJson(HEXAGRAM_KEYWORDS_PATH)
      .then((keywords) => {
        const valid = keywords && typeof keywords === 'object' && !Array.isArray(keywords) &&
          Object.entries(keywords).every(([code, words]) => /^[01]{6}$/.test(code) &&
            Array.isArray(words) && words.every(word => word && typeof word.text === 'string' &&
              word.text.trim() && Number.isInteger(word.level) && word.level >= 0 && word.level <= 3));
        if (!valid) throw new Error(`加载 ${HEXAGRAM_KEYWORDS_PATH} 失败：结构无效`);
        return keywords;
      })
      .catch((error) => {
        hexagramKeywordsPromise = null;
        throw error;
      });
  }
  return hexagramKeywordsPromise;
}

export function resetOptionalDataCache() {
  learningDataPromise = null;
  almanacDataPromise = null;
  commentaryManifestPromise = null;
  hexagramKeywordsPromise = null;
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

// 结构查询精确匹配；文本按名称精确、名称包含、关键词/经传正文分层。
// keywords 是可选的卦码 → [{ text, level }] 资料，不成为核心搜索前置。
export function searchHexagrams(hexagrams, keyword, { trigrams = [], keywords = {} } = {}) {
  const query = parseHexagramQuery(keyword);
  if (!Array.isArray(hexagrams) || query.kind === 'empty' || query.kind === 'invalid') return [];
  let lowerCode;
  let upperCode;
  if (query.kind === 'trigrams') {
    if (!Array.isArray(trigrams)) return [];
    lowerCode = trigrams.find(trigram => trigram?.name === query.lowerName)?.binaryCode;
    upperCode = trigrams.find(trigram => trigram?.name === query.upperName)?.binaryCode;
    if (!/^[01]{3}$/.test(lowerCode || '') || !/^[01]{3}$/.test(upperCode || '')) return [];
  }
  const text = value => typeof value === 'string' ? value.toLowerCase() : '';
  const hit = value => text(value).includes(query.text);
  const matches = [];
  for (const hexagram of hexagrams) {
    let rank = -1;
    if (query.kind === 'code') rank = hexagram.binaryCode === query.code ? 0 : -1;
    else if (query.kind === 'number') rank = hexagram.number === query.number ? 0 : -1;
    else if (query.kind === 'trigrams') {
      rank = hexagram.trigramLower === lowerCode && hexagram.trigramUpper === upperCode ? 0 : -1;
    } else if (text(hexagram.name) === query.text || text(hexagram.fullName) === query.text) rank = 0;
    else if (hit(hexagram.name) || hit(hexagram.fullName)) rank = 1;
    else {
      const words = keywords?.[hexagram.binaryCode];
      if ((Array.isArray(words) && words.some(word => hit(word?.text))) ||
          [hexagram.judgement, hexagram.image, hexagram.tuan, hexagram.orderRemark].some(hit) ||
          (Array.isArray(hexagram.lines) && hexagram.lines.some(line => hit(line.text) || hit(line.xiang)))) rank = 2;
    }
    if (rank >= 0) matches.push({ hexagram, rank });
  }
  matches.sort((left, right) => left.rank - right.rank || left.hexagram.number - right.hexagram.number);
  const seen = new Set();
  return matches.filter(({ hexagram }) => {
    if (seen.has(hexagram.binaryCode)) return false;
    seen.add(hexagram.binaryCode);
    return true;
  }).map(({ hexagram }) => hexagram);
}
