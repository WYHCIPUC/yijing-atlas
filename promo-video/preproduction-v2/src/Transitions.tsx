import React from 'react';
import {AbsoluteFill, Easing, interpolate, useCurrentFrame} from 'remotion';

const INK = '#05070d';
const GOLD = '#c9a96a';
const PAPER = '#e8d9b8';

const tween = (frame: number, input: [number, number], output: [number, number], easing = Easing.inOut(Easing.cubic)) =>
  interpolate(frame, input, output, {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing,
  });

export const LineCarryOverlay: React.FC<{duration?: number}> = ({duration = 42}) => {
  const frame = useCurrentFrame();
  const mid = duration / 2;
  const x = frame <= mid
    ? tween(frame, [0, mid], [-1920, 0])
    : tween(frame, [mid, duration], [0, 1920]);
  const lineX = frame <= mid ? x + 1914 : x;
  return (
    <AbsoluteFill style={{pointerEvents: 'none', overflow: 'hidden', zIndex: 50}}>
      <div style={{position: 'absolute', inset: 0, width: 1920, background: INK, transform: `translateX(${x}px)`, boxShadow: '0 0 90px rgba(0,0,0,.7)'}} />
      <div style={{position: 'absolute', top: 0, bottom: 0, left: lineX, width: 6, background: GOLD, boxShadow: `0 0 28px ${GOLD}`}} />
      <div style={{position: 'absolute', left: lineX - 8, top: 534, width: 22, height: 22, borderRadius: '50%', background: PAPER, boxShadow: `0 0 32px ${GOLD}`}} />
    </AbsoluteFill>
  );
};

export const YaoBarsOverlay: React.FC<{duration?: number}> = ({duration = 44}) => {
  const frame = useCurrentFrame();
  const mid = duration / 2;
  return (
    <AbsoluteFill style={{pointerEvents: 'none', overflow: 'hidden', zIndex: 50}}>
      {Array.from({length: 6}, (_, index) => {
        const delay = index * 1.2;
        const cover = frame <= mid
          ? tween(frame, [delay, mid], [0, 1], Easing.out(Easing.cubic))
          : tween(frame, [mid, duration - delay], [1, 0], Easing.in(Easing.cubic));
        const fromLeft = index % 2 === 0;
        return (
          <div key={index} style={{position: 'absolute', top: index * 180, left: fromLeft ? 0 : undefined, right: fromLeft ? undefined : 0, width: `${cover * 100}%`, height: 181, background: index === 2 || index === 3 ? '#080c16' : INK, borderTop: '1px solid rgba(201,169,106,.22)', borderBottom: '1px solid rgba(201,169,106,.14)', boxShadow: cover > .94 ? 'inset 0 0 45px rgba(201,169,106,.035)' : undefined}} />
        );
      })}
    </AbsoluteFill>
  );
};

export const InkBleedOverlay: React.FC<{duration?: number}> = ({duration = 54}) => {
  const frame = useCurrentFrame();
  const mid = duration / 2;
  const cover = frame <= mid
    ? tween(frame, [0, mid], [0, 1], Easing.out(Easing.quad))
    : tween(frame, [mid, duration], [1, 0], Easing.in(Easing.quad));
  const radius = cover * 1500 * (1 + Math.sin(frame * .32) * .035 * (1 - cover));
  const displacement = 55 + cover * 105;
  if (cover < 0.002) return null;
  return (
    <AbsoluteFill style={{pointerEvents: 'none', zIndex: 50}}>
      <svg width={1920} height={1080} style={{position: 'absolute', inset: 0}}>
        <defs>
          <filter id="promoInkBleed" x="-35%" y="-35%" width="170%" height="170%">
            <feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="3" seed="17" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale={displacement} xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
        <circle cx={930} cy={510} r={radius} fill={INK} filter="url(#promoInkBleed)" />
        <circle cx={930} cy={510} r={Math.max(0, radius - 42)} fill="none" stroke={GOLD} strokeOpacity={0.12} strokeWidth={2} />
      </svg>
    </AbsoluteFill>
  );
};

