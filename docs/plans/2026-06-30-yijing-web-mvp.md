# 易经学习网站 · 查阅库（Web MVP）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用纯静态网站（原生 HTML + CSS + JavaScript）实现"查阅 64 卦 + 八卦基础 + 全文检索"，双击 `index.html` 即可在浏览器使用，零构建链。

**Architecture:** 三层分离——数据层（JSON 文件，直接复用已有 `hexagrams.json`/`trigrams.json`）、逻辑层（纯 JS 模块，负责加载/校验/检索/渲染）、视图层（HTML 结构 + CSS 样式）。单页应用，JS 动态渲染内容；hash 路由切换页面。卦以 6 位二进制串（自下而上）作主键，加载后自检 64 卦完整性。

**Tech Stack:** 原生 HTML5、CSS3、JavaScript（ES Modules）；用 SVG 绘制卦象（阳爻一长横、阴爻两短横）；无 npm、无框架、无构建。

**数据资产：** `hexagrams.json`（64 卦，9 卦含完整公版经文，55 卦结构齐全待补）、`trigrams.json`（八卦）——均已在前序工作产出并通过校验，直接复用。

---

## 文件结构总览

```
web/                          # 网站根目录（纯静态）
├── index.html                # 入口 HTML，含导航与挂载点
├── styles/
│   └── main.css              # 全部样式（古朴棕色系，契合易学气质）
├── data/
│   ├── hexagrams.json        # ← 从 assets/data/ 复用
│   └── trigrams.json         # ← 从 assets/data/ 复用
├── js/
│   ├── main.js               # 入口：初始化、路由、加载数据
│   ├── data-loader.js        # 加载 JSON + 启动自检
│   ├── hexagram-utils.js     # 纯逻辑：binaryCode 运算、爻描述生成
│   ├── render.js             # 渲染：卦列表、详情、八卦、搜索结果
│   └── svg-painter.js        # SVG 卦象绘制（六爻/八卦）
└── README.md                 # 使用说明
```

旧 Flutter 代码（`lib/`、`test/`、`pubspec.yaml` 等）归档到 `legacy-flutter/`，不删除（保留成果）。

---

## Task 1: 归档 Flutter 代码 + 创建 Web 目录结构

**Files:**
- Move: `lib/`、`test/`、`tool/`、`android/`、`ios/`(如有)、`pubspec.*`、`*.iml`、`analysis_options.yaml`、`.metadata` → `legacy-flutter/`
- Create: `web/`、`web/styles/`、`web/js/`、`web/data/`

- [ ] **Step 1: 归档旧 Flutter 代码**

```bash
cd /c/Users/1/ZCodeProject
mkdir -p legacy-flutter
# 移动 Flutter 专属产物到 legacy-flutter（保留成果，不删除）
mv lib test tool android pubspec.yaml pubspec.lock yijing_app.iml analysis_options.yaml .metadata legacy-flutter/ 2>/dev/null
ls legacy-flutter/
```

- [ ] **Step 2: 创建 Web 目录结构并复用数据**

```bash
cd /c/Users/1/ZCodeProject
mkdir -p web/styles web/js web/data
# 复用已校验的 JSON 数据
cp assets/data/hexagrams.json web/data/hexagrams.json
cp assets/data/trigrams.json web/data/trigrams.json
ls -R web/
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "refactor: 从 Flutter APP 转为纯静态网站，归档旧代码，复用 JSON 数据"
```

---

## Task 2: 数据加载与启动自检

**Files:**
- Create: `web/js/data-loader.js`

- [ ] **Step 1: 实现 data-loader.js**

Create `web/js/data-loader.js`:

```javascript
// 加载 hexagrams.json / trigrams.json，并提供启动自检。
// 自检：64 卦数量、binaryCode 唯一、卦序 1-64 连续；八卦 8 条且唯一。

const HEXAGRAM_PATH = 'data/hexagrams.json';
const TRIGRAM_PATH = 'data/trigrams.json';

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

export async function loadAllData() {
  const [hexagrams, trigrams] = await Promise.all([
    fetchJson(HEXAGRAM_PATH),
    fetchJson(TRIGRAM_PATH),
  ]);
  validateHexagrams(hexagrams);
  validateTrigrams(trigrams);
  return { hexagrams, trigrams };
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

// 全文检索：在卦名/全称/卦辞/大象/彖/序卦/爻辞中查找
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
```

