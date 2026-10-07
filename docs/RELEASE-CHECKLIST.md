# 发布检查清单

## 自动化门禁

- [x] `npm run validate` 全部通过，核心逻辑行、分支、函数覆盖率均不低于 90%。
- [x] `npm run test:e2e` 在 Chromium 的 1440×1024、1280×720、768×1024 与 390×844 视口通过，并覆盖 320px、640 CSS 像素等效缩放、键盘路径、AX 树语义和断网重开。
- [x] `npm run build:windows` 与 `npm run test:windows` 通过，Windows 单文件版本的首页、JSON、脚本、样式和 404 响应正常。
- [x] GitHub Actions `Quality` 对当前发布单元成功；Pages 部署仅依赖该工作流。
- [x] 当前工作区已清洁，提交范围为本次确认发布的文件；质量检查未发现 PDF、密钥或临时产物。

远程状态核验（2026-10-07）：当前 `main` 为 `639c4ad`，PR #4 已合并。对应的 [Quality 运行](https://github.com/WYHCIPUC/yijing-atlas/actions/runs/37647904756) 和 [Pages 部署](https://github.com/WYHCIPUC/yijing-atlas/actions/runs/37647905353) 均成功；公开入口已返回版本 `v50`，Service Worker 为 `yijing-atlas-v50`。

本地性能证据（2026-10-07）：[三次 Lighthouse 报告摘要](qa/2026-10-07/lighthouse-local-motionoff-mobile-summary.json)的中位数为 Performance 89、Accessibility 100、Best Practices 100、SEO 100、FCP 1883ms、LCP 3470ms、TBT 100ms。页面已将天象舞台改为用户聚焦或操作星图时按需加载，将 GSAP/Lenis 改为 defer，为本地静态服务补充 gzip，并为欢迎层背景图增加预加载；本地 LCP 仅作为诊断结果，生产 URL 的正式门槛以如下生产报告为准。

生产性能证据（2026-10-07）：[三次生产 Lighthouse 报告摘要](qa/2026-10-07/lighthouse-production-mobile-summary.json)的中位数为 Performance 95、Accessibility 100、Best Practices 100、SEO 100、FCP 1685ms、LCP 2285ms、TBT 22ms、CLS 0.014，满足计划门槛。

生产浏览器烟测证据（2026-10-07）：[production-browser-smoke.json](qa/2026-10-07/production-browser-smoke.json)由 Edge 无头浏览器直接访问生产 URL 生成，覆盖六个功能模式、键盘搜索与详情、AX 树对话框、焦点恢复、390/768/1440 视口、黄历时区、梅花/金钱占筮和断网重开，结果为 `met`。这份证据不能替代真实 Android、iOS 或屏幕阅读器验收。

## 人工验收

本地 Chromium 烟测已提供自动化证据；下面的项目仍要求真实浏览器、辅助技术、设备或生产环境证据，不能用本地自动化结果代替。

- [ ] Chrome/Edge 桌面、Android Chrome、iOS Safari 完成探索、学习、复习、测验、黄历、占筮流程。
- [ ] 键盘完成搜索、打开/关闭详情、切换学习页签和提交测验；焦点不会进入关闭面板。
- [ ] 断网后可再次进入核心星图；访问过的功能资源可从运行时缓存恢复。
- [ ] 黄历页面明确显示支持年份和时区；抽查结果已记录来源与差异。
- [x] 生产 URL Lighthouse 连续三次中位数达到计划门槛，并保存报告摘要与原始报告。

## 发布与回滚

- [x] 发布元数据按当前仓库事实和推荐决策固定：MIT License、公开仓库 `WYHCIPUC/yijing-atlas`、Pages URL `https://wyhcipuc.github.io/yijing-atlas/`，保留 `legacy-flutter/` 作为归档代码。
- [x] 现有正式版本为 `v1.1.0`；当前候选发布单元为 `1.1.1-rc.2`，其 [GitHub Release](https://github.com/WYHCIPUC/yijing-atlas/releases/tag/v1.1.1-rc.2) 已正确标记为预发布，并记录已知风险与验证范围于 [候选版本说明](releases/v1.1.1-rc.2.md)。`rc.1` 因工作流漏传 `--prerelease` 被标为历史 superseded 产物，不作为正式交付依据。
- [ ] 回滚时重新部署上一个成功 Pages artifact；若缓存异常，提高 `web/sw.js` 的 `CACHE_NAME` 并重新部署。
- [x] 发布后用无缓存窗口访问生产 URL，确认资源、深链接、Service Worker 和分享地址正确。
