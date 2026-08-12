import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Easing,
  Img,
  interpolate,
  Sequence,
  staticFile,
  useCurrentFrame,
} from 'remotion';
import {FullPromoV2} from './FullPromoV2';

export const DOUYIN_FPS = 30;
export const DOUYIN_DURATION = 2250;
export const DOUYIN_SHORT_DURATION = 900;

const C = {
  ink: '#0a0e1a',
  deep: '#05070d',
  blue: '#111a2b',
  gold: '#c9a96a',
  paleGold: '#dfc995',
  paper: '#e8d9b8',
  muted: '#948b78',
  cinnabar: '#9e4c42',
};

const fontSong = "'Songti SC', 'STSong', 'SimSun', serif";
const fontKai = "'Kaiti SC', 'STKaiti', 'KaiTi', serif";

const ease = (frame: number, input: [number, number], output: [number, number]) =>
  interpolate(frame, input, output, {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  });

const hash = (value: number) => {
  const x = Math.sin(value * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

const FilmBackground: React.FC<{frame: number; warm?: boolean}> = ({frame, warm = false}) => (
  <AbsoluteFill
    style={{
      background:
        `radial-gradient(circle at ${68 + Math.sin(frame / 150) * 2}% 34%, rgba(201,169,106,${warm ? 0.2 : 0.11}), transparent 28%),` +
        'radial-gradient(circle at 16% 84%, rgba(45,74,112,.24), transparent 38%),' +
        `linear-gradient(135deg, ${C.ink}, ${C.deep} 62%, #0d1422)`,
    }}
  >
    <div
      style={{
        position: 'absolute',
        inset: 0,
        opacity: 0.12,
        backgroundImage:
          'linear-gradient(rgba(232,217,184,.03) 1px, transparent 1px), linear-gradient(90deg, rgba(232,217,184,.022) 1px, transparent 1px)',
        backgroundSize: '96px 96px',
      }}
    />
    {Array.from({length: 64}, (_, index) => (
      <span
        key={index}
        style={{
          position: 'absolute',
          left: hash(index + 11) * 1920,
          top: hash(index + 101) * 1080,
          width: 1 + hash(index + 401) * 2,
          height: 1 + hash(index + 401) * 2,
          borderRadius: '50%',
          background: index % 8 === 0 ? C.gold : C.paper,
          opacity: 0.18 + 0.35 * Math.abs(Math.sin((frame + index * 13) / 55)),
        }}
      />
    ))}
    <div style={{position: 'absolute', inset: 0, boxShadow: 'inset 0 0 210px rgba(0,0,0,.74)'}} />
  </AbsoluteFill>
);

export const DOUYIN_SHOTS = {
  hook: {from: 0, duration: 120},
  pain: {from: 120, duration: 210, source: 568},
  workload: {from: 330, duration: 300},
  star: {from: 630, duration: 210, source: 1070},
  evolution: {from: 840, duration: 210, source: 1640},
  learning: {from: 1050, duration: 240, source: 2420},
  assessment: {from: 1290, duration: 210, source: 3080},
  review: {from: 1500, duration: 180, source: 3410},
  wheel: {from: 1680, duration: 90, source: 3710},
  almanac: {from: 1770, duration: 90, source: 3920},
  divination: {from: 1860, duration: 120, source: 4130},
  finale: {from: 1980, duration: 270},
} as const;

export const DOUYIN_SHORT_SHOTS = {
  hook: {from: 0, duration: 105},
  data: {from: 105, duration: 105},
  star: {from: 210, duration: 120, source: 1070},
  learning: {from: 330, duration: 180, source: 2420},
  assessment: {from: 510, duration: 120, source: 3080},
  review: {from: 630, duration: 90, source: 3410},
  finale: {from: 720, duration: 180},
} as const;

const DataHookScene: React.FC = () => {
  const frame = useCurrentFrame();
  const metrics = [
    {value: '64', unit: '卦'},
    {value: '384', unit: '爻'},
    {value: '552', unit: '题'},
    {value: '7967', unit: '行代码'},
  ];
  return (
    <AbsoluteFill>
      <FilmBackground frame={frame} warm />
      <div style={{position: 'absolute', left: 0, right: 0, top: 108, textAlign: 'center'}}>
        <div style={{fontFamily: fontKai, fontSize: 40, color: C.gold, letterSpacing: 10, opacity: ease(frame, [6, 24], [0, 1])}}>
          做一套《易经》学习系统，需要多少工作？
        </div>
      </div>
      <div style={{position: 'absolute', left: 115, right: 115, top: 300, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 18}}>
        {metrics.map((metric, index) => {
          const p = ease(frame, [20 + index * 10, 51 + index * 10], [0, 1]);
          return (
            <div
              key={metric.value}
              style={{
                height: 390,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                border: '1px solid rgba(201,169,106,.34)',
                borderRadius: 16,
                background: 'linear-gradient(160deg,rgba(25,34,53,.82),rgba(7,10,17,.86))',
                boxShadow: '0 34px 100px rgba(0,0,0,.48), inset 0 0 70px rgba(201,169,106,.04)',
                opacity: p,
                transform: `translateY(${(1 - p) * 42}px) scale(${0.95 + p * 0.05})`,
              }}
            >
              <div style={{fontFamily: 'Georgia, serif', fontSize: metric.value.length > 3 ? 100 : 124, lineHeight: 1, color: C.paper, letterSpacing: 2}}>{metric.value}</div>
              <div style={{marginTop: 28, width: 56, height: 2, background: C.cinnabar}} />
              <div style={{marginTop: 24, fontFamily: fontSong, fontSize: 34, color: C.gold, letterSpacing: 7}}>{metric.unit}</div>
            </div>
          );
        })}
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 104, textAlign: 'center', fontFamily: fontSong, fontSize: 64, letterSpacing: 12, color: C.paper, opacity: ease(frame, [64, 79], [0, 1])}}>
        易象图谱
      </div>
    </AbsoluteFill>
  );
};

