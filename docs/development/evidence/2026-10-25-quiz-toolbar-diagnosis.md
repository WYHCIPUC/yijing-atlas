# T-QUIZ-01：320px定位与返回工具栏遮挡的两次诊断

日期：2026-10-25（Asia/Shanghai）。基于e22d1e3后的在制测验实现。两类失败分别取证、修复，不用一个原因解释全部历史红灯。

## 1. 选项整块可见性失败：定位条件不足

原[失败退出记录](2026-10-25-quiz-weak-input/2026-10-24T22-04-43-464Z/execution.json)为`320-option-visible is not fully visible`。当时超时末项几何未落盘，只能提出定位假设。

随后只给`assertVisible`增加失败几何保存，不改业务或断言；[诊断trace](2026-10-25-quiz-weak-input/2026-10-24T22-10-51-378Z/trace.json)再次失败，保存末项top796.40625、bottom866.40625，裁剪区域bottom844；`centerUnobscured=true`、`fullyVisible=false`。`pointFor`只在中心不可点击时滚动，无法满足后续整块可见断言。

修正仅限320px逐项检查：每个选项先`scrollIntoView(center)`，再等待位置稳定、中心命中及整块可见。没有延长等待或删除断言，选择答案仍由可信CDP输入完成。[定位修复后trace](2026-10-25-quiz-weak-input/2026-10-24T22-11-28-905Z/trace.json)退出0，四选项和结果提示通过；这轮属于工具栏修复前的历史证据。

## 2. 截图复核发现真实界面遮挡

定位通过后的320px截图中，新增“返回温故队列”与悬浮关闭按钮重叠。独立[诊断trace](2026-10-25-quiz-weak-input/2026-10-24T22-13-26-408Z/trace.json)退出1、源码稳定、页面异常为空：返回按钮rect为x208.671875/y133.28125/width95.328125/height64；关闭按钮x260/y130/44×44，交叠44×40.71875px。返回按钮右侧两个采样点实际命中`detail-close`。

根因：关闭工具栏为`sticky`且`height:0`，内容滚动到其下方时会发生覆盖；测验工具栏新增第二个返回动作后仍为不换行flex，没有给关闭按钮预留右侧空间。仅增加正文顶部padding不能解决滚动状态。

正式320px专项加入回归：将工具栏滚到关闭按钮高度，检查两个返回按钮与关闭按钮不相交、九个采样点均命中本按钮、整块可见；再用真实触控验证分别返回随机测验和温故队列，导航不写学习数据。当前CSS先取得[正式红灯](2026-10-25-quiz-weak-input/2026-10-24T22-14-47-544Z/trace.json)，错误为`320px quiz navigation must not overlap the close control`。

## 3. 最小界面修复与真实绿灯

仅修改`web/styles/immersive.css`既有≤600px断点：工具栏允许换行、统计独占一行、右侧留56px；两按钮保持不拆字、至少44px高并取消原下边距。保留DOM顺序、原导航回调和全局关闭行为，不改历法、题型、数据或页面架构。

[正式绿灯](2026-10-25-quiz-weak-input/2026-10-24T22-15-24-543Z/trace.json)及[退出记录](2026-10-25-quiz-weak-input/2026-10-24T22-15-24-543Z/execution.json)：session3953终态exit0。两返回按钮无交叠、四组九点命中全部为true；真实触控分别返回随机/温故，前后存储数据相同且没有写入；原选项和结果提示断言仍通过。集成者已目视[修后截图](2026-10-25-quiz-weak-input/2026-10-24T22-15-24-543Z/320-queue-term-geometry-320-queue-return-control.png)。

修后冻结：CSS SHA256 `8f8060c3b041bbdb7bc8f7b90336861a9aba99552c1722f6dd5a46eddefd9155`；探针SHA256 `8e0610b4aedd2afb6e83d1c0983bf1ed7c21f47555af9927c98888b11ba4e4e2`。完整18场、validate及全站E2E另按最终交接登记；本报告的单场绿灯不自行关闭整卡，也不代表真机、读屏或真实200%通过。