- [ ] **Step 2: Commit**

```bash
git add web/js/data-loader.js
git commit -m "feat(web): 数据加载与启动自检"
```

---

## Task 3: 卦位运算工具

**Files:**
- Create: `web/js/hexagram-utils.js`

- [ ] **Step 1: 实现 hexagram-utils.js**

Create `web/js/hexagram-utils.js`:

```javascript
// 卦象纯逻辑工具。所有运算基于 6 位二进制串（自下而上）。

function validate(code) {
  if (!/^[01]{6}$/.test(code)) {
    throw new Error(`需要 6 位 0/1 串，得到: ${code}`);
  }
}

// 错卦（旁通卦）：每位取反。乾 111111 → 坤 000000。
export function oppositeCode(code) {
  validate(code);
  return code.split('').map((b) => (b === '1' ? '0' : '1')).join('');
}

// 综卦（反卦）：整体上下翻转。泰 111000 → 否 000111。
export function reversedCode(code) {
  validate(code);
  return code.split('').reverse().join('');
}

// 下卦 = 前 3 位（爻1-3）
export function lowerOf(code) {
  validate(code);
  return code.substring(0, 3);
}

// 上卦 = 后 3 位（爻4-6）
export function upperOf(code) {
  validate(code);
  return code.substring(3, 6);
}

// 由下上两卦合成
export function combine(lower, upper) {
  return `${lower}${upper}`;
}

// 爻题：阳爻用"九"，阴爻用"六"，配位置名
// positionNames[0] 占位；初/上 用"位名+阴阳"，中位用"阴阳+位名"
export function yaoLabel(position, isYang) {
  const names = ['', '初', '二', '三', '四', '五', '上'];
  const yinYang = isYang ? '九' : '六';
  if (position === 1 || position === 6) {
    return `${names[position]}${yinYang}`;
  }
  return `${yinYang}${names[position]}`;
}

// 当位：阳爻居奇位(1,3,5)、阴爻居偶位(2,4,6)
export function isCorrectPosition(position, isYang) {
  return isYang ? position % 2 === 1 : position % 2 === 0;
}
```

- [ ] **Step 2: Commit**

```bash
git add web/js/hexagram-utils.js
git commit -m "feat(web): 卦位运算工具（错综卦、爻题、当位）"
```

---

## Task 4: SVG 卦象绘制

**Files:**
- Create: `web/js/svg-painter.js`

- [ ] **Step 1: 实现 svg-painter.js**

用 SVG 而非 Canvas——SVG 可缩放、可被 CSS 样式化、矢量清晰。

Create `web/js/svg-painter.js`:

```javascript
// SVG 卦象绘制：六爻图、八卦符号。
// 阳爻：一长横；阴爻：两短横（中间断开）。

// 生成六爻 SVG 字符串。size 为画布像素。
export function hexagramSvg(binaryCode, { size = 120, changingPositions = [] } = {}) {
  if (!/^[01]{6}$/.test(binaryCode)) return '';
  const lines = [];
  const lineH = size / 7;        // 6 爻 + 间隔
  const strokeW = lineH * 0.55;
  const breakW = size * 0.28;    // 阴爻断开长度
  const half = (size - breakW) / 2;

  // 自下而上：i=0 为最底（y 最大）
  for (let i = 0; i < 6; i++) {
    const y = size - (i + 1) * lineH;
    const isYang = binaryCode[i] === '1';
    const isChanging = changingPositions.includes(i + 1);
    if (isYang) {
      lines.push(`<line x1="0" y1="${y}" x2="${size}" y2="${y}" stroke-width="${strokeW}"/>`);
    } else {
      lines.push(`<line x1="0" y1="${y}" x2="${half}" y2="${y}" stroke-width="${strokeW}"/>`);
      lines.push(`<line x1="${size - half}" y1="${y}" x2="${size}" y2="${y}" stroke-width="${strokeW}"/>`);
    }
    if (isChanging) {
      lines.push(`<line x1="0" y1="${y - lineH * 0.4}" x2="${size}" y2="${y - lineH * 0.4}" stroke="red" stroke-width="2"/>`);
    }
  }
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg" class="hexagram-svg">
    <g stroke="#3e2723" stroke-linecap="round">${lines.join('')}</g>
  </svg>`;
}

