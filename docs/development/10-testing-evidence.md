# 10 测试、验收与证据

日期：2026-10-24（Asia/Shanghai）。返回 [开发建设总册](../DEVELOPMENT-MASTER.md)。

需求状态：质量门禁已确认。实现状态：自动回归已实现、真实交互与外部验收部分实现。验证状态：validate 本轮通过；E2E 已有失败，当前精确结果以 [持久记录](evidence/2026-10-24-validation.md) 为准。

## 1. 如何判断“通过”

验收应回答四个独立问题：规则算得对吗、数据能安全保存恢复吗、用户能完成流程吗、目标环境可用吗。任何一种证据不能代替另外三种。

| 证据 | 可以证明 | 不能证明 |
| --- | --- | --- |
| 源码阅读 | 存在实现、缺少调用、接口和规则 | 用户实际能完成操作 |
| 纯逻辑单元测试 | 输入、输出、边界和错误分支 | DOM 命中、焦点、浏览器历史 |
| 结构/源码契约测试 | HTML/CSS/调用约定存在 | 所有样式组合下的真实交互 |
| CDP 真实输入 E2E | 指定 Chromium 环境的流程结果 | 所有浏览器/真机/屏幕阅读器 |
| 模拟触控 | 浏览器触摸事件路径 | iOS/Android 键盘、安全区和设备性能 |
| 640 CSS px | 窄布局适配 | 真实浏览器 200% 缩放 |
| Lighthouse | 特定版本的自动规则及性能采样 | 内容正确、读屏全程和全部页面 |
| 截图 | 指定状态的视觉结果 | 隐藏状态、业务副作用和数据恢复 |
| 内容结构校验 | 字段、覆盖、来源引用与门禁 | 原典文字已经底本双校 |

“测试全部通过”必须带命令和范围。此刻浏览器门禁未关闭，不能对产品使用该表述。

## 2. 环境和工作目录

- Node.js 22+，当前工具运行报告 Node v22.23.1。
- 主站根目录运行 npm 脚本；不要在 web/ 中直接执行根脚本。
- test/almanac 下部分脚本依赖 web/ 工作目录；统一 runner 会代为切换。
- E2E 使用本机 Chromium 类浏览器、临时 profile、独立本地服务；不要指向用户已有 profile。
- 以源码快照为准，不用当前线上页面替代未提交工作区。
- 截图和日志只用合成笔记、测试数据，不能使用真实私人备份。
- 当前前端无 TypeScript；npm run check 是语法/基础格式校验，不是 ESLint 或类型检查。

## 3. 命令与实际覆盖范围

~~~powershell
# 在项目根目录
npm run check
npm test
npm run test:coverage
npm run validate
npm run test:e2e
git diff --check
~~~

| 命令 | 实际执行 | 当前边界 |
| --- | --- | --- |
| npm start | Node 静态开发服务 | 不启动 API、不构建网页 |
| npm run check | 70 个 JS/MJS 语法与基本空白检查、11 JSON 解析、注疏目录门禁、Git 跟踪树禁止扩展名 | 不覆盖所有 CJS、CSS lint、秘密扫描或许可认证 |
| npm run test:unit | 50 个 web 测试与 6 个非渲染历法脚本 | 数量取当前目录；不要永久写死到宣传文案 |
| npm run test:smoke / npm test | web 50 + 历法 7，共 57 脚本 | 不等于 57 个断言；独立断言脚本与 TAP 并存 |
| npm run test:coverage | Node test runner 运行 50 个 web 测试；本轮 230 TAP 子测试 | coverage include 只设 20 个纯逻辑/存储模块 |
| npm run validate | checks + 57 脚本 + coverage | 不包含真实浏览器 E2E、真机、读屏、Windows 构建 |
| npm run test:e2e | 隔离 Chromium、CDP 输入、五视口、历史/草稿/离线/降级等 | 当前存在失败；不能只保留一次偶然成功 |
| npm run build:windows / npm run test:windows | 本地 SEA 构建及启动验证 | 本次文档任务未重建或实跑 |
| npm --prefix promo-video run typecheck | 宣传工程 TS 检查 | 本次文档任务未运行；不属于网页 validate |

20 个 coverage 模块：achievement-catalog、achievement-engine、achievement-storage、data-loader、guaxu-wheel、divination-engine、divination-interpretation、divination-history、evolution-state、hexagram-utils、learning-assessment、learning-curriculum、learning-progress、learning-review、meihua-engine、quiz-engine、review-engine、search-controller、star-relations、storage。

