# 修习成长体系并行开发计划

## 开发前置条件

当前工作区已有一批未提交的 UI、学习页、复习、测验、缓存和数据修正。并行开发前必须先由一个窗口完成测试并提交为统一基线；其他窗口不要在同一工作目录切换分支。推荐每个任务使用独立 Git worktree，并从同一个基线提交创建 `codex/` 分支。

所有任务共同遵循：不新增运行时依赖、不锁核心课程、不把重复起卦作为成就、不保存敏感问题原文、不修改自己未获授权的文件、不回退其他人的改动。

## 并行任务 A：成就领域引擎与数据契约

**职责**：建立与 UI 无关、可测试的成就状态、事件聚合、幂等、防刷、学阶和能力计算。

**文件所有权**：

- `web/js/achievement-catalog.js`（新增）
- `web/js/achievement-engine.js`（新增）
- `web/js/achievement-storage.js`（新增）
- `web/test/achievement-*.test.mjs`（新增）

**交付要求**：实现 PRD 中 12 枚成就；统一事件 schema；支持坏数据降级、版本迁移、导入导出、重复事件幂等；时间与随机源必须可注入；不得编辑 DOM、CSS、`main.js` 或现有模式文件。

## 并行任务 B：自主解卦挑战与评分

**职责**：把金钱卦和梅花结果转成五步解卦练习，完成客观评分、透明反馈、修改重交和安全边界。

**文件所有权**：

- `web/js/divination-challenge.js`（新增纯逻辑）
- `web/js/divination-challenge-page.js`（新增渲染）
- `web/styles/divination-challenge.css`（新增）
- `web/js/modes/divination-mode.js`
- `web/test/divination-challenge*.test.mjs`（新增）

**接口约束**：通过注入的 `onProgressEvent(event)` 上报结果，不直接依赖未完成的成就引擎；事件中不得包含用户问题原文或完整自由文本。保留“直接研读”，并明确文化学习与自我反思边界。

## 并行任务 C：修习谱与成就视觉体验

**职责**：实现学习模块内的修习谱、成就详情、能力图谱、达成依据和克制的铜印反馈。

**文件所有权**：

- `web/js/achievement-page.js`（新增）
- `web/js/achievement-feedback.js`（新增）
- `web/styles/achievements.css`（新增）
- `web/test/achievement-page.test.mjs`（新增）

**交付要求**：页面接收 catalog 与 summary 数据，不自行读写存储；展示未达成进度、达成证据、奖励和下一步建议；支持键盘、焦点恢复、减少动态效果。不得改 `index.html`、`main.js`、`learning-mode.js` 或 `main.css`，入口接线留给集成任务。

## 并行任务 D：现有学习行为事件接入

**职责**：把课程、小试、测验、错题回练、间隔复习和深度阅读转换为统一事件，同时保持原有存储兼容。

**文件所有权**：

- `web/js/progress-events.js`（新增）
- `web/js/learning-progress.js`
- `web/js/quiz-engine.js`
- `web/js/review-engine.js`
- `web/js/render.js`
- 对应现有与新增测试

**交付要求**：优先让业务函数返回事件或接受事件回调，不建立跨模块全局单例；定义“深度阅读”而非点击计数；错题必须是“先错—间隔后答对”才产生 `quiz.recovered`；所有事件具备稳定幂等键。不得改 UI 入口和样式。

## 最终任务 E：集成、备份、声景与质量门禁

此任务必须在 A–D 合并后由单一窗口执行，不能与它们并行修改入口文件。

**文件所有权**：

- `web/index.html`
- `web/js/main.js`
- `web/js/modes/learning-mode.js`
- `web/js/user-data.js`
- `web/js/audio-engine.js`
- `web/styles/main.css`
- `web/sw.js`
- `README.md`、`docs/CONTENT-SOURCES.md` 与端到端测试

**工作内容**：连接统一事件与成就引擎；把“修习谱”加入学习模块而不扩张主导航；接入达成金石声景和可静音控制；更新备份格式及 Service Worker 清单；完成真实浏览器全流程、数据迁移、可访问性、性能和发布门禁。

## 合并顺序

1. 提交当前 UI 优化与数据修正基线。
2. 先合并 A，冻结事件与状态接口。
3. 合并 D，再合并 B、C；只解决各自授权文件内的冲突。
4. 最后执行 E，统一入口、视觉和发布资源。
5. 运行 `npm run validate`，再进行 1280×720、1440×1024 的浏览器终验。

## 各窗口统一回报格式

- 修改文件列表。
- 公开接口与数据 schema。
- 实际运行的测试及结果。
- 未验证风险和对集成任务的要求。
- 当前分支名与提交哈希；不得自行推送或发布，除非另行授权。
