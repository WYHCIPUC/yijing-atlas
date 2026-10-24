# 沉浸星仪本地升级交接

日期：2026-10-22（Asia/Shanghai）。工作目录：`Y:\易经学习项目`。

> 2026-10-24 已建立 [最新开发建设总册](../DEVELOPMENT-MASTER.md) 和 12 份专题。本页保留本地升级实现记录；全项目差距、后续任务与当前验收以总册及 [证据记录](../development/evidence/2026-10-24-validation.md) 为准，不根据下文命令清单推定通过。

本文件承接 `2026-10-06-project-handoff.md` 的历史记录，说明本次本地 UI 升级。当前修改未提交、未远程发布。不要重置工作区；开始实施前已有的生命周期修复、参考研究、截图与交接更新均保留。

## 启动与范围

Node.js 22+，运行 `npm start` 后访问 `http://localhost:3030/`，不能使用 `file://`。应用仍为 `web/` 下的 HTML/CSS/ES Modules、Canvas 和本地 Three.js；不需要安装新的运行时依赖或构建框架。`legacy-flutter/` 未修改。

确认方案在 `docs/UI-DESIGN-BASELINE.md`，分阶段实施记录在 `docs/plans/2026-10-22-immersive-astrolabe.md`。复制项目时保留 `web/`、`scripts/`、`docs/`、根目录配置与项目数据；私人学习数据仍在浏览器本地存储，复制源文件不会迁移浏览器数据。

## 实际实现

- 外壳：深蓝黑、细银线、局部铜金、本地 Lucide SVG；桌面导航约 72px，手机顶部约 116px、六入口单行。欢迎页保留三条开始路径。共享样式适配学习、典籍、复习、测验、黄历、占筮和修习谱。
- 星图：保留五种图式和真实卦族；卦名、关键词共用屏幕占位，7px 间距、重要标签换位、次要隐藏；最多当前三词、关系各一词。文字测量缓存、短周期布局缓存与控件占位共同减少遮挡。
- 交互：会话一次约 900ms 入场、约 450ms 选卦镜头；拖动和重新操作可以中断。指针抬起确认，超过 6 CSS px 视作拖动。经典图式方位保持固定。
- 阅读：点击星图或搜索只聚焦；“研读此卦”打开快读（桌面 46dvh，手机 75dvh）；“深入研读”打开深读。暖纸正文、目录和出处边注共用一个 DOM；六爻正文初至上，卦象图初爻在下。窄屏目录与出处折叠，包括从桌面缩窄的情况。
- 记录：聚焦和快读不触发正式阅读或新增复习卡；深读调用原有幂等事件。`?hex=六位编码`、分享、今日一卦、课程引用和占筮结果仍直接深读。
- 返回：Escape 深读 → 快读 → 聚焦 → 全景；工具展开优先关闭。返回星图保持同一 StarMap，复制镜头、关系、巡天与漫游轨迹，按空间半径换算不同尺寸下的摄像机坐标。直接深链关闭留在站内，焦点回聚焦摘要入口。
- 草稿：快读与深读切换不重新渲染；章节、滚动、笔记草稿保留。切换到其他卦或工作区时，未保存草稿只暂存当前页面内存，不自动写浏览器存储。
- 模态：手机快读、深读、手机工具面板用原生 inert 隔离背景并约束 Tab；桌面快读保留星图操作。多个暂停原因独立；深读与手机快读暂停无用绘制。WebGL 约 500 万 backing-store 像素上限，失败时 Canvas 与阅读保留。
- 缓存：Service Worker 与入口样式/脚本升级到 v51，新增本地模块纳入预缓存。

## 代码入口与约定

| 文件 | 职责 |
| --- | --- |
| `web/js/main.js` | 聚焦、快读、深读与工作区调度；历史、模态、焦点、快照和正式阅读计数 |
| `web/js/reading-state.js` | 纯阅读状态转换；`focusedCode` 与 `readingCode` 分离 |
| `web/js/render.js` | 同一阅读正文的目录、暖纸、出处、笔记和关系入口 |
| `web/js/star-map.js` | Canvas 输入、镜头、同实例快照、共享空间文字 |
| `web/js/star-label-layout.js` | 文字测量缓存与跨类型占位算法 |
| `web/js/star-atmosphere.js` / `celestial-stage.js` | 预渲染银河、WebGL 氛围、像素预算与暂停 |
| `web/styles/immersive.css` | 当前外壳与阅读主题；`main.css` 保留既有功能结构及旧偏好兼容 |
| `web/js/ui-icons.js` | Lucide 静态 SVG 安装；许可在 `web/lib/vendor/LUCIDE-LICENSE.txt` |
| `scripts/browser-smoke.mjs` | 隔离 Chromium profile 的真实输入、视口、离线和降级回归 |

阅读状态由 `body` 和 `#detail-panel` 的 `data-reading-stage=none|quick|deep` 表达。旧 `yijing-panel-layout`、`yijing-drawer-size` 偏好继续保留，新阅读状态不重写它们。对星图的 Escape 由 `onExitFocus` 委托入口统一逐层返回，避免 Canvas 先清焦点再被全局处理第二次。

StarMap 新接口：`captureView()`、`restoreView(snapshot)`、`setReservedRects(rects)`。快照含 `anchorR`；恢复不能绕过尺寸换算。控件矩形使用 Canvas CSS 坐标，不能直接传设备像素坐标。

## 验证与截图

验收命令：`npm run validate`、`npm run test:e2e`。2026-10-24 重跑 validate 通过（coverage 230/0）；真实浏览器测试仍在快读六爻章节检查失败，之前还观察到选星失败，原因待定位。详见上方证据记录。现有截图开关会写入 `docs/screenshots/2026-10-22-immersive/`，该目录已有 25 张历史图；新采集前先处理执行卡 T-QA-03 的独立输出路径，避免覆写历史。

历史对照图：`docs/screenshots/2026-09-30-starfield.jpg`（2026-09-30 历史基线，并非本轮修改前重拍）。参考视频关键帧位于 `docs/screenshots/2026-10-22-reference-study/`，只用于设计资料，没有放入运行时。

## 仍需外部证据

- Android / iOS 真机的输入、软键盘、安全区域和性能：尚未取得证据；模拟触控不代替真机。
- 屏幕阅读器连续操作：尚未取得证据；DOM/ARIA 与键盘测试不代替读屏测试。
- 真实浏览器 200% 缩放：IAB Ctrl+0 无缩放变化；独立 Chromium 临时 profile 的默认缩放偏好未生效（outerWidth 1280、innerWidth 1254、DPR 1、visualViewport.scale 1）。不把 640 CSS px 的等效窄视口标成真实 200%。
- 原文双人校勘和六家注疏发布门禁继续沿用项目现状，UI 通过不代表内容已校验。未远程发布。

下一位 AI 先读上方2026-10-24总册、当前证据和任务卡，再核对实际diff，保留全部未提交修改。当前先定位T-QA-01浏览器失败，再按依赖继续学习/阅读/挑战与设备证据；远程发布另案。不要改变六位自下而上的卦码、历法算法、关系规则或私人数据处理边界。