99.61/90.20/97.78 是以上集合的行/分支/函数覆盖率，**不是全仓库覆盖率，也不是每个文件都超过 90%**。reading-state 和 star-label-layout 有测试，但尚未加入 coverage include，归入 T-QA-02。

## 4. 功能到测试映射

下表名称均指 web/test 下同名 .test.mjs；历法组另注明。实施任务前应阅读原测试，不能只凭名称推断完整覆盖。

| 功能 | 测试入口 | 必须补充的真实路径 |
| --- | --- | --- |
| 64 卦/卦码/序卦 | data-loader、hexagram-utils、hexagram-order-remarks | 数据加载失败和错误可见 |
| 图式/关系 | star-layouts、star-relations | 五图式、动爻条件、DOM 与 Canvas 一致 |
| 标签/星群/预算 | star-label-layout、star-map-performance、star-atmosphere、celestial-stage | 渐乾坤多缩放、长词/边缘/运动 |
| 星图键盘/生命周期 | star-map-accessibility、main-stage-lifecycle | 真实焦点、双击退出、多个暂停原因 |
| 阅读状态与正文 | reading-state、reading-document、render-accessibility | 快读/深读、章节、笔记、历史、镜头恢复 |
| 外壳与布局 | immersive-shell、layout-contract、daily-overlay-layout、typography-system、ui-icons | 五视口、200%、真机、强制颜色 |
| 课程/进度 | learning-curriculum、learning-progress、learning-ui-contract | 推荐优先级、继续章节、来源返回 |
| 考评/复讲 | learning-assessment、learning-review | 不完整交卷、异常评阅、本地回退、错题温习 |
| 复习/自由测验 | review-engine、quiz-engine | 自评不当正误、重复提交、具体错题恢复 |
| 成就 | achievement-catalog、achievement-engine、achievement-storage | 从真实业务入口达成十二项，不能只喂引擎夹具 |
| 占筮 | divination-engine、divination-interpretation、divination-history、meihua-engine | 无效输入、重放稳定 ID、本之深读和五步挑战 |
| 演变/转盘 | evolution-lab、evolution-semantics、relation-animation、guaxu-wheel | 语义随帧、取消计时、模态、门禁 |
| 黄历 | almanac-timezone、almanac-page-accessibility | 日期边界、内联术语、七日轴目标 |
| 天文/历法 | test/almanac 下 astronomy、ganzhi、lunar、solar-terms、selection、load-all-data、render-smoke | 与来源夹具逐日比对；不是全范围认证 |
| 备份/存储 | storage、user-data | 超限、自己导出可导入、配额及回滚 |
| 分享/音效/离线 | share-card、audio-engine、motion-system、pwa-assets、protocol-guard、mode-result-visibility、search-controller | 私人字段排除、成功后声音、首次离线与更新 |

## 5. 已观察的浏览器失败

### B-01 画布鼠标选星

- 2026-10-24 只读审查中，默认无截图 npm run test:e2e 首次失败。
- 报错：鼠标未能从画布选择已绘制星点。
- 位置：scripts/browser-smoke.mjs 的 pickRenderedStar，抛错约第 215 行，入口约第 590 行。
- 与 validate 并行运行；这是运行条件记录，不足以判定并行负载是根因。
- 10 月 22 日带截图运行曾通过；不能据此断言截图延时造成成功。

### B-02 快读六爻章节

- 同日独立第二次运行，前面的选星通过，后在快读章节检查超时。
- 报错：快读六爻章节未响应真实鼠标。
- 位置：scripts/browser-smoke.mjs 约第 794 行，断言六爻页签 aria-pressed=true。
- 需区分实际未命中、呈现过渡移动、scroll 监听改写章节、选择逻辑错误或测试采样问题。

### 排查顺序：T-QA-01

1. 在干净临时 profile、无截图默认参数运行，记录浏览器版本、viewport、DPR、偏好、加载完成与入场时点。
2. 失败前后记录鼠标 CSS 坐标、canvas rect、当前绘制点、命中元素、focus、reading stage、section、aria-current/pressed、panel scroll、各区块 rect。
3. 对比入场/稳定后、正常/减少动态模式；每个对比只改变一个条件。
4. 保留失败截图和状态摘要；截图目录不能复写 10 月 22 日历史。
5. 先形成有证据的根因，再补能够复现根因的回归；产品与测试修改分别说明。
6. 不能用 DOM click 替代原真实输入；不能去掉断言或无限重试掩盖。
7. 相关回归通过后再跑完整 E2E；重复仅用于新修复或已证明的不稳定问题，逐次保存结果。

