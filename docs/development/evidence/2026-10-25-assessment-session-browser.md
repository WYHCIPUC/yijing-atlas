# T-LEARN-05：考评轮次、幂等保存与重试的浏览器证据

记录日期：2026-10-25（Asia/Shanghai）。目录使用 UTC 时间戳，因此目录日期为 2026-10-24。

本报告只接受下述课程考评场景，不代表整站、全部学习任务、真实手机或发布验收完成。没有修改应用业务源码；本次新增探针及证据，沿用已经在工作区修复、尚未提交的考评契约。

## 1. 本轮结论与版本边界

- 最后一轮：**9/9 场景通过，进程退出码 0**。Node v24.19.0，Edge 155.0.4283.62，独立静态服务器、隔离 profile、无头 Chromium。
- [最后一轮 trace](2026-10-25-assessment-session/2026-10-24T19-08-32-744Z/trace.json) 保存 `sourceHashes`、`finalSourceHashes`、实际输入、完整状态快照和断言标签；[运行日志](2026-10-25-assessment-session/2026-10-24T19-08-32-744Z/run.log) 保存 9 项结果。
- `sourceStableDuringRun: true`，未捕获页面异常 `pageErrors: []`，浏览器日志 `browserLogs: []`。这只说明探针观察的文件在本轮期间未变化，不等同于整个共享工作区被冻结。
- 运行时 HEAD 为 `1bee1c210d675d8aa49df23c0724ba577ad8cf6d`，**接受对象包含未提交修复**，不能把该 HEAD 的纯提交版本单独称为已通过。以 trace 的源文件 SHA-256 为准确边界。
- 第 4 轮也完整通过 9/9；第 5 轮 Node 24 原生中止保留，不覆盖、不伪装为页面失败。第 6 轮是加入键盘可信事件记录后的最终通过版本，探针至此冻结。
- 追加执行 `node --check scripts/test-assessment-session.mjs`，退出码 0。全量 `validate`、标准 `test:e2e` 和 CI 由集成验收另行记录，本探针不替代它们。

观察文件包括 `learning-progress.js`、`learning-assessment.js`、`learning-assessment-page.js`、`modes/learning-mode.js`、`user-data.js`、`study-page.js`、`achievement-engine.js`、`achievement-storage.js`、`theorems.json`、`trigrams.json` 以及探针自身。最后一轮探针 SHA-256：`f00f3d8e697392e230d29514d7f1d9dda5a67c5be4e6ae80b54de2a9fad5091e`。

## 2. 复现命令与输入方法

从项目根目录执行：

```powershell
& 'C:\Users\1\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' scripts/test-assessment-session.mjs
& 'C:\Users\1\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --check scripts/test-assessment-session.mjs
```

普通环境也可使用满足 Node 22+ 要求的 `node scripts/test-assessment-session.mjs`。本机 Node 22 和 Node 24 均出现过下文所列原生计时断言，备用运行时不是已经根治该环境问题的证明。未安装新运行时、未修改全局 Node 配置。

探针位于 [`scripts/test-assessment-session.mjs`](../../../scripts/test-assessment-session.mjs)。它从现有 Edge/Chrome 路径查找浏览器，允许 `BROWSER_PATH` 指定已安装浏览器。可用 `YIJING_ASSESSMENT_EVIDENCE_DIR` 指定输出目录；默认按 UTC 时间戳创建新目录。当前探针会保留隔离 profile，不执行删除。

所有业务入口、答题、交卷、重试、返回及修习谱切换都使用 CDP `Input.dispatchMouseEvent`、`Input.dispatchTouchEvent` 或 `Input.dispatchKeyEvent`。没有调用 DOM `click()`，没有直接调用开始考试、判分、保存或渲染等业务函数。几何查询、`elementFromPoint` 命中核对和滚入可见区域用于定位输入；等待实际 DOM 条件，不用增加固定动画延迟掩盖失败。

为了稳定作答现有随机题，探针在真实 `createAssessmentSession` 返回后的下一行设置只读 Debugger 断点，仅读取局部 `session` 中的公开题目、选项和答案，立即恢复执行。它没有通过断点修改业务变量或调用业务函数；该观察会短暂停顿执行，因此这里不作计时或性能验收。

最终 trace 中，9 个场景共记录 **89 次可信点击、9 次可信 keydown、12 次可信 submit**，均 `isTrusted: true`。三个 390 场景记录的点击全部为 `pointerType: touch`。另有单独发送并记录耗时的快速双鼠标输入；不能把第二次输入描述成第二次成功交卷事件。

## 3. 场景与可观察结果

