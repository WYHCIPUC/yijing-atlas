import React from 'react';
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {
  Caption,
  GoldRule,
  Grain,
  HexagramLines,
  MechanicalWheel,
  PageTexture,
  ScreenFrame,
  Vignette,
} from './components';
import { theme } from './theme';

const full = (background: string = theme.ink): React.CSSProperties => ({
  background,
  overflow: 'hidden',
  color: theme.text,
});

export const HookScene: React.FC<{ duration: number; vertical?: boolean }> = ({ duration, vertical = false }) => {
  const frame = useCurrentFrame();
  const assets = ['star', 'evolution', 'wheel'];
  const imageIndex = Math.min(2, Math.floor(frame / 12));
  if (frame < 36) {
    const local = frame % 12;
    const scale = interpolate(local, [0, 12], [1, 1.07]);
    return (
      <AbsoluteFill style={full('#03050a')}>
        <div style={{ position: 'absolute', inset: vertical ? '250px 0' : 0, transform: `scale(${scale})` }}>
          <PageTexture name={assets[imageIndex]} scale={vertical ? 1.72 : 1.02} />
        </div>
        <AbsoluteFill style={{ background: 'linear-gradient(90deg, rgba(3,5,10,.6), transparent 42%, rgba(3,5,10,.2))' }} />
      </AbsoluteFill>
    );
  }
  if (frame < 48) return <AbsoluteFill style={{ background: '#000' }} />;
  const reveal = interpolate(frame, [48, vertical ? 60 : 76], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  return (
    <AbsoluteFill style={{ ...full(), alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: vertical ? 860 : 1500, textAlign: 'center', opacity: reveal, transform: `translateY(${(1 - reveal) * 36}px)` }}>
        <div style={{ fontFamily: theme.kai, fontSize: vertical ? 82 : 92, lineHeight: 1.35, letterSpacing: '0.08em' }}>
          六十四卦，不该只是一张难懂的表。
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 42 }}><GoldRule progress={reveal} width={vertical ? 420 : 520} /></div>
      </div>
      <Grain />
      <Vignette strength={0.52} />
    </AbsoluteFill>
  );
};

export const TeaserPosterScene: React.FC<{ duration: number }> = ({ duration }) => {
  const frame = useCurrentFrame();
  const push = interpolate(frame, [0, duration], [0.94, 0.985], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  });
  const fade = interpolate(frame, [duration - 12, duration], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <AbsoluteFill style={{ ...full('#050811'), opacity: fade }}>
      <Img
        src={staticFile('textures/xhs-cover.png')}
        style={{ position: 'absolute', inset: -60, width: 1200, height: 2040, objectFit: 'cover', filter: 'blur(38px) brightness(.46)', opacity: 0.72 }}
      />
      <Img
        src={staticFile('textures/xhs-cover.png')}
        style={{ width: '100%', height: '100%', objectFit: 'contain', transform: `scale(${push})`, filter: 'drop-shadow(0 28px 70px rgba(0,0,0,.55))' }}
      />
      <AbsoluteFill style={{ background: 'radial-gradient(circle at 55% 46%, transparent 42%, rgba(3,6,14,.32) 100%)' }} />
      <Grain />
    </AbsoluteFill>
  );
};

