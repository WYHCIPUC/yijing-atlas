# 贡献指南

## 开始开发

使用 Node.js 22 或更高版本。运行 `npm start` 启动本地站点；修改前先阅读相关模块、测试和 [AGENTS.md](AGENTS.md)。保持原生 HTML、CSS、ES Modules 架构，不随意引入依赖或构建系统。

## 提交变更

- 将计算逻辑放在纯模块中，将 DOM 交互放在 `web/js/modes/` 或渲染模块中。
- JavaScript 使用两个空格、单引号、分号和 kebab-case 文件名。
- Bug 修复先补复现测试；新功能覆盖关键边界、失败路径和本地存储异常。
- 数据或传统历法内容变更须按 [docs/CONTENT-SOURCES.md](docs/CONTENT-SOURCES.md) 说明来源、改写范围和校对方法。
- 提交信息使用 `feat: ...`、`fix: ...`、`docs: ...` 或带范围的形式，如 `fix(almanac): ...`。

提交 Pull Request 前运行：

```bash
npm run validate
```

PR 描述应列出用户可见变化、实际执行的检查、关联 Issue 和剩余风险。界面变化请附桌面与移动端截图；算法或数据变化请附已验证样例。不要提交 PDF、密钥、证书、环境文件或未经授权的现代作品内容。
