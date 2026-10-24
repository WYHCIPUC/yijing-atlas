# 11 · 本地运行、复制迁移、分发与维护

更新日期：2026-10-24。本文说明已有工具和后续独立发布步骤，不授权本轮部署或发布。

| 状态轴 | 当前结论 |
| --- | --- |
| 实现状态 | Node本地服务、Python兼容脚本、Pages工作流、Windows SEA构建及发布脚本存在；宣传工程独立、Flutter归档 |
| 验证状态 | 本轮check/validate通过；当前E2E有失败，详见证据专题；当前Windows新包、真机、读屏、真实200%缩放未获得完整新证据 |
| 交付状态 | 当前工作区本地交接；旧EXE/旧线上页面/旧视频不代表这轮UI；远程发布单独处理 |

[返回开发建设总册](../DEVELOPMENT-MASTER.md) · [测试与证据](10-testing-evidence.md) · [执行任务表](12-ai-execution-tasks.md)

## 1. 分发对象分层

| 对象 | 目的 | 内容边界 |
| --- | --- | --- |
| 源码副本 | 其他AI继续开发 | 当前源码、文档、测试、必要资产；保留Git历史与未提交状态说明 |
| 静态网页 | 浏览器使用 | `web/`中允许公开的运行文件；无业务服务器 |
| Windows一键版 | 无Node环境的本地使用 | 构建时网页快照与Node运行时；仍在默认浏览器中显示 |
| 宣传视频/图文 | 展示产品 | `promo-video/`与相关素材输出；不是网页运行依赖 |
| 历史资料 | 设计/算法参考 | PDF、历史截图、归档Flutter等，不自动纳入公开包 |

不能把“复制了项目文件”理解为“复制了浏览器学习数据”。
不能把“存在EXE文件”理解为“当前未提交UI已经打包”。
不能把“CI工作流存在”理解为“本轮远程检查已经成功运行”。

## 2. 标准本地开发入口

需要Node.js22或更高版本；网页本地运行无需先安装依赖或构建。
在仓库根执行：

```powershell
node --version
npm start
```

浏览器访问 `http://127.0.0.1:3030/` 或 `http://localhost:3030/`。
两种主机名即使指向同一机器，浏览器存储也不是同一origin，应固定一种使用。
不能用file://直接打开index，JSON与ES Modules需要HTTP。
`protocol-guard.js`会跳本地HTTP地址，但不会启动服务器。
关闭启动终端会结束开发服务器；重新打开终端启动不应改变已有浏览器存储。

修改端口时使用任务专用环境变量作用域，避免误改系统环境：

```powershell
$env:PORT = '3031'
npm start
```

该终端后续命令会继承PORT；完成后在同终端 `Remove-Item Env:PORT` 恢复默认。
切3031是新origin，不会自动出现3030的学习记录，应先导出再导入。
HOST默认127.0.0.1；只有明确需要局域网访问时才调整，并记录网络范围与HTTPS限制。

### 2.1 辅助脚本差异

`web/serve.bat`优先Python/py，绑定0.0.0.0:3030；不是Node脚本的等价别名。
`web/serve.sh`优先Python/py，后备npx http-server，也绑定所有网卡。
npx后备可能需要包获取，不能承诺断网且无缓存时可用。
Python和npx的MIME、缓存、压缩、访问日志与方法处理以工具为准。
本册默认按Node入口验收，兼容脚本问题单独记录。

**建设目标**：启动说明准确、端口/主机名和存储关系清楚，不让其他AI排错时反复换来源。
**失败边界**：端口占用给真实错误，不以换origin后空记录误判数据被删。
**验收**：新副本启动、合法深链、JSON加载、无file协议、固定origin恢复数据。

## 3. 将项目复制给其他AI

### 3.1 复制前记录

先记录当前路径、分支、HEAD、未提交文件、未跟踪文件、Node版本和验证结果。
只读命令：

```powershell
git status --short
git branch --show-current
git rev-parse HEAD
node --version
```

不能只给一个commit哈希，因为当前重要UI改动和交接文档可能尚未提交。
不要reset、clean、强制checkout或整目录覆盖来“整理副本”。
将本册、设计基线、当前交接、证据和截图一同复制。
拷贝后先比对文件清单和关键文件，不因为原路径能运行就跳过新路径验证。

### 3.2 是否包含 `.git`

建议保留 `.git` 的完整开发副本，以保留diff、分支、历史和质量检查依赖。
隐藏目录不能因资源管理器默认不显示而漏掉。
个人浏览器profile、node_modules、dist大包不是继续网页开发的必要源码。
根PDF有版权边界，即使私下复制资料也不能据此公开分发。
源副本可说明“本地参考资料另存，不属公开运行包”。