const StarLines: React.FC<{ progress: number; vertical?: boolean }> = ({ progress, vertical = false }) => {
  const w = vertical ? 1080 : 1920;
  const h = vertical ? 1920 : 1080;
  const nodes = Array.from({ length: 18 }, (_, index) => {
    const x = ((Math.sin(index * 11.73) + 1) / 2) * w;
    const y = ((Math.sin(index * 7.31 + 2) + 1) / 2) * h;
    return { x, y };
  });
  return (
    <svg width={w} height={h} style={{ position: 'absolute', inset: 0 }}>
      {nodes.slice(0, -1).map((node, index) => {
        const next = nodes[(index * 5 + 7) % nodes.length];
        const visible = Math.max(0, Math.min(1, progress * 1.4 - index * 0.035));
        return <line key={index} x1={node.x} y1={node.y} x2={next.x} y2={next.y} stroke={theme.gold} strokeWidth={index % 5 === 0 ? 2.2 : 1} opacity={0.1 + visible * 0.28} strokeDasharray={`${visible * 900} 900`} />;
      })}
      {nodes.map((node, index) => <circle key={index} cx={node.x} cy={node.y} r={index % 5 === 0 ? 7 : 3} fill={index % 5 === 0 ? theme.goldBright : theme.gold} opacity={0.28 + progress * 0.6} />)}
    </svg>
  );
};

export const OpeningScene: React.FC<{ duration: number; vertical?: boolean }> = ({ duration, vertical = false }) => {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [0, duration * 0.62], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  const logo = interpolate(frame, [duration * 0.36, duration * 0.62], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={full('#050811')}>
      <StarLines progress={progress} vertical={vertical} />
      <AbsoluteFill style={{ background: 'radial-gradient(circle at 50% 52%, rgba(201,169,106,.12), transparent 42%)' }} />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ opacity: logo, transform: `scale(${0.94 + logo * 0.06})`, textAlign: 'center' }}>
          <div style={{ fontFamily: theme.kai, fontSize: vertical ? 132 : 154, color: theme.goldBright, letterSpacing: '0.16em', textShadow: '0 0 34px rgba(201,169,106,.28)' }}>易象图谱</div>
          <div style={{ marginTop: 18, fontFamily: theme.serif, fontSize: vertical ? 34 : 38, letterSpacing: '0.38em', color: theme.textMuted }}>观象 · 读经 · 知变</div>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 34 }}><GoldRule progress={logo} width={vertical ? 420 : 620} /></div>
        </div>
      </AbsoluteFill>
      <Vignette />
      <Grain />
    </AbsoluteFill>
  );
};

export const StarMapScene: React.FC<{ duration: number; vertical?: boolean }> = ({ duration, vertical = false }) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [0, duration], [0, 1]);
  const scale = vertical ? 1.76 + p * 0.08 : 1.01 + p * 0.08;
  const x = vertical ? -270 + p * 80 : -30 + p * 40;
  return (
    <AbsoluteFill style={full()}>
      <PageTexture name="star-detail" scale={scale} x={x} y={vertical ? -20 : -10} rotateX={vertical ? 0 : 2.6} rotateY={vertical ? 0 : -3.6} />
      <AbsoluteFill style={{ background: vertical ? 'linear-gradient(180deg, rgba(10,14,26,.3), transparent 24%, transparent 70%, rgba(10,14,26,.9))' : 'linear-gradient(90deg, rgba(10,14,26,.55), transparent 36%, transparent 72%, rgba(10,14,26,.38))' }} />
      <Caption duration={duration} kicker="RELATION ATLAS" vertical={vertical}>{vertical ? '星图呈现综、错、互、变。' : '在星图中，看见综、错、互、变。'}</Caption>
      <Vignette strength={0.6} />
    </AbsoluteFill>
  );
};

