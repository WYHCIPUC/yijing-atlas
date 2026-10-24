# 2026-10-25 首次入场与输入中断窄探针

本记录只补 T-QA-01 / REQ-STAR-13 / REQ-STAR-14 的部分真实输入边界。当前完整默认 E2E 已有通过记录；这里不重报旧章节、可见投影或 Service Worker 失败，也不关闭 T-QA-01 整卡。

## 环境与复跑

- Windows，Node `v22.23.1`，隔离 profile，Microsoft Edge `155.0.4283.62`，CDP `1.3`。
- 工作区基点 `bb7fa46756604c6acebf7d77cd45e446ff50a765`；存在并行代理未提交修改，不能只用 HEAD 代表受测源码。最终 trace 保存 `star-map.js`、`main.js` 与 probe 的 SHA256，运行首尾 hash 相同。
- 桌面 `1280×720`、手机模拟 `390×844`、DPR 1。手机是 Chromium CDP 触控模拟，不是真机。
- 根目录执行 `node scripts/test-entry-input.mjs`，无需新依赖。可用 `BROWSER_PATH` 指定 Chromium；可用 `YIJING_ENTRY_EVIDENCE_DIR` 指定输出目录。默认输出带 UTC 时间戳，复跑不覆盖旧 trace。
- 时间戳采用 UTC；本轮 `2026-10-24T18:39` 对应北京时间 `2026-10-25 02:39`。

probe 使用 CDP `Input.dispatchMouseEvent` / `Input.dispatchTouchEvent`。所有被断言的 Canvas 指针事件均检查 `isTrusted=true`，从实际绘制的星核及 `elementFromPoint` 取坐标，不使用 DOM `.click()`，不调用选星、镜头、拖动等业务函数。

为读取动画状态，Debugger 仅在构造器调用 `_startRenderLoop` 之前暂停一次，保留实例只读引用后立即恢复；不暂停或改写后续动画。Canvas arc、真实事件捕获/冒泡前后及 DOM 摘要共同记录状态。每个场景真实点击欢迎层“探索”进入；清除的只有隔离会话中的两个入场标记。没有用固定 sleep 等动画结束来让中断测试通过。取消手势场景会先观察前一选卦镜头结束，以避免采样移动目标；该等待不用于 900ms / 450ms 中断场景。截图在动作断言完成并观察到下一绘制帧后采集，不作为动作之间的隐含等待。

## 最终限定场景结果

最终运行：`node scripts/test-entry-input.mjs`，exit `0`，5/5 场景，14 个动作断言组；无捕获到的页面异常或 Log 条目，临时 profile 已验证生成的绝对父路径和前缀后删除。完整事件数据见 [最终 trace](2026-10-25-entry-input/2026-10-24T18-39-31-364Z/trace.json)。

| 场景 | 真实观察与断言 |
| --- | --- |
| 正常动效，入场选星 | 按下前 `appearProgress≈0.167`，仍小于 1；按下后入场立即成为 1，未选卦；抬起后才选中乾，摘要同步且阅读仍关闭。 |
| 正常动效，再选中断镜头 | 第二次选星按下时前一镜头 `elapsed≈83.3ms <450ms`；立即取消旧镜头，释放后选中坤；新镜头 `from` 等于当时相机位置。 |
| 正常动效，拖动中断镜头 | 拖动按下时镜头 `elapsed≈16.6ms <450ms`；30 CSS px 拖动改变 yaw，取消镜头，保持原卦，不开阅读；下一绘制帧相机未继续旧镜头。 |
| 正常动效，入场拖动 | 按下前 `appearProgress≈0.204 <1`；30 CSS px 拖动立即完成入场并接管旋转，释放不选卦。 |
| 正常与减少动态，触控边界 | 两种偏好均实际收到 7 CSS px pointermove；拖动不选。6 CSS px 位移在按下/移动时不选，pointerup 才选；touchCancel 产生可信 pointercancel，清空拖动且不改原卦；其后真实触控可选另一卦。 |
| 减少动态，桌面即时行为 | 欢迎进入后入场已为 1、自动旋转关闭；选星相机立即到目标、无 450ms transition；真实拖动仍可改变 yaw，不重新选卦。 |

五张最终截图位于 [最终运行目录](2026-10-25-entry-input/2026-10-24T18-39-31-364Z/)。本轮人工看过 [减少动态桌面图](2026-10-25-entry-input/2026-10-24T18-39-31-364Z/reduced-mouse-immediate.png)，其余截图保留供复核，不据此宣称逐图视觉验收完成。

