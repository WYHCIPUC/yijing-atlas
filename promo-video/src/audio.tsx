import React from 'react';
import { Audio, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { MAIN_DURATION, SHOTS, TEASER_DURATION, TEASER_SHOTS } from './timing';

type SoundCue = {
  from: number;
  file: string;
  volume: number;
  duration?: number;
};

const mainSfx: SoundCue[] = [
  { from: SHOTS.hook.from, file: 'transition/sweep-fast.mp3', volume: 0.34 },
  { from: SHOTS.hook.from + 12, file: 'transition/sweep-fast.mp3', volume: 0.28 },
  { from: SHOTS.hook.from + 24, file: 'transition/sweep-fast.mp3', volume: 0.24 },
  { from: SHOTS.opening.from, file: 'transition/transition-soft.mp3', volume: 0.42 },
  { from: SHOTS.opening.from + 70, file: 'light/shimmer-sparkle-sweep.mp3', volume: 0.75, duration: 100 },
  { from: SHOTS.starMap.from, file: 'transition/transition-soft.mp3', volume: 0.32 },
  { from: SHOTS.evolution.from, file: 'paper/paper-page-turn-big.mp3', volume: 0.38 },
  { from: SHOTS.evolution.from + 126, file: 'text/marker-pen-line.mp3', volume: 0.34 },
  { from: SHOTS.wheel.from, file: 'mech/mech-tech-movement.mp3', volume: 0.28, duration: 260 },
  { from: SHOTS.wheel.from + 252, file: 'mech/gear-lock-metallic.mp3', volume: 0.52 },
  { from: SHOTS.almanac.from, file: 'paper/paper-slide.mp3', volume: 0.34 },
  { from: SHOTS.breath.from, file: 'paper/paper-page-turn-big.mp3', volume: 0.30 },
  { from: SHOTS.learning.from, file: 'transition/transition-soft.mp3', volume: 0.34 },
  { from: SHOTS.assessment.from + 40, file: 'camera/click-camera.mp3', volume: 0.38 },
  { from: SHOTS.assessment.from + 96, file: 'camera/click-camera.mp3', volume: 0.34 },
  { from: SHOTS.assessment.from + 152, file: 'camera/click-camera.mp3', volume: 0.30 },
  { from: SHOTS.divination.from + 28, file: 'mech/metal-drop-scifi-small.mp3', volume: 0.40, duration: 100 },
  { from: SHOTS.outro.from, file: 'transition/transition-soft.mp3', volume: 0.38, duration: 110 },
  { from: SHOTS.outro.from + 45, file: 'impact/impact-deep-whoosh.mp3', volume: 0.56 },
  { from: SHOTS.outro.from + 78, file: 'light/shimmer-sparkle-sweep.mp3', volume: 0.75, duration: 57 },
];

const teaserSfx: SoundCue[] = [
  { from: TEASER_SHOTS.hook.from, file: 'transition/sweep-fast.mp3', volume: 0.34, duration: 60 },
  { from: TEASER_SHOTS.hook.from + 15, file: 'transition/sweep-fast.mp3', volume: 0.24, duration: 54 },
  { from: TEASER_SHOTS.opening.from, file: 'light/shimmer-sparkle-sweep.mp3', volume: 0.72, duration: 90 },
  { from: TEASER_SHOTS.starMap.from, file: 'transition/transition-soft.mp3', volume: 0.34, duration: 84 },
  { from: TEASER_SHOTS.evolution.from, file: 'paper/paper-page-turn-big.mp3', volume: 0.36, duration: 92 },
  { from: TEASER_SHOTS.evolution.from + 60, file: 'text/marker-pen-line.mp3', volume: 0.30, duration: 54 },
  { from: TEASER_SHOTS.almanac.from, file: 'paper/paper-slide.mp3', volume: 0.34, duration: 82 },
  { from: TEASER_SHOTS.learning.from, file: 'transition/transition-soft.mp3', volume: 0.32, duration: 82 },
  { from: TEASER_SHOTS.assessment.from + 18, file: 'camera/click-camera.mp3', volume: 0.34, duration: 28 },
  { from: TEASER_SHOTS.assessment.from + 46, file: 'camera/click-camera.mp3', volume: 0.30, duration: 28 },
  { from: TEASER_SHOTS.assessment.from + 74, file: 'camera/click-camera.mp3', volume: 0.28, duration: 28 },
  { from: TEASER_SHOTS.outro.from, file: 'transition/transition-soft.mp3', volume: 0.36, duration: 110 },
  { from: TEASER_SHOTS.outro.from + 45, file: 'impact/impact-deep-whoosh.mp3', volume: 0.54, duration: 72 },
  { from: TEASER_SHOTS.outro.from + 78, file: 'light/shimmer-sparkle-sweep.mp3', volume: 0.75, duration: 64 },
];

const Music: React.FC<{ duration: number }> = ({ duration }) => {
  const frame = useCurrentFrame();
  const fadeIn = Math.min(1, frame / 30);
  const fadeOut = Math.min(1, (duration - frame) / 50);
  const sparkleFrames = duration === MAIN_DURATION
    ? [SHOTS.opening.from + 70, SHOTS.outro.from + 78]
    : [TEASER_SHOTS.opening.from, TEASER_SHOTS.outro.from + 78];
  const duck = sparkleFrames.reduce((current, cue) => Math.min(current, interpolate(
    frame,
    [cue - 18, cue - 8, cue + 35, cue + 48],
    [1, 0.28, 0.28, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  )), 1);
  return (
    <Audio
      src={staticFile('audio/bgm/house-vibez.mp3')}
      startFrom={2}
      playbackRate={0.975293}
      volume={0.3 * fadeIn * fadeOut * duck}
    />
  );
};

const SoundTable: React.FC<{ cues: SoundCue[] }> = ({ cues }) => (
  <>
    {cues.map((cue, index) => (
      <Sequence key={`${cue.from}-${cue.file}-${index}`} from={cue.from} durationInFrames={cue.duration ?? 90} layout="none">
        <Audio src={staticFile(`audio/sfx/${cue.file}`)} volume={cue.volume} />
      </Sequence>
    ))}
  </>
);

export const MainAudio: React.FC<{ bgm: boolean }> = ({ bgm }) => (
  <>
    {bgm ? <Music duration={MAIN_DURATION} /> : null}
    <SoundTable cues={mainSfx} />
  </>
);

export const TeaserAudio: React.FC<{ bgm: boolean }> = ({ bgm }) => (
  <>
    {bgm ? <Music duration={TEASER_DURATION} /> : null}
    <SoundTable cues={teaserSfx} />
  </>
);