const WorkloadScene: React.FC = () => {
  const frame = useCurrentFrame();
  const metrics = [
    {value: '43', label: '个功能模块', note: '原生 JavaScript 架构'},
    {value: '60', label: '次代码提交', note: '持续迭代与打磨'},
    {value: '34', label: '组测试通过', note: '默认发布质量门全部通过'},
    {value: '5阶21课', label: '完整学习路径', note: '由入门走向理解与应用'},
  ];
  return (
    <AbsoluteFill>
      <FilmBackground frame={frame + 700} />
      <div style={{position: 'absolute', left: 120, top: 112, right: 120, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end'}}>
        <div>
          <div style={{fontFamily: fontKai, fontSize: 32, color: C.gold, letterSpacing: 8}}>工程量 · 可验证</div>
          <div style={{marginTop: 22, fontFamily: fontSong, fontSize: 70, lineHeight: 1.2, color: C.paper, letterSpacing: 7}}>不只是把六十四卦<br />放进一个网页</div>
        </div>
        <div style={{width: 620, fontFamily: fontKai, fontSize: 34, lineHeight: 1.65, color: '#c8bea8', letterSpacing: 2}}>
          从知识结构、交互体验到学习评估，<br />每一层都需要重新设计和反复验证。
        </div>
      </div>
      <div style={{position: 'absolute', left: 120, right: 120, top: 430, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20}}>
        {metrics.map((metric, index) => {
          const p = ease(frame, [38 + index * 25, 84 + index * 25], [0, 1]);
          return (
            <div key={metric.label} style={{height: 420, padding: '46px 38px', borderTop: `3px solid ${index === 3 ? C.cinnabar : C.gold}`, background: 'rgba(17,26,43,.82)', boxShadow: '0 28px 85px rgba(0,0,0,.34)', opacity: p, transform: `translateY(${(1 - p) * 36}px)`}}>
              <div style={{fontFamily: fontSong, fontSize: metric.value.length > 4 ? 61 : 86, lineHeight: 1, color: C.paper, letterSpacing: 2}}>{metric.value}</div>
              <div style={{marginTop: 30, fontFamily: fontSong, fontSize: 34, color: C.gold, letterSpacing: 4}}>{metric.label}</div>
              <div style={{marginTop: 24, fontFamily: fontKai, fontSize: 32, lineHeight: 1.55, color: C.muted, letterSpacing: 1}}>{metric.note}</div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

const ShortHookScene: React.FC = () => {
  const frame = useCurrentFrame();
  const p = ease(frame, [10, 46], [0, 1]);
  return (
    <AbsoluteFill>
      <FilmBackground frame={frame} warm />
      <div style={{position: 'absolute', left: 170, right: 170, top: 155, textAlign: 'center', opacity: p, transform: `translateY(${(1 - p) * 36}px)`}}>
        <div style={{fontFamily: fontKai, fontSize: 35, color: C.gold, letterSpacing: 11}}>很多人都知道《易经》值得学</div>
        <div style={{marginTop: 58, fontFamily: fontSong, fontSize: 105, lineHeight: 1.24, color: C.paper, letterSpacing: 6}}>
          却不知道<span style={{color: C.gold}}>从哪入门</span><br />怎么记住 · 如何用好
        </div>
        <div style={{margin: '64px auto 0', width: 94, height: 3, background: C.cinnabar}} />
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 108, textAlign: 'center', color: C.muted, fontFamily: fontKai, fontSize: 34, letterSpacing: 6, opacity: ease(frame, [55, 78], [0, 1])}}>
        只靠看书，很容易停在“看过”
      </div>
    </AbsoluteFill>
  );
};

const ShortDataScene: React.FC = () => {
  const frame = useCurrentFrame();
  const metrics = [
    {value: '64', label: '卦'},
    {value: '552', label: '题'},
    {value: '5阶21课', label: '学习路径'},
    {value: '7967', label: '行代码'},
  ];
  return (
    <AbsoluteFill>
      <FilmBackground frame={frame + 420} />
      <div style={{position: 'absolute', left: 110, right: 110, top: 130}}>
        <div style={{fontFamily: fontKai, fontSize: 32, color: C.gold, letterSpacing: 8}}>于是，我重新设计了一套学习过程</div>
        <div style={{marginTop: 27, fontFamily: fontSong, fontSize: 70, color: C.paper, letterSpacing: 5}}>不是电子书，是一套学习系统</div>
      </div>
      <div style={{position: 'absolute', left: 110, right: 110, top: 410, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 18}}>
        {metrics.map((metric, index) => {
          const p = ease(frame, [16 + index * 8, 48 + index * 8], [0, 1]);
          return (
            <div key={metric.value} style={{height: 340, display: 'grid', placeItems: 'center', alignContent: 'center', borderTop: `3px solid ${index === 3 ? C.cinnabar : C.gold}`, background: 'rgba(17,26,43,.84)', opacity: p, transform: `translateY(${(1 - p) * 28}px)`}}>
              <div style={{fontFamily: 'Georgia, serif', fontSize: metric.value.length > 4 ? 60 : 88, color: C.paper}}>{metric.value}</div>
              <div style={{marginTop: 22, fontFamily: fontSong, fontSize: 30, color: C.gold, letterSpacing: 4}}>{metric.label}</div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

const DesktopFinaleScene: React.FC = () => {
  const frame = useCurrentFrame();
  const p = ease(frame, [4, 36], [0, 1]);
  return (
    <AbsoluteFill>
      <FilmBackground frame={frame + 2600} warm />
      <Img src={staticFile('textures/raw/star.png')} style={{position: 'absolute', inset: 62, width: 1796, height: 956, objectFit: 'cover', filter: 'brightness(.34) saturate(.72)', borderRadius: 22, opacity: p}} />
      <div style={{position: 'absolute', inset: 62, borderRadius: 22, background: 'linear-gradient(90deg,rgba(5,8,14,.96),rgba(5,8,14,.68) 60%,rgba(5,8,14,.18))', border: '1px solid rgba(201,169,106,.3)'}} />
      <div style={{position: 'absolute', left: 145, top: 162, width: 1250, opacity: p, transform: `translateY(${(1 - p) * 30}px)`}}>
        <div style={{fontFamily: fontKai, fontSize: 33, color: C.gold, letterSpacing: 10}}>易象图谱 · YIJING ATLAS</div>
        <div style={{marginTop: 47, fontFamily: fontSong, fontSize: 92, lineHeight: 1.22, color: C.paper, letterSpacing: 5}}>
          Windows 本地<br /><span style={{color: C.gold}}>单文件版</span>
        </div>
        <div style={{marginTop: 35, fontFamily: fontKai, fontSize: 40, color: '#c9c0ae', letterSpacing: 3}}>双击启动 · 在默认浏览器打开</div>
        <div style={{marginTop: 48, display: 'inline-block', padding: '20px 34px', borderRadius: 8, background: C.gold, color: C.ink, fontFamily: fontSong, fontSize: 35, fontWeight: 700, letterSpacing: 4}}>前往 GitHub Release 下载</div>
      </div>
      <div style={{position: 'absolute', left: 146, bottom: 104, fontFamily: fontKai, fontSize: 32, color: C.muted, letterSpacing: 4, opacity: ease(frame, [45, 68], [0, 1])}}>在线演示可先体验 · 占筮仅作文化学习与自我反思</div>
    </AbsoluteFill>
  );
};

const SourceSlice: React.FC<{source: number}> = ({source}) => (
  <Sequence from={-source}>
    <FullPromoV2 bgm={false} />
  </Sequence>
);

const CutAccent: React.FC = () => {
  const frame = useCurrentFrame();
  const sweep = ease(frame, [0, 8], [-36, 136]);
  const opacity = interpolate(frame, [0, 4, 13], [0, 0.72, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return (
    <AbsoluteFill style={{pointerEvents: 'none', opacity}}>
      <div style={{position: 'absolute', inset: 0, background: 'rgba(4,7,13,.45)'}} />
      <div style={{position: 'absolute', top: 0, bottom: 0, left: `${sweep}%`, width: 6, background: C.gold, boxShadow: '0 0 48px rgba(201,169,106,.9)'}} />
    </AbsoluteFill>
  );
};

const FinaleScene: React.FC = () => {
  const frame = useCurrentFrame();
  const p = ease(frame, [8, 52], [0, 1]);
  const chips = ['Windows 本地版', '在线体验', 'GitHub 项目'];
  return (
    <AbsoluteFill>
      <FilmBackground frame={frame + 2100} warm />
      <Img
        src={staticFile('textures/raw/star.png')}
        style={{position: 'absolute', inset: 70, width: 1780, height: 940, objectFit: 'cover', filter: 'brightness(.42) saturate(.78)', borderRadius: 20, opacity: p}}
      />
      <div style={{position: 'absolute', inset: 70, borderRadius: 20, background: 'radial-gradient(circle at 50% 45%, rgba(5,8,14,.22), rgba(5,8,14,.94) 78%)', border: '1px solid rgba(201,169,106,.28)', boxShadow: '0 40px 130px rgba(0,0,0,.55)'}} />
      <div style={{position: 'absolute', left: 0, right: 0, top: 230, textAlign: 'center', opacity: p, transform: `translateY(${(1 - p) * 30}px)`}}>
        <div style={{fontFamily: fontSong, fontSize: 122, letterSpacing: 28, color: C.paper, textShadow: '0 16px 70px rgba(0,0,0,.9)'}}>易象图谱</div>
        <div style={{marginTop: 34, fontFamily: fontKai, fontSize: 45, color: C.gold, letterSpacing: 10}}>让《易经》看得见 · 学得会 · 记得住</div>
        <div style={{marginTop: 42, fontFamily: fontSong, fontSize: 61, color: C.paper, letterSpacing: 9, opacity: ease(frame, [55, 92], [0, 1])}}>下载 Windows 本地桌面版</div>
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 128, display: 'flex', justifyContent: 'center', gap: 22, opacity: ease(frame, [76, 112], [0, 1])}}>
        {chips.map((chip, index) => (
          <div key={chip} style={{minWidth: 265, padding: '18px 32px', textAlign: 'center', borderRadius: 8, border: `1px solid ${index === 0 ? C.gold : 'rgba(232,217,184,.3)'}`, background: index === 0 ? 'rgba(201,169,106,.15)' : 'rgba(7,10,17,.78)', color: C.paper, fontFamily: fontSong, fontSize: 34, letterSpacing: 4}}>{chip}</div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

type SfxCue = {from: number; src: string; volume: number; durationInFrames?: number};

const SFX: SfxCue[] = [
  // 数据卡逐层显影。
  {from: DOUYIN_SHOTS.hook.from + 8, src: 'audio/preproduction-v2/water-drop-cave.mp3', volume: 0.2},
  {from: DOUYIN_SHOTS.hook.from + 82, src: 'audio/sfx/text/marker-pen-line.mp3', volume: 0.13, durationInFrames: 35},
  // 痛点、工程量和核心功能的章节交接。
  {from: DOUYIN_SHOTS.pain.from, src: 'audio/sfx/transition/transition-soft.mp3', volume: 0.13},
  {from: DOUYIN_SHOTS.workload.from, src: 'audio/sfx/transition/sweep-fast.mp3', volume: 0.15},
  {from: DOUYIN_SHOTS.star.from, src: 'audio/sfx/transition/transition-soft.mp3', volume: 0.14},
  {from: DOUYIN_SHOTS.evolution.from, src: 'audio/sfx/text/marker-pen-line.mp3', volume: 0.38, durationInFrames: 50},
  {from: DOUYIN_SHOTS.learning.from, src: 'audio/sfx/paper/paper-slide.mp3', volume: 0.42},
  {from: DOUYIN_SHOTS.assessment.from, src: 'audio/sfx/transition/transition-soft.mp3', volume: 0.12},
  {from: DOUYIN_SHOTS.review.from, src: 'audio/preproduction-v2/water-drop-cave.mp3', volume: 0.5},
  // 转盘起动与锁定使用真实机械质感。
  {from: DOUYIN_SHOTS.wheel.from, src: 'audio/preproduction-v2/machine-activate-short.mp3', volume: 0.12},
  {from: DOUYIN_SHOTS.wheel.from + 18, src: 'audio/sfx/mech/mech-tech-movement.mp3', volume: 0.15, durationInFrames: 54},
  {from: DOUYIN_SHOTS.wheel.from + 68, src: 'audio/sfx/mech/gear-lock-metallic.mp3', volume: 0.22},
  {from: DOUYIN_SHOTS.almanac.from, src: 'audio/preproduction-v2/chime-crystal.mp3', volume: 0.08},
  {from: DOUYIN_SHOTS.divination.from, src: 'audio/sfx/paper/paper-page-turn-big.mp3', volume: 0.45},
  // 收尾采用铺垫、落定、余韵三拍。
  {from: DOUYIN_SHOTS.finale.from, src: 'audio/preproduction-v2/wind-pass-vibrate.mp3', volume: 0.12, durationInFrames: 70},
  {from: DOUYIN_SHOTS.finale.from + 35, src: 'audio/sfx/impact/impact-deep-whoosh.mp3', volume: 0.24},
  {from: DOUYIN_SHOTS.finale.from + 60, src: 'audio/sfx/light/shimmer-sparkle-sweep.mp3', volume: 0.13},
];

const TrailerSoundtrack: React.FC<{bgm: boolean}> = ({bgm}) => (
  <>
    {bgm && (
      <Audio
        src={staticFile('audio/preproduction-v2/direction-b-tapis.mp3')}
        volume={(frame) => {
          const envelope = interpolate(frame, [0, 35, 2160, 2249], [0, 0.21, 0.21, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
          const duckPoints = [DOUYIN_SHOTS.evolution.from, DOUYIN_SHOTS.learning.from, DOUYIN_SHOTS.review.from, DOUYIN_SHOTS.divination.from];
          const duck = duckPoints.reduce(
            (level, point) => level * interpolate(frame, [point - 6, point, point + 28, point + 48], [1, 0.42, 0.42, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
            1,
          );
          return envelope * duck;
        }}
      />
    )}
    {bgm && (
      <Sequence from={DOUYIN_SHOTS.workload.from} durationInFrames={DOUYIN_SHOTS.divination.from + DOUYIN_SHOTS.divination.duration - DOUYIN_SHOTS.workload.from}>
        <Audio
          src={staticFile('audio/preproduction-v2/mystic-flute-harp-relaxation-05.mp3')}
          volume={(frame) => interpolate(frame, [0, 90, 1300, 1650], [0, 0.055, 0.055, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}
        />
      </Sequence>
    )}
    {SFX.map((cue, index) => (
      <Sequence key={`${cue.from}-${index}`} from={cue.from} durationInFrames={cue.durationInFrames ?? 150}>
        <Audio src={staticFile(cue.src)} volume={cue.volume} />
      </Sequence>
    ))}
  </>
);

export type DouyinTrailerProps = {bgm: boolean};

export const DouyinTrailer: React.FC<DouyinTrailerProps> = ({bgm}) => (
  <AbsoluteFill style={{background: C.ink}}>
    <Sequence from={DOUYIN_SHOTS.hook.from} durationInFrames={DOUYIN_SHOTS.hook.duration}><DataHookScene /></Sequence>
    <Sequence from={DOUYIN_SHOTS.pain.from} durationInFrames={DOUYIN_SHOTS.pain.duration}><SourceSlice source={DOUYIN_SHOTS.pain.source} /></Sequence>
    <Sequence from={DOUYIN_SHOTS.workload.from} durationInFrames={DOUYIN_SHOTS.workload.duration}><WorkloadScene /></Sequence>
    <Sequence from={DOUYIN_SHOTS.star.from} durationInFrames={DOUYIN_SHOTS.star.duration}><SourceSlice source={DOUYIN_SHOTS.star.source} /></Sequence>
    <Sequence from={DOUYIN_SHOTS.evolution.from} durationInFrames={DOUYIN_SHOTS.evolution.duration}><SourceSlice source={DOUYIN_SHOTS.evolution.source} /></Sequence>
    <Sequence from={DOUYIN_SHOTS.learning.from} durationInFrames={DOUYIN_SHOTS.learning.duration}><SourceSlice source={DOUYIN_SHOTS.learning.source} /></Sequence>
    <Sequence from={DOUYIN_SHOTS.assessment.from} durationInFrames={DOUYIN_SHOTS.assessment.duration}><SourceSlice source={DOUYIN_SHOTS.assessment.source} /></Sequence>
    <Sequence from={DOUYIN_SHOTS.review.from} durationInFrames={DOUYIN_SHOTS.review.duration}><SourceSlice source={DOUYIN_SHOTS.review.source} /></Sequence>
    <Sequence from={DOUYIN_SHOTS.wheel.from} durationInFrames={DOUYIN_SHOTS.wheel.duration}><SourceSlice source={DOUYIN_SHOTS.wheel.source} /></Sequence>
    <Sequence from={DOUYIN_SHOTS.almanac.from} durationInFrames={DOUYIN_SHOTS.almanac.duration}><SourceSlice source={DOUYIN_SHOTS.almanac.source} /></Sequence>
    <Sequence from={DOUYIN_SHOTS.divination.from} durationInFrames={DOUYIN_SHOTS.divination.duration}><SourceSlice source={DOUYIN_SHOTS.divination.source} /></Sequence>
    <Sequence from={DOUYIN_SHOTS.finale.from} durationInFrames={DOUYIN_SHOTS.finale.duration}><FinaleScene /></Sequence>
    {Object.values(DOUYIN_SHOTS).slice(1).map((shot) => (
      <Sequence key={shot.from} from={shot.from} durationInFrames={14}><CutAccent /></Sequence>
    ))}
    <TrailerSoundtrack bgm={bgm} />
  </AbsoluteFill>
);

const SHORT_SFX: SfxCue[] = [
  {from: DOUYIN_SHORT_SHOTS.hook.from + 12, src: 'audio/preproduction-v2/water-drop-cave.mp3', volume: 0.22},
  {from: DOUYIN_SHORT_SHOTS.data.from, src: 'audio/sfx/transition/sweep-fast.mp3', volume: 0.16},
  {from: DOUYIN_SHORT_SHOTS.star.from, src: 'audio/sfx/transition/transition-soft.mp3', volume: 0.15},
  {from: DOUYIN_SHORT_SHOTS.learning.from, src: 'audio/sfx/paper/paper-slide.mp3', volume: 0.42},
  {from: DOUYIN_SHORT_SHOTS.assessment.from, src: 'audio/sfx/text/marker-pen-line.mp3', volume: 0.34, durationInFrames: 44},
  {from: DOUYIN_SHORT_SHOTS.review.from, src: 'audio/preproduction-v2/water-drop-cave.mp3', volume: 0.46},
  {from: DOUYIN_SHORT_SHOTS.finale.from, src: 'audio/preproduction-v2/wind-pass-vibrate.mp3', volume: 0.13, durationInFrames: 70},
  {from: DOUYIN_SHORT_SHOTS.finale.from + 32, src: 'audio/sfx/impact/impact-deep-whoosh.mp3', volume: 0.24},
  {from: DOUYIN_SHORT_SHOTS.finale.from + 56, src: 'audio/sfx/light/shimmer-sparkle-sweep.mp3', volume: 0.12},
];

const ShortSoundtrack: React.FC<{bgm: boolean}> = ({bgm}) => (
  <>
    {bgm && (
      <Audio
        src={staticFile('audio/preproduction-v2/direction-b-tapis.mp3')}
        volume={(frame) => interpolate(frame, [0, 28, 810, 899], [0, 0.2, 0.2, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}
      />
    )}
    {bgm && (
      <Sequence from={DOUYIN_SHORT_SHOTS.data.from} durationInFrames={DOUYIN_SHORT_SHOTS.finale.from - DOUYIN_SHORT_SHOTS.data.from}>
        <Audio src={staticFile('audio/preproduction-v2/mystic-flute-harp-relaxation-05.mp3')} volume={0.05} />
      </Sequence>
    )}
    {SHORT_SFX.map((cue, index) => (
      <Sequence key={`${cue.from}-${index}`} from={cue.from} durationInFrames={cue.durationInFrames ?? 120}>
        <Audio src={staticFile(cue.src)} volume={cue.volume} />
      </Sequence>
    ))}
  </>
);

export const DouyinShort: React.FC<DouyinTrailerProps> = ({bgm}) => (
  <AbsoluteFill style={{background: C.ink}}>
    <Sequence from={DOUYIN_SHORT_SHOTS.hook.from} durationInFrames={DOUYIN_SHORT_SHOTS.hook.duration}><ShortHookScene /></Sequence>
    <Sequence from={DOUYIN_SHORT_SHOTS.data.from} durationInFrames={DOUYIN_SHORT_SHOTS.data.duration}><ShortDataScene /></Sequence>
    <Sequence from={DOUYIN_SHORT_SHOTS.star.from} durationInFrames={DOUYIN_SHORT_SHOTS.star.duration}><SourceSlice source={DOUYIN_SHORT_SHOTS.star.source} /></Sequence>
    <Sequence from={DOUYIN_SHORT_SHOTS.learning.from} durationInFrames={DOUYIN_SHORT_SHOTS.learning.duration}><SourceSlice source={DOUYIN_SHORT_SHOTS.learning.source} /></Sequence>
    <Sequence from={DOUYIN_SHORT_SHOTS.assessment.from} durationInFrames={DOUYIN_SHORT_SHOTS.assessment.duration}><SourceSlice source={DOUYIN_SHORT_SHOTS.assessment.source} /></Sequence>
    <Sequence from={DOUYIN_SHORT_SHOTS.review.from} durationInFrames={DOUYIN_SHORT_SHOTS.review.duration}><SourceSlice source={DOUYIN_SHORT_SHOTS.review.source} /></Sequence>
    <Sequence from={DOUYIN_SHORT_SHOTS.finale.from} durationInFrames={DOUYIN_SHORT_SHOTS.finale.duration}><DesktopFinaleScene /></Sequence>
    {Object.values(DOUYIN_SHORT_SHOTS).slice(1).map((shot) => <Sequence key={shot.from} from={shot.from} durationInFrames={14}><CutAccent /></Sequence>)}
    <ShortSoundtrack bgm={bgm} />
  </AbsoluteFill>
);

export const DouyinCover: React.FC = () => (
  <AbsoluteFill style={{background: C.ink}}>
    <FilmBackground frame={68} warm />
    <Img src={staticFile('textures/raw/star.png')} style={{position: 'absolute', inset: 54, width: 1812, height: 972, objectFit: 'cover', filter: 'brightness(.36) saturate(.8)', borderRadius: 22}} />
    <div style={{position: 'absolute', inset: 54, borderRadius: 22, background: 'linear-gradient(90deg,rgba(5,8,14,.95) 8%,rgba(5,8,14,.76) 58%,rgba(5,8,14,.18))', border: '1px solid rgba(201,169,106,.28)', boxShadow: '0 35px 120px rgba(0,0,0,.6)'}} />
    <div style={{position: 'absolute', left: 145, top: 152, width: 1600}}>
      <div style={{fontFamily: fontKai, fontSize: 34, color: C.gold, letterSpacing: 9}}>我把复杂的《易经》学习，做成了一套本地学习系统</div>
      <div style={{marginTop: 56, fontFamily: fontSong, fontSize: 96, lineHeight: 1.28, letterSpacing: 4, color: C.paper, textShadow: '0 15px 65px rgba(0,0,0,.9)'}}>
        <span style={{color: C.gold}}>7967行代码</span><br />做一套《易经》学习系统
      </div>
      <div style={{marginTop: 58, display: 'flex', gap: 18}}>
        {['64卦', '384爻', '552题', '5阶21课'].map((item, index) => <span key={item} style={{padding: '16px 27px', borderRadius: 7, border: `1px solid ${index === 2 ? C.cinnabar : 'rgba(201,169,106,.45)'}`, background: 'rgba(9,13,22,.86)', color: C.paper, fontFamily: fontSong, fontSize: 34, letterSpacing: 4}}>{item}</span>)}
      </div>
    </div>
    <div style={{position: 'absolute', left: 148, bottom: 92, fontFamily: fontSong, fontSize: 34, color: C.gold, letterSpacing: 8}}>易象图谱 · Windows 本地单文件版</div>
  </AbsoluteFill>
);

export const DouyinShortCover: React.FC = () => (
  <AbsoluteFill style={{background: C.ink}}>
    <FilmBackground frame={42} warm />
    <Img src={staticFile('textures/raw/star.png')} style={{position: 'absolute', inset: 54, width: 1812, height: 972, objectFit: 'cover', filter: 'brightness(.3) saturate(.75)', borderRadius: 22}} />
    <div style={{position: 'absolute', inset: 54, borderRadius: 22, background: 'linear-gradient(90deg,rgba(5,8,14,.96),rgba(5,8,14,.72) 66%,rgba(5,8,14,.18))', border: '1px solid rgba(201,169,106,.28)'}} />
    <div style={{position: 'absolute', left: 145, top: 135, width: 1450}}>
      <div style={{fontFamily: fontKai, fontSize: 34, color: C.gold, letterSpacing: 9}}>易象图谱 · Windows 本地桌面版</div>
      <div style={{marginTop: 54, fontFamily: fontSong, fontSize: 105, lineHeight: 1.22, color: C.paper, letterSpacing: 4}}>
        想学《易经》<br /><span style={{color: C.gold}}>却不知道从哪开始？</span>
      </div>
      <div style={{marginTop: 48, display: 'flex', gap: 18}}>
        {['五阶21课', '每课检验', '间隔复习', '本地运行'].map((item, index) => <span key={item} style={{padding: '17px 27px', borderRadius: 7, border: `1px solid ${index === 3 ? C.cinnabar : 'rgba(201,169,106,.45)'}`, background: 'rgba(9,13,22,.86)', color: C.paper, fontFamily: fontSong, fontSize: 34, letterSpacing: 4}}>{item}</span>)}
      </div>
    </div>
    <div style={{position: 'absolute', left: 148, bottom: 92, fontFamily: fontSong, fontSize: 34, color: C.gold, letterSpacing: 8}}>30秒看懂这套学习机制</div>
  </AbsoluteFill>
);
