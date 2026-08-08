import React from 'react';
import { AbsoluteFill, Sequence } from 'remotion';
import { MainAudio } from './audio';
import {
  AlmanacScene,
  AssessmentScene,
  BreathScene,
  DivinationScene,
  EvolutionScene,
  HookScene,
  LearningScene,
  OpeningScene,
  OutroScene,
  StarMapScene,
  WheelScene,
} from './scenes';
import { SHOTS } from './timing';
import { theme } from './theme';
import type { PromoProps } from './types';

export const MainPromo: React.FC<PromoProps> = ({ bgm }) => (
  <AbsoluteFill style={{ background: theme.ink }}>
    <Sequence from={SHOTS.hook.from} durationInFrames={SHOTS.hook.duration}><HookScene duration={SHOTS.hook.duration} /></Sequence>
    <Sequence from={SHOTS.opening.from} durationInFrames={SHOTS.opening.duration}><OpeningScene duration={SHOTS.opening.duration} /></Sequence>
    <Sequence from={SHOTS.starMap.from} durationInFrames={SHOTS.starMap.duration}><StarMapScene duration={SHOTS.starMap.duration} /></Sequence>
    <Sequence from={SHOTS.evolution.from} durationInFrames={SHOTS.evolution.duration}><EvolutionScene duration={SHOTS.evolution.duration} /></Sequence>
    <Sequence from={SHOTS.wheel.from} durationInFrames={SHOTS.wheel.duration}><WheelScene duration={SHOTS.wheel.duration} /></Sequence>
    <Sequence from={SHOTS.almanac.from} durationInFrames={SHOTS.almanac.duration}><AlmanacScene duration={SHOTS.almanac.duration} /></Sequence>
    <Sequence from={SHOTS.breath.from} durationInFrames={SHOTS.breath.duration}><BreathScene duration={SHOTS.breath.duration} /></Sequence>
    <Sequence from={SHOTS.learning.from} durationInFrames={SHOTS.learning.duration}><LearningScene duration={SHOTS.learning.duration} /></Sequence>
    <Sequence from={SHOTS.assessment.from} durationInFrames={SHOTS.assessment.duration}><AssessmentScene duration={SHOTS.assessment.duration} /></Sequence>
    <Sequence from={SHOTS.divination.from} durationInFrames={SHOTS.divination.duration}><DivinationScene duration={SHOTS.divination.duration} /></Sequence>
    <Sequence from={SHOTS.outro.from} durationInFrames={SHOTS.outro.duration}><OutroScene duration={SHOTS.outro.duration} /></Sequence>
    <MainAudio bgm={bgm} />
  </AbsoluteFill>
);
