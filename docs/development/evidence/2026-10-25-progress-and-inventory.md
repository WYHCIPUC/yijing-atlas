# 2026-10-25 实施增量与未完成清单核对

返回 [总册](../../DEVELOPMENT-MASTER.md) · [未完成清单与目标文字](../REMAINING-WORK-AND-GOAL.md) · [执行卡](../12-ai-execution-tasks.md)。

## 1. 本轮范围和版本

本轮从 `codex/immersive-astrolabe-progress` 的 `bb7fa46756604c6acebf7d77cd45e446ff50a765`、干净工作区继续。已有授权目标下的输入验收、深读保存反馈和考评会话实施同时推进；用户本次要求重新盘点剩余内容并提供目标文字。本清单更新不新增需求，不自动采纳建议项，不关闭尚未完整验收的任务。

应用版本仍为 `1.1.1-rc.2`，资源缓存仍为 v51；未新增运行依赖、框架、构建系统或业务后端，未修改卦码、历法或关系算法。本轮代码/测试增量提交为 `5627bc8ec917efe0265b27e24ce2463d557611e7`。工作区受测文件和 SHA256 见 [本轮源码清单](2026-10-25-progress-source.json)，不能只用修改前 HEAD 代表受测内容。GitHub 结果在本记录后续追加，不能把“同步中”写成“已通过”。

## 2. 已做部分与尚缺部分

| 原任务 | 本轮已做 | 尚未完成，整卡仍开放 |
| --- | --- | --- |
| T-QA-01 | 新增独立 CDP 真实输入窄探针；最终 5/5 限定场景、14 动作组通过，四次尝试及失败保留 | 本轮 PR Quality 在快读 resize 的模态断言新失败，尚未定位。减少动态桌面聚焦后直接 Canvas 二次选择的特定路径尚未送出有效第二次输入；主动失捕获、失焦、多指等复位边界未验。正常 450ms 镜头中断只有桌面鼠标时序证据；不能扩称触控全覆盖。历史 B-01 无完整 trace 的唯一归因限制仍保留 |
| T-SAVE-01 | 深读附带的成就/复习卡保存分别检查；可见非模态 aria-live 提示和原事件重试；成功后重试按钮隐藏时恢复到状态文本；不阻断正文；部分成功后再次核对持久化证据 | 新提示/按钮的真实浏览器故障注入、关闭返回、恢复重试与焦点专项尚未执行。既定 E2E 不包含这套新增专项，不能代替。任意 getItem 失败与配额失败不是相同保证，不宣称通用存储故障全覆盖 |
| T-LEARN-05 | 新 session 身份、答案归属校验、未答定位、空抽查、实际题数、原轮保存重试；重绘保留题序/答案；交卷与修习谱回补统一每轮身份及实际成绩；旧汇总保留原时间证据 | 当前仅使用辅助 assessmentSessions，尚未读取/校验数据 §7.1 既定 processedAssessmentIds；已有 ID 无 receipt 时去重、非法/超长/重复 ID、历史截断与备份往返待按原契约补齐。双提交/结果重显/修习谱往返、新轮、非法选项、空态、不足题及成绩/成就分别失败恢复的真实浏览器专项也未执行 |

T-GROW-01 仍须满足前两项原前置条件后实施；本轮修复重复回补不等于已经接通八卦 24 题、上下经各 10 题或综合 25 题入口。学习错题队列、复习评分和复讲会话等其他任务未因此实现。

### 2.1 最小复现与独立审查

