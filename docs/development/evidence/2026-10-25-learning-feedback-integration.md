# T-LEARN-03 四段修习反馈整合交接（本地验收完成）

记录日期：2026-10-25（Asia/Shanghai）。本文件首次建立时已确认目标路径不存在，未覆盖旧交接材料。

**当前结论：已确认需求；T-LEARN-03 本地验收完成，提交与 GitHub 同步待登记实际结果。** v9 独立专项 **51/51**，完整 `npm run validate` 实际 `exit 0`：75 个质量脚本、覆盖率阶段 629/629；完整 `npm run test:e2e` 也已 `exit 0`，五视口共 25 张截图。最终专项批次 session81090 已终态 `exit 0`；接受集使用相同 31 个观测文件，跨 Node22／Node24 运行环境。所有历史失败与中止保留，不宣称更换运行时治愈原生断言。本文不预填提交 SHA、push、远程 CI 或生产发布。

最新冻结记录为 [源码 v9](2026-10-25-learning-feedback-final-source-v9.json)，记录于 `2026-10-24T23:56:45.3666875Z`，共 171 文件。相对 [v8](2026-10-25-learning-feedback-final-source-v8.json) 只改变 `learning-ui-contract.test.mjs` 与 `mode-result-visibility.test.mjs`；v8 相对 [v7](2026-10-25-learning-feedback-final-source-v7.json) 只改变 `layout-contract.test.mjs`。这三次契约修订未改变浏览器观测的 31 个产品／数据／探针文件。[最终验收记录](2026-10-25-learning-feedback-final-acceptance.json)已核对 171 文件，`changed: []`，并汇总完整门禁、可信输入、独立审阅和证据包。最终提交应保持该源码对应关系；此前各候选和失败证据全部保留，见 §5.1。

