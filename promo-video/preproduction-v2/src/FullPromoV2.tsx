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
import {AtlasScene, DaoScene, YiScene} from './OpeningMotionTest';
import {
  ApertureOverlay,
  ClockWipeOverlay,
  InkBleedOverlay,
  LineCarryOverlay,
  PaperDoorOverlay,
  YaoBarsOverlay,
} from './Transitions';

export const FULL_FPS = 30;
export const FULL_DURATION = 5100;

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

const sceneOpacity = (frame: number, duration: number, fade = 18) =>
  ease(frame, [0, fade], [0, 1]) * ease(frame, [duration - fade, duration], [1, 0]);

const hash = (value: number) => {
  const x = Math.sin(value * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

const FilmBackground: React.FC<{frame: number; warm?: boolean}> = ({frame, warm = false}) => {
  const drift = Math.sin(frame / 150) * 2.5;
  return (
    <AbsoluteFill
      style={{
        background:
          `radial-gradient(circle at ${68 + drift}% 36%, rgba(201,169,106,${warm ? 0.16 : 0.09}), transparent 25%),` +
          'radial-gradient(circle at 14% 88%, rgba(45,74,112,.22), transparent 39%),' +
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
          transform: `translate(${drift * 5}px, ${-drift * 3}px)`,
        }}
      />
      {Array.from({length: 54}, (_, index) => (
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
            opacity: 0.2 + 0.35 * Math.abs(Math.sin((frame + index * 13) / 55)),
          }}
        />
      ))}
      <div style={{position: 'absolute', inset: 0, boxShadow: 'inset 0 0 210px rgba(0,0,0,.74)'}} />
    </AbsoluteFill>
  );
};

const FineRule: React.FC<{width?: number}> = ({width = 88}) => (
  <span style={{display: 'block', width, height: 2, background: C.gold, opacity: 0.9}} />
);

const Caption: React.FC<{
  eyebrow: string;
  title: React.ReactNode;
  body?: React.ReactNode;
  align?: 'left' | 'right';
  top?: number;
}> = ({eyebrow, title, body, align = 'left', top = 212}) => (
  <div
    style={{
      position: 'absolute',
      top,
      [align]: 98,
      width: 550,
      textAlign: align,
      zIndex: 6,
      textShadow: '0 8px 34px rgba(0,0,0,.88)',
    }}
  >
    <div style={{display: 'flex', alignItems: 'center', justifyContent: align === 'left' ? 'flex-start' : 'flex-end', gap: 18}}>
      {align === 'right' && <FineRule />}
      <span style={{fontFamily: fontSong, fontSize: 32, color: C.gold, letterSpacing: 6}}>{eyebrow}</span>
      {align === 'left' && <FineRule />}
    </div>
    <div style={{marginTop: 25, fontFamily: fontSong, fontSize: 66, lineHeight: 1.22, letterSpacing: 6, color: C.paper}}>{title}</div>
    {body && <div style={{marginTop: 22, fontFamily: fontKai, fontSize: 36, lineHeight: 1.55, letterSpacing: 1, color: '#c8bea8'}}>{body}</div>}
  </div>
);

const PageFrame: React.FC<{
  file: string;
  frame: number;
  scaleFrom?: number;
  scaleTo?: number;
  x?: number;
  y?: number;
  dim?: number;
}> = ({file, frame, scaleFrom = 1, scaleTo = 1.045, x = 0, y = 0, dim = 0}) => {
  const scale = ease(frame, [0, 300], [scaleFrom, scaleTo]);
  return (
    <AbsoluteFill style={{overflow: 'hidden', background: C.deep}}>
      <Img
        src={staticFile(`textures/raw/${file}.png`)}
        style={{
          width: 1920,
          height: 1080,
          objectFit: 'cover',
          transform: `translate(${x}px, ${y}px) scale(${scale})`,
          filter: 'saturate(.86) contrast(1.06)',
        }}
      />
      <div style={{position: 'absolute', inset: 0, background: `rgba(4,7,13,${dim})`}} />
      <div style={{position: 'absolute', inset: 0, boxShadow: 'inset 0 0 190px rgba(0,0,0,.7)'}} />
    </AbsoluteFill>
  );
};

const ElementPanel: React.FC<{
  file: string;
  frame: number;
  left: number;
  top: number;
  width: number;
  height: number;
  objectFit?: 'cover' | 'contain';
  objectPosition?: string;
  opacity?: number;
  delay?: number;
  radius?: number;
}> = ({file, frame, left, top, width, height, objectFit = 'cover', objectPosition = 'center top', opacity = 1, delay = 0, radius = 16}) => {
  const enter = ease(frame, [delay, delay + 42], [0, 1]);
  return (
    <div
      style={{
        position: 'absolute',
        left,
        top: top + (1 - enter) * 28,
        width,
        height,
        overflow: 'hidden',
        borderRadius: radius,
        border: '1px solid rgba(201,169,106,.34)',
        background: '#080c15',
        boxShadow: '0 34px 110px rgba(0,0,0,.55), 0 0 0 1px rgba(232,217,184,.035) inset',
        opacity: enter * opacity,
      }}
    >
      <Img
        src={staticFile(`textures/elements/${file}`)}
        style={{width: '100%', height: '100%', objectFit, objectPosition}}
      />
    </div>
  );
};

