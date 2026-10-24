# 08 · 数据、持久化、内容来源与发布门禁

更新日期：2026-10-24。结构和行为以当前文件为依据，不把目录有效等同于内容已校勘。

| 状态轴 | 当前结论 |
| --- | --- |
| 实现状态 | 核心 JSON、结构校验、本地记录、旧数据兼容、导出导入和内容来源标记已经存在；六家注疏尚未达到开放门禁 |
| 验证状态 | 本轮 `check` 与 `validate` 通过，230 项测试通过；不代表古典正文逐条校勘、所有备份容量或浏览器操作均已验收 |
| 交付状态 | 本地工作区文档和实现；内容门禁保持关闭，未进行远程发布 |

[返回开发建设总册](../DEVELOPMENT-MASTER.md) · [测试与证据](10-testing-evidence.md) · [执行任务表](12-ai-execution-tasks.md)

## 1. 三类数据不能混淆

| 类别 | 保存位置 | 所有者 | 处理原则 |
| --- | --- | --- | --- |
| 公开文化内容 | `web/data/`、部分纯规则模块 | 项目内容版本 | 修改需来源、争议、授权、校验和 diff 记录 |
| 个人学习记录 | 当前 origin 的 localStorage | 当前浏览器用户 | 默认不外发，迁移和写失败可见，允许备份恢复 |
| 界面临时状态 | JavaScript 内存、history、sessionStorage | 当前页面/会话 | 不能当永久记录，不因 UI 变化覆写学习事实 |

参考 PDF、设计参考图、宣传素材和公开运行 JSON 也不是同一类资产。
不得为了“复制项目完整”把无授权资料塞进 `web/`。
不得为了“清理缓存”删除个人 localStorage。
不得为了“修复初始化”直接把旧学习记录改成空对象。

## 2. 公开 JSON 总清单

| 路径 | 当前数量 | 主要读取方 | 是否首屏必需 |
| --- | --- | --- | --- |
| [hexagrams.json](../../web/data/hexagrams.json) | 64 卦 | data-loader、星图、阅读、课程、占筮、测验 | 是 |
| [trigrams.json](../../web/data/trigrams.json) | 8 条 | data-loader、卦图、八卦学习 | 是 |
| [wings.json](../../web/data/wings.json) | 6 组文本 | 学习、课程引用、考校要点 | 否，按需 |
| [theorems.json](../../web/data/theorems.json) | 13 条 | 象数知识、课程、题库 | 否，按需 |
| [almanac-terms.json](../../web/data/almanac-terms.json) | 98 条 | 黄历、知识库、课程、测验 | 否，按需 |
| [almanac-yiji.json](../../web/data/almanac-yiji.json) | 30 项事项 | 黄历择日资料与解读 | 否，按需 |
| [hexagram-keywords.json](../../web/data/hexagram-keywords.json) | 64 个卦码键 | StarMap 空间文字 | 星图可选资料，不能成为正文依赖 |
| [commentaries/manifest.json](../../web/data/commentaries/manifest.json) | 1 个门禁对象 | 启动、内容校验 | 启动尝试；失败保持关闭 |
| [commentaries/sources.json](../../web/data/commentaries/sources.json) | 6 家来源 | 注疏目录校验 | 内容工程资料 |
| [manifest.webmanifest](../../web/manifest.webmanifest) | 1 个 PWA 清单 | 浏览器安装 | 非业务 JSON |

这些数量是本轮观察值，不是永远不可变的硬编码。
64 卦和 8 卦属于结构不变量；理论条数、术语条数和文本分段属于受控内容版本。
已有说明中“四级、九条理论”等旧数字不能覆盖实际课程与 JSON。

### 2.1 卦数据完整字段

| 字段 | 当前类型/含义 | 约束 |
| --- | --- | --- |
| number | 卦序整数 | 全集 1—64 连续、无缺失 |
| name | 简名字符串 | 搜索、标签和引用显示 |
| fullName | 全名字符串 | 例如“乾为天” |
| binaryCode | 六位 0/1 字符串 | 主键，自下而上，前 3 位为下卦 |
| trigramLower | 三位字符串 | 下卦，应与 binaryCode 前三位对应 |
| trigramUpper | 三位字符串 | 上卦，应与 binaryCode 后三位对应 |
| judgement | 卦辞字符串 | 本经原文，当前仍待逐条底本校勘 |
| image | 大象字符串 | 易传层 |
| tuan | 彖传字符串 | 易传层 |
| lines | 六爻数组 | 数组初爻到上爻；不能因视觉倒序改存储顺序 |
| useNine | 字符串或 null | 乾用九，不能借此自动生成其他卦字段 |
| useSix | 字符串或 null | 坤用六 |
| orderRemark | 序卦说明字符串 | 易传层及相应文本定位 |
| judgementNote | 项目白话字符串 | 项目导读，不是注家原文 |
| imageNote | 项目导读字符串 | 大象辅助理解 |
| scenario | 项目情境类比字符串 | 非预测、非确定现实判断 |
| tuanNote | 项目导读字符串 | 彖传辅助理解 |

