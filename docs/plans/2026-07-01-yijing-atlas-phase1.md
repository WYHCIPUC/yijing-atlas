# 易象图谱 · 第 1 期实施计划（星图地基 + 查阅闭环）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有能跑的查阅站基础上，新增力导向 64 卦星图作为产品主场，将信息架构从"并列 Tab"重构为"图谱为体"，并应用墨空鎏金主题。完成后用户打开即见可漫游星图，悬停点亮四变、点击读经文。

**Architecture:** 新增 `star-map.js`（Canvas 力导向渲染 + 交互）作为核心；补全 `hexagram-utils.js` 的互卦/变卦函数；改造 `main.js` 为模式切换器架构；详情页改长卷阅读式 + 大字号；CSS 全量替换为墨空鎏金主题。原有查阅/搜索能力保留为"探索模式"下的功能。

**Tech Stack:** 原生 HTML/CSS/JS（ES Modules）；d3-force（~30KB，本地 vendor 引入，不依赖 CDN/npm install）；Canvas 2D 渲染星图；SVG 绘制卦象。

**现有资产（直接复用）：** `web/data/hexagrams.json`（64/64 完整，108KB）、`web/data/trigrams.json`（8 卦）、`hexagram-utils.js`（错卦/综卦已实现）、`svg-painter.js`、`data-loader.js`（启动自检）。

---

## 文件结构总览

```
web/
├── index.html               # 改造：7 Tab → 模式切换器 + 星图挂载点
├── styles/main.css          # 全量替换：墨空鎏金主题 + 大字号 + 星图样式
├── data/                    # 不变（hexagrams/trigrams 已完整）
├── lib/
│   └── d3-force.min.js      # 新增：d3-force 本地 vendor（ES Module 版）
├── js/
│   ├── main.js              # 改造：模式切换器架构（探索/复习/测验/占筮/黄历）
│   ├── data-loader.js       # 不变（复用）
│   ├── hexagram-utils.js    # 修改：补互卦/变卦函数
│   ├── svg-painter.js       # 不变（复用）
│   ├── star-map.js          # ★ 新增：力导向星图核心
│   ├── star-relations.js    # ★ 新增：构建 64 卦关系图数据（节点+边）
│   ├── render.js            # 修改：详情页改长卷阅读式 + 关系区
│   ├── review-page.js       # 暂不动（第 2 期改造为状态层）
│   ├── quiz-page.js         # 暂不动（第 2 期）
│   ├── divination-page.js   # 暂不动（第 3 期）
│   ├── almanac-page.js      # 暂不动（第 3 期）
│   └── study-page.js        # 暂不动
└── test/
    └── star-relations.test.mjs  # 新增：关系图数据正确性测试
```

---

## Task 1: 引入 d3-force 本地依赖

**Files:**
- Create: `web/lib/d3-force.min.js`

- [ ] **Step 1: 下载 d3-force ESM 版本到本地 vendor 目录**

```bash
cd "Y:/易经学习项目/web"
mkdir -p lib
# 下载 d3-force 的 ESM 单文件（约 30KB）
curl -sL "https://cdn.jsdelivr.net/npm/d3-force@3.0.0/src/index.js" -o lib/d3-force.js
```

若上面的 URL 无效（d3-force 源码是多个文件），改用打包好的 ESM bundle：

```bash
# 备选：从 esm.sh 获取打包好的单文件 ESM
curl -sL "https://esm.sh/d3-force@3" -o lib/d3-force.js
# 验证文件非空且含 export
head -5 lib/d3-force.js
grep -c "export" lib/d3-force.js
```

- [ ] **Step 2: 验证可正常 import**

```bash
cd "Y:/易经学习项目/web"
node --input-type=module -e "
import * as d3 from './lib/d3-force.js';
console.log('exports:', Object.keys(d3).join(', '));
console.log('has forceSimulation:', typeof d3.forceSimulation === 'function');
console.log('has forceLink:', typeof d3.forceLink === 'function');
console.log('has forceManyBody:', typeof d3.forceManyBody === 'function');
"
```

Expected: 输出包含 `forceSimulation`, `forceLink`, `forceManyBody`, `forceCenter`，且类型均为 `function`。

- [ ] **Step 3: Commit**

```bash
cd "Y:/易经学习项目"
git add web/lib/d3-force.js
git commit -m "chore: 引入 d3-force 本地依赖（力导向星图物理模拟）"
```

---

## Task 2: 补全 hexagram-utils（互卦 + 变卦）

**Files:**
- Modify: `web/js/hexagram-utils.js`
- Create: `web/test/hexagram-utils.test.mjs`

- [ ] **Step 1: 写失败测试**

Create `web/test/hexagram-utils.test.mjs`:

```javascript
import { oppositeCode, reversedCode, interlockingCode, changingCode, allRelations } from '../js/hexagram-utils.js';

const asserts = [];
function ok(name, cond) { asserts.push({name, ok: cond}); console.log(`${cond?'✓':'✗'} ${name}`); }

// 互卦：取 2-3-4 爻为下卦，3-4-5 爻为上卦（索引 1-3 + 2-4，即 lines[1..3]+lines[2..4]）
// 泰 111000：lines = [1,1,1,0,0,0]，2-3-4=[1,1,0]，3-4-5=[1,0,0] → 互卦 = "110"+"100" = 110100 = 归妹
ok('互卦(泰111000)=归妹110100', interlockingCode('111000') === '110100');
// 乾 111111：互卦 = 111+111 = 111111 = 乾（自互）
ok('互卦(乾111111)=乾111111', interlockingCode('111111') === '111111');

// 变卦：指定爻位翻转。position 1-6（自下而上，对应 code[0..5]）
ok('变卦(乾111111, pos1)=姤011111', changingCode('111111', 1) === '011111');
ok('变卦(乾111111, pos2)=遁101111', changingCode('111111', 2) === '101111');
ok('变卦(坤000000, pos1)=复100000', changingCode('000000', 1) === '100000');

// allRelations：一次返回四条变
const r = allRelations('111000'); // 泰
ok('泰错=否000111', r.opposite === '000111');
ok('泰综=否000111', r.reversed === '000111');
ok('泰互=归妹110100', r.interlocking === '110100');
ok('泰变是数组(6个)', Array.isArray(r.changing) && r.changing.length === 6);
ok('泰变[0]=升011000', r.changing[0] === '011000');

const failed = asserts.filter(a => !a.ok);
console.log(failed.length ? `\n${failed.length} 项失败` : '\n全部通过');
process.exit(failed.length ? 1 : 0);
```

