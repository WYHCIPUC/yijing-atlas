# 发布检查清单

## 自动化门禁

- [x] `npm run validate` 全部通过，核心逻辑行、分支、函数覆盖率均不低于 90%。
- [x] `npm run test:e2e` 在 Chromium 的 1280×720 与 390×844 视口通过。
- [ ] GitHub Actions `Quality` 成功，Pages 部署仅依赖该工作流。
- [ ] `git status` 只包含本次确认发布的文件；公开历史不含 PDF、密钥或临时产物。

## 人工验收

- [ ] Chrome/Edge 桌面、Android Chrome、iOS Safari 完成探索、学习、复习、测验、黄历、占筮流程。
- [ ] 键盘完成搜索、打开/关闭详情、切换学习页签和提交测验；焦点不会进入关闭面板。
- [ ] 断网后可再次进入核心星图；访问过的功能资源可从运行时缓存恢复。
- [ ] 黄历页面明确显示支持年份和时区；抽查结果已记录来源与差异。
- [ ] Lighthouse 连续三次中位数达到计划门槛，并保存报告或截图。

## 发布与回滚

- [ ] 仓库所有者确认 License、仓库名、可见性、Pages URL 和是否保留 `legacy-flutter/`。
- [ ] 先发布 `v1.0.0-rc.1`，记录已知风险和验证设备，再签发正式版本。
- [ ] 回滚时重新部署上一个成功 Pages artifact；若缓存异常，提高 `web/sw.js` 的 `CACHE_NAME` 并重新部署。
- [ ] 发布后用无缓存窗口访问生产 URL，确认资源、深链接、Service Worker 和分享地址正确。