export const EvolutionScene: React.FC<{ duration: number; vertical?: boolean }> = ({ duration, vertical = false }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const flip = spring({ frame: frame - Math.round(duration * 0.25), fps, config: { damping: 15, stiffness: 110 }, durationInFrames: Math.round(duration * 0.34) });
  const cardIn = interpolate(frame, [duration * 0.42, duration * 0.62], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  return (
    <AbsoluteFill style={full()}>
      <PageTexture name="evolution" scale={vertical ? 1.72 : 1.02} x={vertical ? -240 : 0} />
      <AbsoluteFill style={{ background: 'rgba(5,8,17,.48)', backdropFilter: 'blur(1.5px)' }} />
      <div style={{ position: 'absolute', left: vertical ? 135 : 210, top: vertical ? 360 : 245, padding: vertical ? '58px 48px' : '52px 64px', borderRadius: 28, background: 'rgba(10,14,26,.82)', border: '1px solid rgba(201,169,106,.42)', boxShadow: '0 34px 90px rgba(0,0,0,.52)', transform: `translateY(${(1 - flip) * 36}px)` }}>
        <HexagramLines code={flip < 0.5 ? '110101' : '100011'} changing={[2, 4]} width={vertical ? 330 : 390} gap={vertical ? 26 : 23} />
        <div style={{ marginTop: 36, color: theme.goldBright, fontFamily: theme.kai, fontSize: 44, textAlign: 'center' }}>{flip < 0.5 ? '革卦' : '泰卦'}</div>
      </div>
      <div style={{ position: 'absolute', right: vertical ? 86 : 180, left: vertical ? 86 : 'auto', top: vertical ? 1040 : 210, width: vertical ? 'auto' : 720, opacity: cardIn, transform: `translateX(${(1 - cardIn) * 50}px)`, padding: vertical ? '42px 44px' : '48px 56px', background: 'rgba(17,23,42,.92)', border: '1px solid rgba(201,169,106,.35)', borderRadius: 24 }}>
        <div style={{ fontFamily: theme.mono, color: theme.gold, fontSize: vertical ? 32 : 28, letterSpacing: '0.16em' }}>CLASSIC EVIDENCE</div>
        <div style={{ fontFamily: theme.kai, fontSize: vertical ? 48 : 54, lineHeight: 1.48, marginTop: 18 }}>卦象变化，含义与典籍依据同步更新。</div>
        <div style={{ marginTop: 24, paddingTop: 22, borderTop: '1px solid rgba(201,169,106,.25)', color: theme.textMuted, fontFamily: theme.serif, fontSize: vertical ? 32 : 30, lineHeight: 1.6 }}>“穷则变，变则通，通则久。”——《周易·系辞下》</div>
      </div>
      <Caption duration={duration} kicker="EVOLUTION LAB" vertical={vertical}>{vertical ? '逐爻观察卦象与意义的变化。' : '每一次爻变，都有意义，也有出处。'}</Caption>
      <Vignette strength={0.58} />
    </AbsoluteFill>
  );
};

export const WheelScene: React.FC<{ duration: number; vertical?: boolean }> = ({ duration, vertical = false }) => (
  <AbsoluteFill style={{ ...full('#060912'), alignItems: 'center', justifyContent: 'center' }}>
    <div style={{ position: 'absolute', inset: 0, opacity: 0.23 }}><PageTexture name="wheel" scale={vertical ? 1.8 : 1.05} x={vertical ? -220 : 0} /></div>
    <div style={{ transform: `translateY(${vertical ? -120 : -28}px)` }}><MechanicalWheel duration={duration} vertical={vertical} /></div>
    <Caption duration={duration} kicker="HEXAGRAM WHEEL" vertical={vertical}>转动卦序，从随机一卦进入深度阅读。</Caption>
    <Vignette strength={0.7} />
    <Grain />
  </AbsoluteFill>
);

export const AlmanacScene: React.FC<{ duration: number; vertical?: boolean }> = ({ duration, vertical = false }) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [0, duration * 0.55], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic) });
  if (vertical) {
    return (
      <AbsoluteFill style={full()}>
        <PageTexture name="almanac" scale={1.72} x={-250} opacity={0.24} />
        <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(10,14,26,.06), rgba(10,14,26,.72) 55%, rgba(10,14,26,.94))' }} />
        <div style={{ position: 'absolute', left: 80, top: 150, opacity: 0.72 + p * 0.28, transform: `translateY(${(1 - p) * 34}px)` }}>
          <ScreenFrame name="almanac" width={920} height={518} rotate={-1} />
        </div>
        <div style={{ position: 'absolute', left: 110, top: 670, width: 860, height: 600, overflow: 'hidden', borderRadius: 28, border: '1px solid rgba(201,169,106,.42)', background: theme.inkElevated, boxShadow: '0 34px 90px rgba(0,0,0,.52)', opacity: 0.7 + p * 0.3, transform: `translateY(${(1 - p) * 42}px)` }}>
          <Img src={staticFile('textures/almanac.webp')} style={{ position: 'absolute', left: -420, top: -455, width: 1800, height: 1013, maxWidth: 'none' }} />
          <div style={{ position: 'absolute', right: 24, top: 22, padding: '8px 16px', borderRadius: 999, background: 'rgba(10,14,26,.86)', border: '1px solid rgba(201,169,106,.42)', color: theme.gold, fontFamily: theme.serif, fontSize: 30 }}>演示数据</div>
        </div>
        <Caption duration={duration} kicker="DAILY ALMANAC" vertical>黄历，让抽象术语落回日常。</Caption>
        <Vignette strength={0.58} />
      </AbsoluteFill>
    );
  }
  return (
    <AbsoluteFill style={full()}>
      <PageTexture name="almanac" scale={1 + p * 0.11} x={-80 * p} y={-20 * p} />
      <div style={{ position: 'absolute', left: 190 + p * 90, top: 158, width: 820, height: 650, borderRadius: '50%', boxShadow: '0 0 130px 70px rgba(201,169,106,.12)', border: '1px solid rgba(201,169,106,.16)', opacity: 0.4 + p * 0.45 }} />
      <Caption duration={duration} kicker="DAILY ALMANAC">把历法、节气与卦象，放回时间现场。</Caption>
      <Vignette strength={0.52} />
    </AbsoluteFill>
  );
};