- 深读保存反馈最初缺失的测试先失败后修复；本轮另复现“部分成功后导入旧备份，已成功一半被移除，但内存仍认定成功”，新测试先失败，再修正为补保存前读取现有持久化证据。复用原事件，不保存旧整份快照覆盖其他学习记录。
- 考评独立 AI 审查复现“完成小试 → 修习谱”后，同轮证据因 session 与时间键并存而重复。修复后两条正常路径使用同轮身份；另补旧成绩后新低分不抬高新轮证据的回归。旧记录不补造 session。
- 新增页面测试执行真实页面函数并使用轻量 DOM harness；它不是浏览器鼠标、触控或读屏证据。
- 文档复核发现正式去重 ID 预留契约与辅助 receipt 实现有偏差；本轮明确登记为 T-LEARN-05 未完项，没有修改原契约来消除差距。后续须先补已有 ID 无 receipt 的失败回归，以正式 ID 判重；receipt 只回补真实成绩证据，不能按旧时间补造 ID 或缺失成绩。
- [输入探针完整记录](2026-10-25-entry-input-probe.md) 逐次写明成功、失败和测试前提；不把未送出的动作改报为产品通过。

## 3. 实际验证

环境：Windows，Node `v22.23.1`，本机 Microsoft Edge `155.0.4283.62`，隔离浏览器 profile。日期采用 Asia/Shanghai，trace 文件名保留实际 UTC 时间戳。

随仓库日志保留完整输出内容，仅归一换行并去除行尾空白，以满足差异检查；未删失败、警告或断言。trace 与截图保留各次原始记录。

| 命令 | 实际结果 | 证据和范围 |
| --- | --- | --- |
| `node --test web/test/main-stage-lifecycle.test.mjs web/test/achievement-storage.test.mjs web/test/storage.test.mjs` | exit 0，28/28 | 深读/舞台 20、成就存储 5、通用存储 3；工具输出已观察，未冒称单独持久化完整原始日志 |
| `npm run validate` | exit 0；59 个测试脚本，覆盖率阶段 262/262、0 失败 | [完整日志](2026-10-25-progress-validate.log)；20 个配置模块集合行 99.77%、分支 91.45%、函数 98.92%。不等于全项目 DOM/渲染覆盖率 |
| `npm run test:e2e` | exit 0 | [完整日志](2026-10-25-progress-e2e.log)；原有五视口、鼠标/键盘/模拟触控阅读、减少动态、离线与 WebGL 降级。没有新增保存/考评专项断言 |
| `node scripts/test-entry-input.mjs` | 最终 exit 0，5/5 限定场景 | [最终 trace](2026-10-25-entry-input/2026-10-24T18-39-31-364Z/trace.json) 与其他三次尝试均保留；源码首尾 hash 相同 |
| `node --check scripts/test-entry-input.mjs` | exit 0 | 新探针语法；最终跟踪文件门禁以集成后结果为准 |
| `npm run check` | exit 0；71 个 JS/MJS、11 个 JSON | 新文件加入 Git 索引后复跑；六家门禁仍关闭，版本树分发检查通过，不等于素材逐项授权完成 |
| `git diff --check` | exit 0 | Windows 换行提示不等于空白错误；最终提交前再核对 |
| `node docs/development/tools/check-docs.mjs` | exit 0 | 最终核对 15 份文档、48 卡、86 需求、680 个本地链接，无问题；不使用仅适用首次文档冻结的 source-guard |
| 两份新证据链接与清单一一映射检查 | exit 0 | 16 个本地目标均存在；原 48 卡减 T-DIV-01 恰等于清单 47 行，每项一次，无额外编号。独立 AI 只读核对数量、性质与目标边界一致 |

本轮没有取得 Android/iOS 真机、屏幕阅读器、真实浏览器 200% 缩放、完整性能三次测量或当前 Windows 新包证据；不以 CDP 模拟或旧报告代替。六家仍为 `releaseReady=false`、0/64 卦、0/3840 已校锚点。

## 4. 盘点结论与接手

原台账 48 张卡仅 T-DIV-01 完成，**47 项仍未闭环：36 项已确认、10 项建议改进、1 项未来独立发布**。三项正在收尾的任务有代码/证据增量，但没有减少开放卡数量。完整清单按九组逐项写明尚缺内容、原有依赖和需求性质，已确认的三条专题映射缺口单列出处，不另建需求编号。