当前 `scripts/quality-check.mjs` 使用 `git ls-files` 检查禁止发布扩展名。
因此无 `.git` 的普通文件副本可能能 `npm start`，但 `npm run check/validate` 会在Git步骤失败。
不能把这个失败写成业务功能坏了，也不能悄悄跳过检查后声称release gate通过。
未来兼容无Git副本需设计明确替代扫描/提示并补测试，是建议改进，当前没有实现。
**任务关联**：[T-COPY-01](12-ai-execution-tasks.md#t-copy-01)。

### 3.3 学习数据随副本迁移

在旧origin进入学习→数据与评阅设置→导出备份。
核对备份已下载、文件非空；保留原文件，不在副本搬运中手工改JSON。
新副本固定目标origin，进入同一数据区导入；导入会覆盖所包含的同类数据。
按UI提示刷新后核对笔记、进度、复习、错题和占筮历史。
导入上限1MiB、部分字段宽校验和回滚边界见 [数据专题](08-data-storage-content.md)。
未保存笔记草稿不在备份中；离开旧页面前由用户决定是否保存。
布局/抽屉/声音偏好不在统一白名单中，可手动重设，不能承诺整机状态迁移。
**任务关联**：[T-BACKUP-01](12-ai-execution-tasks.md#t-backup-01)、[T-BACKUP-02](12-ai-execution-tasks.md#t-backup-02)。

## 4. Git与质量门禁

根 [package.json](../../package.json) 定义标准命令，无需记忆旧日志数字。

| 命令 | 实际内容 | 不包含的保证 |
| --- | --- | --- |
| `npm run check` | JS语法/空白检查、JSON解析、注疏门禁、Git跟踪禁止扩展名 | 不等于完整ESLint、秘密扫描或类型检查 |
| `npm run test:unit` | 自包含测试脚本，默认不含黄历render-smoke | 不是真实浏览器交互 |
| `npm test` | quality-check带smoke | 不单独包含浏览器E2E和覆盖率门槛 |
| `npm run test:coverage` | 指定核心模块行/分支/函数≥90% | 不代表所有DOM/Canvas/WebGL模块覆盖率 |
| `npm run validate` | quality-check带smoke，再coverage | 不包含单独的test:e2e命令 |
| `npm run test:e2e` | 独立Chromium/CDP真实输入与界面回归 | 不代替移动真机、读屏和真实200% |
| `git diff --check` | diff空白/冲突标记等检查 | 不验证业务正确性 |

测试需在正确工作目录执行，quality runner会替黄历测试选择web目录。
代码风格沿现有两空格、分号、JS单引号和ES模块，不进行无关批量格式重写。
提交遵Conventional Commit，UI附截图，算法/数据变更另标来源和边界。
新任务保留别人未提交修改，按职责分文件，不能让多个AI同时改同一模块却互相覆盖。
本轮命令结果与E2E失败证据见 [10-testing-evidence.md](10-testing-evidence.md)。

## 5. GitHub CI与静态站点发布

### 5.1 Quality工作流

[quality.yml](../../.github/workflows/quality.yml) 在push、pull_request和workflow_call触发。
Ubuntu runner、Node22、10分钟超时；先 `npm run validate` 再 `npm run test:e2e`。
网页测试不要求先npm ci，因为运行资产已在仓库中。
Actions版本以固定commit SHA引用；依赖更新需要检查对应行为。
当前本地E2E失败未关闭前不能假定CI发布条件已满足。

### 5.2 Pages工作流

[pages.yml](../../.github/workflows/pages.yml) 只在main push或手动触发。
先复用quality工作流，通过后上传web目录并deploy-pages。
它不构建React应用，也不部署评阅API或数据库。
上传目录是web，因此应确保该目录只含允许公开的资产。
即使网页只用部分文件，上传目录内其他文件也不能当私密。
默认权限为contents读、pages写、id-token写；环境github-pages由工作流管理。
并发pages不取消正在进行的发布，不能假设最新push立即替代前一部署。

**建设目标**：先有本地可回顾结果，再独立批准发布；记录发布对应commit/内容版/cache代。
**失败边界**：工作流存在、线上可打开、旧状态绿勾都不是本轮发布成功证据。
**验收**：质量job通过、上传/部署完成、线上实际资源版本与验收版本一致。
**任务关联**：[T-RELEASE-01](12-ai-execution-tasks.md#t-release-01)。

## 6. Windows SEA构建与本地验收

### 6.1 构建机制

[build-windows.mjs](../../scripts/build-windows.mjs) 用当前Node生成SEA blob。
主程序是 [desktop-launcher.cjs](../../scripts/desktop-launcher.cjs)。
构建递归收集**整个web目录**的文件作为SEA assets，并非只收菜单引用资源。
复制当前Node可执行文件，再以postject注入blob，生成SHA-256清单。
临时目录为dist/.sea-build，结束清理；构建会替换同名目标EXE与SHA256SUMS。
不要在存在唯一旧包且未另存时直接覆盖，也不要复用未核对路径做递归删除。
构建脚本没有把当前未提交diff自动变成Git提交，包内容以执行时文件为准。

### 6.2 命令与产物

在Windows和仓库根执行；需要安装根构建依赖：

```powershell
npm ci
npm run build:windows
npm run test:windows
```

当前package版本为 `1.1.1-rc.2`，对应默认产物：

```text
dist/yijing-atlas-v1.1.1-rc.2-windows-x64.exe
dist/SHA256SUMS.txt
```

版本变更后以package.json为准，不手写旧产物路径继续发布。
`npm ci`与构建会写node_modules/dist，不属于纯只读检查。
本次文档编制没有据此执行打包，不声称已有当前UI的已测EXE。

### 6.3 启动器与烟测边界

EXE默认3030，最多额外尝试20个端口，可 `--port=31337` 指定、`--no-open`不弹浏览器。
启动器监听127.0.0.1，只GET/HEAD；窗口保持开启，结束进程停止服务。
每个端口是不同origin，端口回退后原用户数据不会自动复制。
用户看到“记录为空”时先核对地址与备份，不先清存储。

[test-windows-build.mjs](../../scripts/test-windows-build.mjs) 启动当前版本EXE的31337端口。
它检查首页title、hexagrams JSON、main模块、样式HEAD和不存在文件404，再结束子进程。
这是资产服务烟测，不是完整读卦/触控/可访问性验收。
新包还需在真实浏览器完成核心路径，并核对资源版本、离线和用户数据边界。
旧EXE通过、源码通过或旧线上截图都不能替代新包证据。

**建设目标**：生成当前源码快照，保存校验和与浏览器验收记录。
**失败边界**：无Windows环境、缺postject或Node版本不匹配明确报告，不能伪造产物。
**验收**：新路径运行、端口占用回退、GET/HEAD/404、深链、核心读卦、数据导出恢复。
**任务关联**：[T-WIN-01](12-ai-execution-tasks.md#t-win-01)。

### 6.4 Release工作流与Pages不同

[release.yml](../../.github/workflows/release.yml) 在tag `v*` push触发，Windows runner。
顺序为npm ci→validate→build:windows→test:windows→gh release create预发行。
发布附件为版本名EXE和SHA256SUMS，标题/文件取tag及版本，需保持匹配。
该工作流自身没有直接执行test:e2e；不要写成与Quality/Pages完全同一门禁。
任何tag发布前仍应满足总册要求的浏览器验收，必要时先完善工作流。
当前无代码签名成功、SmartScreen信誉或外部杀毒认可的新证据，不应承诺“无警告”。
**任务关联**：[T-RELEASE-01](12-ai-execution-tasks.md#t-release-01)。

## 7. 版本、缓存与回滚

至少区分四个版本轴：Git代码提交/工作区、package发布版本、SW缓存代、内容版本。
当前main/CSS/immersive入口查询代与SW为v51；注疏内容仍0.1.0-draft且关闭。
改package版本不会自动更新SW；改SW不会自动说明经文已校勘。
图像或数据变化也需要记录，避免“代码相同但内容不同”的包无法追踪。

发布前记录构建日期、commit、dirty说明、Node版本、package版本、缓存代、内容状态和SHA。
本地验收若仍dirty，记录目标文件清单或保存差异，不能只给HEAD冒充完整来源。
回滚代码不等于回滚浏览器localStorage；新写数据可能不被旧代码认识。
涉及存储schema变更时，先导出备份，给迁移兼容和不可逆边界。
旧SW可能继续控制打开的页面，回滚后要验证HTML/模块同代和离线入口。
不采用默认“注销所有SW、删所有源缓存、清所有记录”作为用户回滚指南。

**验收**：升级→保持原笔记/学习→回滚→旧功能可读；升级失败仍有可恢复备份。
**任务关联**：[T-CACHE-02](12-ai-execution-tasks.md#t-cache-02)、[T-BACKUP-02](12-ai-execution-tasks.md#t-backup-02)。

## 8. 宣传视频工程与归档项目

### 8.1 独立Remotion工程

[promo-video/package.json](../../promo-video/package.json) 是独立包，目前版本1.1.0。
包含React19.2.7、Remotion4.0.484、playwright-core1.62.0、sharp0.35.3、qrcode等。
其TypeScript6.0.3与React不是主网页新增依赖，不得为共用截图把网页迁入React。
src/index.ts注册视频，Root.tsx定义主片/预告Composition；另有preproduction-v2和douyin资料。
capture脚本从本地网页抓取真实状态，base URL可用 `YIJING_BASE_URL`，默认localhost3030。
当前capture包含固定时间/虚构学习记录夹具，素材演示不能被当成真实用户成绩。
capture脚本现有浏览器路径含Windows Edge默认安装位置，跨机需先核对。

根目录转发命令：

```powershell
npm run video:install
npm run video:capture
npm run video:studio
npm run video:render
npm run video:qa
```

安装与渲染写宣传工程依赖、截图和输出，不是网页发布必要步骤。
独立类型检查可用 `npm --prefix promo-video run typecheck`；不冒充主网页类型检查。
已有render:nobgm等脚本仅表示技术入口，不代表本轮要交付所有变体。
用户未另行要求时，宣传成片以一条含BGM与视觉依据音效的最终版为默认，不擅自加配音。
新UI后应重新采集和核对，旧视频/旧截图不能宣传为当前功能证据。

### 8.2 Flutter归档

`legacy-flutter/`只作历史归档；当前任务不修改，也不据此设计活跃移动端API。
若未来明确恢复Flutter，需单独确定目标、数据契约与迁移，不能直接把旧代码算已适配手机。
只有实际修改该归档时才要求对应 `flutter test` / `flutter analyze`；本轮未运行。

## 9. 资产许可账本

当前许可分散，建设任务应形成可维护账本，不能仅列一句“MIT开源”。

| 类别 | 已有依据 | 维护要求 |
| --- | --- | --- |
| 自有源代码 | [LICENSE](../../LICENSE)，MIT | 保留版权与许可，区分第三方内容 |
| D3 force3.0.0 | [THIRD_PARTY_NOTICES.md](../../THIRD_PARTY_NOTICES.md)，ISC | 保留上游版权与来源 |
| Three | [THREE-LICENSE.txt](../../web/lib/vendor/THREE-LICENSE.txt)，MIT | vendor版本、来源、文件同步 |
| Lenis | [LENIS-LICENSE.txt](../../web/lib/vendor/LENIS-LICENSE.txt)，MIT | 同步JS/CSS与许可 |
| GSAP3.15.0 | [GSAP-NOTICE.txt](../../web/lib/vendor/GSAP-NOTICE.txt)，GSAP Standard | 不标MIT；更新时核对条款 |
| Lucide | [LUCIDE-LICENSE.txt](../../web/lib/vendor/LUCIDE-LICENSE.txt)，ISC | 保留图标来源与本地路径集合 |
| 传统文本/注疏 | [CONTENT-SOURCES.md](../CONTENT-SOURCES.md) | 底本、转录、校勘、署名与现代整理授权 |
| 图像、声音、字体、视频素材 | 部分分散在设计/试音/宣传记录 | 逐项补来源、作者、许可、用途、修改、分发范围 |
| 根参考PDF | 未逐项确认公开再分发权 | 不进入公开包，不因忽略Git就承诺可公开 |

账本每项最少记录资产路径、来源URL/原始出处、作者、许可版本、获取日期、用途、修改和证明位置。
AI生成资产也记录生成/编辑来源和使用范围，不能伪造摄影作者或素材许可。
根THIRD_PARTY_NOTICES目前主要列D3，vendor声明另有其处，需增加统一索引。
package与vendor分别记录，避免npm升级后实际网页仍旧版。
Dependabot当前只更新GitHub Actions，不自动维护npm或本地vendor。
**任务关联**：[T-ASSET-01](12-ai-execution-tasks.md#t-asset-01)。

## 10. 持续维护与接手顺序

接手先读总册→本轮证据→任务表→目标专题→相关源文件/测试→当前diff。
先恢复本地运行和确定origin，再验证现有问题，不能用旧文档或旧EXE猜当前状态。
每任务提交输入、输出、兼容、副作用、失败提示、截图和真实测试结果。
同一任务有多个AI时，明确文件所有权，避免相互格式化或覆盖。
正文和算法任务单独标识，不混进大面积视觉差异造成难审查。
每阶段更新本册相关状态、交接与证据；“已实现/已验证/已发布”三轴分别更新。
E2E仍失败、内容门禁仍关闭、真机读屏缺证据时保持明确限制。
本轮目标是可继续开发的本地交接，远程发布按 `T-RELEASE-01` 独立处理。
