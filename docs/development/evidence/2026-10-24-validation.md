# 2026-10-24 文档建设验证记录

返回 [总册](../../DEVELOPMENT-MASTER.md) · [测试专题](../10-testing-evidence.md)。

## 1. 本次范围和源码身份

- 日期采用客户端 Asia/Shanghai 的 2026-10-24，不以宿主临时文件时间解释验收日期。
- 分支 codex/ui-baseline，HEAD 55bf77d805b068211dca9210c780df471faa4f23；当前 UI 改造未提交、未发布。
- 初始状态和 171 个基线文件 SHA-256：见 [source-snapshot](2026-10-24-source-snapshot.json)。web/README.md 为本次允许更新的文档，其他 170 个基线文件保持原样。
- 本次只新增/修订文档及入口。最终源码哈希、链接、任务和独立读者检查将在末尾记录。
- 不重新生成截图，不重跑数据生成器，不构建 Windows，不调用生产部署，不导出真实用户数据。

## 2. 本轮实际检查

| 证据 ID | 命令/动作 | 结果 | 范围与限制 |
| --- | --- | --- | --- |
| V-01 | 只读审查 npm run check | exit 0 | 70 JS/MJS、11 JSON、目录门禁和跟踪扩展名 |
| V-02 | 文档实施 npm run validate | exit 0 | checks + 57 测试脚本 + coverage，摘要如下 |
| B-01 | 只读审查默认 npm run test:e2e | exit 1 | 画布鼠标选星失败；与validate并行，未定因 |
| B-02 | 只读审查独立再次 npm run test:e2e | exit 1 | 快读六爻章节真实鼠标检查超时 |
| E-03 | 文档实施独立 npm run test:e2e | exit 1 | 再次复现快读六爻章节检查，输出如下 |
| D-01 | 只读审查 git diff --check | exit 0 | LF/CRLF提示不等于错误；文档完成后再检查 |

V-02 的阶段摘要摘自本轮实际输出；前半是57脚本各自结果，后半coverage阶段总计230个TAP子测试。不能把所有“# tests”相加后称不同业务场景数量，也不能把20模块覆盖率当整个站点。

~~~text
✓ JavaScript 语法与格式检查：70 个文件
✓ JSON 可解析：11 个文件
✓ 六家注疏目录有效，发布门禁保持关闭
✓ 当前版本树不含 PDF、证书或私钥文件
✓ 测试脚本通过：57 个
# all files                      |  99.61 |    90.20 |   97.78 |
coverage: tests 230, pass 230, fail 0
~~~

E-03 原始失败输出的路径已简化为仓库相对路径，未更改错误内容：

~~~text
> yijing-atlas@1.1.1-rc.2 test:e2e
> node scripts/browser-smoke.mjs

scripts/browser-smoke.mjs:46
  throw new Error(message);
        ^

Error: 快读六爻章节未响应真实鼠标
    at waitFor (scripts/browser-smoke.mjs:46:9)
    at async scripts/browser-smoke.mjs:794:3

Node.js v22.23.1
~~~

失败仍由 T-QA-01 处理。本次没有修改产品或测试、没有去掉断言、没有以旧通过记录覆盖。

## 3. 历史证据，不能提升为本轮通过

- 10月22日 yijing-ui-validate.log 有230通过及同覆盖率，yijing-ui-e2e.log 有带截图五视口通过和Crashpad临时目录EBUSY清理警告。这些是历史记录，日志原先仅在TEMP；本记录保留其结论和边界，不伪称本轮重新取得的通过。
- 10月7—8日 docs/qa/2026-10-07/ 为生产v50的Lighthouse/浏览器证据。
- 9月30日星图图像为历史基线，不是本轮“修改前重拍”。
- 以下25张PNG为10月22日沉浸星仪历史截图。本次仅清点，没有据此关闭真实交互失败或声称逐图重验。

## 4. 历史截图索引

路径相对本文件，名称中的百分比是星图缩放，不是浏览器缩放。

