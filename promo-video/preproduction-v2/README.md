# 16:9 宣传片 V2

本目录是“易象图谱”约 170 秒横屏宣传片的独立制作区，不包含竖屏版本。主 Composition 为 `YijingAtlasPromoV2`，分辨率 1920×1080、30fps、共 5100 帧。

## 本地审片

在 `promo-video/` 下运行：

```bash
npm run dev:v2
npm run render:v2:review
npm run render:v2:quality-review
npm run render:v2:motion-review
npm run render:v2:full-review
```

`dev:v2` 打开 Remotion Studio；`render:v2:review` 仅输出 960×540 的全长节奏审片，不用于判断清晰度。`render:v2:quality-review` 使用 PNG 中间帧和 CRF 14 输出 1080p 画质样片；`render:v2:motion-review` 输出星图至单课闭环段落；`render:v2:full-review` 输出完整 170 秒横屏审片。视觉、旁白和混音全部确认后，再运行 `npm run render:v2` 以 PNG 中间帧和 CRF 12 生成 1080p 成片。

## 制作状态

- 已锁定“东方幽玄”音乐方向：深空氛围为主，少量长笛、竖琴与铜质机械拟音。
- 已完成 20 段横屏镜头的扩展实现，包括开场演化、阅读痛点、星图、卦象关系、演变实验室、典籍依据、五阶学程、单课闭环、检验与间隔复习、转盘、黄历、占筮、分享成图、能力总览与完整发布结尾。
- 六类章节转场分别使用星线接力、六爻帘幕、墨迹显影、书页合拢、机械光圈和时序扫描，避免重复炫技并强化内容关系。
- 真实功能页使用 `public/textures/raw/` 下的 2× 页面采集图。
- 待完成：男女声旁白试听、逐镜头节奏精修、字幕、最终混音与 1080p 终渲。

完整叙事与帧表见 [DESIGN-SPEC.md](./DESIGN-SPEC.md)。