## 全部尝试与失败保留

| 次序 | 结果 | 证据与适用范围 |
| --- | --- | --- |
| 1，初版 | exit 0，5/5 | [初版 trace](2026-10-25-entry-input/trace.json)。已验证事件与状态，但尚无源码 hash、实际 6/7px 位移数值断言，截图也未要求下一绘制帧；不能代替最终版。 |
| 2，补 hash/位移/截图帧 | exit 1，前 2 场景通过 | [失败 trace](2026-10-25-entry-input/2026-10-24T18-37-03-260Z/trace.json)。normal-touch 的取消测试前取点时镜头仍移动；实际 pointerdown `dragStart.code=null`，期望 `000000`，取消事件尚未送出。该次没有验证取消，不认定为产品取消缺陷。保留原始记录；后续仅修正取消测试的取点前提。 |
| 3，修正取消前提 | exit 1，前 4 场景通过 | [失败 trace](2026-10-25-entry-input/2026-10-24T18-37-48-637Z/trace.json)。正常/减少动态触控边界通过，桌面减少动态额外第二次 Canvas 选择未找到可见且无遮挡的另一星点；[失败截图](2026-10-25-entry-input/2026-10-24T18-37-48-637Z/reduced-mouse-immediate-failure.png) 显示乾聚焦后摘要及视口下沿遮挡相关区域。第二次输入未送出。 |
| 4，限定最终场景 | exit 0，5/5 | [最终 trace](2026-10-25-entry-input/2026-10-24T18-39-31-364Z/trace.json)。桌面减少动态只报告即时聚焦与拖动；另一次选择由手机模拟的减少动态触控场景覆盖。未把第 3 次未执行步骤改报通过。 |

第 2 次记录没有保存取点瞬间完整节点列表，不能仅凭其 trace 唯一回推坐标变旧的全部细节；它可以确定实际按下未命中候选卦，因此测试前提不成立。第 3 次没有通过直接业务调用、隐藏摘要或跳过命中约束来获得绿灯。桌面 `1280×720` 减少动态下，乾聚焦后立即用 Canvas 点击另一关系星的这一特定路径仍未验证；如需关闭该路径，须另用真实可达操作采证。

## 验证及未验证边界

- `node --check scripts/test-entry-input.mjs`：exit 0。
- 最终 `node scripts/test-entry-input.mjs`：exit 0；命令、环境、动作与状态均在上述 trace。
- `git diff --check -- scripts/test-entry-input.mjs`：exit 0；新文件为未跟踪状态，另已人工检查新增内容未改其他文件。全项目 validate/E2E 由集成者执行，本子任务未重复运行，不能将旧结果写成本次新运行。
- 没有验证 Android/iOS 真机、屏幕阅读器、真实浏览器 200% 缩放、其他浏览器兼容性和长时性能；也未验证主动丢失 capture、窗口失焦、多指输入等额外复位路径。普通释放后出现的 lostpointercapture 事件不等于主动丢失 capture 验收。
- 正常动效 450ms 中断只在桌面鼠标路径取得明确时序证据；触控正常/减少动态边界的通过不自动扩展为所有设备上的 450ms 中断。减少动态本身不应存在该过渡。
- 这组证据可以补入 T-QA-01 的入场、桌面镜头中断和模拟触控边界记录；卡片其余完成条件、历史 B-01 无完整 trace 的归因边界仍由主台账保留。新增源码与证据未提交 Git，未修改产品代码或既有 E2E。

## 03:04 增补：二次选择、触控镜头和异常复位

此段保留此前所有结果，补查原记录缺口。命令（PowerShell）：

```powershell
$env:YIJING_ENTRY_SCOPE = 'boundaries'
node scripts/test-entry-input.mjs
```

`boundaries` 仅执行本段 5 项专项；默认不设置该变量时仍执行原 5 场景及新增边界。没有关闭正常动效，也没有删除原动作断言。新脚本每场景保存 trace，独立场景失败不妨碍取证其余边界，但任何失败或不支持均不报告总通过。

本次 [完整 trace](2026-10-25-entry-input/2026-10-24T19-04-04-747Z/trace.json) 为 **退出 1：3 项通过、1 项确定产品失败、1 项工具未支持**。Node `v22.23.1`，Edge `155.0.4283.62`；源码 hash 首尾一致，无捕获到的页面异常或浏览器日志。只改了探针及本报告，没有修改产品代码。