- [ ] **Step 2: 运行测试验证失败**

```bash
cd "Y:/易经学习项目/web"
node test/hexagram-utils.test.mjs
```

Expected: FAIL —— `interlockingCode` / `changingCode` / `allRelations` 未定义（import 报错或 undefined）。

- [ ] **Step 3: 实现互卦、变卦、allRelations**

在 `web/js/hexagram-utils.js` 末尾追加：

```javascript
// 互卦（内含之卦）：取 2-3-4 爻为下卦，3-4-5 爻为上卦。
// code 索引 0-5 对应爻 1-6（自下而上）。
// 下卦 = code[1]+code[2]+code[3]，上卦 = code[2]+code[3]+code[4]
export function interlockingCode(code) {
  validate(code);
  return code[1] + code[2] + code[3] + code[2] + code[3] + code[4];
}

// 变卦（动爻）：翻转指定爻位。position 为 1-6（自下而上）。
export function changingCode(code, position) {
  validate(code);
  if (position < 1 || position > 6) throw new Error(`position 需 1-6，得到 ${position}`);
  const idx = position - 1;
  const arr = code.split('');
  arr[idx] = arr[idx] === '1' ? '0' : '1';
  return arr.join('');
}

// 一次返回某卦的全部四条关系。
// changing 为 6 个变卦的数组（每爻各变一次）。
export function allRelations(code) {
  validate(code);
  return {
    opposite: oppositeCode(code),
    reversed: reversedCode(code),
    interlocking: interlockingCode(code),
    changing: [1,2,3,4,5,6].map(p => changingCode(code, p)),
  };
}
```

- [ ] **Step 4: 运行测试验证通过**

```bash
cd "Y:/易经学习项目/web"
node test/hexagram-utils.test.mjs
```

Expected: 全部 ✓ 通过。

- [ ] **Step 5: Commit**

```bash
cd "Y:/易经学习项目"
git add web/js/hexagram-utils.js web/test/hexagram-utils.test.mjs
git commit -m "feat(utils): 补全互卦/变卦/allRelations，星图四条变完整"
```

---

## Task 3: 构建 64 卦关系图数据

**Files:**
- Create: `web/js/star-relations.js`
- Create: `web/test/star-relations.test.mjs`

- [ ] **Step 1: 写失败测试**

Create `web/test/star-relations.test.mjs`:

```javascript
import { buildRelationGraph } from '../js/star-relations.js';

const asserts = [];
function ok(name, cond) { asserts.push({name, ok: cond}); console.log(`${cond?'✓':'✗'} ${name}`); }

// 用 4 个测试卦：乾(111111) 坤(000000) 泰(111000) 否(000111)
const testHex = [
  { binaryCode: '111111', name: '乾' },
  { binaryCode: '000000', name: '坤' },
  { binaryCode: '111000', name: '泰' },
  { binaryCode: '000111', name: '否' },
];
const graph = buildRelationGraph(testHex);

// 节点数 = 卦数
ok('节点数=4', graph.nodes.length === 4);

// 边数正确：泰的错=否、综=否（两条边），乾的错=坤（一条边）
// 互卦：乾互=乾(自身，不算边)，泰互=归妹(不在测试集，不算边)
const edges = graph.edges;
ok('边数>=1（乾→坤错卦）', edges.length >= 1);

// 乾坤之间应有错卦边
const qianKun = edges.find(e =>
  (e.source === '111111' && e.target === '000000') ||
  (e.source === '000000' && e.target === '111111')
);
ok('乾→坤存在错卦边', !!qianKun);
ok('乾→坤边类型=opposite', qianKun && qianKun.type === 'opposite');

// 泰否之间应有错卦+综卦两条边（或合并为一条多类型边）
const taiPi = edges.filter(e =>
  (e.source === '111000' && e.target === '000111') ||
  (e.source === '000111' && e.target === '111000')
);
ok('泰→否至少1条边', taiPi.length >= 1);

// 节点含 degree（连接数），用于星图大小
ok('节点含 degree', typeof graph.nodes[0].degree === 'number');

const failed = asserts.filter(a => !a.ok);
console.log(failed.length ? `\n${failed.length} 项失败` : '\n全部通过');
process.exit(failed.length ? 1 : 0);
```

- [ ] **Step 2: 运行测试验证失败**

```bash
cd "Y:/易经学习项目/web"
node test/star-relations.test.mjs
```

Expected: FAIL —— `buildRelationGraph` 未定义。

- [ ] **Step 3: 实现 buildRelationGraph**

Create `web/js/star-relations.js`:

