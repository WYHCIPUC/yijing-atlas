import React from 'react';
import { AbsoluteFill, Sequence } from 'remotion';
import { TeaserAudio } from './audio';
import {
  AlmanacScene,
  AssessmentScene,
  EvolutionScene,
  LearningScene,
  OpeningScene,
  StarMapScene,
  TeaserOutroScene,
  TeaserPosterScene,
} from './scenes';
import { theme } from './theme';
import { TEASER_SHOTS } from './timing';
import type { PromoProps } from './types';

export const Teaser: React.FC<PromoProps> = ({ bgm }) => (
  <AbsoluteFill style={{ background: theme.ink }}>
    <Sequence from={TEASER_SHOTS.hook.from} durationInFrames={TEASER_SHOTS.hook.duration}><TeaserPosterScene duration={TEASER_SHOTS.hook.duration} /></Sequence>
    <Sequence from={TEASER_SHOTS.opening.from} durationInFrames={TEASER_SHOTS.opening.duration}><OpeningScene duration={TEASER_SHOTS.opening.duration} vertical /></Sequence>
    <Sequence from={TEASER_SHOTS.starMap.from} durationInFrames={TEASER_SHOTS.starMap.duration}><StarMapScene duration={TEASER_SHOTS.starMap.duration} vertical /></Sequence>
    <Sequence from={TEASER_SHOTS.evolution.from} durationInFrames={TEASER_SHOTS.evolution.duration}><EvolutionScene duration={TEASER_SHOTS.evolution.duration} vertical /></Sequence>
    <Sequence from={TEASER_SHOTS.almanac.from} durationInFrames={TEASER_SHOTS.almanac.duration}><AlmanacScene duration={TEASER_SHOTS.almanac.duration} vertical /></Sequence>
    <Sequence from={TEASER_SHOTS.learning.from} durationInFrames={TEASER_SHOTS.learning.duration}><LearningScene duration={TEASER_SHOTS.learning.duration} vertical /></Sequence>
    <Sequence from={TEASER_SHOTS.assessment.from} durationInFrames={TEASER_SHOTS.assessment.duration}><AssessmentScene duration={TEASER_SHOTS.assessment.duration} vertical /></Sequence>
    <Sequence from={TEASER_SHOTS.outro.from} durationInFrames={TEASER_SHOTS.outro.duration}><TeaserOutroScene duration={TEASER_SHOTS.outro.duration} /></Sequence>
    <TeaserAudio bgm={bgm} />
  </AbsoluteFill>
);
