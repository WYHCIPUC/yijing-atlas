// 银河是氛围层；六十四卦的位置与含义仍由 star-layouts 决定。
export function createSkyRandom(seed = 0x51a7f19d) {
  let value = seed >>> 0;
  return () => {
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    return (value >>> 0) / 4294967296;
  };
}

function hash(x, y) {
  let value = Math.imul(x, 374761393) + Math.imul(y, 668265263);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
}

function noise(x, y) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const dx = x - ix;
  const dy = y - iy;
  const sx = dx * dx * (3 - 2 * dx);
  const sy = dy * dy * (3 - 2 * dy);
  const top = hash(ix, iy) * (1 - sx) + hash(ix + 1, iy) * sx;
  const bottom = hash(ix, iy + 1) * (1 - sx) + hash(ix + 1, iy + 1) * sx;
  return top * (1 - sy) + bottom * sy;
}

function cloudNoise(x, y) {
  let value = 0;
  let weight = 0.52;
  for (let octave = 0; octave < 5; octave += 1) {
    value += noise(x, y) * weight;
    x = x * 2.03 + 17.1;
    y = y * 2.03 + 9.2;
    weight *= 0.5;
  }
  return value;
}

export function galaxyBandY(x) {
  return 0.72 - x * 0.52 + Math.sin(x * 5.4) * 0.035;
}

// 只在初始化/尺寸改变时计算，最大约 2 MB；每帧复用 Canvas 纹理。
export function createGalaxyTexture(viewWidth, viewHeight) {
  if (!Number.isFinite(viewWidth) || !Number.isFinite(viewHeight)
    || viewWidth <= 0 || viewHeight <= 0) return null;
  const scale = Math.min(1, 960 / viewWidth, 540 / viewHeight);
  const width = Math.max(1, Math.round(viewWidth * scale));
  const height = Math.max(1, Math.round(viewHeight * scale));
  const pixels = new Uint8ClampedArray(width * height * 4);
  const aspect = width / height;

  for (let y = 0; y < height; y += 1) {
    const ny = y / height;
    for (let x = 0; x < width; x += 1) {
      const nx = x / width;
      const px = nx * aspect;
      const warp = noise(px * 3.2 + 11, ny * 3.2 + 7) - 0.5;
      const distance = ny - galaxyBandY(nx) + warp * 0.075;
      const cloud = cloudNoise(px * 5.8 + 31, ny * 5.8 + 19);
      const detail = noise(px * 105 + 3, ny * 105 + 43);
      const envelope = Math.exp(-Math.pow(distance / 0.115, 2));
      const outer = Math.exp(-Math.pow(distance / 0.24, 2));
      const core = Math.exp(-Math.pow((nx - 0.63) / 0.3, 2));
      // 不规则暗尘带切开亮云；避免一条均匀的渐变光带。
      const dust = Math.exp(-Math.pow((distance + (cloud - 0.48) * 0.13) / 0.026, 2));
      const light = envelope * Math.pow(cloud, 1.65) * (0.6 + core * 0.65)
        * (1 - dust * 0.92) * (0.82 + detail * 0.3);
      const haze = outer * cloud * 0.5;
      const edge = Math.max(0.38, 1 - Math.hypot(nx - 0.5, ny - 0.5) * 0.55);
      const offset = (y * width + x) * 4;
      pixels[offset] = (3 + light * (94 + core * 30) + haze * 9) * edge;
      pixels[offset + 1] = (5 + light * (107 - core * 4) + haze * 15) * edge;
      pixels[offset + 2] = (10 + light * (140 - core * 48) + haze * 29) * edge;
      pixels[offset + 3] = 255;
    }
  }
  return { width, height, pixels };
}
