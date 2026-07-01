# 易经学习项目设计文档

- **日期**：2026-06-30
- **状态**：已通过设计评审；技术栈已于 2026-06-30 由 Flutter APP 调整为纯静态网站
- **作者**：用户与 ZCode 协作产出

---

## 0. 技术栈调整记录（2026-06-30）

**调整：** 由 Flutter 跨平台手机 APP → **纯静态网站（原生 HTML + CSS + JavaScript）**。

**原因：** Flutter 的 Android 构建链（Gradle 发行版下载、依赖解析、模拟器）在当前环境下阻力较大、耗时过长；纯静态网站零构建链、双击即用、部署到 GitHub Pages 极简，更契合"由浅到深逐步掌握"的渐进式开发理念。

**保留不变的核心设计：**
- 内容数据 `hexagrams.json` / `trigrams.json`（纯 JSON，技术栈无关）——**已产出，直接复用**
- 领域模型设计（Hexagram/Yao/Trigram 及字段）
- **binaryCode 主键方案**（6 位二进制自下而上）——工程关键，技术栈无关
- 启动自检理念（校验 64 卦完整性）
- 分层架构思想（数据/逻辑/视图分离）
- 4 期交付路线图与每期功能范围

**重写部分：** 原 Dart 领域模型与 Flutter UI → JavaScript 逻辑与 HTML/CSS 视图。因 JSON 与设计已定，重写快速。

**第一个里程碑：** 仅查阅库（对应原第 1 期 MVP）——64 卦浏览、卦象详情、全文检索、八卦基础。后续复习/学习路径/占筮按原路线图逐期推进（用户进度用 `localStorage` 存储，替代 SQLite）。

> 以下章节为原始 Flutter 设计，保留作为领域与功能参考；技术栈细节以本节调整为准。

---

## 1. 目标与范围

### 1.1 项目目标

打造一款帮助用户**由浅入深、熟练掌握《易经》全部内容**的跨平台手机 APP。覆盖本经卦爻辞、十翼（易传）、基础理论/象数体系、筮法占筮四大模块，提供查阅、记忆复习、测验、学习路径、起卦占筮等综合学习能力。

### 1.2 成功标准

- 用户能查阅完整的 64 卦本经、十翼、象数理论
- 用户能通过间隔复习 + 测验真正"背熟"本经内容
- 用户能按由浅到深的学习路径系统学习
- 用户能用三种方法起卦并得到符合易学规则的解读
- 全程离线可用，无服务器依赖

### 1.3 非目标（YAGNI）

- 不做账号体系与云端同步（纯本地离线）
- 不做社区/分享/社交功能
- 不做付费/内购
- 不做服务器后端

---

## 2. 整体架构与技术栈

### 2.1 技术栈

| 层面 | 选型 | 理由 |
|---|---|---|
| 框架 | Flutter (Dart) | 单代码库出 Android + iOS |
| 本地内容 | JSON 资源文件（随包只读） | 易经原文稳定，无需联网 |
| 本地数据库 | Drift（类型安全 SQLite 封装） | 存用户进度/收藏/占卦记录 |
| 状态管理 | Riverpod | 现代、可测试、社区推荐 |
| 路由 | go_router | 声明式，适合多页面 APP |

### 2.2 分层架构

```
┌─────────────────────────────────────┐
│  UI 层 (presentation)                │  页面、组件、动画（卦象绘制等）
├─────────────────────────────────────┤
│  应用层 (application)                │  Riverpod providers（状态、业务编排）
├─────────────────────────────────────┤
│  领域层 (domain)                     │  纯 Dart 模型：Hexagram、Yao、Trigram…
├─────────────────────────────────────┤
│  数据层 (data)                       │  JSON 仓库（只读经文）+ Drift 仓库（用户数据）
└─────────────────────────────────────┘
```

每层独立可测；领域层是纯 Dart 不依赖框架；数据层隔离"经文来源"与"用户记录"；未来加云同步只动数据层。

### 2.3 核心目录结构

