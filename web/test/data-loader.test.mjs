import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildHexagramIndex,
  loadAlmanacData,
  loadAllData,
  loadCoreData,
  loadLearningData,
  resetOptionalDataCache,
  searchHexagrams,
} from '../js/data-loader.js';

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
    assert.equal(searchHexagrams(hexagrams, '  ').length, 64);
  } finally {
    resetOptionalDataCache();
    globalThis.fetch = previousFetch;
  }
});