本文档任务不修改测试或业务代码。新的文档编制复跑记作 E-03，精确结果在持久记录，不能抹去 B-01/B-02。

### 参数化截图完成前的安全诊断

T-QA-01可以先采证，不必依赖后继T-QA-03。调试脚本时在失败捕获中使用现有CDP client和已导入的Node函数，将图写入新临时目录；**这是下一任务的诊断代码示例，本次文档工程未插入或执行它**：

~~~javascript
const diagnosticDirectory = mkdtempSync(join(tmpdir(), 'yijing-e2e-diagnostic-'));
const capture = await client.send('Page.captureScreenshot', { format: 'png' });
writeFileSync(join(diagnosticDirectory, 'failure.png'), Buffer.from(capture.data, 'base64'));
// 同目录保存脱敏坐标/ARIA/scroll摘要，并输出这个新目录路径。
~~~

不要设置旧YIJING_SMOKE_SCREENSHOTS开关。检查图片无私文后，显式复制到新的docs/qa/<日期>/<任务>/<run>/，记录来源；不覆盖10月22日图片，不递归删除未经核对的目录。参数化输出仍由T-QA-03独立实施。

## 6. 逻辑与数据验收矩阵

每项写“Given 前置 / When 操作 / Then 断言 / Evidence”，成功与失败都检查状态副作用。

| 编号 | 场景 | 必须断言 |
| --- | --- | --- |
| L-01 | 64 码、上下卦、六爻对应 | 数量唯一、爻题九六、底到顶索引、非法码拒绝 |
| L-02 | 错综互变与同目标多关系 | 方向/动爻不丢、互不强行对称、固定单层 |
| L-03 | 聚焦→快读→深读→返回 | 前两者不写深读/卡；首次深读写一次，返回不重复 |
| L-04 | 进入快读后改关系/缩放，再深读关闭 | 同实例恢复深入前状态、复制快照不互相污染 |
| L-05 | 快读/深读 DOM 与草稿 | 同卦不重建正文、非零滚动和草稿不丢、刷新边界准确 |
| L-06 | 后退/前进/直接深链关闭 | popstate 不再 push、section 恢复、关闭留站内 |
| L-07 | 课程考评与成就 | 业务提交产生需要的 metadata，同一 session 不重复 |
| L-08 | 起卦新结果与历史重放 | 六爻/规则一致、不新增历史、同案例不刷成就 |
| L-09 | 存储属性 getter 抛错、JSON 损坏、写配额失败 | 读取降级，写入可感知，不虚报保存成功 |
| L-10 | 导入版本/超限/坏字段/null/缺失/未知键 | 先验证、白名单、缺失保持、null 删除、失败回滚 |
| L-11 | 注疏缺来源/缺锚点/缺校对/未校底本 | canRelease=false；不凭 progress 数字开门 |
| L-12 | 多暂停原因，先后关闭不同遮罩 | 只移除自身原因，未解除原因时仍暂停 |

历法重点：2026-02-17 初一，2033 闰十一月和 2034 衔接，朔日 00/12/23 时同日一致，立春与春节不同日界，节交时、闰月、上下界、跨设备时区。具体夹具来源见 05 专题及测试；不得凭本文虚构权威来源。

## 7. 真实交互与视觉矩阵

| 环境 | 操作 | 验收 |
| --- | --- | --- |
| 1440×1024 | 欢迎三入口、六导航、五图式、关系、快读深读 | 控件可见、层级与正文宽度、镜头恢复 |
| 1280×720 | 完整探索到阅读、展开工具、动爻、滚动/笔记 | 真实鼠标命中、章节状态唯一、46dvh |
| 768×1024 | 桌面缩窄、模态切换、目录出处折叠 | 不残留 inert，焦点不被旧工作台抢走 |
| 390×844 | 触控抬起选卦、>6px 拖动、75dvh、关闭 | 拖动不误选、背景隔离、完整返回 |
| 320×844 | 六导航、学习、快读深读与长文 | 无页面级横溢、不裁掉按钮和来源 |
| 真实 200% 缩放 | 同浏览器缩放设置而非模拟尺寸 | 记录菜单倍率、viewport/DPR；不等价替代 |
| 减少动态 | 首次、选卦、图式、转盘、阅读、关系 | 稳定呈现、语义完整、无自动巡天 |
| WebGL 失败 | 禁用/拒绝 context 后重载 | Canvas 与全部已加载阅读仍可操作 |
| 离线 | 首装核心、访问后功能、从未下载功能 | 按缓存范围成功或明确不可用，不能白屏 |