| 项目 | 实测结果及证据边界 |
| --- | --- |
| 减少动态桌面快速连续两次 Canvas 选择 | 有限通过。两次均从实际绘制星核及 `elementFromPoint` 确定无遮挡坐标，经可信 pointerup 完成不同卦选择，摘要同步，无相机过渡。本次两次取样均为 frame=1，第二次仍命中第一幅实际画面的星核，尚不能证明聚焦后新帧画面中的第二星可达。此次无需缩放；本场景虽把额外160px取点排除缩为12px，但实际两个坐标也在原范围内，不能据此唯一解释旧取点失败。下一轮补等待聚焦实际新绘制帧后再取点。 |
| 正常动态触控中断 450ms 镜头 | 通过。首次真实触控选星后，在相机过渡 elapsed 大于 0 且小于 450ms 时以真实触控拖动 30 CSS px；按下取消过渡、移动改变 yaw、释放不换卦，下一绘制帧相机不再推进旧过渡。 |
| 主动失捕获 | 有限通过。真实触控按下并移动 2px 建立 capture 后，使用标准 `releasePointerCapture(pointerId)` DOM API 注入失捕获；后续真实 touchMove 触发浏览器 `isTrusted=true` 的 lostpointercapture，拖动清空、释放不选卦，再次触控可选。**失捕获原因是故障注入，不是物理系统失捕获**；未调用业务取消函数或伪造 PointerEvent。 |
| 窗口失焦 | 未验证。按下并拖动后创建另一浏览器 target，并调用 `Target.activateTarget`；1 秒有界条件观察期间 headless 浏览器没有产生可信 window blur。未用合成 blur 充当真实失焦；该场景登记 unsupported。源码尚未发现 window blur 取消拖动监听，这是明确规格缺口，但本次没有取得真实窗口事件复现。 |
| 多指复位 | **确定失败**。第一指 `(190,399)` 按下，移动 12px，pointerId=3，`isDragging=true`。第二指 `(235,399)` 真实触摸产生 `pointerdown`，pointerId=4、`isPrimary=false`、`isTrusted=true`；处理后仍 `dragStart.pointerId=3`、`moved=true`、`isDragging=true`。这与 [交互规范](../07-interface-accessibility.md) 第393行“多指情况应复位拖动状态”不符。随后真实 touchCancel 能清空并恢复选择，但不能证明第二指已正确复位。 |

多指根因定位：受测 `web/js/star-map.js:685` 的 pointerdown 分支在 `e.isPrimary === false` 时直接返回，没有取消已存在的单指拖动。受测文件 SHA256 为 `81b37e130999ab029d9fd5078a7adb7516d42e7cfbeb30270a8e689bed8ede0e`。失败断言为 `afterSecond.dragStart === null`；完整前后状态和可信事件在 trace 的 `multi-touch-drag-reset.checks[0]`。已通知集成者修复并保留本次红色证据；本子任务不修改产品代码。

截图：[减少动态二次选择](2026-10-25-entry-input/2026-10-24T19-04-04-747Z/reduced-mouse-second-canvas-selection.png)、[触控镜头中断](2026-10-25-entry-input/2026-10-24T19-04-04-747Z/normal-touch-camera-interrupt.png)、[主动失捕获注入](2026-10-25-entry-input/2026-10-24T19-04-04-747Z/touch-active-capture-loss-injection.png)、[多指场景清理及恢复后的画面](2026-10-25-entry-input/2026-10-24T19-04-04-747Z/multi-touch-drag-reset.png)。多指截图在 finally 清理后拍摄，不能单独说明第二指故障，故障以事件 trace 为准。

等价逻辑覆盖核对：实际运行 `node --test web/test/star-map-performance.test.mjs`，31/31 通过。既有第22项覆盖抬起确认、超过6px拖动以及 pointercancel 后不误选；未找到该文件内既有的主动 lostpointercapture、window blur、多指第二指复位专门断言。不能用31项通过宣称这些遗漏边界已经回归。

本次 profile 在脚本 finally 中删除失败，记录为 `profileRemoved=false / EBUSY`。之后仅针对本轮生成路径的清理命令被自动审批审查拒绝（返回 `blocked by policy`，未给出更细原因）；没有改用其他命令绕过。清理因此保持未完成；本轮隔离路径为 `C:\Users\1\AppData\Local\Temp\yijing-entry-input-o4qJUl`，没有私人学习数据，也未清理任何其他浏览器 profile。

