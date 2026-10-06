# 发布检查清单

## 自动化门禁

- [x] `npm run validate` 全部通过，核心逻辑行、分支、函数覆盖率均不低于 90%。
- [x] `npm run test:e2e` 在 Chromium 的 1440×1024、1280×720、768×1024 与 390×844 视口通过，并覆盖 320px、640 CSS 像素等效缩放、键盘路径、AX 树语义和断网重开。
- [x] `npm run build:windows` 与 `npm run test:windows` 通过，Windows 单文件版本的首页、JSON、脚本、样式和 404 响应正常。
- [x] GitHub Actions `Quality` 对当前发布单元成功；Pages 部署仅依赖该工作流。
- [x] 当前工作区已清洁，提交范围为本次确认发布的文件；质量检查未发现 PDF、密钥或临时产物。

远程状态核验（2026-10-07）：当前发布单元 `e8f60f7` 已在 [Quality 运行一](https://github.com/WYHCIPUC/yijing-atlas/actions/runs/37512013396) 和 [Quality 运行二](https://github.com/WYHCIPUC/yijing-atlas/actions/runs/37512002770) 成功。Pages 工作流只监听 `main`，最近一次公开部署仍对应 `main@ff76c3d`；公开 Pages 的 Service Worker 仍报告 `yijing-atlas-v20`，当前代码为 `v50`，因此生产地址不能作为本轮代码的验收证据。

本地性能证据（2026-10-07）：[三次 Lighthouse 报告摘要](qa/2026-10-07/lighthouse-local-motionoff-mobile-summary.json)的中位数为 Performance 89、Accessibility 100、Best Practices 100、SEO 100、FCP 1883ms、LCP 3470ms、TBT 100ms。页面已将天象舞台改为用户聚焦或操作星图时按需加载，将 GSAP/Lenis 改为 defer，为本地静态服务补充 gzip，并为欢迎层背景图增加预加载；Performance 分数达到计划门槛，但 LCP 仍超过 2500ms，且生产 URL 仍是旧版本，因此本项继续保持未验收。

## 人工验收

本地 Chromium 烟测已提供自动化证据；下面的项目仍要求真实浏览器、辅助技术、设备或生产环境证据，不能用本地自动化结果代替。

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