本卡来源与完成条件见 [T-LEARN-03 执行卡](../12-ai-execution-tasks.md#t-learn-03)、[学习、典籍与考评](../04-learning-library-assessment.md)和[界面与无障碍规范](../07-interface-accessibility.md)。此前 T-QUIZ-01 的交付及远程绿灯不覆盖本卡随后未提交的改动。

## 1. 已落盘的实现与业务边界

| 范围 | 当前实现 | 保持的限制 |
| --- | --- | --- |
| 共享四段反馈 | `web/js/learning-feedback.js` 输出“本次结果、判断依据、学习记录、下一步”，固定一个主行动、最多两个次行动；保留调用页原生按钮和选择器 | 参数为调用方已转义的可信 HTML 模板；不是清洗器，不写数据、不自动聚焦、不对整块反馈设 `aria-live` |
| 间隔复习数据 | `review-session.js` 建立页面内不透明会话；首次合法 0/1/2 评分锁定评分和时间；`review-engine.js` 核对真实持久卡及原快照，再合并最新卡集合 | 不改变原间隔算法；卡片缺失、同卡冲突、读取异常或坏数据不覆盖原记录；不同卡的新记录保留 |
| 间隔复习页面 | 翻面后才能自评；提交后保留答案和选定评分，四段反馈展示卡片、学习活动、成就各自保存状态和下次温习时间；失败只补未保存部分 | 自评不称客观正确或已掌握；来源核对不创建复习卡或学习证据；来源返回、继续温故和回队列各有明确路径 |
| 自由测验 | `quiz-mode.js` 接入四段反馈；保留原题、原答案、同一 `quiz-session` 和六项保存结果；术语依据保留原引用及来路 | 不重写 T-QUIZ-01 判分、原规则纠正、旧摘要或六项幂等；单次正确不称已掌握 |
| 课程小试／抽查／考评 | `learning-assessment-page.js` 接四段反馈，保留既有会话 ID、成绩／成就协调与实际课程弱项状态 | 不以渲染或重复点击添加成绩；旧表单、结果动作及排队焦点必须属于当前页面、当前结果 |
| 复讲 | 课程、输入、请求和本轮结果有生命周期标识；改原文、换课、转自评、进入小试、重绘中心或离页后，旧成功／失败／finally 不再写成绩或污染新页面 | 保留最少 20 字、现有 15 秒超时及可选同源协议；无新增后端；私人原文和评阅结果仅在页面内存 |
| 复讲仅保存重试 | 首次自评或智能评阅结果锁定本轮课程、分数、时间及两项保存状态；成绩或学习活动失败只补失败项，不新增 POST，不重复追加已保存成绩 | 未配置接口时本地自评同样可恢复；编辑、换课或明确开始新轮才建立新结果；离页／刷新不承诺恢复未保存结果 |
| 复讲依据与原课入口 | 成功或保存失败结果显示本轮课程标题、“项目课程要点”和“回原课温习”；通过既有 `onNavigate('path', lessonId)` 返回锁定课程 | 明示未附原典出处定位、出处与校验状态待核对；原课动作不补保存、不新增 POST；旧结果动作失效。v6 长说明窄屏截断已修复，单场及最终专项验收通过 |
| 解卦反馈 | 金钱／梅花既有五项勾选自评接四段反馈，明确每项 20 分；展示取辞依据、方法边界及实际成就保存变化；失败按钮只保存原事件 | 保留稳定案例 ID、历史重放与旧分；不把勾选自评称为结构题检验，不提前实现三路径、五步挑战或新正式研读入口 |
| 解卦严格读取 | 本轮保存入口只读取一次成就原始值；有效 V1 或合法 V0 事件可复用原迁移；读失败、坏 JSON、非法 V0 事件不尝试写入，恢复后保留原事件时间与分数 | 仅保护本卡解卦入口；未修改全局 `achievement-storage.js` 回退规则，没有扩展为全项目存储重构 |
| 页面清理与样式 | 学习子页使用既有清理机制；`main.js` 接收占筮 renderer 返回的 cleanup；反馈共享样式位于 `immersive.css` | 退出、换方式、重放、重绘后旧控件及旧焦点任务失效；DOM 测试不替代实际像素和焦点可见性验收 |

当前没有新增顶层存储键、备份版本或跨刷新待保存回执。复习会话与复讲待保存状态在内存中；用户离开时，仅已经成功写入的部分保留。

## 2. 本轮发现并修复的具体问题

### 2.1 解卦重试可能覆盖旧成就

独立审阅复现：先让自评成就写入配额失败，再恢复写入但让该键 `getItem` 抛错，原实现把读取失败当空状态继续保存，旧深读和旧幂等键消失，界面仍称保存成功。隔离原生 Node DOM 夹具记录见 [首次复现](2026-10-25-feedback-readonly-review-repro.json)。这不是浏览器或真机证据。

修复只涉及 `web/js/modes/divination-mode.js` 和 `web/test/divination-replay.test.mjs`：保存前严格检查同一次原始快照，再把该快照交给原成就迁移／写入流程。首次提交与原事件重试都覆盖读失败、坏 JSON、无效旧事件；失败零写入、原始值保全、可见重试，恢复后保存原分数与原时间，成功后旧按钮不重复写。合法 V0 和第二次读取会失败的边界也已覆盖。实际命令、源码哈希及范围见 [严格读修复摘要](2026-10-25-divination-strict-read-summary.json)。

### 2.2 课程考评生命周期与失败反馈焦点

后续独立审阅补齐当前表单／结果的身份检查：离页、重绘或提交后的旧表单、旧取消／结果动作不得再操作新视图；排队焦点先确认页面和目标仍有效。长考评保存失败时由产品显示并聚焦失败状态／重试位置，恢复成功后按当前结果重新定位。

本次六项关键回归先红，再完成限定和关联验证；见 [生命周期／焦点修复摘要](2026-10-25-assessment-lifecycle-focus-summary-v2.json)。十题全错试卷为合成 DOM 夹具，只证明状态与滚动／聚焦意图，真实浏览器的可见性仍由当前矩阵验证。既有成绩 ID、判分、隐私和存储语义不变。

时间边界须分别解释：复习、复讲和解卦锁定本轮评分／原事件时间；课程考评沿现有提交协议，保存重试的 `exam.at` 可能变化，不能把前述三个模块的时间锁定推广成所有业务的断言。考评幂等仍以原会话 ID 和实际保存结果核对。

### 2.3 测验首次保存失败后重试行动超出窄屏

历史 390 触控场景中，失败提示可见，但重试按钮底部为 `857.95px`，超出 `844px` 裁剪下沿；探针在任何主动滚动前判失败。对应回归先为 17 项中 16 通过、1 失败。产品随后在仍属当前题目和当前反馈的前提下，定位实际重试行动并聚焦；关联页面回归为 31/31，见 [焦点红灯](2026-10-25-quiz-feedback-retry-focus-red.log.gz)与[关联绿灯](2026-10-25-quiz-feedback-retry-focus-green.log.gz)。没有改变原题、六项保存协调、同轮重试或判分。

该修复已进入 v3 候选，后续最终 v9 专项已经包含对应真实输入与窄屏几何验收；31 项 DOM 回归与最终专项分别保留，不能相互替代。

### 2.4 解卦首次失败状态在顶部重复、短状态不可见

[390 真实红灯](2026-10-25-learning-feedback-input/2026-10-24T23-15-07-938Z/trace.json)发生在**首次成就写入失败**，尚未执行后续读拒绝重试。`.divine-analysis-status` 在反馈顶部，矩形上沿约 `-137px`、下沿约 `-81px`，处于可见区外；学习记录段另有同文案可见，重试行动也完整可见。因此这是重复状态位置错误，不是读取保护失败，也不是第二次重试的失败。

修复保留原短状态节点身份及 `role="status"`／`aria-live="polite"`，把它移入四段反馈的学习记录段，删除重复文案；每次重绘后继续复用该节点。金钱和梅花新增首次写失败、重试读拒绝、恢复成功的同节点／唯一状态／焦点断言，红灯 34 项中 32 通过、2 失败，修复后五文件关联 61/61。严格读取、原分数／时间、旧证据保全和成功后不重复写的既有回归保持通过。

v3 候选的 `390-divination-save-retry` 已终态 `exit 0`，见[修后真实输入](2026-10-25-learning-feedback-input/2026-10-24T23-18-33-102Z/trace.json)；这只关闭该 scope 的已复现问题。该轮全集已经终止，后续候选状态见 §5.1；真实读屏和整卡验收未由此取得。

### 2.5 复讲依据缺少本轮课程来源和返回行动

完成条件复核发现，[学习专题 §11](../04-learning-library-assessment.md)已要求“引用稳定来源并可定位原课，缺出处明确待校验”，原复讲反馈仅显示课程要点，没有原课标题和可达入口。本次在 `learning-assessment-page.js` 中补齐本轮课程标题、项目课程要点的准确称谓及“回原课温习”，不改 `getLessonRubric`、评阅协议、判分或存储字段，不扩展为 T-READ-03 完整阅读上下文。

动作选择器为 `.oral-review-output [data-action="oral-source"]`，导航使用结果锁定的 `lessonId`，不读取后来选择器的值。成功结果保留一个主行动和一个次行动；保存失败时一个主行动、两个次行动。返回原课不偷补成绩／活动保存、不新增评阅 POST；换课、编辑、转自评、明确新轮、进入小试、重绘中心、cleanup 或结果重绘后，旧来源按钮不能再导航或写入。依据明确写明本结果未附原典出处定位，需回原课核对出处与校验状态，不把项目课程要点称作已校验原典。

新增 12 项页面回归先红：75 项中 63 通过、12 失败；实现后 75/75，四文件关联 97/97，见[来源红灯](2026-10-25-oral-source-red.log)、[页面绿灯](2026-10-25-oral-source-green.log)与[关联绿灯](2026-10-25-oral-source-integration-green.log)。两文件语法检查通过。这些是限定 Node 回归；v6 后续人工截图仍发现长说明继承 `.content-provenance` 标签的 `inline-flex`／不换行样式而截断，说明实际视觉验收不能由这些回归替代。

随后真实输入补充宽度断言，390 场景先红：说明宽 `556.609px`、容器宽 `294px`，计算样式为 `inline-flex`／`nowrap`，见[宽度红灯](2026-10-25-oral-source-width-red.log)与[红灯 trace](2026-10-25-learning-feedback-input/2026-10-24T23-45-41-912Z/trace.json)。修复仅把页面长说明的类改为 `.oral-source-notice`，沿既有普通段落样式，不修改全局 CSS。同 scope 修后 `exit 0`、1/1，说明与容器均宽 `294px`、`block`／`normal`，见[宽度绿灯](2026-10-25-oral-source-width-green.log)、[绿灯 trace](2026-10-25-learning-feedback-input/2026-10-24T23-46-09-038Z/trace.json)及[完整换行截图](2026-10-25-learning-feedback-input/2026-10-24T23-46-09-038Z/390-oral-self-activity-retry-automatic-3.png)。修后另一组四文件关联为 [92/92](2026-10-25-oral-source-width-unit-green.log)，与之前 97 项套件范围不同，不合并或替换其历史数字；最终本地验收另见 §4–§5。

### 2.6 完整门禁暴露三份过时的静态交互契约

[v7 完整 validate](2026-10-25-learning-feedback-v7-final-validate.log)在 `layout-contract.test.mjs` 失败：旧断言只接受反馈本体滚入 `nearest`，没有表达真实保存失败时应把重试行动居中显示。整合者更新为失败行动 `center`／普通反馈 `nearest`，保留当前业务行为，并实际运行测验页面 17/17，见[布局契约修订后关联](2026-10-25-feedback-layout-contract-green.log)。

[v8 完整 validate](2026-10-25-learning-feedback-v8-final-validate.log)随后停在 `learning-ui-contract.test.mjs` 的固定 `heading.focus` 变量名断言。修订后限定在 `resetAssessmentViewport` 内检查选中的同一节点可聚焦，保留默认标题，以及保存失败／缺证据选保存状态、成功选结果段的实际接线。另一份 `mode-result-visibility.test.mjs` 单跑也先为 3 项中 2 通过、1 失败；它仍要求所有反馈只滚本体并聚焦下一题。现改为隔离执行真实定位函数，核验成功／失败与普通／减少动态效果四种组合、先滚动后聚焦、`preventScroll`，以及排队后视图失效／反馈脱离时不滚动、不抢焦点。没有删除这些行为要求，也没有为通过测试修改业务、判分或存储。

修订后的实际命令为 `node --test web/test/learning-ui-contract.test.mjs web/test/mode-result-visibility.test.mjs web/test/quiz-mode-page.test.mjs web/test/learning-assessment-page.test.mjs`，**96/96、exit 0**，见[四文件关联日志](2026-10-25-feedback-contracts-96-green.log)。两个新增修订文件的语法和限定差异检查通过。96 项是限定关联回归；随后 v9 另行运行完整 validate 通过，见 §4，不能把两种范围混算或替代独立浏览器矩阵。

## 3. 自动验证记录及适用范围

各行是独立运行，不相加为一个测试总数。v3 交接时已有 33 份 `.gz` 归档逐一解压并与原日志逐字节核对，其中 27 份当轮新增、6 份已有归档没有覆盖；这些历史归档继续保留。本次新增的原课入口、v4–v9 浏览器记录和契约修订使用实际原始日志／trace 的相对链接，最终归档与纳入提交仍由整合者核对。本地存在和解压一致不表示已同步 GitHub。

| 验证范围 | 已有实际记录 | 证据与说明 |
| --- | --- | --- |
| 复习协调器与引擎 | 契约红灯 24 项：8 通过、16 失败；最小绿灯 24/24；补边界 31/31，退出码均见摘要 | [数据摘要](2026-10-25-review-session-data-summary.json)、[边界绿灯](2026-10-25-review-session-green-boundaries.log.gz)。初始测试误用不存在的统计字段，修正后仍有同样 16 项真实红灯；两份红灯均保留 |
| 复习页面接线 | 页面红灯 13 项：5 通过、8 失败；首绿 13/13；来源返回焦点另有 6 项中 1 项红灯；最终关联 63/63 | [页面摘要](2026-10-25-review-mode-integration-summary.json)、[最终关联日志](2026-10-25-review-mode-integration-final.log.gz) |
| 复讲生命周期与保存 | 原红灯 70 项：49 通过、21 失败；后续四段及生命周期关联 72/72 | [原红灯](2026-10-25-oral-session-red.log.gz)、[四段红灯](2026-10-25-oral-feedback-red.log.gz)、[72 项绿灯](2026-10-25-oral-session-green.log.gz)。中间夹具返回值修正轮次保留在 [首次绿灯尝试](2026-10-25-oral-session-green-initial.log.gz) |
| 复讲初次结果焦点 | 补充红灯 57 项：55 通过、2 失败；关联绿灯 75/75 | [焦点红灯](2026-10-25-oral-result-focus-red.log.gz)、[焦点绿灯](2026-10-25-oral-result-focus-green.log.gz) |
| 复讲原课来源与动作 | 新增 12 项回归：红灯 75 项中 63 通过、12 失败；页面绿灯 75/75；四文件关联 97/97 | [红灯](2026-10-25-oral-source-red.log)、[页面绿灯](2026-10-25-oral-source-green.log)、[关联绿灯](2026-10-25-oral-source-integration-green.log)。覆盖锁定课程、失败离开不补保存／POST、旧按钮失效和行动数量；不证明窄屏长说明未截断 |
| 复讲长说明换行修复后关联 | 另一组四文件 92/92、`exit 0`；390 真实输入宽度断言由 0/1 转 1/1 | [92 项日志](2026-10-25-oral-source-width-unit-green.log)、[浏览器红灯](2026-10-25-oral-source-width-red.log)、[浏览器绿灯](2026-10-25-oral-source-width-green.log)。单场只证明对应视口／流程，不代替 51 项最终矩阵 |
| 自由测验四段接线 | 红灯 17 项：13 通过、4 失败；绿灯 17/17 | [红灯](2026-10-25-quiz-feedback-red.log.gz)、[绿灯](2026-10-25-quiz-feedback-green.log.gz)。保留原六项保存协调，不将模板测试视为新浏览器通过 |
| 测验重试行动焦点修复 | 红灯 17 项：16 通过、1 失败；关联页面绿灯 31/31 | [红灯](2026-10-25-quiz-feedback-retry-focus-red.log.gz)、[关联绿灯](2026-10-25-quiz-feedback-retry-focus-green.log.gz)。针对 390 真实失败补回归，不改六项保存协议 |
| 解卦四段、生命周期、行动 | 原四段红灯及随后生命周期、旧证据缺失、主行动可见性红灯保留；关联五文件 52/52 | [原红灯](2026-10-25-divination-feedback-red.log.gz)、[生命周期红灯](2026-10-25-divination-feedback-lifecycle-red.log.gz)、[缺旧证据红灯](2026-10-25-divination-feedback-missing-evidence-red.log.gz)、[行动定位红灯](2026-10-25-divination-feedback-action-visibility-red.log.gz)、[关联绿灯](2026-10-25-divination-feedback-green-final.log.gz) |
| 解卦严格读取修复 | 红灯 32 项：26 通过、6 失败；关联五文件 59/59；两文件语法与限定 diff 检查通过 | [摘要](2026-10-25-divination-strict-read-summary.json)、[红灯](2026-10-25-divination-strict-read-red.log.gz)、[绿灯](2026-10-25-divination-strict-read-green.log.gz) |
| 解卦唯一状态位置修复 | 红灯 34 项：32 通过、2 失败；关联五文件 61/61，退出码分别 1／0；两文件语法通过 | [红灯](2026-10-25-divination-status-location-red.log.gz)、[绿灯](2026-10-25-divination-status-location-green.log.gz)。原状态节点身份和短播报语义保留；限定 DOM 回归不证明真实读屏 |
| 考评生命周期／长结果焦点 | 红灯 63 项：57 通过、6 失败；同文件绿灯 63/63；四文件关联 87/87，均已终态 | [摘要](2026-10-25-assessment-lifecycle-focus-summary-v2.json)、[红灯](2026-10-25-assessment-lifecycle-focus-red-v2.log.gz)、[关联绿灯](2026-10-25-assessment-lifecycle-focus-integration-v2.log.gz) |
| main 占筮 cleanup 接线 | 红灯 20 项中 1 项失败；修复后 20/20 | [红灯](2026-10-25-feedback-cleanup-red.log.gz)、[绿灯](2026-10-25-feedback-cleanup-green.log.gz) |
| 核心预缓存静态依赖 | 红灯 5 项中 1 项失败；补 `learning-feedback.js` 后 5/5 | [红灯](2026-10-25-feedback-precache-red.log.gz)、[绿灯](2026-10-25-feedback-precache-green.log.gz) |
| 结果可见性契约 | 旧契约 3 项中 1 项失败，调整为四段内真实状态位置后 3/3 | [原记录](2026-10-25-feedback-visibility-integration.log.gz)、[绿灯](2026-10-25-feedback-visibility-green.log.gz)。该旧红灯不登记为当前产品缺陷 |
| 最终门禁中的三份旧契约 | v7 停布局契约、v8 停固定标题变量断言；后续单跑可见性契约 2/3。三份修订后，四文件关联 96/96、`exit 0` | [v7 失败日志](2026-10-25-learning-feedback-v7-final-validate.log)、[v8 失败日志](2026-10-25-learning-feedback-v8-final-validate.log)、[96 项绿灯](2026-10-25-feedback-contracts-96-green.log)。之后 v9 完整 validate 通过，详见 §4；历史失败保留 |

## 4. 覆盖率、运行依赖与完整门禁

`package.json` 的覆盖率显式集合由 21 个增加到 **23 个模块**，增加 `learning-feedback.js` 与 `review-session.js`。这是所配置纯逻辑模块集合的覆盖率，不是全部业务页面、浏览器交互或全项目覆盖率。

已有一次整合日志记录 **75 个质量脚本通过，覆盖率阶段 602/602，23 模块行 99.72%、分支 93.95%、函数 99.01%**，见 [当时 validate 日志](2026-10-25-feedback-integration-validate.log.gz)。这次运行先于本文件所述后续严格读取与考评生命周期修复，不能当作当前最终源码的完整门禁。两个新增模块还单独完成 24/24、行 100%、分支 92.66%、函数 100%，见 [新增模块计量](2026-10-25-feedback-new-coverage.log.gz)；这也是限定集合。

`web/sw.js` 已将 `learning-feedback.js` 放入首屏核心依赖预缓存，因为现有核心评阅页面静态导入它。`review-session.js` 由按需复习页面引用，沿既有按访问缓存路径；不把这次静态依赖检查写成所有可选功能首次离线已完成。缓存代数／版本是否需随最终发布更新，由原分发任务按最终 diff 判断，本卡未另造版本规则。

v9 完整 `npm run validate` 已实际 `exit 0`，见 [v9 全量日志](2026-10-25-learning-feedback-v9-final-validate.log)：**75 个质量脚本通过，覆盖率阶段 629/629，23 个显式模块行 99.72%、分支 93.90%、函数 99.01%**。v7／v8 的 `exit 1` 是此前旧测试契约失败，原日志保留；限定 96 项与 v9 全量结果分别登记。该通过适用于 v9 源码，不自动覆盖后续改动。

v9 完整 `npm run test:e2e` 已实际 `exit 0`，见 [E2E 日志](2026-10-25-learning-feedback-v9-final-e2e.log)。[截图目录](../../screenshots/smoke-2026-10-24T23-57-41-417Z/)已实际核数为 **25 张 PNG**，覆盖 1440×1024、1280×720、768×1024、390×844、320×844，日志确认鼠标／键盘／CDP 触控研读、减少动态效果与 WebGL 降级通过。此范围不等于 51 项反馈专项，也不是手机真机、屏幕阅读器或原生浏览器 200% 缩放证据。

独立浏览器专项随后完成 51/51，并生成可复制证据包，见 §5.3。上述结果构成本卡本地验收记录；提交与 GitHub 同步另行登记，不用历史 602 项、此前测验交付的 515/515、18 项专项或旧五视口截图替代本卡验证。

## 5. 浏览器矩阵：历史 33 项与最终 51/51

独立脚本为 `scripts/test-learning-feedback.mjs`。历史设计为 16 类场景分别覆盖 1440 桌面与 390 CSS px 触控模拟，共 32 个 scope，再加从 320 CSS px 开始流程的 `320-quiz-save-retry`。当时解卦只操作 `coin-cast`，不含梅花真实输入。该 33 项集合与下述失败属于历史证据，不能再作为当前候选矩阵的范围或终态。

v3 起扩为 **51 个 scope**，v5／v6 在既有复讲场景内补原课入口真实输入，v7 增加长说明横向溢出断言，均不另增加 scope 数量。v6 主动中止，v7／v8／v9 此前批次也曾因宿主中止结束；之后同源码累计 12 项，再由最终批次完成另外 39 项，接受集现为 51/51。范围组成如下：

| 视口与输入 | 计划范围 | 数量与边界 |
| --- | --- | --- |
| 1440×1024 鼠标／键盘、390×844 CDP 触控 | 原 16 类加梅花数字起卦结果／保存重试、简化公历时间起卦结果／保存重试，共 20 类 | 40 项；新增梅花共 8 项，使用实际页签、数字输入及现有时间起卦按钮，不能据此宣称时间算法改造完成 |
| 320×844 CDP 触控 | `quiz-save-retry` 从窄屏开始，首次失败后先检查产品自动显示的提示与行动 | 1 项；不是 20 类在 320 的完整矩阵 |
| 1280×720 鼠标／键盘、768×1024 CDP 触控 | 每视口测验保存重试、考评保存重试、复讲自评成绩保存重试、复习卡保存重试、梅花数字保存重试 | 10 项；每视口 5 类代表流程，不冒称所有流程、梅花时间入口均覆盖这些尺寸 |

原 16 类涵盖复习卡／活动／成就分项失败及离页，复讲本地成绩／活动失败、智能评阅保存重试与换课／改原文／离页迟到，课程考评结果／保存重试，自由测验结果／保存重试及金钱解卦结果／保存重试。金钱和梅花保存专项沿用“先写失败，再恢复写但拒绝读取，最后恢复读取”的原事件恢复路径。最终 51 项已按清单去重并逐项校验，通过依据为 §5.3 的接受清单及原 trace，而非各历史批次数字相加。

输入与证据边界：

- 使用隔离 profile 与来源，真实 CDP Input 鼠标／键盘／触控；不调用浏览器业务函数或 DOM `click()` 验收。
- 配额、读取失败、课程／历史夹具和 AI Fetch 响应是明确的合成注入。AI 响应在网络发送前截获，不检验实际后端、真实模型质量或外部评阅部署，不发送私人正文。
- 先记录产品自动显示的结果、失败说明和行动位置，再允许定位器滚动。记录真实命中、焦点、存储写入、请求次数和源哈希；截图不能替代状态断言。
- 证据保存在 [输入证据目录](2026-10-25-learning-feedback-input/)，每轮保留独立 `trace.json`、`run.log`、截图与源码快照。尚在运行的轮次、不同源码的轮次和中止记录不能合并报“51/51”；复用历史通过项前必须逐项核对所观察源码与最终候选一致。
- 已有完整矩阵尝试在 `1440-review-card-retry` 通过、开始下一场景后出现 Node/libuv 原生断言 `new_time >= loop->time`，见 [宿主中止日志](2026-10-25-feedback-browser-all-1.log.gz)和[该轮运行记录](2026-10-25-learning-feedback-input/2026-10-24T22-59-41-740Z/run.log.gz)。它不是全矩阵成功，也不能直接归因于应用；保留原状态，由整合者确认进程终态后安排后续有限运行。

**历史盘点记录**：此前两批 33 个场景中 29 通过、1 真实失败、3 未跑，详见[逐场汇总](2026-10-25-remaining-work-feedback-scope-status.json)；两批 38 次进程中的 8 次宿主中止另记，不改为产品结果。当时的 390 测验失败现已有 §2.3 的修复与关联绿灯，随后首次解卦失败现有 §2.4 的修复与单场真实绿灯。历史数字和未跑项不能直接沿用为后续 51 项候选结果；后续 v9 完整 E2E 与 validate 结果另见 §4。

### 5.1 v3–v9 的终态与证据适用范围

| 候选 | 本轮实际记录 | 原因与后续边界 |
| --- | --- | --- |
| [v3 源码](2026-10-25-learning-feedback-final-source-v3.json) | [批次汇总](feedback-final-batch-20261024-231832/summary.json)共 31 次终态尝试：26 个不同 scope 通过、4 次宿主中止、1 次 scope 失败 | 最后 `1440-meihua-time-result` 未能打开占筮页，`exit 1`，见[失败 trace](2026-10-25-learning-feedback-input/2026-10-24T23-22-56-480Z/trace.json)。该轮已终止，不是仍在运行；不能将动态加载／服务失败未定位的记录直接改判为产品成功 |
| [v4 源码](2026-10-25-learning-feedback-final-source-v4.json) | [批次汇总](feedback-final-v4-20261024-233203/summary.json)共 14 次终态尝试：11 个不同 scope 通过、3 次宿主中止 | 增加服务、网络与 Service Worker 观测，未更改业务。`390-oral-ai-stale-leave` 连续两次 Node 原生中止（`-1073740791`），批次 session81654 最终 `exit 1`；见[第一次日志](feedback-final-v4-20261024-233203/390-oral-ai-stale-leave-1.log)和[第二次日志](feedback-final-v4-20261024-233203/390-oral-ai-stale-leave-2.log) |
| [v5 源码](2026-10-25-learning-feedback-final-source-v5.json) | 原课入口新增后首个 `1440-oral-self-record-retry` 为 0/1、`exit 1`，见[日志](2026-10-25-feedback-v5-first-oral-source.log)及[trace](2026-10-25-learning-feedback-input/2026-10-24T23-42-06-327Z/trace.json) | 探针第二次进入考评时把已记忆的课程页当成学习首页，找不到 `[data-section-target="assessment"]`。修正为真实 `.lesson-back → profile → assessment` 路径；只改探针，不以此修改课程记忆行为 |
| [v6 源码](2026-10-25-learning-feedback-final-source-v6.json) | 首次单场出现 `new_time >= loop->time` 原生中止；同源码有限重跑 `1440-oral-self-record-retry` 1/1、`exit 0`。随后 `390-oral-self-activity-retry` 也实际通过 | 保留[首次中止日志](2026-10-25-feedback-v6-first-oral-source.log)、[同源码重跑日志](2026-10-25-feedback-v6-first-oral-source-retry.log)、[桌面重跑 trace](2026-10-25-learning-feedback-input/2026-10-24T23-43-12-168Z/trace.json)和[390 trace](2026-10-25-learning-feedback-input/2026-10-24T23-43-49-534Z/trace.json)。中止时 trace 留有 `running` 不能据此称进程仍活跃或通过；该进程已终止 |
| [v7 源码](2026-10-25-learning-feedback-final-source-v7.json) | 390 长说明单场复验通过；[批次汇总](feedback-final-v7-20261024-234638/summary.json)共 12 条记录，含 1 条复用单场与 11 次新尝试，10 个不同 scope 通过 | `1440-oral-ai-stale-course` 两次 `-1073740791` 原生中止，批次已终止；见[第一次日志](feedback-final-v7-20261024-234638/1440-oral-ai-stale-course-1.log)与[第二次日志](feedback-final-v7-20261024-234638/1440-oral-ai-stale-course-2.log)。关联 Node 92/92 不代替完整矩阵 |
| [v8 源码](2026-10-25-learning-feedback-final-source-v8.json) | [批次汇总](feedback-final-v8-20261024-235019/summary.json)共 13 条记录：10 条复用 v7 通过项、3 次新尝试；新增 `1440-oral-ai-stale-course` 通过，该批次累计 11 个不同 scope | `1440-oral-ai-stale-edit` 两次 `-1073740791` 原生中止，批次已终止；见[第一次日志](feedback-final-v8-20261024-235019/1440-oral-ai-stale-edit-1.log)与[第二次日志](feedback-final-v8-20261024-235019/1440-oral-ai-stale-edit-2.log)。不能把两批 10 与 11 项相加为 21，也不能把宿主中止判为产品成功 |
| [v9 源码](2026-10-25-learning-feedback-final-source-v9.json) | [批次汇总](feedback-final-v9-20261024-235710/summary.json)共 13 条记录：11 条复用通过项、2 次新尝试，没有增加通过数 | `1440-oral-ai-stale-edit` 再次连续两次 `-1073740791` 原生中止，批次终态 `exit 1`；见[第一次日志](feedback-final-v9-20261024-235710/1440-oral-ai-stale-edit-1.log)与[第二次日志](feedback-final-v9-20261024-235710/1440-oral-ai-stale-edit-2.log)。宿主时钟断言正在排查；v9 validate 通过不改变本批次失败终态 |
| v9 最终续跑 | [最终批次汇总](feedback-final-v9-node22-20261024-235906/summary.json)共 57 条记录：12 条复用通过、39 次新增通过、6 次 Native 失败；最终 51 个不同 scope 通过 | session81090 已终态 `exit 0`。57 条含复用记录，不等于 57 个新运行或 57 个场景；6 次失败和此前各轮失败均保留，不因最终成功删除或改判 |

v6 [批次汇总](feedback-final-v6-20261024-234349/summary.json)保留 7 个不同 scope 的通过记录，其中桌面原课场景复用同源码单场通过。人工复核 [390 复讲出处截图](2026-10-25-learning-feedback-input/2026-10-24T23-43-49-534Z/390-oral-self-activity-retry-automatic-3.png)发现新长说明横向截断；原有断言未覆盖这处宽度问题，因此这些 scope 的通过不表示该视觉问题通过。整合者随后用 Ctrl-C 主动终止 batch24754（`exit 1`），保留所有已跑记录。v7 已有 §2.5 的修前红灯与单场绿灯，后续同源码范围为下列 11 项。

### 5.2 可复用证据的精确范围

逐一读取 v8 汇总指向的 11 份通过 trace：每份 `sourceHashes` 与 `finalSourceHashes` 均含相同 31 文件，`sourceStableDuringRun=true`、`exitCode=0`、页面异常 0；这 31 个文件也与本轮核对时的工作区一致。v8 整份快照仅增加布局测试契约修订，后续两份测试修订同样没有改变浏览器观测文件。这是 31 文件内的复用依据，不是全部仓库或最终提交一致性证明。

11 项分别为：390 复讲自评活动保存重试；1440／390 智能评阅保存重试；390 智能评阅离页迟到；1440 复习卡／活动／成就分项重试和离页；1440 复讲自评成绩／活动保存重试；1440 智能评阅换课迟到。最后一项的新增终态见 [v8 换课通过 trace](2026-10-25-learning-feedback-input/2026-10-24T23-50-19-746Z/trace.json)。其他场景由 v8 汇总引用各自原 trace。

v3–v6 因页面或探针版本不同仍只作为历史证据，包括已有的梅花真实输入；没有直接并入当时的 11 项。当时剩余 40 项表示“尚无当前候选接受通过记录”，不等同于 40 个业务缺陷，也不表示历史上从未运行。v9 首批仅修订两份测试并复用原 11 项，没有增加通过数；后续增量分别记录如下。

**续跑增量**：`1440-oral-ai-stale-edit` 随后在 Node `v22.23.1`／libuv `1.51.0` 单场实际 `exit 0`，见[通过 trace](2026-10-25-learning-feedback-input/2026-10-24T23-58-39-975Z/trace.json)。前后 31 项哈希与上述接受集及当前工作区一致，`sourceStableDuringRun=true`、页面异常 0，故续跑开始前累计为 12/51。这个成功不证明更换 Node 版本治愈原生时钟断言；原失败仍保留，宿主原因继续单独调查。

整合者启动 [v9 Node22 续跑批次](feedback-final-v9-node22-20261024-235906/summary.json)（session81090），以 12 项为起点完成剩余 39 项，现已终态 `exit 0`。接受集共 50 项 Node `v22.23.1`／libuv `1.51.0`、1 项 Node `v24.19.0`／libuv `1.52.1`，不是单一运行环境。跨环境复用依据仍为逐文件源码一致和各自真实终态，不能推出原生断言已治愈。

### 5.3 最终专项证据包与校验

已实际运行收集 helper 并 `exit 0`。它从最终汇总为每个预期 scope 选择唯一成功 trace，逐一核对 trace／scenario 的成功状态、`exit 0`、`sourceStableDuringRun=true`、前后 31 个观测文件及最终快照哈希、页面异常 0，才打包对应的 trace、运行／服务日志和实际截图；未读取或包含浏览器 profile 目录。

| 文件 | 内容与实际校验 |
| --- | --- |
| [专项 ZIP](2026-10-25-learning-feedback-final-browser.zip) | `15,669,342` 字节，295 个 ZIP entry（含 manifest）；51 scope、138 张专项 PNG。只包含接受集与收集元数据，历史失败仍留在各自原位置 |
| [接受清单](2026-10-25-learning-feedback-final-browser.manifest.json) | 51 个唯一 scope、31 个观测文件；逐项列出选用 trace、运行环境、时间、文件名和 SHA256，共 294 个 artifact，已由独立 ZIP 读取逐项核对 |
| [校验和](2026-10-25-learning-feedback-final-browser.sha256) | ZIP SHA256 为 `bfbbd8a95a02e74a049c2349592c0bdcc41e3f0891f22e1de99b87f5714424b0`，同时记录清单校验和 |
| [独立 ZIP 读取核验](2026-10-25-learning-feedback-archive-check.json) | 使用 `.NET System.IO.Compression.ZipFile` 独立读取 295 entry、核对 294 artifact，`issues: []`；不是只检查 ZIP 文件存在 |
| [最终验收汇总](2026-10-25-learning-feedback-final-acceptance.json) | 171 文件源码守卫无变化；51 scope 的最终输入均可信、拦截请求均结束、页面异常 0；同时记录 validate／E2E、独立审阅及未验证边界 |

专项包与完整 E2E 的 25 张截图是不同范围，不相互替代。源文件快照、所有原红灯、宿主中止、探针前置错误及修复后的通过证据继续保留；本包不宣称包含历史目录全部文件。

## 6. 未关闭的边界与后续工作

1. 本卡 51 项专项、v9 完整 validate 和 E2E 已通过，171 文件源码守卫无变化；整合者保持该快照与交付文件对应，登记实际提交、GitHub 同步及远程 CI。若后续改变影响范围，再运行相应门禁。
2. 执行卡、总册、未完成清单和相关专题由整合者更新；历史红灯、宿主中止及修复后的证据完整保留，所有交付链接必须随项目复制可用。本文不预填提交 SHA、push 或远程 CI 结果。
3. 手机真机、屏幕阅读器、原生浏览器真实 200% 缩放、专项性能及 Windows 重建等证据留在各自原任务卡。390／320 CSS px、CDP 触控、合成 DOM 焦点、普通 E2E 和本卡通过不能冒充这些验收。

本卡不关闭 T-DIV-02 三路径／结构化五步挑战、T-DIV-03 正式阅读／梅花时间来源与时区提示、T-SOUND-01/02 声音语义与素材、T-API-01 建议协议加固、长期容量或首次离线等原任务。历法、六位编码、判分、调度、内容发布门禁及私人数据边界保持原规则；不新增账号、云同步、数据库或业务后端。

## 7. 最终验收状态与交付登记

| 门槛 | 当前状态 | 最终需补证据 |
| --- | --- | --- |
| 独立浏览器专项 | 最终 51/51、批次 `exit 0`；295 entry 证据包及独立读取校验通过 | 接受清单已记录各自环境、31 文件哈希与 138 张专项截图；历史失败保留 |
| 最终 validate | v9 `exit 0`：75 脚本、629/629；23 模块行 99.72%、分支 93.90%、函数 99.01% | 已有日志与 v9 快照；最终交付前核对后续改动是否仍适用 |
| 完整 E2E | v9 `exit 0`，五视口、25 PNG；具体输入／降级范围见 §4 | 已有日志和截图目录；真机／读屏／原生 200% 等未验项保留 |
| 最终源码一致性 | 171 文件守卫通过、`changed: []`；51 scope 的 31 文件均匹配 | [最终验收汇总](2026-10-25-learning-feedback-final-acceptance.json)；提交时保持对应关系 |
| 本地交付／GitHub 同步 | 本地验收完成，提交与远程结果待登记 | 实际提交、推送、PR／清单及对应远程 CI；与生产发布分开 |
| T-LEARN-03 状态 | 本地验收完成；执行卡与 GitHub 状态由整合者按实际交付更新 | 不以本卡关闭其他原任务或外部验证缺口 |