```javascript
// 构建 64 卦关系图数据：节点（卦）+ 边（错综互变关系）。
// 供 star-map.js 的力导向布局使用。

import { allRelations } from './hexagram-utils.js';

// 关系类型 → 权重（引力强度）。错/综是基本关系，互/变稍弱。
const RELATION_WEIGHTS = {
  opposite: 3,   // 错卦
  reversed: 3,   // 综卦
  interlocking: 2, // 互卦
  changing: 1,   // 变卦（6 种，每条单独算但权重低）
};

// 边的唯一 key：无向边，两端排序后拼接，避免重复
function edgeKey(a, b) {
  return [a, b].sort().join('-');
}

/**
 * @param {Array} hexagrams - hexagrams.json 数组，每项含 binaryCode, name
 * @returns {{ nodes: Array, edges: Array }}
 *   node: { id, name, binaryCode, degree }
 *   edge: { source, target, type, weight }
 *   同一对节点间的多条关系合并为一条边，types 为数组。
 */
export function buildRelationGraph(hexagrams) {
  const codeSet = new Set(hexagrams.map(h => h.binaryCode));

  // 先收集所有边，按 edgeKey 去重合并
  const edgeMap = new Map(); // key -> { source, target, types: [], weight }

  for (const h of hexagrams) {
    const code = h.binaryCode;
    const rels = allRelations(code);

    const candidates = [
      { target: rels.opposite, type: 'opposite' },
      { target: rels.reversed, type: 'reversed' },
      { target: rels.interlocking, type: 'interlocking' },
      ...rels.changing.map((t, i) => ({ target: t, type: 'changing' })),
    ];

    for (const { target, type } of candidates) {
      if (target === code) continue; // 自关系（如乾互卦=乾）不算边
      if (!codeSet.has(target)) continue; // 目标不在集合内（不该发生，防御）
      const key = edgeKey(code, target);
      if (!edgeMap.has(key)) {
        const [a, b] = key.split('-');
        edgeMap.set(key, { source: a, target: b, types: [], weight: 0 });
      }
      const edge = edgeMap.get(key);
      if (!edge.types.includes(type)) {
        edge.types.push(type);
        edge.weight += RELATION_WEIGHTS[type];
      }
    }
  }

  const edges = Array.from(edgeMap.values());

  // 计算每个节点的 degree（连接的边数）
  const degreeMap = new Map();
  for (const e of edges) {
    degreeMap.set(e.source, (degreeMap.get(e.source) || 0) + 1);
    degreeMap.set(e.target, (degreeMap.get(e.target) || 0) + 1);
  }

  const nodes = hexagrams.map(h => ({
    id: h.binaryCode,
    name: h.name,
    binaryCode: h.binaryCode,
    number: h.number,
    degree: degreeMap.get(h.binaryCode) || 0,
  }));

  return { nodes, edges };
}
```

- [ ] **Step 4: 运行测试验证通过**

```bash
cd "Y:/易经学习项目/web"
node test/star-relations.test.mjs
```

Expected: 全部 ✓ 通过。

- [ ] **Step 5: 用真实 64 卦数据验证边的合理性**

```bash
cd "Y:/易经学习项目/web"
node --input-type=module -e "
import { readFileSync } from 'fs';
import { buildRelationGraph } from './js/star-relations.js';
const hex = JSON.parse(readFileSync('data/hexagrams.json','utf8'));
const g = buildRelationGraph(hex);
console.log('节点数:', g.nodes.length);
console.log('边数:', g.edges.length);
console.log('degree 最高的5个卦:', g.nodes.sort((a,b)=>b.degree-a.degree).slice(0,5).map(n=>n.name+'('+n.degree+')').join(', '));
console.log('degree 最低的5个卦:', g.nodes.sort((a,b)=>a.degree-b.degree).slice(0,5).map(n=>n.name+'('+n.degree+')').join(', '));
"
```

Expected: 节点 64，边数在 100-200 之间。degree 排序合理（关系密集的卦 degree 高）。

- [ ] **Step 6: Commit**

```bash
cd "Y:/易经学习项目"
git add web/js/star-relations.js web/test/star-relations.test.mjs
git commit -m "feat(star-map): 构建 64 卦关系图数据（节点+边，含 degree）"
```

---

## Task 4: 力导向星图核心（star-map.js）

这是第 1 期最核心、最复杂的任务。分多个子步骤实现。

**Files:**
- Create: `web/js/star-map.js`

- [ ] **Step 1: 实现星图模块骨架（模拟 + 渲染 + 基础交互）**

Create `web/js/star-map.js`:

```javascript
// 力导向 64 卦星图：Canvas 渲染 + d3-force 物理模拟 + 交互。
// 职责：布局计算、渲染、拖拽/缩放/悬停/点击、暴露 API。

import { forceSimulation, forceLink, forceManyBody, forceCenter } from '../lib/d3-force.js';
import { allRelations } from './hexagram-utils.js';

// 墨空鎏金配色
const COLORS = {
  bg: '#0a0e1a',
  star: '#8a7a5a',
  starHover: '#e8d09a',
  starActive: '#c9a96a',
  edge: 'rgba(201, 169, 106, 0.15)',
  edgeActive: '#c9a96a',
  glow: 'rgba(201, 169, 106, 0.35)',
  text: '#c9a96a',
  textDim: '#5a6680',
};

const RELATION_LABEL = { opposite: '错', reversed: '综', interlocking: '互', changing: '变' };

export class StarMap {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {{ nodes: Array, edges: Array }} graph
   * @param {Object} callbacks - { onPick(code), onHover(code|null) }
   */
  constructor(canvas, graph, callbacks = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.graph = graph;
    this.callbacks = callbacks;

    // 视图变换：平移 + 缩放
    this.view = { x: 0, y: 0, scale: 1 };
    // 交互状态
    this.hoveredNode = null;
    this.activeNode = null;
    this.isDragging = false;
    this.dragStart = null;
    // 自转
    this.rotation = 0;
    this.autoRotate = true;

    this._setupDpr();
    this._initSimulation();
    this._bindEvents();
    this._startRenderLoop();
  }

  // 高分屏适配
  _setupDpr() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.scale(dpr, dpr);
    this.width = rect.width;
    this.height = rect.height;
  }

  // 初始化力导向模拟
  _initSimulation() {
    // d3-force 用索引引用边，需要把 source/target 映射到 nodes 索引
    const nodeById = new Map(this.graph.nodes.map((n, i) => [n.id, i]));
    const links = this.graph.edges.map(e => ({
      source: nodeById.get(e.source),
      target: nodeById.get(e.target),
      weight: e.weight,
    }));

    this.simulation = forceSimulation(this.graph.nodes)
      .force('charge', forceManyBody().strength(-120))
      .force('link', forceLink(links).id(d => d.index).distance(d => 80 - d.weight * 5).strength(0.3))
      .force('center', forceCenter(this.width / 2, this.height / 2))
      .alphaDecay(0.02);

    // 初始随机位置
    this.graph.nodes.forEach(n => {
      if (n.x === undefined) {
        n.x = this.width / 2 + (Math.random() - 0.5) * 200;
        n.y = this.height / 2 + (Math.random() - 0.5) * 200;
      }
    });
  }

  // 世界坐标 → 屏幕坐标
  _worldToScreen(wx, wy) {
    const cx = this.width / 2, cy = this.height / 2;
    const cos = Math.cos(this.rotation), sin = Math.sin(this.rotation);
    const rx = (wx - cx) * cos - (wy - cy) * sin;
    const ry = (wx - cx) * sin + (wy - cy) * cos;
    return { x: rx * this.view.scale + cx + this.view.x, y: ry * this.view.scale + cy + this.view.y };
  }

  // 屏幕坐标 → 世界坐标（逆变换）
  _screenToWorld(sx, sy) {
    const cx = this.width / 2, cy = this.height / 2;
    const x = (sx - cx - this.view.x) / this.view.scale + cx;
    const y = (sy - cy - this.view.y) / this.view.scale + cy;
    const cos = Math.cos(-this.rotation), sin = Math.sin(-this.rotation);
    return {
      x: (x - cx) * cos - (y - cy) * sin + cx,
      y: (x - cx) * sin + (y - cy) * cos + cy,
    };
  }

  // 找屏幕坐标下的节点
  _nodeAt(sx, sy) {
    const r = 8 * this.view.scale; // 命中半径
    for (const n of this.graph.nodes) {
      const p = this._worldToScreen(n.x, n.y);
      if (Math.hypot(p.x - sx, p.y - sy) < r) return n;
    }
    return null;
  }

  _bindEvents() {
    const c = this.canvas;
    c.addEventListener('mousedown', (e) => {
      const rect = c.getBoundingClientRect();
      const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
      const node = this._nodeAt(sx, sy);
      if (node) {
        this.callbacks.onPick && this.callbacks.onPick(node.id);
      } else {
        this.isDragging = true;
        this.dragStart = { x: sx, y: sy, vx: this.view.x, vy: this.view.y };
      }
    });
    c.addEventListener('mousemove', (e) => {
      const rect = c.getBoundingClientRect();
      const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
      if (this.isDragging) {
        this.view.x = this.dragStart.vx + (sx - this.dragStart.x);
        this.view.y = this.dragStart.vy + (sy - this.dragStart.y);
        this.autoRotate = false;
      } else {
        const node = this._nodeAt(sx, sy);
        if (node !== this.hoveredNode) {
          this.hoveredNode = node;
          c.style.cursor = node ? 'pointer' : 'grab';
          this.callbacks.onHover && this.callbacks.onHover(node ? node.id : null);
        }
      }
    });
    c.addEventListener('mouseup', () => { this.isDragging = false; });
    c.addEventListener('mouseleave', () => { this.isDragging = false; this.hoveredNode = null; });
    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      this.view.scale = Math.max(0.3, Math.min(3, this.view.scale * factor));
    }, { passive: false });
  }

  // 渲染循环
  _startRenderLoop() {
    const loop = () => {
      if (this.autoRotate) this.rotation += 0.0002;
      this._render();
      requestAnimationFrame(loop);
    };
    loop();
  }

  _render() {
    const ctx = this.ctx;
    // 背景
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, this.width, this.height);

    // 确定高亮节点集合（悬停或激活）
    const focus = this.hoveredNode || this.activeNode;
    const focusRels = focus ? new Set([focus.id, ...this._relationTargets(focus.id)]) : null;

    // 绘制边
    const nodeById = new Map(this.graph.nodes.map(n => [n.id, n]));
    for (const e of this.graph.edges) {
      const s = nodeById.get(e.source), t = nodeById.get(e.target);
      if (!s || !t) continue;
      const sp = this._worldToScreen(s.x, s.y);
      const tp = this._worldToScreen(t.x, t.y);
      const isActive = focusRels && focusRels.has(e.source) && focusRels.has(e.target) &&
        (e.source === focus.id || e.target === focus.id);
      ctx.strokeStyle = isActive ? COLORS.edgeActive : COLORS.edge;
      ctx.lineWidth = isActive ? 1.2 : 0.4;
      ctx.globalAlpha = isActive ? 0.8 : (focus ? 0.2 : 1);
      ctx.beginPath();
      ctx.moveTo(sp.x, sp.y);
      ctx.lineTo(tp.x, tp.y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // 绘制节点
    for (const n of this.graph.nodes) {
      const p = this._worldToScreen(n.x, n.y);
      const isFocus = focus && n.id === focus.id;
      const isRel = focusRels && focusRels.has(n.id) && !isFocus;
      const r = isFocus ? 6 : (isRel ? 4 : 2.5 + Math.min(n.degree * 0.2, 2));

      // 光晕
      if (isFocus || isRel) {
        const glowR = isFocus ? 18 : 10;
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowR);
        grad.addColorStop(0, COLORS.glow);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, glowR, 0, Math.PI * 2);
        ctx.fill();
      }

      // 星点
      ctx.fillStyle = isFocus ? COLORS.starActive : (isRel ? COLORS.starHover : COLORS.star);
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();

      // 悬停时显示卦名
      if (isFocus) {
        ctx.fillStyle = COLORS.text;
        ctx.font = '13px serif';
        ctx.textAlign = 'center';
        ctx.fillText(n.name, p.x, p.y - 14);
      }
    }
  }

  // 获取某卦的关系目标集合（用于高亮）
  _relationTargets(code) {
    const rels = allRelations(code);
    return [rels.opposite, rels.reversed, rels.interlocking, ...rels.changing];
  }

  // === 公开 API ===

  // 聚焦某卦（搜索定位）
  focusStar(code) {
    const node = this.graph.nodes.find(n => n.id === code);
    if (!node) return;
    this.activeNode = node;
    // 平移视图使该节点居中
    this.view.x = -node.x * this.view.scale + this.width / 2 - this.width / 2; // 简化：停止自转，下帧渲染高亮
    this.autoRotate = false;
  }

  setMode(mode) {
    this.mode = mode;
    // 第 1 期仅探索模式，状态层在第 2/3 期实现
  }

  resize() {
    this._setupDpr();
    this.simulation.force('center', forceCenter(this.width / 2, this.height / 2));
    this.simulation.alpha(0.3).restart();
  }
}
```