```
lib/
├── main.dart
├── core/              # 主题、路由、错误处理等基础设施
├── domain/            # 纯模型：hexagram.dart, yao.dart, trigram.dart ...
├── data/
│   ├── assets/        # （assets/ 下资源的访问封装）
│   └── local/         # Drift 数据库（用户进度、收藏、占卦）
├── features/          # 按功能划分
│   ├── library/       # 查阅库
│   ├── study/         # 学习路径
│   ├── review/        # 记忆复习
│   ├── quiz/          # 测验
│   └── divination/    # 占筮
└── shared/            # 复用组件（卦象画布、爻线组件等）

assets/data/
├── trigrams.json
├── hexagrams.json
├── wings.json
└── theorems.json
```

---

## 3. 核心领域模型

领域层为纯 Dart 模型，不依赖 Flutter。是整个 APP 的"骨架"。

### 3.1 卦（Hexagram）——核心实体

```
Hexagram
├── number: int          # 卦序 1-64（周易序卦）
├── name: String         # 卦名，如"乾"
├── fullName: String     # 全称，如"乾为天"
├── binaryCode: String   # 二进制，如"111111"（下→上，阳爻1阴爻0）★ 卦的主键
├── trigramLower: Trigram # 下卦（内卦）
├── trigramUpper: Trigram # 上卦（外卦）
├── judgement: String    # 卦辞（如"元亨利贞"）
├── image: String        # 大象传（如"天行健..."）
├── tuan: String         # 彖传（解释卦辞）
├── lines: List<Yao>     # 6 爻（自下而上 爻1→爻6）
├── useNine: String?     # 用九（仅乾卦有）
├── useSix: String?      # 用六（仅坤卦有）
└── orderRemark: String  # 序卦传对该卦的说明
```

### 3.2 爻（Yao）——卦的组成单位

```
Yao
├── position: int        # 1-6（自下而上）
├── isYang: bool         # 阳爻(true) / 阴爻(false)
├── text: String         # 爻辞，如"初九：潜龙勿用"
├── xiang: String        # 小象传（解释该爻）
└── isCorrectPosition: bool  # 当位(true)/失位(false)（阳爻居奇位、阴爻居偶位为当位）
```

### 3.3 八卦（Trigram）——基础构件

```
Trigram
├── name: String         # 乾兑离震巽坎艮坤
├── binaryCode: String   # "111" "110" ...（下→上）
├── nature: String       # 自然属性：天泽火雷风水山地
├── attribute: String    # 德性：健悦丽动入陷止顺
├── direction: String    # 方位（先天/后天）
└── familyMember: String # 家庭：父少女中女长男长女中男少男母
```

### 3.4 辅助模型

- **Commentary（传）**：按"十翼"类型组织——彖上下、象上下、系辞上下、文言、说卦、序卦、杂卦
- **HexagramRelation（卦际关系）**：错卦、综卦、互卦、变卦索引（用于占筮解读与学习）
- **StudyRecord（学习记录）**：已学/掌握状态、下次复习时间、复习次数
- **DivinationRecord（占卦记录）**：时间、得卦、问题、变爻、解读

### 3.5 核心工程决策：二进制串作卦主键

每个卦用 6 位二进制（**自下而上**）唯一标识：乾=`111111`、坤=`000000`、泰=`111000`（下乾上坤）。

- **占卦**：6 次掷蓍/钱 → 6 位串 → 查表得卦
- **测验**：二进制串 ↔ 卦名双向判读
- **关系推演**：位取反=错卦、上下翻转=综卦，纯位运算得出

这让"卦象 ↔ 数据"转换确定、无歧义，是整个项目的工程关键。

### 3.6 启动自检（内建易经正确性）

- 64 卦 `binaryCode` 自检：恰好 6 位、互不重复、覆盖所有合法组合
- 8 卦 `binaryCode` 自检：恰好 3 位、互不重复
- 提供 `binaryCode → Hexagram`、`trigramLower/Upper → Hexagram` 双向查找工具
- 卦象/爻序的任何错误在开发期暴露，而非混到用户手里

---

## 4. 四大功能特性

### 4.1 查阅库（Library）—— 第 1 期

随身的《易经》参考库。