export const BreathScene: React.FC<{ duration: number }> = ({ duration }) => {
  const frame = useCurrentFrame();
  const stamp = interpolate(frame, [4, 30], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.bezier(0.2, 0.75, 0.3, 1) });
  return (
    <AbsoluteFill style={{ background: theme.paperSoft, color: theme.ink, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      <div style={{ textAlign: 'center', transform: `scale(${1.28 - stamp * 0.28})`, filter: `blur(${(1 - stamp) * 7}px)`, opacity: stamp }}>
        <div style={{ fontFamily: theme.kai, fontSize: 138, letterSpacing: '0.12em' }}>看见，不等于学会。</div>
        <div style={{ margin: '42px auto 0', width: 320, height: 8, background: theme.gold, transform: `scaleX(${stamp})` }} />
      </div>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle, rgba(201,169,106,.12), transparent 48%)' }} />
      <div style={{ position: 'absolute', bottom: 56, color: 'rgba(10,14,26,.55)', fontFamily: theme.mono, fontSize: 26, letterSpacing: '0.22em' }}>SEE · TEST · REVIEW · MASTER</div>
    </AbsoluteFill>
  );
};

const learningLevels = [
  ['L1', '蒙学', '阴阳八卦'],
  ['L2', '习经', '六十四卦'],
  ['L3', '研传', '十翼精读'],
  ['L4', '明辨', '象数义理'],
  ['L5', '通用', '历法日用'],
];

