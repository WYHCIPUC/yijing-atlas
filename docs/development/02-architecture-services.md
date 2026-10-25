# 02 · 架构、运行服务与接口边界

初始快照：2026-10-24；学习反馈与提交协调职责更新：2026-10-25。本文描述当前工作区，而非某个已发布版本。

| 状态轴 | 当前结论 |
| --- | --- |
| 实现状态 | 原生静态网页、本地运行服务器、Windows 启动器和可选复讲评阅客户端已经存在；没有业务服务端、账号或数据库 |
| 验证状态 | 2026-10-24建档时 `check`、`validate` 通过而E2E有失败，保留历史适用范围；后续学习反馈的当前验证与交付状态见[本卡交接](evidence/2026-10-25-learning-feedback-integration.md)，不以限定回归或旧版本绿灯替代最终验收 |
| 交付状态 | 本地开发工作区，包含未提交变更；不是远程发布完成或 Windows 新包已验收 |

[返回开发建设总册](../DEVELOPMENT-MASTER.md) · [测试与证据](10-testing-evidence.md)

## 1. 阅读方式与工程边界

本篇用于决定“这项需求放在哪里实现”，并约束其他 AI 不因“后端”一词而新增未授权服务。
功能和交互细节应与总册中的对应模块规格共同使用。
数据字段、兼容和迁移以 [数据与存储专题](08-data-storage-content.md) 为准。
性能、安全及离线限制以 [运行质量专题](09-security-performance-offline.md) 为准。
发布操作以 [分发与维护专题](11-distribution-maintenance.md) 为准。

当前主应用位于 `web/`，不存在网页打包产物与源码两套目录。
本地服务器直接提供此目录；GitHub Pages 也直接上传此目录。
`legacy-flutter/` 是归档，不是当前网页的后端或移动运行层。
`promo-video/` 是独立宣传视频工程，其中 React 和 TypeScript 不属于网页技术栈。
根目录参考 PDF 属于资料，不是网页运行资产，也不应进入公开发布包。

### 1.1 已经确定的约束

- 保持原生 HTML、CSS、JavaScript ES Modules、Canvas 和现有 Three.js 架构。
- 网页无需 `npm install`、构建或 React 运行时即可通过 HTTP 启动。
- 不得把“无需安装运行”写成“没有第三方库”；网页依赖本地 vendor 文件。
- 不新增账号、数据库、云同步、管理后台或模型密钥字段。
- 新计算保持纯逻辑模块，新 DOM 行为放页面或渲染模块。
- 不能把 UI 状态迁移成学习数据，不能为了界面重排更改六位编码或历法算法。
- 新增依赖、构建系统或破坏性接口前，必须另行明确需求与兼容方案。

## 2. 运行拓扑

```text
浏览器
  ├─ index.html + main.css + immersive.css
  ├─ main.js：启动、导航、阅读、弹层、生命周期协调
  ├─ 各页面/模式渲染器：学习、复习、测验、黄历、占筮
  ├─ 纯逻辑引擎：卦际关系、历法、出题、复习、成就
  ├─ Canvas StarMap：主要星图、标签、选择和空间交互
  ├─ Three.js CelestialStage：可降级的空间氛围层
  ├─ data/*.json：公开文化资料与派生数据
  ├─ localStorage：当前 origin 的个人记录与偏好
  ├─ sessionStorage：当前会话提示与星图入场标记
  └─ Service Worker / CacheStorage：公开网页资产离线缓存

HTTP 提供方（三选一，不是三层业务服务）
  ├─ npm start：Node 静态文件开发服务器
  ├─ Windows EXE：Node SEA 内嵌文件 + 本地静态服务器
  └─ GitHub Pages / 其他静态托管：公开站点文件

可选外接能力
  └─ 同源 /api/learning-review：只有客户端协议，当前仓库无实现
```

### 2.1 现状与目标

**现状**：所有核心学习流程在浏览器内执行，个人数据默认不离开当前浏览器。
静态服务器不读取、保存或计算用户学习记录。
**目标**：继续完善此结构，先把现有功能、错误提示、数据恢复和验收做完整。
**失败边界**：网络、可选数据或 WebGL 失败不得被解释成“服务器账户异常”。
**验收**：关掉可选评阅配置后，观象、阅读、学习、自评、复习、测验与备份应有明确本地路径。
**任务关联**：服务边界本身不是缺陷；现有接口加固关联 `T-API-01`。