// 生成八卦符号 SVG。3 位二进制。
export function trigramSvg(binaryCode, { size = 64 } = {}) {
  if (!/^[01]{3}$/.test(binaryCode)) return '';
  const lines = [];
  const lineH = size / 4;
  const strokeW = lineH * 0.6;
  const breakW = size * 0.30;
  const half = (size - breakW) / 2;
  for (let i = 0; i < 3; i++) {
    const y = size - (i + 1) * lineH;
    if (binaryCode[i] === '1') {
      lines.push(`<line x1="0" y1="${y}" x2="${size}" y2="${y}" stroke-width="${strokeW}"/>`);
    } else {
      lines.push(`<line x1="0" y1="${y}" x2="${half}" y2="${y}" stroke-width="${strokeW}"/>`);
      lines.push(`<line x1="${size - half}" y1="${y}" x2="${size}" y2="${y}" stroke-width="${strokeW}"/>`);
    }
  }
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg" class="trigram-svg">
    <g stroke="#3e2723" stroke-linecap="round">${lines.join('')}</g>
  </svg>`;
}
```

- [ ] **Step 2: Commit**

```bash
git add web/js/svg-painter.js
git commit -m "feat(web): SVG 卦象绘制组件（六爻/八卦）"
```

---

## Task 5: 渲染层 —— 卦列表、详情、八卦、搜索

**Files:**
- Create: `web/js/render.js`

- [ ] **Step 1: 实现 render.js**

Create `web/js/render.js`:

```javascript
import { hexagramSvg, trigramSvg } from './svg-painter.js';
import { yaoLabel } from './hexagram-utils.js';

// HTML 转义，防注入
function esc(s) {
  return (s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// 64 卦总览网格
export function renderHexagramList(hexagrams, mountEl, onPick) {
  const cards = hexagrams.map((h) => `
    <div class="hex-card" data-code="${esc(h.binaryCode)}">
      ${hexagramSvg(h.binaryCode, { size: 56 })}
      <div class="hex-name">${h.number}.${esc(h.name)}</div>
      <div class="hex-full">${esc(h.fullName)}</div>
    </div>
  `).join('');
  mountEl.innerHTML = `<div class="hex-grid">${cards}</div>`;
  // 绑定点击
  mountEl.querySelectorAll('.hex-card').forEach((card) => {
    card.addEventListener('click', () => onPick(card.dataset.code));
  });
}

// 卦象详情
export function renderHexagramDetail(hex, mountEl, onBack) {
  const lines = [...hex.lines].reverse() // 自上而下展示（上九→初九）
    .map((y) => {
      if (!y.text && !y.xiang) {
        return `<div class="yao yao-empty"><span class="yao-label">${esc(yaoLabel(y.position, y.isYang))}</span>（经文待补）</div>`;
      }
      return `
        <details class="yao">
          <summary><span class="yao-label">${esc(yaoLabel(y.position, y.isYang))}</span> ${esc(y.text)}</summary>
          ${y.xiang ? `<div class="yao-xiang">象曰：${esc(y.xiang)}</div>` : ''}
        </details>`;
    }).join('');

  const section = (title, body) =>
    body ? `<section class="hex-section"><h4>${esc(title)}</h4><p>${esc(body)}</p></section>` : '';

  mountEl.innerHTML = `
    <div class="detail-view">
      <div class="detail-header">
        ${hexagramSvg(hex.binaryCode, { size: 140 })}
        <h2>${hex.number}.${esc(hex.name)} · ${esc(hex.fullName)}</h2>
      </div>
      ${section('卦辞', hex.judgement)}
      ${section('彖传', hex.tuan)}
      ${section('大象', hex.image)}
      <hr/>
      <div class="yao-list">${lines}</div>
      ${section('用九', hex.useNine)}
      ${section('用六', hex.useSix)}
      <hr/>
      ${section('序卦传', hex.orderRemark)}
    </div>`;
}

// 八卦基础页
export function renderTrigrams(trigrams, mountEl) {
  const cards = trigrams.map((t) => `
    <div class="tri-card">
      ${trigramSvg(t.binaryCode, { size: 48 })}
      <div class="tri-name">${esc(t.name)}</div>
      <div class="tri-nature">${esc(t.nature)}</div>
    </div>
  `).join('');

  const rows = trigrams.map((t) => `
    <tr>
      <td>${esc(t.name)}</td>
      <td>${esc(t.nature)}</td>
      <td>${esc(t.attribute)}</td>
      <td>${esc(t.direction)}</td>
      <td>${esc(t.familyMember)}</td>
    </tr>`).join('');

  mountEl.innerHTML = `
    <h3>先天八卦</h3>
    <div class="tri-grid">${cards}</div>
    <h3>属性详表</h3>
    <table class="tri-table">
      <thead><tr><th>卦</th><th>自然</th><th>德性</th><th>方位</th><th>家人</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}
