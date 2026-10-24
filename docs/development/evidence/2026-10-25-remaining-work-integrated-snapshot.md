# 推荐集成后的未完成事项盘点

日期：2026-10-25（Asia/Shanghai）。本次仅盘点既有建设范围、更新文档与GitHub开发记录，不继续修改应用或扩大需求。总册基线1.10；原48张卡保持原编号、需求性质与依赖。

## 当前快照与保护范围

- 分支：`codex/immersive-astrolabe-progress`。
- 盘点起点HEAD：`ccd9961a76f3c2a27bdb1acaf805f8969551df63`；已交付课程错题业务为`995dd2c`。
- 起点保留15份已跟踪应用/样式/测试修改，另有2份新测试、1个新浏览器探针及其证据与整合记录。它们属于先前T-LEARN-01开发，不在本轮文档提交中充作已交付业务。
- [184份文件快照](2026-10-25-remaining-work-integrated-source.json)覆盖web、scripts、test、package与工作流等已跟踪/未忽略文件。本轮开始和结束核对SHA-256；没有重置、暂存或提交已有应用修改。
- 原清单43项集合与原48卡减去5项已完成相等；仍为32项已确认、10项建议、1项独立发布。三条既有专题要求沿用原卡，不新增编号。机械检查结果保存于[盘点检查记录](2026-10-25-remaining-work-integrated-checks.json)。

## T-LEARN-01最新事实

| 项目 | 当前状态与边界 |
| --- | --- |
| 推荐接口 | `learning-assessment.js`已导出`recommendLearningTask`，有稳定排序与可注入时间；旧缺失导出不是当前故障 |
| 入口与退出 | main已接欢迎首课、旧错题模式、退出前cleanup与异步焦点保护；学习模块导入本次退出0 |
| 数据与恢复 | 最小位置保存/校验/备份、今日主卡和课程恢复已有实现；没有新增正文、未提交选项或复讲私文持久化 |
| 相关回归 | 本次当前源码7份测试108/108，0失败；包含推荐、续读页面、UI契约、弱项页面、考评页面、main导航与阅读生命周期 |
| 桌面专项历史 | 已取得欢迎首课→正文实际滚动→离页/刷新→续读恢复，以及六级推荐真实跳转的部分通过记录 |
| 保存反馈缺口 | 增强浏览器检查复现读至“用”段后提示在视口上方：top=-1059，bottom=-1029.25，可视范围96—1000。早期只检查文本存在的绿灯不能代替可见性验收 |
| 最新修复 | 提示已移入粘附阅读控制区，相关测试通过；修复后的浏览器可见性、390/320px遮挡仍未验证 |
| 全量结果边界 | 既有完整validate记录66脚本、421/421，20配置模块99.80%/93.47%/99.05%，发生在最新可见性修复之前；本次未重跑完整validate或E2E |
| 剩余动作 | 增强桌面保存反馈红→绿；1440/390全部六场景及复讲最终焦点；320px可读/遮挡；最新全量门禁、最终审阅和源码/证据交付 |

上述浏览器原始记录在本地未提交目录`docs/development/evidence/2026-10-25-learning-recommendation-input/`，五轮UTC目录为`20-49-07-479Z`、`20-49-28-487Z`、`20-49-58-960Z`、`20-50-34-912Z`、`20-51-22-353Z`，日期前缀均为`2026-10-24T`。第一轮是探针标题断言错误，最后一轮是增强检查复现的产品问题；不能合并归因。所有轮次已结束，本轮没有重启浏览器验收。复制本地项目时保留这些原始记录；GitHub文档同步不代表这些未提交代码和原始目录已上传。

前一[47通过/13失败快照](2026-10-25-remaining-work-current-snapshot.md)保留原适用时点；本次只修正“当前”表述，不改历史日志。

## 本次实际检查

运行环境：现有Node 24.19.0；命令工作目录为仓库根目录，临时使用绝对Node路径，不改全局运行时配置。

```text
node --test web/test/learning-recommendation.test.mjs web/test/lesson-resume-page.test.mjs web/test/learning-ui-contract.test.mjs web/test/learning-weak-questions-page.test.mjs web/test/learning-assessment-page.test.mjs web/test/main-mode-navigation.test.mjs web/test/main-stage-lifecycle.test.mjs
```

结果：退出0，108/108，0失败。精确输出保存在[压缩日志](2026-10-25-remaining-work-integrated-targeted.log.gz)，解压字节与原日志一致。

```text
node --input-type=module -e "await import('./web/js/modes/learning-mode.js'); console.log('learning-mode import: PASS');"
```

结果：退出0，`learning-mode import: PASS`。模块可导入不等于全部浏览器流程通过。

文档检查使用`node docs/development/tools/check-docs.mjs`；另核对48卡/43项集合、需求分类、原卡标题和依赖不变、源码SHA-256及最终diff，实际结果见[检查记录](2026-10-25-remaining-work-integrated-checks.json)。本次没有新增产品测试或修改应用代码，不将文档检查写成全站验收。

## 独立复核与文档修正

- 数据/运行/内容/分发复核：43个唯一开放ID无漏项或额外项；客户端评阅加固仍为建议，后端等未来方案未混入目标。
- 星图/阅读/UI/声音/QA复核：18张相关开放卡无漏项；T-QA-03仍为建议。统一五种图式与四种关系、搜索目标先于学习任务的既有表述。
- 修正T-QA-01卡内“尚未实施/验证失败”的过时概括，保留真实失焦等余项和历史归因限制。
- 将T-MODAL-01透明工具Tab问题由“待复现”改为已有真实输入证据、待修复；不据此宣布模态问题已解决。
- 修正T-QA-03固定旧截图目录的过时现状，保留受控目录、并行/失败测试及自动摘要余项。
- 总册、学习专题、数据专题、执行卡与剩余清单统一T-LEARN-01当前状态；未关闭该卡或改变43项总数。

## GitHub与验收门禁

本次实际核对`ccd9961`的[PR Quality run 40131157814](https://github.com/WYHCIPUC/yijing-atlas/actions/runs/40131157814)：completed/success；job `120982962967`中的Validate repository与Browser smoke均success。该结果只覆盖已提交代码，不覆盖本地T-LEARN-01实现或本轮后续文档提交。

PR #10保持Draft、Issue #9保持5勾选/43未勾选。文档及盘点状态按原授权同步开发分支；没有合并main、部署Pages、上传Release、打tag或重建Windows包。

真机、屏幕阅读器、真实200%缩放、当前完整性能与Windows包验收继续开放；六家0/64、0/3840及发布门禁关闭。许可、底本、独立双校和设备证据不可补造。完整目标文字见[未完成清单第12节](../REMAINING-WORK-AND-GOAL.md#12-可直接用于设定项目目标的文字)。