export const LearningScene: React.FC<{ duration: number; vertical?: boolean }> = ({ duration, vertical = false }) => {
  const frame = useCurrentFrame();
  const travel = interpolate(frame, [10, duration * 0.72], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.bezier(0.18, 0.72, 0.2, 1) });
  return (
    <AbsoluteFill style={full()}>
      <PageTexture name="learning" scale={vertical ? 1.75 : 1.02} x={vertical ? -300 : 0} opacity={vertical ? 0.32 : 0.42} />
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(10,14,26,.18), rgba(10,14,26,.88))' }} />
      <div style={{ position: 'absolute', left: vertical ? 86 : 130, right: vertical ? 86 : 130, top: vertical ? 360 : 218 }}>
        <div style={{ height: 3, background: 'rgba(201,169,106,.25)', position: 'absolute', left: 70, right: 70, top: vertical ? 520 : 220 }}>
          <div style={{ height: '100%', width: `${travel * 100}%`, background: theme.gold, boxShadow: `0 0 18px ${theme.gold}` }} />
        </div>
        <div style={{ display: 'flex', flexDirection: vertical ? 'column' : 'row', justifyContent: 'space-between', gap: vertical ? 32 : 22 }}>
          {learningLevels.map((level, index) => {
            const appear = Math.max(0, Math.min(1, travel * learningLevels.length - index));
            return (
              <div key={level[0]} style={{ position: 'relative', width: vertical ? '100%' : 300, minHeight: vertical ? 170 : 430, borderRadius: 24, padding: vertical ? '26px 34px' : '34px 28px', border: `1px solid rgba(201,169,106,${0.2 + appear * 0.45})`, background: 'rgba(17,23,42,.92)', opacity: 0.34 + appear * 0.66, transform: vertical ? `translateX(${(1 - appear) * 36}px)` : `translateY(${(1 - appear) * 54}px)`, boxShadow: appear > 0.8 ? '0 30px 60px rgba(0,0,0,.34)' : undefined }}>
                <div style={{ fontFamily: theme.mono, color: theme.gold, fontSize: vertical ? 25 : 26, letterSpacing: '0.12em' }}>{level[0]}</div>
                <div style={{ fontFamily: theme.kai, fontSize: vertical ? 54 : 58, marginTop: 14, color: theme.goldBright }}>{level[1]}</div>
                <div style={{ fontFamily: theme.serif, fontSize: vertical ? 30 : 30, marginTop: 18, color: theme.textMuted }}>{level[2]}</div>
                {!vertical ? <div style={{ marginTop: 60, width: 22, height: 22, borderRadius: '50%', background: appear > 0.8 ? theme.gold : theme.inkElevated, boxShadow: appear > 0.8 ? `0 0 20px ${theme.gold}` : undefined }} /> : null}
              </div>
            );
          })}
        </div>
      </div>
      {vertical ? (
        <div style={{ position: 'absolute', left: 86, right: 86, top: 164, padding: '22px 28px', borderRadius: 18, background: 'rgba(17,23,42,.9)', border: '1px solid rgba(201,169,106,.38)', color: theme.goldBright, fontFamily: theme.serif, fontSize: 32, textAlign: 'center', letterSpacing: '0.05em' }}>
          小试 → 抽查 → 错题回炉 → 间隔复习
        </div>
      ) : null}
      <Caption duration={duration} kicker="FIVE-LEVEL CURRICULUM" vertical={vertical}>蒙学、习经、研传、明辨、通用。</Caption>
      <Vignette strength={0.48} />
    </AbsoluteFill>
  );
};

const assessmentLabels = ['小试', '抽查', '复讲', '阶考', '错题回炉'];

