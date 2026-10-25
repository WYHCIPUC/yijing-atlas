# 2026-10-25 未完成事项盘点：测验交付后与反馈在制边界

适用日期：2026-10-25，Asia/Shanghai。文档基线1.18；盘点起点为`3a5b7971d5a1ac0b44259fea7a3e4a603febb598`，分支`codex/immersive-astrolabe-progress`。

本次按用户要求核对所有既有未完成事项、说明剩余内容并更新可直接复制的项目目标。原48卡不增减，不修改原任务标题、依赖和需求性质；不新增功能、业务后端或生产发布。现有未提交实现完整保留。

## 1. 计数与范围

- 已完成7项：T-DIV-01、T-SAVE-01、T-LEARN-05、T-SEARCH-01、T-LEARN-02、T-LEARN-01、T-QUIZ-01。
- 未闭环41项：30项已确认、10项建议改进、1项未来独立发布。这里包含未开发、部分实现、待验收及外部阻塞，不能称为41项全部尚未开发。
- P0 2项、P1 13项、P2 20项、持续内容2项、外部验收2项、本地收尾1项、独立发布1项。
- [完整清单](../REMAINING-WORK-AND-GOAL.md)每张开放卡列一次，注明当前基础、未完成内容、原优先级/性质和前置；[原卡](../12-ai-execution-tasks.md)保留详细实施和验收。
- 三条专题既有要求仍归原卡：间隔复习同轮幂等、复讲响应/保存隔离归T-LEARN-03，梅花时间来源/时区提示归T-DIV-03。真实节气归T-CAL-02，只计一次；可选今日一卦未提升为必做。
- 保留建议项与已确认任务的原依赖，不借依赖自动采纳建议或跳过前置。内容、许可与设备证据缺失不伪造为完成。

## 2. 已交付业务与GitHub

T-QUIZ-01源码、测试与证据已在`3a5b797`提交并同步开发分支；通过Git Data API非强制快进后核对96个对象及提交身份。远程PR头已核对为同一提交，PR仍为Draft、未合并。

本次只读核对[该提交PR Quality](https://github.com/WYHCIPUC/yijing-atlas/actions/runs/40139183436)为completed/success，job `121007075002`的Validate repository与Browser smoke均成功。

测验版本既有本地验收为validate 72脚本、覆盖率阶段515/515，配置21模块行99.76%、分支94.04%、函数98.96%；18项真实输入专项、完整五视口E2E及源码匹配见[最终验收](2026-10-25-quiz-final-acceptance.json)。本次没有重跑它们，也不将它们套用到后续未提交的反馈代码。

## 3. 当前在制代码

T-LEARN-03保持开放。下列文件已在工作区，但尚未作为本卡交付提交：

| 范围 | 已有代码 | 剩余工作 |
| --- | --- | --- |
| 共享反馈 | 新增`web/js/learning-feedback.js`及测试 | 接入其余调用页、样式及真实界面验证 |
| 间隔复习 | 修改`web/js/review-engine.js`及测试，新增`web/js/review-session.js`及测试 | `review-mode.js`接入提交协调器；真实评分、重复输入、部分失败/仅补失败项及返回 |
| 复讲/考评 | 修改`web/js/learning-assessment-page.js`、`web/js/modes/learning-mode.js`及两份页面测试 | 真实迟到响应、换课/离页、仅保存重试、窄屏和焦点；与其余反馈流程整合 |

共6个已有文件改动、4个新源码/测试文件。盘点冻结[177份源码快照](2026-10-25-remaining-work-feedback-snapshot.json)保留各项SHA256，明确6份文件相对测验冻结快照已经变化，不能继续称当前工作区与旧173份完全一致。

## 4. 本次实际检查与未验证

实际命令：

```text
node --test web/test/review-engine.test.mjs web/test/review-session.test.mjs web/test/learning-assessment-page.test.mjs web/test/learning-weak-questions-page.test.mjs web/test/learning-feedback.test.mjs
```

使用本机既有Node v24.19.0，未修改全局环境。结果exit0，111通过、0失败，覆盖5个限定文件；[原始输出gzip](2026-10-25-remaining-work-feedback-targeted.log.gz)解压与原日志逐字节一致。该结果不是全量validate、覆盖率或浏览器验收。

三组只读复核分别检查任务数量/依赖、学习与占筮黄历范围，以及数据在制状态。已修正文档里“尚未实施”“待执行”和“随本次交付”的过时表述；未关闭任何新增卡片。文档链接、卡片覆盖、需求追踪及最终差异检查另见[本次检查摘要](2026-10-25-remaining-work-feedback-checks.json)。

仍未验证：T-LEARN-03页面整合、浏览器真实输入、全量validate/E2E及交付审阅；T-QA-01真实窗口失焦；真机、读屏、真实200%缩放、当前完整性能与Windows新包。六家注疏的原0/64、0/3840及releaseReady=false门禁不因本次盘点变化。

本次只更新盘点文档及其证据，并同步GitHub任务状态；未新增应用实现、未合并main、未触发Pages/Release/tag。下一步如继续原项目开发，应从T-LEARN-03现有改动开始，按原卡完成接线与验收，而非重做已完成的测验闭环。