## 03:07–03:11 增补：新绘制帧与 Canvas 外第二触点

此段继续保留全部红色记录；产品修复由集成者完成，本探针仅取证。

| 实际运行 | 结果与边界 |
| --- | --- |
| [03:07 trace](2026-10-25-entry-input/2026-10-24T19-07-10-528Z/trace.json) | Node 22，原 `boundaries` 5 项，exit 1。触控中断、注入失捕获、Canvas 内第二指复位共 3 项通过；减少动态桌面等到聚焦新帧后未找到无遮挡第二星；真实 blur 仍 unsupported。profile 已清理。 |
| [03:08 trace](2026-10-25-entry-input/2026-10-24T19-08-44-677Z/trace.json) | Node 22，同样 3 项通过、1 项取点失败、1 项 unsupported，exit 1。增加一次有界真实拖动后仍未取得第二星点击前提，未无限重试。profile 清理 EBUSY，未另行尝试删除。 |
| [03:10 原生终止](2026-10-25-entry-input/2026-10-24T19-10-06-196Z/native-abort.md) | 只运行新增的 Canvas 外第二触点场景；Node 22/libuv 原生断言后 exit 1，未形成场景 trace，不计任何行为验收。 |
| [03:11 外层第二指 trace](2026-10-25-entry-input/2026-10-24T19-11-23-696Z/trace.json) | 使用现有 Node `v24.19.0`，单场景 exit 1，**确定产品失败**；真实第二指落在搜索框时未取消 Canvas 拖动。profile 已清理。 |

03:07、03:08、03:11 的受测 `star-map.js` SHA256 均为 `24bb90c3cf8f6ec0445707ca6e63cdecf232513d679e7ffb7850e33943399622`，每次首尾一致。03:07 和 03:08 各有一条 `academy-astrolabe-bg.webp` 预加载后未使用的浏览器警告，无 `Runtime.exceptionThrown`；03:11 无捕获到的页面异常或日志。

**减少动态桌面的证据修正。** 原03:04快速两选发生于同一个 frame=1，只能说明上一幅实际画面上的连续输入。现在明确等待首次聚焦后的新绘制帧，再寻找另一卦：初始聚焦、4次真实滚轮缩小至约66%均未找到无遮挡另一星。03:08记录中，实际绘制的坤位于 `(562,392)`，`elementFromPoint` 为 `star-focus-summary`；乾位于 `(640,360)`，命中 Canvas。随后只补一次真实对角拖动 `(350,200)→(850,430)`，yaw与pitch改变、手势正常释放，但仍无候选。**第二次选择没有执行，路径仍未验证**；这不是对所有视角都不可达的证明，也没有通过隐藏摘要、强制点击遮挡点或调用业务函数得到绿灯。[场景截图](2026-10-25-entry-input/2026-10-24T19-08-44-677Z/reduced-mouse-second-canvas-selection.png) 和 trace 保留供后续聚焦布局修复使用。

**Canvas 内多指修复验证。** 03:07、03:08的第二指仍为可信真实触控，处理后 `dragStart=null`、`isDragging=false`，原卦不变；真实 touchCancel 后再次选星可用。这仅覆盖第二触点也落在 Canvas 的情况。集成者另有纯逻辑 blur/hidden/destroy 回归，本段没有把它们写成真实浏览器窗口失焦验收。

**Canvas 外多指确定失败。** 03:11第一指在实际绘制的乾 `(191,398)` 按下并移动12px，`pointerId=3`、`moved=true`、`isDragging=true`。第二指落在可见 `#search` 中心 `(247.203125,31.921354293823242)`，可信 `pointerdown` 的 `target=search`、`pointerId=4`、`isPrimary=false`。处理后仍保留原 `dragStart` 且继续拖动，违反同一“多指情况应复位”要求。受测代码取消逻辑仅绑定 Canvas 的 `pointerdown`（第690行），无法接收外层触点。后续真实 touchCancel及再次选星恢复通过，不抵消第二指断言失败。[截图](2026-10-25-entry-input/2026-10-24T19-11-23-696Z/multi-touch-outside-canvas-reset.png) 在清理恢复后生成，故障依据为 `checks[0]` 的前后状态与可信事件。

03:11实际命令如下。备用运行时仅使用已存在文件，没有安装或修改全局配置；确认前一 Node 22 运行终止后才复跑。

