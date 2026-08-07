<p align="center">
  <a href="https://wyhcipuc.github.io/yijing-atlas/">
    <img src="./assets/readme/hero.webp" width="100%" alt="易象图谱：把六十四卦放进一张可探索、可学习、可演变的关系星图">
  </a>
</p>

<p align="center">
  <a href="https://wyhcipuc.github.io/yijing-atlas/"><strong>✦ 在线演示</strong></a>
  &nbsp;&nbsp;·&nbsp;&nbsp;
  <a href="https://github.com/WYHCIPUC/yijing-atlas/releases/latest"><strong>⬇ Windows 一键版</strong></a>
  &nbsp;&nbsp;·&nbsp;&nbsp;
  <a href="#一分钟开始"><strong>⌘ 本地运行</strong></a>
</p>

<p align="center">
  不是一本从头翻到尾的电子书，而是一座可以漫游、推演、复习和检验的《易经》学习空间。
</p>

---

## 从一张星图开始

六十四卦不再是孤立的六十四页。易象图谱把错卦、综卦、互卦与变卦组织成可缩放的关系星图；选择一个卦，沿着连线就能看到它如何转化、为何关联，以及经传中有哪些依据。

<p align="center">
  <a href="https://wyhcipuc.github.io/yijing-atlas/">
    <img src="./assets/readme/showcase.webp" width="100%" alt="易象图谱真实界面：左侧黄历知识面板与右侧六十四卦关系星图">
  </a>
</p>

<p align="center"><sub>真实运行界面 · 黄历知识与卦象关系星图并置呈现</sub></p>

## 一座会回应你的易学空间

| 探索 | 学习 | 推演 |
| --- | --- | --- |
| 在六十四卦星图中搜索、缩放和追踪关系 | 按八卦、六十四卦、十翼、象数、历法五阶进学 | 在演变实验室逐爻观察卦象、卦义与典籍依据同步变化 |
| 用机械卦序转盘随机抽卦并查看完整详情 | 每个小节配有小试、抽查、复讲、阶段考评与错题回练 | 体验金钱卦、梅花易数与传统黄历知识，并保留学习边界说明 |

除此之外，你还可以：

- 生成适合发送给朋友的卦象分享卡片；
- 使用连续学习、间隔复习、掌握度与本地数据备份；
- 开启真实感交互声景，或一键静音、遵循减少动态效果偏好；
- 安装为 PWA，在访问过后离线再次进入核心功能。

## 一分钟开始

### 直接体验

- 浏览器打开：[wyhcipuc.github.io/yijing-atlas](https://wyhcipuc.github.io/yijing-atlas/)
- Windows 10/11 64 位：[下载最新一键版](https://github.com/WYHCIPUC/yijing-atlas/releases/latest)

Windows 版本已内置网站和 Node.js 运行时。双击后会启动本地服务并自动打开默认浏览器；保持启动窗口开启，关闭窗口即可退出。

### 本地开发

需要 Node.js 22 或更高版本：

```bash
git clone https://github.com/WYHCIPUC/yijing-atlas.git
cd yijing-atlas
npm start
```

打开 `http://127.0.0.1:3030/`。请勿用 `file://` 直接打开 `web/index.html`，JSON 与 ES 模块需要通过 HTTP 加载。

## 设计原则

```text
关系先于目录  →  从卦象之间的联系进入知识
检验伴随学习  →  每个小节都有可回看的学习证据
典籍标明出处  →  原文、项目释义与适用边界分层呈现
数据留在本地  →  默认零后端、零账号、可导出备份
```

黄历、占筮和体用解释仅用于传统文化学习，不构成医疗、法律、投资或其他专业建议。日期按设备本地时区计算；内容来源与校对状态见 [内容来源说明](docs/CONTENT-SOURCES.md)。

<details>
<summary><strong>工程质量与验证</strong></summary>

```bash
npm test              # 单元、历法回归与渲染冒烟测试
npm run test:coverage # 核心算法覆盖率门槛
npm run test:e2e      # Chromium 多视口主流程
npm run validate      # 发布前完整质量门禁
```

当前发布门禁包含 105 项测试；核心算法覆盖率为行 99.55%、分支 91.03%、函数 98.85%。GitHub Actions 在每次推送时运行质量检查，并部署 `web/` 到 GitHub Pages。

</details>

<details>
<summary><strong>项目结构</strong></summary>

```text
web/             静态网站、ES 模块、样式和 JSON 数据
web/js/modes/    学习、卦序、复习、测验、占筮模式
web/test/        核心算法测试
test/almanac/    历法、数据集成与渲染回归测试
docs/            产品设计、发布计划与内容来源
assets/readme/   GitHub 首页视觉资产与可编辑源文件
legacy-flutter/  已归档的早期 Flutter 原型
```

</details>

## 参与完善

提交前请阅读 [AGENTS.md](AGENTS.md) 与 [CONTRIBUTING.md](CONTRIBUTING.md)，并运行 `npm run validate`。欢迎提交内容校勘、学习体验、无障碍、性能和历法数据方面的问题或改进。

## License

源代码采用 [MIT License](LICENSE)。传统文本、整理数据与引用内容的来源和适用边界以 [docs/CONTENT-SOURCES.md](docs/CONTENT-SOURCES.md) 为准；第三方组件见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
