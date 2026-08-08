# 易象图谱宣传片设计规格

## 产品简报

成片面向传统文化学习者、易学爱好者和开源项目用户。核心卖点不是“提供六十四卦资料”，而是把星图探索、典籍依据、课程、考评与间隔复习连成可验证的学习闭环。视频只使用公开演示数据，不展示个人信息或密钥。

## 视觉与动效

- 方向：古典知识 × 当代产品发布片；深邃、典雅、可信、具有探索感。
- 色板：墨蓝 `#0a0e1a`、铜金 `#c9a96a`、宣纸 `#e8d9b8`。
- 字体：宋体/楷体体系；叙事字幕有效字高不低于 56px，辅助信息不低于 32px。
- 动效性格：平静关怀与精致高端之间；主体动作 3–5 秒、克制过冲、落定后保留呼吸。
- 禁用：手持抖动、群发 glint、游戏提示音、重复功能镜头和未经授权的数据。

## 镜头映射

- 开场：`trailer-bumper`、`dataviz-landscape-open`、`brand-ink-open`。
- 星图：真实页面 2.5D 推进，采用 `graze-face-tour` 的稳定贴面语法。
- 演变：真实实验室页面 + 自定义爻线变化，章节交棒采用 `cube-rotate` 的体块明暗逻辑。
- 转盘：真实页面背景 + `tape-scroll-fixed-pointer` 的加速刹停和 `split-flap-title` 的机械锁定感。
- 黄历：`spotlight-hero-card` 的单主角聚焦原则。
- 学习：`timeline-travel`；考评：`list-stack-press`。
- 收尾：`outro-group-photo-launch`，已展示功能各返回一个代表元素。

## 输出

- `YijingAtlasPromo`：3000 帧，1920×1080，30fps。
- `YijingAtlasTeaser`：900 帧，1080×1920，30fps；为竖屏重新排版，不裁切横片。
- 两个 Composition 均以 `PromoProps { bgm: boolean }` 控制 BGM，SFX 始终保留。