```

- [ ] **Step 2: Commit**

```bash
git add web/js/render.js
git commit -m "feat(web): 渲染层（卦列表/详情/八卦/搜索）"
```

---

## Task 6: 入口 HTML 与 CSS

**Files:**
- Create: `web/index.html`
- Create: `web/styles/main.css`

- [ ] **Step 1: 实现 index.html**

Create `web/index.html`:

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>易经 · 六十四卦查阅</title>
  <link rel="stylesheet" href="styles/main.css" />
</head>
<body>
  <header class="topbar">
    <h1 class="logo">易經</h1>
    <nav class="tabs">
      <a href="#/library" class="tab" data-route="library">查阅</a>
      <a href="#/trigrams" class="tab" data-route="trigrams">八卦</a>
    </nav>
  </header>

  <main id="app">
    <div class="loading">加载中…</div>
  </main>

  <footer class="footer">
    <small>公版《周易》原文 · 离线可用</small>
  </footer>

  <script type="module" src="js/main.js"></script>
</body>
</html>
```

- [ ] **Step 2: 实现 main.css**

Create `web/styles/main.css`:

```css
:root {
  --primary: #5d4037;
  --primary-light: #8d6e63;
  --bg: #faf6f0;
  --card-bg: #fffaf5;
  --text: #3e2723;
  --text-light: #795548;
  --border: #d7ccc8;
}

* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: "PingFang SC", "Microsoft YaHei", "Noto Serif SC", serif;
  background: var(--bg);
  color: var(--text);
  line-height: 1.7;
}

.topbar {
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 12px 24px;
  background: var(--primary);
  color: #fff;
  position: sticky;
  top: 0;
  z-index: 10;
  flex-wrap: wrap;
}
.logo { font-size: 22px; letter-spacing: 4px; }
.tabs { display: flex; gap: 8px; }
.tab {
  color: rgba(255,255,255,0.75);
  text-decoration: none;
  padding: 6px 14px;
  border-radius: 6px;
  transition: background 0.2s;
}
.tab:hover, .tab.active { background: rgba(255,255,255,0.18); color: #fff; }

/* 搜索框（仅查阅页显示） */
.search-bar {
  margin-left: auto;
}
.search-bar input {
  padding: 6px 12px;
  border-radius: 16px;
  border: 1px solid var(--border);
  font-size: 14px;
  width: 200px;
}

#app { max-width: 960px; margin: 0 auto; padding: 24px 16px 60px; }
.loading { text-align: center; color: var(--text-light); padding: 40px; }
.error { text-align: center; color: #c62828; padding: 40px; }

/* 64 卦网格 */
.hex-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
  gap: 12px;
}
.hex-card {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px 8px;
  text-align: center;
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.15s;
}
.hex-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(93,64,55,0.15);
}
.hex-name { font-weight: bold; margin-top: 6px; }
.hex-full { font-size: 11px; color: var(--text-light); }

/* 详情页 */
.detail-view { background: var(--card-bg); border: 1px solid var(--border); border-radius: 8px; padding: 24px; }
.detail-header { text-align: center; margin-bottom: 20px; }
.detail-header h2 { color: var(--primary); margin-top: 12px; }
.hex-section { margin: 12px 0; }
.hex-section h4 { color: var(--primary); margin-bottom: 4px; }
hr { border: none; border-top: 1px dashed var(--border); margin: 20px 0; }

.yao-list { display: flex; flex-direction: column; gap: 4px; }
.yao summary { cursor: pointer; padding: 6px 8px; border-radius: 4px; }
.yao summary:hover { background: rgba(93,64,55,0.05); }
.yao-label { font-weight: bold; color: var(--primary); margin-right: 8px; }
.yao-xiang { padding: 6px 8px 6px 24px; color: var(--text-light); font-size: 14px; }
.yao-empty { color: var(--text-light); padding: 6px 8px; font-size: 14px; }

.back-btn {
  display: inline-block;
  margin-bottom: 16px;
  padding: 6px 14px;
  background: var(--primary-light);
  color: #fff;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  text-decoration: none;
  font-size: 14px;
}

/* 八卦页 */
.tri-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin: 12px 0 24px;
}
.tri-card {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px;
  text-align: center;
}
.tri-name { font-weight: bold; margin-top: 6px; }
.tri-nature { font-size: 12px; color: var(--text-light); }
.tri-table { width: 100%; border-collapse: collapse; background: var(--card-bg); }
.tri-table th, .tri-table td {
  border: 1px solid var(--border);
  padding: 8px 12px;
  text-align: center;
}
.tri-table th { background: var(--primary); color: #fff; }
.tri-table tr:nth-child(even) { background: rgba(215,204,200,0.2); }

.footer { text-align: center; padding: 16px; color: var(--text-light); }

@media (max-width: 600px) {
  .search-bar { margin-left: 0; width: 100%; margin-top: 8px; }
  .search-bar input { width: 100%; }
  .tri-grid { grid-template-columns: repeat(2, 1fr); }
}
```

