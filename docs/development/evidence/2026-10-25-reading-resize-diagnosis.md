# T-QA-01 快读断点切换时序诊断（2026-10-25）

## 范围与结论

本次只定位已有烟测在“1440px 桌面快读 → 768px 窄屏快读”之后立即读取 `aria-modal` 的间歇失败，不替代完整 E2E、手机真机、读屏或真实浏览器 200% 缩放验收。需求状态为**已确认**；本条诊断为**本轮验证**，整个 T-QA-01 是否关闭仍由总执行卡及完整回归决定。

真实浏览器已复现：`Emulation.setDeviceMetricsOverride` 返回之后，`innerWidth` 和媒体查询 `matches` 可以已经变为新值，而应用的 `change` 监听尚未执行，`aria-modal` 仍为旧值。媒体查询事件分发后，产品更新模态、背景 `inert` 和工具关闭状态；本次所有样本在下一渲染帧均已一致。

原 `assertReadingStage` 只等待 `stage === 'quick'`，但跨宽度切换前后 stage 都是 quick，因此这一等待不能证明媒体查询回调已完成。随后单次读取 `modal` 存在竞争。本次证据支持修复测试中的**状态同步条件**，不支持为此改产品模态逻辑，也不支持增加固定睡眠。

## 环境与受测版本

- Windows；Node.js `v22.23.1`；独立临时资料目录；Edge `155.0.4283.62`；原生 CDP；静态服务器使用独立临时端口。
- 运行记录中的实际 HEAD 为 `1bee1c210d675d8aa49df23c0724ba577ad8cf6d`。开始调查时先核对过 `30796f7`，随后根任务提交文档；以各 trace 内的 HEAD 与逐文件 SHA256 为准。
- `web/js/main.js` SHA256：`2c68c387383f70215420db70485bd18cbc7f00334722c6ca8fa7e6a29a1326b7`。
- `web/styles/immersive.css` SHA256：`7ff3555ee8a593401b365dfdef36dd5dc0213222650e3d58afd45106873327f1`。
- `git diff --stat 5627bc8 30796f7 -- web/js/main.js web/styles/immersive.css` 输出为空；此项只说明这两个产品文件相同，不把当前诊断伪称为重跑历史 CI。
- 正常动效保持开启，`prefers-reduced-motion: no-preference`。没有修改动画时长、CSS 或应用状态，没有调用业务函数或 DOM `click()`。
- CPU `rate: 4` 仅是 Chromium 节流对照，不代表真实手机、低端设备或性能基准。两组运行环境相同，按记录明示节流值。

## 取证方法

[独立探针](../../../scripts/test-reading-resize.mjs) 使用旧深读链接初始化，真实鼠标点击“返回快读”，再以可信键盘输入建立工具展开状态。每次尺寸切换记录：命令前状态、命令返回后立即状态、`resize`、媒体查询 `change`、相关属性的 `MutationObserver` 通知、下一帧、第二帧。

观察器只读取 DOM、媒体查询和可见状态。媒体查询监听在应用初始化前注册，因此其日志刻意记录应用监听执行前的旧属性；`MutationObserver` 和后续帧再证明应用更新确实发生。测试不会将观察器日志中的旧值误当作最终产品状态。

最终探针具备 30 秒单次 CDP 超时、15 秒双帧超时、页面 `visibilitychange` 记录及每次切换后的 `checkpoint.json`。初始化鼠标点击要求两帧几何稳定且实际命中目标；这用于避免点击移动中的按钮，不是等待断点错误自行消失。

复现命令（PowerShell）：

```powershell
$env:YIJING_RESIZE_ROUNDS = '3'
node scripts/test-reading-resize.mjs
```

不设置轮数时为每组 8 个双向回合；允许 1–100。输出目录可用 `YIJING_RESIZE_EVIDENCE_DIR` 指定。每个回合包含一次 1440→768 和一次 768→1440。

## 结果与原始证据

| 记录 | 条件 | 立即不一致 | 下一帧不一致 | 第二帧不一致 | 适用说明 |
|---|---|---:|---:|---:|---|
| [长组 trace](2026-10-25-reading-resize/2026-10-24T18-57-34-226Z/trace.json) 普通速度 | 20 双向回合 / 40 次切换 | 31/40（窄屏 15、宽屏 16） | 0/40 | 0/40 | 完整普通组证明时序竞争 |
| 同一长组 CPU 4 | 20 双向回合 / 40 次切换 | 0/40 | 0/40 | 0/40 | 中途被 Edge 自动打开扩展/同步页隐藏，不能作为干净性能证据 |
| [最终短组 trace](2026-10-25-reading-resize/2026-10-24T19-04-48-576Z/trace.json) 普通速度 | 禁用扩展；3 双向回合 / 6 次切换 | 5/6 | 0/6 | 0/6 | 完整新探针、来源 hash 全程稳定 |
| 同一短组 CPU 4 | 禁用扩展；3 双向回合 / 6 次切换 | 0/6 | 0/6 | 0/6 | 采样全程 visible；仅说明该组回调先于立即采样完成 |

最终短组 7 次目标按钮输入均为 `isTrusted: true`，12 次切换均通过第二帧状态断言，0 个未捕获 JavaScript 异常。音频自动播放的用户手势限制及未使用 preload 警告保留在 trace 中，不能写成“控制台完全无警告”。

长组普通速度首个窄屏竞争的时间线（页面 `performance.now()`，毫秒）：

