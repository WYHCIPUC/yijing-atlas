# T-SEARCH-01 搜索真实输入专项

需求依据：[星图搜索规格§7](../03-star-map-search-reading.md)、[T-SEARCH-01执行卡](../12-ai-execution-tasks.md#t-search-01)。本专项只拥有独立 `scripts/test-search-input.mjs` 及本报告/时间戳证据，不修改应用源码或原输入探针，不提交。

## 驱动与证据边界

- 原生Node WebSocket/CDP，复用项目静态服务器，在随机端口和独立 `yijing-search-input-*` 临时profile运行；不连接用户浏览器。
- 数字通过真实CDP键盘事件输入，中文通过 `Input.insertText` 提交为可信 input 事件；后者不代表操作系统中文输入法验收。鼠标/触控使用真实 `Input`；不调用DOM `.click()`或应用业务函数。
- DOM读取结果、ARIA和阅读呈现；只在StarMap构造器启动绘制前停一次，保存现有对象的只读引用，随后仅观察焦点/关系/镜头，不调用对象方法。
- 旁路记录11个通用备份键的Storage写入，并比较原始存储值；不注入学习记录、不拦截业务保存结果。以欢迎关闭后的状态为基线，检查查询和确认不写正式阅读/复习/成就等学习数据。
- 每次保存运行时、浏览器、源码SHA256首尾、真实输入记录、断言与截图。所有旧失败保留；未运行的场景不登记通过。
- Headless桌面与390px模拟触控不是手机真机、屏幕阅读器、真实200%缩放或真实IME证据。

## 03:34 界面接入前的有限红灯

启动前只读核对 `node.exe` / `msedge.exe` / `chrome.exe` 命令行，匹配 `scripts/test-search-input.mjs` 或 `yijing-search-input-*` 隔离profile的进程为 **0**。实际只运行1440×1024一条查询，没有启动完整矩阵。

```powershell
$env:YIJING_SEARCH_SCOPE = 'pre-ui-trigrams'
& 'C:\Users\1\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' scripts/test-search-input.mjs
```

结果：**exit 1，0/1通过，确定的界面接入缺口**。[完整trace](2026-10-25-search-input/2026-10-24T19-34-11-506Z/trace.json)、[失败截图](2026-10-25-search-input/2026-10-24T19-34-11-506Z/1440-pre-ui-trigrams-failure.png)。

真实鼠标点击欢迎“探索”，Ctrl+K聚焦搜索，中文提交 `上坤下乾` 后：

- `value=上坤下乾`，可信 `input.isTrusted=true`。
- `options=[]`，提示“没有找到相关卦象”，`aria-expanded=true`。
- 期望首项“泰”的断言失败；后续确认动作没有执行。
- 当前没有聚焦卦，`readingStage=none`、详情隐藏、URL没有 `hex`，观察到的11个学习键写入为0。

受测调用为 `main.js` 两参数 `searchHexagrams(state.hexagrams, keyword)`，没有传实际八卦资料；新纯查询逻辑要求由调用方传 `trigrams`，缺少时不猜测映射并返回空。该次红灯确认的是界面接入缺口，不表示纯查询解析算法未实现。

环境：Node `v24.19.0`、libuv `1.52.1`、Edge `155.0.4283.62`。无捕获的页面异常或浏览器日志；profile清理完成。受测全部源码hash首尾一致，主要文件：

| 文件 | SHA256 |
| --- | --- |
| `web/js/data-loader.js` | `bb46b30bab562f648df3a0e6887ba01a02e627bebf46b6fc2c9411eb5c52404a` |
| `web/js/search-controller.js` | `48a183cec80f496317806b56aea85a0ca5098772bd5fca395dfe7ca367f9bffc` |
| `web/js/main.js` | `2c68c387383f70215420db70485bd18cbc7f00334722c6ca8fa7e6a29a1326b7` |
| `web/index.html` | `3eb1072260c48ece01051af175ec44639e357b5f1ec4d151a2bb69bd07b73ec3` |
| 探针 | `d9359c6688a2e4664a72df19a8217236d2d50a13380f8dea14a26f42e08dc924` |

此时完整1440/390正反查询、上下方向/Home/End、第一次Escape保留原焦点关系、第二次Escape逐层返回、触控点选、输入法组合契约等均尚未完成本轮验证；等待界面接入后运行。新增帮助/局部状态接口约定为 `#search-help`、`#search-status`，本轮红灯前版本尚不存在，不虚记UI验收。

## 03:42–03:47 接入后运行与保留的失败

| 运行 | 实际结果及用途 |
| --- | --- |
| [03:42完整首跑](2026-10-25-search-input/2026-10-24T19-42-44-443Z/trace.json) | exit 1。桌面10种正查询及渐选择已完成，在非法“0”断言处要求camera完全相等却未先停止自动巡天；仅yaw由 `0.3149688` 推进至 `0.3167688`，位置/目标/关系保持。这是静止镜头测试前提错误，不能算搜索改变镜头的产品缺陷。 |
| [03:43修正前提](2026-10-25-search-input/2026-10-24T19-43-25-827Z/trace.json) | exit 0，1440/390逻辑2/2。改为通过真实 `#auto-rotate` 用户按钮停止巡天，再严格比较镜头；不使用容差、固定延时、业务调用或关闭正常镜头动效。尚未显式断言搜索前后巡天开关，也未等待截图内元素完整显现。 |
| [03:44开关保持](2026-10-25-search-input/2026-10-24T19-44-41-704Z/trace.json) | exit 0，1440/390逻辑2/2，增加输入/确认/取消前后 `autoRotate` 保持。截图仍不作最终稳定态依据。 |
| [03:45稳定态首跑](2026-10-25-search-input/2026-10-24T19-45-50-369Z/trace.json) | 两个行为场景完成，但最终 **exit 1**。运行中应用搜索弹层CSS过渡从继承320ms改为220ms，CSS SHA首尾不同，自动登记 `Sources changed during run`；不得用此轮作为同源码总通过。 |
| [03:46冻结版本完整矩阵](2026-10-25-search-input/2026-10-24T19-46-35-075Z/trace.json) | **exit 0，1440/390共2/2**，稳定态截图与严格输入/存储断言通过。 |
| [03:47窄屏及平板](2026-10-25-search-input/2026-10-24T19-47-02-235Z/trace.json) | **exit 0，320/768共2/2**，帮助可见、搜索弹层无视口溢出、末项实际可达并可选。 |
| [03:47组合契约](2026-10-25-search-input/2026-10-24T19-47-09-975Z/trace.json) | **exit 0，1/1合成契约**；不计为真实操作系统IME通过。 |

所有本段运行均使用Node `v24.19.0` / libuv `1.52.1`、Edge `155.0.4283.62`。除已明确列出的CSS变动轮，其余trace保存的源码首尾一致。所有本段profile清理完成，无 `Runtime.exceptionThrown`。完整矩阵有两条 `academy-astrolabe-bg.webp` 预加载后未使用警告（每视口1条）；窄屏和合成契约无日志。没有清理旧专项被拒的目录。

## 完整输入矩阵实际覆盖

1440×1024使用真实键盘确认及鼠标点选，390×844使用真实CDP触控点击输入/结果；数字用键盘事件，中文用CDP提交文本。390中的Ctrl+A、Home/End及Escape属于模拟硬件键盘输入，不宣称手机软键盘或真机手势验证。

| 输入或动作 | 可观察断言 |
| --- | --- |
| `111111`、`1`、带首尾空格编码 | 首项编号1、乾、`111111`，确认仅聚焦。六位码不按十进制卦序误解。 |
| `64`、`第64卦` | 首项未济，编号64，匹配实际底至顶编码。 |
| `下乾上坤`、`上坤下乾` | 两种方向词序均返回泰，真实确认后摘要与焦点一致。 |
| `乾`、`乾为天`、`潜龙勿用` | 精确卦名、全称、旧全文能力保留，乾排首项。 |
| `0`、`65`、`1111111` | 无结果及格式状态；真实Enter不误选。 |
| 渐→互→非法查询→Escape | 第一Escape关闭建议，保留渐、互、镜头、URL及巡天开关；外侧真实控件点击关闭建议也不退出旧聚焦。 |
| 第二次Escape | 建议已关闭后沿现有阅读层级退出聚焦，摘要隐藏，不创建阅读记录。 |
| 空白输入 | 关闭建议，不列全64卦。 |
| `君子`及End/Home/上下键 | 最多8项、卦码去重、普通全文稳定卦序；`aria-selected`只有一个，`aria-activedescendant`指向对应项；仅换选项不换镜头。 |
| Ctrl+K；桌面斜杠 | 真实键盘聚焦搜索。 |

每次输入和确认检查 `readingStage=none`、详情隐藏、无 `?hex=`；确认前不改变当前卦，确认后正确聚焦且巡天开关保持。11个通用备份键原始值与基线一致，写入尝试为0；没有正式深读、复习卡或成就副作用。完整矩阵两视口的记录事件全部为 `isTrusted=true`，390中保留96条触控相关事件。

## 稳定态截图与几何观察

截图前按实际条件轮询：popup/results与视口内选项的有效opacity至少0.99、无运行/等待中的Web Animations，跨两个实际requestAnimationFrame的计算样式、矩形、滚动和命中结果相同。没有用固定sleep跳过动画。trace逐项保存 `opacity`、祖先累计有效opacity、`background`、`transform`、`position`、`zIndex`、`rect`、`scrollTop`及中心 `elementFromPoint`；屏外末项会按真实滚动后重新命中再点选。

- [390稳定态结果](2026-10-25-search-input/2026-10-24T19-46-35-075Z/390-search-keyboard-aria.png)：popup有效opacity为1、背景为不透明 `rgb(9,17,30)`、恒等transform；8项中心均命中本项/子元素。先前截图的透明观感没有在稳定态复现。帮助顶部被裁去对应 `scrollTop=55`，由实际End/Home导航导致，不是文本丢失。
- [320初始帮助](2026-10-25-search-input/2026-10-24T19-47-02-235Z/320-search-open-help.png)：popup为x11、右307、y63、底683；文档宽320，popup内部滚动宽等于可用宽。帮助完整可读，计算字号17px。
- [768初始帮助](2026-10-25-search-input/2026-10-24T19-47-02-235Z/768-search-open-help.png)：popup为x357、右747、y63、底683；文档宽768，无水平溢出，帮助字号17px。
- 320用End滚至末项，再以真实触控确认；768以真实鼠标确认。输入和最终聚焦分别保存在对应trace及 `*-search-last-selected.png`。这些几何和实际命中结果已经验证，不将截图中不在可视区的项假记为“初始即全部可见”。

本段三张图片已人工查看：稳定态popup遮盖底层星图，帮助与结果可读。另发现旧手机CSS `immersive.css:553` 对 `.search-option code` 使用 `display:none`，320/390截图未展示六位码；该点已交集成者对照专题§7处理，本段不把“所有规定字段在手机可见”登记通过。

## 输入法合成契约的边界

独立 `ime-contract` scope先以真实输入聚焦渐，再查询64；仅在此scope通过标准DOM分发 `CompositionEvent` 与带 `isComposing` / `keyCode=229` 的 `KeyboardEvent`。合成组合开始关闭建议，ArrowDown/Enter/Escape及229场景不改变原焦点、关系、镜头或学习数据；组合结束重新显示当前64的未济结果，随后真实Enter能确认。

合成事件在trace中明确 `trusted=false`。该组只验证组合状态和全局事件冒泡保护契约，**不是实际中文输入法、候选窗或设备验收**；真实输入矩阵不混入这些合成事件。

## 复跑命令与当前边界

以下三个scope均已按顺序实际执行；每个产生独立时间戳目录：

```powershell
foreach ($scope in @('', 'visual-geometry', 'ime-contract')) {
  $env:YIJING_SEARCH_SCOPE = $scope
  & 'C:\Users\1\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' scripts/test-search-input.mjs
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
```

03:46/03:47最终三组的共同源码：`main.js=dd9c86db49308fc379944841cd77aaf6a7e848119450055b28f0bb1412f8d2e2`，`index.html=3c604aeb4bb02d51177d2f42eb4ec0294039f2362894c70b257a1d0f3846dbe6`，`immersive.css=22c8adb51d8cb8e24db48338cd2a21e125fc71ab0c22525cdb745b7042110e70`，探针 `6f47675e2e807b1fef64453c5af08650ac0184b8245d8fdfa3b83d13e53fc04f`；其他模块SHA见trace。

本专项没有浏览器故障注入核心索引缺失或关键词请求失败/迟到，也没有验证真机、屏幕阅读器、真实浏览器200%缩放、macOS Cmd+K或真实IME。对应纯逻辑/UI回归及全量validate/E2E由集成者整合，不把其结果当作本探针的新运行。没有触发远程发布。

本段收尾实际检查：备用Node `--check scripts/test-search-input.mjs`、限定文件 `git diff --check` 均exit 0；报告14处本地链接全部存在。新增探针/证据尚未提交。

## 03:53 手机六位码可见性红灯

沿用专题§7已确认的结果字段要求，`visual-geometry` 扩为320/390/768。保留稳定态和真实输入约束，逐项通过Home/ArrowDown实际滚动，读取六位码文本、计算display/visibility/opacity、真实矩形、popup边界及 `elementFromPoint`；要求编码与该卦数据一致、具有渲染面积、可见且未被覆盖，行无横向溢出，末项滚动后可选。

本次只运行此scope，不同时运行全量E2E。实际命令：

```powershell
$env:YIJING_SEARCH_SCOPE = 'visual-geometry'
& 'C:\Users\1\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' scripts/test-search-input.mjs
```

**exit 1，0/1，320首项即失败并终止**。[trace](2026-10-25-search-input/2026-10-24T19-53-53-121Z/trace.json)、[失败截图](2026-10-25-search-input/2026-10-24T19-53-53-121Z/320-visual-geometry-failure.png)。乾编码的实际文本为正确 `111111`，但 `display=none`、`visible=false`、矩形宽高均0、命中不可达，断言 `Result 1 code is hidden at 320px` 失败。390/768尚未执行，不能计通过。

Node24/Edge155，全部源hash首尾稳定；CSS仍为 `22c8adb51d8cb8e24db48338cd2a21e125fc71ab0c22525cdb745b7042110e70`，本轮探针 `87afaa208a95cd1d387e678b42d1b648504c39587734d8be939d40461f5956eb`。无页面异常或日志，profile已清理；已通知集成者移除隐藏样式后使用同一scope复跑，不修改应用代码。

## 03:54 手机六位码可见性修复后复验

集成者仅移除手机 `.search-option code { display:none }`，本专项未修改应用。用上一节完全相同命令、scope及探针再次运行，**实际进程已终止，exit 0，3/3**。[本轮trace](2026-10-25-search-input/2026-10-24T19-54-30-714Z/trace.json)保留320/390/768三档完整输入、逐项编码观察和稳定态截图；03:53红灯没有覆盖或删除。

| 视口 | 六位码实际检查 | 无横向溢出 | 末项滚动与确认 |
| --- | --- | --- | --- |
| 320×844 | 8/8均有面积、可见、文本与卦数据一致，中心命中code自身 | 文档320px；popup可用/滚动宽均294px；逐行可用/滚动宽相等 | Home后逐次ArrowDown，末项scrollTop=83；真实CDP触控确认小畜 `111011` |
| 390×844 | 同上，8/8 | 文档390px；popup可用/滚动宽均364px；逐行无溢出 | 末项scrollTop=55；真实CDP触控确认小畜 |
| 768×1024 | 同上，8/8 | 文档768px；popup可用/滚动宽均373px；逐行无溢出 | 末项scrollTop=55；真实CDP鼠标确认小畜 |

24次编码观察均检查 `display=block`、`visibility=visible`、`opacity=1`、非零矩形、完全在popup与视口内及 `elementFromPoint` 命中；没有把DOM中有文字等同于实际可见。初始屏外末项通过真实键盘导航滚入可视区后再检查、点选。确认后详情仍隐藏、`readingStage=none`、无hex深链、11个备份键原值未变、写入尝试0；每档最终聚焦均为小畜。该轮记录的124条输入事件全部 `isTrusted=true`。

[320稳定截图](2026-10-25-search-input/2026-10-24T19-54-30-714Z/320-search-open-help.png)、[390稳定截图](2026-10-25-search-input/2026-10-24T19-54-30-714Z/390-search-open-help.png)、[768稳定截图](2026-10-25-search-input/2026-10-24T19-54-30-714Z/768-search-open-help.png)均已人工查看。结果编码现可读，无横向裁切；帮助字号17px，popup不透明背景 `rgb(9,17,30)`、有效opacity=1、恒等transform、无运行中动画。每档另存实际末项确认后的 `*-search-last-selected.png`。

运行环境为Node `v24.19.0` / uv `1.52.1`、Edge `155.0.4283.62`。全部观察源码首尾稳定，页面异常0、浏览器日志0，隔离profile清理完成。CSS SHA256为 `84a9e8f17c5e23bbfc3607992d3d9c4e8b6834bd51c763aa9a1b03a670415b43`；探针仍是红灯轮的 `87afaa208a95cd1d387e678b42d1b648504c39587734d8be939d40461f5956eb`，没有放松断言或追加重试。其他源码hash见trace，与03:46/03:47矩阵一致。

本轮只复验该可见性scope，未重跑完整搜索矩阵、合成IME或全量E2E；它们前述日期与源码范围仍保留。未获得真机、真实IME、读屏、真实200%缩放证据；CDP触控和硬件键盘输入不替代这些验收。浏览器在进程终止后已交回集成者进行全量门禁，本专项不登记未运行的门禁结果。

本段收尾检查实际完成：备用Node语法检查、限定文件 `git diff --check` 均exit 0；报告20处本地链接全部存在。未提交，未发布。

## 03:57 真实共享关键词接线与最终完整矩阵

只在原 `cases` 增加 `休复吉 → 复`，未更改应用、关键词资源、加载状态或浏览器业务函数。补充只读对照使用仓库实际 `hexagrams.json` 与 `hexagram-keywords.json`：`searchHexagrams(hexagrams, '休复吉')` 返回0项，传入真实关键词后唯一返回复 `100000`；因此此正例可以区分核心正文匹配和可选关键词接线。关键词文件SHA256为 `7c146c9d708f5975c2e9b64aff84cf0eaaf95b40a48af6da01579db37ed3c68b`。该纯函数对照独立于浏览器验收，浏览器仍只用真实CDP输入。

运行前确认没有旧专项或完整E2E的活动Node runner。实际命令：

```powershell
$env:YIJING_SEARCH_SCOPE = ''
& 'C:\Users\1\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' scripts/test-search-input.mjs
```

**完整scope 2/2，实际进程exit 0**。[最终矩阵trace](2026-10-25-search-input/2026-10-24T19-57-45-287Z/trace.json)共47组检查（桌面24、手机23），每档12次正例确认，包括新增关键词和用于保留上下文检查的渐。1440×1024用真实键盘确认“休复吉”，390×844用真实CDP触控点选；两档结果均只有编号24、复、地雷复、`100000`。确认后聚焦复、详情保持隐藏、`readingStage=none`、URL无hex、11个备份键原值不变、写入尝试0；巡天开关保持原值。原编码、卦序、上下卦、全文、非法输入、ARIA、取消与两次Escape检查仍全部执行并通过。

[最终390稳定截图](2026-10-25-search-input/2026-10-24T19-57-45-287Z/390-search-keyboard-aria.png)、[最终1440稳定截图](2026-10-25-search-input/2026-10-24T19-57-45-287Z/1440-search-keyboard-aria.png)已人工查看。截图继续按实际opacity、动画结束、连续绘制帧和命中条件取得；六位码可见。帮助顶部裁切对应此前真实键盘滚动，初始完整帮助见03:54截图。本轮576条事件全部 `isTrusted=true`；中文仍为CDP提交文本，不是实际输入法候选过程。

Node `v24.19.0` / uv `1.52.1`、Edge `155.0.4283.62`。源码首尾稳定，页面异常0；有两条既有 `academy-astrolabe-bg.webp` 预加载未使用警告（每视口1条），不得写成零浏览器日志。隔离profile清理完成。CSS仍为 `84a9e8f17c5e23bbfc3607992d3d9c4e8b6834bd51c763aa9a1b03a670415b43`，main仍为 `dd9c86db49308fc379944841cd77aaf6a7e848119450055b28f0bb1412f8d2e2`，新增一条case后的冻结探针为 `d7474c480bc459a577bb170a110715eb2cb00bc648fe7b306510ce2cf5b27a21`。

本轮没有重复visual-geometry、合成IME或全量E2E，旧证据原样保留；加载失败/迟到、真机、真实IME、读屏与真实200%缩放等前述边界不变。浏览器已交回，脚本冻结，未提交或发布。

最终收尾：Node语法检查、限定文件 `git diff --check` 均exit 0；23处报告本地链接全部存在。