const ReadingPainScene: React.FC = () => {
  const frame = useCurrentFrame();
  const duration = 270;
  const open = ease(frame, [16, 70], [0, 1]);
  const question = ease(frame, [92, 132], [0, 1]);
  const fragments = ['名词很多', '关系难辨', '读过即忘', '无从验证'];
  return (
    <AbsoluteFill style={{opacity: sceneOpacity(frame, duration)}}>
      <FilmBackground frame={frame + 500} warm />
      <div style={{position: 'absolute', left: 180, top: 136, width: 1560, height: 790, perspective: 1800}}>
        <div
          style={{
            position: 'absolute',
            left: 90,
            top: 46,
            width: 1380,
            height: 700,
            borderRadius: 18,
            background: 'linear-gradient(102deg, #d9c8a5, #f0e3c7 49.7%, #d3bd91 50.3%, #ead8b5)',
            boxShadow: '0 36px 100px rgba(0,0,0,.56), inset 0 0 80px rgba(81,52,24,.18)',
            transform: `rotateX(${8 - open * 8}deg) scale(${0.94 + open * 0.06})`,
            opacity: open,
          }}
        >
          <div style={{position: 'absolute', left: '50%', top: 25, bottom: 25, width: 2, background: 'rgba(90,56,25,.18)', boxShadow: '0 0 18px rgba(68,37,16,.28)'}} />
          {Array.from({length: 13}, (_, i) => (
            <React.Fragment key={i}>
              <span style={{position: 'absolute', left: 95, top: 82 + i * 39, width: 450 - (i % 4) * 35, height: 3, background: 'rgba(57,42,25,.22)'}} />
              <span style={{position: 'absolute', right: 95, top: 82 + i * 39, width: 450 - ((i + 2) % 4) * 35, height: 3, background: 'rgba(57,42,25,.22)'}} />
            </React.Fragment>
          ))}
          <div style={{position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 45%, transparent 28%, rgba(80,52,22,.12))'}} />
        </div>
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, top: 330, textAlign: 'center', opacity: question, transform: `translateY(${28 * (1 - question)}px)`}}>
        <div style={{fontFamily: fontSong, fontSize: 68, letterSpacing: 7, color: C.ink, textShadow: '0 2px 18px rgba(255,247,221,.4)'}}>知道《易经》重要</div>
        <div style={{marginTop: 20, fontFamily: fontSong, fontSize: 74, letterSpacing: 8, color: '#6b321f'}}>却不知道从哪里开始</div>
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 74, display: 'flex', justifyContent: 'center', gap: 30}}>
        {fragments.map((item, index) => {
          const p = ease(frame, [145 + index * 13, 178 + index * 13], [0, 1]);
          return <div key={item} style={{padding: '15px 28px', border: '1px solid rgba(201,169,106,.35)', borderRadius: 30, color: C.paper, fontFamily: fontKai, fontSize: 27, letterSpacing: 4, opacity: p, transform: `translateY(${18 * (1 - p)}px)`, background: 'rgba(6,9,16,.74)'}}>{item}</div>;
        })}
      </div>
    </AbsoluteFill>
  );
};

const FrictionScene: React.FC = () => {
  const frame = useCurrentFrame();
  const duration = 240;
  const items = [
    {label: '顺序', note: '先学什么'},
    {label: '关系', note: '如何贯通'},
    {label: '检验', note: '是否学会'},
    {label: '复习', note: '怎样记住'},
  ];
  const resolve = ease(frame, [145, 195], [0, 1]);
  return (
    <AbsoluteFill style={{opacity: sceneOpacity(frame, duration)}}>
      <FilmBackground frame={frame + 850} />
      <div style={{position: 'absolute', left: 96, top: 76, color: C.gold, fontFamily: fontSong, fontSize: 25, letterSpacing: 8}}>独自读书最容易失去的四个支点</div>
      <svg width={1920} height={1080} style={{position: 'absolute'}}>
        <path d="M280 520 C540 340, 690 700, 960 520 S1380 350, 1640 520" fill="none" stroke={C.gold} strokeWidth={2} strokeDasharray="7 14" strokeOpacity={0.22 + resolve * 0.65} />
      </svg>
      <div style={{position: 'absolute', left: 188, right: 188, top: 335, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 42}}>
        {items.map((item, index) => {
          const p = ease(frame, [18 + index * 16, 62 + index * 16], [0, 1]);
          return (
            <div key={item.label} style={{height: 330, borderRadius: 16, border: `1px solid rgba(201,169,106,${0.25 + resolve * 0.4})`, background: `linear-gradient(155deg, rgba(22,30,47,.92), rgba(7,10,17,.94))`, padding: '43px 38px', boxShadow: resolve > 0.2 ? '0 22px 70px rgba(0,0,0,.35)' : undefined, opacity: p, transform: `translateY(${28 * (1 - p) - resolve * 10}px)`}}>
              <div style={{fontFamily: fontSong, color: C.paper, fontSize: 58, letterSpacing: 9}}>{item.label}</div>
              <FineRule width={54} />
              <div style={{marginTop: 28, color: C.muted, fontFamily: fontKai, fontSize: 29, letterSpacing: 3}}>{item.note}</div>
              <div style={{position: 'absolute', marginTop: 57, color: resolve > 0.5 ? C.gold : C.cinnabar, fontFamily: fontSong, fontSize: 22, letterSpacing: 5}}>{resolve > 0.5 ? '纳入学习闭环' : '容易中断'}</div>
            </div>
          );
        })}
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 94, textAlign: 'center', color: C.paper, fontFamily: fontSong, fontSize: 47, letterSpacing: 9, opacity: resolve}}>把零散阅读，变成一条可持续的学习路径</div>
    </AbsoluteFill>
  );
};

const StarMapScene: React.FC = () => {
  const frame = useCurrentFrame();
  const duration = 330;
  const reveal = ease(frame, [35, 92], [0, 1]);
  return (
    <AbsoluteFill style={{opacity: sceneOpacity(frame, duration)}}>
      <PageFrame file="star" frame={frame} scaleFrom={1} scaleTo={1} dim={0.18} />
      <div style={{position: 'absolute', left: 0, top: 0, bottom: 0, width: 760, background: 'linear-gradient(90deg, rgba(4,7,13,.96) 20%, rgba(4,7,13,.68) 67%, transparent)'}} />
      <ElementPanel file="star-detail-detail-panel-0.png" frame={frame} left={650} top={548} width={1180} height={369} delay={58} radius={13} />
      <Caption eyebrow="关系星图" title={<>不再孤立地<br />背六十四卦</>} body={<>选中一卦，即可看见<br />综、错、互、变的关系网络。</>} />
      <div style={{position: 'absolute', left: 820, top: 62, width: 365, height: 365, borderRadius: '50%', border: '1px solid rgba(201,169,106,.52)', boxShadow: '0 0 80px rgba(201,169,106,.15)', opacity: reveal, transform: `scale(${0.86 + reveal * 0.14})`}} />
    </AbsoluteFill>
  );
};

