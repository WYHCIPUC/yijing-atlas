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
import { theme } from './theme';

const fade = (frame: number, duration: number, edge = 18) =>
  interpolate(frame, [0, edge, duration - edge, duration], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

export const Vignette: React.FC<{ strength?: number }> = ({ strength = 0.72 }) => (
  <AbsoluteFill
    style={{
      pointerEvents: 'none',
      background: `radial-gradient(100% 88% at 50% 48%, transparent 42%, rgba(3,6,14,${strength}) 100%)`,
    }}
  />
);

export const Grain: React.FC = () => (
  <AbsoluteFill
    style={{
      opacity: 0.12,
      mixBlendMode: 'soft-light',
      pointerEvents: 'none',
      backgroundImage:
        'repeating-linear-gradient(0deg, rgba(255,255,255,.06) 0, rgba(255,255,255,.06) 1px, transparent 1px, transparent 3px)',
    }}
  />
);

export const PageTexture: React.FC<{
  name: string;
  scale?: number;
  x?: number;
  y?: number;
  rotateX?: number;
  rotateY?: number;
  opacity?: number;
  radius?: number;
  contain?: boolean;
}> = ({
  name,
  scale = 1,
  x = 0,
  y = 0,
  rotateX = 0,
  rotateY = 0,
  opacity = 1,
  radius = 22,
  contain = false,
}) => (
  <AbsoluteFill style={{ perspective: 1600, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
    <div
      style={{
        position: 'absolute',
        inset: contain ? 54 : -2,
        overflow: 'hidden',
        borderRadius: radius,
        border: `1px solid rgba(201,169,106,${contain ? 0.36 : 0.16})`,
        boxShadow: contain ? '0 42px 110px rgba(0,0,0,.5)' : undefined,
        transformStyle: 'preserve-3d',
        transform: `translate3d(${x}px, ${y}px, 0) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(${scale})`,
        opacity,
        background: theme.ink,
      }}
    >
      <Img
        src={staticFile(`textures/${name}.webp`)}
        style={{ width: '100%', height: '100%', display: 'block', objectFit: 'cover' }}
      />
    </div>
  </AbsoluteFill>
);

export const Caption: React.FC<{
  children: React.ReactNode;
  duration: number;
  kicker?: string;
  vertical?: boolean;
}> = ({ children, duration, kicker, vertical = false }) => {
  const frame = useCurrentFrame();
  const opacity = fade(frame, duration, 16);
  const rise = interpolate(frame, [0, 20], [28, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  return (
    <div
      style={{
        position: 'absolute',
        left: vertical ? 68 : 118,
        right: vertical ? 68 : 118,
        bottom: vertical ? 230 : 68,
        zIndex: 20,
        opacity,
        transform: `translateY(${rise}px)`,
        textShadow: '0 4px 28px rgba(0,0,0,.9)',
      }}
    >
      {kicker ? (
        <div style={{ color: theme.gold, fontFamily: theme.mono, fontSize: 32, letterSpacing: '0.22em', marginBottom: 10 }}>
          {kicker}
        </div>
      ) : null}
      <div
        style={{
          color: theme.text,
          fontFamily: theme.serif,
          fontSize: vertical ? 58 : 66,
          lineHeight: 1.28,
          letterSpacing: '0.035em',
          fontWeight: 650,
          maxWidth: vertical ? 920 : 1440,
        }}
      >
        {children}
      </div>
    </div>
  );
};

export const GoldRule: React.FC<{ progress: number; width?: number }> = ({ progress, width = 260 }) => (
  <div
    style={{
      width,
      height: 3,
      background: `linear-gradient(90deg, transparent, ${theme.gold}, transparent)`,
      transform: `scaleX(${progress})`,
      transformOrigin: 'center',
      boxShadow: `0 0 22px ${theme.gold}`,
    }}
  />
);

export const HexagramLines: React.FC<{
  code: string;
  changing?: number[];
  width?: number;
  gap?: number;
}> = ({ code, changing = [], width = 360, gap = 24 }) => (
  <div style={{ display: 'flex', flexDirection: 'column-reverse', gap }}>
    {code.split('').map((bit, index) => {
      const active = changing.includes(index + 1);
      return (
        <div key={`${bit}-${index}`} style={{ display: 'flex', gap: bit === '0' ? width * 0.14 : 0, filter: active ? `drop-shadow(0 0 16px ${theme.gold})` : undefined }}>
          {bit === '1' ? (
            <div style={{ width, height: 22, borderRadius: 4, background: active ? theme.goldBright : theme.paper }} />
          ) : (
            <>
              <div style={{ width: width * 0.43, height: 22, borderRadius: 4, background: active ? theme.goldBright : theme.paper }} />
              <div style={{ width: width * 0.43, height: 22, borderRadius: 4, background: active ? theme.goldBright : theme.paper }} />
            </>
          )}
        </div>
      );
    })}
  </div>
);

const wheelNames = [
  '乾','坤','屯','蒙','需','讼','师','比','小畜','履','泰','否','同人','大有','谦','豫',
  '随','蛊','临','观','噬嗑','贲','剥','复','无妄','大畜','颐','大过','坎','离','咸','恒',
  '遯','大壮','晋','明夷','家人','睽','蹇','解','损','益','夬','姤','萃','升','困','井',
  '革','鼎','震','艮','渐','归妹','丰','旅','巽','兑','涣','节','中孚','小过','既济','未济',
];

export const MechanicalWheel: React.FC<{
  duration: number;
  vertical?: boolean;
}> = ({ duration, vertical = false }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const rotate = interpolate(frame, [0, duration * 0.18, duration * 0.72, duration * 0.9], [0, 110, 1540, 1734], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.18, 0.8, 0.16, 1),
  });
  const settle = spring({
    frame: frame - Math.round(duration * 0.86),
    fps,
    config: { damping: 13, stiffness: 140, mass: 0.8 },
    durationInFrames: Math.round(duration * 0.14),
  });
  const size = vertical ? 780 : 690;
  return (
    <div style={{ position: 'relative', width: size, height: size, filter: 'drop-shadow(0 42px 70px rgba(0,0,0,.62))' }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          border: `10px solid ${theme.gold}`,
          background: 'radial-gradient(circle, #222b43 0 22%, #10172a 23% 62%, #080c17 63% 100%)',
          boxShadow: `inset 0 0 0 5px rgba(232,217,184,.16), inset 0 0 70px rgba(201,169,106,.2), 0 0 44px rgba(201,169,106,.16)`,
          transform: `rotate(${rotate + settle * 2.5}deg)`,
        }}
      >
        {wheelNames.map((name, index) => {
          const angle = index * 360 / wheelNames.length;
          return (
            <div
              key={name}
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                width: 32,
                height: size * 0.47,
                transformOrigin: '50% 0',
                transform: `rotate(${angle}deg) translateY(-${size * 0.44}px)`,
                color: index % 8 === 0 ? theme.goldBright : 'rgba(232,217,184,.72)',
                fontFamily: theme.kai,
                fontSize: index % 8 === 0 ? 23 : 15,
                textAlign: 'center',
              }}
            >
              {name}
            </div>
          );
        })}
        <div style={{ position: 'absolute', inset: '37%', borderRadius: '50%', border: `2px solid ${theme.gold}`, background: '#111a2d', display: 'grid', placeItems: 'center', color: theme.goldBright, fontFamily: theme.kai, fontSize: 42, boxShadow: '0 0 24px rgba(201,169,106,.28)' }}>
          卦序
        </div>
      </div>
      <div style={{ position: 'absolute', left: '50%', top: -18, width: 0, height: 0, borderLeft: '22px solid transparent', borderRight: '22px solid transparent', borderTop: `56px solid ${theme.goldBright}`, transform: 'translateX(-50%)', filter: `drop-shadow(0 0 12px ${theme.gold})` }} />
    </div>
  );
};

export const ScreenFrame: React.FC<{
  name: string;
  width: number;
  height: number;
  rotate?: number;
}> = ({ name, width, height, rotate = 0 }) => (
  <div style={{ width, height, borderRadius: 24, overflow: 'hidden', border: '1px solid rgba(201,169,106,.4)', boxShadow: '0 30px 70px rgba(0,0,0,.48)', transform: `rotate(${rotate}deg)`, background: theme.ink }}>
    <Img src={staticFile(`textures/${name}.webp`)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
  </div>
);

export const pulseOpacity = (frame: number, start: number, end: number) =>
  interpolate(frame, [start, start + 12, end - 12, end], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