export const AssessmentScene: React.FC<{ duration: number; vertical?: boolean }> = ({ duration, vertical = false }) => {
  const frame = useCurrentFrame();
  if (vertical) {
    return (
      <AbsoluteFill style={{ ...full('#080c16'), perspective: 1500 }}>
        <div style={{ position: 'absolute', left: 92, top: 180, transform: 'rotateY(3deg) rotateX(1deg)' }}>
          <ScreenFrame name="review" width={896} height={504} rotate={-1.2} />
        </div>
        <div style={{ position: 'absolute', left: 170, top: 610, transform: 'rotateY(-3deg) rotateX(1deg)' }}>
          <ScreenFrame name="quiz" width={740} height={416} rotate={1.2} />
        </div>
        <div style={{ position: 'absolute', left: 78, right: 78, top: 1030, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {assessmentLabels.map((label, index) => {
            const cue = 18 + index * 14;
            const p = interpolate(frame, [cue, cue + 16], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.bezier(0.2, 1.15, 0.3, 1) });
            return (
              <div key={label} style={{ padding: '14px 28px', borderRadius: 16, background: index === 4 ? 'rgba(201,169,106,.17)' : 'rgba(17,23,42,.96)', border: `1px solid rgba(201,169,106,${0.25 + index * 0.05})`, color: index === 4 ? theme.goldBright : theme.text, fontFamily: theme.kai, fontSize: 38, textAlign: 'center', transform: `translateX(${(1 - p) * 90}px)`, opacity: p, boxShadow: '0 18px 40px rgba(0,0,0,.32)' }}>{label}</div>
            );
          })}
        </div>
        <Caption duration={duration} kicker="ACTIVE RECALL" vertical>主动回忆与间隔复习，把看过变成记住。</Caption>
        <Vignette strength={0.58} />
      </AbsoluteFill>
    );
  }
  return (
    <AbsoluteFill style={{ ...full('#080c16'), perspective: 1500 }}>
      <div style={{ position: 'absolute', left: 90, top: 100, transform: 'rotateY(5deg) rotateX(2deg)' }}><ScreenFrame name="review" width={820} height={462} rotate={-1.5} /></div>
      <div style={{ position: 'absolute', right: 90, top: 100, transform: 'rotateY(-5deg) rotateX(2deg)' }}><ScreenFrame name="quiz" width={820} height={462} rotate={1.5} /></div>
      <div style={{ position: 'absolute', left: 260, right: 260, top: 530, display: 'flex', justifyContent: 'center', gap: 22 }}>
        {assessmentLabels.map((label, index) => {
          const cue = 40 + index * 28;
          const p = interpolate(frame, [cue, cue + 20], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.bezier(0.2, 1.15, 0.3, 1) });
          return (
            <div key={label} style={{ width: 250, padding: '28px 24px', borderRadius: 18, background: index === 4 ? 'rgba(201,169,106,.16)' : 'rgba(17,23,42,.96)', border: `1px solid rgba(201,169,106,${0.25 + index * 0.05})`, color: index === 4 ? theme.goldBright : theme.text, fontFamily: theme.kai, fontSize: 40, textAlign: 'center', transform: `translateY(${(1 - p) * 160}px) rotate(${(index - 2) * 1.2}deg)`, opacity: p, boxShadow: '0 22px 48px rgba(0,0,0,.34)' }}>{label}</div>
          );
        })}
      </div>
      <div style={{ position: 'absolute', left: 350, right: 350, top: 680, padding: '20px 30px', borderRadius: 18, background: 'rgba(17,23,42,.9)', border: '1px solid rgba(201,169,106,.36)', textAlign: 'center', color: theme.goldBright, fontFamily: theme.serif, fontSize: 34, letterSpacing: '0.06em' }}>
        间隔复习 · 0 / 1 / 2 / 4 / 7 / 15 / 30 / 60 天
      </div>
      <Caption duration={duration} kicker="ACTIVE RECALL">检验之后，用间隔复习把记忆留下。</Caption>
      <Vignette strength={0.52} />
    </AbsoluteFill>
  );
};

