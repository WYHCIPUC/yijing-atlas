# Service Worker 接管失败：独立生命周期探针

- 记录日期：2026-10-24，上海时区。
- 只读调查基线：`ab0d58f`；未修改应用、Service Worker 或共享浏览器测试。
- 相关失败：[GitHub PR Quality 日志](2026-10-24-github-pr-failure.log)，运行 `40097893803`，原提交 `cda3696`。
- 可重复源码：[独立最小探针](2026-10-24-service-worker-probe.mjs)。无新增依赖，不运行完整 E2E。

## 1. 结论与边界

本机 Chromium 的**在线硬重载** `Page.reload({ ignoreCache: true })` 会生成一个未受现有 Service Worker 控制的新文档；此时注册仍为 `active: activated`，应用也已正常加载。在线普通重载 `ignoreCache: false` 则使用已有 Service Worker。

原测试在发现 `controller` 缺失后再次硬重载，仍可能得到未受控文档。已有 Worker 不需要重新激活，不能依赖安装期的 `clients.claim()` 再次发生。延长等待不会改变这一状态。安装完成时间与初始硬重载的先后关系，能够解释相同代码在两个运行中呈现不同结果。

原等待条件将 `#loading.hidden` 和 `controller` 合在一起，错误消息不能区分“应用未加载”和“未受控制”；旧失败日志没有这些分项信息。以下探针证明了与该失败相符的具体因果，**不能据此补造旧 CI 当时的浏览器版本或页面内部状态**。后续 CI 必须保留分项诊断并重新验证。

本次只证明当前 Chromium 的重载行为和本地静态站点的核心初始化。不是手机真机、屏幕阅读器、所有离线功能、Service Worker 更新迁移或全站验收证据。

## 2. 真实执行环境与命令

首次严格探针时间：`2026-10-24T13:28:09Z` 起，上海时间约 21:28。

| 项目 | 实际值 |
| --- | --- |
| 系统 | Windows，本项目当前工作区 |
| 浏览器来源 | 本机已安装的 `ms-playwright/chromium-1248/chrome-win64/chrome.exe`；未安装新软件 |
| 实际可执行文件 | `C:\Users\1\AppData\Local\ms-playwright\chromium-1248\chrome-win64\chrome.exe` |
| CDP `Browser.getVersion` | `Chrome/156.0.8078.4`，protocol `1.3` |
| Chromium revision | `@f842f52ef39fd97b449eb27cff414bf05a98ddce` |
| 初次探针地址 | `http://127.0.0.1:3042/`；独立调试端口 `9334` |
| 文档化探针地址 | 自动分配两个空闲本地端口，避免依赖固定端口 |
| 浏览器资料 | 每次新建独立临时 profile；不读取用户已有浏览器资料或学习数据 |

初次调查实际通过 PowerShell here-string 管道运行 Node ES Module：`@' … '@ | node --input-type=module`。文档化源码保留同样的静态服务、CDP、严格新文档等待和状态比较，补上断言及独立临时端口，可直接重复执行：

```powershell
Set-Location 'Y:\易经学习项目'
$env:BROWSER_PATH = 'C:\Users\1\AppData\Local\ms-playwright\chromium-1248\chrome-win64\chrome.exe'
node docs/development/evidence/2026-10-24-service-worker-probe.mjs
```

其他机器使用本机已安装的 Chromium 路径替换 `BROWSER_PATH`；不要复制此处的临时端口、profile 或浏览器安装路径。探针仅终止它创建的进程；递归清理前验证精确 profile 路径仍在指定临时目录内，清理失败单独报告。

## 3. 严格新文档证据

每次重载前取得 `performance.timeOrigin`。重载后必须同时满足：

1. `performance.timeOrigin` 与重载前不同；
2. `document.readyState === 'complete'`；
3. `document.querySelector('#loading')?.hidden === true`。

因此，下表不是重载请求刚发出时对旧页面的误读。先建立正常受控状态，再交替做硬重载和普通重载；最后禁用 HTTP 缓存并断网。

| 顺序 | 操作 | 新文档 `timeOrigin` | 应用加载完成 | `controller` | 注册活动状态 |
| --- | --- | ---: | --- | --- | --- |
| 0 | 初始页面，等待首次接管 | `1792848489468.1` | 是 | `/sw.js` | `activated` |
| 1 | 在线 `ignoreCache: true` | `1792848490033.2` | 是 | 缺失 | `activated` |
| 2 | 在线 `ignoreCache: false` | `1792848490151.5` | 是 | `/sw.js` | `activated` |
| 3 | 在线 `ignoreCache: true` 再次 | `1792848490269.3` | 是 | 缺失 | `activated` |
| 4 | 在线 `ignoreCache: false` 再次 | `1792848490396.9` | 是 | `/sw.js` | `activated` |
| 5 | HTTP cache 禁用＋断网＋普通重载 | `1792848490515.3` | 是 | `/sw.js` | `activated` |
| 6 | HTTP cache 禁用＋断网＋硬重载，观察项 | `1792848491681.3` | 是 | `/sw.js` | `activated` |

上述严格调查命令退出码 `0`。页面 `Runtime.exceptionThrown` 与 `Log.entryAdded` 事件没有记录错误；`#loading` 内容保持“星辰排列中…”且已隐藏。Worker 内部事件没有独立附加调试会话，因此不据此声称 Worker 内部不存在任何异步异常。

最后一项表明此浏览器在断网硬重载时会出现回退行为，**不能把在线硬重载的观察推广为所有网络状态或 Chromium 版本**。可靠离线验收采用第 5 项，明确禁用 HTTP 缓存而保留 Service Worker。

独立源码落盘后，已按第 2 节命令实际复跑一次，退出码 `0`，输出 `PASS: new-document guard, online hard/normal control difference, offline normal reload with HTTP cache disabled.`。本次随机服务端口为 `54974`，`timeOrigin` 顺序为 `1792848643082.3 → 1792848643457.5 → 1792848643591.4 → 1792848643716.1 → 1792848643846.4 → 1792848643977.3 → 1792848645139.6`；控制器顺序同上表，全部新文档初始化完成，`pageErrors: []`。该复跑约在 `2026-10-24T13:30:43Z` 开始。

## 4. 实际断言与建议修复

文档化探针包含以下断言：

- 静态服务器与 Chromium 成功启动，首次页面加载且受 Worker 控制。
- 每次必须完成的重载都产生新 `timeOrigin` 并完成应用初始化。
- 两次在线硬重载的 `controller` 为空，但注册仍 `activated`。
- 两次在线普通重载的 `controller` 指向本次本地服务的 `/sw.js`。
- `Network.setCacheDisabled({ cacheDisabled: true })`、`offline: true` 后，普通重载仍在新文档中恢复画布和受控状态。
- 断网硬重载仅记录观察；不要求其他版本也具有相同回退行为。

建议对共享浏览器测试作最小修正：

1. Service Worker 接管与离线恢复场景使用普通重载。
2. 通过 `Network.setCacheDisabled` 排除 HTTP 缓存，避免使用硬重载间接改变 Worker 控制条件。
3. 统一增加 `timeOrigin` 新文档守卫，防止旧页面已满足加载条件而提前通过。
4. 保留加载内容、控制器、注册状态、URL 和 Runtime 错误的失败诊断。
5. 不修改应用 SW 激活逻辑、不延长超时；实际重新运行本地和 GitHub PR 门禁后才能登记通过。

本记录不替代完整 `npm run test:e2e`。最新完整验证与 GitHub 状态见[本轮实施记录](2026-10-24-implementation-progress.md)及 [GitHub 推进记录](2026-10-24-github-tracking.md)。