## 3. 代码地图与职责分配

| 子系统 | 当前主要文件 | 责任与修改边界 |
| --- | --- | --- |
| 静态外壳 | [index.html](../../web/index.html)、[main.css](../../web/styles/main.css)、[immersive.css](../../web/styles/immersive.css) | 页面地标、导航、阅读层、响应式与主题；避免再次堆叠互相抵消的历史样式 |
| 应用协调 | [main.js](../../web/js/main.js) | 启动、模块切换、URL、阅读状态、焦点、弹层、星图生命周期 |
| 阅读状态 | [reading-state.js](../../web/js/reading-state.js) | 聚焦、快读、深读、章节和逐层返回的纯状态转换 |
| 阅读正文 | [render.js](../../web/js/render.js)、[content-provenance.js](../../web/js/content-provenance.js) | 经文、爻辞、关系、笔记、来源与校验状态 |
| 数据入口 | [data-loader.js](../../web/js/data-loader.js) | JSON 获取、核心自检、可选 Promise 缓存、查询索引 |
| 星图 | [star-map.js](../../web/js/star-map.js)、[star-layouts.js](../../web/js/star-layouts.js)、[star-relations.js](../../web/js/star-relations.js) | 布局、空间选择、镜头、关系、快照；保持同一个 StarMap 实例 |
| 标签和星空 | [star-label-layout.js](../../web/js/star-label-layout.js)、[star-atmosphere.js](../../web/js/star-atmosphere.js) | 跨类型避让、文字测量、星空纹理和亮度层级 |
| WebGL 氛围 | [celestial-stage.js](../../web/js/celestial-stage.js) | 与 Canvas 同步空间参照、像素预算、暂停、降级和释放 |
| 动效和声音 | [cinematic-motion.js](../../web/js/cinematic-motion.js)、[motion-system.js](../../web/js/motion-system.js)、[audio-engine.js](../../web/js/audio-engine.js) | 过渡、减少动态、用户手势后的声音与静音偏好 |
| 学习 | [learning-mode.js](../../web/js/modes/learning-mode.js)、[study-page.js](../../web/js/study-page.js) | 学习工作台、课程、典籍、数据入口 |
| 课程和考校 | [learning-curriculum.js](../../web/js/learning-curriculum.js)、[learning-assessment.js](../../web/js/learning-assessment.js)、[learning-assessment-page.js](../../web/js/learning-assessment-page.js) | 课程引用、题库、判分、复讲与推荐 |
| 复习与测验 | [review-engine.js](../../web/js/review-engine.js)、[quiz-engine.js](../../web/js/quiz-engine.js) 及各自 mode | 纯调度/判题与 DOM 分离，不在样式任务中修改判分 |
| 本轮提交协调 | [review-session.js](../../web/js/review-session.js)、[quiz-session.js](../../web/js/quiz-session.js) | 不透明内存token锁定本轮评分/答案与时间，按实际保存结果重试未成功项；复习提交核对原卡快照并合并最新卡集合，不新增全局回执键 |
| 共用修习反馈 | [learning-feedback.js](../../web/js/learning-feedback.js) | 只组织本次结果、判断依据、学习记录、下一步四段，约束一个主行动和最多两个次行动；调用方负责动态文本转义、业务保存、事件绑定与焦点，它不是HTML净化器 |
| 黄历 | [almanac-page.js](../../web/js/almanac-page.js)、[almanac/](../../web/js/almanac/) | 日期界面、天文、农历、干支、节气、择日与资料解读 |
| 占筮 | [divination-engine.js](../../web/js/divination-engine.js)、[meihua-engine.js](../../web/js/meihua-engine.js)、[divination-interpretation.js](../../web/js/divination-interpretation.js) | 起卦、变爻取辞、体用与分层解释 |
| 占筮记录 | [divination-history.js](../../web/js/divination-history.js) | 记录规范化、V1 兼容、V2 快照与隐私白名单 |
| 推演工具 | [evolution-lab.js](../../web/js/evolution-lab.js)、[evolution-state.js](../../web/js/evolution-state.js)、[evolution-semantics.js](../../web/js/evolution-semantics.js)、[relation-animation.js](../../web/js/relation-animation.js) | 演变、撤销重做、播放与同步语义证据 |
| 卦序工具 | [guaxu-wheel.js](../../web/js/guaxu-wheel.js)、[guaxu-mode.js](../../web/js/modes/guaxu-mode.js) | 转盘、结果与进入阅读 |
| 修习谱 | [achievement-catalog.js](../../web/js/achievement-catalog.js)、[achievement-engine.js](../../web/js/achievement-engine.js)、[achievement-storage.js](../../web/js/achievement-storage.js) | 成就定义、证据规则、事件幂等、存储与迁移 |
| 本地记录 | [storage.js](../../web/js/storage.js)、[user-data.js](../../web/js/user-data.js)、[learning-progress.js](../../web/js/learning-progress.js) | 安全 JSON、备份白名单、迁移与进度 |
| 分享与图形 | [share-card.js](../../web/js/share-card.js)、[svg-painter.js](../../web/js/svg-painter.js)、[ui-icons.js](../../web/js/ui-icons.js) | 公开分享图片、卦图与本地 Lucide SVG |

