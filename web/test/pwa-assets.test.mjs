import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const serviceWorker = readFileSync(join(webRoot, 'sw.js'), 'utf8');
const precacheBlock = serviceWorker.match(/const PRECACHE = \[([\s\S]*?)\];/)?.[1] || '';
const precache = new Set([...precacheBlock.matchAll(/'([^']+)'/g)].map((match) => match[1]));

test('预缓存条目全部指向现有静态资源', () => {
  for (const url of precache) {
    if (url === './') continue;
    const path = join(webRoot, url.replace(/^\.\//, '').split('?')[0]);
    assert.ok(existsSync(path), `缺少预缓存资源：${url}`);
  }
});

test('预缓存只包含首屏核心模块，功能数据按访问缓存', () => {
  const core = [
    './js/main.js', './js/data-loader.js', './js/evolution-lab.js', './js/evolution-state.js',
    './js/render.js', './js/star-map.js',
    './js/relation-animation.js', './js/star-relations.js', './js/storage.js',
    './data/hexagrams.json', './data/trigrams.json',
  ];
  core.forEach((url) => assert.ok(precache.has(url), `核心资源未预缓存：${url}`));
  assert.equal(precache.has('./data/almanac-terms.json'), false);
  assert.equal(precache.has('./data/wings.json'), false);
  assert.match(serviceWorker, /event\.waitUntil\(refreshed\.catch/);
});

test('缓存资源不再维护重复查询版本号', () => {
  assert.equal([...precache].some((url) => url.includes('?v=')), false);
});