- [ ] **Step 3: Commit**

```bash
git add web/index.html web/styles/main.css
git commit -m "feat(web): 入口 HTML 与样式（古朴棕色系）"
```

---

## Task 7: 入口逻辑 main.js（路由 + 初始化 + 搜索）

**Files:**
- Create: `web/js/main.js`

- [ ] **Step 1: 实现 main.js**

Create `web/js/main.js`:

```javascript
import { loadAllData, buildHexagramIndex, searchHexagrams } from './data-loader.js';
import { renderHexagramList, renderHexagramDetail, renderTrigrams } from './render.js';

let state = { hexagrams: [], trigrams: [], index: null };

const appEl = document.getElementById('app');

function showError(msg) {
  appEl.innerHTML = `<div class="error">⚠ ${msg}</div>`;
}

// 路由：基于 location.hash
function route() {
  const hash = location.hash || '#/library';
  const path = hash.replace(/^#/, '');

  // 高亮当前 Tab
  document.querySelectorAll('.tab').forEach((t) => {
    t.classList.toggle('active', path.startsWith(`/${t.dataset.route}`));
  });

  if (path.startsWith('/hexagram/')) {
    const code = path.replace('/hexagram/', '');
    showDetail(code);
  } else if (path.startsWith('/trigrams')) {
    showTrigrams();
  } else {
    showLibrary();
  }
}

function showLibrary() {
  // 注入搜索框
  appEl.innerHTML = `
    <div class="search-bar"><input id="search" type="search" placeholder="搜索卦名/卦辞/爻辞…" /></div>
    <div id="list-mount"></div>`;
  const input = document.getElementById('search');
  const listMount = document.getElementById('list-mount');
  const draw = () => {
    const kw = input.value.trim();
    const list = kw ? searchHexagrams(state.hexagrams, kw) : state.hexagrams;
    renderHexagramList(list, listMount, (code) => { location.hash = `/hexagram/${code}`; });
    if (kw && list.length === 0) {
      listMount.insertAdjacentHTML('beforeend', '<p class="loading">未找到匹配的卦</p>');
    }
  };
  input.addEventListener('input', draw);
  draw();
}

function showDetail(code) {
  const hex = state.index.byCode.get(code);
  if (!hex) { showError('未找到该卦'); return; }
  renderHexagramDetail(hex, appEl);
  // 详情页头部加返回按钮
  appEl.insertAdjacentHTML('afterbegin',
    '<a class="back-btn" href="#/library">← 返回</a>');
  window.scrollTo(0, 0);
}

function showTrigrams() {
  renderTrigrams(state.trigrams, appEl);
}

async function init() {
  try {
    const data = await loadAllData();
    state.hexagrams = data.hexagrams;
    state.trigrams = data.trigrams;
    state.index = buildHexagramIndex(data.hexagrams);
    window.addEventListener('hashchange', route);
    route();
  } catch (e) {
    showError(`数据加载/校验失败：${e.message}`);
    console.error(e);
  }
}

init();
```