- 64 卦总览：列表 + 搜索（卦名/序号）→ 详情页
- 卦象详情页：可视化六爻图 + 卦名/卦辞/彖/象/序卦 + 各爻爻辞小象
- 八卦基础：先天后天八卦图、每卦属性
- 全文检索：搜任意词，高亮命中的卦/爻/传
- 收藏夹：常看的卦置顶、加个人批注

### 4.2 记忆复习（Review）—— 第 2 期

像 Anki 一样背熟本经，运用艾宾浩斯遗忘曲线。

- 复习卡片：正面提示 → 翻转看背面（原文）
- 间隔算法（SM-2 简化版）：自评"记得/模糊/忘了"，按 1/2/4/7/15 天安排下次复习
- 今日待复习：首页徽章，自定义每日上限
- 掌握度可视化：每卦/每爻掌握进度条

### 4.3 测验（Quiz）—— 第 2 期

主动回忆，检验真掌握。

- 题型：卦象→卦名、卦名→卦象、爻辞填空、卦辞与卦名匹配、八卦属性辨析
- 智能出题：优先考掌握差的、最近复习过的；错题自动进复习队列
- 即时反馈 + 错题本：答错看正确答案 + 出处
- 限时挑战模式：计时赛

### 4.4 学习路径（Study）—— 第 3 期

由浅入深的课程式引导。

- L1 基础：阴阳、八卦、卦的组成
- L2 本经：64 卦按周易序，含序卦传逻辑串讲
- L3 十翼：逐篇精读传文
- L4 象数：河图洛书、五行、纳甲等
- 进度跟踪：章节解锁、完成度百分比、连续学习天数
- 章节测验通关：通过才解锁下一章

### 4.5 占筮（Divination）—— 第 4 期

实践起卦，连接理论与应用。

- 大衍筰法：50 蓍 18 变完整模拟 + 逐步动画
- 金钱卦：6 次掷铜钱动画
- 梅花易数：时间/数字起卦
- 解读：得本卦 + 变卦，按变爻规则显示对应爻辞/卦辞
- 占卦记录簿：历史记录可回看

### 4.6 贯穿全部的共享组件：卦象绘制

- `HexagramPainter`：接收二进制串，用 `CustomPainter` 绘六爻（阳爻一长横、阴爻两短横，可标变爻）
- `TrigramPainter`：绘制单卦八卦符号
- 支持动画（占卦时爻逐根出现）与主题适配
- 一处实现、处处复用，保证视觉一致

---

## 5. 数据架构与存储

### 5.1 内容数据（只读，随包 JSON）

放 `assets/data/`，首次启动加载进内存（Riverpod provider 缓存）。

```
assets/data/
├── trigrams.json        # 八卦基础（8 条）
├── hexagrams.json       # 64 卦本经（核心）
├── wings.json           # 十翼
└── theorems.json        # 基础理论/象数
```

**hexagrams.json 单卦示例**：

```json
{
  "number": 1,
  "name": "乾",
  "fullName": "乾为天",
  "binaryCode": "111111",
  "trigramLower": "qian",
  "trigramUpper": "qian",
  "judgement": "乾：元，亨，利，贞。",
  "image": "天行健，君子以自强不息。",
  "tuan": "大哉乾元，万物资始，乃统天。……",
  "lines": [
    { "position": 1, "isYang": true, "text": "初九：潜龙勿用。", "xiang": "潜龙勿用，阳在下也。" },
    { "position": 2, "isYang": true, "text": "九二：见龙在田，利见大人。", "xiang": "……" }
  ],
  "useNine": "用九：见群龙无首，吉。",
  "orderRemark": "有天地，然后万物生焉。"
}
```

**原则**：JSON 是单一数据源；卦的 ID 是 `binaryCode`，跨文件引用用它关联，绝不靠名字字符串匹配。

### 5.2 用户数据（读写，本地 Drift）