同一变更涉及多个模块时，先写清哪个模块拥有事实、哪个只消费结果。
例如正式深读的判定由阅读状态和入口负责，不应由 `renderHexagramDetail()` 一渲染就奖励。
例如关系计算由纯工具负责，Canvas 与文字列表都消费同一结果，不各自维护一份规则。

## 4. 启动、模块加载和退出生命周期

### 4.1 启动主链

代码依据：[main.js 的 init](../../web/js/main.js)、[data-loader.js](../../web/js/data-loader.js)。

1. 浏览器加载外壳、共享样式、本地 vendor、入口 ES 模块。
2. `init()` 选择 `loadCoreData`，为旧缓存兼容保留 `loadAllData` 后备入口。
3. 并行读取卦与八卦 JSON，并运行核心结构自检。
4. 尝试读取注疏 manifest；失败时 `commentaryReleaseReady` 保持 false。
5. 建立按卦码、卦序、卦名的索引。
6. 用真实卦际图创建一个 `StarMap`，绑定选择、悬停、关系、布局和镜头回调。
7. 绑定全局鼠标、触控、键盘、历史记录和布局响应。
8. 同步当前图式、关系、巡天按钮与导航状态，收起加载提示。
9. 合法 `?hex=六位码` 直接进入正式深读，初始历史采用替换。
10. 无深链时，根据会话“今日一卦已见”状态决定欢迎层或全景。

**失败边界**：核心 JSON 或其结构失败进入明确数据错误界面，不应继续用部分卦构建星图。
可选注疏失败保持门禁关闭；不得自动当作已开放。
**验收**：64 卦数量错误、重复码、缺卦序、爻码不一致必须给可识别错误。
**任务关联**：正文校勘关联 `T-CONTENT-01`，不是通过启动自检即可关闭的工作。

### 4.2 按需资源

`modeLoaders` 动态导入黄历、学习、复习、测验和占筮渲染器。
学习模式另外加载十翼、象数与黄历资料；黄历/测验加载黄历资料。
可选数据使用 Promise 缓存，失败清空缓存，允许后续重试。
不要把所有模式重新改成同步首屏大包，也不要因一次请求失败永久缓存 rejected Promise。

Three.js 氛围层由 `ensureCelestialStage()` 按意图加载。
并发加载共用同一 Promise，创建后回放当前模式、镜头和所有暂停原因。
导入失败清空 loader，允许重试；失败不应阻止 Canvas 和阅读。

### 4.3 模式切换与异步竞态

`setMode()` 先保存阅读草稿，退出冲突阅读层与工具，再更新当前模式。
离开探索时清空阅读呈现状态，切换两个星空层的模式与暂停状态。
页面显示带 `aria-busy` 的加载状态，同时加载渲染器与所需数据。
每次切换递增 `modeRequestId`；旧请求晚返回时不得覆盖后来选中的模式。
成功后安装本地图标、设置入场、恢复滚动到页面开头并把焦点送到主标题。
失败用 `role=alert` 的文本错误替换内容，最后移除 busy 状态。

学习、测验、复习及占筮渲染器可返回清理函数，由 `main.js` 在切模式、关闭或进入探索时调用；学习模块另在切换内部栏目时清理课程或考评视图。复讲的请求世代、当前结果身份和排队焦点属于页面会话，清理后旧响应、控件及RAF不得写记录或影响新页；未保存结果不因离开而自动补写。实现细节与验收边界见[学习反馈交接](evidence/2026-10-25-learning-feedback-integration.md)。

