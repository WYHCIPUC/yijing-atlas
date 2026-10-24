## 2026-10-25 未完成清单增量核对

本次按最新要求只盘点现状与提供目标文字，不新增需求或继续业务开发。原48卡完成3项（T-DIV-01、T-SAVE-01、T-LEARN-05），余45项：34已确认、10建议、1独立发布。

当前分支/PR头为 ec0f63c5c6f6aa052909014ec909090175451d10，push Quality 40126564693、PR Quality 40126568308 均success。上一轮文档/历史证据已提交；以下最新搜索与文档刷新仍未提交，不在上述CI范围。

搜索已有查询、八卦/关键词接入、语法帮助及IME/ARIA保护。已有开发日志记录validate 62脚本、317/317；专项1440/390输入2/2、320/768可达2/2、合成IME契约1/1。手机仍隐藏六位码，完整E2E及最终提交/CI尚缺，T-SEARCH-01保持开放。模拟触控/合成IME不代替真机、原生IME或读屏。本次未重跑业务验证。

## 2. P0：质量收尾与学习证据

以下2项均为「已确认」。T-QA-01是部分完成后的证据收尾，不能把旧标题理解成当前所有浏览器流程仍失败。

| 任务 | 当前边界 | 仍未完成的内容 | 原有前置 |
| --- | --- | --- | --- |
| [T-QA-01 定位并修复真实输入 E2E 失败](https://github.com/WYHCIPUC/yijing-atlas/blob/ec0f63c5c6f6aa052909014ec909090175451d10/docs/development/12-ai-execution-tasks.md#t-qa-01) | P0；已修复resize及跨区域取消，部分证据未取得 | 补真实窗口失焦及适用取消边界证据；保存默认摘要遮挡需转动才能第二选星的限制、主动失捕获为故障注入的边界和历史B-01无完整trace的归因限制。独立失败项逐一结案，不以全量烟测替代未取得输入 | 无 |
| [T-GROW-01 从真实考评入口接通成就证据](https://github.com/WYHCIPUC/yijing-atlas/blob/ec0f63c5c6f6aa052909014ec909090175451d10/docs/development/12-ai-execution-tasks.md#t-grow-01) | P0；引擎存在，业务入口与证据部分接通 | 补八卦完整 24 题轮次、上下经各 10 题、25 题综合考评的真实入口及提交证据；完成十二成就的条件—入口—事件—幂等映射、旧记录回补和保存失败处理，不能靠改 metrics 解锁 | T-QA-01、T-LEARN-05 |

## 3. 星图、搜索与阅读

以下 8 项均为「已确认」，现有图式、关系算法与分层阅读作为基础保留。

| 任务 | 优先级 / 当前边界 | 仍未完成的内容 | 原有前置 |
| --- | --- | --- | --- |
| [T-STAR-01 统一星图焦点退出和漫游路径](https://github.com/WYHCIPUC/yijing-atlas/blob/ec0f63c5c6f6aa052909014ec909090175451d10/docs/development/12-ai-execution-tasks.md#t-star-01) | P1；部分实现，摘要残留需真实复现 | 统一双击空白、Escape、全景返回、轨迹清除的焦点与摘要状态；DOM 关系目标和详情跳转一致记录 from/to；补可见最近五个卦节点路径、回退和清除，兼容底层五段轨迹 | T-QA-01 |
| [T-STAR-02 关系颜色线型与标记统一](https://github.com/WYHCIPUC/yijing-atlas/blob/ec0f63c5c6f6aa052909014ec909090175451d10/docs/development/12-ai-execution-tasks.md#t-star-02) | P2；关系逻辑已有，呈现未统一 | Canvas、图例、按钮/徽记及对读统一错综互变的颜色、线型和文字/方向标记；减少动态、灰度/强制颜色下仍可辨，保留明确动爻才生成变卦的规则 | T-STAR-01 |
| [T-STAR-03 接通任务和搜索目标标签优先级](https://github.com/WYHCIPUC/yijing-atlas/blob/ec0f63c5c6f6aa052909014ec909090175451d10/docs/development/12-ai-execution-tasks.md#t-star-03) | P2；共享避让及缓存已有 | 接入经六位码校验的搜索/课程只读目标，按当前卦→关系→搜索→学习任务→地标→普通排序；退出时清目标，目标变化参与缓存失效；补长词、边缘、控件占位和稳定排序证据 | T-SEARCH-01 |
| [T-SEARCH-01 补齐序号编码和上下卦搜索](https://github.com/WYHCIPUC/yijing-atlas/blob/ec0f63c5c6f6aa052909014ec909090175451d10/docs/development/12-ai-execution-tasks.md#t-search-01) | P1；解析、UI接入及专项输入已有未提交成果；整卡未闭环 | 手机结果恢复已要求的六位码展示，验证320/390下字段、滚动及点选；对最终源码跑完整E2E与必要回归、检查差异并提交同步。保留真机/原生IME/读屏未验证边界；不重复重写已接通的查询、语法帮助或ARIA | 无 |
| [T-READ-01 六爻正文与卦象逐爻联动](https://github.com/WYHCIPUC/yijing-atlas/blob/ec0f63c5c6f6aa052909014ec909090175451d10/docs/development/12-ai-execution-tasks.md#t-read-01) | P1；正文初至上、卦象初在下已实现 | 增加单一选爻状态与原生可达控件，联动图中爻位、爻辞/小象/项目解释及来源；补键盘选择、初爻默认、换卦重置、同卦快深读保留、指定动爻演示与缺字段提示 | T-QA-01 |
| [T-READ-02 关系正视对读和双动作](https://github.com/WYHCIPUC/yijing-atlas/blob/ec0f63c5c6f6aa052909014ec909090175451d10/docs/development/12-ai-execution-tasks.md#t-read-02) | P1；关系入口与演示能力已有 | 完成本卦→规则→目标卦的正视对读、改变爻及互卦取爻/综卦倒序依据；区分「星图定位」与「研读目标卦」动作；统一关系路径、指定变化带入实验室和退出来路，完整往返恢复镜头及关系 | T-STAR-01、T-READ-01 |
| [T-READ-03 跨模块经文上下文与返回](https://github.com/WYHCIPUC/yijing-atlas/blob/ec0f63c5c6f6aa052909014ec909090175451d10/docs/development/12-ai-execution-tasks.md#t-read-03) | P1；深链和运行内镜头/草稿已有 | 补课程逐卦与章节入口、内存来路对象；课程、占筮、复习与星图进入阅读后返回原上下文/滚动/有效控件；不重起卦或丢草稿；popstate 只恢复，过期上下文安全降级 | T-QA-01、T-LEARN-01、T-DIV-03 |
| [T-READ-04 快读信息布局与长正文协调](https://github.com/WYHCIPUC/yijing-atlas/blob/ec0f63c5c6f6aa052909014ec909090175451d10/docs/development/12-ai-execution-tasks.md#t-read-04) | P2；46/75dvh、暖纸及同 DOM 保留已有 | 将完整长正文在快读中组织成身份、核心经文/摘要、关系与学习状态信息区；同 DOM 渐进呈现，不复制经文或笔记输入；补窄屏目录/来源、五视口、多次快深切换、非零滚动与草稿证据 | T-QA-01、T-READ-02 |

## 4. 学习、测验与复习

以下5项均为「已确认」。既有五阶25课、判分和调度保留；课程阶段、掌握状态和修习成长不能混称。T-LEARN-05已经完成，不再列入本表。

| 任务 | 优先级 / 当前边界 | 仍未完成的内容 | 原有前置 |
| --- | --- | --- | --- |
| [T-LEARN-01 推荐优先队列与继续阅读](https://github.com/WYHCIPUC/yijing-atlas/blob/ec0f63c5c6f6aa052909014ec909090175451d10/docs/development/12-ai-execution-tasks.md#t-learn-01) | P1；部分实现 | 落实未完课程→到期复习→薄弱项→下一未学→复讲/解卦的稳定推荐、原因和入口；保存恢复最小课程位置；欢迎「零基础开始」直达 l1-1，不能把当前今日修习入口当作已经完成 | 无 |
| [T-LEARN-02 课程错题形成独立温习闭环](https://github.com/WYHCIPUC/yijing-atlas/blob/ec0f63c5c6f6aa052909014ec909090175451d10/docs/development/12-ai-execution-tasks.md#t-learn-02) | P1；文案与实际队列尚未完整接通 | 按具体题记录 weakQuestions、同轮去重、来源温习与原规则回练；有效答对后纠正；兼容题库换版和旧备份，不只显示「答错加入复习」 | T-LEARN-05 |
| [T-LEARN-03 统一四段修习反馈](https://github.com/WYHCIPUC/yijing-atlas/blob/ec0f63c5c6f6aa052909014ec909090175451d10/docs/development/12-ai-execution-tasks.md#t-learn-03) | P1；部分实现 | 考评、复习、自由测验和解卦统一结果/依据/实际记录变化/下一步；说明基于自评、真实保存状态及来源返回；补读屏顺序、一个主行动和至多两个次行动。本卡同时承接既有复习同轮幂等/失败重试、复讲旧响应隔离/仅保存重试，见第 11 节 | T-LEARN-02、T-QUIZ-01 |
| [T-QUIZ-01 具体错题证据与黄历薄弱项](https://github.com/WYHCIPUC/yijing-atlas/blob/ec0f63c5c6f6aa052909014ec909090175451d10/docs/development/12-ai-execution-tasks.md#t-quiz-01) | P1；自由测验判分已有 | 由卦码摘要补充规则、题型、目标证据；答对原规则才能清错；无卦码的黄历术语也能进入温习；纠正与复习证据关联；不把旧卦码伪造成具体旧题 | T-LEARN-02 |
| [T-LEARN-04 区分三种学习层级称谓](https://github.com/WYHCIPUC/yijing-atlas/blob/ec0f63c5c6f6aa052909014ec909090175451d10/docs/development/12-ai-execution-tasks.md#t-learn-04) | P2；部分实现 | 在标签、帮助、推荐和来源中区分课程五阶、掌握状态、修习成长 15 态；不重算原掌握度或修习值 | 无 |

## 5. 占筮、修习谱与观象录

以下 4 项均为「已确认」。稳定案例身份修复已完成；五个 checkbox 的主观自评仍不等于五步结构化挑战。

| 任务 | 优先级 / 当前边界 | 仍未完成的内容 | 原有前置 |
| --- | --- | --- | --- |
| [T-DIV-02 三路径与五步结构化解卦挑战](https://github.com/WYHCIPUC/yijing-atlas/blob/ec0f63c5c6f6aa052909014ec909090175451d10/docs/development/12-ai-execution-tasks.md#t-div-02) | P1；部分实现 | 补引导/自主/直接研读分流；按定象、取意、援经、成说、知止与 20 个结构检查点反馈，支持修改与幂等事件；记录路径/证据版本，「言之成理」只计合格自主案例，不评价现实应验或伪称理解了自由文本 | T-DIV-01（已完成）、T-GROW-01 |
| [T-DIV-03 占筮本卦与之卦正式研读入口](https://github.com/WYHCIPUC/yijing-atlas/blob/ec0f63c5c6f6aa052909014ec909090175451d10/docs/development/12-ai-execution-tasks.md#t-div-03) | P1；部分实现 | 金钱、数字梅花、时间梅花和完整历史结果提供明确本卦/之卦读经动作与正确章节；无变不重复按钮；读经不重起卦、不新增历史；完整返回上下文与 T-READ-03 对接。本卡同时承接时间法的当次时区/时间来源提示及历史保留，见第 11 节 | T-DIV-01（已完成） |
| [T-GROW-02 修习谱十二项进度与证据视图](https://github.com/WYHCIPUC/yijing-atlas/blob/ec0f63c5c6f6aa052909014ec909090175451d10/docs/development/12-ai-execution-tasks.md#t-grow-02) | P1；引擎已有，展示部分实现 | 完成总览/印谱/能力视图，展示十二项条件、进度、达成时间、来源、规则版本和下一步；诚实标旧汇总证据，回补幂等；观象录实际保存由后继任务负责 | T-GROW-01 |
| [T-PRIV-01 主动保存的观象录](https://github.com/WYHCIPUC/yijing-atlas/blob/ec0f63c5c6f6aa052909014ec909090175451d10/docs/development/12-ai-execution-tasks.md#t-priv-01) | P1；未实现 | 按既有 yijing-observations-v1 契约补主动保存、独立同意的可选私文、列表/查看/编辑/删除与失败反馈；同时交付备份恢复和公开分享排除；自动技术历史不能当观象录 | T-DIV-02、T-GROW-02、T-BACKUP-02 |

## 6. 黄历工作台

以下 3 项均为「已确认」，保留上海历日、支持范围及现有历法算法。

| 任务 | 优先级 / 当前边界 | 仍未完成的内容 | 原有前置 |
| --- | --- | --- | --- |
| [T-CAL-01 黄历七日轴与日期语义](https://github.com/WYHCIPUC/yijing-atlas/blob/ec0f63c5c6f6aa052909014ec909090175451d10/docs/development/12-ai-execution-tasks.md#t-cal-01) | P1；部分实现 | 补七日轴、日期选择、返回今日、1900—2199 边界和键盘同步；非今日称谓准确；说明欢迎设备日与黄历上海日差异，不借界面改造擅自统一算法口径 | 无 |
| [T-CAL-02 三段日课与内联术语笺注](https://github.com/WYHCIPUC/yijing-atlas/blob/ec0f63c5c6f6aa052909014ec909090175451d10/docs/development/12-ai-execution-tasks.md#t-cal-02) | P1；部分实现 | 时序/民俗/学习三段默认展开，区分来源；补内联术语、焦点恢复、宜忌清单、真实节气区间进度和缺数据说明；空宜/空忌不从空数组推「诸事不宜」，先核对数据语义；不得合成古籍引文填空 | T-CAL-01 |
| [T-CAL-03 公开历笺分享](https://github.com/WYHCIPUC/yijing-atlas/blob/ec0f63c5c6f6aa052909014ec909090175451d10/docs/development/12-ai-execution-tasks.md#t-cal-03) | P1；未实现 | 为所选日期建立公开白名单模型，本地生成、可访问预览、PNG 下载及可用时系统分享；覆盖取消、绘图失败、长文案和边界回退，图片/链接/分享文字排除私文与配置 | T-CAL-02、T-SHARE-01 |

## 7. 界面、声音与无障碍组件

以下 5 项均为「已确认」。当前视觉基础与本地 SVG 系统已有，不重新设计整站或重新启用弃用音色。

| 任务 | 优先级 / 当前边界 | 仍未完成的内容 | 原有前置 |
| --- | --- | --- | --- |
| [T-SOUND-01 音效由业务成功显式触发](https://github.com/WYHCIPUC/yijing-atlas/blob/ec0f63c5c6f6aa052909014ec909090175451d10/docs/development/12-ai-execution-tasks.md#t-sound-01) | P1；部分实现 | 去除 document click/class 猜测业务结果的方式，成功状态改变后显式触发；复习自评、术语、非法输入、取消和保存失败不误发完成声；补重复/重渲染边界 | 无 |
| [T-SOUND-02 正式音源台账与音量并发控制](https://github.com/WYHCIPUC/yijing-atlas/blob/ec0f63c5c6f6aa052909014ec909090175451d10/docs/development/12-ai-execution-tasks.md#t-sound-02) | P2；控制部分实现，正式素材有外部输入 | 补既定 0—100 音量、恢复/静音、冷却并发与降级；正式文件对应批准用途和许可，完成长时/耳机试听；未批准的第二轮声景不能写成正式资产 | T-SOUND-01、T-ASSET-01 |
| [T-MODAL-01 统一模态、隐藏控件与焦点栈](https://github.com/WYHCIPUC/yijing-atlas/blob/ec0f63c5c6f6aa052909014ec909090175451d10/docs/development/12-ai-execution-tasks.md#t-modal-01) | P2；部分实现；焦点警告及透明工具可 Tab 到已复现 | 修复欢迎按钮/梅花输入仍有焦点时祖先设 aria-hidden、快读透明工具仍在 Tab 顺序的问题；统一顶层 Escape、原 inert 恢复、有效焦点、嵌套/resize/失败清理及独立暂停原因；不能用隐藏日志代替修复 | T-QA-01 |
| [T-ICON-01 残留字符图标与可访问名称](https://github.com/WYHCIPUC/yijing-atlas/blob/ec0f63c5c6f6aa052909014ec909090175451d10/docs/development/12-ai-execution-tasks.md#t-icon-01) | P2；本地图标系统已有 | 清点黄历箭头/关闭、转盘及反馈中的字符假图标，用本地 SVG 白名单替换；装饰隐藏、按钮准确命名；补重复安装幂等、强制颜色和窄屏，保留真实卦符及知识文字 | 无 |
| [T-ASSET-02 检查并替换伪文字材质](https://github.com/WYHCIPUC/yijing-atlas/blob/ec0f63c5c6f6aa052909014ec909090175451d10/docs/development/12-ai-execution-tasks.md#t-asset-02) | P2；已知风险待实际视觉复核 | 查看太极仪纹理并定位可疑环及使用处；用获准无字资产或完整遮蔽后以真实数据重绘；核许可、体积、系统/浏览器放大与失败降级；不能把待复核风险写成已发现全部伪字 | T-ASSET-01 |

## 8. 数据、可选接口、隐私与离线

以下 7 项均为原台账中的 P2「建议改进」，不是本次新增需求。当前没有业务后端；接口事项仅指已有可选评阅客户端的加固。

| 任务 | 当前边界 | 仍未完成的内容 | 原有前置 |
| --- | --- | --- | --- |
| [T-BACKUP-01 备份容量可往返](https://github.com/WYHCIPUC/yijing-atlas/blob/ec0f63c5c6f6aa052909014ec909090175451d10/docs/development/12-ai-execution-tasks.md#t-backup-01) | 部分实现；导出/导入限制不对称已从代码确认 | 统一 UTF-8 字节容量策略，验证接近、等于、超过 1 MiB 的合成备份能否往返；超限要提示并保全原数据，不截断笔记；兼容既有备份、成就专用限制及 Blob 失败 | 无 |
| [T-BACKUP-02 深层校验与回滚失败反馈](https://github.com/WYHCIPUC/yijing-atlas/blob/ec0f63c5c6f6aa052909014ec909090175451d10/docs/development/12-ai-execution-tasks.md#t-backup-02) | 部分实现；损坏样例与回滚失败需补复现 | 补嵌套字段和领域校验、准确错误位置、全量通过后再写；覆盖第 n 次写入失败及回滚也失败，明确可能部分恢复并给恢复指引；保留缺失键不变、null 删除、未知键不写的兼容规则 | 无 |
| [T-API-01 可选评阅端点解析与异常防护](https://github.com/WYHCIPUC/yijing-atlas/blob/ec0f63c5c6f6aa052909014ec909090175451d10/docs/development/12-ai-execution-tasks.md#t-api-01) | 客户端部分实现；仓库没有评阅服务端 | 使用 URL 解析严格判断同源、协议和异常路径，限制不可信重定向、验证响应；覆盖未配置、静态 404、20 字边界、15 秒超时和畸形响应，本地自评始终可用；不新增 API 服务或网页密钥 | 无 |
| [T-CACHE-01 SW只删除自身缓存](https://github.com/WYHCIPUC/yijing-atlas/blob/ec0f63c5c6f6aa052909014ec909090175451d10/docs/development/12-ai-execution-tasks.md#t-cache-01) | 部分实现；清理范围风险已由代码确认 | 激活时只清理本应用旧代缓存，保留其他同源应用的 CacheStorage；验证首次安装、升级、旧页并存与离线恢复，不触碰 localStorage 和用户备份 | 无 |
| [T-CACHE-02 离线范围与版本更新可见](https://github.com/WYHCIPUC/yijing-atlas/blob/ec0f63c5c6f6aa052909014ec909090175451d10/docs/development/12-ai-execution-tasks.md#t-cache-02) | 核心预缓存、可选模块访问后缓存已有实现 | 补首次/访问后离线矩阵，区分未下载、网络失败和数据损坏；补可见注册/更新状态与重试；有草稿时不自动刷新，清理只涉及本应用缓存；不承诺未访问模块全部离线 | T-CACHE-01 |
| [T-CAPACITY-01 长期本地容量与幂等保全](https://github.com/WYHCIPUC/yijing-atlas/blob/ec0f63c5c6f6aa052909014ec909090175451d10/docs/development/12-ai-execution-tasks.md#t-capacity-01) | 未完成长期容量专项测量，不等于已发生数据丢失 | 用 1/3/10 年合成事件与长笔记测量字节、写入耗时、导出大小及失败点；形成容量预算和恢复演练；如需压缩，应保留等价幂等证据与旧备份兼容，不能裁键造成重复奖励 | T-BACKUP-01、T-BACKUP-02 |
| [T-SHARE-01 分享链接显式公开白名单](https://github.com/WYHCIPUC/yijing-atlas/blob/ec0f63c5c6f6aa052909014ec909090175451d10/docs/development/12-ai-execution-tasks.md#t-share-01) | 公开图片模型已有隐私边界；链接仍保留其他 query | 所有分享出口共用公开 URL 白名单，只保留已批准的公开字段，排除其他 query、hash 和凭据；验证 Pages 子路径、六位码深链、系统分享取消及不支持时下载回退；仅用合成敏感参数测试 | 无 |

## 9. 资产、依赖与内容治理

| 任务 | 原有优先级 / 需求性质 | 仍未完成的内容 | 原有前置 / 外部条件 |
| --- | --- | --- | --- |
| [T-ASSET-01 资产和第三方许可总账](https://github.com/WYHCIPUC/yijing-atlas/blob/ec0f63c5c6f6aa052909014ec909090175451d10/docs/development/12-ai-execution-tasks.md#t-asset-01) | P2 / 已确认；部分实现 | 清点 vendor、图、字体、声音与参考帧，区分运行/研究/宣传用途；统一版本、来源、作者、许可、修改、批准与分发范围索引，缺证明保留限制；不能统一把 GSAP 写成 MIT 或把研究资料当公开资产 | 无；需要真实许可、来源和批准证据 |
| [T-DEP-01 依赖与本地vendor版本维护](https://github.com/WYHCIPUC/yijing-atlas/blob/ec0f63c5c6f6aa052909014ec909090175451d10/docs/development/12-ai-execution-tasks.md#t-dep-01) | P2 / 建议改进；部分实现 | 建立包锁/vendor 头版本/入口账本，先报告漂移；确需升级时逐库核官方变更和许可，同步本地文件、缓存、回归与回退；不进行无关批量大版本升级，也不以现有检查断言无漏洞 | T-ASSET-01 |
| [T-CONTENT-01 原典与项目资料逐条校勘](https://github.com/WYHCIPUC/yijing-atlas/blob/ec0f63c5c6f6aa052909014ec909090175451d10/docs/development/12-ai-execution-tasks.md#t-content-01) | 持续内容 / 已确认；校勘未完成 | 按卦/篇/条目确定可用底本及授权，逐字段对影印，记位置、异文、校对者与日期；数据 diff 和派生回归后更新校验状态；缺来源仍显示待校验 | T-ASSET-01；真实底本、授权和独立校对者 |
| [T-CONTENT-02 六家3840锚点内容工程](https://github.com/WYHCIPUC/yijing-atlas/blob/ec0f63c5c6f6aa052909014ec909090175451d10/docs/development/12-ai-execution-tasks.md#t-content-02) | 持续内容 / 已确认；草稿，受门禁约束 | 先在门禁关闭下补既定 --draft-batch 校验和合成回归，再按六家×64 卦×10 锚点逐批补真实文本/不适用理由、定位及双校；当前 0/64、0/3840、releaseReady=false，全量证据齐备再审开放 | T-CONTENT-01；真实文本、来源/许可与双人校对，AI 不得伪造 |

## 10. 验收、打包、复制与独立发布

| 任务 | 原有优先级 / 需求性质 | 仍未完成的内容 | 原有前置 / 验收条件 |
| --- | --- | --- | --- |
| [T-QA-02 新增纯逻辑覆盖率纳入计量](https://github.com/WYHCIPUC/yijing-atlas/blob/ec0f63c5c6f6aa052909014ec909090175451d10/docs/development/12-ai-execution-tasks.md#t-qa-02) | P2 / 已确认；已有测试，计量范围未补 | 测 reading-state、star-label-layout 的真实缺口，补非法动作/代码/section、长词/视口/排序/缓存等有效边界，再加入正式 include；报告集合和各模块三指标，不降门槛 | 无 |
| [T-QA-03 证据目录参数与可携带日志](https://github.com/WYHCIPUC/yijing-atlas/blob/ec0f63c5c6f6aa052909014ec909090175451d10/docs/development/12-ai-execution-tasks.md#t-qa-03) | P2 / 建议改进；局部完成 | 补受控目录参数、证据根约束、失败也写环境/HEAD/快照/命令/退出码/截图清单的摘要契约；补并行 run、不存在目录及写失败测试；新 smoke-ISO 目录、25 图和随仓库日志已完成 | 无 |
| [T-A11Y-01 真机读屏真实缩放与兼容验收](https://github.com/WYHCIPUC/yijing-atlas/blob/ec0f63c5c6f6aa052909014ec909090175451d10/docs/development/12-ai-execution-tasks.md#t-a11y-01) | 外部验收 / 已确认；缺目标环境证据 | 在实际 Android/iOS、NVDA/VoiceOver、真实 200% 和既定浏览器/强制颜色环境跑主流程；记录设备版本、焦点播报、软键盘/安全区、对比度、长词与恢复；CDP 触控/视口/AX 树不能代替 | T-QA-01、T-MODAL-01；真实目标设备与读屏环境 |
| [T-PERF-01 当前UI性能与长时降级证据](https://github.com/WYHCIPUC/yijing-atlas/blob/ec0f63c5c6f6aa052909014ec909090175451d10/docs/development/12-ai-execution-tasks.md#t-perf-01) | 外部验收 / 已确认；当前完整证据未取得 | 固定设备/缓存/节流，采三次原始结果及中位数；测首屏、首次意图、漫游、阅读暂停、长时内存、标签频率、像素预算和销毁监听；正常/减少动态/低功耗/后台分别测，仅按热点最小优化 | T-QA-01；可重复测量环境，旧 v50 报告不替新 UI |
| [T-WIN-01 当前源码本地Windows重建验收](https://github.com/WYHCIPUC/yijing-atlas/blob/ec0f63c5c6f6aa052909014ec909090175451d10/docs/development/12-ai-execution-tasks.md#t-win-01) | 本地收尾 / 已确认；当前包未验收 | 当前源码构建并运行 test:windows，人工启动/退出、无 Node 环境、端口占用顺延、GET/HEAD/404/405、深链、离线和恢复；保存源快照、版本、嵌入清单及 SHA256；不上传、不冒用旧 EXE | T-QA-01、T-ASSET-01 |
| [T-RELEASE-01 未来独立远程发布与生产复验](https://github.com/WYHCIPUC/yijing-atlas/blob/ec0f63c5c6f6aa052909014ec909090175451d10/docs/development/12-ai-execution-tasks.md#t-release-01) | 独立发布 / 未来独立方案；当前不执行 | 另行要求发布后，确定发布单元、版本/tag/资产与门禁，执行 Quality/Pages/Release；生产复验资源、深链、SW、分享、离线、三次性能并留回滚记录；GitHub 开发同步不等于发布许可 | T-QA-01、T-WIN-01、T-A11Y-01、T-PERF-01，以及另行发布要求 |
| [T-COPY-01 无Git副本的检查兼容方案](https://github.com/WYHCIPUC/yijing-atlas/blob/ec0f63c5c6f6aa052909014ec909090175451d10/docs/development/12-ai-execution-tasks.md#t-copy-01) | P2 / 建议改进；可选兼容未实现 | 用隔离夹具复现无 .git 情况，提供显式副本检查模式/独立命令、分发文件范围与异常扩展名检查；正常仓库仍查 Git 跟踪树；不暗中 git init，不把复制源文件当浏览器学习数据迁移 | 无；首选保留 .git |


## 12. 可直接用于设定项目目标的文字

> 在易象图谱当前工作区和已有未提交成果的基础上，以《开发建设总册》、原48张执行卡及《未完成事项清单与项目目标文字》为依据，按既定优先级和依赖完成剩余34项已确认要求。保留已完成的历史身份、深读保存和考评幂等成果，补齐未取得的输入验收证据；继续完善星图搜索、关系路径、逐爻对读、快读与跨模块返回，接通课程推荐、错题温习、修习反馈和成就证据，完成三路径五步解卦、修习谱、主动保存的观象录、黄历工作台与公开历笺。按原卡落实复习幂等与失败重试、复讲旧响应隔离与仅保存重试、梅花时间来源及当次时区提示，并完成已确认的界面、音效、无障碍、内容校勘、资产治理、性能和本地打包验收。10项建议保持待采纳性质，不自动扩大范围；前置未满足或缺少外部材料时保留具体缺口。保持原生静态架构及现有卦码、历法、关系、判分和调度规则，不新增账号、云同步、数据库、管理后台或业务后端。每项均依据实际测试与适用环境证据验收，更新任务、交接和GitHub开发进度；不得伪造底本、许可、双校、真机或读屏结果，不绕过内容门禁。远程合并、Pages和Release发布仍作为另行安排的独立事项。

既有复习幂等和保存重试、复讲旧响应隔离和仅保存重试归T-LEARN-03；梅花当次时区/时间来源归T-DIV-03；真实节气进度归T-CAL-02，不另增任务。10项建议不自动采纳，确认项对建议卡的原有依赖保持未满足，不能绕过。

真机、读屏、真实200%缩放、当前性能及Windows包仍保留原验收边界；六家0/64、0/3840，门禁关闭，不伪造许可或双校。GitHub同步为开发进度，PR保持Draft，不合并main或发布Pages/Release。