| 场景 ID | 实际路径及结果 | 边界 |
|---|---|---|
| `1440-normal-unanswered-double-new-round` | 五阶学程 → l1-4 小试；未答交卷显示第 1 题提示，焦点移至 `question-0`，没有学习记录写入。原生方向键、Tab、空格完成选项；37 ms 内两次鼠标按下/抬起只保存一轮。结果在 1280×720 改尺寸后仍属同一轮；进入修习谱并回考评中心不重复计分；重新开始产生新 ID，尝试次数和八卦轮次均变为 2。 | 1440×1024 鼠标与键盘；37 ms 是该次驱动采样，不是产品时延指标。 |
| `1440-empty-and-insufficient-real-pool` | 未浏览课程时抽查显示“先浏览一课”，无记录。实际打开 l1-1 课程，使用课程返回按钮回学程，再进抽查；现有题池只有 4 题，界面显示 4 题，保存 `total: 4`，不补造第 5 题。 | 使用真实题池和真实浏览入口，没有改题库夹具。 |
| `1440-grade-retry` | 只使成绩键写入抛出配额异常；结果和答案仍可读，提示成绩未保存并提供重试。故障仍在时重试会重显结果，不重复已经成功的写入；解除故障后实际点重试，只保存一份本轮成绩和对应证据。 | 可控存储故障，非真的磁盘配额耗尽。 |
| `1440-achievement-retry` | 只使成就键写入失败；成绩先保存，提示成就证据未保存。失败重试与恢复重试都不增加成绩次数、活动次数或重复事件。 | 同上。 |
| `390-grade-retry` | 手机模拟触控完成同一成绩失败、失败重试、恢复重试路径；结果和重试按钮可见、可触达。 | 390×844 模拟触控，非真机。 |
| `390-achievement-retry` | 手机模拟触控完成同一成就失败和恢复路径，不重复成绩或事件。 | 390×844 模拟触控，非真机。 |
| `390-normal-touch` | 触控从学习入口开始 l1-4，小试答题与交卷完成，正式 ID、真实成绩明细、成绩事件均各出现一次。 | 所有记录点击均为可信 touch。 |
| `1440-known-id-without-receipt` | 真实生成考试后置入仅有该 `processedAssessmentIds` 的旧数据夹具；实际答题交卷后提示“本轮标识已处理，未重复计分；旧记录未保留本轮成绩明细，无法补记成就证据。当前答案仅供核对。”无保存重试入口；旧记录不变，无成绩、活动、成就写入，进修习谱也不补造成就。 | 合成缺凭据记录；当前分数展示供核对，不宣称它是旧成绩。 |
| `1440-tampered-option-fixture` | 正常选择后把第 2 题选中 radio 的值故意改为 `999`；真实交卷被拒绝，提示第 2 题并聚焦 `question-1`，无记录/写入。恢复原选项值后真实交卷成功。 | DOM 故障注入，单列为非法输入验证，不是普通用户操作。 |

四个保存失败场景恢复后的共同断言：成绩成功写入 1 次、活动写入 1 次、成就成功写入 2 次（课程完成与本轮考评各一事件）、本轮 ID 与 receipt 各 1 个、八卦学习轮次 1 次。这里的两次成就写入是两个不同业务事件，不是重复计分。

“结果重显”的浏览器证据来自实际保存重试按钮触发的结果重绘，以及视口变化后的结果保留。离开考评页后，当前产品没有恢复上次结果的公开入口；本轮没有伪造该入口。直接再次调用结果渲染的幂等性仍属于单元测试证据，不能写作真实用户恢复路径已通过。

## 4. 全部尝试记录

| 次数 / UTC 目录 | 运行时及结果 | 定性与证据 |
|---|---|---|
| 1 / `19-02-18-337Z` | Node 22.23.1；0 个场景完成、1 个开始；原生中止，exit 1。 | [原生中止记录](2026-10-25-assessment-session/2026-10-24T19-02-18-337Z/native-abort.txt)；[最后快照](2026-10-25-assessment-session/2026-10-24T19-02-18-337Z/trace.json)。没有接受任何场景。 |
| 2 / `19-03-09-232Z` | Node 22.23.1；1 个通过、第 2 个探针失败，exit 1。 | [日志](2026-10-25-assessment-session/2026-10-24T19-03-09-232Z/run.log)与[快照](2026-10-25-assessment-session/2026-10-24T19-03-09-232Z/trace.json)：课程详情本来隐藏学习页签，探针错误地寻找尺寸为零的 `#learning-tab-profile`。仅修正探针，先实际点击 `.lesson-back`，再进入修习谱/考评。没有据此改业务代码或加任意延迟。 |
| 3 / `19-04-23-168Z` | Node 22.23.1；6 个通过、第 7 个开始后原生中止，exit 1。 | [原生中止记录](2026-10-25-assessment-session/2026-10-24T19-04-23-168Z/native-abort.txt)与[快照](2026-10-25-assessment-session/2026-10-24T19-04-23-168Z/trace.json)。保留完成的局部观察，但整轮不通过。 |
| 4 / `19-06-00-806Z` | Node 24.19.0；9/9，exit 0。 | [日志](2026-10-25-assessment-session/2026-10-24T19-06-00-806Z/run.log)、[trace](2026-10-25-assessment-session/2026-10-24T19-06-00-806Z/trace.json)，源文件稳定，无页面异常。该版已有原生键盘操作，尚未额外持久化全局 keydown 可信记录。 |
| 5 / `19-07-40-045Z` | Node 24.19.0；0 个完成、1 个开始后原生中止，exit 1。 | [原生中止记录](2026-10-25-assessment-session/2026-10-24T19-07-40-045Z/native-abort.txt)与[快照](2026-10-25-assessment-session/2026-10-24T19-07-40-045Z/trace.json)。仅增加探针键盘观察，应用源码未变；不是产品失败，也证明该原生问题并非只发生在 Node 22。 |
| 6 / `19-08-32-744Z` | Node 24.19.0；9/9，exit 0。 | [最终日志](2026-10-25-assessment-session/2026-10-24T19-08-32-744Z/run.log)、[最终 trace](2026-10-25-assessment-session/2026-10-24T19-08-32-744Z/trace.json)，包含可信键盘证据，源文件稳定，无页面异常。之后不再增加观察字段或重跑。 |

