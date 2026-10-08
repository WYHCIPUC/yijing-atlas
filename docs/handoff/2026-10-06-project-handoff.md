# 易象图谱项目交接文档

> 交接日期：2026-10-08（Asia/Shanghai，持续更新）
> 项目目录：`Y:\易经学习项目`
> 当前分支：`codex/ui-baseline`
> 当前提交：`bf9e39c docs: clean final handoff metadata`
> 交接状态：**代码与自动化发布门禁已通过；真实设备、屏幕阅读器和内容校勘门禁仍未关闭**

这份文档给下一位 AI 使用。它描述首轮星空优化、后续审计修复、当前发布证据、仍未关闭的人工门禁，以及建议的执行顺序。接手时不要重置工作区，也不要只根据测试全绿就宣称内容已经完成。

**当前状态覆盖说明（2026-10-08）**：下方第 3、4、7、8 节保留了首轮审计时的历史证据和建议，阅读时以本文第 13—18 节、`docs/RELEASE-CHECKLIST.md` 和 `docs/releases/v1.1.1-rc.2.md` 的后续记录为准。当前工作区已清洁；A01—A10 的代码修复、生产部署、Windows 构建和自动化浏览器证据均已完成，剩余工作集中在真实 Android/iOS、屏幕阅读器、真实 200% 缩放及六十四卦内容双人校勘。

## 1. 先看什么

按下面顺序阅读：

1. `AGENTS.md`：项目协作、代码风格、测试与发布规则。
2. 本文：当前状态和接手步骤。
3. `docs/UI-DESIGN-BASELINE.md`：唯一的 UI/UX 决策基线。
4. `docs/plans/2026-09-30-project-audit.md`：全项目审计、复现证据和 Block 判定。
5. `docs/plans/2026-09-30-starfield-reference-design.md`：最近一轮星空参考、实现边界和截图。
6. `CONTRIBUTING.md`、`docs/RELEASE-CHECKLIST.md`：提交与发布门禁。

如果复制项目时只复制了文件、没有复制 Git 元数据，也要保留本文和上述文档；它们是继续工作的事实依据。当前提交已包含首轮星空和审计修复，复制时仍需保留文档、报告和截图目录。

## 2. 项目是什么

易象图谱是一个无后端、无账号、原生 HTML/CSS/ES Modules 的《易经》学习网站。核心体验是：先在六十四卦关系星图中观察，再进入原典和项目导读，最后用小试、复习、复讲和占筮学习挑战形成记忆闭环。

主要入口：

- 探索：易象银河、错/综/互/变关系、搜索、详情面板、演变实验室、卦序转盘。
- 学习：今日修习、五阶学程、典籍书库、修习谱。
- 复习：间隔复习卡和错题回练。
- 测验：关系辨识、卦象和黄历术语练习。
- 黄历：`Asia/Shanghai` 历日、节气、干支、宜忌及术语学习。
- 占筮：金钱卦和简化梅花易数，仅用于传统文化学习与自我反思。

六位二进制卦码是唯一主键，表示顺序为**自下而上**，例如乾为 `111111`、坤为 `000000`。任何新算法、布局、关系和数据迁移都必须保持这个约定。

## 3. 当前 Git 和文件状态

远程仓库：`https://github.com/WYHCIPUC/yijing-atlas.git`。当前分支为 `codex/ui-baseline`，当前提交是 `bf9e39c`；工作区已清洁。接手时仍不能执行 `git reset --hard`、`git clean -fd` 或覆盖式拷贝。

本节的文件表是首轮星空优化尚未提交时的变更清单，用于解释实现来源；这些变更已经随 `e8f60f7` 及后续发布提交进入历史，不应再按未提交文件处理。

### 已修改的跟踪文件