- [ ] **Step 2: 在浏览器中手动验证星图渲染**

启动本地服务器（已存在 serve.bat / serve.sh）：

```bash
cd "Y:/易经学习项目/web"
bash serve.sh
```

此时星图还未接入 main.js（Task 6 才接入），所以需要一个临时验证页。创建 `web/test-starmap.html`（临时，最后删除）：

```html
<!DOCTYPE html><html><head><meta charset="UTF-8"><title>星图验证</title>
<style>body{margin:0;background:#0a0e1a}canvas{display:block}</style>
</head><body>
<canvas id="cv" style="width:100vw;height:100vh"></canvas>
<script type="module">
import { loadAllData, buildHexagramIndex } from './js/data-loader.js';
import { buildRelationGraph } from './js/star-relations.js';
import { StarMap } from './js/star-map.js';
const data = await loadAllData();
const graph = buildRelationGraph(data.hexagrams);
const sm = new StarMap(document.getElementById('cv'), graph, {
  onPick: (code) => console.log('picked', code),
  onHover: (code) => console.log('hover', code),
});
</script></body></html>
```

浏览器打开 `http://localhost:3030/test-starmap.html`，验证：
1. 黑底上出现 64 个金色星点，逐渐稳定布局
2. 鼠标悬停某星 → 该星+其四变连线高亮，其余变暗
3. 鼠标拖拽空白 → 星图平移，自转停止
4. 滚轮 → 缩放
5. 控制台无报错

- [ ] **Step 3: 删除临时验证页**

```bash
rm "Y:/易经学习项目/web/test-starmap.html"
```

- [ ] **Step 4: Commit**

```bash
cd "Y:/易经学习项目"
git add web/js/star-map.js
git commit -m "feat(star-map): 力导向星图核心（d3-force + Canvas 渲染 + 拖拽缩放悬停）"
```

---

## Task 5: 墨空鎏金主题 CSS

**Files:**
- Create: `web/styles/main.css`（全量替换）

- [ ] **Step 1: 实现墨空鎏金主题**

全量替换 `web/styles/main.css`:

```css
/* === 墨空鎏金主题 === */
:root {
  /* 底色 */
  --ink-bg: #0a0e1a;          /* 深空墨蓝 */
  --ink-bg-soft: #11172a;     /* 次级底 */
  --paper: #e8d9b8;           /* 羊皮卷 */
  --paper-soft: #f0e4ca;
  /* 金色系 */
  --gold-main: #c9a96a;       /* 主金 */
  --gold-bright: #e8d09a;     /* 亮金（复习） */
  --gold-light: #d4bc8a;      /* 浅金（占筮） */
  --gold-deep: #a08850;       /* 深金（黄历） */
  --gold-dim: #8a7a5a;
  /* 文字 */
  --text-primary: #e8d9b8;
  --text-secondary: #a89878;
  --text-dim: #5a6680;
  --text-on-paper: #3e3528;
  /* 边框 */
  --border: #2a3050;
  --border-soft: #1a2235;
}

* { box-sizing: border-box; margin: 0; padding: 0; }

html { font-size: 17px; }

body {
  font-family: "Noto Serif SC", "Source Han Serif SC", "PingFang SC", "Microsoft YaHei", serif;
  background: var(--ink-bg);
  color: var(--text-primary);
  line-height: 1.8;
  overflow: hidden; /* 星图全屏 */
}

/* === 顶部栏 + 模式切换器 === */
.topbar {
  position: fixed; top: 0; left: 0; right: 0; z-index: 20;
  display: flex; align-items: center; gap: 20px;
  padding: 12px 24px;
  background: rgba(10, 14, 26, 0.85);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid var(--border-soft);
}
.logo {
  font-size: 1.5rem; letter-spacing: 0.3em;
  color: var(--gold-main);
  font-weight: 600;
}
.mode-switcher {
  display: flex; gap: 4px;
  background: var(--ink-bg-soft);
  border-radius: 8px; padding: 4px;
}
.mode-btn {
  padding: 8px 18px; border: none; background: transparent;
  color: var(--text-dim); cursor: pointer; border-radius: 6px;
  font-size: 0.95rem; font-family: inherit;
  transition: all 0.2s;
}
.mode-btn:hover { color: var(--text-secondary); }
.mode-btn.active {
  background: var(--gold-main); color: var(--ink-bg); font-weight: 600;
}
.search-box {
  margin-left: auto;
  display: flex; align-items: center; gap: 8px;
}
.search-box input {
  background: var(--ink-bg-soft); border: 1px solid var(--border);
  color: var(--text-primary); padding: 8px 14px;
  border-radius: 20px; font-size: 0.9rem; width: 220px;
  font-family: inherit;
}
.search-box input:focus { outline: none; border-color: var(--gold-main); }

/* === 星图全屏容器 === */
#star-canvas {
  position: fixed; top: 0; left: 0;
  width: 100vw; height: 100vh;
  z-index: 1;
  cursor: grab;
}
#star-canvas:active { cursor: grabbing; }

/* === 详情面板（右侧滑出抽屉 / 长卷阅读） === */
.detail-panel {
  position: fixed; top: 0; right: 0; bottom: 0;
  width: min(780px, 100vw); z-index: 15;
  background: var(--paper);
  color: var(--text-on-paper);
  overflow-y: auto;
  transform: translateX(100%);
  transition: transform 0.3s ease;
  box-shadow: -8px 0 30px rgba(0,0,0,0.5);
}
.detail-panel.open { transform: translateX(0); }
.detail-content { max-width: 720px; margin: 0 auto; padding: 48px 56px 80px; }

.detail-close {
  position: fixed; top: 16px; right: 16px; z-index: 16;
  background: var(--text-on-paper); color: var(--paper);
  border: none; width: 40px; height: 40px; border-radius: 50%;
  font-size: 1.2rem; cursor: pointer;
}
.detail-header { text-align: center; margin-bottom: 32px; }
.detail-header svg { margin-bottom: 16px; }
.detail-header h1 { font-size: 2rem; color: var(--text-on-paper); margin-bottom: 8px; }
.detail-header .subtitle { color: #7a6a4a; font-size: 0.95rem; }

.section-title {
  color: var(--gold-deep); font-size: 1.15rem; font-weight: 600;
  margin: 32px 0 12px; padding-bottom: 6px;
  border-bottom: 1px solid #d4c8a8;
}
.original-text {
  font-size: 1.2rem; line-height: 2; color: var(--text-on-paper);
  margin: 8px 0;
}
.note-text {
  font-size: 1rem; line-height: 1.8; color: #6b5d3a;
  margin: 8px 0 16px; padding-left: 16px;
  border-left: 3px solid #d4c8a8;
}

/* 关系区 chip */
.relation-chips { display: flex; gap: 8px; flex-wrap: wrap; margin: 16px 0; }
.relation-chip {
  background: #f0e4ca; border: 1px solid #d4c8a8;
  padding: 6px 14px; border-radius: 16px;
  color: var(--text-on-paper); font-size: 0.9rem;
  cursor: pointer; transition: all 0.2s;
}
.relation-chip:hover { background: var(--gold-main); color: var(--paper); }

.yao-list { display: flex; flex-direction: column; gap: 16px; }
.yao-item { }
.yao-label { font-weight: 700; color: var(--gold-deep); margin-right: 8px; }

/* 爻折叠（保留 details 交互） */
.yao-item details summary { cursor: pointer; list-style: none; }
.yao-item details summary::-webkit-details-marker { display: none; }

/* === 加载/错误 === */
.loading-screen {
  position: fixed; inset: 0; background: var(--ink-bg);
  display: flex; align-items: center; justify-content: center;
  color: var(--gold-dim); font-size: 1.1rem; z-index: 100;
}
.error-screen {
  position: fixed; inset: 0; background: var(--ink-bg);
  display: flex; align-items: center; justify-content: center;
  color: #c66060; font-size: 1.1rem; z-index: 100; padding: 40px;
}

/* === 底部提示 === */
.hint-bar {
  position: fixed; bottom: 16px; left: 50%; transform: translateX(-50%);
  color: var(--text-dim); font-size: 0.85rem; z-index: 10;
  background: rgba(10,14,26,0.6); padding: 6px 16px; border-radius: 16px;
  backdrop-filter: blur(4px);
}

/* 滚动条 */
.detail-panel::-webkit-scrollbar { width: 8px; }
.detail-panel::-webkit-scrollbar-track { background: var(--paper-soft); }
.detail-panel::-webkit-scrollbar-thumb { background: var(--gold-dim); border-radius: 4px; }
```

