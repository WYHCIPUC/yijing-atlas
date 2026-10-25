# T-LEARN-02 课程薄弱项契约与最小实施方案

记录日期：2026-10-25。保存时工作区 HEAD：`ec0f63c`；后续实施前仍须重新核对 HEAD、未提交改动和相关代码。

| 维度 | 状态 |
| --- | --- |
| 需求 | 已确认：课程错题形成独立温习闭环，归属 T-LEARN-02。 |
| 本记录 | 只读代码审查后的设计记录；此次只新增本文档。 |
| 实现 | 尚未实施本方案。现有正式考评会话和幂等基础已实现，不等于薄弱项队列已实现。 |
| 验证 | 已核对文档和代码；先前内存诊断见第 2 节。尚未编写或运行本方案的新回归，未进行浏览器验收；不登记本卡完成。 |
| 范围 | 保留静态架构、现有学习记录键、判分、掌握度与奖励规则；不新增业务后端或发布动作。 |

## 1. 依据与已选方案

权威依据：

- [学习专题 04 §7：课程错题与温故闭环](../04-learning-library-assessment.md#learning-wrong-queue)。
- [数据专题 08 §7.1：学习建设接口的兼容预留](../08-data-storage-content.md)，以及 §6 学习记录、§7 迁移和 §8 备份的现状说明。
- [执行卡 T-LEARN-02](../12-ai-execution-tasks.md#t-learn-02)；前置为已完成的 [T-LEARN-05](../12-ai-execution-tasks.md#t-learn-05)。

采用的回练方案已经确定：从薄弱项进入**新的普通 lesson 小试**，继续使用默认 3 题和实际题量不足时的既有规则，仅增加可选 `requiredQuestionId`，保证原错题进入本卷；其余题仍按现有课程范围和抽题规则选择。仍使用现有判分、receipt、processedAssessmentIds、成绩和奖励路径，不把单题回练伪装成整课满分。

本记录细化既有任务的技术接线，不另立产品需求。专题 08 是持久化形状的唯一规则；本记录与其冲突时，先核对并更新权威专题，不能让实现自行选择两套 schema。

## 2. 当前代码事实与审查边界

| 代码入口 | 当前事实 | 本卡缺口 |
| --- | --- | --- |
| [learning-curriculum.js](../../../web/js/learning-curriculum.js)：`question()`、各类题目工厂、`buildLearningQuestionBank()` | 题目已有稳定 id、lessonId、kind、来源文字；kind 实际为 recall/evidence。 | 尚未输出 questionVersion、targetCode、termId 等薄弱项所需引用元数据。 |
| [learning-assessment.js](../../../web/js/learning-assessment.js)：`createAssessmentSession()`、`gradeAssessment()` | lesson/spot/exam 会话有稳定随机 ID；校验本卷完整有效答案；结果带 questionId。 | 尚无原题必入卷约束，也未传递完整薄弱项引用。 |
| [learning-progress.js](../../../web/js/learning-progress.js)：`recordLearningAssessment()` | 成绩、processedAssessmentIds 和真实 receipt 同次保存；同 session 去重；旧 ID 无 receipt 不补造成绩。 | 没有 weakQuestions 写入或纠正逻辑。课程小试只保存课程汇总和 receipt，不持久化逐题 results；抽查/考评才保存 results 摘要。 |
| [learning-progress.js](../../../web/js/learning-progress.js)：`isLearningRecord()`、`loadLearningRecord()` | 正式 ID 字段已有校验；损坏的新 ID 字段不会把有效旧成绩读取为空后覆盖。 | 尚未校验 weakQuestions，应复用同样的保护原则。 |
| [user-data.js](../../../web/js/user-data.js)：`validateSnapshot()`、`parseUserData()`、`importUserData()` | 学习记录键已在 11 键白名单中；导入先验证、写失败尝试回滚。 | 未验证的 weakQuestions 会随整个学习记录原样通过，不能视为契约已完成。 |
| [learning-assessment-page.js](../../../web/js/learning-assessment-page.js)：`saveSubmission()`、`renderResult()` | 成绩/活动/成就失败有各自反馈和重试；错题显示辨析。 | 没有薄弱项保存反馈或原题回练入口。 |
| [learning-mode.js](../../../web/js/modes/learning-mode.js)：`renderTodaySection()` | 温故数字只来自卦象间隔卡。 | 缺课程薄弱项入口、类型和数量。完整推荐优先级仍归 T-LEARN-01。 |
| [review-mode.js](../../../web/js/modes/review-mode.js)：`renderReviewMode()`、`renderDueList()` | 只读取卦象复习卡。 | 缺课程温习队列及原题上下文。 |
| [main.js](../../../web/js/main.js)：`setMode()` 的学习/温故 renderer 接线 | 温故返回学习的 callback 只能进入学习首页。 | 需最小传递课程及题号上下文，不能只有入口文字。 |
| [study-page.js](../../../web/js/study-page.js)：课程“试”章节 | 文案已称答错内容进入复习安排。 | 必须以真实队列和入口兑现，不能只改文案关闭任务。 |

此前审查执行过一次 Node 24 内存诊断：使用真实 JSON 题库、普通 `createAssessmentSession()` 与 `gradeAssessment()`，存储替身为内存 Map，没有修改项目文件或浏览器数据。

- `l1-1` 的 3 道题全部答错后，`recordLearningAssessment()` 返回 `saved:true`，课程 attempts 为 1，`weakQuestions` 不存在。
- 该次小试持久化 receipt 只有 sessionId、kind、at、correct、total、lessonId，没有逐题结果。因此不能从旧小试汇总倒推出错了哪道题。
- 给有效学习记录加入 `weakQuestions: ['not-a-question-map']`，当前 `isLearningRecord()`、备份解析和导入均接受，并原样导出。

以上是当前行为的诊断观察，不是新增功能的通过证据。该诊断没有持久化独立测试脚本；实施时须先补可重复运行的失败回归。本次文档保存没有重新运行业务测试或浏览器探针。

## 3. 持久化字段契约

继续使用 `yijing-learning-record-v2`、`version:2`。新增可选 `weakQuestions` 对象，以 questionId 为键；旧记录缺失时按空集合使用，读取本身不自动写回。不要新建存储键或改变外层备份版本。

| 字段 | 约束与本卡写入规则 |
| --- | --- |
| questionId | 非空字符串，最长 160 字符，与对象键一致。沿用课程题库现有 ID。 |
| questionVersion | 当前写 curriculum-v1。选项顺序、随机会话及重复进入不改变它。 |
| sourceKind | 专题 08 定义 course/quiz/almanac。本卡只产生 course，包含 L5 黄历课程；不实施自由测验的新证据生产逻辑。 |
| lessonId | 真实课程 ID；course 必须存在且与题库归属一致。 |
| questionType | course 使用当前题目的 kind，即 recall/evidence；具体原规则由 questionId 区分，不以课程类型代替题型。 |
| targetCode | 六位 0/1 字符串或 null。仅真实六爻卦题从原始卦数据赋值；不能把三爻码复制成六爻码。 |
| termId | 术语 ID 或 null。L5 课程从真实术语实体取得；不从显示名称猜测。 |
| firstWrongAt | 可解析 ISO 时间，首次有效错误创建，之后保留。 |
| lastWrongAt | 可解析 ISO 时间，仅新的有效错误更新。 |
| lastSessionId | 非空字符串，最长 120 字符；使用最后一次有效答题更新的既有 session ID。 |
| wrongCount | 正安全整数；同 session 同题只计一次，新会话再错递增。 |
| status | due/reviewed/resolved。due 与 reviewed 都仍待有效回练；resolved 才从待办中移出。 |
| lastReviewedAt | ISO 时间或 null，仅表示实际温习时间，不等同答对。 |
| resolvedAt | ISO 时间或 null；resolved 必有，新的错误回 due 并清空此字段。 |

首个理论错题的目标形状示例，**不是当前已生成的数据**：

```json
{
  "weakQuestions": {
    "theory-yinyang-name": {
      "questionId": "theory-yinyang-name",
      "questionVersion": "curriculum-v1",
      "sourceKind": "course",
      "lessonId": "l1-1",
      "questionType": "recall",
      "targetCode": null,
      "termId": null,
      "firstWrongAt": "2026-10-25T03:00:00.000Z",
      "lastWrongAt": "2026-10-25T03:00:00.000Z",
      "lastSessionId": "example-assessment-session",
      "wrongCount": 1,
      "status": "due",
      "lastReviewedAt": null,
      "resolvedAt": null
    }
  }
}
```

### 3.1 稳定题号与来源定位

- 保留现有题号，例如 theory-yinyang-name、hex-111111-order、wing-xici-shang-name、almanac-jianshe-jian-name；不以题干或选项索引重新生成 ID。
- L5 课程题仍属于 course，保留现有 almanac- 前缀题号；不能改成 T-QUIZ-01 未来自由测验的 almanac:术语ID:方向 记录。
- 理论和经传题可通过 lessonId + questionId 定位。其 targetCode、termId 均可为 null，不为满足字段而强造定位。
- 只有真实 hexagram 题写 targetCode；术语题写 termId。来源文字和完整题目从当前题库查回，不复制到弱项集合。
- 新写入只保留契约中的公开字段，不写题干全文、整组候选答案、课程全文、复讲自由文本或笔记。

### 3.2 校验与来源失效须分开

结构错误应拒绝写入和导入：集合为数组或 null、键和 questionId 不同、ID 为空或超长、错误类型/枚举、非法时间、非正安全整数计数、非法六位码，以及 resolved 缺少 resolvedAt。

结构合法但当前题库已无该题，并不证明历史记录是坏数据。应保留记录、标明暂不能回练，退回对应课程；不能因此清空整份成绩。新记录必须从真实题库产生正确定位，历史定位的可用性则在展示/回练前核查。

sourceKind 为 quiz/almanac 的约束继续服从专题 08。本卡不为后续任务先造新的题型或写入来源，也不能在整条学习记录保存时丢弃结构合法的其他来源弱项。

## 4. 原子写入、去重与纠正

### 4.1 普通小试、抽查及考评交卷

1. 继续由现有 gradeAssessment 校验完整答案，并将本卷题目的必要公开引用随逐题结果传递。
2. recordLearningAssessment 先验证记录与输入，再执行现有 processedAssessmentIds/receipt 判重。
3. 新会话在内存中同时计算成绩和弱项变化；最后通过既有 saveLearningRecord 对同一学习记录键写入一次，保证成绩、processed ID、receipt 与课程薄弱项一起成功或失败。
4. 不能先把 session 登记为已处理，再另一次保存课程队列；否则队列失败后正常重试会被已处理 ID 拦截。
5. 旧调用或旧成绩缺少有效题目引用时，不依据分数比例或当前随机题卷补造弱项。新增页面路径必须传完整引用。

### 4.2 状态转换

| 触发 | 变化 | 不得发生 |
| --- | --- | --- |
| 首次有效答错 | 建立一项 due，wrongCount=1，写首次/最近错误和 session。 | 不为其他同课题目建项。 |
| 同一 session 重试/结果重显 | 沿现有幂等结果返回，不重复变更。 | 不增加次数、成绩或活动奖励。 |
| 新 session 同题再错 | 归并原项、次数加一、更新 lastWrongAt/lastSessionId，status=due、resolvedAt=null。 | 不生成重复题项，不抹掉 firstWrongAt。 |
| 重温来源 | 可表达 reviewed 和真实 lastReviewedAt，仍留在待回练集合。 | 不标 resolved、不作为答对或新增成绩。 |
| 新有效答卷中同题同版本答对 | 已有弱项标 resolved，记录本轮纠正时间；保留错误历史。 | 不把另一题/另一版本的正确答案作为纠正。 |
| 从未形成弱项的题答对 | 不创建弱项。 | 不生成虚假的首次错误。 |
| 已纠正项再次答错 | 回 due，清 resolvedAt，保留历史并增加真实错误次数。 | 不宣称一次纠正等于永久掌握。 |

同轮判断以 processedAssessmentIds 为主、lastSessionId 为辅助；不能只用最近一个 ID 判断，否则较早 session 在新会话之后重试会再次累积。

已有 ID 无 receipt，或 receipt 缺失旧逐题事实时，保持 T-LEARN-05 的诚实降级：不重复计分，也不借当前答案补造成就或薄弱项。原有 80 条成绩历史截断不能移除正式 ID 或薄弱项去重所需证据；长期容量测量仍归 T-CAPACITY-01。

### 4.3 保存失败

- 单键保存失败时，不能显示“已加入温习”或“本轮已纠正”；保留本轮答案供查看和重试。
- 重试复用同一 session，重新读取持久化记录，不能把上次未保存的内存增量再加一次。
- 成绩/弱项同键成功后，活动和成就沿既有独立保存反馈及重试逻辑，不重复发放。
- 如本卡选择为有真实 targetCode 的错题同时添加卦卡，复用 addReviewCard；它是不同存储键，须独立反馈保存失败，不能把成功入队等同卦卡也成功。不得改变已有卡到期时间或强造非卦题的卡。

## 5. 原规则回练与版本变化

回练入口接收原弱项引用，先用当前题库核对 questionId、lessonId、questionVersion：

- 匹配有效时调用普通 createAssessmentSession('lesson', ...)，传 requiredQuestionId，保证该题入卷一次；其余题继续原抽题规则，总数仍为默认 3 题或实际可用数量。
- 原题不属于当前课程、找不到或版本不匹配时，不能忽略 requiredQuestionId 随机出另一题。显示“题目已调整，请回原课温习”，提供有效课程入口；课程也失效则退回学习页并说明。
- 使用新 session；重绘保留原卷。必选题只改变选题约束，不改答案、选项校验和正确率算法。
- 完成此新小试仍沿现有正常成绩/奖励路径；其中匹配原题的有效结果更新原弱项，不能将答对任意同卦题视为原规则纠正。
- 反馈只称“本轮已纠正”，保留已解决记录供追溯，不删除历史项来表示完成。

当前版本固定写 curriculum-v1。将来题义改变须升级题库版本并更新相应兼容规则；不要把旧弱项的 questionVersion 静默改成当前版本。选项打乱、会话改变不构成题义变化。

若未来同一 ID 将指向不同规则，应给新规则新的稳定题 ID，保留旧引用的定位或失效回退；一项 questionId 键不能混合两种题义的错误次数与纠正证据。此处规定升级边界，本卡不预先建设新题库版本或新增历史存储。

## 6. 加载、导入与备份兼容

建议在 learning-progress.js 增加路径级 getWeakQuestionsError()，并接入 isLearningRecord 与 user-data.js 的 validateSnapshot。错误应包含形如 yijing-learning-record-v2.weakQuestions[题号].wrongCount 的定位。

- 旧记录缺 weakQuestions 合法；不从旧课成绩、旧卦码错题摘要或现有题库倒推出缺失历史。
- 复用已完成的 ID 字段保护模式：基础记录有效而弱项字段损坏时，保留有效旧成绩供读取；所有新写入口严格拒绝。不要把弱项校验直接塞进会导致整个记录 fallback 为空的读取验证器。
- UI 不应信任坏集合并直接遍历；给局部记录异常反馈和备份入口，不自动清空它。
- 新写入/导入只要校验失败便不写；导入仍在任何键修改前验证，写入异常仍按现有规则尝试回滚。
- 保持现有顶层键级恢复语义：备份缺学习键则保留当前键；null 明确删除；含学习键则替换该键。旧备份含学习键但无弱项时合法，恢复后没有该备份不包含的弱项；不能宣称现有导入会进行嵌套字段合并。
- 外层备份 format/version、11 键名单、1 MiB 导入限制不变。旧自由测验错题本和其他存储键保持兼容，不迁移成虚构的具体课程题。

## 7. 函数修改清单与独立所有权

以下为待实施分工，不代表文件已经修改；共享文件须由集成者安排单一所有者。

| 分组 | 可独立拥有的文件 | 最小修改 |
| --- | --- | --- |
| 数据与备份 | [learning-progress.js](../../../web/js/learning-progress.js)、[user-data.js](../../../web/js/user-data.js)、[learning-progress.test.mjs](../../../web/test/learning-progress.test.mjs)、[user-data.test.mjs](../../../web/test/user-data.test.mjs) | 字段校验、坏新字段保护、弱项状态转换、成绩/ID/receipt/弱项原子写入、路径错误、备份往返。 |
| 题库与组卷 | [learning-curriculum.js](../../../web/js/learning-curriculum.js)、[learning-assessment.js](../../../web/js/learning-assessment.js)、[learning-curriculum.test.mjs](../../../web/test/learning-curriculum.test.mjs)、[learning-assessment.test.mjs](../../../web/test/learning-assessment.test.mjs) | 真实引用元数据；requiredQuestionId 必入卷且不重复；失效引用拒绝；结果传递元数据，判分不变。 |
| 页面与流程集成 | [learning-assessment-page.js](../../../web/js/learning-assessment-page.js)、[learning-mode.js](../../../web/js/modes/learning-mode.js)、[review-mode.js](../../../web/js/modes/review-mode.js)、[main.js](../../../web/js/main.js)、[learning-assessment-page.test.mjs](../../../web/test/learning-assessment-page.test.mjs) | 实际入队/纠正/失败反馈；今日、温故、结果三入口；原课和原题上下文；真实鼠标/键盘/触控验收。 |

先冻结题目引用到逐题结果的接口，再并行数据组和组卷组。页面组不得另造 ID、重新评分或重复保存弱项。若需要新增测试/证据文件，实施开始时再明确归属。

### 7.1 不得顺带更改

- 不改掌握度的浏览10、小试35、抽查20、复讲15、阶段20权重。
- 不改 bestScore、正常 attempts、默认题量、实际不足题数、选项合法性或既有评分阈值。
- 不改既有成就条件、业务事件及幂等键，不为薄弱项纠正新造奖励。
- 不改卦象复习间隔算法和已有卡到期日。
- 不接管 T-LEARN-01 全部推荐排序、T-QUIZ-01 自由测验证据、T-LEARN-03 复讲/间隔复习幂等、T-CAPACITY-01 长期容量或其他页面改造。
- 不添加云端服务、数据库、框架或运行依赖，不触发远程发布。

## 8. 待执行的红绿回归与验收

以下全部是待执行项，不能以本记录或现有考评测试通过代替。

1. 真实题库各类题：稳定 ID、kind、版本、卦码/术语 ID 与原资料一致；纯理论、经传、三爻题不产生虚构六位码。
2. 组卷：requiredQuestionId 属于本课并入卷一次，原默认题量不变；题量不足用实际数；缺题、跨课、版本变化不随机替题。
3. 入队：理论、经传、L5 课程错题可入队；同 session 重试不变，新 session 再错归并并更新证据。
4. 纠正：打开来源不解决；另一题/另一版本答对不清原项；原题答对显示本轮已纠正；再次答错回 due；没有错过的正确题不建项。
5. 已处理记录：有/无 receipt、旧小试没有逐题结果、80 条历史截断后重试均不补造或重复累计。
6. 存储失败：成绩/弱项单键失败、活动失败、成就失败分别重试；不重复成绩、弱项或奖励；可选卦卡失败不重置旧卡。
7. 校验：缺字段旧记录、全量合法新记录、null/数组集合、键值 ID 不同、非法状态/计数/时间/编码；错误路径准确，失败前无写入。
8. 数据保护：损坏弱项保留原有效成绩，不通过 fallback 覆盖；合法历史失效题号回课程；导出/解析/导入往返；顶层缺键/null/覆盖语义及写失败回滚。
9. 真实交互：课程交卷→结果→温故→原课/原题回练→纠正；桌面鼠标和键盘、390px 模拟触控覆盖成功及保存失败重试；末项解决后仍有明确返回路径。
10. 最终集成：相关逻辑及页面测试、npm run validate、npm run test:e2e、差异检查；保存源码版本、命令、真实输出、截图、失败及未验证项。

相关测试的建议命令，**本记录尚未运行这些新增验证**：

```bash
node --test web/test/learning-curriculum.test.mjs web/test/learning-assessment.test.mjs web/test/learning-progress.test.mjs web/test/learning-assessment-page.test.mjs web/test/user-data.test.mjs
npm run validate
npm run test:e2e
git diff --check
```

新回归须先展示现状失败，再最小实现和转绿；已有 T-LEARN-05 回归保持通过。真实流程不能只靠直接调用业务函数或 DOM click 验收。移动真机、屏幕阅读器等未取得的证据仍明确列为未验证。

## 9. 下一位实施 AI 的首个动作

重新读取执行卡、专题 04/08、本记录和当前 git status，确认前置及文件所有权。先固定题目引用接口，补“真实课程全错但未入队”和“非法 weakQuestions 导入仍接受”的失败回归；保留原判分、receipt、幂等和奖励，再实现同键保存及 requiredQuestionId 普通小试。完成真实验证后更新权威专题、任务卡和交接；本设计记录不能作为任务已完成的证据。

## 10. 本文档检查记录

2026-10-25 保存时使用 Node 24 只读检查 Markdown 本地链接：27 处链接、18 个唯一目标全部存在，引用的显式章节锚点均存在，0 项失败。`git diff --no-index --check -- NUL docs/development/evidence/2026-10-25-course-weak-questions-design.md` 返回 1（与空文件相比存在新增差异），未报告空白错误，仅有 Git 的 LF/CRLF 提示。这里的检查只针对文档，不代表本方案实现或业务验收通过。
