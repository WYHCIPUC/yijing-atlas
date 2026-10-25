# 2026-10-25 当前剩余工作盘点记录

本记录服务于用户要求：在现有进度上盘点全部未完成内容，并写出可直接设定项目目标的文字，不新增需求。本次仅修改文档、读取现有证据和运行有限核对；没有修改应用或测试代码，没有继续执行产品修复。

## 1. 快照与口径

- 本地分支：`codex/immersive-astrolabe-progress`。
- 核对时HEAD：`1bee1c210d675d8aa49df23c0724ba577ad8cf6d`；GitHub开发分支/PR头相同。
- 工作区已有考评契约、指针取消、resize断言、探针、测试与文档修改，均保留。已提交版本和未提交实现分开记载。
- 应用仍为`1.1.1-rc.2`，原生静态架构；没有新增后端、运行库、算法或持久化需求。
- [原执行卡](../12-ai-execution-tasks.md)48张，T-DIV-01正式完成；[逐项清单](../REMAINING-WORK-AND-GOAL.md)其余47张各出现一次。
- 47张正式开放卡＝36已确认＋10建议＋1未来独立发布。其中T-SAVE-01和T-LEARN-05本地实现与专项验收已完成、待整合交付；其他45张＝34已确认＋10建议＋1未来方案，仍有开发、验证或外部输入待办。不用开放卡数计算产品完成率。
- 此次未把建议改成已确认要求，也未增加任务编号。复习幂等、复讲隔离/保存重试归T-LEARN-03；梅花当次时区/来源归T-DIV-03，都是原专题已经写明的要求。

## 2. 当前实现与证据

| 项目 | 已取得的依据 | 当前剩余 |
| --- | --- | --- |
| T-SAVE-01 | [保存专项](2026-10-25-reading-save-probe.md)，最新19:00 UTC轮8/8；失败中关闭重进、恢复重试、部分成功保全及焦点均有证据 | 整合审阅、提交探针/证据、同步开发分支及卡片交接；不再称保存功能未做 |
| T-LEARN-05 | [考评专项](2026-10-25-assessment-session-browser.md)，最新19:08 UTC轮9/9；正式ID契约与回归已进入工作区 | 整合审阅、提交同步与交接；阶段/综合考评入口仍属T-GROW-01，不能扩称全部学习流程完成 |
| T-QA-01 resize | [独立时序报告](2026-10-25-reading-resize-diagnosis.md)记录响应早于media change/模态更新；[helper回归](2026-10-25-reading-state-green.log)6/6 | 将当前局部修复纳入最终集成验收；不倒推无trace的历史失败 |
| T-QA-01 输入 | [新增边界](2026-10-25-entry-input-probe.md)中Canvas内第二指取消、触控中断镜头通过；Canvas外第二指实际失败 | 修复跨区域第二指；补减少动态聚焦新帧后第二次Canvas选择、真实窗口blur；区分注入失捕获与物理失捕获 |
| T-MODAL-01 | resize取证中透明工具虽不可鼠标命中，仍可由真实Tab/Enter触达 | 隐藏控件移出Tab顺序及原卡其他焦点/模态问题 |

专项采用隔离合成数据、可信CDP输入，不是手机真机或读屏验收。保存专项没有完成全键盘遍历或真实备份界面替换；考评专项没有新增离页恢复旧卷入口。上述限制保留在报告，不能任意变成原卡之外的新业务需求。

## 3. 验证版本不能混用

工作区在补入跨区域第二指红回归之前，已有以下记录：

- [validate日志](2026-10-25-contract-input-validate.log)：61个测试脚本；覆盖率阶段286/286，20个配置模块集合行99.77%、分支91.70%、函数98.93%。
- [标准E2E日志](2026-10-25-contract-input-e2e.log)：五视口、鼠标/键盘/模拟触控、减少动态及WebGL降级通过。

随后新增的跨区域第二指测试仍为红灯。本次盘点实际再次执行：

```powershell
node --test web/test/star-pointer-lifecycle.test.mjs
```

退出1，6项中5通过、1失败；失败点为缺少可接收Canvas外第二触点的窗口级pointerdown处理。见[本次日志](2026-10-25-inventory-pointer-check.log)。独立[浏览器trace](2026-10-25-entry-input/2026-10-24T19-11-23-696Z/trace.json)已先取得实际行为红灯，不能只拿该逻辑断言作为用户故障的唯一证明。此问题继续归原T-QA-01，不新增功能。

本次未重新运行全量validate/E2E，也未修改产品来消除红灯。当前工作区不得登记全量门禁通过。真机、读屏、真实200%缩放、当前完整性能及Windows新包验收仍缺；六家内容保持0/64卦、0/3840已校锚点及releaseReady=false。

## 4. GitHub核对与同步边界

本次实际读取远程状态：

- [Draft PR #10](https://github.com/WYHCIPUC/yijing-atlas/pull/10)为OPEN/Draft，base为main，head为上述1bee1c2。
- [Issue #9](https://github.com/WYHCIPUC/yijing-atlas/issues/9)为OPEN。
- 1bee1c2的[push Quality](https://github.com/WYHCIPUC/yijing-atlas/actions/runs/40123033254)与[PR Quality](https://github.com/WYHCIPUC/yijing-atlas/actions/runs/40123036199)均completed/success。

这些CI只覆盖已提交版本，不能证明本地未提交修改通过。本次已将47项完整清单、分类、最新红灯和目标文字同步到[Issue #9进度记录](https://github.com/WYHCIPUC/yijing-atlas/issues/9#issuecomment-6388432118)。同步的是盘点记录，本地应用、探针与新文档仍为未提交增量；没有合并main、发布Pages/Release或关闭建设Issue。

## 5. 文档检查与接手次序

机械核对结果另存[清单检查快照](2026-10-25-current-inventory.json)。检查包括48卡对47行覆盖、分类、现有依赖引用、文档链接及15个实施文件在本次盘点期间未改变。文档检查命令`node docs/development/tools/check-docs.mjs`实际退出0：15份文档、48卡、86需求、695个本地链接，无问题；`git diff --check`退出0。未使用只适用于首次文档工程的历史source-guard。一次临时计数脚本最初错误地从任务索引读取需求性质而报错；改为读取每张卡的需求字段后，48/47及36/10/1计数通过，未改任务分类来迎合检查。

另由独立AI只读复核数量、两项原卡完成条件、当前红灯和目标范围，并修正了四条需求矩阵中的过时状态。没有将真实手机、全部阶段入口或真实备份UI等其他范围追加为这两项的新门槛。

后续先处理T-QA-01已复现失败，再完成两个本地专项成果的整合交付；其他工作严格依据原卡前置。已确认卡依赖建议卡时保留原依赖，建议未采纳就登记前置未满足，不能借盘点自动采纳整张建议卡。目标文字位于[清单第12节](../REMAINING-WORK-AND-GOAL.md#12-可直接用于设定项目目标的文字)。

此前专项曾尝试清理隔离临时浏览器目录，自动审批返回`rejected: blocked by policy`，未说明更细原因；对应目录和限制已写入各专项报告。本次未重试清理或换工具绕过，项目文档与证据不依赖这些临时目录。