export const PaperDoorOverlay: React.FC<{duration?: number}> = ({duration = 42}) => {
  const frame = useCurrentFrame();
  const mid = duration / 2;
  const close = frame <= mid
    ? tween(frame, [0, mid], [0, 1])
    : tween(frame, [mid, duration], [1, 0]);
  return (
    <AbsoluteFill style={{pointerEvents: 'none', zIndex: 50, perspective: 1600, overflow: 'hidden'}}>
      <div style={{position: 'absolute', left: 0, top: 0, width: 960, height: 1080, background: 'linear-gradient(90deg,#070a12,#111727)', transformOrigin: 'left center', transform: `translateX(${(-1 + close) * 960}px) rotateY(${(1 - close) * -12}deg)`, boxShadow: '18px 0 55px rgba(0,0,0,.65)', borderRight: `2px solid rgba(201,169,106,${close * .5})`}} />
      <div style={{position: 'absolute', right: 0, top: 0, width: 960, height: 1080, background: 'linear-gradient(270deg,#070a12,#111727)', transformOrigin: 'right center', transform: `translateX(${(1 - close) * 960}px) rotateY(${(1 - close) * 12}deg)`, boxShadow: '-18px 0 55px rgba(0,0,0,.65)', borderLeft: `2px solid rgba(201,169,106,${close * .5})`}} />
    </AbsoluteFill>
  );
};

export const ApertureOverlay: React.FC<{duration?: number}> = ({duration = 46}) => {
  const frame = useCurrentFrame();
  const mid = duration / 2;
  const cover = frame <= mid
    ? tween(frame, [0, mid], [0, 1], Easing.inOut(Easing.cubic))
    : tween(frame, [mid, duration], [1, 0], Easing.inOut(Easing.cubic));
  const radius = cover * 1320;
  return (
    <AbsoluteFill style={{pointerEvents: 'none', zIndex: 50, overflow: 'hidden'}}>
      <div style={{position: 'absolute', left: 960 - radius, top: 540 - radius, width: radius * 2, height: radius * 2, borderRadius: '50%', background: INK, border: `2px solid rgba(201,169,106,${cover * .52})`, boxShadow: '0 0 100px rgba(0,0,0,.8)'}} />
      {Array.from({length: 8}, (_, index) => (
        <div key={index} style={{position: 'absolute', left: 959, top: 539, width: radius, height: 2, transformOrigin: '0 50%', transform: `rotate(${index * 45 + frame * .7}deg)`, background: `linear-gradient(90deg, rgba(201,169,106,.72), rgba(201,169,106,0))`, opacity: cover}} />
      ))}
    </AbsoluteFill>
  );
};

const fanClip = (theta: number) => {
  const cx = 960;
  const cy = 540;
  const radius = 1400;
  const points = [`${cx}px ${cy}px`];
  for (let index = 0; index <= 72; index += 1) {
    const angle = theta * index / 72 * Math.PI / 180;
    points.push(`${(cx + radius * Math.sin(angle)).toFixed(1)}px ${(cy - radius * Math.cos(angle)).toFixed(1)}px`);
  }
  return `polygon(${points.join(',')})`;
};

export const ClockWipeOverlay: React.FC<{duration?: number}> = ({duration = 48}) => {
  const frame = useCurrentFrame();
  const mid = duration / 2;
  const theta = frame <= mid ? tween(frame, [0, mid], [0, 360], Easing.linear) : 360;
  const out = tween(frame, [mid, duration], [1, 0], Easing.out(Easing.cubic));
  const angle = theta * Math.PI / 180;
  const x2 = 960 + 1400 * Math.sin(angle);
  const y2 = 540 - 1400 * Math.cos(angle);
  return (
    <AbsoluteFill style={{pointerEvents: 'none', zIndex: 50}}>
      <div style={{position: 'absolute', inset: 0, background: INK, clipPath: fanClip(theta), opacity: frame <= mid ? 1 : out}} />
      {frame < duration - 4 && <svg width={1920} height={1080} style={{position: 'absolute', inset: 0, opacity: frame <= mid ? 1 : out}}><line x1={960} y1={540} x2={x2} y2={y2} stroke="rgba(201,169,106,.18)" strokeWidth={24} strokeLinecap="round" /><line x1={960} y1={540} x2={x2} y2={y2} stroke={GOLD} strokeWidth={4} strokeLinecap="round" /></svg>}
    </AbsoluteFill>
  );
};