- [ ] **Step 2: Commit**

```bash
cd "Y:/易经学习项目"
git add web/styles/main.css
git commit -m "style: 墨空鎏金主题（深空底 + 金色系 + 大字号 + 星图全屏布局）"
```

---

## Task 6: 改造 main.js 为模式切换器架构 + 接入星图

**Files:**
- Modify: `web/index.html`
- Modify: `web/js/main.js`
- Modify: `web/js/render.js`

- [ ] **Step 1: 改造 index.html**

全量替换 `web/index.html`:

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>易象图谱 · 六十四卦</title>
  <link rel="stylesheet" href="styles/main.css" />
</head>
<body>
  <div class="loading-screen" id="loading">星辰排列中…</div>

  <header class="topbar">
    <div class="logo">易象图谱</div>
    <nav class="mode-switcher" id="mode-switcher">
      <button class="mode-btn active" data-mode="explore">探索</button>
      <button class="mode-btn" data-mode="review">复习</button>
      <button class="mode-btn" data-mode="quiz">测验</button>
      <button class="mode-btn" data-mode="divination">占筮</button>
      <button class="mode-btn" data-mode="almanac">黄历</button>
    </nav>
    <div class="search-box">
      <input id="search" type="search" placeholder="搜索卦名…" />
    </div>
  </header>

  <canvas id="star-canvas"></canvas>

  <aside class="detail-panel" id="detail-panel">
    <button class="detail-close" id="detail-close">✕</button>
    <div class="detail-content" id="detail-content"></div>
  </aside>

  <div class="hint-bar" id="hint">悬停星辰看见它的变化 · 点击进入经文</div>

  <script type="module" src="js/main.js"></script>