- [ ] **Step 2: Commit**

```bash
git add web/js/main.js
git commit -m "feat(web): 入口逻辑（路由/初始化/搜索），MVP 整体贯通"
```

---

## Task 8: 浏览器运行验证

**Files:** 无（运行验证）

纯静态站用 `file://` 直接打开时，`fetch` 会因 CORS 限制无法加载 JSON（浏览器安全策略）。需用一个本地 HTTP 服务器。

- [ ] **Step 1: 启动本地静态服务器**

```bash
cd /c/Users/1/ZCodeProject/web
# Python 自带 http.server（Windows 通常有 python）
python -m http.server 8000 2>/dev/null || py -m http.server 8000
```

如无 Python，用 Node：`npx http-server -p 8000`。

- [ ] **Step 2: 浏览器打开并验证**

打开 `http://localhost:8000/`，逐项核对：
1. 首页加载后显示 64 卦网格，每格卦象正确（阳爻一长横、阴爻两短横）
2. 点任意卦 → 详情页显示卦辞/彖/大象/各爻
3. 已填经文的卦（乾、坤、屯…前 9 卦）详情完整；其余卦显示"（经文待补）"
4. 搜索框输入"乾" → 过滤出含"乾"的卦
5. 顶部 Tab 切换到"八卦" → 显示 8 卦符号 + 属性表
6. F12 控制台无报错（自检通过）

- [ ] **Step 3: 截图存档 + 打标签**

```bash
cd /c/Users/1/ZCodeProject
git tag v0.1.0-web-mvp -m "Web MVP 完成：64 卦查阅 + 八卦基础 + 全文检索"
git log --oneline | head -15
```

- [ ] **Step 4: 撰写 README**

Create `web/README.md`:

````markdown
# 易经查阅网站

纯静态网站，浏览器打开即可查阅《周易》六十四卦与八卦。

## 本地运行

由于浏览器安全策略，直接双击 `index.html` 无法加载 JSON 数据。需用本地服务器：

```bash
cd web
python -m http.server 8000
# 然后浏览器访问 http://localhost:8000/
```

## 部署到 GitHub Pages

将 `web/` 目录内容推送到 GitHub 仓库，开启 Pages 即可，无需构建。

## 功能

- 64 卦总览（卦象可视化）
- 卦象详情（卦辞/彖/大象/爻辞/序卦）
- 全文检索（卦名/卦辞/爻辞）
- 八卦基础（符号 + 属性表）

> 当前 64 卦中 9 卦含完整公版经文，其余卦象结构齐全、经文待补。
````

- [ ] **Step 5: Commit**

```bash
git add web/README.md
git commit -m "docs: Web 版使用说明 README"
```

---

## 验收标准（Web MVP）

- [ ] 本地服务器启动后，浏览器能正常加载（无 CORS 报错）
- [ ] 64 卦全部显示，卦象绘制正确（SVG，阳/阴爻无误）
- [ ] 已填经文的卦详情完整；未填卦优雅降级（显示"经文待补"）
- [ ] 全文检索实时过滤
- [ ] 八卦基础页（符号 + 属性表）正常
- [ ] 启动自检生效（数据错误时控制台/页面报错）
- [ ] 移动端响应式（窗口缩小时布局自适应）
- [ ] Git 历史清晰

---

## 实施备注

- **数据复用**：`hexagrams.json` / `trigrams.json` 直接从 `assets/data/` 复制，无需改动。后续补全 55 卦经文时，更新该文件即可，网站无需改代码。
- **ES Modules**：JS 用 `import/export`，`<script type="module">` 加载。需 HTTP 服务器（非 file://）。
- **binaryCode 主键**贯穿：详情页 URL 用 binaryCode（如 `#/hexagram/111111`），刷新可直达。
- **无构建链**：所有 JS/CSS/HTML 直接是最终产物，无需 npm/打包。