渐、乾、坤分别在 100%、约 195%、约 244% 星图缩放检查：卦名/关键词共享避让、长词、边缘、控件、焦点圈、优先级、稳定排序。这里的星图缩放不是浏览器缩放。

键盘全程不得依赖 evaluate 中直接 click：搜索输入与列表、工具折叠、动爻、DOM 关系列表、快读/深读、Tab/Shift+Tab、Escape、模块切换、答题/交卷、自评、导入配置。测试 setup 可直接设置合成夹具，但最终操作必须按真实输入验证。

## 8. 外部环境和性能

尚未取得当前版本完整证据：Android Chrome、iOS Safari、NVDA/VoiceOver、真实 200%、Firefox/Safari 完整矩阵、强制颜色与背景合成对比度、当前 UI 三次性能中位数、长时设备性能。

每条外部记录须包含设备/OS/浏览器/辅助技术版本、输入方式、日期、源码快照、步骤、结果、截图或记录及已知限制。不要求用户在本次文档任务立即提供，但任务卡 T-A11Y-01/T-PERF-01 必须保留外部证据缺口。

性能记录区分首屏、首次星图操作、稳定漫游、进入/退出工作台和长时使用。测 FPS、CPU/内存、暂停后帧数、WebGL backing-store 面积；不能拿历史 Lighthouse 报告关闭当前改动的性能任务。

## 9. 截图和日志管理

- docs/screenshots/2026-10-22-immersive/ 有 25 张历史 UI 升级截图；归档索引见证据记录。
- docs/screenshots/2026-09-30-starfield.jpg 是更早历史基线，不是本轮重新拍摄的修改前截图。
- docs/screenshots/2026-10-22-reference-study/ 为设计参考关键帧，不是运行时图像或验收截图。
- docs/qa/2026-10-07/ 的生产 v50/Lighthouse/浏览器记录是历史，不能覆盖当前 v51。
- 默认 E2E 不写截图；YIJING_SMOKE_SCREENSHOTS=1 当前写死到 10 月 22 日目录。后续需先通过 T-QA-03 解决独立证据路径，避免覆写。
- 不把只存 TEMP 的日志当作可携带交接。至少保存脱敏摘要、退出码、失败栈和覆盖范围；保留原始完整日志时先检查敏感信息。

证据记录模板：

~~~text
ID / 日期 / 执行者
需求与任务 ID
HEAD + 未提交源码快照
环境 / 工作目录 / 参数
命令或真实操作步骤
退出码 / 通过断言 / 失败断言
截图与日志相对路径
限制 / 未验证 / 下一步
~~~

## 10. 文档本身的验收

1. 12 专题链接均存在；代码路径和测试名称核对实际文件。
2. 需求编号、任务编号、显式锚点与依赖可解析，无遗漏或依赖环。
3. 所有待办都有当前事实、目标、允许修改范围、测试和完成条件。
4. 独立 AI 只读文档可回答如何启动、当前是否有后端、先做什么、门禁为何关闭、备份如何迁移、哪些检查失败。
5. 对比源码快照，确认本次文档实施未改应用、测试、脚本、数据或配置。
6. git diff --check 通过；警告与退出码分别解释。
7. 文档问题修复后再次检查链接/追踪即可；没有源码变化时不无意义反复跑全量产品测试。

可重复的文档检查工具（项目根目录）：

~~~powershell
node docs/development/tools/check-docs.mjs
node docs/development/tools/check-docs.mjs --source-guard
~~~

第一条检查总册、12专题与证据摘要的本地链接、锚点、空白、需求编号和任务依赖。它不访问外部URL，不证明业务实现或内容校勘。第二条额外对照本次171文件快照，允许 web/README.md 的文档变更；**只用于本次文档交付保护**。后续正式功能开发改变源码后不应继续宣称该保护通过，应建立新的任务基线。

当前交付结果和独立读者检查记录将在 evidence/2026-10-24-validation.md 追加。产品验收未完成不妨碍准确的建设文档交付。