const RelationScene: React.FC = () => {
  const frame = useCurrentFrame();
  const duration = 240;
  const relations = [
    {name: '综卦', note: '上下颠倒', detail: '换一个方向，反观同一结构。', bits: '010001'},
    {name: '错卦', note: '阴阳相反', detail: '六爻阴阳互换，观察对待关系。', bits: '101110'},
    {name: '互卦', note: '中爻相取', detail: '取二三四、三四五爻，读出内在脉络。', bits: '100010'},
    {name: '变卦', note: '动爻所之', detail: '动爻改变，卦义随情境转化。', bits: '101110'},
  ];
  return (
    <AbsoluteFill style={{opacity: sceneOpacity(frame, duration)}}>
      <FilmBackground frame={frame + 1380} warm />
      <div style={{position: 'absolute', left: 0, right: 0, top: 92, textAlign: 'center'}}>
        <div style={{fontFamily: fontSong, color: C.paper, fontSize: 64, letterSpacing: 9}}>关系不是标签，而是四种读卦视角</div>
        <div style={{marginTop: 17, fontFamily: fontKai, color: C.gold, fontSize: 29, letterSpacing: 6}}>从结构变化中，理解卦与卦之间如何相互照见</div>
      </div>
      <div style={{position: 'absolute', left: 130, right: 130, top: 320, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24}}>
        {relations.map((relation, index) => {
          const enter = ease(frame, [24 + index * 18, 62 + index * 18], [0, 1]);
          return (
            <div key={relation.name} style={{height: 520, padding: '38px 34px', borderRadius: 16, border: '1px solid rgba(201,169,106,.32)', background: 'linear-gradient(155deg,rgba(20,28,45,.96),rgba(7,10,17,.94))', boxShadow: '0 26px 80px rgba(0,0,0,.35)', opacity: enter, transform: `translateY(${28 * (1 - enter)}px)`}}>
              <div style={{display: 'flex', flexDirection: 'column-reverse', gap: 11, height: 132, justifyContent: 'center'}}>
                {relation.bits.split('').map((bit, line) => <div key={line} style={{display: 'flex', gap: 12, width: 150}}>{bit === '1' ? <span style={{height: 7, width: 150, borderRadius: 4, background: index === 3 && line === 2 ? C.cinnabar : C.gold}} /> : <><span style={{height: 7, width: 64, borderRadius: 4, background: C.paper}} /><span style={{height: 7, width: 64, borderRadius: 4, background: C.paper}} /></>}</div>)}
              </div>
              <div style={{marginTop: 30, fontFamily: fontSong, color: C.paper, fontSize: 52, letterSpacing: 7}}>{relation.name}</div>
              <div style={{marginTop: 13, fontFamily: fontKai, color: C.gold, fontSize: 27, letterSpacing: 4}}>{relation.note}</div>
              <div style={{marginTop: 24, fontFamily: fontKai, color: '#bcb29e', fontSize: 25, lineHeight: 1.65, letterSpacing: 2}}>{relation.detail}</div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

const EvolutionScene: React.FC = () => {
  const frame = useCurrentFrame();
  const duration = 330;
  const tabs = ['卦象演变', '卦义同步', '典籍依据'];
  return (
    <AbsoluteFill style={{opacity: sceneOpacity(frame, duration)}}>
      <FilmBackground frame={frame + 1380} />
      <ElementPanel file="evolution-evolution-card-0.png" frame={frame} left={72} top={35} width={1080} height={1010} radius={18} />
      <div style={{position: 'absolute', right: 0, top: 0, bottom: 0, width: 810, background: 'linear-gradient(270deg, rgba(4,7,13,.98) 20%, rgba(4,7,13,.82) 72%, transparent)'}} />
      <Caption align="right" eyebrow="演变实验室" title={<>爻线变化<br />释义也随之变化</>} body={<>每一步演变，都同步呈现<br />卦义、关系与经传出处。</>} />
      <div style={{position: 'absolute', left: 125, bottom: 65, display: 'flex', gap: 16}}>
        {tabs.map((tab, index) => {
          const p = ease(frame, [70 + index * 30, 110 + index * 30], [0, 1]);
          return <div key={tab} style={{padding: '14px 25px', borderRadius: 8, background: index === 2 ? 'rgba(158,76,66,.86)' : 'rgba(13,20,32,.88)', border: '1px solid rgba(201,169,106,.35)', color: C.paper, fontFamily: fontKai, fontSize: 26, letterSpacing: 3, opacity: p, transform: `translateX(${-18 * (1 - p)}px)`}}>{tab}</div>;
        })}
      </div>
    </AbsoluteFill>
  );
};

const ClassicsScene: React.FC = () => {
  const frame = useCurrentFrame();
  const duration = 240;
  return (
    <AbsoluteFill style={{opacity: sceneOpacity(frame, duration)}}>
      <FilmBackground frame={frame + 1950} />
      <ElementPanel file="evolution-evolution-meaning-0.png" frame={frame} left={70} top={58} width={1120} height={964} objectFit="cover" objectPosition="center top" radius={18} />
      <div style={{position: 'absolute', right: 0, top: 0, bottom: 0, width: 790, background: 'linear-gradient(270deg,rgba(4,7,13,.98) 22%,rgba(4,7,13,.82) 72%,transparent)'}} />
      <Caption align="right" eyebrow="典籍依据" title={<>解释有出处<br />学习有边界</>} body={<>区分经文、传注与项目释义，<br />让专业表达仍然通俗可读。</>} top={205} />
      <div style={{position: 'absolute', right: 98, bottom: 168, display: 'flex', gap: 12}}>
        {['《周易》经文', '《彖传》《象传》', '《系辞传》'].map((label, index) => {
          const enter = ease(frame, [78 + index * 19, 110 + index * 19], [0, 1]);
          return <div key={label} style={{padding: '13px 20px', borderRadius: 7, border: '1px solid rgba(201,169,106,.34)', background: 'rgba(15,21,34,.9)', color: C.paper, fontFamily: fontKai, fontSize: 23, letterSpacing: 2, opacity: enter}}>{label}</div>;
        })}
      </div>
      <div style={{position: 'absolute', right: 98, bottom: 93, width: 640, textAlign: 'right', color: C.muted, fontFamily: fontKai, fontSize: 23, lineHeight: 1.55, letterSpacing: 2}}>经传原文为公版整理；项目说明用于学习辅助，版本与出处持续校对。</div>
    </AbsoluteFill>
  );
};

const BreathScene: React.FC = () => {
  const frame = useCurrentFrame();
  const duration = 210;
  const p = ease(frame, [25, 75], [0, 1]);
  return (
    <AbsoluteFill style={{opacity: sceneOpacity(frame, duration)}}>
      <FilmBackground frame={frame + 1700} warm />
      <div style={{position: 'absolute', left: 250, right: 250, top: 240, bottom: 240, border: '1px solid rgba(201,169,106,.38)', borderRadius: 10, background: 'linear-gradient(135deg, rgba(232,217,184,.065), rgba(201,169,106,.015))', boxShadow: '0 28px 100px rgba(0,0,0,.38)', transform: `scale(${0.97 + p * 0.03})`, opacity: p}}>
        <div style={{position: 'absolute', left: 75, top: 62, width: 44, height: 44, borderTop: `2px solid ${C.gold}`, borderLeft: `2px solid ${C.gold}`}} />
        <div style={{position: 'absolute', right: 75, bottom: 62, width: 44, height: 44, borderRight: `2px solid ${C.gold}`, borderBottom: `2px solid ${C.gold}`}} />
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, top: 422, textAlign: 'center', fontFamily: fontSong, color: C.paper, fontSize: 74, letterSpacing: 12, opacity: p}}>真正的学习</div>
      <div style={{position: 'absolute', left: 0, right: 0, top: 530, textAlign: 'center', fontFamily: fontKai, color: C.gold, fontSize: 39, letterSpacing: 9, opacity: ease(frame, [68, 110], [0, 1])}}>不只发生在阅读的时候</div>
    </AbsoluteFill>
  );
};

const LearningScene: React.FC = () => {
  const frame = useCurrentFrame();
  const duration = 390;
  const stages = [
    ['蒙学', '识象与基础'], ['习经', '读卦辞爻辞'], ['研传', '理解十翼'], ['明辨', '比较与论证'], ['通用', '迁移到真实问题'],
  ];
  const travel = ease(frame, [38, 322], [0, 1]);
  return (
    <AbsoluteFill style={{opacity: sceneOpacity(frame, duration)}}>
      <PageFrame file="learning" frame={frame} scaleFrom={1} scaleTo={1} dim={0.72} />
      <div style={{position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(4,7,13,.36), rgba(4,7,13,.88))'}} />
      <Caption eyebrow="五阶学程" title={<>从入门<br />到融会贯通</>} body="学习内容按认知难度逐层展开，进度清晰可见。" top={122} />
      {stages.map(([,], index) => {
        const start = 36 + index * 58;
        const end = start + 58;
        const panelOpacity = ease(frame, [start, start + 10], [0, 1]) * ease(frame, [end - 10, end], [1, 0]);
        return <ElementPanel key={index} file={`learning-level-block-${index}.png`} frame={frame} left={1060} top={122} width={710} height={560} objectFit="cover" objectPosition="center top" opacity={panelOpacity} radius={14} />;
      })}
      <div style={{position: 'absolute', left: 175, right: 175, top: 790}}>
        <div style={{height: 2, background: 'rgba(232,217,184,.18)'}} />
        <div style={{position: 'absolute', left: 0, top: 0, width: `${travel * 100}%`, height: 3, background: C.gold, boxShadow: '0 0 20px rgba(201,169,106,.45)'}} />
        <div style={{display: 'flex', justifyContent: 'space-between', transform: 'translateY(-17px)'}}>
          {stages.map(([name, note], index) => {
            const p = ease(frame, [45 + index * 53, 87 + index * 53], [0, 1]);
            const active = travel >= index / 4;
            return (
              <div key={name} style={{width: 240, textAlign: 'center', opacity: p}}>
                <div style={{margin: '0 auto', width: 34, height: 34, borderRadius: '50%', border: `2px solid ${active ? C.gold : C.muted}`, background: active ? C.gold : C.ink, boxShadow: active ? '0 0 30px rgba(201,169,106,.3)' : undefined}} />
                <div style={{marginTop: 30, color: active ? C.paper : C.muted, fontFamily: fontSong, fontSize: 43, letterSpacing: 8}}>{name}</div>
                <div style={{marginTop: 13, color: C.muted, fontFamily: fontKai, fontSize: 23, letterSpacing: 2}}>{note}</div>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const LessonDetailScene: React.FC = () => {
  const frame = useCurrentFrame();
  const duration = 270;
  return (
    <AbsoluteFill style={{opacity: sceneOpacity(frame, duration)}}>
      <FilmBackground frame={frame + 2790} warm />
      <ElementPanel file="learning-academy-rank-card-0.png" frame={frame} left={110} top={118} width={850} height={191} objectFit="cover" radius={15} />
      <ElementPanel file="learning-learning-dashboard-0.png" frame={frame} left={110} top={335} width={850} height={118} objectFit="cover" delay={25} radius={12} />
      <ElementPanel file="learning-level-block-0.png" frame={frame} left={110} top={482} width={850} height={500} objectFit="cover" objectPosition="center top" delay={48} radius={15} />
      <div style={{position: 'absolute', right: 0, top: 0, bottom: 0, width: 850, background: 'linear-gradient(270deg,rgba(4,7,13,.98) 20%,rgba(4,7,13,.77) 72%,transparent)'}} />
      <Caption align="right" eyebrow="单课学习闭环" title={<>一课一学<br />一课一试</>} body={<>阅读、练习和复讲互相衔接，<br />阶段掌握度随学习持续更新。</>} top={176} />
      <div style={{position: 'absolute', right: 98, bottom: 160, display: 'flex', gap: 16}}>
        {['读一段', '答一题', '讲一次', '再复习'].map((label, index) => {
          const enter = ease(frame, [92 + index * 20, 124 + index * 20], [0, 1]);
          return <div key={label} style={{width: 128, height: 74, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 10, border: `1px solid ${index === 3 ? 'rgba(158,76,66,.7)' : 'rgba(201,169,106,.38)'}`, background: 'rgba(17,24,39,.88)', color: C.paper, fontFamily: fontKai, fontSize: 25, letterSpacing: 3, opacity: enter, transform: `translateX(${18 * (1 - enter)}px)`}}>{label}</div>;
        })}
      </div>
    </AbsoluteFill>
  );
};

const AssessmentScene: React.FC = () => {
  const frame = useCurrentFrame();
  const duration = 330;
  const steps = ['小试', '抽查', '复讲', '阶考', '错题回炉'];
  return (
    <AbsoluteFill style={{opacity: sceneOpacity(frame, duration)}}>
      <FilmBackground frame={frame + 2300} />
      <ElementPanel file="quiz-mode-panel-0.png" frame={frame} left={92} top={104} width={650} height={764} objectFit="cover" />
      <ElementPanel file="review-mode-panel-0.png" frame={frame} left={610} top={560} width={620} height={362} objectFit="cover" delay={55} />
      <div style={{position: 'absolute', right: 95, top: 190, width: 720}}>
        <div style={{fontFamily: fontSong, fontSize: 64, color: C.paper, letterSpacing: 7}}>每一个小环节<br />都有检验</div>
        <div style={{marginTop: 42, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14}}>
          {steps.map((step, index) => {
            const p = ease(frame, [62 + index * 24, 100 + index * 24], [0, 1]);
            return <div key={step} style={{height: 76, display: 'flex', alignItems: 'center', paddingLeft: 25, borderLeft: `3px solid ${index === 4 ? C.cinnabar : C.gold}`, background: 'rgba(20,27,42,.8)', color: C.paper, fontFamily: fontKai, fontSize: 29, letterSpacing: 5, opacity: p, transform: `translateX(${24 * (1 - p)}px)`}}>{String(index + 1).padStart(2, '0')} · {step}</div>;
          })}
        </div>
        <div style={{marginTop: 28, color: C.gold, fontFamily: fontKai, fontSize: 29, letterSpacing: 3, opacity: ease(frame, [210, 250], [0, 1])}}>学过 → 检验 → 纠错 → 再掌握</div>
      </div>
    </AbsoluteFill>
  );
};

const ReviewScene: React.FC = () => {
  const frame = useCurrentFrame();
  const duration = 300;
  const days = [0, 1, 2, 4, 7, 15, 30, 60];
  const progress = ease(frame, [32, 245], [0, 1]);
  return (
    <AbsoluteFill style={{opacity: sceneOpacity(frame, duration)}}>
      <FilmBackground frame={frame + 2640} />
      <ElementPanel file="review-mode-panel-0.png" frame={frame} left={510} top={315} width={900} height={526} objectFit="cover" opacity={0.5} />
      <div style={{position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 60%, rgba(23,36,56,.22), rgba(4,7,13,.42) 70%)'}} />
      <div style={{position: 'absolute', left: 0, right: 0, top: 125, textAlign: 'center'}}>
        <div style={{fontFamily: fontSong, color: C.paper, fontSize: 65, letterSpacing: 9}}>记忆不是一次完成</div>
        <div style={{marginTop: 18, fontFamily: fontKai, color: C.gold, fontSize: 30, letterSpacing: 6}}>在将要忘记之前，再次相遇</div>
      </div>
      <div style={{position: 'absolute', left: 180, right: 180, top: 525}}>
        <div style={{height: 3, background: 'rgba(232,217,184,.18)'}} />
        <div style={{position: 'absolute', left: 0, top: 0, height: 3, width: `${progress * 100}%`, background: `linear-gradient(90deg, ${C.cinnabar}, ${C.gold})`, boxShadow: '0 0 18px rgba(201,169,106,.4)'}} />
        <div style={{display: 'flex', justifyContent: 'space-between', transform: 'translateY(-14px)'}}>
          {days.map((day, index) => {
            const p = ease(frame, [32 + index * 25, 62 + index * 25], [0, 1]);
            return <div key={day} style={{textAlign: 'center', width: 110, opacity: p}}><div style={{margin: '0 auto', width: 29, height: 29, borderRadius: '50%', background: progress >= index / 7 ? C.gold : C.ink, border: `2px solid ${C.gold}`}} /><div style={{marginTop: 24, fontFamily: fontSong, fontSize: 36, color: C.paper}}>{day}</div><div style={{marginTop: 5, fontFamily: fontKai, fontSize: 21, color: C.muted}}>日</div></div>;
          })}
        </div>
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 96, textAlign: 'center', color: C.muted, fontFamily: fontKai, fontSize: 28, letterSpacing: 4}}>结合掌握度动态安排复习 · 让理解逐步沉淀为长期记忆</div>
    </AbsoluteFill>
  );
};

const WheelScene: React.FC = () => {
  const frame = useCurrentFrame();
  const duration = 210;
  const lock = ease(frame, [136, 180], [0, 1]);
  return (
    <AbsoluteFill style={{opacity: sceneOpacity(frame, duration)}}>
      <FilmBackground frame={frame + 2940} />
      <ElementPanel file="wheel-guaxu-dialog-0.png" frame={frame} left={62} top={123} width={1120} height={834} radius={18} />
      <div style={{position: 'absolute', right: 0, top: 0, bottom: 0, width: 760, background: 'linear-gradient(270deg, rgba(4,7,13,.97), rgba(4,7,13,.64), transparent)'}} />
      <Caption align="right" eyebrow="卦序转盘" title={<>以一卦为入口<br />开始深度阅读</>} body="随机并非答案，而是打开探索的一种方式。" top={245} />
      <div style={{position: 'absolute', left: 79, top: 303, width: 515, height: 515, borderRadius: '50%', border: '2px solid rgba(201,169,106,.55)', boxShadow: `0 0 ${40 + lock * 70}px rgba(201,169,106,.2)`, transform: `rotate(${(1 - lock) * (frame * 2.7)}deg)`, opacity: 0.66}} />
    </AbsoluteFill>
  );
};

const AlmanacScene: React.FC = () => {
  const frame = useCurrentFrame();
  const duration = 210;
  return (
    <AbsoluteFill style={{opacity: sceneOpacity(frame, duration)}}>
      <FilmBackground frame={frame + 3150} warm />
      <ElementPanel file="almanac-almanac-view-0.png" frame={frame} left={165} top={85} width={720} height={910} objectFit="cover" objectPosition="center top" radius={18} />
      <div style={{position: 'absolute', right: 0, top: 0, bottom: 0, width: 720, background: 'linear-gradient(270deg, rgba(4,7,13,.95), rgba(4,7,13,.62), transparent)'}} />
      <Caption align="right" eyebrow="黄历与节气" title={<>把卦象放回<br />时间现场</>} body="日期、节气、干支与每日卦象，在同一画面中相互参照。" top={250} />
    </AbsoluteFill>
  );
};

const DivinationScene: React.FC = () => {
  const frame = useCurrentFrame();
  const duration = 240;
  const note = ease(frame, [105, 155], [0, 1]);
  return (
    <AbsoluteFill style={{opacity: sceneOpacity(frame, duration)}}>
      <PageFrame file="star" frame={frame} scaleFrom={1} scaleTo={1} dim={0.58} />
      <ElementPanel file="divination-divine-interpretation-0.png" frame={frame} left={1090} top={115} width={700} height={820} objectFit="cover" objectPosition={`center ${ease(frame, [25, 205], [0, 72])}%`} radius={16} />
      <div style={{position: 'absolute', left: 0, top: 0, bottom: 0, width: 760, background: 'linear-gradient(90deg, rgba(4,7,13,.97), rgba(4,7,13,.62), transparent)'}} />
      <Caption eyebrow="占筮问道" title={<>不只给出卦象<br />更说明如何理解</>} body="结合经传出处、典故与通俗解释，形成可回看的思考记录。" top={210} />
      <div style={{position: 'absolute', right: 110, bottom: 73, width: 860, padding: '20px 28px', borderLeft: `3px solid ${C.cinnabar}`, background: 'rgba(5,8,14,.86)', color: '#bdb39f', fontFamily: fontKai, fontSize: 24, lineHeight: 1.55, letterSpacing: 2, opacity: note}}>文化学习与自我反思工具，不作确定性预测，也不替代现实中的专业判断。</div>
    </AbsoluteFill>
  );
};

const ShareScene: React.FC = () => {
  const frame = useCurrentFrame();
  const duration = 180;
  const flip = frame < 62
    ? ease(frame, [28, 62], [0, 192])
    : ease(frame, [62, 76], [192, 180]);
  const bits = '010001';
  return (
    <AbsoluteFill style={{opacity: sceneOpacity(frame, duration)}}>
      <FilmBackground frame={frame + 4350} warm />
      <div style={{position: 'absolute', left: 180, top: 72, width: 650, height: 930, perspective: 1500}}>
        <div style={{position: 'relative', width: '100%', height: '100%', transformStyle: 'preserve-3d', transform: `rotateY(${flip}deg)`}}>
          <div style={{position: 'absolute', inset: 0, backfaceVisibility: 'hidden', borderRadius: 18, border: '1px solid rgba(201,169,106,.38)', background: 'linear-gradient(155deg,#111a2b,#070a12)', boxShadow: '0 35px 110px rgba(0,0,0,.55)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'}}>
            <div style={{fontFamily: fontSong, color: C.gold, fontSize: 26, letterSpacing: 7}}>山水蒙 · 010001</div>
            <div style={{marginTop: 42, display: 'flex', flexDirection: 'column-reverse', gap: 17}}>{bits.split('').map((bit, index) => <div key={index} style={{display: 'flex', gap: 20, width: 290}}>{bit === '1' ? <span style={{width: 290, height: 13, borderRadius: 8, background: C.paleGold}} /> : <><span style={{width: 127, height: 13, borderRadius: 8, background: C.paper}} /><span style={{width: 127, height: 13, borderRadius: 8, background: C.paper}} /></>}</div>)}</div>
            <div style={{marginTop: 42, fontFamily: fontSong, fontSize: 88, color: C.paper}}>蒙</div>
            <div style={{marginTop: 55, padding: '19px 46px', borderRadius: 9, background: C.gold, color: C.ink, fontFamily: fontSong, fontSize: 27, letterSpacing: 4}}>生成分享图片</div>
          </div>
          <div style={{position: 'absolute', inset: 0, backfaceVisibility: 'hidden', transform: 'rotateY(180deg)', overflow: 'hidden', borderRadius: 18, border: '1px solid rgba(201,169,106,.45)', background: '#080d18', boxShadow: '0 35px 110px rgba(0,0,0,.58)'}}>
            <Img src={staticFile('textures/elements/share-share-card-preview-img-0.png')} style={{width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top'}} />
          </div>
        </div>
      </div>
      <div style={{position: 'absolute', right: 0, top: 0, bottom: 0, width: 870, background: 'linear-gradient(270deg,rgba(4,7,13,.98) 18%,rgba(4,7,13,.74) 70%,transparent)'}} />
      <Caption align="right" eyebrow="学习成果分享" title={<>把一卦整理成<br />一张可发送的图片</>} body={<>卦象、卦辞、当下处境与出处<br />自动排成清晰的学习卡片。</>} top={205} />
      <div style={{position: 'absolute', right: 98, bottom: 175, display: 'flex', gap: 16, opacity: ease(frame, [80, 108], [0, 1])}}>
        {['发送图片', '下载 PNG'].map((label) => <div key={label} style={{padding: '15px 28px', borderRadius: 8, border: '1px solid rgba(201,169,106,.38)', background: 'rgba(19,26,42,.9)', color: C.paper, fontFamily: fontSong, fontSize: 25, letterSpacing: 3}}>{label}</div>)}
      </div>
    </AbsoluteFill>
  );
};

const JourneyOverviewScene: React.FC = () => {
  const frame = useCurrentFrame();
  const duration = 330;
  const cards = [
    {label: '探索', note: '星图与卦象关系', file: 'star-detail-detail-panel-0.png'},
    {label: '理解', note: '爻变、卦义与典籍', file: 'evolution-evolution-meaning-0.png'},
    {label: '学习', note: '五阶学程与单课进度', file: 'learning-learning-dashboard-0.png'},
    {label: '检验', note: '小试、抽查与阶考', file: 'quiz-mode-panel-0.png'},
    {label: '记忆', note: '错题回炉与间隔复习', file: 'review-mode-panel-0.png'},
    {label: '应用', note: '黄历、占筮与成果分享', file: 'divination-divine-interpretation-0.png'},
  ];
  return (
    <AbsoluteFill style={{opacity: sceneOpacity(frame, duration)}}>
      <FilmBackground frame={frame + 4530} warm />
      <div style={{position: 'absolute', left: 0, right: 0, top: 82, textAlign: 'center'}}>
        <div style={{fontFamily: fontSong, fontSize: 64, color: C.paper, letterSpacing: 9}}>从第一次看见，到真正学会</div>
        <div style={{marginTop: 16, fontFamily: fontKai, fontSize: 29, color: C.gold, letterSpacing: 5}}>内容、练习、反馈与复习，组成一条完整的学习路径</div>
      </div>
      <div style={{position: 'absolute', left: 112, right: 112, top: 245, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 22}}>
        {cards.map((card, index) => {
          const p = ease(frame, [28 + index * 18, 68 + index * 18], [0, 1]);
          return (
            <div key={card.label} style={{position: 'relative', height: 300, overflow: 'hidden', borderRadius: 14, border: '1px solid rgba(201,169,106,.28)', background: C.blue, boxShadow: '0 24px 70px rgba(0,0,0,.38)', opacity: p, transform: `translateY(${(1 - p) * 34}px)`}}>
              <Img src={staticFile(`textures/elements/${card.file}`)} style={{width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top', filter: 'brightness(.52) saturate(.75)'}} />
              <div style={{position: 'absolute', inset: 0, background: 'linear-gradient(180deg,rgba(5,7,13,.06),rgba(5,7,13,.96) 82%)'}} />
              <div style={{position: 'absolute', left: 28, right: 28, bottom: 24, display: 'flex', alignItems: 'baseline', gap: 18}}>
                <span style={{fontFamily: fontSong, fontSize: 39, color: C.paper, letterSpacing: 5}}>{card.label}</span>
                <span style={{fontFamily: fontKai, fontSize: 23, color: C.gold, letterSpacing: 2}}>{card.note}</span>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 65, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 20, opacity: ease(frame, [174, 224], [0, 1])}}>
        {['看得见', '学得会', '记得住', '用得上'].map((item, index) => (
          <React.Fragment key={item}>
            {index > 0 && <span style={{width: 60, height: 1, background: C.gold, opacity: 0.55}} />}
            <span style={{fontFamily: fontSong, fontSize: 29, color: index === 3 ? C.gold : C.paper, letterSpacing: 5}}>{item}</span>
          </React.Fragment>
        ))}
      </div>
    </AbsoluteFill>
  );
};

const OutroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const duration = 240;
  const p = ease(frame, [8, 54], [0, 1]);
  return (
    <AbsoluteFill style={{opacity: sceneOpacity(frame, duration, 18)}}>
      <FilmBackground frame={frame + 4860} warm />
      <div style={{position: 'absolute', left: 105, top: 105, width: 1710, height: 760, border: '1px solid rgba(201,169,106,.26)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 40px 120px rgba(0,0,0,.48)', opacity: p, transform: `scale(${0.965 + p * 0.035})`}}>
        <Img src={staticFile('textures/raw/star.png')} style={{width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(.54) saturate(.8)'}} />
        <div style={{position: 'absolute', inset: 0, background: 'radial-gradient(circle at 40% 46%, rgba(8,12,20,.12), rgba(5,7,13,.9) 78%)'}} />
      </div>
      <div style={{position: 'absolute', left: 205, top: 282, width: 1120, opacity: p}}>
        <div style={{fontFamily: fontSong, fontSize: 104, letterSpacing: 25, color: C.paper, textShadow: '0 12px 60px rgba(0,0,0,.8)'}}>易象图谱</div>
        <div style={{marginTop: 25, fontFamily: fontKai, fontSize: 34, letterSpacing: 10, color: C.gold}}>让《易经》看得见 · 学得会 · 记得住 · 用得上</div>
        <div style={{marginTop: 36, fontFamily: fontKai, fontSize: 27, lineHeight: 1.7, letterSpacing: 3, color: '#c8bea8'}}>现在，打开星图，开始一段有路径、有检验、能持续的易学探索。</div>
      </div>
      <div style={{position: 'absolute', right: 205, top: 250, width: 265, padding: 18, borderRadius: 14, background: C.paper, boxShadow: '0 25px 80px rgba(0,0,0,.46)', opacity: ease(frame, [48, 88], [0, 1])}}>
        <Img src={staticFile('qr-demo.svg')} style={{display: 'block', width: '100%', height: 'auto'}} />
        <div style={{marginTop: 10, textAlign: 'center', fontFamily: fontSong, fontSize: 20, letterSpacing: 3, color: C.ink}}>扫码在线体验</div>
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 112, display: 'flex', justifyContent: 'center', gap: 20, opacity: ease(frame, [62, 102], [0, 1])}}>
        {['在线体验', 'GitHub 开源项目', 'Windows 一键版'].map((label, index) => <div key={label} style={{padding: '15px 30px', border: `1px solid ${index === 0 ? C.gold : 'rgba(232,217,184,.28)'}`, borderRadius: 7, background: index === 0 ? 'rgba(201,169,106,.15)' : 'rgba(7,10,17,.72)', color: C.paper, fontFamily: fontSong, fontSize: 25, letterSpacing: 4}}>{label}</div>)}
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 53, textAlign: 'center', fontFamily: 'Arial, sans-serif', fontSize: 21, letterSpacing: 2, color: C.muted}}>wyhcipuc.github.io/yijing-atlas · github.com/WYHCIPUC/yijing-atlas</div>
    </AbsoluteFill>
  );
};

const FullSoundtrack: React.FC = () => (
  <>
    <Audio
      src={staticFile('audio/preproduction-v2/direction-b-tapis.mp3')}
      volume={(frame) => interpolate(frame, [0, 45, 4860, 5099], [0, 0.2, 0.2, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}
    />
    <Sequence from={120}>
      <Audio
        src={staticFile('audio/preproduction-v2/mystic-flute-harp-relaxation-05.mp3')}
        volume={(frame) => interpolate(frame, [0, 100, 2700, 3450], [0, 0.075, 0.075, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}
      />
    </Sequence>
    <Sequence from={8}><Audio src={staticFile('audio/preproduction-v2/water-drop-cave.mp3')} volume={0.22} /></Sequence>
    <Sequence from={120}><Audio src={staticFile('audio/sfx/text/marker-pen-line.mp3')} volume={0.13} /></Sequence>
    <Sequence from={360}><Audio src={staticFile('audio/preproduction-v2/wind-pass-vibrate.mp3')} volume={0.12} /></Sequence>
    <Sequence from={1050}><Audio src={staticFile('audio/sfx/transition/transition-soft.mp3')} volume={0.13} /></Sequence>
    <Sequence from={1620}><Audio src={staticFile('audio/sfx/text/marker-pen-line.mp3')} volume={0.12} /></Sequence>
    <Sequence from={1950}><Audio src={staticFile('audio/preproduction-v2/water-drop-cave.mp3')} volume={0.1} /></Sequence>
    <Sequence from={2400}><Audio src={staticFile('audio/sfx/transition/transition-soft.mp3')} volume={0.11} /></Sequence>
    <Sequence from={3690}><Audio src={staticFile('audio/preproduction-v2/machine-activate-short.mp3')} volume={0.09} /></Sequence>
    <Sequence from={3802}><Audio src={staticFile('audio/sfx/mech/mech-tech-movement.mp3')} volume={0.16} /></Sequence>
    <Sequence from={3864}><Audio src={staticFile('audio/sfx/mech/gear-lock-metallic.mp3')} volume={0.24} /></Sequence>
    <Sequence from={3900}><Audio src={staticFile('audio/preproduction-v2/chime-crystal.mp3')} volume={0.08} /></Sequence>
    <Sequence from={4530}><Audio src={staticFile('audio/sfx/transition/transition-soft.mp3')} volume={0.1} /></Sequence>
    <Sequence from={4860}><Audio src={staticFile('audio/preproduction-v2/chime-crystal.mp3')} volume={0.1} /></Sequence>
  </>
);

export type FullPromoV2Props = {bgm: boolean};

export const FullPromoV2: React.FC<FullPromoV2Props> = ({bgm}) => (
  <AbsoluteFill style={{background: C.ink}}>
    <Sequence from={0} durationInFrames={120}><DaoScene /></Sequence>
    <Sequence from={120} durationInFrames={240}><YiScene /></Sequence>
    <Sequence from={360} durationInFrames={180}><AtlasScene /></Sequence>
    <Sequence from={540} durationInFrames={270}><ReadingPainScene /></Sequence>
    <Sequence from={810} durationInFrames={240}><FrictionScene /></Sequence>
    <Sequence from={1050} durationInFrames={330}><StarMapScene /></Sequence>
    <Sequence from={1380} durationInFrames={240}><RelationScene /></Sequence>
    <Sequence from={1620} durationInFrames={330}><EvolutionScene /></Sequence>
    <Sequence from={1950} durationInFrames={240}><ClassicsScene /></Sequence>
    <Sequence from={2190} durationInFrames={210}><BreathScene /></Sequence>
    <Sequence from={2400} durationInFrames={390}><LearningScene /></Sequence>
    <Sequence from={2790} durationInFrames={270}><LessonDetailScene /></Sequence>
    <Sequence from={3060} durationInFrames={330}><AssessmentScene /></Sequence>
    <Sequence from={3390} durationInFrames={300}><ReviewScene /></Sequence>
    <Sequence from={3690} durationInFrames={210}><WheelScene /></Sequence>
    <Sequence from={3900} durationInFrames={210}><AlmanacScene /></Sequence>
    <Sequence from={4110} durationInFrames={240}><DivinationScene /></Sequence>
    <Sequence from={4350} durationInFrames={180}><ShareScene /></Sequence>
    <Sequence from={4530} durationInFrames={330}><JourneyOverviewScene /></Sequence>
    <Sequence from={4860} durationInFrames={240}><OutroScene /></Sequence>
    <Sequence from={1029} durationInFrames={42}><LineCarryOverlay /></Sequence>
    <Sequence from={1598} durationInFrames={44}><YaoBarsOverlay /></Sequence>
    <Sequence from={1923} durationInFrames={54}><InkBleedOverlay /></Sequence>
    <Sequence from={2379} durationInFrames={42}><PaperDoorOverlay /></Sequence>
    <Sequence from={3667} durationInFrames={46}><ApertureOverlay /></Sequence>
    <Sequence from={3876} durationInFrames={48}><ClockWipeOverlay /></Sequence>
    {bgm && <FullSoundtrack />}
  </AbsoluteFill>
);
