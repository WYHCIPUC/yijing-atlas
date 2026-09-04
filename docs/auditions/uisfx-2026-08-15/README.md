# 易象图谱界面音色试听记录

日期：2026-08-15
素材：`uisfx@0.4.0`

打开 `index.html` 后，可逐个试听、按组连播，并将每个候选音标为“保留 / 待定 / 弃用”。A 为素材原声；B 为“质感增强”方向，在大致响度匹配的前提下增加主体、触点与短尾韵。状态保存在当前浏览器的 `localStorage`，点击“复制评审结果”可生成便于讨论的文本。

**已确认版本方向：B 质感增强。** A 原声仅用于历史对照；所有保留项以及后续通过评审的待定项，均以 B 版参数作为接入基准。弃用项不因选择 B 而恢复。

## 候选分组

- 常规界面（Zen）：`select`、`toggle-on`、`toggle-off`、`volume-change`、`open`、`close`、`expand`、`collapse`。
- 学习反馈（Zen）：`check`、`progress-step`、`checkpoint`、`success`、`info`、`error`、`warning`、`complete`、`achievement`。其中 `error` 与 `warning` 仅用于和温和的 `info` 做对照，默认弃用。
- 机械节点（Mechanical）：`snap`、`lock`、`unlock`。

## 第一轮评审结论

- **保留**：`zen/volume-change`、`zen/open`、`zen/close`、`zen/expand`、`zen/collapse`。
- **待定**：`zen/select`、`zen/toggle-on`、`zen/toggle-off`、`mechanical/snap`。
- **弃用**：九项学习反馈声音，以及 `mechanical/lock`、`mechanical/unlock`。

结论：`uisfx` 可继续承担少量常规界面开合反馈，但不承担学习奖励、纠错、课程完成、成就或核心机械锁定声标。学习体系与关键机械动作进入第二轮独立声音设计。

正式接入必须由“业务状态已经成功改变”显式触发，不能仅依赖按钮类名或 document 级事件冒泡。复习中的“忘了 / 模糊 / 记得”属于自我报告；在新学习声景通过试听前，这些动作保持安静。

## 质感增强方向

- Zen：主体保留原音轮廓，叠加低音量木质共鸣、高频触点和约 58ms 的克制尾韵。
- Mechanical：降低主体重心，补入低频机构重量、高频金属接触和短促腔体回响。
- B 版仍属于数字处理试听，不冒充真实录音。铜钱、纸张、毛笔、印章和转盘棘轮最终仍需真实拟音。
- 禁止用加大音量制造“更好听”的错觉；正式导出前还需做峰值、响度和长时间疲劳测试。

## 已确定边界

- 不给悬停、滚动、打字和星图缩放配音。
- 高频反馈保持短、轻、低音量；荣誉与课程完成才允许更完整的声标。
- 铜钱、棘轮、转盘停靠、纸张、毛笔和印章继续使用独立真实拟音。
- 正式集成时复制已批准音频到 `web/assets/audio/`，不从 CDN 或 `node_modules` 运行时加载。

## 许可

uisfx 代码采用 MIT；`sounds/` 下音频采用 CC0-1.0。音频可修改、分发和商业使用；虽非强制，项目仍建议在第三方许可清单中注明来源。
