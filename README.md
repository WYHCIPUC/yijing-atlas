# 易经学习项目

一个纯静态网站，用于学习《易经》：查阅六十四卦、记忆复习、测验、占筮，以及内置完整农历算法的黄历功能。

## 怎么运行

网站在 `web/` 目录。需要本地 HTTP 服务器（不能直接双击 index.html，浏览器安全策略会阻止加载 JSON）。

**最简单**：进入 `web/` 目录，双击 `serve.bat`（Windows）或运行 `bash serve.sh`，然后浏览器打开 **http://localhost:3030/**

或手动：
```bash
cd web
python -m http.server 3030
```

## 目录说明

```
易经学习项目/
├── web/                    # ★ 网站主体（双击 serve.bat 即可运行）
│   ├── index.html          # 入口（7 个功能 Tab）
│   ├── serve.bat / serve.sh  # 启动脚本（固定 3030 端口）
│   ├── data/               # 6 个 JSON 数据文件
│   │   ├── hexagrams.json    # 64 卦完整经文（卦辞/彖/大象/爻辞/序卦）
│   │   ├── trigrams.json     # 八卦
│   │   ├── wings.json        # 十翼（系辞/文言/说卦/序卦/杂卦）
│   │   ├── theorems.json     # 象数理论（阴阳/五行/河洛等）
│   │   ├── almanac-terms.json  # 黄历术语解读（98 条）
│   │   └── almanac-yiji.json   # 宜忌事项映射
│   ├── js/                 # 20 个 ES 模块
│   │   ├── main.js           # 入口：路由/初始化
│   │   ├── render.js         # 查阅库渲染
│   │   ├── review-*.js       # 复习（艾宾浩斯 SM-2 算法）
│   │   ├── quiz-*.js         # 测验（易经+黄历题型）
│   │   ├── divination-*.js   # 占筮（金钱卦/大衍/梅花）
│   │   ├── study-page.js     # 学习路径
│   │   ├── almanac-page.js   # 黄历主页
│   │   └── almanac/          # 黄历算法引擎
│   │       ├── astronomy.js    # 天文算法（VSOP87 太阳黄经）
│   │       ├── solar-terms.js  # 二十四节气
│   │       ├── lunar.js        # 农历编排（定朔/闰月）
│   │       ├── ganzhi.js       # 干支体系
│   │       ├── selection.js    # 择日（建除/宿/百忌）
│   │       └── reading.js      # 解读提取
│   ├── styles/main.css     # 样式
│   └── tool/               # 数据生成脚本（开发用）
├── test/almanac/           # 黄历算法回归测试（node 跑）
│   ├── astronomy.test.mjs    # 天文算法（节气精度<15分钟）
│   ├── lunar.test.mjs        # 农历（含2023闰二月验证）
│   ├── render-smoke.test.mjs # 全页面渲染冒烟测试
│   └── load-all-data.test.mjs # 数据加载集成测试
├── docs/                   # 设计文档与实施计划
│   ├── specs/              # 设计规格
│   └── plans/              # 实施计划
└── legacy-flutter/         # 早期 Flutter APP 尝试（已废弃，项目已转 Web）
```

## 功能（7 大模块）

| Tab | 功能 |
|---|---|
| 查阅 | 64 卦完整经文 + 全文检索 |
| 八卦 | 先天八卦符号 + 属性表 |
| 学习 | 十翼 / 象数理论 / L1-L4 学习路径 |
| 黄历 | 完整农历算法 + 择日 + 全面解读（节气精度<15分钟） |
| 复习 | 艾宾浩斯卡片（易经+黄历，SM-2 间隔算法） |
| 测验 | 多题型（易经+黄历） |
| 占筮 | 金钱卦/大衍筮法/梅花易数 + 变爻解读 |

## 跑测试

```bash
cd test/almanac
node astronomy.test.mjs    # 天文算法
node lunar.test.mjs        # 农历
node selection.test.mjs    # 择日
# 全页面冒烟测试需在 web/ 目录运行：
cd ../../web && node ../test/almanac/render-smoke.test.mjs
```

## 技术栈

纯静态网站，原生 HTML/CSS/JavaScript（ES Modules），零构建链、零依赖。进度用 localStorage 存储，无需服务器后端。