export const DivinationScene: React.FC<{ duration: number }> = ({ duration }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const settle = spring({ frame: frame - 26, fps, config: { damping: 11, stiffness: 120 }, durationInFrames: 70 });
  const evidence = interpolate(frame, [duration * 0.36, duration * 0.62], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={full()}>
      <PageTexture name="divination" scale={1.03} x={-20} />
      <AbsoluteFill style={{ background: 'linear-gradient(90deg, rgba(4,7,14,.72), rgba(4,7,14,.18) 46%, rgba(4,7,14,.54))' }} />
      <div style={{ position: 'absolute', left: 165, top: 210, display: 'flex', gap: 28 }}>
        {[0, 1, 2].map((index) => (
          <div key={index} style={{ width: 116, height: 116, borderRadius: '50%', border: `8px double ${theme.gold}`, background: 'radial-gradient(circle, #d2b36f, #8a6d32)', display: 'grid', placeItems: 'center', color: '#30230e', fontFamily: theme.kai, fontSize: 50, boxShadow: '0 26px 50px rgba(0,0,0,.5)', transform: `translateY(${(1 - settle) * (-300 - index * 70)}px) rotateY(${frame * (18 + index * 5)}deg) rotateZ(${(index - 1) * 9}deg)` }}>易</div>
        ))}
      </div>
      <div style={{ position: 'absolute', right: 120, top: 180, width: 760, padding: '42px 50px', borderRadius: 24, background: 'rgba(17,23,42,.94)', border: '1px solid rgba(201,169,106,.35)', opacity: evidence, transform: `translateY(${(1 - evidence) * 36}px)` }}>
        <div style={{ color: theme.gold, fontFamily: theme.mono, fontSize: 26, letterSpacing: '0.16em' }}>FROM TEXT TO CONTEXT</div>
        <div style={{ fontFamily: theme.kai, fontSize: 52, marginTop: 18 }}>从经文到当下</div>
        <div style={{ marginTop: 28, color: theme.textMuted, fontFamily: theme.serif, fontSize: 30, lineHeight: 1.65 }}>给出取辞方法、经传原文、专业术语与现实参照；不把随机结果包装成现实决策。</div>
      </div>
      <Caption duration={duration} kicker="DIVINATION WITH SOURCES">有出处，有解释，也有边界。</Caption>
      <Vignette strength={0.52} />
    </AbsoluteFill>
  );
};

const outroScreens = [
  ['star-detail', -620, -260, -8], ['evolution', -620, 160, 6], ['wheel', -260, -360, -3],
  ['almanac', 280, -350, 3], ['learning', 620, -245, 8], ['review', 600, 190, -6],
  ['quiz', -250, 330, 3], ['divination', 220, 340, -3],
] as const;