| 文件 | 当前改动目的 |
| --- | --- |
| `docs/UI-DESIGN-BASELINE.md` | 记录近黑银河、暗尘缝、细星和银白轨道的最新设计决策 |
| `web/index.html` | 入口 CSS/JS 查询版本更新到 `v50` |
| `web/js/celestial-stage.js` | 探索模式减弱 WebGL 雾光，外轨改为更细、更慢的银白层 |
| `web/js/star-map.js` | 星空分层预渲染、银河尘带、低幅明灭、卦星光晕调整；修复视差使用错误镜头字段 |
| `web/styles/main.css` | 降低 Canvas 饱和度和 WebGL 层不透明度，避免背景盖住卦星 |
| `web/sw.js` | 缓存名与入口更新到 `v50`，增加星空气氛及两个首屏依赖的预缓存 |
| `web/test/pwa-assets.test.mjs` | 从 `index.html` 读取入口版本，防止测试继续硬编码旧版本 |
| `web/test/star-map-performance.test.mjs` | 增加背景绘制坐标有效性和减少动态效果回归测试 |

### 首轮新增、复制时不能漏掉的文件

| 文件 | 用途 |
| --- | --- |
| `docs/plans/2026-09-30-project-audit.md` | 全项目审计与 Block 清单 |
| `docs/plans/2026-09-30-starfield-reference-design.md` | 星空参考和实现说明 |
| `docs/screenshots/2026-09-30-starfield.jpg` | 默认视口的实际星空截图 |
| `web/js/star-atmosphere.js` | 确定性银河纹理和星空随机函数 |
| `web/test/star-atmosphere.test.mjs` | 银河纹理预算、明暗分布、非法尺寸测试 |
| `docs/handoff/2026-10-06-project-handoff.md` | 本交接文档 |

`node_modules/`、`coverage/`、`dist/` 和宣传视频输出目录由 `.gitignore` 忽略。若复制时不带 `node_modules`，接手后在根目录运行 `npm ci` 即可恢复根项目依赖；不要把 `node_modules` 当作源代码提交。

## 4. 本地启动和验证

项目没有 Web 构建步骤，要求 Node.js 22 或更高版本。必须通过 HTTP 访问，不能用 `file://` 打开 `web/index.html`。

```powershell
cd Y:\易经学习项目
npm ci                         # 依赖不存在时执行
npm start                      # http://127.0.0.1:3030/
```

也可以双击 `web/serve.bat`，但它使用 Python；自动化和开发优先使用 `npm start`。若 3030 已被占用，可临时使用：

```powershell
$env:PORT = 3031
npm start
```

常用质量命令：

```powershell
npm test                       # 质量检查、单元测试和冒烟测试
npm run check                  # 语法、格式、JSON 和发布静态检查
npm run test:coverage          # 核心模块覆盖率门槛
npm run test:e2e               # Chromium 多视口主流程
npm run validate               # 发布前完整门禁，优先运行这个
git diff --check               # 最终 diff 检查
```

2026-10-06 首轮交接的验证记录：`npm run validate` 退出码 0，181 项测试通过、0 失败；随后 `npm run test:e2e` 的 Chromium 四视口主流程通过。当前候选版本的最新验证见本文第 13—17 节：`npm run validate` 通过 188 项测试，行覆盖率 99.61%、分支 90.20%、函数 97.78%；Windows 构建与测试、生产 Lighthouse 和生产浏览器烟测也已通过。这不等于真实 Android/iOS、屏幕阅读器、真实 200% 缩放和内容校勘已经验收。

## 5. 代码结构和数据流

```text
web/index.html                 页面骨架、CSP、Canvas、入口模块
web/styles/main.css            全局样式和页面级状态覆盖
web/data/                      hexagrams.json、trigrams.json 等运行时数据
web/js/main.js                 启动、数据加载、模式切换、搜索、详情和全局事件
web/js/data-loader.js          JSON 加载、完整性校验和搜索索引
web/js/hexagram-utils.js       卦码、错综互变和爻位纯逻辑
web/js/star-map.js             Canvas 星图、镜头、节点、关系和无障碍列表
web/js/star-atmosphere.js      程序生成银河纹理，不承载卦象语义
web/js/star-layouts.js         易象银河及四种经典布局
web/js/star-relations.js       关系图和关系 occurrence
web/js/celestial-stage.js      Three.js 背景外轨和选择反馈
web/js/modes/                  黄历、学习、复习、测验、占筮模式
web/js/almanac/                历法计算模块
web/test/                      Web 模块和 UI 合同测试
test/almanac/                  历法、数据集成和渲染回归测试
web/sw.js                      PWA Service Worker 与缓存策略
scripts/                       质量检查、浏览器冒烟、Windows 构建脚本
legacy-flutter/                已归档 Flutter 原型，除非明确指定，不要修改
```

