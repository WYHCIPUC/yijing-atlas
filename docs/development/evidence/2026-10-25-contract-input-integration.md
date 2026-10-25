# 2026-10-25 保存、考评与输入整合交接

本轮按持续开发目标收尾T-SAVE-01、T-LEARN-05，并推进T-QA-01。原生静态架构、卦码、历法、判分及复习调度不变；不引入新框架、业务后端或云能力。此前已有修改全部保留，未改写历史证据。

## 1. 交付状态

- 业务/探针/测试提交：`25fa12a24b3b21b39f1bf269b70ad0e77fbc1ca2`，分支`codex/immersive-astrolabe-progress`。
- **T-SAVE-01完成本地验收**：已有保存反馈与重试加上真实输入8/8，受测源码与整合版本核对一致，独立复核满足原卡完成条件。
- **T-LEARN-05完成本地验收**：正式考评ID契约、兼容和导入边界、回归与真实输入9/9，满足同轮、新轮、失败重试三类原卡条件。
- **T-QA-01部分完成**：resize条件等待、跨区域第二指取消已修复并有红→绿证据；减少动态二选经真实转动可达。真实窗口blur仍未取得，主动失捕获仅DOM API故障注入；整卡不关闭。
- 原48卡已完成3张（另含T-DIV-01），剩余45张：34已确认、10建议、1独立发布。不自动采纳建议，也不以本批完成表示整个目标完成。

## 2. 修改与依据

| 范围 | 最终行为 | 证据 |
| --- | --- | --- |
| `learning-progress.js` / `user-data.js` | processedAssessmentIds为正式幂等集合，缺字段兼容；唯一非空≤120字符校验，非法新增字段不清空旧成绩；与成绩同次写入，不跟随80条历史截断 | 三份学习/导入回归；[考评专项](2026-10-25-assessment-session-browser.md) |
| 考评结果与修习谱 | 正式ID已处理但无匹配receipt时不计分、不补造事件，显示证据不足；有receipt用实际保存成绩补证据 | 同上；真实ID缺receipt合成夹具与普通路径分开登记 |
| `star-map.js` | Canvas内外第二指、窗口blur、隐藏及销毁取消当前手势；先清状态再释放capture，销毁移除窗口监听，不改变6px阈值/抬起确认 | [指针原红灯](2026-10-25-pointer-cross-region-red.log)、[43项绿灯](2026-10-25-pointer-cross-region-green.log)、[真实输入增补](2026-10-25-entry-input-probe.md) |
| `browser-smoke.mjs` | resize后有界等待stage/open/modal/URL一致，附实际viewport及media状态；不加固定延时、不删业务断言 | [resize根因](2026-10-25-reading-resize-diagnosis.md)、[helper红灯](2026-10-25-reading-state-red.log)及[绿灯](2026-10-25-reading-state-green.log) |

独立只读复核另检查首指/同ID不误取消、失捕获同步重入和destroy按同回调/同capture参数解除监听，没有发现新增确定问题。修改范围为提交中的15个代码、测试与探针文件；[源码及任务快照](2026-10-25-contract-input-integration.json)用于定位实际受测版本。

## 3. 实际验证