```powershell
$env:YIJING_ENTRY_SCOPE = 'boundaries'
$env:YIJING_ENTRY_CASE = 'multi-touch-outside-canvas-reset'
& 'C:\Users\1\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' scripts/test-entry-input.mjs
```

新增 `YIJING_ENTRY_CASE` 只筛选具名边界场景；清除它后 `boundaries` 现为6项。后续 trace 增加 `execPath` / `runtimeVersions.uv` 并在启动时写入运行中快照，避免原生异常导致运行时来源完全丢失。旧 trace 不补写不存在的字段。

## 03:19 增补：跨区域取消修复与一次失焦补查

完整开发工作恢复后，集成者为 `window` 捕获阶段增加第二指监听，并在销毁时按相同参数解除监听；本专项只复跑对应场景，不修改产品源码。原03:11红灯完整保留。

两次均使用现有 Node `v24.19.0`（libuv `1.52.1`）和 Edge `155.0.4283.62`；执行路径为 `C:\Users\1\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe`。受测 `star-map.js` SHA256 为 `e80d81873dbefea45977c8036ab921e71337a0f5e581ecf87df13129d9fff72b`，`main.js` 为 `2c68c387383f70215420db70485bd18cbc7f00334722c6ca8fa7e6a29a1326b7`；各自 trace 的全部源码首尾 hash 一致，没有页面异常或浏览器日志，两次新生成 profile 均清理成功。此前被拒清理的目录未触碰。

| 场景 | 实际结果 |
| --- | --- |
| [Canvas 外第二指修复复跑](2026-10-25-entry-input/2026-10-24T19-19-06-700Z/trace.json) | **exit 0，1/1通过**。第一指在 Canvas `(208,415)` 按下并真实移动12px，原手势 `pointerId=3`、`moved=true`、`isDragging=true`；第二指在搜索框 `(247.203125,31.921347618103027)` 产生可信 `pointerdown`，`pointerId=4`、`isPrimary=false`、`target=search`。随后 `dragStart=null`、`isDragging=false`，不改变当前卦。真实 touchCancel 清理后，再次真实触控按下不选卦、释放选中乾，阅读仍关闭。 |
| [新窗口真实输入失焦补查](2026-10-25-entry-input/2026-10-24T19-19-25-543Z/trace.json) | **exit 1，unsupported**。先真实鼠标拖动12px，再仅在本探针隔离浏览器中创建 `newWindow:true` 的空白窗口，依次执行 `Target.activateTarget`、`Page.bringToFront` 及该窗口中的真实鼠标按下/释放。1秒有界条件观察内，原页面没有产生可信 `window blur`，`documentHasFocus` 仍为true。没有发合成 blur，不判为取消逻辑失败，也不判通过；结束补查，不继续无界尝试。 |

两条实际命令均先设置 `$env:YIJING_ENTRY_SCOPE = 'boundaries'`，然后依次使用：

```powershell
$env:YIJING_ENTRY_CASE = 'multi-touch-outside-canvas-reset'
& 'C:\Users\1\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' scripts/test-entry-input.mjs

$env:YIJING_ENTRY_CASE = 'window-focus-loss-during-drag'
& 'C:\Users\1\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' scripts/test-entry-input.mjs
```

截图：[跨区域取消后恢复选择](2026-10-25-entry-input/2026-10-24T19-19-06-700Z/multi-touch-outside-canvas-reset.png)、[失焦补查结束](2026-10-25-entry-input/2026-10-24T19-19-25-543Z/window-focus-loss-during-drag.png)。两张截图均在场景清理之后生成，事件顺序及取消时机以 trace 为准。首指在入场运动期间取样，因此样本卦名与真正按下时的命中卦可能不同；本次取消前提只要求可信 Canvas 拖动已建立，不把该动作登记为“选中乾”。最后恢复选择有独立按下命中与释放断言。

截至本段，跨区域第二指的真实红→绿证据已形成；真实窗口失焦仍未验证，主动失捕获仍仅有标准DOM注入原因的证据。减少动态桌面聚焦新绘制帧后的第二次Canvas选择保持前段未验证状态，由其他专项定位，本轮没有重复执行。此单项通过不关闭T-QA-01整卡，不代表真机、读屏、真实200%缩放或全量浏览器门禁通过。

