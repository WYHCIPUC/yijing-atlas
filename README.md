# 易象图谱

易象图谱是一个零后端、零运行时依赖的《易经》学习网站。它以六十四卦关系星图为入口，整合学习路径、卦序、复习、测验、传统黄历知识和占筮文化演示，并支持安装为 PWA 与离线再次访问。

## 功能概览

- 六十四卦关系星图、全文检索和卦爻辞详情
- 八卦、十翼、象数理论与 L1–L4 学习路径
- 学习进度总览、连续学习、错题回练、本地复习卡及 JSON 备份
- 金钱卦、梅花易数简化演示、占筮历史和传统黄历知识
- 可分享卦象深链接、键盘搜索结果与浏览器前进/后退
- 响应式布局、键盘操作、减少动态效果偏好和离线缓存

## 本地运行

需要 Node.js 22 或更高版本，无需安装依赖：

```bash
npm start
```

打开 `http://127.0.0.1:3030/`。请勿直接使用 `file://` 打开 `web/index.html`，否则浏览器无法加载 JSON 模块数据。

## 质量检查

```bash
npm test             # 单元、历法回归与页面渲染冒烟测试
npm run test:coverage # 核心算法 90% 覆盖率门槛
npm run test:e2e     # 使用本机 Chromium 检查桌面与移动主流程
npm run validate     # 发布前完整语法、数据、测试与覆盖率检查
```

## 目录

```text
web/             静态网站、ES 模块、样式和 JSON 数据
web/js/modes/    学习、卦序、复习、测验、占筮模式
web/test/        核心算法测试
test/almanac/    历法、数据集成与页面渲染回归测试
docs/            设计、计划和内容来源说明
legacy-flutter/  已归档的早期 Flutter 原型
```

学习数据仅存于当前浏览器，请在“学习 → 数据”中定期导出备份。黄历、占筮和体用解释只用于传统文化学习，不构成专业建议；日期按设备本地时区计算。内容来源和校对边界见 [docs/CONTENT-SOURCES.md](docs/CONTENT-SOURCES.md)，发布步骤见 [docs/RELEASE-CHECKLIST.md](docs/RELEASE-CHECKLIST.md)。

## 贡献与发布

提交前请阅读 [AGENTS.md](AGENTS.md) 与 [CONTRIBUTING.md](CONTRIBUTING.md)，并运行 `npm run validate`。`main` 分支通过 GitHub Actions 校验后可部署 `web/` 到 GitHub Pages。

源代码采用 [MIT License](LICENSE)。传统文本、整理数据与引用内容的来源和适用边界以 [docs/CONTENT-SOURCES.md](docs/CONTENT-SOURCES.md) 为准；第三方组件见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
