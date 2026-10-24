# 2026-10-25 未完成事项最终盘点

## 任务与口径

用户要求在已有进度基础上盘点全部未完成项、逐项说明缺口，并提供可用于设定目标的文字。本次维护[完整清单](../REMAINING-WORK-AND-GOAL.md)及原执行卡，不新增需求，不继续业务实现，不把部分引擎实现认定为用户流程完成。

原48张卡保持不变：T-DIV-01、T-SAVE-01、T-LEARN-05、T-SEARCH-01已完成；开放44张＝33项已确认＋10项建议＋1项独立发布。9组逐项清单为2/7/5/4/3/5/7/4/7项，不以卡数计算产品完成率。

## 源码与未提交工作

- 已提交源码：`83ba8d44b01a2fb87d9777bee1a95f3c970d7cf4`，分支`codex/immersive-astrolabe-progress`。
- GitHub远程分支和Draft PR #10已实读为同一SHA；没有合并main、Pages或Release发布。
- 原有未提交文件共6份：`web/js/learning-assessment.js`、`web/js/learning-curriculum.js`、对应两份测试，以及`web/test/learning-progress.test.mjs`、`web/test/user-data.test.mjs`。
- T-LEARN-02仅完成题库公开引用、原题必入普通小试、失效引用拒绝与判分引用传递；学习记录和备份业务文件未修改。新增8项失败测试已经说明未实现边界。
- 仍需实现弱项字段校验、同键保存与纠正、同轮去重、损坏记录保护、只读查询和导入错误路径；仍需接通今日/温故/考评结果入口、原课/原题往返与保存反馈，再做浏览器和整合验收。
- 不删除或提交这批尚未完成的源码/测试，不把它们混入本次文档提交。核对后的哈希与检查结果保存在同名JSON记录中。

## 本次实际检查

在项目根目录，用现有Node 24运行：

```powershell
& 'C:\Users\1\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --test web/test/learning-curriculum.test.mjs web/test/learning-assessment.test.mjs web/test/learning-progress.test.mjs web/test/user-data.test.mjs
```

实际49项、41通过、8失败，退出码1；没有取消、跳过或todo。题库/组卷15项通过，学习记录/备份34项中26通过、8失败。失败分别是：

1. 成绩、ID、凭据与弱项同次保存尚未实现。
2. 同题同版本的错误归并、答对纠正与再错重开尚未实现。
3. 弱项和成绩写失败后的原子重试尚未实现。
4. 非法逐题引用拒绝尚未实现。
5. 损坏弱项读保护及写拒绝尚未实现。
6. 稳定排序且不变更原对象的弱项查询尚未实现。
7. 成绩截断后弱项/幂等保全及特殊题号回归尚未实现。
8. 备份非法弱项的逐字段错误定位尚未实现。

没有运行当前未提交工作区的全量validate或E2E。搜索提交之前的62脚本/317项及完整浏览器通过记录仍仅证明其适用源码。当前8项失败不能写成通过，也不能据此倒推已提交搜索版本失败。

文档检查实际通过：15份入口/专题文档、48张卡、86个需求号、711个本地链接，0问题。开放卡机器比对及独立AI只读复核均确认44个唯一编号一一对应，33/10/1分类与原卡一致。独立复核指出的课程错题状态遗漏、基础矩阵历史失败混用已修正文案；没有关闭额外任务。`git diff --check`通过。外部手机、读屏、真实200%缩放、当前完整性能、Windows新包和内容校勘缺口保持原状态。

已提交搜索源码`83ba8d4`的[push Quality](https://github.com/WYHCIPUC/yijing-atlas/actions/runs/40128195308)和[PR Quality](https://github.com/WYHCIPUC/yijing-atlas/actions/runs/40128200588)均为completed/success。它们不覆盖上述6份未提交改动。[GitHub最新44项清单与目标](https://github.com/WYHCIPUC/yijing-atlas/issues/9#issuecomment-6388945685)和[Draft PR #10](https://github.com/WYHCIPUC/yijing-atlas/pull/10)均已同步并读取核对正文一致，历史45项记录保留适用时间。178个受保护的源码/配置/测试文件哈希核对无变化，同名JSON保存详细记录。

## 目标与后续边界

[清单第12节](../REMAINING-WORK-AND-GOAL.md#12-可直接用于设定项目目标的文字)为可复制目标。10项建议仍待采纳；已有任务依赖建议项时写明前置未满足，不能据此扩大整张建议卡范围。账号、云同步、数据库和管理后台不属于本次目标。

复习同轮幂等/失败重试、复讲旧响应/仅保存重试、梅花时间来源/当次时区这三条既有要求保留在原卡内，不新增编号。内容底本、许可、双校、真机和读屏证据不能伪造。GitHub开发同步与生产发布分开记录。