- [1280x720-deep.png](../../screenshots/2026-10-22-immersive/1280x720-deep.png)
- [1280x720-focus.png](../../screenshots/2026-10-22-immersive/1280x720-focus.png)
- [1280x720-overview.png](../../screenshots/2026-10-22-immersive/1280x720-overview.png)
- [1280x720-quick.png](../../screenshots/2026-10-22-immersive/1280x720-quick.png)
- [1440x1024-deep.png](../../screenshots/2026-10-22-immersive/1440x1024-deep.png)
- [1440x1024-jian-100.png](../../screenshots/2026-10-22-immersive/1440x1024-jian-100.png)
- [1440x1024-jian-195.png](../../screenshots/2026-10-22-immersive/1440x1024-jian-195.png)
- [1440x1024-jian-244.png](../../screenshots/2026-10-22-immersive/1440x1024-jian-244.png)
- [1440x1024-kun-100.png](../../screenshots/2026-10-22-immersive/1440x1024-kun-100.png)
- [1440x1024-kun-195.png](../../screenshots/2026-10-22-immersive/1440x1024-kun-195.png)
- [1440x1024-kun-244.png](../../screenshots/2026-10-22-immersive/1440x1024-kun-244.png)
- [1440x1024-qian-100.png](../../screenshots/2026-10-22-immersive/1440x1024-qian-100.png)
- [1440x1024-qian-195.png](../../screenshots/2026-10-22-immersive/1440x1024-qian-195.png)
- [1440x1024-qian-244.png](../../screenshots/2026-10-22-immersive/1440x1024-qian-244.png)
- [1440x1024-quick.png](../../screenshots/2026-10-22-immersive/1440x1024-quick.png)
- [320x844-learning.png](../../screenshots/2026-10-22-immersive/320x844-learning.png)
- [320x844-reduced-motion-deep.png](../../screenshots/2026-10-22-immersive/320x844-reduced-motion-deep.png)
- [320x844-reduced-motion-quick.png](../../screenshots/2026-10-22-immersive/320x844-reduced-motion-quick.png)
- [390x844-deep.png](../../screenshots/2026-10-22-immersive/390x844-deep.png)
- [390x844-focus.png](../../screenshots/2026-10-22-immersive/390x844-focus.png)
- [390x844-no-webgl-deep.png](../../screenshots/2026-10-22-immersive/390x844-no-webgl-deep.png)
- [390x844-overview.png](../../screenshots/2026-10-22-immersive/390x844-overview.png)
- [390x844-quick.png](../../screenshots/2026-10-22-immersive/390x844-quick.png)
- [768x1024-deep.png](../../screenshots/2026-10-22-immersive/768x1024-deep.png)
- [768x1024-quick.png](../../screenshots/2026-10-22-immersive/768x1024-quick.png)

参考视频关键帧：[星海](../../screenshots/2026-10-22-reference-study/star-sea-keyframes.jpg)、[天秩](../../screenshots/2026-10-22-reference-study/tianzhi-keyframes.jpg)。仅作设计资料，不作为项目当前界面/授权的证明。

## 5. 明确未验证

- Android/iOS真机，软键盘、安全区域和设备性能。
- NVDA/VoiceOver完整连续流程、Safari/Firefox当前版本完整矩阵。
- 真实浏览器200%缩放；640 CSS px与星图缩放不替代。
- 当前v51性能三次中位数、长时内存、合成背景对比度与强制颜色完整矩阵。
- 当前源码的Windows重新构建与启动测试。
- 六十四卦逐条底本双校、六家3840条内容与合法授权。
- 线上生产当前状态；本次未读取远程发布状态、未发布。

## 6. 文档完成检查

以下为文档合并和独立读者审阅后的实际结果；只证明文档交付，不关闭产品缺陷。

| ID | 实际检查 | 结果与范围 |
| --- | --- | --- |
| D-02 | node --check docs/development/tools/check-docs.mjs | exit0，文档检查工具语法有效 |
| D-03 | node docs/development/tools/check-docs.mjs --source-guard | exit0；14份Markdown（总册、12专题、证据），600个本地链接，48任务，86需求；未发现链接/锚点/编号/依赖环/空白问题 |
| D-04 | SHA-256对比本次源码快照 | 171基线中170字节一致；唯一差异web/README.md属于已授权文档入口；无新增web/scripts/test/.github运行路径 |
| D-05 | git diff --check | exit0；已有LF/CRLF提示保留，不把它当错误或格式化理由 |
| R-01 | 无上下文独立AI仅依文档接手，再针对修订复核 | 能正确说明启动/后端、验证、复制迁移、首任务、门禁、兼容与发布；第一轮7项实质问题已修，复核无阻断接手缺口 |
| R-02 | 另一独立AI对照必要代码核查契约与事实，再复核 | 自主路径条件、隐性依赖、零浏览抽查、欢迎目的地4项问题均已修；限定复核未发现新增实质冲突 |

独立审阅修正清单：

1. 总册与01权威顺序统一，当前与目标目的地分开。
2. 新弱项/resume/session和观象录V1有唯一字段/兼容契约，04/06不循环转交未决schema。
3. 八卦专项24、上下经各10、综合25题的蓝图、门槛、缺题行为已锁为建设默认；当前未实现。
4. T-GROW-01先依赖稳定session，仅关闭考评接入与映射；不要求先完成后置挑战。T-LEARN-05不要求先实现后置薄弱队列，T-GROW-02不要求先实现观象录。
5. 挑战guided/independent、structure-v1、历史缺路径和自主成就条件一致；旧印章不伪造新证据。
6. 原典草稿批次校验明确“先实现模式”，不以现有关闭门禁命令证明批次文字通过。
7. 失败采证使用独立临时目录示例，不覆盖历史截图；本次没有执行诊断改码。
8. 文档摘要统一引用本记录，保留三次E2E失败；没有被10月22日旧通过覆盖。

结论：文档包具备逐项接手条件；产品E2E、外部环境、当前Windows/性能和内容门禁仍未关闭。本次未修改应用/测试/数据/运行配置、未提交、未远程发布。后续功能开发从T-QA-01及依赖满足的任务开始。