启动数据流是：`main.js` → `data-loader.js` → JSON 完整性校验 → `buildRelationGraph` → `StarMap` 与 `CelestialStage`。模式页面通过动态 `import()` 懒加载，学习、复习、测验、黄历和占筮不要在星图模块中复制业务逻辑。

本地用户数据主要保存在浏览器 `localStorage`，包括进度、复习卡、错题、成就和占筮记录；导入备份必须先完整校验，不能用坏数据覆盖已有数据。

## 6. 最近一轮星空优化已经做了什么

用户要求参考两段小红书视频的星空感觉：

- [把星表和银河写进了一个网页vibecoding](https://www.xiaohongshu.com/explore/6abaa596000000001a0319d1?xsec_source=app_share&xsec_token=CBakzIa-Ih-w4HynG2dgnPPOx21j55NyzlSXzuyRW3570=)：近黑天空、斜向银河、暗尘缝、细星和纵深。
- [天秩：大六壬](https://www.xiaohongshu.com/explore/6ab79a4f0000000014032b36?xsec_source=app_share&xsec_token=CBgzomJwF-__K0bDyV9hFJQ_68_Z6e6luqS2C-Xv6MoG0=)：深黑留白、细银白星盘线条、稀疏亮点和局部焦点。

实际实现边界如下：

1. `star-atmosphere.js` 使用确定性多尺度噪声生成斜向银河、暗尘缝和冷灰蓝/微暖核心，最大纹理尺寸 960×540，初始化或 resize 时生成，绘制帧只复用 Canvas 图层。
2. `star-map.js` 将远景细星、银河纹理、银河尘点分层预渲染；普通卦星收小光晕，关系星和当前星仍有明确层级；卦位置、六爻卫星、关系算法、点击范围没有改写。
3. `celestial-stage.js` 降低探索模式 WebGL 雾光、星尘和轨道线，避免其盖住 Canvas 银河。
4. 修复过一次实际显示缺陷：`_render()` 错把 `this.yaw`/`this.pitch` 读成 `this.view.yaw`/`this.view.pitch`，产生 NaN 绘制坐标，浏览器不会抛错但银河完全不显示。现在已改正，并有回归测试。
5. 没有加入海面、视频截图、外部未核验仓库代码或“大六壬”业务逻辑。银河是无字装饰氛围，不代表真实天文坐标，也不改变卦象数据。

实际截图：`docs/screenshots/2026-09-30-starfield.jpg`。浏览器最终检查过银河显示、搜索乾卦、详情开关、125% 缩放、先天八卦切换、返回易象银河和学习工作台；最终控制台未发现错误或警告。

## 7. 当前未关闭的问题

全项目审计结论仍是 **Block**。优先级和复现证据以 `docs/plans/2026-09-30-project-audit.md` 为准，下面是接手时必须看到的摘要。

### HIGH

| 编号 | 位置 | 现状 | 完成标准 |
| --- | --- | --- | --- |
| A01 历法日界 | `web/js/almanac/lunar.js`、`web/js/almanac-page.js` | 同一公历日按午夜/正午入口可能得到不同农历日；`2026-02-17` 已复现为错误的十二月三十，月长也可能错 | 以北京时间民用日期统一输入、朔日和日序；补 00:00/12:00/23:00、选择器和默认入口一致性测试 |
| A02 闰月编排 | `web/js/almanac/lunar.js` | `2033-12-22` 被算成普通十一月，官方对照为闰十一月初一 | 按冬至月序和置闰规则重排，加入 2033/2034 边界样例 |
| A03 备份覆盖 | `web/js/user-data.js` | 顶层合法但卡片内部损坏的备份可覆盖已有有效复习卡 | 所有键和记录校验成功后再原子提交；失败保留旧数据并指出字段 |
| A04 离线缓存 | `web/index.html`、`web/js/main.js`、`web/sw.js` | 入口和缓存已统一到 v50，星空模块及两个首屏依赖已加入预缓存；但 `main.js` 仍有多个懒加载 `?v=48`，且未完成全新安装后真实断网验收 | 统一懒加载版本策略或移除无意义旧查询号；模拟“首次访问→SW 安装→断网重开”并实测核心功能 |
| A05 欢迎层焦点 | `web/index.html`、`web/js/main.js` | 欢迎层是普通 div，背景未完全 inert/focus trap；曾复现 Tab 进入遮罩后的导航 | 使用原生 dialog 或等价焦点范围；打开聚焦首入口，关闭恢复触发控件；补键盘和 AX 测试 |
| A06 成就链路 | `web/js/modes/`、`web/js/achievement-engine.js` | 目前主要只有课程完成/评估事件；复习、错题回练、深读、关系研读、解卦事件没有完整接入 | 每个业务成功动作产生稳定幂等事件和 metadata；补 UI 到成就证据的集成测试 |
| A07 非法起卦输入 | `web/js/modes/divination-mode.js`、`web/js/meihua-engine.js` | `min=1` 不能阻止脚本按钮；负数输入可能导致 `undefined` 线路异常且界面无提示 | UI 校验正整数，纯引擎拒绝非法/非安全整数和不安全求和，显示可恢复错误 |

### MEDIUM

| 编号 | 位置 | 现状 | 完成标准 |
| --- | --- | --- | --- |
| A08 存储降级 | `web/js/storage.js`、`web/js/achievement-storage.js` | `localStorage` getter 被 SecurityError 拒绝时，异常发生在保护范围外 | 获取存储对象也纳入保护，读写返回可感知 fallback/失败状态，补测试 |
| A09 成就备份 | `web/js/user-data.js`、`web/js/achievement-storage.js` | 通用备份白名单未含 `yijing.achievements.v1`，界面没有完整成就往返导入导出 | 纳入版本化备份，测试迁移、导出、导入和成就时间/证据恢复 |
| A10 评阅配置 | `web/js/learning-review.js`、`web/index.html` | 配置允许任意 HTTPS/其他 localhost，CSP `connect-src 'self'` 又会阻断 | 统一同源代理或可信白名单，匹配校验、文案、CSP 和请求测试 |

另外还有低于上述事项的整理工作：`main.css` 仍有大量历史级联覆盖；首屏 Three.js 资产较大但没有 Lighthouse/GPU/FPS 证据；README 和 `web/README.md` 的测试数量、覆盖率和旧版功能描述已过时；完整屏幕阅读器、320px/200% 缩放、Safari/Firefox、移动真机、Windows 新包、真实离线和 Lighthouse 尚未验收。

## 8. 推荐接手顺序

不要先继续做装饰性视觉。推荐一次只处理一个根因，并先写会失败的测试：

1. **历法 A01/A02**：先补日期时刻、选择器、月长和 2033/2034 闰月失败样例，再修 `lunar.js` 的民用日期与月序算法。
2. **数据保护 A03/A08/A09**：先覆盖损坏备份、存储 getter 异常和成就备份往返，确保旧数据不会被清空，再改校验与导入提交。
3. **输入 A07**：先为负数、零、小数、超安全整数和非法和数写引擎测试，再接入表单错误状态和恢复焦点。
4. **无障碍 A05**：建立欢迎层打开/关闭的焦点轨迹测试，隔离背景，验证 Escape、Tab、读屏树和关闭后焦点。
5. **成就 A06**：列出每枚成就的真实触发事件和 metadata，保证事件幂等，再补复习、测验、深读、关系和解卦集成。
6. **离线 A04**：清理 `?v=48` 懒加载查询号，更新缓存策略，做真实浏览器首次安装断网流程；不要只改测试期望值。
7. **视觉剩余项**：排查乾卦聚焦时的关键词标签重叠，优先修 `layoutStarNameLabels` 的碰撞/可见性规则；不要通过继续压暗背景掩盖文本问题。
8. **发布前整理**：更新 README 数字和描述，清理 CSS 失效覆盖；最后运行完整 `npm run validate`、`npm run test:e2e` 和 `git diff --check`，再按发布清单处理未验证项。

每一步完成后都要记录：修改文件、失败测试、修复原因、实际命令和剩余风险。不要把“测试通过”写成“全项目已经可交付”。

## 9. 代码和设计约束

- 保持原生 HTML/CSS/ES Modules 和无构建静态站点，未经确认不要引入框架、构建系统或新依赖。
- JavaScript 两空格、单引号、分号；纯计算放逻辑模块，DOM 操作放页面/渲染模块。
- 关系层每次只激活一种关系；颜色必须配合线型或标记，不能只靠颜色传达。
- 卦象文字、方位、刻度和经文必须来自真实数据或 Canvas/SVG 绘制；背景图片/程序纹理不得写入伪文字。
- 星图背景只是装饰层；不能让银河纹理承担卦象语义、关系计算或坐标事实。
- 普通星、关系星、当前星维持三级亮度；当前星只保留一圈主光，避免发光面积压住经文和标签。
- 主要验收视口为 1280×720、1440×1024；仍需补全 320px、200% 缩放和真实系统 `prefers-reduced-motion` 验收。
- 页面隐藏或进入学习/复习等工作区时暂停或降帧；任何新增动画都要提供减少动态效果路径。
- 不修改 `legacy-flutter/`，除非用户明确要求；根目录 PDF 是参考资料，不是运行时资源。
- 涉及传统文本、历法、数据集时，在 `docs/CONTENT-SOURCES.md` 中记录来源、改写范围和校对方式。
- 真实用户数据只允许在用户明确操作的本地存储路径处理；测试使用内存或隔离存储，不触碰用户现有记录。

## 10. 给下一位 AI 的直接指令

可以把下面这段作为新对话的第一条任务上下文：

```text
你接手 Y:\易经学习项目。先阅读 AGENTS.md、docs/handoff/2026-10-06-project-handoff.md、docs/UI-DESIGN-BASELINE.md 和 docs/plans/2026-09-30-project-audit.md。

当前分支 codex/ui-baseline，基线提交 341a5fe；工作区有未提交的星空优化和交接资料，绝对不要 reset/clean 或覆盖现有改动。先执行 git status --short 和 npm run validate，确认环境后再动代码。

项目是 Node 22 的原生静态站点，运行 npm start 后访问 http://127.0.0.1:3030/，不能用 file://。六位卦码按自下而上表示，不能改变。

当前视觉星空已经完成第一轮：程序生成银河、暗尘缝、细星和银白轨道；不要重新下载视频素材或加入海面/大六壬业务逻辑。最近可见的剩余视觉问题是乾卦聚焦时关键词标签可能重叠。

真正优先级是审计中的 A01/A02 历法、A03 备份覆盖、A05 焦点隔离、A06 成就事件、A07 非法输入；A04 离线缓存还要清理 main.js 的 ?v=48 懒加载版本并做真实断网验收。每个修复先补失败测试，再运行针对测试、npm run validate 和必要的 npm run test:e2e。完成后更新本文或审计记录，写明实际验证和剩余风险。
```

## 11. 交接完成检查

- [ ] 已复制整个 `Y:\易经学习项目`，并确认 `docs/handoff/`、`docs/plans/`、`docs/screenshots/` 和 `web/js/star-atmosphere.js` 未漏掉。
- [ ] 接手 AI 已阅读 `AGENTS.md`、本文、UI 基线和审计报告。
- [ ] 接手 AI 已确认 `git status --short`，没有误删或覆盖当前未提交改动。
- [ ] Node.js 版本至少 22；依赖缺失时已执行 `npm ci`。
- [ ] 已通过 HTTP 启动站点，并确认入口和 JSON 可以加载。
- [ ] 已运行 `npm run validate`，记录真实退出码和测试数量。
- [ ] 继续修复时已先写失败测试，没有只凭截图或主观判断改代码。
- [ ] 发布前已重新检查懒加载缓存版本、Service Worker、焦点范围、离线恢复和发布清单。

## 12. 相关文档索引

- [项目审计与优化清单](../plans/2026-09-30-project-audit.md)
- [星空参考与实现](../plans/2026-09-30-starfield-reference-design.md)
- [UI/UX 设计决策基线](../UI-DESIGN-BASELINE.md)
- [发布检查清单](../RELEASE-CHECKLIST.md)
- [内容来源说明](../CONTENT-SOURCES.md)
- [贡献指南](../../CONTRIBUTING.md)
- [实际星空截图](../screenshots/2026-09-30-starfield.jpg)

## 13. 2026-10-06—07 继续开发记录

本次继续开发已完成以下审计项的代码修复和回归覆盖：

- A01/A02：按北京民用日期修正农历日界和 2033 闰十一月判断，并补充 2026、2033、2034 边界测试。
- A03/A08/A09：备份导入增加各数据结构校验，覆盖成就状态；存储访问器异常时安全降级；补充覆盖已有备份不被破坏的测试。
- A04：懒加载版本统一到 `?v=50`，入口资源、Service Worker 版本和预缓存清单增加一致性校验；Chromium 烟测已完成 Service Worker 接管后的真实断网重开。
- A05：每日卦象弹层补充对话框语义、背景 inert、Tab 焦点循环和进入/退出后的焦点恢复；烟测补充搜索、详情关闭、学习页签、测验提交和浏览器 AX 树语义路径。
- A06：接入卦象阅读、关系查看、研读自评、复习、错题恢复和学习评估等成就事件；端到端烟测覆盖研读自评、关系查看和非法梅花输入恢复。
- A07：梅花数字输入增加正安全整数校验、错误提示和恢复路径。
- A10：学习评阅地址限制为同源相对路径，与现有 CSP 保持一致。
- Windows 发布：`npm run build:windows` 与 `npm run test:windows` 通过，生成的 `dist/` 已被 Git 忽略。
- 远程状态：公开 Pages 当前仍是旧的 `yijing-atlas-v20`，最近 Quality/Pages 成功运行分别对应旧基线 `341a5fe` 与 `main@ff76c3d`，不能代表当前未提交工作区。

实际验证结果：`npm run check` 通过；`npm test` 通过（51 个测试脚本）；`npm run test:e2e` 通过（4 个视口，并覆盖 320px、640 CSS 像素等效缩放、键盘路径和真实断网重开）；`npm run validate` 通过（188 个测试，行覆盖率 99.61%，分支覆盖率 90.20%，函数覆盖率 97.78%）。

仍需在发布前补做或保留为风险的项目：真实浏览器 200% 缩放、完整屏幕阅读器流程、Safari/Firefox/移动端兼容性、生产 URL 上的 Lighthouse 与性能长时运行，以及六十四卦爻辞和六亲世应等内容校勘门禁。内容发布门禁继续保持关闭。

## 14. 2026-10-07 性能验收继续记录

- 首屏天象舞台从入口静态导入改为用户第一次聚焦或操作星图时按需加载；加载完成后同步当前星图视图，模式切换仍会主动加载。
- GSAP 和 Lenis 的入口脚本改为 `defer`，降低首屏脚本串行等待；布局契约补充了这两个约束。
- `npm run check`、`node --test web/test/layout-contract.test.mjs` 和 `npm run test:e2e` 均通过；完整 `npm run validate` 仍为 188 项通过，覆盖率为行 99.61%、分支 90.20%、函数 97.78%。
- 本地 Lighthouse 默认移动端三次中位数为 Performance 89、FCP 1883ms、LCP 3470ms、TBT 100ms；Accessibility、Best Practices、SEO 均为 100。最终报告摘要见 [lighthouse-local-motionoff-mobile-summary.json](../qa/2026-10-07/lighthouse-local-motionoff-mobile-summary.json)。Performance 分数达标，但 LCP 仍超过计划的 2500ms，且不能替代当前代码部署后的生产 URL 测量。

## 15. 2026-10-07 首屏性能复测

- `scripts/serve.mjs` 对 HTML、CSS、JS、JSON、SVG 和 webmanifest 按请求协商 gzip；`web/index.html` 预加载欢迎层背景图，欢迎层首次出现时取消内容入场动画，避免移动端节流下首屏标题等待动效。
- `npm run check`、每日卦布局定向测试和 `npm run test:e2e` 均通过；浏览器烟测继续覆盖四种视口、320px、640 CSS 像素等效缩放、键盘、AX 树、减少动态效果和断网流程。
- 使用 Edge 运行 Lighthouse 13.5.0 连续三次：Performance 89/89/90，LCP 3463/3470/3471ms。预加载没有把 LCP 降到 2500ms 内，因此性能门禁继续保持未验收；未继续做收益不明确的盲目改动。
- 本轮没有用户需要手动执行的步骤；下一步是取得当前工作区的远程 Quality、Pages 部署和生产 URL 测量证据。

## 16. 2026-10-07 远程质量门禁

- 提交 `e8f60f7` 已推送到 `codex/ui-baseline`；该提交对应的两个公开 Quality 运行均成功。
- Pages 工作流只监听 `main`，因此当前分支不会自动更新生产站点；公开 Pages 仍是旧的 `yijing-atlas-v20`。未直接覆盖 `main`，等待发布流程的合并入口。

## 17. 2026-10-07 生产部署与性能验收

- PR #4 已合并，`main` 当前为 `bf9e39c`；发布代码单元 `639c4ad` 的 Quality 与 Pages 部署均成功，候选版本 `v1.1.1-rc.2` 已正确标记为预发布并发布 Windows 产物。
- 生产入口无缓存核验返回 `main.js?v=50`、`main.css?v=50`，Service Worker 为 `yijing-atlas-v50`。
- 生产 URL 连续三次 Lighthouse 中位数为 Performance 95、Accessibility 100、Best Practices 100、SEO 100、FCP 1685ms、LCP 2285ms、TBT 22ms、CLS 0.014，性能发布门槛已通过。报告摘要见 [lighthouse-production-mobile-summary.json](../qa/2026-10-07/lighthouse-production-mobile-summary.json)。
- 生产 Edge 浏览器烟测覆盖六个模式、键盘、AX 树、焦点恢复、390/768/1440 视口、黄历时区、占筮和断网重开，结果为 `met`；报告见 [production-browser-smoke.json](../qa/2026-10-07/production-browser-smoke.json)。
- 真实移动设备、屏幕阅读器和内容双人校勘仍属于人工/内容门禁，不能由本次自动化部署验收替代。

## 18. 2026-10-08 当前复核

- 工作区与 `origin/main` 均为 `bf9e39c`，没有未提交改动；`npm run validate` 重新通过，188 项测试全绿，行覆盖率 99.61%、分支覆盖率 90.20%、函数覆盖率 97.78%。
- `node scripts/validate-commentaries.mjs` 通过目录结构校验，但发布门禁仍关闭：六家注疏 0/3840 条记录完成双人校勘，`manifest.releaseReady` 继续为 `false`。
- 本阶段验收结论不变：代码和自动化发布门禁达标，项目整体仍不能宣称正式交付；待补证据仍是 Android Chrome、iOS Safari、屏幕阅读器、真实系统 200% 缩放，以及六家注疏来源定位和双人校勘。
