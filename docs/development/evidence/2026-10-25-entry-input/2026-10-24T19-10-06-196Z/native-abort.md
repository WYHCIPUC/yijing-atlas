# Node 22 原生终止记录

此记录从实际终端结果补记；该次运行未写出 trace，不能推断任何场景完成。

运行时间目录：`2026-10-24T19-10-06-196Z`（UTC）。实际命令：

```powershell
$env:YIJING_ENTRY_SCOPE = 'boundaries'
$env:YIJING_ENTRY_CASE = 'multi-touch-outside-canvas-reset'
node scripts/test-entry-input.mjs
```

终端返回 exit 1，没有保持 live 的进程会话。输出原文：

```text
Assertion failed: new_time >= loop->time, file c:\ws\deps\uv\src\win\core.c, line 327
```

Node 为项目默认 `v22.23.1`。没有浏览器场景、源码首尾一致性或 profile 清理结果；未伪造缺失的记录。随后用已安装的 Node `v24.19.0` 重跑同一场景，结果另存相邻时间戳目录，不覆盖本次失败。
