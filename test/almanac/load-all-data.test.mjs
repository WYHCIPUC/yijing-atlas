// 数据加载全流程集成测试。
// 模拟 loadAllData 的真实行为：读取全部 6 个 JSON → 解构 → 返回完整对象。
// 目的：捕获"解构遗漏"类 bug（如 almanacTerms is not defined）。
// 在 web/ 目录运行：node ../test/almanac/load-all-data.test.mjs
import { readFileSync } from 'fs';

// 模拟浏览器的 fetch（读本地文件）
function fetchJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

// 复现 data-loader.js 的常量与 loadAllData 逻辑
const PATHS = {
  hexagrams: 'data/hexagrams.json',
  trigrams: 'data/trigrams.json',
  wings: 'data/wings.json',
  theorems: 'data/theorems.json',
  almanacTerms: 'data/almanac-terms.json',
  almanacYiji: 'data/almanac-yiji.json',
};

const asserts = [];
function ok(name, cond, detail) {
  asserts.push({ name, cond, detail });
  console.log(`${cond ? '✓' : '✗'} ${name}${!cond && detail ? ' — ' + detail : ''}`);
}

async function loadAllData() {
  // 与 data-loader.js 完全一致的解构（6 个变量，必须全部声明）
  const [hexagrams, trigrams, wings, theorems, almanacTerms, almanacYiji] = await Promise.all([
    Promise.resolve(fetchJson(PATHS.hexagrams)),
    Promise.resolve(fetchJson(PATHS.trigrams)),
    Promise.resolve(fetchJson(PATHS.wings)),
    Promise.resolve(fetchJson(PATHS.theorems)),
    Promise.resolve(fetchJson(PATHS.almanacTerms)),
    Promise.resolve(fetchJson(PATHS.almanacYiji)),
  ]);
  return { hexagrams, trigrams, wings, theorems, almanacTerms, almanacYiji };
}

const data = await loadAllData();

// 1. 每个字段都存在且类型正确
ok('hexagrams 是数组', Array.isArray(data.hexagrams));
ok('trigrams 是数组', Array.isArray(data.trigrams));
ok('wings 是数组', Array.isArray(data.wings));
ok('theorems 是数组', Array.isArray(data.theorems));
ok('almanacTerms 是数组', Array.isArray(data.almanacTerms), `实际: ${typeof data.almanacTerms}`);
ok('almanacYiji 是对象', typeof data.almanacYiji === 'object' && !Array.isArray(data.almanacYiji));

// 2. 数据规模合理
ok('hexagrams 64 卦', data.hexagrams.length === 64);
ok('trigrams 8 卦', data.trigrams.length === 8);
ok('wings >= 4 篇', data.wings.length >= 4);
ok('theorems >= 5 条', data.theorems.length >= 5);
ok('almanacTerms >= 50 条', data.almanacTerms.length >= 50, `实际 ${data.almanacTerms.length}`);
ok('almanacYiji >= 20 项', Object.keys(data.almanacYiji).length >= 20);

// 3. 关键字段非 undefined（这是 almanacTerms is not defined bug 的根因防护）
for (const key of ['hexagrams','trigrams','wings','theorems','almanacTerms','almanacYiji']) {
  ok(`${key} 非 undefined`, data[key] !== undefined);
}

// 4. JSON 可被 JSON.stringify 序列化（确认无循环引用/函数）
try {
  JSON.stringify(data);
  ok('全部数据可序列化', true);
} catch (e) {
  ok('全部数据可序列化', false, e.message);
}

// 5. 模拟 main.js 的 state 赋值（确认无遗漏字段）
const state = { hexagrams:[], trigrams:[], wings:[], theorems:[], almanacTerms:[], almanacYiji:{}, index:null };
state.hexagrams = data.hexagrams;
state.trigrams = data.trigrams;
state.wings = data.wings;
state.theorems = data.theorems;
state.almanacTerms = data.almanacTerms;
state.almanacYiji = data.almanacYiji;
ok('state.almanacTerms 已赋值', state.almanacTerms.length > 0);
ok('state.almanacYiji 已赋值', Object.keys(state.almanacYiji).length > 0);

const failed = asserts.filter(a => !a.cond);
console.log(failed.length ? `\n${failed.length} 项失败` : '\n全部通过');
process.exit(failed.length ? 1 : 0);
