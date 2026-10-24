import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as dataLoader from '../js/data-loader.js';
import { StarMap } from '../js/star-map.js';

const {
  buildHexagramIndex,
  loadAlmanacData,
  loadAllData,
  loadCoreData,
  loadCommentaryManifest,
  loadLearningData,
  loadHexagramKeywords,
  resetOptionalDataCache,
  searchHexagrams,
} = dataLoader;

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('浏览器启动只取核心数据，功能数据首次进入时加载并复用', async () => {
  const calls = [];
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (path) => {
    calls.push(path);
    try {
      const value = JSON.parse(await readFile(join(webRoot, path), 'utf8'));
      return { ok: true, json: async () => value };
    } catch {
      return { ok: false, status: 404 };
    }
  };

  try {
    const core = await loadCoreData();
    assert.equal(core.hexagrams.length, 64);
    assert.equal(core.trigrams.length, 8);
    assert.deepEqual(calls.sort(), ['data/hexagrams.json', 'data/trigrams.json']);

    const learning = await loadLearningData();
    assert.ok(learning.wings.length >= 4);
    const callCount = calls.length;
    await loadLearningData();
    assert.equal(calls.length, callCount);

    const almanac = await loadAlmanacData();
    assert.ok(almanac.almanacTerms.length >= 50);
    const commentaryManifest = await loadCommentaryManifest();
    assert.equal(commentaryManifest.releaseReady, false);
    const all = await loadAllData();
    assert.equal(all.hexagrams.length, 64);
    assert.equal(calls.filter((path) => path === 'data/hexagrams.json').length, 2);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('HTTP 错误包含资源路径和状态码', async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false, status: 503 });
  try {
    await assert.rejects(loadCoreData(), /data\/hexagrams\.json.*503/);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('核心数据自检覆盖数量、唯一性、卦序和爻码一致性', async () => {
  const previousFetch = globalThis.fetch;
  const originalHexagrams = JSON.parse(await readFile(join(webRoot, 'data/hexagrams.json'), 'utf8'));
  const originalTrigrams = JSON.parse(await readFile(join(webRoot, 'data/trigrams.json'), 'utf8'));
  const cases = [
    ['卦的数量', originalHexagrams.slice(0, 63), originalTrigrams],
    ['重复的 binaryCode', (() => { const value = structuredClone(originalHexagrams); value[1].binaryCode = value[0].binaryCode; return value; })(), originalTrigrams],
    ['卦序必须', (() => { const value = structuredClone(originalHexagrams); value[0].number = 2; return value; })(), originalTrigrams],
    ['不一致', (() => { const value = structuredClone(originalHexagrams); value[0].lines[0].isYang = !value[0].lines[0].isYang; return value; })(), originalTrigrams],
    ['爻题不一致', (() => { const value = structuredClone(originalHexagrams); value[0].lines[0].text = '初六：测试。'; return value; })(), originalTrigrams],
    ['八卦数量', originalHexagrams, originalTrigrams.slice(0, 7)],
    ['重复的八卦', originalHexagrams, (() => { const value = structuredClone(originalTrigrams); value[1].binaryCode = value[0].binaryCode; return value; })()],
  ];

  try {
    for (const [message, hexagrams, trigrams] of cases) {
      globalThis.fetch = async (path) => ({
        ok: true,
        json: async () => path.includes('hexagrams') ? hexagrams : trigrams,
      });
      await assert.rejects(loadCoreData(), new RegExp(message));
    }
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('功能数据失败后可重试，索引和全文搜索可用', async () => {
  const previousFetch = globalThis.fetch;
  let failedPath = 'data/wings.json';
  globalThis.fetch = async (path) => {
    if (path === failedPath) return { ok: false, status: 500 };
    return { ok: true, json: async () => JSON.parse(await readFile(join(webRoot, path), 'utf8')) };
  };
  try {
    resetOptionalDataCache();
    await assert.rejects(loadLearningData(), /wings/);
    failedPath = '';
    assert.ok((await loadLearningData()).wings.length > 0);
    resetOptionalDataCache();
    failedPath = 'data/almanac-terms.json';
    await assert.rejects(loadAlmanacData(), /almanac-terms/);
    failedPath = '';
    assert.ok((await loadAlmanacData()).almanacTerms.length > 0);

    const hexagrams = JSON.parse(await readFile(join(webRoot, 'data/hexagrams.json'), 'utf8'));
    const index = buildHexagramIndex(hexagrams);
    assert.equal(index.byNumber.get(1).name, '乾');
    assert.equal(index.byName.get('坤').binaryCode, '000000');
    assert.equal(searchHexagrams(hexagrams, '君子以自强不息')[0].name, '乾');
    assert.equal(searchHexagrams(hexagrams, '  ').length, 0);
  } finally {
    resetOptionalDataCache();
    globalThis.fetch = previousFetch;
  }
});

const searchHexagramData = JSON.parse(await readFile(join(webRoot, 'data/hexagrams.json'), 'utf8'));
const searchTrigramData = JSON.parse(await readFile(join(webRoot, 'data/trigrams.json'), 'utf8'));

test('搜索与星图并发复用同一关键词加载，成功缓存可显式重置', async () => {
  assert.equal(typeof loadHexagramKeywords, 'function');
  const previousFetch = globalThis.fetch;
  const keywordData = JSON.parse(await readFile(join(webRoot, 'data/hexagram-keywords.json'), 'utf8'));
  let release;
  const pending = new Promise(resolvePending => { release = resolvePending; });
  let calls = 0;
  globalThis.fetch = async path => {
    assert.equal(path, 'data/hexagram-keywords.json');
    calls += 1;
    await pending;
    return { ok: true, json: async () => keywordData };
  };
  try {
    resetOptionalDataCache();
    const first = loadHexagramKeywords();
    const second = loadHexagramKeywords();
    const star = { keywords: null, keywordLayouts: null };
    const starLoad = StarMap.prototype._loadKeywords.call(star);
    assert.equal(first, second, '并发调用应共享Promise');
    assert.equal(calls, 1, '星图与搜索不能分别抓取同一资料');
    release();
    await Promise.all([first, starLoad]);
    assert.equal(await second, keywordData);
    assert.equal(star.keywords, keywordData);
    assert.equal(Object.keys(star.keywordLayouts).length, 64);
    assert.equal(star.keywordLayouts['111111'][0].text, keywordData['111111'][0].text);
    assert.equal(await loadHexagramKeywords(), keywordData);
    assert.equal(calls, 1);
    resetOptionalDataCache();
    assert.equal(await loadHexagramKeywords(), keywordData);
    assert.equal(calls, 2);
  } finally {
    release();
    resetOptionalDataCache();
    globalThis.fetch = previousFetch;
  }
});

test('关键词HTTP和JSON失败清理缓存，后续调用可重试', async () => {
  assert.equal(typeof loadHexagramKeywords, 'function');
  const previousFetch = globalThis.fetch;
  const keywords = { '111111': [{ text: '刚健', level: 1 }] };
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    if (calls === 1) return { ok: false, status: 503 };
    if (calls === 2) return { ok: true, json: async () => { throw new SyntaxError('坏JSON'); } };
    return { ok: true, json: async () => keywords };
  };
  try {
    resetOptionalDataCache();
    await assert.rejects(loadHexagramKeywords(), /hexagram-keywords\.json.*503/);
    await assert.rejects(loadHexagramKeywords(), /坏JSON/);
    assert.equal(await loadHexagramKeywords(), keywords);
    assert.equal(calls, 3);
  } finally {
    resetOptionalDataCache();
    globalThis.fetch = previousFetch;
  }
});

test('坏关键词结构拒绝并可重试，核心卦数据与正文搜索不受阻断', async () => {
  assert.equal(typeof loadHexagramKeywords, 'function');
  const previousFetch = globalThis.fetch;
  const valid = { '111111': [{ text: '刚健', level: 1 }], '000000': [] };
  const invalid = [null, [], '错误', { bad: [] }, { '111111': null }, { '111111': [null] },
    { '111111': [{ text: 1, level: 1 }] }, { '111111': [{ text: ' ', level: 1 }] },
    { '111111': [{ text: '乾' }] }, { '111111': [{ text: '乾', level: 4 }] },
    { '111111': [{ text: '乾', level: 1.5 }] }];
  let payload;
  globalThis.fetch = async path => ({ ok: true, json: async () => path === 'data/hexagram-keywords.json'
    ? payload : JSON.parse(await readFile(join(webRoot, path), 'utf8')) });
  try {
    for (const malformed of invalid) {
      resetOptionalDataCache();
      payload = malformed;
      await assert.rejects(loadHexagramKeywords(), /hexagram-keywords\.json.*结构/);
      const core = await loadCoreData();
      assert.equal(core.hexagrams.length, 64);
      assert.equal(searchHexagrams(core.hexagrams, '自强不息')[0].name, '乾');
      assert.equal(searchHexagrams(core.hexagrams, '下乾上坤', { trigrams: core.trigrams })[0].name, '泰');
      payload = valid;
      assert.equal(await loadHexagramKeywords(), valid, '坏结构不能永久污染可选缓存');
    }
  } finally {
    resetOptionalDataCache();
    globalThis.fetch = previousFetch;
  }
});

test('星图关键词结构失败保留无关键词降级，之后能复用修复资料', async () => {
  assert.equal(typeof loadHexagramKeywords, 'function');
  const previousFetch = globalThis.fetch;
  const previousWarn = console.warn;
  const warnings = [];
  let payload = { '111111': [{ text: null, level: 1 }] };
  globalThis.fetch = async () => ({ ok: true, json: async () => payload });
  console.warn = (...args) => warnings.push(args);
  try {
    resetOptionalDataCache();
    const star = { keywords: null, keywordLayouts: null };
    await StarMap.prototype._loadKeywords.call(star);
    assert.equal(star.keywords, null);
    assert.equal(star.keywordLayouts, null);
    assert.equal(warnings.length, 1);
    payload = { '111111': [{ text: '刚健', level: 1 }] };
    await StarMap.prototype._loadKeywords.call(star);
    assert.equal(star.keywords, payload);
    assert.ok(Number.isFinite(star.keywordLayouts['111111'][0].phase));
  } finally {
    resetOptionalDataCache();
    globalThis.fetch = previousFetch;
    console.warn = previousWarn;
  }
});

test('搜索六位码与卦序明确匹配，不把编码转成数字', () => {
  const cases = [['111111', 1], ['000000', 2], ['000001', 23], ['1', 1], ['11', 11], ['64', 64], ['第64卦', 64]];
  for (const [query, number] of cases) {
    assert.deepEqual(searchHexagrams(searchHexagramData, query).map(hexagram => hexagram.number), [number], query);
  }
});

test('上下卦搜索使用真实八卦数据和结构字段，保留自下而上编码', () => {
  const options = { trigrams: searchTrigramData };
  for (const [query, name] of [['下乾上坤', '泰'], ['上坤下乾', '泰'], ['上乾下坤', '否'], ['上巽下艮', '渐']]) {
    assert.deepEqual(searchHexagrams(searchHexagramData, query, options).map(hexagram => hexagram.name), [name], query);
  }
  for (const hexagram of searchHexagramData) {
    const lower = searchTrigramData.find(trigram => trigram.binaryCode === hexagram.trigramLower).name;
    const upper = searchTrigramData.find(trigram => trigram.binaryCode === hexagram.trigramUpper).name;
    assert.deepEqual(searchHexagrams(searchHexagramData, `上${upper}下${lower}`, options).map(result => result.binaryCode), [hexagram.binaryCode]);
  }
  assert.deepEqual(searchHexagrams(searchHexagramData, '上天下地', options), []);
  assert.deepEqual(searchHexagrams(searchHexagramData, '上坤下乾'), [], '缺少八卦资料时不复制或猜测映射');
});

test('卦名和全称精确命中优先，普通文本结果按文王卦序稳定排序', () => {
  const reversed = [...searchHexagramData].reverse();
  assert.deepEqual(searchHexagrams(reversed, ' 乾 ').map(hexagram => hexagram.number), [1, 2, 10, 13]);
  assert.equal(searchHexagrams(reversed, '乾为天')[0].number, 1);
  assert.equal(searchHexagrams(reversed, '君子以自强不息')[0].number, 1);
  assert.equal(reversed[0].number, 64, '搜索不能原地排序调用方数组');
});

test('多字段和重复数据命中去重，名称包含优先于关键词及正文', () => {
  const query = '共同检索词';
  const makeHexagram = (number, extra) => ({
    ...searchHexagramData.find(hexagram => hexagram.number === number),
    name: `测试${number}`, fullName: `全称${number}`, judgement: '', image: '', tuan: '', orderRemark: '', lines: [], ...extra,
  });
  const exact = makeHexagram(64, { fullName: query });
  const namePart = makeHexagram(53, { name: `前${query}后` });
  const keyword = makeHexagram(12, {});
  const body = makeHexagram(11, { judgement: query, lines: [{ text: query, xiang: query }] });
  const input = [keyword, body, namePart, exact, body];
  const options = { keywords: { [keyword.binaryCode]: [{ text: query, level: 2 }] } };
  assert.deepEqual(searchHexagrams(input, query, options).map(hexagram => hexagram.number), [64, 53, 11, 12]);
  assert.deepEqual(input.map(hexagram => hexagram.number), [12, 11, 53, 64, 11]);
});

test('关键词是可选增强，缺失或损坏不阻断核心搜索', () => {
  for (const keywords of [undefined, null, {}, { '111111': null }, { '111111': [{ text: null }, {}] }]) {
    assert.equal(searchHexagrams(searchHexagramData, '111111', { keywords })[0]?.name, '乾');
    assert.equal(searchHexagrams(searchHexagramData, '自强不息', { keywords })[0]?.name, '乾');
  }
  assert.deepEqual(searchHexagrams(searchHexagramData, '专用测试词', {
    keywords: { '111111': [{ text: '专用测试词', level: 2 }] },
  }).map(hexagram => hexagram.name), ['乾']);
});

test('空串及非法序号编码返回空结果，即使正文包含该字符串', () => {
  for (const query of ['', '   ', '0', '65', '01', '001', '1111111', '0000001', '101102', '000064', '第65卦', '第01卦']) {
    const fixture = [{ ...searchHexagramData[0], judgement: query }];
    assert.deepEqual(searchHexagrams(fixture, query).map(hexagram => hexagram.number), [], query);
  }
  assert.deepEqual(searchHexagrams(searchHexagramData, null), []);
  assert.deepEqual(searchHexagrams(null, '乾'), []);
});