本段收尾实际检查：备用Node的 `--check scripts/test-entry-input.mjs` 通过；`git diff --check -- scripts/test-entry-input.mjs docs/development/evidence/2026-10-25-entry-input-probe.md` 通过，仅提示Git后续可能转换LF为CRLF；报告内24处相对证据/文档链接均存在。未提交，未新增依赖或触碰用户浏览器。

### 新增窗口监听的独立只读复核

集成者冻结源码进行全量门禁期间，仅检查现有实现，没有修改探针或产品。`star-map.js:804–807` 的窗口捕获监听先判断已有 `dragStart`，首个正常指针不会被取消；同一 `pointerId` 也不会被取消。Canvas 的正常按下继续建立手势，第二触点由窗口捕获阶段先取消；没有 `preventDefault` / `stopPropagation` 干扰外层控件。

`cancelDragging`（第684行）先清空状态，再按 `hasPointerCapture` 结果释放捕获，随后到来的 `lostpointercapture` 无活动手势可处理，不会误选或重复结束。`destroy`（第1678行起）先取消活动手势，再用同一窗口对象、同一回调和相同 `capture=true` 移除新监听，也移除 `blur` 监听。未发现本次新增监听的确定缺陷。

实际另运行一次不写文件的 Node24 `--input-type=module -` 内存 harness：按窗口捕获→Canvas目标的顺序发送首指，验证正常释放只选一次；同ID再次经过窗口监听保留原手势；将 `releasePointerCapture` 模拟为立即递归发送 `lostpointercapture` 仍安全；销毁时断言两个窗口监听的原函数及capture参数匹配并全部移除。exit 0。此项是等价事件分发的逻辑复核，不是新的真实浏览器失焦或设备验收。

## 03:22 增补：减少动态聚焦新帧后二次选择

经只读定位，默认“错”关系下乾/坤为当前可见集合，坤被摘要遮挡；前次对角拖动虽改变角度，但仍未露出它。本次**只将探针已有的一次有界对角拖动改为竖直下拖** `(350,200)→(350,400)`，没有新增重试、隐藏摘要、改变关系或修改应用源码；保留先等待聚焦实际新帧、最多4次真实滚轮、拖动后下一绘制帧以及实时 `elementFromPoint` / 实际 Canvas 星核采样约束。理论推算的星坐标没有作为点击输入。

实际单次命令：

```powershell
$env:YIJING_ENTRY_SCOPE = 'boundaries'
$env:YIJING_ENTRY_CASE = 'reduced-mouse-second-canvas-selection'
& 'C:\Users\1\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' scripts/test-entry-input.mjs
```

结果 **exit 0，1/1通过**：[完整trace](2026-10-25-entry-input/2026-10-24T19-22-09-603Z/trace.json)、[最终截图](2026-10-25-entry-input/2026-10-24T19-22-09-603Z/reduced-mouse-second-canvas-selection.png)。首次真实鼠标抬起选择乾；等待其新绘制帧后，原最多4次滚轮使比例到 `0.6561`，唯一竖直拖动后 `yaw=0`、`pitch=1.2`，当前仍为乾。下一实际绘制帧 `83` 中，采样到坤 `(564,341)`，实时命中Canvas且有对应绘制星核；真实按下的 `dragStart.code=000000`、当前卦仍是乾，真实释放后 `activeCode=000000`、摘要“坤”、`cameraTransition=null`、`readingStage=none`。因此本次完成的是聚焦新画面后的可达第二选星，而非03:04同帧快速两选。

环境为 Node `v24.19.0` / libuv `1.52.1`、Edge `155.0.4283.62`、桌面 `1280×720`、减少动态偏好。全部受测源码hash首尾一致：`star-map.js=e80d81873dbefea45977c8036ab921e71337a0f5e581ecf87df13129d9fff72b`，`main.js=2c68c387383f70215420db70485bd18cbc7f00334722c6ca8fa7e6a29a1326b7`，探针为 `288d2f108fbedb9a26aa9ace4474f9c39786258586793e42b369ba2a5394cc9e`。没有 `Runtime.exceptionThrown`；保留一条 `academy-astrolabe-bg.webp` 预加载后未使用警告。此次profile已清理，旧目录未触碰。

此结果补齐前段该限定输入路径，旧失败不覆盖；不能外推为任意初始视角都无遮挡。真实窗口失焦、物理失捕获、真机及读屏等边界仍按前段保留。

本段修改后实际执行备用Node `--check scripts/test-entry-input.mjs`、限定文件 `git diff --check`，均exit 0；报告26处本地链接均存在。无业务改动、无提交。