原生 stderr 为 `Assertion failed: new_time >= loop->time`，位置在 libuv Windows `core.c:327`；Node 22 路径为 `c:\ws\deps\uv\src\win\core.c`，Node 24 路径为 `src\win\core.c`。这类进程中止不会进入 JavaScript `finally`，所以原始 trace 保留 `running`；对应 `native-abort.txt` 已标明实际退出码，它不表示进程仍在运行。未把中止轮次归为完整浏览器验收。

## 5. 截图检查与资料位置

最终轮保留 13 张截图，包含桌面正常结果、空态、4 题抽查结果、桌面和模拟手机两种失败与恢复、手机正常结果以及缺 receipt 提示。已实际打开检查以下两张：

- [390 成绩保存失败](2026-10-25-assessment-session/2026-10-24T19-08-32-744Z/390-grade-retry-save-failed.png)：分数、失败说明和“重试保存本轮记录”可见。
- [1440 已处理 ID 缺 receipt](2026-10-25-assessment-session/2026-10-24T19-08-32-744Z/1440-known-id-without-receipt-missing-receipt-message.png)：无法补记证据的说明可读，无重试保存按钮。

这些截图支持指定状态，不构成整个页面所有滚动位置或全部样式的视觉验收。第 4 轮对应两张也曾检查；保留其历史资料，不覆盖为最新截图。

## 6. 隔离 profile 与清理限制

第一轮曾尝试删除已经校验父目录和前缀的专用临时 profile，自动审批返回 `rejected: blocked by policy`，没有提供更细理由。该删除没有执行。随后明确要求保留，未改命令、路径或工具绕过拒绝，也没有再请求同一删除。

保留的路径：

- 第 1 轮：`C:\Users\1\AppData\Local\Temp\yijing-assessment-session-07hXlq`。
- 第 3 轮：`C:\Users\1\AppData\Local\Temp\yijing-assessment-session-OzYS8K`。
- 第 4 轮：`C:\Users\1\AppData\Local\Temp\yijing-assessment-session-NCYkLD`。
- 第 5 轮：`C:\Users\1\AppData\Local\Temp\yijing-assessment-session-EHy4wj`。
- 第 6 轮：`C:\Users\1\AppData\Local\Temp\yijing-assessment-session-cCVfQf`。

第 2 轮启动于保留要求之前，原探针 `finally` 清理了它自己的 profile，原 trace 如实记录 `profileRemoved: true`；它不是对第一轮被拒删除的重试。之后各轮都不执行删除。正常完成的探针停止自己启动的浏览器和服务器；未关闭用户浏览器或其他代理的服务。

以上 profile 只含隔离测试夹具；证据已放入项目目录，复制项目不依赖这些临时目录，也不需要复制它们。实际用户浏览器学习数据未被访问或改写。

## 7. 尚未取得的证据

- 真实手机、屏幕阅读器、真实浏览器 200% 缩放未由本探针验证。
- 未验证其他全部浏览器、长期容量、整个备份导入界面、阶段考评和综合考评的新业务入口；本次没有扩展这些需求或代替其任务卡。
- 本探针不接受全站端到端、Windows 分发包或远程发布。集成门禁与 GitHub CI 结果需另看相应实际日志。
- 既有 ID 缺 receipt 的历史无法从当前答案补回，保持“不重复成绩、不补造证据”；已显示诚实提示不是缺失证据已恢复。
- 不应再为补充观察字段修改本轮脚本；如应用后续变动，应按新源码 hash 建立新证据，保留本报告版本边界。
