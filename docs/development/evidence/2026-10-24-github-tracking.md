# 易象图谱建设进度与 48 项任务跟踪

日期：2026-10-24（Asia/Shanghai）。本 Issue 作为 GitHub 上的统一进度入口；具体需求、依赖、修改范围和验收以[开发建设总册](https://github.com/WYHCIPUC/yijing-atlas/blob/codex/immersive-astrolabe-progress/docs/DEVELOPMENT-MASTER.md)及[48 张 AI 执行卡](https://github.com/WYHCIPUC/yijing-atlas/blob/codex/immersive-astrolabe-progress/docs/development/12-ai-execution-tasks.md)为准。

**尚未完成全面优化开发。** 沉浸星仪 UI 和总册已有实现与提交，本轮继续修复章节边界、星图命中一致性和占筮案例身份，并将代码、文档及后续工作同步推进到开发分支 `codex/immersive-astrolabe-progress`。本正文准备时同步结果仍待集成者确认；不将“计划推送”写成“已同步”。本轮新版未发布到生产环境。

## 当前进度与证据

- 已形成的基线提交：`ee62259`（沉浸星仪 UI）、`efb2e8c`（开发总册）、`217a5cf`（合入 `origin/main`）。本轮后续修复的最终提交、推送和 CI 结果在下方单独登记。
- **T-DIV-01 完成**：金钱和梅花首次结果、历史回看沿用同一稳定案例身份；重复重放不新增分析案例或历史，历史保存失败保留本次运行内独立身份，旧摘要不补造六爻或分析。提交／修订事件语义与结构化挑战仍归 T-DIV-02。
- **T-QA-01 仍开放**：本地默认 E2E 与开启截图的 E2E 已各取得一次完整通过，共两次；保留原断言，并补可操作性、面板左边界和章节稳定性检查。历史 B-01 的单次画布失败缺少当时完整诊断，不能回溯断言唯一原因，因此暂不将整卡打勾。
- **T-QA-03 仍开放**：仅将截图写入新的 `smoke-<运行时间>` 目录，避免覆盖历史；证据目录参数与可携带日志的完整建设尚未完成。
- 其余任务没有因为 UI 提交、总册完成或本地 E2E 通过而自动完成。未勾选项可能待实施、部分实施或受外部输入阻塞，具体状态见执行卡和实施证据。
- 本轮详细经过、失败复现、修复边界与交接见[实施进度证据](https://github.com/WYHCIPUC/yijing-atlas/blob/codex/immersive-astrolabe-progress/docs/development/evidence/2026-10-24-implementation-progress.md)。[原文档验证记录](https://github.com/WYHCIPUC/yijing-atlas/blob/codex/immersive-astrolabe-progress/docs/development/evidence/2026-10-24-validation.md)中的失败与历史证据继续保留。

## 逐项任务清单

以下按执行卡原顺序排列，共 48 项；目前仅 T-DIV-01 达到本卡完成条件。勾选必须同时有实际实现、相关检查与证据，不能只因代码已写或引擎夹具通过而勾选。

- [ ] [T-QA-01 定位并修复真实输入 E2E 失败](https://github.com/WYHCIPUC/yijing-atlas/blob/codex/immersive-astrolabe-progress/docs/development/12-ai-execution-tasks.md#t-qa-01) — 本地默认及截图 E2E 两次完整通过；历史 B-01 单次唯一原因未能回溯，保留整卡开放。
- [ ] [T-GROW-01 从真实考评入口接通成就证据](https://github.com/WYHCIPUC/yijing-atlas/blob/codex/immersive-astrolabe-progress/docs/development/12-ai-execution-tasks.md#t-grow-01)
- [x] [T-DIV-01 历史重放沿用稳定案例标识](https://github.com/WYHCIPUC/yijing-atlas/blob/codex/immersive-astrolabe-progress/docs/development/12-ai-execution-tasks.md#t-div-01) — 已修复首次结果及历史回看身份一致性；修订事件语义留给 T-DIV-02。
- [ ] [T-SAVE-01 正式阅读副作用保存失败可见](https://github.com/WYHCIPUC/yijing-atlas/blob/codex/immersive-astrolabe-progress/docs/development/12-ai-execution-tasks.md#t-save-01)
- [ ] [T-STAR-01 统一星图焦点退出和漫游路径](https://github.com/WYHCIPUC/yijing-atlas/blob/codex/immersive-astrolabe-progress/docs/development/12-ai-execution-tasks.md#t-star-01)
- [ ] [T-STAR-02 关系颜色线型与标记统一](https://github.com/WYHCIPUC/yijing-atlas/blob/codex/immersive-astrolabe-progress/docs/development/12-ai-execution-tasks.md#t-star-02)
- [ ] [T-STAR-03 接通任务和搜索目标标签优先级](https://github.com/WYHCIPUC/yijing-atlas/blob/codex/immersive-astrolabe-progress/docs/development/12-ai-execution-tasks.md#t-star-03)
- [ ] [T-SEARCH-01 补齐序号编码和上下卦搜索](https://github.com/WYHCIPUC/yijing-atlas/blob/codex/immersive-astrolabe-progress/docs/development/12-ai-execution-tasks.md#t-search-01)
- [ ] [T-READ-01 六爻正文与卦象逐爻联动](https://github.com/WYHCIPUC/yijing-atlas/blob/codex/immersive-astrolabe-progress/docs/development/12-ai-execution-tasks.md#t-read-01)
- [ ] [T-READ-02 关系正视对读和双动作](https://github.com/WYHCIPUC/yijing-atlas/blob/codex/immersive-astrolabe-progress/docs/development/12-ai-execution-tasks.md#t-read-02)
- [ ] [T-READ-03 跨模块经文上下文与返回](https://github.com/WYHCIPUC/yijing-atlas/blob/codex/immersive-astrolabe-progress/docs/development/12-ai-execution-tasks.md#t-read-03)
- [ ] [T-READ-04 快读信息布局与长正文协调](https://github.com/WYHCIPUC/yijing-atlas/blob/codex/immersive-astrolabe-progress/docs/development/12-ai-execution-tasks.md#t-read-04)
- [ ] [T-LEARN-01 推荐优先队列与继续阅读](https://github.com/WYHCIPUC/yijing-atlas/blob/codex/immersive-astrolabe-progress/docs/development/12-ai-execution-tasks.md#t-learn-01)
- [ ] [T-LEARN-02 课程错题形成独立温习闭环](https://github.com/WYHCIPUC/yijing-atlas/blob/codex/immersive-astrolabe-progress/docs/development/12-ai-execution-tasks.md#t-learn-02)
- [ ] [T-LEARN-03 统一四段修习反馈](https://github.com/WYHCIPUC/yijing-atlas/blob/codex/immersive-astrolabe-progress/docs/development/12-ai-execution-tasks.md#t-learn-03)
- [ ] [T-QUIZ-01 具体错题证据与黄历薄弱项](https://github.com/WYHCIPUC/yijing-atlas/blob/codex/immersive-astrolabe-progress/docs/development/12-ai-execution-tasks.md#t-quiz-01)
- [ ] [T-LEARN-04 区分三种学习层级称谓](https://github.com/WYHCIPUC/yijing-atlas/blob/codex/immersive-astrolabe-progress/docs/development/12-ai-execution-tasks.md#t-learn-04)
- [ ] [T-LEARN-05 同轮考评与保存重试幂等](https://github.com/WYHCIPUC/yijing-atlas/blob/codex/immersive-astrolabe-progress/docs/development/12-ai-execution-tasks.md#t-learn-05)
- [ ] [T-DIV-02 三路径与五步结构化解卦挑战](https://github.com/WYHCIPUC/yijing-atlas/blob/codex/immersive-astrolabe-progress/docs/development/12-ai-execution-tasks.md#t-div-02)
- [ ] [T-DIV-03 占筮本卦与之卦正式研读入口](https://github.com/WYHCIPUC/yijing-atlas/blob/codex/immersive-astrolabe-progress/docs/development/12-ai-execution-tasks.md#t-div-03)
- [ ] [T-GROW-02 修习谱十二项进度与证据视图](https://github.com/WYHCIPUC/yijing-atlas/blob/codex/immersive-astrolabe-progress/docs/development/12-ai-execution-tasks.md#t-grow-02)
- [ ] [T-PRIV-01 主动保存的观象录](https://github.com/WYHCIPUC/yijing-atlas/blob/codex/immersive-astrolabe-progress/docs/development/12-ai-execution-tasks.md#t-priv-01)
- [ ] [T-CAL-01 黄历七日轴与日期语义](https://github.com/WYHCIPUC/yijing-atlas/blob/codex/immersive-astrolabe-progress/docs/development/12-ai-execution-tasks.md#t-cal-01)
- [ ] [T-CAL-02 三段日课与内联术语笺注](https://github.com/WYHCIPUC/yijing-atlas/blob/codex/immersive-astrolabe-progress/docs/development/12-ai-execution-tasks.md#t-cal-02)
- [ ] [T-CAL-03 公开历笺分享](https://github.com/WYHCIPUC/yijing-atlas/blob/codex/immersive-astrolabe-progress/docs/development/12-ai-execution-tasks.md#t-cal-03)
- [ ] [T-SOUND-01 音效由业务成功显式触发](https://github.com/WYHCIPUC/yijing-atlas/blob/codex/immersive-astrolabe-progress/docs/development/12-ai-execution-tasks.md#t-sound-01)
- [ ] [T-SOUND-02 正式音源台账与音量并发控制](https://github.com/WYHCIPUC/yijing-atlas/blob/codex/immersive-astrolabe-progress/docs/development/12-ai-execution-tasks.md#t-sound-02)
- [ ] [T-MODAL-01 统一模态、隐藏控件与焦点栈](https://github.com/WYHCIPUC/yijing-atlas/blob/codex/immersive-astrolabe-progress/docs/development/12-ai-execution-tasks.md#t-modal-01)
- [ ] [T-ICON-01 残留字符图标与可访问名称](https://github.com/WYHCIPUC/yijing-atlas/blob/codex/immersive-astrolabe-progress/docs/development/12-ai-execution-tasks.md#t-icon-01)
- [ ] [T-ASSET-02 检查并替换伪文字材质](https://github.com/WYHCIPUC/yijing-atlas/blob/codex/immersive-astrolabe-progress/docs/development/12-ai-execution-tasks.md#t-asset-02)
- [ ] [T-BACKUP-01 备份容量可往返](https://github.com/WYHCIPUC/yijing-atlas/blob/codex/immersive-astrolabe-progress/docs/development/12-ai-execution-tasks.md#t-backup-01)
- [ ] [T-BACKUP-02 深层校验与回滚失败反馈](https://github.com/WYHCIPUC/yijing-atlas/blob/codex/immersive-astrolabe-progress/docs/development/12-ai-execution-tasks.md#t-backup-02)
- [ ] [T-API-01 可选评阅端点解析与异常防护](https://github.com/WYHCIPUC/yijing-atlas/blob/codex/immersive-astrolabe-progress/docs/development/12-ai-execution-tasks.md#t-api-01)
- [ ] [T-CACHE-01 SW只删除自身缓存](https://github.com/WYHCIPUC/yijing-atlas/blob/codex/immersive-astrolabe-progress/docs/development/12-ai-execution-tasks.md#t-cache-01)
- [ ] [T-CACHE-02 离线范围与版本更新可见](https://github.com/WYHCIPUC/yijing-atlas/blob/codex/immersive-astrolabe-progress/docs/development/12-ai-execution-tasks.md#t-cache-02)
- [ ] [T-CAPACITY-01 长期本地容量与幂等保全](https://github.com/WYHCIPUC/yijing-atlas/blob/codex/immersive-astrolabe-progress/docs/development/12-ai-execution-tasks.md#t-capacity-01)
- [ ] [T-SHARE-01 分享链接显式公开白名单](https://github.com/WYHCIPUC/yijing-atlas/blob/codex/immersive-astrolabe-progress/docs/development/12-ai-execution-tasks.md#t-share-01)
- [ ] [T-ASSET-01 资产和第三方许可总账](https://github.com/WYHCIPUC/yijing-atlas/blob/codex/immersive-astrolabe-progress/docs/development/12-ai-execution-tasks.md#t-asset-01)
- [ ] [T-DEP-01 依赖与本地vendor版本维护](https://github.com/WYHCIPUC/yijing-atlas/blob/codex/immersive-astrolabe-progress/docs/development/12-ai-execution-tasks.md#t-dep-01)
- [ ] [T-CONTENT-01 原典与项目资料逐条校勘](https://github.com/WYHCIPUC/yijing-atlas/blob/codex/immersive-astrolabe-progress/docs/development/12-ai-execution-tasks.md#t-content-01)
- [ ] [T-CONTENT-02 六家3840锚点内容工程](https://github.com/WYHCIPUC/yijing-atlas/blob/codex/immersive-astrolabe-progress/docs/development/12-ai-execution-tasks.md#t-content-02)
- [ ] [T-QA-02 新增纯逻辑覆盖率纳入计量](https://github.com/WYHCIPUC/yijing-atlas/blob/codex/immersive-astrolabe-progress/docs/development/12-ai-execution-tasks.md#t-qa-02)
- [ ] [T-QA-03 证据目录参数与可携带日志](https://github.com/WYHCIPUC/yijing-atlas/blob/codex/immersive-astrolabe-progress/docs/development/12-ai-execution-tasks.md#t-qa-03) — 仅完成截图新 run 目录局部改动，整卡未完成。
- [ ] [T-A11Y-01 真机读屏真实缩放与兼容验收](https://github.com/WYHCIPUC/yijing-atlas/blob/codex/immersive-astrolabe-progress/docs/development/12-ai-execution-tasks.md#t-a11y-01)
- [ ] [T-PERF-01 当前UI性能与长时降级证据](https://github.com/WYHCIPUC/yijing-atlas/blob/codex/immersive-astrolabe-progress/docs/development/12-ai-execution-tasks.md#t-perf-01)
- [ ] [T-WIN-01 当前源码本地Windows重建验收](https://github.com/WYHCIPUC/yijing-atlas/blob/codex/immersive-astrolabe-progress/docs/development/12-ai-execution-tasks.md#t-win-01)
- [ ] [T-RELEASE-01 未来独立远程发布与生产复验](https://github.com/WYHCIPUC/yijing-atlas/blob/codex/immersive-astrolabe-progress/docs/development/12-ai-execution-tasks.md#t-release-01)
- [ ] [T-COPY-01 无Git副本的检查兼容方案](https://github.com/WYHCIPUC/yijing-atlas/blob/codex/immersive-astrolabe-progress/docs/development/12-ai-execution-tasks.md#t-copy-01)

## 后续执行规则与外部阻塞

1. 先核对总册、执行卡、代码及已有 diff；按真实依赖选择任务，不直接按列表顺序跳过前置验收。
2. 先复现或补关键失败场景，再最小实现，实际运行相关检查并更新仓库证据。存在界面交互时保留真实鼠标、触控或键盘输入，不只靠脚本调用 `click()`。
3. 每完成一项，记录实现提交、命令及退出码、证据路径、未验证项和回滚边界，再同步更新本 Issue 与任务台账。失败项继续开放，不能删除断言换取绿色 CI。
4. 当前没有真机、屏幕阅读器、真实浏览器 200% 缩放、当前源码 Windows 新包的完整验收证据。模拟视口、CDP 触控、640 CSS px 或旧 EXE 不替代这些证据。
5. 六家注疏发布门禁继续关闭；原典、资产授权、双人校勘和内容覆盖不能由代码检查或远程推送代替。缺少外部输入的任务明确写阻塞，不编造完成记录。
6. 保持原生静态架构及本地数据边界，不将账号、云同步、数据库或管理后台混入本轮。GitHub 开发分支同步与生产发布分别跟踪。

## 集成者最终结果登记

以下由集成者在实际结束后补入，再提交本 Issue；当前不预填测试数量或 CI 通过结论：

| 项目 | 最终结果 |
| --- | --- |
| 本轮最终修复提交 | `c625a7c`；4 个应用模块、浏览器脚本与回归测试 |
| GitHub 分支推送 | 待补远程分支、提交与结果 |
| 最终 `npm run validate` | exit 0，58 个脚本、244/244；配置 20 模块行 99.77%、分支 91.12%、函数 98.89%，不等于全项目覆盖率 |
| 默认及截图 E2E | 本地完整通过；最终默认运行覆盖 `c625a7c`，25 张截图为此前相同 UI 代码；日志和适用范围见实施交接第 7 节 |
| GitHub CI | 待补工作流 URL、结束时间、结论及失败项 |
| 生产环境 | 本轮未发布；后续按 T-RELEASE-01 独立执行 |

本 Issue 只在 48 项卡片分别达到其完成条件后才能作为“全面建设已完成”关闭；外部证据和内容门禁仍开放时不得整体关闭。
