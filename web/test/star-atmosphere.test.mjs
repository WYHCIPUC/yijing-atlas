import assert from 'node:assert/strict';
import test from 'node:test';
import { createGalaxyTexture, createSkyRandom } from '../js/star-atmosphere.js';

test('银河纹理可重复生成，调整窗口不会随机更换星空', () => {
  const first = createGalaxyTexture(320, 180);
  const second = createGalaxyTexture(320, 180);
  assert.deepEqual(first, second);
  const random = createSkyRandom();
  const repeated = createSkyRandom();
  assert.deepEqual(Array.from({ length: 20 }, random), Array.from({ length: 20 }, repeated));
});

test('大屏和长屏的背景纹理有固定像素预算并保持比例', () => {
  for (const [width, height] of [[7680, 4320], [320, 2560]]) {
    const texture = createGalaxyTexture(width, height);
    assert.ok(texture.width <= 960);
    assert.ok(texture.height <= 540);
    assert.ok(Math.abs(texture.width / texture.height - width / height) < 0.02);
    assert.equal(texture.pixels.length, texture.width * texture.height * 4);
  }
});

test('银河保留暗部与亮尘带，所有像素不透明且亮度低于卦星', () => {
  const { pixels } = createGalaxyTexture(320, 180);
  let darkPixels = 0;
  let brightPixels = 0;
  for (let index = 0; index < pixels.length; index += 4) {
    const value = Math.max(pixels[index], pixels[index + 1], pixels[index + 2]);
    assert.equal(pixels[index + 3], 255);
    assert.ok(value < 160);
    if (value < 18) darkPixels += 1;
    if (value > 35) brightPixels += 1;
  }
  assert.ok(darkPixels > 320 * 180 * 0.4, '深空应有足够暗部');
  assert.ok(brightPixels > 320 * 180 * 0.02, '银河尘带应清晰可辨');
});

test('尚未完成布局或非法尺寸不生成无效画布', () => {
  for (const size of [0, -1, NaN, Infinity]) {
    assert.equal(createGalaxyTexture(size, 100), null);
    assert.equal(createGalaxyTexture(100, size), null);
  }
});
