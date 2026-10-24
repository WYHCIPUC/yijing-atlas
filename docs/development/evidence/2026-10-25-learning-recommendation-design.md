# T-LEARN-01 推荐与课程续读实施记录

开始日期：2026-10-25（Asia/Shanghai）；业务基线`995dd2c2befccdc0cab38300101a9efa857c021c`。范围仅为原执行卡T-LEARN-01及04§3、08§7.1.1，不新增课程、考试类型或持久化正文。

## 既定要求与实施接口

优先级为：明确开始但未完成本轮小试的课程 → 到期卦卡 → 课程/测验薄弱项 → 下一未浏览课 → 既有复讲。课程weakQuestions的due只是状态，不是卦卡的到期时间。旧错题数组只有卦码，不推造原题型或版本。

使用现有学习记录V2的可选resume，字段为lessonId、section、scrollTop、updatedAt。section使用intro/observe/read/explain/apply/practice，滚动值有限且在0—10000000。旧记录缺字段或null合法；不从lastStudiedAt、viewedAt或低分推造阅读位置。进入课程建立显式位置，同课普通小试新提交保存成功时原子清null，分数高低不影响该轮结束；失败、重复旧session、跨课、抽查和阶段考评不清当前续读指针。

- 数据API：getLearningResumeError(value)返回字段路径或null；saveLearningResume(position, now, storage)只保存白名单位置字段并返回record/saved。
- 推荐API：recommendLearningTask(record, options)是纯函数，注入reviewCards、wrongCodes、now和lessons，返回type/subject/reason及该任务所需的count、resume或question。旧recommendLesson继续供课程下拉等兼容调用。
- 今日主卡按任务类型进入实际课程、到期温故、原题回练、旧错题模式或复讲；一个主行动并注明原因与完成标准。无效恢复位置给明确提示，不清成绩。
- 欢迎“零基础开始”直接进入l1-1；普通学习导航仍进今日修习。复讲使用独立初始定位参数，不借initialLessonId误开小试。
- 课程渲染和学习模式返回清理函数；主模式切换/关闭以及课内重绘及时解绑监听、取消旧帧。实际滚动容器为detail-panel；恢复排在外层归零之后，未完成恢复前不保存初始化零位置。首课正常进入保留概览，有六段恢复位置则进入正文。

## 文件所有权与验收

数据代理负责learning-progress/user-data及对应测试；UI代理负责study-page、learning-mode、learning-assessment-page及UI测试；集成者负责推荐纯函数、main导航与生命周期及相关测试。已有课程错题提交保持可追溯，不回退其他代理改动。

关键失败回归：五级竞争、同级稳定排序、旧数据无恢复字段、坏位置保全成绩、写失败及备份、同课/跨课/重复交卷清除差异、晚到RAF和监听不写新页、恢复“解”段及非零滚动、欢迎直达首课、各种主卡真实跳转。先记录失败再实现；最终validate、E2E与专项真实输入分别记录，当前尚未验证通过。

外部设备和内容门禁沿原卡保持。不得以静态模板测试替代实际滚动恢复，也不将仅在内存的未提交答案或复讲草稿写成刷新可恢复。

## 当前冻结状态

2026-10-25按用户盘点要求停止继续实现，保留全部未提交工作。数据与页面各有部分草稿，但推荐纯函数和main集成未完成；学习模块缺命名导出，实际导入失败。本次复核数据47/47、推荐0/13；完整UI回归、浏览器和全量验证尚未通过。后续实施从[最新盘点证据](2026-10-25-remaining-work-current-snapshot.md)接续，不以局部测试或995dd2c的CI宣称整卡完成。
