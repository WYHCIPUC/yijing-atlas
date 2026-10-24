# 最新未完成事项盘点与草稿冻结记录

日期：2026-10-25（Asia/Shanghai）。本轮任务是盘点剩余工作及编写目标文字；不新增需求、不继续业务实现。业务HEAD为`995dd2c2befccdc0cab38300101a9efa857c021c`，分支`codex/immersive-astrolabe-progress`。

## 盘点结果及范围

原48张执行卡已完成5张：T-DIV-01、T-SAVE-01、T-LEARN-05、T-SEARCH-01、T-LEARN-02。开放43张，原需求性质为32已确认、10建议、1独立发布；不按数量计算产品完成百分比。[完整清单与可复制目标](../REMAINING-WORK-AND-GOAL.md)逐项保留剩余内容及依赖。

独立只读核对确认：43张恰为原48减去已完成5张，任务编号无缺失、重复或新增，依赖与执行卡一致；目标未将建议升级为必做。修正学习组正文5→4、已交付课程错题的旧表述，以及T-LEARN-01仍称“准备中”的过时状态。三条既有专题要求继续归T-LEARN-03、T-LEARN-03、T-DIV-03，不新增卡。

## 已提交版本与当前工作区的区别

课程错题提交`995dd2c`已推送。实际读取其PR Quality运行40130504986为completed/success；job 120981011970中的Validate repository与Browser smoke test均success。PR #10仍Draft、未合并。此前课程validate370/370及完整E2E证据保留在[课程交接](2026-10-25-course-weak-integration.md)，不当成本轮重新运行，也不覆盖后续草稿。

T-LEARN-01为未提交开发中状态，已停止进一步编辑并完整保留。数据文件为`web/js/learning-progress.js`、`user-data.js`及两份对应测试；UI为`study-page.js`、`modes/learning-mode.js`、`learning-assessment-page.js`，测试为`lesson-resume-page.test.mjs`、`learning-weak-questions-page.test.mjs`、`learning-assessment-page.test.mjs`；另有新的`learning-recommendation.test.mjs`。实施接口见[原T-LEARN-01实施记录](2026-10-25-learning-recommendation-design.md)。

当前仍缺：

1. `learning-assessment.js`的`recommendLearningTask`纯函数及已约定优先级、稳定排序、坏位置提示；页面已引用，因而当前学习模块不能完成导入。
2. `main.js`接收并执行学习渲染清理函数；欢迎直接进入首课、旧错题入口传递参数。不得将已保存位置的恢复与未提交答案/私文持久化混为一谈。
3. 完整UI夹具和依赖适配；核实多层RAF标题聚焦是否覆盖复讲输入焦点、旧回调是否写新页。这些是待验证项，不写成已复现的新缺陷。
4. 实际浏览器的优先级入口、章节及非零滚动恢复、关闭再进、保存失败、重复交卷与键盘/触控流程；然后运行相关回归、validate和完整E2E。

上述内容均属原T-LEARN-01，不新增任务。未提交应用/测试草稿不随本轮文档推送；下一位AI须保留并接续整合，不能按远程已提交版推断本地工作区可用。

## 本次实际检查

使用现有Node24.19.0，不修改全局PATH、依赖或配置。

| 命令 | 实际结果 | 适用边界 |
| --- | --- | --- |
| `node --test web/test/learning-progress.test.mjs web/test/user-data.test.mjs` | exit 0，47/47 | 当前数据草稿与相关旧数据回归 |
| `node --test web/test/learning-recommendation.test.mjs` | exit 1，0/13 | 缺少新推荐函数，13项均停在API存在性断言 |
| `node --input-type=module -e "import('./web/js/modes/learning-mode.js')"` | exit 1 | 缺少recommendLearningTask命名导出的真实模块错误 |

命令和远程核对摘要见[机器记录](2026-10-25-remaining-work-current-checks.json)。本次不重复启动全量validate/E2E，不把当前失败隐去。UI代理报告局部7项续读及2项入口红→绿，此处仅记录其交接信息，不代替集成验收。

148份应用、测试及工具文本文件的冻结SHA256见[源码快照](2026-10-25-remaining-work-current-source.json)，文档整理后逐项比较无变化；已有未提交修复和原始日志全部保留。实际文档检查15份、48卡、86需求无问题；开放43项与原48减5完全一致，没有遗漏、多列或重复。文档diff检查通过，仅有仓库LF/CRLF转换提示；这些结果不由业务CI推断。

## 下一步与边界

先完成T-LEARN-01已有接口与集成；T-QUIZ-01前置也已满足，但共享文件须协调。其余项目按原依赖推进。T-QA-01、模态、真实设备/读屏/200%缩放、性能、Windows新包及内容许可/双校仍开放；六家仍0/64、0/3840、门禁关闭。

GitHub只同步开发文档、任务和Draft PR。无main合并、Pages/Release、云端建设或私人数据外发。10项建议维持建议性质；外部证据缺失逐项登记，不伪造验收。
