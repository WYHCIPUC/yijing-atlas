import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const serviceWorker = readFileSync(join(webRoot, 'sw.js'), 'utf8');
const main = readFileSync(join(webRoot, 'js', 'main.js'), 'utf8');
const precacheBlock = serviceWorker.match(/const PRECACHE = \[([\s\S]*?)\];/)?.[1] || '';
const precache = new Set([...precacheBlock.matchAll(/'([^']+)'/g)].map((match) => match[1]));
const html = readFileSync(join(webRoot, 'index.html'), 'utf8');
const entryAssets = [...html.matchAll(/(?:src|href)="((?:js\/main\.js|styles\/main\.css)\?v=\d+)"/g)]
  .map((match) => `./${match[1]}`);

test('预缓存条目全部指向现有静态资源', () => {
  for (const url of precache) {
    if (url === './') continue;
    const path = join(webRoot, url.replace(/^\.\//, '').split('?')[0]);
    assert.ok(existsSync(path), `缺少预缓存资源：${url}`);
  }
});

test('预缓存只包含首屏核心模块，功能数据按访问缓存', () => {
  const core = [
    ...entryAssets, './js/protocol-guard.js', './js/data-loader.js', './js/evolution-lab.js', './js/evolution-state.js',
    './js/guaxu-wheel.js', './js/modes/guaxu-mode.js',
    './js/celestial-stage.js', './js/cinematic-motion.js', './js/content-provenance.js', './js/motion-system.js', './js/render.js', './js/star-map.js', './js/star-layouts.js',
    './js/relation-animation.js', './js/star-relations.js', './js/star-atmosphere.js', './js/storage.js',
    './js/review-engine.js', './js/search-controller.js',
    './data/hexagrams.json', './data/trigrams.json',
  ];
  core.forEach((url) => assert.ok(precache.has(url), `核心资源未预缓存：${url}`));
  assert.equal(precache.has('./data/almanac-terms.json'), false);
  assert.equal(precache.has('./data/wings.json'), false);
  assert.match(serviceWorker, /event\.waitUntil\(refreshed\.catch/);
});

test('缓存资源不再维护重复查询版本号', () => {
  const revisioned = [...precache].filter((url) => url.includes('?v='));
  assert.equal(entryAssets.length, 2);
  assert.deepEqual(revisioned.sort(), entryAssets.sort());
});

test('页面结构与脚本样式采用同代更新策略', () => {
  const revision = entryAssets[0].match(/\?v=(\d+)/)[1];
  assert.ok(serviceWorker.includes(`const CACHE_NAME = 'yijing-atlas-v${revision}'`));
  assert.doesNotMatch(main, /\?v=4[89]/);
  assert.match(serviceWorker, /\['script', 'style', 'worker'\]\.includes\(request\.destination\)/);
  const networkFirstBlock = serviceWorker.match(/if \(\['script', 'style', 'worker'\][\s\S]*?\n  \}/)?.[0] || '';
  assert.match(networkFirstBlock, /fetch\(request\)/);
  assert.match(networkFirstBlock, /catch\(\(\) => caches\.match\(request\)\)/);
});