本次目标文字仅从现有总册、专题和执行卡归纳；建议继续为建议，账号/云同步/数据库/后台不纳入当前静态建设，GitHub 开发同步不等于生产发布授权。后续 AI 先核对受测源码及未提交修改，完成依赖满足任务的剩余实现/验收，更新实测记录后才关闭卡片。复制文件仍不会迁移浏览器学习数据。

## 5. GitHub 开发同步

起点 `bb7fa46` 的 push / PR Quality 均成功；本轮核对 [PR #10](https://github.com/WYHCIPUC/yijing-atlas/pull/10) 为 OPEN / Draft，[Issue #9](https://github.com/WYHCIPUC/yijing-atlas/issues/9) 为 OPEN，远端起点与本地一致。原开发分支继续使用，未合并 main、未触发 Pages/Release。

本轮代码 `5627bc8ec917efe0265b27e24ce2463d557611e7` 已同步同一开发分支。常规 Git HTTPS 本次连接 443 失败，随后使用既有 Git Data API 同步工具，逐项核验 blob/tree/commit SHA 并非强制快进，未改写提交。

该提交的 [push Quality](https://github.com/WYHCIPUC/yijing-atlas/actions/runs/40122221000) 成功，包含 validate / E2E；[PR Quality](https://github.com/WYHCIPUC/yijing-atlas/actions/runs/40122223534) 失败，其 Validate repository 成功、Browser smoke test 失败。原始输出见 [失败日志](2026-10-25-github-pr-failure.log)，结构化结果见 [代码 CI 状态](2026-10-25-github-quality-code.json)。

新失败发生在 `scripts/browser-smoke.mjs:1015`：桌面 1440px 快读、展开工具后 resize 到 768px，下一次断言发现 `stage=quick,open=true,modal=false,deepLink=false`。日志尚无该瞬间 viewport、matchMedia、resize 回调和状态写入顺序，**根因未确定**，不能直接归因于异步回调、产品逻辑或测试。下一步按 T-QA-01 采集这些数据、复现并最小修复，不加任意固定等待掩盖；push 同提交通过也不抵消失败。本轮盘点不因该失败新增卡片或扩大需求。

清单和证据的随后提交及检查结果在实际同步后补入 GitHub 跟踪；不引用起点绿灯证明新增代码或文档已通过远程检查。

### 5.1 后续清单复核

本次重新核对 HEAD `30796f755424949af9575bfbb674f4278994102f`：其 [push Quality](https://github.com/WYHCIPUC/yijing-atlas/actions/runs/40122525878) 与 [PR Quality](https://github.com/WYHCIPUC/yijing-atlas/actions/runs/40122531469) 均为 completed / success，包含 Validate repository 和 Browser smoke test。与上一段失败对应的业务代码未因这次文档提交发生变化，故两次新绿灯不构成间歇问题修复证据。T-QA-01 继续开放，保留旧失败日志并取证。

当前并行工作分别为考评正式 ID 契约修复、深读保存真实输入专项、快读 resize 时序取证；最终审阅及验证前均记“进行中”，不从 47 项清单中删去。此次盘点复核只调整文档中的基线与证据说明，不新增任务，不将建议改进变更为已确认要求。清单逐卡计数及需求性质的机械检查结果保存为 [本次盘点检查](2026-10-25-inventory-recheck.json)。

### 5.2 03:11后的盘点更新

以上内容保留原阶段事实。后续正式ID契约及浏览器9/9、深读保存8/8已有本地证据；resize时序也已定位并局部修复，因此前文“契约未实现/专项未验/resize尚未定位”不再代表最新状态。新复现Canvas外第二指不取消拖动，当前回归5通过1失败；另有输入证据仍缺。47张正式开放卡中2张只剩整合交付，其他45张仍有开发/验证/外部输入待办。最新源码身份、证据与GitHub边界见[本次盘点记录](2026-10-25-current-inventory.md)，不能把早先全量通过替代当前工作区。
