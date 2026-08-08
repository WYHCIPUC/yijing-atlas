import React from 'react';
import { AbsoluteFill, Sequence } from 'remotion';
import { TeaserAudio } from './audio';
import { EvolutionScene, HookScene, LearningScene, OpeningScene, OutroScene, StarMapScene, WheelScene } from './scenes';
import { theme } from './theme';
import type { PromoProps } from './types';

export const Teaser: React.FC<PromoProps> = ({ bgm }) => (
  <AbsoluteFill style={{ background: theme.ink }}>
    <Sequence from={0} durationInFrames={90}><HookScene duration={90} vertical /></Sequence>
    <Sequence from={90} durationInFrames={90}><OpeningScene duration={90} vertical /></Sequence>
    <Sequence from={180} durationInFrames={150}><StarMapScene duration={150} vertical /></Sequence>
    <Sequence from={330} durationInFrames={150}><EvolutionScene duration={150} vertical /></Sequence>
    <Sequence from={480} durationInFrames={120}><WheelScene duration={120} vertical /></Sequence>
    <Sequence from={600} durationInFrames={150}><LearningScene duration={150} vertical /></Sequence>
    <Sequence from={750} durationInFrames={150}><OutroScene duration={150} vertical /></Sequence>
    <TeaserAudio bgm={bgm} />
  </AbsoluteFill>
);
