// 全页面渲染冒烟测试：用真实数据 + DOM mock 跑遍每个页面的渲染函数，
// 捕获任何运行时错误（字段未定义、函数不存在、模板字符串异常等）。
// 这是 almanacTerms bug 的根治性防护——任何页面引用了不存在的字段都会在这里炸出来。
// 运行：cd web && node ../test/almanac/render-smoke.test.mjs

// ---- 最小 DOM mock ----
function makeEl() {
  const el = {
    innerHTML: '',
    querySelector: () => makeEl(),
    querySelectorAll: () => [],
    addEventListener: () => {},
    insertAdjacentHTML: () => {},
    dataset: {},
    style: {},
    classList: { add(){}, remove(){}, toggle(){}, contains(){return false;} },
  };
  return el;
}
globalThis.document = {
  getElementById: () => makeEl(),
  querySelector: () => makeEl(),
  querySelectorAll: () => [],
  createElement: () => makeEl(),
  body: makeEl(),
  addEventListener: () => {},
};
globalThis.window = {
  addEventListener: () => {},
  scrollTo: () => {},
  localStorage: { getItem: () => null, setItem: () => {} },
};
globalThis.location = { hash: '#/library', pathname: '/' };
globalThis.prompt = () => null;
globalThis.confirm = () => true;

import { readFileSync } from 'fs';
const load = (p) => JSON.parse(readFileSync(p, 'utf8'));
const appState = {
  hexagrams: load('data/hexagrams.json'),
  trigrams: load('data/trigrams.json'),
  wings: load('data/wings.json'),
  theorems: load('data/theorems.json'),
  almanacTerms: load('data/almanac-terms.json'),
  almanacYiji: load('data/almanac-yiji.json'),
  index: null,
};
// 构建 hexagramIndex（复用 data-loader 的逻辑）
const byCode = new Map(appState.hexagrams.map(h => [h.binaryCode, h]));
const byNumber = new Map(appState.hexagrams.map(h => [h.number, h]));
const byName = new Map(appState.hexagrams.map(h => [h.name, h]));
appState.index = { byCode, byNumber, byName };

const mount = makeEl();
const results = [];

async function tryRender(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`✓ ${name}`);
  } catch (e) {
    results.push({ name, ok: false, err: e.message });
    console.log(`✗ ${name} — ${e.message}`);
  }
}

// 逐个页面渲染
await tryRender('查阅-64卦列表', async () => {
  const { renderHexagramList } = await import('../../web/js/render.js');
  renderHexagramList(appState.hexagrams.slice(0, 5), mount, () => {});
});

await tryRender('查阅-卦象详情(乾)', async () => {
  const { renderHexagramDetail } = await import('../../web/js/render.js');
  const qian = byCode.get('111111');
  renderHexagramDetail(qian, mount);
});

await tryRender('查阅-卦象详情(未填经文的卦也测)', async () => {
  const { renderHexagramDetail } = await import('../../web/js/render.js');
  // 全部 64 卦都试，确保没有因数据差异崩溃
  for (const h of appState.hexagrams) renderHexagramDetail(h, makeEl());
});

await tryRender('八卦基础页', async () => {
  const { renderTrigrams } = await import('../../web/js/render.js');
  renderTrigrams(appState.trigrams, mount);
});

await tryRender('学习-十翼', async () => {
  const { renderWingsPage } = await import('../../web/js/study-page.js');
  renderWingsPage(mount, appState);
});

await tryRender('学习-象数', async () => {
  const { renderTheoremsPage } = await import('../../web/js/study-page.js');
  renderTheoremsPage(mount, appState);
});

await tryRender('学习-学习路径', async () => {
  const { renderStudyPathPage } = await import('../../web/js/study-page.js');
  renderStudyPathPage(mount, appState);
});

await tryRender('复习页', async () => {
  const { renderReviewPage } = await import('../../web/js/review-page.js');
  renderReviewPage(mount, appState);
});

await tryRender('测验页', async () => {
  const { renderQuizPage } = await import('../../web/js/quiz-page.js');
  renderQuizPage(mount, appState);
});

await tryRender('占筮页', async () => {
  const { renderDivinationPage } = await import('../../web/js/divination-page.js');
  renderDivinationPage(mount, appState);
});

await tryRender('黄历主页', async () => {
  const { renderAlmanacPage } = await import('../../web/js/almanac-page.js');
  renderAlmanacPage(mount, appState);
});

await tryRender('黄历知识页', async () => {
  const { renderAlmanacKnowledgePage } = await import('../../web/js/almanac-knowledge.js');
  renderAlmanacKnowledgePage(mount, appState);
});

const failed = results.filter(r => !r.ok);
console.log(failed.length ? `\n${failed.length} 个页面渲染失败` : '\n全部页面渲染通过');
process.exit(failed.length ? 1 : 0);