| 时点 | 事件 | width / compact | aria-modal |
|---:|---|---|---|
| 1734.10 | metrics 返回后的立即采样 | 768 / true | false |
| 1736.60 | resize | 768 / true | false |
| 1737.10 | compact 媒体查询 change 观察器 | 768 / true | false |
| 1738.80 | 属性 MutationObserver | 768 / true | true |
| 1738.90 | 下一渲染帧 | 768 / true | true |
| 1794.00 | 第二渲染帧 | 768 / true | true |

该样本从立即旧属性到更新的观察窗口为约 4.70ms。普通组全部立即错读样本的窗口约为 4.7–25.1ms；这是本机样本结果，不是跨设备承诺或等待时长依据。

最终短组的首个窄屏样本再次记录：5608.30ms 立即采样为 false，5619.50ms compact change 仍为 false，5622.90ms 属性更新为 true，5623.00ms 下一帧为 true。其采样窗口约 14.60ms。

截图仅表示属性稳定之后的界面，不能用截图证明毫秒级的旧属性；时序以 trace 为准：

- [长组竞态采到后的稳定平板截图](2026-10-25-reading-resize/2026-10-24T18-57-34-226Z/rate-1-race-observed-then-stable-tablet-round-2.png)
- [短组桌面快读截图](2026-10-25-reading-resize/2026-10-24T19-04-48-576Z/initial-desktop-quick.png)
- [短组窄屏稳定截图](2026-10-25-reading-resize/2026-10-24T19-04-48-576Z/rate-1-race-observed-then-stable-tablet-round-1.png)

## 独立的现有模态缺口

快读 CSS 为工具区设置 `opacity: 0`、`pointer-events: none`；真实鼠标无法点击。原主烟测通过 DOM `click()` 打开它，并不能单独作为鼠标路径验收。

本次观察到该隐藏工具按钮仍在 Tab 顺序中。实际路径为“深入研读”→反向 Tab 经“返回星图”、其他按钮、图式选择器→工具，再用 Enter，产生 `isTrusted: true` 的展开操作。因此探针可以通过真实键盘构造同样的已有状态，同时证明隐藏区域移出 Tab 顺序的既定要求尚有缺口。此问题归属 **T-MODAL-01**，不与本次媒体查询时序根因混为一谈，不在本探针中改产品。

## 建议给主任务的最小修复与验收

1. `assertReadingStage` 对单次页面快照中的 `stage`、面板 open、深链接和指定 `modal` 一起进行有界条件等待，失败时输出最后快照。始终错误必须超时失败；不能只等始终不变的 quick，也不能吞掉失败。
2. 增加确定性 helper 回归：起初 stage 已正确而 modal 旧值，后续快照变正确才通过；modal 始终错误超时；反向宽屏变化亦同；open 或链接未到位不能提前成功。
3. 主任务实际运行相关回归与完整 E2E；本次独立探针通过不等于整个用户流程或 PR 已完成。
4. T-MODAL-01 单独修复隐藏工具的键盘可达性，并让后续真实交互测试走用户可达路径。此项已经在原目标范围中，不增加新需求。

## 保留的失败、环境干扰与清理边界

- [第一版探针失败](2026-10-25-reading-resize/2026-10-24T18-56-02-819Z/trace.json)：试图真实鼠标点击快读中被 `pointer-events:none` 隐藏的工具，证实路径不可达，未执行 resize。
- [键盘驱动校正前失败](2026-10-25-reading-resize/2026-10-24T18-57-03-496Z/trace.json)：Enter 未携带 Chromium 所需的回车字符，未触发按钮；此为探针输入错误，之后与项目主烟测的原生键盘事件格式对齐，旧记录不改写。
- [短组首次失败](2026-10-25-reading-resize/2026-10-24T19-03-58-963Z/trace.json)：初始按钮仍在过渡中，鼠标未触发快读；随后补命中与两帧几何稳定条件，保留原失败。
- 长组 CPU 4 中，自动扩展/同步页令测试页变为 hidden，RAF 暂停；确认原进程仍 live 后，仅将该测试页带回前台继续。旁路只读保存的 [interim-visible-trace.json](2026-10-25-reading-resize/2026-10-24T18-57-34-226Z/interim-visible-trace.json) 包含当时完整日志及干扰说明。
- 长组执行期间根任务修改了 `scripts/browser-smoke.mjs`，所以该组 `sourceStableDuringRun=false`；产品 main/CSS 与探针本身的 hash 未变。最终短组全部观察文件 hash 稳定。旧 trace 的 hash 和结果都原样保留。
- 两个后续临时浏览器资料目录未被脚本成功清除（trace 如实记录 `profileRemoved=false`）。确认没有匹配资料目录的 Edge 进程之后，使用原生 PowerShell、精确路径和父目录校验尝试删除，自动审批拒绝，原因仅返回 `blocked by policy`。未绕过此拒绝。遗留目录为 `C:\Users\1\AppData\Local\Temp\yijing-reading-resize-GTfP9w` 与 `C:\Users\1\AppData\Local\Temp\yijing-reading-resize-f7ePds`，只含本次隔离测试资料；正式项目文件和用户浏览器资料未删除。

仍未验证：历史 CI runner 的逐事件轨迹、其他浏览器内核、真机输入、读屏、真实 200% 浏览器缩放、此探针外的完整跨模块流程。本轮不提交 Git、不合并、不发布。