</body>
</html>
```

- [ ] **Step 2: 改造 render.js 的详情渲染为长卷阅读式**

在 `web/js/render.js` 中，将 `renderHexagramDetail` 替换为长卷版本（保留 `renderHexagramList` 和 `renderTrigrams` 不变，第 1 期列表视图暂不用于主流程，但保留以防需要）。

替换 `renderHexagramDetail` 函数为：

```javascript
// 长卷阅读式详情：渲染到指定挂载点。
export function renderHexagramDetail(hex, mountEl, onPickRelation) {
  const lines = [...hex.lines].reverse() // 自上而下展示
    .map((y) => {
      const label = yaoLabel(y.position, y.isYang);
      const textHtml = y.text
        ? `<div class="original-text">${esc(y.text)}</div>`
        : `<div class="original-text" style="color:#999">（经文待补）</div>`;
      const xiangHtml = y.xiang ? `<div class="note-text">象曰：${esc(y.xiang)}</div>` : '';
      const noteHtml = y.note ? `<div class="note-text">${esc(y.note)}</div>` : '';
      return `<div class="yao-item">
        <span class="yao-label">${esc(label)}</span>
        ${textHtml}${xiangHtml}${noteHtml}
      </div>`;
    }).join('');

  const section = (title, body) =>
    body ? `<h3 class="section-title">${esc(title)}</h3>${body}` : '';

  // 关系区：错综互变的 chip
  const rels = allRelations(hex.binaryCode);
  const relChip = (label, code, name) =>
    `<span class="relation-chip" data-code="${esc(code)}">${esc(label)}→${esc(name)}</span>`;
  const relHtml = `
    <h3 class="section-title">它如何变</h3>
    <div class="relation-chips">
      ${relChip('错', rels.opposite, codeToName(rels.opposite, mountEl))}
      ${relChip('综', rels.reversed, codeToName(rels.reversed, mountEl))}
      ${relChip('互', rels.interlocking, codeToName(rels.interlocking, mountEl))}
    </div>
    <p class="note-text">变卦（动爻）：${rels.changing.map((c,i)=>`<span class="relation-chip" data-code="${esc(c)}">第${i+1}爻变→${esc(codeToName(c, mountEl))}</span>`).join(' ')}</p>
  `;

  mountEl.innerHTML = `
    <div class="detail-header">
      ${hexagramSvg(hex.binaryCode, { size: 160 })}
      <h1>${esc(hex.name)} · ${esc(hex.fullName)}</h1>
      <div class="subtitle">第 ${hex.number} 卦 · ${esc(hex.binaryCode)} · 下${esc(hex.trigramLower)} 上${esc(hex.trigramUpper)}</div>
    </div>
    ${section('卦辞', `<div class="original-text">${esc(hex.judgement)}</div>${hex.judgementNote ? `<div class="note-text">${esc(hex.judgementNote)}</div>` : ''}`)}
    ${section('彖传', `<div class="original-text">${esc(hex.tuan)}</div>${hex.tuanNote ? `<div class="note-text">${esc(hex.tuanNote)}</div>` : ''}`)}
    ${section('大象', `<div class="original-text">${esc(hex.image)}</div>${hex.imageNote ? `<div class="note-text">${esc(hex.imageNote)}</div>` : ''}`)}
    ${relHtml}
    <h3 class="section-title">六爻</h3>
    <div class="yao-list">${lines}</div>
    ${hex.useNine ? section('用九', `<div class="original-text">${esc(hex.useNine)}</div>`) : ''}
    ${hex.useSix ? section('用六', `<div class="original-text">${esc(hex.useSix)}</div>`) : ''}
    ${section('序卦传', `<div class="original-text">${esc(hex.orderRemark)}</div>`)}
  `;

  // 绑定关系 chip 点击
  if (onPickRelation) {
    mountEl.querySelectorAll('.relation-chip').forEach(chip => {
      chip.addEventListener('click', () => onPickRelation(chip.dataset.code));
    });
  }
}
```

并在 `render.js` 顶部补充 import 和辅助函数（`allRelations` 和 `codeToName`）：

```javascript
import { allRelations } from './hexagram-utils.js';

// 通过 binaryCode 查卦名（从全局 index；render.js 不持有 index，用 mountEl.dataset 传递不优雅，
// 改为接受第三个参数 hexagrams 列表）。简化：用闭包注入。
// 更佳：renderHexagramDetail 接收 hexagrams 列表用于 name 查找。
```

> 注意：上面 `codeToName` 需要卦名查找能力。调整 `renderHexagramDetail` 签名，增加 `hexagrams` 参数以便查名：

最终 `render.js` 顶部 import 区和辅助函数：

```javascript
import { hexagramSvg, trigramSvg } from './svg-painter.js';
import { yaoLabel, allRelations } from './hexagram-utils.js';

function esc(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
```

并将 `renderHexagramDetail` 签名改为 `renderHexagramDetail(hex, mountEl, hexagrams, onPickRelation)`，内部 `codeToName(code)` 实现：

```javascript
function codeToName(code, hexagrams) {
  const h = hexagrams.find(h => h.binaryCode === code);
  return h ? h.name : '?';
}
```

（更新前面 relHtml 中所有 `codeToName(x, mountEl)` 调用为 `codeToName(x, hexagrams)`）

- [ ] **Step 3: 改造 main.js 为模式切换器 + 星图接入**

全量替换 `web/js/main.js`:

```javascript
// 易象图谱入口：模式切换器 + 星图 + 详情抽屉。
import { loadAllData, buildHexagramIndex, searchHexagrams } from './data-loader.js';
import { buildRelationGraph } from './star-relations.js';
import { StarMap } from './star-map.js';
import { renderHexagramDetail } from './render.js';

const state = { hexagrams: [], trigrams: [], index: null, starMap: null, currentDetail: null };

const loadingEl = document.getElementById('loading');
const canvas = document.getElementById('star-canvas');
const panel = document.getElementById('detail-panel');
const panelContent = document.getElementById('detail-content');
const searchInput = document.getElementById('search');

// 打开详情抽屉
function openDetail(code) {
  const hex = state.index.byCode.get(code);
  if (!hex) return;
  renderHexagramDetail(hex, panelContent, state.hexagrams, (relCode) => {
    openDetail(relCode); // 关系 chip 点击 → 切换详情
  });
  panel.classList.add('open');
  state.currentDetail = code;
  state.starMap && state.starMap.focusStar(code);
}

function closeDetail() {
  panel.classList.remove('open');
  state.currentDetail = null;
}

// 模式切换
function setMode(mode) {
  document.querySelectorAll('.mode-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.mode === mode);
  });
  state.starMap && state.starMap.setMode(mode);
  // 第 1 期仅 explore 完整工作；其余模式显示"第 2/3 期实现"提示
  if (mode !== 'explore') {
    panelContent.innerHTML = `<div style="padding:60px;text-align:center;color:#7a6a4a">
      <h2 style="color:#a08850;margin-bottom:12px">${({review:'复习',quiz:'测验',divination:'占筮',almanac:'黄历'})[mode]}模式</h2>
      <p>此模式将在第 ${mode==='review'||mode==='quiz'?2:3} 期实现。</p>
      <p style="margin-top:8px">当前请使用「探索」模式漫游星图。</p>
    </div>`;
    panel.classList.add('open');
  } else {
    closeDetail();
  }
}