export const OutroScene: React.FC<{ duration: number; vertical?: boolean }> = ({ duration, vertical = false }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const logo = spring({ frame: frame - Math.round(duration * 0.26), fps, config: { damping: 14, stiffness: 120 }, durationInFrames: 42 });
  const scale = vertical ? 0.72 : 1;
  return (
    <AbsoluteFill style={{ ...full('#050811'), alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', left: '50%', top: vertical ? '43%' : '50%', width: 0, height: 0, transform: `scale(${scale})` }}>
        {outroScreens.map(([name, x, y, rot], index) => {
          const p = spring({ frame: frame - index * 3, fps, config: { damping: 12, stiffness: 150 }, durationInFrames: 38 });
          const dx = x * p;
          const dy = y * p;
          return <div key={name} style={{ position: 'absolute', left: -165 + dx, top: -95 + dy, opacity: p * 0.72, transform: `scale(${0.52 + p * 0.08}) rotate(${rot * p}deg)` }}><ScreenFrame name={name} width={330} height={186} /></div>;
        })}
      </div>
      <div style={{ position: 'absolute', left: vertical ? 70 : 420, right: vertical ? 70 : 420, top: vertical ? 605 : 335, bottom: vertical ? 500 : 250, borderRadius: 34, background: 'rgba(8,12,23,.92)', border: '1px solid rgba(201,169,106,.42)', boxShadow: '0 0 90px rgba(201,169,106,.13), 0 42px 100px rgba(0,0,0,.55)', display: 'flex', flexDirection: vertical ? 'column' : 'row', alignItems: 'center', justifyContent: 'center', gap: vertical ? 34 : 48, padding: vertical ? '48px 54px' : '44px 58px', opacity: logo, transform: `scale(${0.92 + logo * 0.08})` }}>
        <div style={{ textAlign: vertical ? 'center' : 'left' }}>
          <div style={{ fontFamily: theme.kai, color: theme.goldBright, fontSize: vertical ? 92 : 92, letterSpacing: '0.12em' }}>易象图谱</div>
          <div style={{ marginTop: 18, fontFamily: theme.serif, fontSize: vertical ? 42 : 40 }}>现在，开始你的易学探索。</div>
          <div style={{ marginTop: 22, fontFamily: theme.mono, fontSize: 32, color: theme.textMuted, whiteSpace: 'nowrap' }}>wyhcipuc.github.io/yijing-atlas</div>
          <div style={{ marginTop: 10, fontFamily: theme.serif, fontSize: 32, color: theme.gold, whiteSpace: 'nowrap' }}>在线体验 · GitHub · Windows 一键版</div>
        </div>
        <div style={{ width: vertical ? 230 : 205, height: vertical ? 230 : 205, padding: 14, borderRadius: 20, background: '#f3ead9', boxShadow: '0 0 26px rgba(201,169,106,.3)' }}>
          <Img src={staticFile('qr-demo.svg')} style={{ width: '100%', height: '100%' }} />
        </div>
      </div>
      <AbsoluteFill style={{ background: 'radial-gradient(circle at 50% 50%, rgba(201,169,106,.14), transparent 44%)' }} />
      <Vignette strength={0.65} />
      <Grain />
    </AbsoluteFill>
  );
};

const teaserOutroScreens = [
  ['star-detail', -420, -420, -7],
  ['evolution', 420, -390, 6],
  ['almanac', -430, 350, 5],
  ['learning', 420, 360, -5],
] as const;

export const TeaserOutroScene: React.FC<{ duration: number }> = ({ duration }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const logo = spring({ frame: frame - 42, fps, config: { damping: 14, stiffness: 120 }, durationInFrames: 42 });
  const sub = interpolate(frame, [72, 92], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const hold = interpolate(frame, [duration - 10, duration], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ ...full('#050811'), alignItems: 'center', justifyContent: 'center', opacity: hold }}>
      <StarLines progress={Math.min(1, frame / 48)} vertical />
      <div style={{ position: 'absolute', left: '50%', top: '46%', width: 0, height: 0 }}>
        {teaserOutroScreens.map(([name, x, y, rot], index) => {
          const p = spring({ frame: frame - index * 6, fps, config: { damping: 13, stiffness: 145 }, durationInFrames: 38 });
          return (
            <div key={name} style={{ position: 'absolute', left: -180 + x * p, top: -102 + y * p, opacity: p * 0.64, transform: `scale(${0.5 + p * 0.08}) rotate(${rot * p}deg)` }}>
              <ScreenFrame name={name} width={360} height={203} />
            </div>
          );
        })}
      </div>
      <div style={{ position: 'absolute', left: 68, right: 68, top: 590, bottom: 465, borderRadius: 34, background: 'rgba(8,12,23,.94)', border: '1px solid rgba(201,169,106,.44)', boxShadow: '0 0 100px rgba(201,169,106,.14), 0 42px 100px rgba(0,0,0,.58)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '56px 50px', opacity: logo, transform: `scale(${0.92 + logo * 0.08})`, textAlign: 'center' }}>
        <div style={{ fontFamily: theme.kai, color: theme.goldBright, fontSize: 104, letterSpacing: '0.14em' }}>易象图谱</div>
        <div style={{ marginTop: 26, width: 360 }}><GoldRule progress={logo} width={360} /></div>
        <div style={{ marginTop: 34, fontFamily: theme.serif, fontSize: 42, lineHeight: 1.55, opacity: sub }}>一个正在打磨中的《易经》学习工具</div>
        <div style={{ marginTop: 22, fontFamily: theme.kai, fontSize: 34, lineHeight: 1.55, color: theme.gold, opacity: sub }}>正式发布前，先留下一个预告。</div>
      </div>
      <AbsoluteFill style={{ background: 'radial-gradient(circle at 50% 50%, rgba(201,169,106,.15), transparent 44%)' }} />
      <Vignette strength={0.66} />
      <Grain />
    </AbsoluteFill>
  );
};