| 命令或专项 | 实际结果与适用范围 |
| --- | --- |
| `node --test web/test/star-pointer-lifecycle.test.mjs web/test/star-map-performance.test.mjs web/test/browser-smoke-reading-state.test.mjs` | 43/43、exit0；修复后取消/生命周期、性能预算及resize helper回归 |
| `npm run validate` | exit0；61脚本，覆盖率阶段287/287；20个配置模块集合行99.77%、分支91.77%、函数98.93%。[完整日志](2026-10-25-integrated-contract-input-validate.log)，不是整个DOM/渲染覆盖率 |
| `npm run test:e2e`，默认Node22.23.1 | 宿主原生中止，退出码-1073740791，`new_time >= loop->time`，未形成完整通过。[中止日志](2026-10-25-integrated-contract-input-e2e.log)保留 |
| 同一npm脚本，现有Node24.19.0临时环境 | exit0；五视口、鼠标/键盘/模拟触控阅读、减少动态、离线与WebGL降级。[通过日志](2026-10-25-integrated-contract-input-e2e-node24.log)；未安装运行时或修改全局配置 |
| 最后探针调整后的`npm run check` | exit0；74个JS文件、11个JSON、内容门禁及跟踪文件检查通过。[日志](2026-10-25-integrated-contract-input-check.log) |
| 保存故障专项 | 8/8；失败中关闭重进、只补未成功项、恢复焦点及现有记录保全；[报告](2026-10-25-reading-save-probe.md) |
| 考评专项 | 9/9；鼠标/键盘/390模拟触控、未答/非法值、空态/不足题、同轮/新轮及两类存储失败；[报告](2026-10-25-assessment-session-browser.md) |
| 跨区域第二指 | 真实红→绿，修复后1/1，事件可信、取消后可再选卦；[trace](2026-10-25-entry-input/2026-10-24T19-19-06-700Z/trace.json) |
| 减少动态新帧后二选 | 1/1，使用一次真实竖直转动后选中坤；[trace](2026-10-25-entry-input/2026-10-24T19-22-09-603Z/trace.json)。不是默认姿态无遮挡证据 |
| 真实window blur | 新窗口激活、bringToFront及真实点击仍未产生事件，unsupported/exit1；[trace](2026-10-25-entry-input/2026-10-24T19-19-25-543Z/trace.json)。停止有限补查，不用合成blur当通过 |

临时Node24命令（根目录；只影响该PowerShell进程）：

```powershell
$node24Directory = 'C:\Users\1\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin'
$env:PATH = $node24Directory + ';' + $env:PATH
& "$node24Directory\node.exe" 'W:\Node.js\node_modules\npm\bin\npm-cli.js' run test:e2e
```

该路径只描述本机已有环境；其他机器仍按Node22+和`npm run test:e2e`运行。Node24也曾在其他专项发生原生中止，不能声称它根治宿主计时问题。最后仅探针竖直拖动两行调整发生在validate之后，已由语法检查及`npm run check`覆盖；应用和单元测试没有再改，完整E2E使用同一应用源码。

## 4. 尚未完成与下一动作

- T-QA-01保留真实窗口失焦/物理失捕获证据边界；环境不支持不变更为通过，也不把数学投影计算写成真实输入证据。
- 当前默认乾聚焦时摘要可能挡住坤，通过环顾可选。此次没有借验收修改摘要布局或令输入穿透控件；其默认呈现限制留在输入报告。
- T-GROW-01尚需T-QA-01原前置，不绕过；T-LEARN-05完成后T-LEARN-02可按原卡实施。无该前置的T-SEARCH-01可并行推进，保持共享文件单一所有权。
- 真机、读屏、真实200%缩放、当前性能长时证据、当前Windows包未完成。六家0/64、0/3840、releaseReady=false；真实底本、许可、双校不能伪造。
- 复习同轮幂等与复讲隔离/仅保存重试仍归T-LEARN-03，梅花当次来源/时区归T-DIV-03；此次只明确归属，没有冒称功能已完成。

回滚按提交和任务的具体文件进行，只撤本批修改，不删除用户学习数据；新ID字段保持兼容，不能为回滚裁掉已有幂等集合。旧失败、源码快照和图片全部保留。

## 5. GitHub与资料

常规`git push`再次连接443失败；随后使用既有Git Data API同步工具，校验blob/tree/commit SHA并非强制快进，已成功同步15文件的代码提交25fa12a。随后盘点实际查询确认该提交的[push Quality](https://github.com/WYHCIPUC/yijing-atlas/actions/runs/40125128358)与[PR Quality](https://github.com/WYHCIPUC/yijing-atlas/actions/runs/40125131822)均为completed/success，仅适用于此提交。PR #10保持Draft，Issue #9不关闭，不合并main、不发布Pages或Release。

此前临时profile清理被自动审批拒绝（`blocked by policy`）的目录继续保留，未改工具绕过；本轮新生成profile的独立清理结果按各报告记录。项目交付资料不依赖这些临时目录。
