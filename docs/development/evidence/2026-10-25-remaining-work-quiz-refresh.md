# 未完成事项盘点：推荐已交付，测验仍在制

日期：2026-10-25（Asia/Shanghai）。本次任务为重新盘点剩余事项并形成目标文字，不新增需求、不继续业务开发。

## 1. 已提交基线与统计

- 分支：`codex/immersive-astrolabe-progress`；盘点时本地HEAD与GitHub PR HEAD为`4e8adc800b39ade15ece002b4f085143426bba44`。
- 原48卡，完成6、开放42；开放项为31已确认、10建议、1独立发布。完成项：T-DIV-01、T-SAVE-01、T-LEARN-05、T-SEARCH-01、T-LEARN-02、T-LEARN-01。没有新增编号、改变标题/依赖/需求性质或关闭新任务。
- 4e8adc8的[PR Quality run 40133463549](https://github.com/WYHCIPUC/yijing-atlas/actions/runs/40133463549)实际返回completed/success；job120989926367的Validate repository和Browser smoke均success。PR #10仍Draft且未合并，Issue #9仍开放。
- 该绿灯只覆盖提交版本，不覆盖下列未提交草稿。本次没有重跑完整`npm run validate`或`npm run test:e2e`；427/427及五视口通过属于此前已交付推荐版本的证据。

## 2. T-QUIZ-01在制文件与剩余整合

| 文件 | 盘点时现状 | 未完成 |
| --- | --- | --- |
| `web/js/learning-progress.js` | 已有回执、查询、同键保存初版 | 无回执的旧弱项边界、冲突/失败/重复及完整实现后回归 |
| `web/js/user-data.js` | 接入部分学习回执校验 | 测验统计回执校验与导入往返/拒绝断言 |
| `web/js/modes/quiz-mode.js` | 新精确入口、提交/反馈/cleanup草稿 | 缺引用接口和提交模块，当前不能加载 |
| `web/js/almanac-knowledge.js` | 术语ID定位、返回与cleanup草稿 | 入口接线、真实焦点与返回验收 |
| `web/test/user-data.test.mjs`及新`quiz-weak-data.test.mjs` | 数据失败回归已写；之后又补边界 | 初始红灯之后未完整重跑，不能登记全部转绿 |
| 新`quiz-question-reference.test.mjs` | 引用/统计失败回归已写 | 对应引擎接口与统计实现未完成 |
| 新`quiz-mode-page.test.mjs`、`almanac-knowledge-page.test.mjs`及`helpers/quiz-page-dom.mjs` | 页面失败回归与测试夹具 | 草稿实施后的页面绿灯与浏览器验收未取得 |
| `quiz-engine.js`、`main.js`、`learning-assessment.js`、`review-mode.js`、`learning-mode.js` | 保持已提交版本 | 本任务的精确题目、入口参数、推荐/温故/cleanup等接线尚未实现 |
| 拟用`web/js/quiz-session.js` | 文件不存在 | 单轮提交与分项幂等/重试协调尚未实施；具体实现遵循原卡，不新建业务需求 |

已停止继续修改以上文件，全部保留供后续开发。不能把页面草稿、注入假接口的页面测试或引擎单测当作完整用户流程通过。

## 3. 实际诊断与历史红灯

本次用现有Node24动态导入`./web/js/modes/quiz-mode.js`，实际退出1：

```text
ERR_MODULE_NOT_FOUND: Cannot find module 'Y:\易经学习项目\web\js\quiz-session.js'
imported from Y:\易经学习项目\web\js\modes\quiz-mode.js
```

这是模块可加载性诊断，不是浏览器验收。静态检查同时确认页面引用的`resolveQuizQuestion`尚未由`quiz-engine.js`导出。未在此次盘点修复业务文件。

| 历史红灯 | 实际结果 | 适用范围 |
| --- | --- | --- |
| [题目引用/统计](2026-10-25-quiz-reference-red.log.gz) | 12项，0通过、12失败，exit1 | 写入实现前的失败回归，含缺API、重复统计和读取失败保护 |
| [页面](2026-10-25-quiz-pages-red.log.gz) | 10项，0通过、10失败，exit1 | 页面草稿实施前，含精确入口、空题及定位等缺口 |
| [数据与备份](2026-10-25-quiz-weak-data-red.log.gz) | 65项，49通过、16失败，exit1 | 13项缺API、3项坏数据校验/导入断言；此后局部实现及新增边界尚未取得完整绿灯 |

三份原日志按字节gzip归档并验证解压完全一致，未改历史输出。路径、SHA256和盘点时162份源码/测试文件哈希见[快照](2026-10-25-remaining-work-quiz-snapshot.json)。快照包含在制文件；仅用于确认本次文档整理未改业务，不代表它们已验证或已提交。

## 4. 交接与范围

- [42项清单](../REMAINING-WORK-AND-GOAL.md)逐项写明剩余内容；第4.1节细化在制任务，第12节为可复制目标文字。
- 独立只读审查核对42个开放ID无缺失/重复，建议性质、内容/许可/设备门禁和独立发布边界保留。已修正文档中T-QUIZ-01“尚未实施”的过时表述。
- 三条已有专题要求仍归原卡：间隔复习幂等及复讲旧响应/保存重试归T-LEARN-03；梅花时间来源/时区提示归T-DIV-03。不增加任务数。
- 真机、读屏、真实200%、当前完整性能及Windows新包仍待验收；六家0/64、0/3840，门禁关闭。10项建议不自动采纳，缺前置时如实登记。
- GitHub只同步盘点文档、证据及状态；上述未完成业务草稿不随文档提交。没有main合并、Pages、Release、版本tag或生产发布。
- 本次文档、任务集合与源码保护检查见[检查记录](2026-10-25-remaining-work-quiz-checks.json)。恢复开发须先核对实际工作区与原卡，完成T-QUIZ-01整合及实际验证，不能删除失败项或假设历史绿灯仍适用。