```
hexagram_progress        # 每卦学习/掌握状态
  hexagram_id | mastery_level | last_reviewed | next_review | review_count

yao_progress             # 每爻掌握度（复习到爻粒度）
  hexagram_id | yao_position | mastery | due_date

review_cards             # 艾宾浩斯复习卡片
  card_id | type | ref_hexagram | ref_yao | interval | ease | due | lapses

quiz_results             # 测验记录
  result_id | quiz_type | score | timestamp | wrong_items (JSON)

bookmarks                # 收藏
  bookmark_id | target_type | hexagram_id | yao_position | note | created_at

divination_records       # 占卦记录
  record_id | timestamp | question | method | primary_hex | changed_hex | changing_lines | note

study_progress           # 学习路径进度
  course_id | chapter_id | status | completed_at
```

### 5.3 仓储模式（Repository Pattern）

UI 永远不直接碰 JSON/SQL：

- `HexagramRepository` / `CommentaryRepository` / `TheoremRepository`：读 JSON → 领域模型
- `ProgressRepository` / `ReviewRepository` / `BookMarkRepository` / `DivinationRepository`：读写 Drift

未来加云同步只改 Repository 内部，UI 零改动。

---

## 6. 分阶段交付计划

每期都是可交付、可使用的成品里程碑。每期一个 Git 分支，完成有可运行版本。

### 6.1 第 1 期 · 地基与核心查阅（MVP）

**目标**：完成后是"能查 64 卦、能看八卦"的可用 APP。

- Flutter 项目脚手架 + 目录结构 + 依赖配置
- §3 全部纯 Dart 领域模型
- `trigrams.json` + `hexagrams.json`（64 卦本经原文）
- 数据层 Repository + 启动自检
- 查阅库 feature：64 卦总览/搜索/详情页 + 八卦基础页
- 共享组件 `HexagramPainter` / `TrigramPainter`
- 首页底部 Tab 导航（其余 Tab 占位）

**验收**：模拟器可运行；64 卦全可查、卦象正确、原文无缺；全文检索可用。

### 6.2 第 2 期 · 记忆掌握

**目标**：完成后能像 Anki 一样背熟本经。

- 复习卡片引擎：翻转卡片 + SM-2 简化版间隔算法
- 复习 feature：今日待复习、卡片浏览、掌握度面板
- 测验 feature：4 种题型 + 智能出题 + 错题本
- 数据持久化：`review_cards` / `quiz_results` / `yao_progress` 表
- 首页徽章：今日待复习数

**验收**：能建卡、按算法到期提醒、测验闭环、错题自动进队列。

### 6.3 第 3 期 · 完整内容与学习路径

**目标**：内容由浅到深全覆盖，有学习引导。

- 十翼内容：`wings.json` + 彖/象/系辞/文言/说卦/序卦/杂卦展示
- 象数理论：`theorems.json`（阴阳/五行/河洛/纳甲）+ 图解
- 学习路径 feature：L1-L4 分级课程 + 章节解锁 + 进度跟踪
- 内容关联：卦↔传、卦↔理论双向跳转

**验收**：十翼、象数内容齐全可查；学习路径可按序学习、章节解锁生效、进度正确累计。

### 6.4 第 4 期 · 占筮实践

**目标**：完成起卦占筮闭环。

- 大衍筰法：50 蓍 18 变模拟 + 逐步动画
- 金钱卦：6 次掷铜钱动画
- 梅花易数：时间/数字起卦
- 解读引擎：本卦/变卦 + 变爻规则选辞
- 占卦记录簿：历史记录 + 回看

**验收**：三种起卦法都正确得卦；变爻规则正确；记录可存可查。

### 6.5 工程规范（贯穿全部）

- **测试**：领域模型和算法（间隔复习、卦象推演、变爻规则）必须有单元测试——易经正确性的底线
- **Git**：每期一个分支，完成合并，每期结束有可运行版本
- **状态管理**：统一 Riverpod，跨 feature 状态通过 provider 共享

---

## 7. 待解决问题（实施期细化）

以下在实施计划阶段进一步拆解，不阻塞当前设计：

- SM-2 间隔算法的具体参数取值
- 变爻规则（0 个、1 个、多个变爻）的完整判定表
- 学习路径各章节的具体课程内容编排
- 河图洛书等象数图示的绘制方式
- 大衍筰法的逐步动画交互细节