`lines[]` 的字段为 `position,isYang,text,xiang,note`。
position 为 1—6，isYang 为布尔，text 为爻辞，xiang 为小象，note 为项目白话。
图形绘制时初爻在下，阅读正文从初爻到上爻；两者不能互相覆盖数据顺序。

以下截选当前乾卦字段，省略号仅表示文档省略，不是可回写的数据：

```json
{
  "number": 1,
  "name": "乾",
  "fullName": "乾为天",
  "binaryCode": "111111",
  "trigramLower": "111",
  "trigramUpper": "111",
  "judgement": "乾：元，亨，利，贞。",
  "lines": [
    { "position": 1, "isYang": true, "text": "初九：潜龙勿用。", "xiang": "潜龙勿用，阳在下也。", "note": "阳气潜藏，力量尚弱，此时应当隐忍蓄势，不宜妄动。" }
  ],
  "useNine": "用九：见群龙无首，吉。",
  "useSix": null
}
```

**现状**：启动验证数量、卦码唯一、卦序连续、六爻阴阳与爻题九六一致。
**建设目标**：把结构一致性、内容校勘、引用准确性分别记录，不能只留一个“已验证”字段。
**失败边界**：文本“看起来古典”不能通过原典门禁；同义改写不得覆写原文。
**验收**：全部 64 卦、384 爻结构固定夹具；逐条校勘另有底本、定位和复核人。
**任务关联**：[T-CONTENT-01](12-ai-execution-tasks.md#t-content-01)。

### 2.2 八卦、十翼与理论

八卦字段：`name,binaryCode,nature,attribute,direction,familyMember`。
当前乾为 `111`、天、健、南、父；方位有图式语境，不得拿单个字段替换所有先后天方位。
八卦唯一三位码与六位卦码不是同一个输入类型，应在接口边界区分。

十翼组字段：`id,name,category,desc,sections`，sections 当前是字符串数组。
当前组 ID 为 `xici-shang,xici-xia,wenyan,shuogua,xugua,zagua`。
当前段数分别为 8、7、6、8、21、10。
彖、大象、小象已随单卦保存；六组不意味着“十翼只有六篇”或完整现代校勘本。
目前段落不是带永久章节 ID 的对象，若要改结构，必须保留课程 refs 和旧定位兼容。

理论字段：`id,name,category,desc,points`；points 为字符串数组。
课程通过 refs 引用理论 ID，不应复制同一事实到课程、题库、海报三处再独立修改。
理论名称和解释属于项目知识整理；年代、流派、术语边界按来源专题说明。

**验收**：refs 不悬空；删改 ID 先找课程和测试引用；空 sections/points 有明确页面降级。
**失败边界**：运行时可能只要求可解析，不能声称全部字段已有深层 schema 校验。

### 2.3 黄历与空间关键词

术语字段：`id,name,category,meaning,yi,ji,principle,related`。
yi、ji、related 为数组；meaning 和 principle 属于项目整理解释。
98 条按既有分类覆盖建除 12、宿 28、百忌 22、节气 24、神煞 12。
宜忌映射是事项名到 `{yi:[建除名],ji:[建除名]}` 的对象，当前 30 项。
例：祭祀宜含建、除、满、定、执、危、成、收、开，忌含破、闭。
它不声称覆盖所有地区、学派或完整择日规则。

关键词对象键为六位卦码，值是 `{text,level}` 数组。
L0 卦名、L1 卦辞核心、L2 大象要旨、L3 代表爻辞。
乾的当前项包括乾、元亨利贞、自强不息、飞龙在天、见龙在田。
关键词是导航/观察提示，不可取代稳定正文或当作完整引文。
UI 显示数量和避让策略由星图负责，不能为放下长词直接改写经文。

**验收**：术语 ID 唯一、课程引用可解析、宜忌值位合法；关键词有合法卦码、合理层级与长词边界测试。
**任务关联**：资料来源和解释边界归 [T-CONTENT-01](12-ai-execution-tasks.md#t-content-01)。

## 3. 数据输入输出和加载契约

[data-loader.js](../../web/js/data-loader.js) 的 `fetchJson()` 对 HTTP 非成功抛可识别错误。
`loadCoreData()` 返回 `{hexagrams,trigrams}` 并先执行核心结构验证。
`loadLearningData()` 返回 `{wings,theorems}`；`loadAlmanacData()` 返回 `{almanacTerms,almanacYiji}`。
两者成功复用 Promise，失败重置 Promise，下一次可重试。
`loadCommentaryManifest()` 返回 manifest，同样失败可重试。
`resetOptionalDataCache()` 清内存可选 Promise，不删除个人数据或 Service Worker 缓存。
`loadAllData()` 给全量校验工具和兼容入口，不是要求首屏加载所有资料。

`buildHexagramIndex()` 返回 `byCode,byNumber,byName` 三个 Map。
检索命中名称、全称、卦辞、大象、彖、序卦、爻辞与小象。
不要把不存在的搜索服务端、向量库或远程全文索引写入当前实现。

**失败边界**：可解析 JSON 不保证字段语义正确；核心自检也不是通用 JSON Schema。
**验收**：HTTP 错误、拒绝 Promise 后重试、重复数据、错误爻码和空搜索分别覆盖。

## 4. 数据生成与人工修订流程

### 4.1 脚本清单与工作目录

这些脚本会写文件，不能把本表的命令当“只读检查”自动执行。

| 生成器 | 输出/修改 | 正确运行方式 | 风险 |
| --- | --- | --- | --- |
| [fill-all.mjs](../../web/tool/fill-all.mjs) | 卦辞、彖象、爻辞、小象、用九/六、序卦字段 | 在 `web/` 执行 `node tool/fill-all.mjs` | 相对路径；会覆盖原文修订 |
| [gen-notes.mjs](../../web/tool/gen-notes.mjs) | hexagrams 的项目释义/类比 | 在 `web/` 执行 `node tool/gen-notes.mjs` | 相对路径；会覆盖人工导读 |
| [gen-tuan-notes.mjs](../../web/tool/gen-tuan-notes.mjs) | hexagrams 的 tuanNote | 根执行 `node web/tool/gen-tuan-notes.mjs` | 脚本按自身位置定位；仍会覆盖对应字段 |
| [gen-wings.mjs](../../web/tool/gen-wings.mjs) | wings.json | 在 `web/` 执行 `node tool/gen-wings.mjs` | 输出整份文件，不能忽略人工分段差异 |
| [gen-theorems.mjs](../../web/tool/gen-theorems.mjs) | theorems.json | 在 `web/` 执行 `node tool/gen-theorems.mjs` | 相对路径、整份覆盖 |
| [gen-keywords.mjs](../../web/tool/gen-keywords.mjs) | hexagram-keywords.json | 在 `web/` 执行 `node tool/gen-keywords.mjs` | 依赖现有卦正文，截词仍须人工审查 |
| [gen-almanac-data.mjs](../../web/tool/gen-almanac-data.mjs) | 两份 almanac JSON | 根执行 `node web/tool/gen-almanac-data.mjs` | 按脚本位置定位，内容是项目整理 |

### 4.2 内容变更步骤

1. 先确认要改的是原文、标点、项目导读、民俗资料还是派生关键词。
2. 记录来源版本、作者/流派、页码/卷次/锚点和许可。
3. 查看目标 JSON 与生成器是否已有不同修订，确定哪一处是当前事实源。
4. 原文更正与界面变化分开提交或至少在 diff 中明确区分。
5. 只重跑确实需要的生成器，不批量“格式刷新”所有正文。
6. 比较字段 diff，检查意外大段改写、空字段、编码顺序和引用变化。
7. 更新依赖该字段的样例、关键词或课程引用，不复制事实制造多份版本。
8. 运行相关数据测试及 `npm run check`，按影响运行 validate。
9. 增加校勘记录，保留未校验项；不能自动把所有 status 改已核验。
10. 更新总册和交接的内容版本/待办，不将测试数量当校对数量。

**任务关联**：[T-CONTENT-01](12-ai-execution-tasks.md#t-content-01)、[T-CONTENT-02](12-ai-execution-tasks.md#t-content-02)。

## 5. 本地存储适配层

[storage.js](../../web/js/storage.js) 提供 `readJson,writeJson,removeStored,isPlainObject`。
默认解析 localStorage，也可向函数注入 storage，供失败、配额和迁移测试使用。
`readJson(key,fallback,validate,storage)` 对不可用、JSON 错误或验证失败返回 fallback。
`writeJson()` 与 `removeStored()` 返回 `{ok,error}`，不向 UI 隐藏失败。
读取 fallback 不会自动擦除损坏原值；修复流程不能擅自写空值。
`isPlainObject` 当前主要判断非 null 对象且非数组，不是严格原型/schema 验证器。

**建设目标**：新数据继续走适配层；结果提示必须区分“已算出/已显示”和“已保存”。
**失败边界**：浏览器配额、禁用存储、损坏记录均可能发生；不能无限尝试写入或清用户数据解围。
**验收**：注入 get/set/remove 抛错的 storage，界面仍能阅读，失败能被用户识别。
**任务关联**：[T-SAVE-01](12-ai-execution-tasks.md#t-save-01)、[T-BACKUP-02](12-ai-execution-tasks.md#t-backup-02)。

## 6. 全部个人数据键与校验边界

### 6.1 复习、测验与笔记

| 键 | 结构与规则 | 当前验证/边界 |
| --- | --- | --- |
| `yijing-review-cards` | 六位卦码→卡对象 | 卡 code 等于键；stage 0—7；due/lastReview 有限数；lapses/reps 非负整数；introducedAt 可选有限数 |
| `yijing-quiz-wrong` | 六位卦码字符串数组 | 每项合法；load 去重；添加已有项不重复写 |
| `yijing-quiz-stats` | `{total,correct}` | 非负整数，correct ≤ total |
| `yijing-notes` | 六位卦码→字符串 | 当前只对顶层对象做宽校验；读取当前卦时仅接受字符串，导入没有全面逐值深校验 |

复习卡字段：`code,stage,due,introducedAt,lapses,reps,lastReview`。
时间字段使用毫秒 epoch，不是“第几天”的字符串。
间隔序列 `[0,1,2,4,7,15,30,60]` 天；忘记回 stage1，模糊不降到0，记得递增至上限。
`loadReviewCards()` 排除既无复习次数又无 introducedAt 的旧虚设卡，避免“自动全64卦到期”。
新建卡应来自明确学习行为，不能因为浏览过标签或快读就铺满64卡。

笔记只有按“保存笔记”成功才进入 localStorage。
当前阅读草稿 Map 只在页面内保存快读/深读切换和换卦前的文本。
刷新、关闭、崩溃不承诺恢复草稿，也不会把草稿偷偷写进备份。
未保存笔记与已保存笔记必须在交接和验收中分开描述。

### 6.2 学习记录与活动

| 键 | 当前结构 | 限额与兼容 |
| --- | --- | --- |
| `yijing.study.v1` | 课程 ID→布尔 | 旧格式，仍保留迁移/兼容 |
| `yijing-learning-record-v2` | `{version:2,lessons,spotChecks,exams,oralReviews}` | 新格式，各考校/复讲历史最多80项 |
| `yijing-activity-v1` | `{days:['YYYY-MM-DD']}` | 去重排序、最多400天，使用设备本地日 |
| `yijing-learning-review-config-v1` | `{endpoint:''}` | 空或当前允许的同源路径字符串，无模型密钥 |

lessons 按课程 ID 保存 `viewedAt,lastStudiedAt,attempts,bestScore` 等已有字段。
bestScore 为课后小试最好正确率；浏览并不等于小试通过。
抽查/阶段记录含 `at,correct,total,results`，results 为 `{lessonId,correct}` 数组。
阶段记录另含 levelId；复讲记录含 `lessonId,score,mode,at`，mode 为 ai 或 self。
新写入函数校验分数和类型；导入 `isLearningRecord` 对 lessons 内部当前较宽，不能声称深层全校验。
活动日期验证目前是形状验证；设备时区日期与黄历 Asia/Shanghai 日期是两套不同契约。

掌握度当前权重为浏览10、小试35、抽查20、复讲15、阶段20。
自评与智能评阅都形成复讲证据，不存在靠成绩锁课的机制。
不要在数据修复时抬高分数或把旧浏览记录转成已考评。

### 6.3 成就/修习谱

`yijing.achievements.v1` 的结构是 `{version:1,processedKeys,metrics,achievements}`。
metrics 保存课程、主题得分、八卦回合、正式读卦、关系、复习日、错题恢复、卦序考核、分析等证据。
achievements 按成就 ID 保存 `unlockedAt,evidence`，evidence 的当前/目标值必须满足既有规则。
事件输入含 `type,subjectId,score,outcome,occurredAt,idempotencyKey,metadata` 的白名单字段。
metadata 有严格允许键，不接受个人私问、长笔记或任意附加对象。
`processAchievementEvent()` 先迁移状态、应用幂等，再在接受时保存；accepted 与 saved 不是同一事实。
processedKeys 目前无持久化增长上限，不能随意裁剪而让旧事件重新发奖。

**验收**：重复 idempotencyKey 不重复累计；无效事件不保存；存储失败不假称已记入修习谱。
**任务关联**：[T-CAPACITY-01](12-ai-execution-tasks.md#t-capacity-01)、[T-SAVE-01](12-ai-execution-tasks.md#t-save-01)。

### 6.4 占筮历史

`yijing-divination-history-v2` 为数组，正常新增最多50条，倒序展示。
V2 项含：

```text
version,id,createdAt,type,method,primaryCode,changedCode,
yaos,cast,changingPositions,readingPolicyId,
interpretationVersion,interpretation,privacy,summary
```

coin 的 yaos 保存六个 `{value,isYang,changing,name,coins}`，coins 为三个2或3。
meihua 的 cast 保存 method/source/上下卦码和名称/本之码/changingPos。
interpretation 保存当时方法、依据、术语、处境、重点、变化、原文焦点、类比、反思问题和边界。
正常写入会限制各文本与数组长度，避免无限保存页面内容。
`privacy` 明确 `{questionStored:false,noteStored:false}`，正常新增不存原始私问或个人笔记。
历史回看使用 `record:false`，不会因回看再新增一条占筮。

V1 键为 `yijing-divination-history-v1`；加载时只包装成旧摘要记录。
V1 的 `legacySummaryOnly:true` 表明不能复现六爻老少、全部动爻与当时解释。
两组加载后排序并截到50；不能对旧项伪造完整快照。
当前结构校验不是跨字段数学一致性的全校验，也不是导入额外字段的严格剥离器。
文档的隐私承诺针对正常记录路径，不能夸成“任意外部 JSON 都已自动去敏”。

### 6.5 界面偏好、会话与内存状态

| 键/状态 | 位置 | 值/用途 | 统一备份 |
| --- | --- | --- | --- |
| `yijing-interface-sound` | localStorage | on/off，全局界面声音 | 不包含 |
| `yijing-panel-layout` | localStorage | 现有面板布局偏好 | 不包含 |
| `yijing-drawer-size` | localStorage | 现有抽屉尺寸偏好 | 不包含 |
| `yijing-daily-seen` | sessionStorage | 当前会话已看欢迎/今日一卦 | 不包含 |
| `yijing:star-entrance` | sessionStorage | 当前会话已播放星图入场 | 不包含 |
| readingDrafts | JavaScript Map | 未保存笔记草稿 | 不包含 |
| readingSnapshot | JavaScript 对象 | 镜头、关系、轨迹等返回上下文 | 不包含 |
| history.state | 浏览历史 | 阅读层级、章节等导航状态 | 不包含 |

布局/抽屉偏好不能被新快读/深读层级写回覆盖。
备份是学习记录备份，不是整个浏览器配置或项目源码备份。

## 7. 迁移规则

学习 V2 缺失或验证失败时，以旧 study 布尔映射生成 fallback。
true 课程得到 `viewedAt:new Date(0).toISOString()`，不生成虚构的最近学习时间、成绩或复讲。
读取 fallback 本身不意味着立即覆盖旧键；后续保存走新格式。
成就 v0 events 可由 `migrateAchievementState()` 转成当前结构，必须保持事件幂等。
占筮旧摘要保留旧身份，不冒充 V2，可从本卦进入阅读。
旧键保留并纳入备份；删除兼容代码前必须有旧用户迁移和回退证据。

**建设目标**：每次迁移明确源版本、目标版本、是否写回、可恢复策略和不可重建字段。
**失败边界**：迁移不修改事实语义，不按新算法悄悄重算旧占筮解释。
**验收**：只旧格式、只新格式、新旧并存、损坏新格式、配额失败、重复迁移六类夹具。
**任务关联**：[T-BACKUP-02](12-ai-execution-tasks.md#t-backup-02)。

### 7.1 学习建设接口的兼容预留

以下是**后续执行默认，不是当前已实现字段**。本节是新持久化形状的唯一规则，04和执行卡引用本节，不再互相转交未决schema。

继续使用 yijing-learning-record-v2、version=2，新增三个可选字段；原有字段与旧数据读取保持兼容：

| 字段 | 类型/约束 | 读写与迁移 |
| --- | --- | --- |
| resume | null或下表的位置对象 | T-LEARN-01写；缺失视null |
| processedAssessmentIds | 唯一非空字符串数组，每项最长120字符 | T-LEARN-05写；缺失视空；不得随80条成绩历史截断而丢失幂等证据，长期容量由T-CAPACITY-01测量 |
| weakQuestions | 以questionId为键的对象，值见下表 | T-LEARN-02/T-QUIZ-01写；缺失视空 |

resume对象：lessonId为现有课程ID；section为intro/observe/read/explain/apply/practice之一，对应引/观/读/解/用/试；scrollTop为0到10,000,000的有限非负数；updatedAt为可解析ISO时间。无效位置不清学习成绩，回今日修习并提示；不自动存正文、选项或复讲自由文本。

weakQuestions每条字段：

| 字段 | 类型/约束 |
| --- | --- |
| questionId | 非空字符串≤160字符，与对象键一致；课程用现有稳定题ID；自由测验用quiz:<题型>:<卦码>；术语用almanac:<术语ID>:<提问方向> |
| questionVersion | 固定curriculum-v1（首版建设默认），将来改变题义须升级，不按选项打乱变化 |
| sourceKind | course / quiz / almanac |
| lessonId | 已存在课程ID或null；course必须有，术语映射对应L5课程 |
| questionType | course时为当前题库的实际类型；quiz严格为opposite/reversed/interlocking/name；almanac记录名称到含义或反向 |
| targetCode / termId | 六位码或null / 现有术语ID或null；按来源至少有正确的公开定位，不能伪造hex |
| firstWrongAt / lastWrongAt | 可解析ISO时间，首次不变，最近随有效新错误更新 |
| lastSessionId | 非空字符串≤120字符，用稳定考评session或自由测验本轮ID |
| wrongCount | 正安全整数；同session同question只增加一次 |
| status | due / reviewed / resolved |
| lastReviewedAt / resolvedAt | ISO时间或null；resolved必须有resolvedAt，新错题回due并清resolvedAt |

课程、术语与具体测验薄弱项统一以此为新证据队列；不把非卦题塞进复习卡。旧yijing-quiz-wrong六位码数组保留兼容读取/备份；只可映射“旧摘要、题型未知”，不得虚构具体错题。新UI优先此队列，旧码列表可作兼容投影，不能答对任意同卦题就清全部不同规则。

同session重试用processedAssessmentIds和lastSessionId判重；只在保存成功后报告已入队。新增字段同步进入新写入、加载/导入validator、统一备份和往返测试。旧文件缺字段合法，已出现但类型非法应拒绝导入并指出路径，不能将整个有效旧记录降为空。
**任务关联**：[T-LEARN-02](12-ai-execution-tasks.md#t-learn-02)、[T-LEARN-01](12-ai-execution-tasks.md#t-learn-01)。

### 7.2 挑战证据升级的建设默认

当前五个 checkbox 只代表历史自评，不能在新界面反标为已客观验证。未来 T-DIV-02 使用 [挑战规格](06-divination-growth.md#divination-five-step) 的版本化结构检查点，分数只表达本地结构检查，不评价自由文本语义或现实应验。

旧记录保留原始版本与成绩，并在证据 UI 标“历史自评”；默认不撤销旧印章，但旧摘要不能自动生成新版客观标志。新事件须满足新版规则并保留同一案例的稳定 subjectId。修改前后备份均可读，不静默重算旧解释或填造旧回答。

新版分析采用metadata.learningPath=guided|independent和assessmentVersion=structure-v1；direct只阅读，不发挑战分。当前事件白名单还没有这些字段，T-DIV-02必须同步受限校验、分析聚合与备份兼容。“言之成理”新达成仅计independent且结构分至少75的不同案例；旧缺路径不自动转自主，已解锁印章保留历史标识。

### 7.3 观象录V1建设契约

**这是T-PRIV-01的未来实现规格；当前没有此键或页面。**

- 新键yijing-observations-v1，值为 {version:1,items:[]}，不借用现有自动起卦历史键。
- items按updatedAt降序，ID唯一，最多200条；达到上限时提示管理/备份且不写入，不静默丢最老项。
- 纳入统一备份白名单和validator，外层备份format/version保持1的可选扩展；缺键旧文件保持当前记录，null明确删除。导入不进行私人文本自动上传。

| 每条字段 | 类型/约束 |
| --- | --- |
| id / castId / analysisSubjectId | 非空字符串各≤120字符；id由创建时随机唯一标识生成，编辑不变 |
| createdAt / updatedAt | 可解析ISO时间；编辑保留创建时间 |
| learningPath | guided / independent；direct不构造不存在的挑战记录 |
| assessmentVersion | structure-v1 |
| publicSnapshot | 现有V2占筮公开快照的白名单副本：本之码、方法/六爻或梅花cast、动爻、取辞政策、解释版本与公开解释；隐私状态仍questionStored=false/noteStored=false，剥离未知字段 |
| answers | 以identification/imagery/citation/reasoning/boundary各1—4检查点ID为键的选项ID或选项ID数组，不保存DOM或整段页面 |
| dimensions / totalScore | 五维各0—20且5的整数倍；完整20项后总和0—100，与06纯评分重新计算一致，不能信任导入自报分 |
| private | {question:null或字符串≤500字符,explanation:null或字符串≤3000字符,consent:{question:boolean,explanation:boolean}}；对应consent不为true必须为null |

保存前展示字段清单，私人两项分别默认未选中；未保存只在内存。复制publicSnapshot保证技术历史被删后仍能解释已主动保存的学习证据，但不能夹带真实私问或未知导入属性。

保存前按统一备份容量策略预检；若将使数据无法生成可恢复备份，阻止本次新增、保留内存内容并说明管理/导出路径，不先写入再让用户发现不能恢复。编辑/删除可见失败；删除不回滚已获得成就。公开PNG/URL/系统分享只读公开模型，绝不读取private。

新增键、版本校验、长度/跨字段数学校验、导入回滚、逐项同意、删除与分享排除须一起交付；不能只做一个保存按钮。

## 8. 统一备份和恢复协议

实现：[user-data.js](../../web/js/user-data.js)，设置入口在学习工作台“数据与评阅设置”。

```json
{
  "format": "yijing-atlas-user-data",
  "version": 1,
  "exportedAt": "2026-10-24T00:00:00.000Z",
  "data": { "yijing-notes": { "111111": "用户自己保存的笔记" } }
}
```

时间是协议示例，不是本轮真实用户导出时间。
白名单为以下11键，不能通过导入任意写浏览器存储：

```text
yijing-review-cards
yijing.achievements.v1
yijing-quiz-wrong
yijing-quiz-stats
yijing.study.v1
yijing-notes
yijing-activity-v1
yijing-learning-record-v2
yijing-learning-review-config-v1
yijing-divination-history-v1
yijing-divination-history-v2
```

### 8.1 导出

`exportUserData()` 读取白名单键并解析 JSON；损坏 JSON 记录为 null。
`downloadUserData()` 创建 JSON Blob，下载 `yijing-atlas-backup-日期.json`，随后释放对象 URL。
导出不上传文件，不包含当前未保存草稿、声音或布局偏好。
当前没有导出总容量上限，也没有保证所有导出文件一定小于导入限制。
损坏项导成 null 后，若原样导回会删除该项，操作提示需避免误导。

### 8.2 解析与导入

`parseUserData()` 以 UTF-8 字节限制 1 MiB，不是按 JS 字符数限制。
JSON、format、version、data 对象和各白名单项类型先验证，再写任何值。
备份包含的键才覆盖；未包含的键保持原值；包含值 null 则删除该键。
未知键不写入，但不会把其存在自动当成全文件无效。
导入是按同类记录替换，不是合并笔记、追加历史或跨设备冲突解决。
UI 明确提示刷新后全部生效，不应因部分内存未刷新误判文件导入失败。

### 8.3 回滚与已知欠账

写之前快照11个键的原始字符串；任一写入抛错时逐键尝试恢复。
回滚恢复也可能因浏览器存储不可用而失败；当前内部忽略回滚中的次级错误。
因此当前不能宣称具备数据库式事务或保证100%回滚。
应完善回滚结果反馈，并给用户保存原始备份/恢复指引。
成就单独备份另有 `format:'yijing-achievements',version:1` 和512 KiB解析限制。
两种格式不能互相冒充，不能把单独成就备份当统一全量备份。

**建设目标**：导出导入容量对称；关键字段深校验；失败/回滚部分失败可见；有效数据不因单项错误静默丢失。
**验收**：1 MiB前后边界、中文多字节、坏JSON、错版本、缺键、null、未知键、写中途失败、回滚再失败、长笔记自导自导回。
**任务关联**：[T-BACKUP-01](12-ai-execution-tasks.md#t-backup-01)、[T-BACKUP-02](12-ai-execution-tasks.md#t-backup-02)。

## 9. 内容来源八层与校勘状态

依据：[CONTENT-SOURCES.md](../CONTENT-SOURCES.md)、[content-provenance.js](../../web/js/content-provenance.js)。

| layer | 含义 | 不能混用的边界 |
| --- | --- | --- |
| 本经原文 | 卦辞、爻辞、用九用六 | 项目白话不能放进此层 |
| 易传 | 彖、大象、小象、序卦等 | 与经文分层，保持署名和定位 |
| 历代注疏 | 已满足来源和校对的注家文本 | 门禁未过不得开放或伪造 |
| 项目导读 | 白话、情境类比、辅助解释 | 不冒充古人原文或唯一解释 |
| 象数传统 | 历代象数术语与理论 | 区分流派与时代，不写普遍科学定律 |
| 术数方法 | 取辞、体用等演示 | 明示后世方法和适用边界 |
| 历法计算 | 天文与历日算法输出 | 数值结果不等于权威历书认证 |
| 民俗资料 | 宜忌等传统资料 | 不等同于现实专业建议 |

`ContentProvenance` 字段：layer、edition、authorTradition、location、validationStatus、disputeNote。
validationStatus 当前为“已核结构 / 项目自撰 / 待校验”三类语义。
原文默认底本说明为项目通行文本，待逐条定位与双人校对；项目导读标自撰。
来源标签要持续可见，不能只在容易被忽略的页脚一次性声明。
后续校勘记录应能追到具体字段/爻位，而不是只给整文件盖“已校验”。

## 10. 六家注疏目录与开放门禁

当前 manifest：schemaVersion1、contentVersion `0.1.0-draft`、releaseReady false。
六家为王弼、孔颖达、李鼎祚、程颐、朱熹、来知德。
每卦每家十锚点：`hexagram,judgement,line-1,line-2,line-3,line-4,line-5,line-6,tuan,image`。
64 × 6 × 10 = 3,840 条锚点记录；当前完成卦0、校验记录0。
“not-applicable”也是需来源、原因和双校的明确记录，不是空字段跳过。

来源对象包括 `id,author,dynasty,work,edition,editionStatus,digitalIndex`，可有 scopeNote。
sources 顶层有 schemaVersion、reusePolicy、authorities。
digitalIndex 是书目/影印定位辅助，不代表运行时自动抓取或复制授权。
王弼注文、韩康伯注、孔颖达疏必须分层；《周易集解》引诸家保留原署名。

开放后按卦码对应文档，文档有 `binaryCode` 和 `authorities[authorityId].anchors[anchor]`。
记录 status 只接受 `verified` 或 `not-applicable`。
共同必填 `volume,locator,sourceUrl,reviewers`。
verified 要 text 非空；not-applicable 要 reason 非空。
reviewers 至少两名不同非空标识，不能由同一 AI 换名称伪造双人复核。

[commentary-catalog.js](../../web/js/commentary-catalog.js) 校验行为：

1. 无论是否开放，先检查 manifest schema、六家来源和必要来源字段。
2. releaseReady false 时返回目录有效/门禁关闭，不把3,840文本都当已经校对。
3. releaseReady true 时检查底本 editionStatus verified。
4. 枚举全64码，禁止缺卦、重复卦码，逐家逐锚点检查记录与双校。
5. 任一失败返回 canRelease false。

[validate-commentaries.mjs](../../scripts/validate-commentaries.mjs) 已接入质量门禁。
正常输出“目录有效，发布门禁保持关闭”是正确现状，不是工作已完成。

### 10.1 草稿批次校验的建设步骤

当前命令在releaseReady=false时不逐条验新增内容；不能拿它证明某一批已合格。T-CONTENT-02先补下述模式，**实现前下列参数不是现有可用功能，不能直接运行后把目录通过当批次通过**：

~~~powershell
# 未来实现后的用法；当前尚未支持
node scripts/validate-commentaries.mjs --draft-batch=111111,000000
~~~

模式契约：只校验显式请求的非重复六位码文档，每码六家十锚点；复用完整发布校验的文本/不适用理由/定位/真实双校检查。缺请求文档、非法码、缺家/锚点或坏记录exit1；输出checkedCodes、recordsChecked、errors及底本状态限制。来源底本未verified须报告阻塞，不能宣称可发布。

无论批次是否合格，输出canRelease=false，绝不改磁盘manifest或临时将其开门。未请求卦不计为本批错误；全量发布仍必须单独跑原64码完整校验。先以合成批次写回归，再用真实已校批次；每批证据列范围和缺口。
**验收**：缺一卦、缺一家、缺锚点、无定位、同名校对者、空text、无reason均不能开放。
**任务关联**：[T-CONTENT-02](12-ai-execution-tasks.md#t-content-02)。

## 11. 数据与素材许可

代码 MIT 不自动授权参考 PDF、现代标点整理、注释、图像、音频或第三方库。
古典公版原文仍需说明使用底本、转录方法、标点/分段与异文边界。
现代作品引用记录作者、版本、页码、许可，禁止未经授权复制长篇。
数字平台 OCR 初稿只能辅助，公开内容须独立转录并双人核对公版影印页。
根参考 PDF 当前不作为网页运行资产，不能复制进发布包。
第三方库见 [THIRD_PARTY_NOTICES.md](../../THIRD_PARTY_NOTICES.md) 与 vendor 旁许可文件。
素材总账尚需统一，详见 [分发与维护专题](11-distribution-maintenance.md)。
**任务关联**：[T-ASSET-01](12-ai-execution-tasks.md#t-asset-01)。

## 12. 交给其他 AI 的数据变更底线

每个任务必须列出读哪些键、写哪些键、是否迁移、是否外发和如何恢复。
不新增隐式永久存储，不把个人笔记加入公开样例或截图。
不修改六位自下而上规则，不将课程成绩和修习谱当同一结构。
不因新UI把原文、导读、未校验注疏混排成一段。
不把校验器“通过但关闭”改成开放，不伪造权威历书或人工双校证据。
完成以实际数据 diff、相关测试、恢复演练和剩余限制为准。
本轮验证事实统一引用 [10-testing-evidence.md](10-testing-evidence.md)，后续重测也在那里登记日期与工作区。
