import React from 'react';
import {Composition} from 'remotion';
import {FULL_DURATION, FULL_FPS, FullPromoV2} from './FullPromoV2';
import {OpeningMotionTestRoot} from './OpeningMotionTest';
import {
  DOUYIN_DURATION,
  DOUYIN_FPS,
  DOUYIN_SHORT_DURATION,
  DouyinCover,
  DouyinShort,
  DouyinShortCover,
  DouyinTrailer,
} from './DouyinTrailer';

export const PreproductionRoot: React.FC = () => (
  <>
    <Composition
      id="YijingAtlasPromoV2"
      component={FullPromoV2}
      width={1920}
      height={1080}
      fps={FULL_FPS}
      durationInFrames={FULL_DURATION}
      defaultProps={{bgm: true}}
    />
    <Composition
      id="YijingAtlasDouyinTrailer"
      component={DouyinTrailer}
      width={1920}
      height={1080}
      fps={DOUYIN_FPS}
      durationInFrames={DOUYIN_DURATION}
      defaultProps={{bgm: true}}
    />
    <Composition
      id="YijingAtlasDouyinCover"
      component={DouyinCover}
      width={1920}
      height={1080}
      fps={DOUYIN_FPS}
      durationInFrames={1}
    />
    <Composition
      id="YijingAtlasDouyinShort"
      component={DouyinShort}
      width={1920}
      height={1080}
      fps={DOUYIN_FPS}
      durationInFrames={DOUYIN_SHORT_DURATION}
      defaultProps={{bgm: true}}
    />
    <Composition
      id="YijingAtlasDouyinShortCover"
      component={DouyinShortCover}
      width={1920}
      height={1080}
      fps={DOUYIN_FPS}
      durationInFrames={1}
    />
    <OpeningMotionTestRoot />
  </>
);