**建设目标**：新增模式仍遵守请求世代与焦点规则，不靠固定等待时间掩盖竞态。
**失败边界**：快速点“学习→黄历→测验”，最后画面必须由最后一次操作决定。
**验收**：用延迟数据夹具分别控制三次返回顺序，核对内容、导航、标题焦点和 busy。
**任务关联**：涉及离线失败反馈时关联 `T-CACHE-02`。

### 4.4 阅读与空间生命周期

聚焦码与正式阅读码分离；星图或搜索选择只聚焦。
快读和深读共享正文 DOM，切层不应丢章节、有效滚动或未保存笔记。
进入阅读前复制镜头和关系快照，退出恢复；窗口尺寸变化按空间半径换算。
桌面快读非模态，手机快读与深读模态；inert、Tab 限制与焦点恢复由入口协调。
`popstate` 只恢复状态，不重新 push 历史。
直接深链退出后留在站内，不能为“返回”无条件调用 `history.back()`。

**失败边界**：快读不得触发正式深读成就/复习卡；深读重复进入不得重复奖励。
多个暂停原因必须共存，不能关闭一个弹层就恢复仍被另一个遮罩暂停的动画。
**验收**：按总册交互路径与 [证据专题](10-testing-evidence.md) 逐层操作。
**任务关联**：正式深读保存结果提示关联 `T-SAVE-01`。

### 4.5 页面退出

`pagehide` 非 bfcache 保留场景下释放 motion system、cinematic motion 和 CelestialStage。
各组件自己的 `destroy()` 还应清理监听、定时器、RAF 和图形资源。
不能只移除 DOM 就假定动画和全局监听已经停止。
若以后调整页面缓存恢复策略，必须一起验证 `event.persisted` 和返回后可操作性。

## 5. 三种本地提供方式的差异

| 能力 | `npm start` | `web/serve.bat` / `serve.sh` | Windows EXE |
| --- | --- | --- | --- |
| 实现 | Node `scripts/serve.mjs` | Python http.server；sh 可退到 npx http-server | Node SEA + desktop-launcher |
| 默认监听 | 127.0.0.1 | 0.0.0.0 | 127.0.0.1 |
| 默认端口 | 3030，PORT 可改 | 3030 | 3030，可自动后移或指定 |
| 文件来源 | 当前 web 目录 | 当前 web 目录 | 构建时内嵌的 web 文件 |
| 自动开浏览器 | 无 | 脚本仅打印地址 | 有，可 `--no-open` |
| 安装前提 | Node 22+ | Python；sh 后备路径可能调用 npx | 最终用户无需 Node |
| gzip | Node 服务器支持 | 由所用工具决定 | 启动器没有实现 gzip |
| 方法约束 | 当前主要按文件返回 | 工具自己的默认行为 | 只允许 GET、HEAD |
| 响应头 | no-cache、MIME、可选 gzip | 工具自己的默认行为 | no-cache、MIME、长度、nosniff |

开发文档默认使用 `npm start`，避免不同提供方式造成缓存和可访问范围误判。
`file://` 不是支持入口；`protocol-guard.js` 会把地址转到本地 HTTP，但不会替用户启动服务器。
Python 方式绑定所有网卡，若只需本机，开发者应明确改用 Node 默认入口。
本篇未修改这些脚本，也未宣称其行为已经统一。

## 6. 可选复讲评阅协议

### 6.1 当前实现位置

- 配置和请求：[learning-review.js](../../web/js/learning-review.js)。
- 课程参考要点：[learning-curriculum.js 的 getLessonRubric](../../web/js/learning-curriculum.js)。
- 提交、反馈和本地回退：[learning-assessment-page.js](../../web/js/learning-assessment-page.js)。
- 设置入口：[learning-mode.js 的数据区](../../web/js/modes/learning-mode.js)。

当前没有配套服务器实现、部署配置、模型厂商绑定或付费调用承诺。
静态 Pages 和当前 Node 文件服务器不会自动提供 `/api/learning-review`。
仅把配置保存成功写为“评阅已配置”，不能写为“服务器已连通”。

### 6.2 输入与请求

