# Windows 桌面版发布

Windows 一键版是包含完整 `web/` 静态资源与 Node.js 运行时的单文件程序。双击后仅在 `127.0.0.1` 启动 HTTP 服务，优先使用 `3030` 端口，端口占用时自动顺延，并调用系统默认浏览器打开页面。关闭程序窗口即停止服务。

## 本地构建与验证

在 64 位 Windows、Node.js 22 环境中运行：

```bash
npm install
npm run build:windows
npm run test:windows
```

`dist/` 中会生成版本化 EXE 与 `SHA256SUMS.txt`。构建基于 Node.js Single Executable Applications（SEA）和 `postject`，运行端不需要 Node.js。`test:windows` 会启动 EXE 并验证首页、卦象数据、主脚本、HEAD 请求和 404 行为。

## GitHub Release

确认 `package.json` 版本与标签一致后推送标签，例如 `v1.0.0`。`.github/workflows/release.yml` 会在 Windows runner 上重新校验、构建、启动测试，并把 EXE 与校验和发布到 GitHub Releases。

当前产物未使用商业代码签名证书。Windows SmartScreen 可能在首次下载时显示未知发布者提示；发布说明中应保留这一提示，并建议用户核对 SHA-256。