async function init() {
  try {
    const data = await loadAllData();
    state.hexagrams = data.hexagrams;
    state.trigrams = data.trigrams;
    state.index = buildHexagramIndex(data.hexagrams);

    // 构建关系图并初始化星图
    const graph = buildRelationGraph(data.hexagrams);
    state.starMap = new StarMap(canvas, graph, {
      onPick: (code) => openDetail(code),
      onHover: (code) => { /* 可扩展：显示 hover tooltip */ },
    });

    // 事件绑定
    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', () => setMode(btn.dataset.mode));
    });
    document.getElementById('detail-close').addEventListener('click', closeDetail);
    searchInput.addEventListener('input', (e) => {
      const kw = e.target.value.trim();
      if (!kw) return;
      const results = searchHexagrams(state.hexagrams, kw);
      if (results.length > 0) {
        state.starMap.focusStar(results[0].binaryCode);
      }
    });
    window.addEventListener('resize', () => state.starMap && state.starMap.resize());

    // 隐藏加载屏
    loadingEl.style.display = 'none';
  } catch (e) {
    loadingEl.innerHTML = `⚠ 数据加载失败：${e.message}`;
    loadingEl.classList.remove('loading-screen');
    loadingEl.classList.add('error-screen');
    console.error(e);
  }
}

init();
```

- [ ] **Step 4: 浏览器全面验证**

```bash
cd "Y:/易经学习项目/web"
bash serve.sh
```

打开 `http://localhost:3030/`，逐项核对：
1. 加载后显示墨蓝底星图，64 颗金色星点逐渐稳定
2. 悬停某星 → 星+四变连线高亮，其余变暗，显示卦名
3. 点击星 → 右侧滑出详情抽屉（羊皮卷底），长卷阅读式展示经文
4. 详情页字号大、行距宽，经文（深色）与注解（缩进灰）视觉分层
5. 详情页"它如何变"区有错/综/互/变 chip，点击 chip 切换到对应卦
6. 顶部模式切换器：点"复习"等显示"第 X 期实现"提示；点"探索"关闭抽屉回到星图
7. 搜索框输入"泰" → 星图聚焦泰卦
8. 拖拽空白平移、滚轮缩放
9. F12 控制台无报错
10. 关闭按钮 ✕ 关闭详情抽屉

- [ ] **Step 5: Commit**

```bash
cd "Y:/易经学习项目"
git add web/index.html web/js/main.js web/js/render.js
git commit -m "feat(atlas): 模式切换器架构 + 星图接入 + 详情长卷阅读式 + 墨空鎏金应用"
```

---

## Task 7: 验证 data-loader 与现有数据兼容 + 注解字段优雅降级

**Files:**
- Modify: `web/js/render.js`（注解字段已优雅降级，确认无 `*Note` 字段时不报错）

- [ ] **Step 1: 确认现有 hexagrams.json 无 *Note 字段时的降级**

现有数据无 `judgementNote`/`tuanNote`/`imageNote`/`lines[].note` 字段。render.js 中已用 `hex.judgementNote ? ... : ''` 处理，应优雅降级（不显示注解区，不报错）。

验证：

```bash
cd "Y:/易经学习项目/web"
node --input-type=module -e "
import { readFileSync } from 'fs';
const h = JSON.parse(readFileSync('data/hexagrams.json','utf8'));
const sample = h.find(x=>x.name==='泰');
console.log('has judgementNote:', 'judgementNote' in sample);
console.log('has lines[0].note:', sample.lines[0] && 'note' in sample.lines[0]);
console.log('详情页会优雅降级: 不显示注解区');
"
```

Expected: 两个字段均为 false，确认降级生效。

- [ ] `Step 2: Commit（如无需改代码则跳过）`

仅当 Task 7 发现需要修改时才提交。否则标注"无需改动，降级已生效"。

---

## 验收标准（第 1 期）

- [ ] `web/` 可通过 `bash serve.sh` 启动，浏览器打开 `http://localhost:3030/` 无报错
- [ ] 首屏即力导向星图（64 金色星点，墨蓝底，自转）
- [ ] 悬停星 → 该星 + 错综互变四条关系连线高亮
- [ ] 点击星 → 右侧详情抽屉滑出，长卷阅读式展示完整经文
- [ ] 详情页：大字号、桌面适配、经文/注解视觉分层
- [ ] 详情页"它如何变"区 chip 可点击跳转关系卦
- [ ] 搜索框可定位卦
- [ ] 拖拽平移、滚轮缩放正常
- [ ] 模式切换器工作（探索模式完整，其余显示期数提示）
- [ ] 墨空鎏金配色统一（深空底 + 金色系）
- [ ] `hexagram-utils.test.mjs` 和 `star-relations.test.mjs` 测试通过
- [ ] Git 历史清晰，每 Task 一次 commit

---

## 实施备注

- **d3-force 引入**：本地 vendor（`web/lib/d3-force.js`），不依赖 CDN 或 `npm install`，保持部署简单（GitHub Pages 直接可用）。若 esm.sh 获取的文件有问题，可手动从 d3-force 源码合并关键文件（forceSimulation/forceLink/forceManyBody/forceCenter）。
- **力导向布局调参**：`forceManyBody().strength(-120)` 和 `forceLink().distance()` 的参数可能需要 2-3 轮调整才能让布局美观稳定。若星点挤成一团，增大 charge 的绝对值；若太分散，减小 link distance。
- **性能**：64 节点的力导向模拟性能无忧。Canvas 渲染 + requestAnimationFrame 在 60fps 下流畅。
- **注解字段（*Note）**：第 1 期数据不含注解（现有 hexagrams.json 无此字段），详情页优雅降级。后续补充注解时只需更新 JSON，无需改代码。
- **后续期数衔接**：第 2 期在 `setMode()` 中实现复习/测验状态层；第 3 期实现占筮/黄历。main.js 的模式切换器架构已为此预留。