配置默认 `{ "endpoint": "" }`，保存在 `yijing-learning-review-config-v1`。
现有校验接受 `/` 开头且不以 `//` 开头的地址；推荐示例 `/api/learning-review`。
此字符串检查尚不等于完成 URL 规范化验证，后续由 `T-API-01` 加固。
复讲响应必须是字符串，去首尾空格后长度至少 20；接口目前没有独立的最大文本长度。
`rubric` 当前来自 `getLessonRubric()`，是参考要点字符串数组。
用户按“智能评阅”后才发送，不在输入过程中自动外发。

```http
POST /api/learning-review
Content-Type: application/json
```

```json
{
  "schemaVersion": 1,
  "task": "yijing-learning-recitation",
  "lesson": { "id": "l1-4", "title": "认识八卦符号" },
  "rubric": ["能辨认八卦三爻符号", "能说出八卦的自然之象", "能说明八卦的核心德性"],
  "response": "用户本次主动提交的复讲文本，先去除首尾空格。"
}
```

请求使用 `credentials: 'omit'`，不携带浏览器凭据。
15 秒后 AbortController 终止等待；不能误写为无限等待或已有自动重试队列。
发送字段不包含全部笔记、占筮私问、学习记录或浏览器存储。
任何未来新增字段都要重新说明必要性、用户提示和测试边界。

### 6.3 响应与失败

```json
{
  "score": 86.4,
  "summary": "面向本次复讲的简短点评。",
  "strengths": ["一项已经说明清楚的要点"],
  "improvements": ["一项需要补充的要点"]
}
```

`score` 必须为 0—100 的有限数；summary 为字符串；两个数组每项必须为字符串。
客户端将分数四舍五入，每组最多取四条，并返回内部 `mode:'ai'`。
当前没有要求服务器返回本地成就事件，也不接受响应直接写任意 localStorage 键。
HTTP 非成功、无效 JSON/结构、网络失败、超时都会转本地要点自评。
超时文案明确，普通错误保留原因；按钮请求中禁用，结束按配置状态恢复。
成功点评若保存失败，要显示“已返回但未保存”，不能把网络成功当成持久化成功。

**建设目标**：同源 URL 规范化、异常路径和重定向边界、可理解错误和输入容量测试。
**失败边界**：模型密钥不进入输入框、仓库、备份或前端 bundle。
**验收**：空配置、短文本、跨源路径、反斜杠路径、15 秒超时、HTTP 4xx/5xx、错误结构、有效小数分数、保存失败均有测试。
**任务关联**：`T-API-01`；新增真正服务器必须独立立项，不能据此直接搭建。

## 7. 依赖和运行资产

网页运行时使用本地 `web/lib/vendor/` 与 `web/lib/d3-force.js`。
根 package 的 gsap、lenis、three 用于依赖管理与更新来源；实际运行的是已分发文件。
更新 package-lock 不会自动更新 vendor；替换 vendor 也不会自动更新其来源记录。
postject 是 Windows SEA 构建工具；uisfx 是开发期声音选型工具，不能当作已全量接入网页。
Lucide 图标由 `ui-icons.js` 中本地 SVG 路径安装，不依赖网络图标组件运行时。

**目标**：记录包版本、vendor 文件、来源、许可、用途、更新步骤和校验方法。
**失败边界**：不得把 GSAP 标为 MIT，不得把 root 的 MIT 自动套到参考 PDF、图片和声音。
**验收**：离线启动不存在 CDN 请求，第三方声明与实际文件相符。
**任务关联**：`T-ASSET-01`。

## 8. 其他 AI 的架构修改检查

开始前读 `AGENTS.md`、总册、相关模块、相关测试和当前 diff。
先指定事实拥有者，再列输入、输出、持久化副作用、生命周期与降级路径。
纯计算变更先补固定夹具；页面行为变更补真实输入和焦点路径。
不要用新增框架取代理解旧逻辑，不要覆盖已有未提交修复。
新增公开文件同步检查离线缓存、版本号、Windows内嵌资源与许可。
修改 URL/阅读层时核对深链、前进后退、快读草稿、章节与焦点恢复。
修改服务端边界时先说明当前只是静态提供器，避免把未来方案写成既有能力。
完成后记录实际命令、结果、未验证项与差异，按 [证据专题](10-testing-evidence.md) 回填。
