import React, {useMemo} from 'react';
import {
  AbsoluteFill,
  Audio,
  Composition,
  Easing,
  interpolate,
  Sequence,
  staticFile,
  useCurrentFrame,
} from 'remotion';

const FPS = 30;
const WIDTH = 1920;
const HEIGHT = 1080;
const CHINESE_BEAT_ZERO = 0.5265;
const CHINESE_BEAT_INTERVAL = 0.44446;
const beatF = (beat: number) => Math.round((CHINESE_BEAT_ZERO + beat * CHINESE_BEAT_INTERVAL) * FPS);
const YI_START = beatF(8);
const ATLAS_START = beatF(26);
const COLORS = {
  ink: '#0a0e1a',
  inkSoft: '#11182a',
  gold: '#c9a96a',
  paper: '#e8d9b8',
  muted: '#8f856f',
};

const clamp = (frame: number, input: [number, number], output: [number, number]) =>
  interpolate(frame, input, output, {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  });

const hash = (value: number) => {
  const x = Math.sin(value * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

const Background: React.FC<{frame: number}> = ({frame}) => {
  const drift = Math.sin(frame / 90) * 24;
  return (
    <AbsoluteFill
      style={{
        background:
          `radial-gradient(circle at ${50 + drift / 40}% 43%, rgba(201,169,106,.12), transparent 24%),` +
          'radial-gradient(circle at 12% 90%, rgba(41,76,112,.24), transparent 38%),' +
          `linear-gradient(135deg, ${COLORS.ink} 0%, #070a12 58%, #0d1422 100%)`,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.16,
          backgroundImage:
            'linear-gradient(rgba(232,217,184,.025) 1px, transparent 1px), linear-gradient(90deg, rgba(232,217,184,.02) 1px, transparent 1px)',
          backgroundSize: '72px 72px',
          transform: `translate(${drift}px, ${-drift / 2}px)`,
        }}
      />
      {Array.from({length: 90}, (_, index) => {
        const x = hash(index + 1) * WIDTH;
        const y = hash(index + 101) * HEIGHT;
        const size = 1 + hash(index + 501) * 2.2;
        const pulse = 0.25 + 0.5 * Math.abs(Math.sin((frame + index * 9) / 42));
        return (
          <span
            key={index}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              width: size,
              height: size,
              borderRadius: '50%',
              background: COLORS.paper,
              opacity: pulse,
              boxShadow: size > 2.3 ? `0 0 14px ${COLORS.gold}` : undefined,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

const SourceLabel: React.FC<{children: React.ReactNode; opacity?: number}> = ({children, opacity = 1}) => (
  <div
    style={{
      position: 'absolute',
      right: 96,
      bottom: 64,
      color: COLORS.muted,
      fontFamily: "'Kaiti SC', 'STKaiti', 'KaiTi', serif",
      fontSize: 30,
      letterSpacing: 5,
      opacity,
    }}
  >
    {children}
  </div>
);

export const DaoScene: React.FC = () => {
  const frame = useCurrentFrame();
  const dotIn = clamp(frame, [8, 30], [0, 1]);
  const split = clamp(frame, [48, 76], [0, 1]);
  const third = clamp(frame, [78, 102], [0, 1]);
  const burst = clamp(frame, [100, 119], [0, 1]);
  const nodes = [
    {x: -210 * split, y: 18 * split, opacity: 1},
    {x: 210 * split, y: -18 * split, opacity: split},
    {x: 0, y: -180, opacity: third},
  ];
  const phrase = frame < 48 ? '道生一' : frame < 78 ? '一生二' : frame < 100 ? '二生三' : '三生万物';

  return (
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
      <Background frame={frame} />
      <svg width={WIDTH} height={HEIGHT} style={{position: 'absolute'}}>
        <circle cx={960} cy={480} r={180 + burst * 270} fill="none" stroke={COLORS.gold} strokeOpacity={0.22 * (1 - burst)} strokeWidth={1.5} />
        {nodes.slice(0, 2).map((node, index) => (
          <line
            key={index}
            x1={960 + nodes[0].x}
            y1={480 + nodes[0].y}
            x2={960 + node.x}
            y2={480 + node.y}
            stroke={COLORS.gold}
            strokeOpacity={0.35 * split}
            strokeWidth={2}
          />
        ))}
        {burst > 0 && Array.from({length: 72}, (_, index) => {
          const angle = hash(index + 901) * Math.PI * 2;
          const radius = 70 + hash(index + 951) * 430 * burst;
          const x = 960 + Math.cos(angle) * radius;
          const y = 480 + Math.sin(angle) * radius * 0.62;
          const r = 1.2 + hash(index + 1001) * 3;
          return <circle key={index} cx={x} cy={y} r={r} fill={index % 7 === 0 ? COLORS.gold : COLORS.paper} opacity={burst * (0.28 + hash(index) * 0.65)} />;
        })}
      </svg>
      {nodes.map((node, index) => (
        <div
          key={index}
          style={{
            position: 'absolute',
            left: 960 + node.x - 9,
            top: 480 + node.y - 9,
            width: 18,
            height: 18,
            borderRadius: '50%',
            background: COLORS.paper,
            boxShadow: `0 0 34px ${COLORS.gold}`,
            opacity: dotIn * node.opacity * (1 - burst),
            transform: `scale(${0.45 + dotIn * 0.55})`,
          }}
        />
      ))}
      <div
        style={{
          position: 'absolute',
          bottom: 150,
          color: COLORS.paper,
          fontFamily: "'Songti SC', 'STSong', 'SimSun', serif",
          fontSize: 70,
          letterSpacing: 20,
          opacity: clamp(frame, [12, 28], [0, 1]) * (1 - clamp(frame, [108, 119], [0, 1])),
          transform: `translateY(${24 * (1 - dotIn)}px)`,
          textShadow: '0 8px 40px rgba(0,0,0,.6)',
        }}
      >
        {phrase}
      </div>
      <SourceLabel opacity={clamp(frame, [22, 40], [0, 1]) * (1 - burst)}>《道德经·第四十二章》</SourceLabel>
    </AbsoluteFill>
  );
};

const Taiji: React.FC<{progress: number}> = ({progress}) => {
  const rotation = -38 + progress * 92;
  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        top: '44%',
        width: 280,
        height: 280,
        borderRadius: '50%',
        overflow: 'hidden',
        transform: `translate(-50%, -50%) rotate(${rotation}deg) scale(${0.72 + progress * 0.28})`,
        boxShadow: `0 0 0 2px rgba(201,169,106,.42), 0 0 90px rgba(201,169,106,.16)`,
        background: `linear-gradient(90deg, ${COLORS.paper} 50%, #161b25 50%)`,
      }}
    >
      <div style={{position: 'absolute', left: 70, top: 0, width: 140, height: 140, borderRadius: '50%', background: COLORS.paper}} />
      <div style={{position: 'absolute', left: 70, bottom: 0, width: 140, height: 140, borderRadius: '50%', background: '#161b25'}} />
      <div style={{position: 'absolute', left: 126, top: 56, width: 28, height: 28, borderRadius: '50%', background: '#161b25'}} />
      <div style={{position: 'absolute', left: 126, bottom: 56, width: 28, height: 28, borderRadius: '50%', background: COLORS.paper}} />
    </div>
  );
};

const trigramBits = ['111', '110', '101', '100', '011', '010', '001', '000'];
const trigramNames = ['乾', '兑', '离', '震', '巽', '坎', '艮', '坤'];

const Yao: React.FC<{yang: boolean; width?: number; opacity?: number}> = ({yang, width = 88, opacity = 1}) => (
  <div style={{display: 'flex', justifyContent: 'space-between', width, opacity}}>
    {yang ? (
      <span style={{height: 8, width, borderRadius: 8, background: COLORS.gold, boxShadow: '0 0 14px rgba(201,169,106,.22)'}} />
    ) : (
      <>
        <span style={{height: 8, width: width * 0.42, borderRadius: 8, background: COLORS.paper}} />
        <span style={{height: 8, width: width * 0.42, borderRadius: 8, background: COLORS.paper}} />
      </>
    )}
  </div>
);

const Trigram: React.FC<{bits: string; name: string; scale?: number; opacity?: number}> = ({bits, name, scale = 1, opacity = 1}) => (
  <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, transform: `scale(${scale})`, opacity}}>
    {bits.split('').map((bit, index) => <Yao key={index} yang={bit === '1'} />)}
    <span style={{marginTop: 5, color: COLORS.paper, fontFamily: "'Kaiti SC', 'KaiTi', serif", fontSize: 28}}>{name}</span>
  </div>
);

export const YiScene: React.FC = () => {
  const frame = useCurrentFrame();
  const taijiIn = clamp(frame, [0, 50], [0, 1]);
  const liangyi = clamp(frame, [60, 110], [0, 1]);
  const sixiang = clamp(frame, [118, 170], [0, 1]);
  const bagua = clamp(frame, [176, 230], [0, 1]);
  const fadeTaiji = 1 - clamp(frame, [66, 104], [0, 1]);
  const stage = frame < 62 ? '太极' : frame < 118 ? '两仪' : frame < 176 ? '四象' : '八卦';

  return (
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
      <Background frame={frame + 120} />
      <div style={{position: 'absolute', top: 76, left: 96, color: COLORS.gold, fontSize: 27, letterSpacing: 8, fontFamily: "'Songti SC', 'SimSun', serif"}}>由简入繁 · 由象见理</div>
      <div style={{opacity: taijiIn * fadeTaiji}}><Taiji progress={taijiIn} /></div>
      {frame >= 56 && frame < 176 && (
        <div style={{position: 'absolute', top: 310, display: 'grid', gridTemplateColumns: frame < 118 ? 'repeat(2, 220px)' : 'repeat(4, 180px)', gap: frame < 118 ? 120 : 45, opacity: frame < 118 ? liangyi : sixiang}}>
          {(frame < 118 ? ['1', '0'] : ['11', '10', '01', '00']).map((bits, index) => (
            <div key={bits} style={{display: 'flex', flexDirection: 'column-reverse', gap: 18, alignItems: 'center', transform: `translateY(${(1 - (frame < 118 ? liangyi : sixiang)) * (index % 2 === 0 ? 36 : -36)}px)`}}>
              {bits.split('').map((bit, line) => <Yao key={line} yang={bit === '1'} width={120} />)}
            </div>
          ))}
        </div>
      )}
      {frame >= 164 && (
        <div style={{position: 'absolute', left: 196, right: 196, top: 300, display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 26}}>
          {trigramBits.map((bits, index) => (
            <Trigram key={bits} bits={bits} name={trigramNames[index]} scale={0.95 + bagua * 0.05} opacity={bagua * clamp(frame, [176 + index * 4, 204 + index * 4], [0, 1])} />
          ))}
        </div>
      )}
      <div style={{position: 'absolute', bottom: 142, color: COLORS.paper, fontFamily: "'Songti SC', 'SimSun', serif", fontSize: 68, letterSpacing: 20, opacity: clamp(frame, [4, 24], [0, 1])}}>{stage}</div>
      <SourceLabel opacity={clamp(frame, [18, 44], [0, 1])}>《周易·系辞上传》</SourceLabel>
    </AbsoluteFill>
  );
};

type Point = {gridX: number; gridY: number; starX: number; starY: number; size: number};

export const AtlasScene: React.FC = () => {
  const frame = useCurrentFrame();
  const morph = clamp(frame, [84, 150], [0, 1]);
  const titleIn = clamp(frame, [150, 178], [0, 1]);
  const gridOpacity = 1 - clamp(frame, [88, 148], [0, 1]);
  const starOpacity = clamp(frame, [76, 140], [0, 1]);
  const points = useMemo<Point[]>(() => Array.from({length: 64}, (_, index) => {
    const row = Math.floor(index / 8);
    const col = index % 8;
    const angle = hash(index + 250) * Math.PI * 2;
    const radius = 110 + Math.pow(hash(index + 350), 0.62) * 360;
    return {
      gridX: 620 + col * 98,
      gridY: 190 + row * 92,
      starX: 960 + Math.cos(angle) * radius * 1.55,
      starY: 475 + Math.sin(angle) * radius * 0.77,
      size: 3 + hash(index + 450) * 5,
    };
  }), []);
  const positions = points.map((point) => ({
    x: point.gridX + (point.starX - point.gridX) * morph,
    y: point.gridY + (point.starY - point.gridY) * morph,
  }));

  return (
    <AbsoluteFill>
      <Background frame={frame + 360} />
      <svg width={WIDTH} height={HEIGHT} style={{position: 'absolute'}}>
        {morph > 0.45 && positions.map((point, index) => {
          const next = positions[(index * 13 + 7) % 64];
          if (index % 3 !== 0) return null;
          return <line key={index} x1={point.x} y1={point.y} x2={next.x} y2={next.y} stroke={COLORS.gold} strokeWidth={1} strokeOpacity={(morph - 0.45) * 0.2} />;
        })}
        {positions.map((point, index) => (
          <g key={index}>
            {Array.from({length: 6}, (_, line) => {
              const yang = ((index >> line) & 1) === 1;
              const y = point.y + 19 - line * 7.2;
              return yang ? (
                <line key={line} x1={point.x - 21} x2={point.x + 21} y1={y} y2={y} stroke={index % 9 === 0 ? COLORS.gold : COLORS.paper} strokeWidth={3} strokeLinecap="round" opacity={gridOpacity} />
              ) : (
                <g key={line} opacity={gridOpacity}>
                  <line x1={point.x - 21} x2={point.x - 5} y1={y} y2={y} stroke={COLORS.paper} strokeWidth={3} strokeLinecap="round" />
                  <line x1={point.x + 5} x2={point.x + 21} y1={y} y2={y} stroke={COLORS.paper} strokeWidth={3} strokeLinecap="round" />
                </g>
              );
            })}
            <circle cx={point.x} cy={point.y} r={points[index].size + (index === 0 ? 4 : 0)} fill={index % 8 === 0 ? COLORS.gold : COLORS.paper} opacity={starOpacity * (0.45 + hash(index) * 0.55)} />
          </g>
        ))}
      </svg>
      <div style={{position: 'absolute', top: 77, left: 96, color: COLORS.gold, fontSize: 26, letterSpacing: 7, fontFamily: "'Songti SC', 'SimSun', serif", opacity: 1 - titleIn}}>八卦两两相重 · 演为六十四卦</div>
      <div style={{position: 'absolute', left: 0, right: 0, top: 392, textAlign: 'center', opacity: titleIn, transform: `translateY(${24 * (1 - titleIn)}px)`}}>
        <div style={{color: COLORS.paper, fontFamily: "'Songti SC', 'STSong', 'SimSun', serif", fontSize: 94, letterSpacing: 24, textShadow: '0 10px 46px rgba(0,0,0,.8)'}}>易象图谱</div>
        <div style={{marginTop: 25, color: COLORS.gold, fontFamily: "'Kaiti SC', 'KaiTi', serif", fontSize: 34, letterSpacing: 12}}>从六十四卦，进入一条可探索的学习路径</div>
      </div>
    </AbsoluteFill>
  );
};

type MusicDirection = 'none' | 'a' | 'b' | 'hybrid' | 'mystic';

type OpeningMotionTestProps = {
  music: MusicDirection;
};

const musicFiles: Record<'a' | 'b', string> = {
  a: 'audio/preproduction-v2/direction-a-sun-and-his-daughter.mp3',
  b: 'audio/preproduction-v2/direction-b-tapis.mp3',
};

const HybridMusic: React.FC = () => (
  <>
    <Audio
      src={staticFile('audio/preproduction-v2/direction-b-tapis.mp3')}
      volume={(frame) => interpolate(frame, [0, 34, 520, 598], [0, 0.15, 0.15, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}
    />
    <Audio
      src={staticFile('audio/preproduction-v2/chinese-classical-dynasty.mp3')}
      volume={(frame) => interpolate(frame, [0, 34, 520, 598], [0, 0.2, 0.2, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}
    />
  </>
);

const HybridSfx: React.FC = () => (
  <>
    <Sequence from={beatF(0)}><Audio src={staticFile('audio/preproduction-v2/metal-spring-hit.mp3')} volume={0.17} /></Sequence>
    <Sequence from={beatF(4)}><Audio src={staticFile('audio/preproduction-v2/lock-quick.mp3')} volume={0.2} /></Sequence>
    <Sequence from={beatF(7)}><Audio src={staticFile('audio/preproduction-v2/machine-activate-short.mp3')} volume={0.22} /></Sequence>
    <Sequence from={beatF(8)}><Audio src={staticFile('audio/sfx/text/marker-pen-line.mp3')} volume={0.24} /></Sequence>
    <Sequence from={beatF(13)}><Audio src={staticFile('audio/preproduction-v2/metal-spring-hit.mp3')} volume={0.14} /></Sequence>
    <Sequence from={beatF(26)}><Audio src={staticFile('audio/preproduction-v2/sweep-metal-quick.mp3')} volume={0.25} /></Sequence>
    <Sequence from={beatF(26)}><Audio src={staticFile('audio/sfx/mech/mech-tech-movement.mp3')} volume={0.3} /></Sequence>
    <Sequence from={beatF(34)}><Audio src={staticFile('audio/preproduction-v2/metal-spring-hit.mp3')} volume={0.16} /></Sequence>
    <Sequence from={beatF(39)}><Audio src={staticFile('audio/sfx/mech/gear-lock-metallic.mp3')} volume={0.4} /></Sequence>
  </>
);

const MysticMusic: React.FC = () => (
  <>
    <Audio
      src={staticFile('audio/preproduction-v2/direction-b-tapis.mp3')}
      volume={(frame) => interpolate(frame, [0, 42, 520, 598], [0, 0.22, 0.22, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}
    />
    <Audio
      src={staticFile('audio/preproduction-v2/mystic-flute-harp-relaxation-05.mp3')}
      volume={(frame) => interpolate(frame, [0, 70, 280, 520, 598], [0, 0.07, 0.12, 0.12, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}
    />
  </>
);

const MysticSfx: React.FC = () => (
  <>
    <Sequence from={8}><Audio src={staticFile('audio/preproduction-v2/water-drop-cave.mp3')} volume={0.24} /></Sequence>
    <Sequence from={48}><Audio src={staticFile('audio/preproduction-v2/chime-crystal.mp3')} volume={0.1} /></Sequence>
    <Sequence from={78}><Audio src={staticFile('audio/preproduction-v2/water-drop-cave.mp3')} volume={0.12} /></Sequence>
    <Sequence from={100}><Audio src={staticFile('audio/preproduction-v2/wind-pass-vibrate.mp3')} volume={0.12} /></Sequence>
    <Sequence from={YI_START}><Audio src={staticFile('audio/sfx/text/marker-pen-line.mp3')} volume={0.16} /></Sequence>
    <Sequence from={YI_START + 60}><Audio src={staticFile('audio/preproduction-v2/chime-crystal.mp3')} volume={0.08} /></Sequence>
    <Sequence from={YI_START + 118}><Audio src={staticFile('audio/preproduction-v2/water-drop-cave.mp3')} volume={0.08} /></Sequence>
    <Sequence from={YI_START + 176}><Audio src={staticFile('audio/preproduction-v2/chime-crystal.mp3')} volume={0.1} /></Sequence>
    <Sequence from={ATLAS_START}><Audio src={staticFile('audio/preproduction-v2/wind-pass-vibrate.mp3')} volume={0.16} /></Sequence>
    <Sequence from={ATLAS_START}><Audio src={staticFile('audio/preproduction-v2/machine-activate-short.mp3')} volume={0.07} /></Sequence>
    <Sequence from={ATLAS_START + 150}><Audio src={staticFile('audio/sfx/mech/gear-lock-metallic.mp3')} volume={0.16} /></Sequence>
    <Sequence from={ATLAS_START + 150}><Audio src={staticFile('audio/preproduction-v2/chime-crystal.mp3')} volume={0.12} /></Sequence>
  </>
);

const OpeningMotionTest: React.FC<OpeningMotionTestProps> = ({music}) => (
  <AbsoluteFill style={{background: COLORS.ink}}>
    <Sequence from={0} durationInFrames={YI_START}><DaoScene /></Sequence>
    <Sequence from={YI_START} durationInFrames={ATLAS_START - YI_START}><YiScene /></Sequence>
    <Sequence from={ATLAS_START} durationInFrames={600 - ATLAS_START}><AtlasScene /></Sequence>
    {(music === 'a' || music === 'b') && (
      <Audio
        src={staticFile(musicFiles[music])}
        volume={(frame) => interpolate(frame, [0, 30, 510, 595], [0, 0.25, 0.25, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}
      />
    )}
    {music === 'hybrid' && <HybridMusic />}
    {music === 'mystic' && <MysticMusic />}
    {music === 'hybrid' ? (
      <HybridSfx />
    ) : music === 'mystic' ? (
      <MysticSfx />
    ) : (
      <>
        <Sequence from={0}><Audio src={staticFile('audio/sfx/transition/transition-soft.mp3')} volume={0.18} /></Sequence>
        <Sequence from={116}><Audio src={staticFile('audio/sfx/text/marker-pen-line.mp3')} volume={0.32} /></Sequence>
        <Sequence from={356}><Audio src={staticFile('audio/sfx/mech/mech-tech-movement.mp3')} volume={0.38} /></Sequence>
        <Sequence from={520}><Audio src={staticFile('audio/sfx/mech/gear-lock-metallic.mp3')} volume={0.42} /></Sequence>
      </>
    )}
  </AbsoluteFill>
);

export const OpeningMotionTestRoot: React.FC = () => (
  <>
    <Composition
      id="YijingAtlasOpeningTest"
      component={OpeningMotionTest}
      width={WIDTH}
      height={HEIGHT}
      fps={FPS}
      durationInFrames={600}
      defaultProps={{music: 'none'}}
    />
    <Composition
      id="YijingAtlasOpeningMusicA"
      component={OpeningMotionTest}
      width={WIDTH}
      height={HEIGHT}
      fps={FPS}
      durationInFrames={600}
      defaultProps={{music: 'a'}}
    />
    <Composition
      id="YijingAtlasOpeningMusicB"
      component={OpeningMotionTest}
      width={WIDTH}
      height={HEIGHT}
      fps={FPS}
      durationInFrames={600}
      defaultProps={{music: 'b'}}
    />
    <Composition
      id="YijingAtlasOpeningChineseHybrid"
      component={OpeningMotionTest}
      width={WIDTH}
      height={HEIGHT}
      fps={FPS}
      durationInFrames={600}
      defaultProps={{music: 'hybrid'}}
    />
    <Composition
      id="YijingAtlasOpeningMystic"
      component={OpeningMotionTest}
      width={WIDTH}
      height={HEIGHT}
      fps={FPS}
      durationInFrames={600}
      defaultProps={{music: 'mystic'}}
    />
  </>
);
