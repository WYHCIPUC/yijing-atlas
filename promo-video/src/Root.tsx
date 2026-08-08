import React from 'react';
import { Composition } from 'remotion';
import { MainPromo } from './MainPromo';
import { Teaser } from './Teaser';
import { FPS, MAIN_DURATION, TEASER_DURATION } from './timing';
import { defaultPromoProps, type PromoProps } from './types';

export const Root: React.FC = () => (
  <>
    <Composition
      id="YijingAtlasPromo"
      component={MainPromo}
      durationInFrames={MAIN_DURATION}
      fps={FPS}
      width={1920}
      height={1080}
      defaultProps={defaultPromoProps}
    />
    <Composition
      id="YijingAtlasTeaser"
      component={Teaser}
      durationInFrames={TEASER_DURATION}
      fps={FPS}
      width={1080}
      height={1920}
      defaultProps={defaultPromoProps}
    />
  </>
);
