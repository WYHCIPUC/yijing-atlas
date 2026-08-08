export const FPS = 30;

export type Shot = {
  from: number;
  duration: number;
};

export const SHOTS = {
  hook: { from: 0, duration: 135 },
  opening: { from: 135, duration: 195 },
  starMap: { from: 330, duration: 360 },
  evolution: { from: 690, duration: 345 },
  wheel: { from: 1035, duration: 300 },
  almanac: { from: 1335, duration: 300 },
  breath: { from: 1635, duration: 150 },
  learning: { from: 1785, duration: 450 },
  assessment: { from: 2235, duration: 330 },
  divination: { from: 2565, duration: 300 },
  outro: { from: 2865, duration: 135 },
} as const satisfies Record<string, Shot>;

export const MAIN_DURATION = 3000;
export const TEASER_DURATION = 900;

// House Vibez measures at 123.04 BPM with an onset phase of 0.081s. It is played
// at 0.975293× so the effective tempo is exactly 120 BPM: one beat every 15
// frames and every authored shot boundary lands on a full beat.
export const BEAT0 = 0;
export const BEAT_INTERVAL = 0.5;
export const beatF = (beat: number) => Math.round((BEAT0 + beat * BEAT_INTERVAL) * FPS);

export const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export const localProgress = (frame: number, duration: number) =>
  clamp01(frame / Math.max(1, duration - 1));
