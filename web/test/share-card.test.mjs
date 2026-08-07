import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildHexagramRows,
  createShareCardModel,
  deliverShareImage,
  wrapCanvasText,
} from '../js/share-card.js';

const hexagram = {
  number: 29,
  name: '坎',
  fullName: '坎为水',
  binaryCode: '010010',
  judgement: '习坎，有孚，维心亨，行有尚。',
  judgementNote: '身处重重险境，守信诚实则内心亨通。',
  image: '水洊至，习坎；君子以常德行，习教事。',
  scenario: '环境存在反复风险，应建立稳定的应对方法。',
};

test('分享卡片模型保持卦爻自上而下的视觉顺序', () => {
  const model = createShareCardModel(hexagram, 'https://example.com/?hex=010010');
  assert.equal(model.name, '坎');
  assert.deepEqual(model.rows.map((row) => row.isYang), [false, true, false, false, true, false]);
  assert.deepEqual(model.rows.map((row) => row.position), [6, 5, 4, 3, 2, 1]);
  assert.throws(() => buildHexagramRows('101'), /六位/);
  assert.throws(() => createShareCardModel({}, ''), /不完整/);
});

test('长文按画布宽度换行并在超出行数时省略', () => {
  const ctx = { measureText: (text) => ({ width: text.length * 10 }) };
  assert.deepEqual(wrapCanvasText(ctx, '天地玄黄宇宙洪荒', 40), ['天地玄黄', '宇宙洪荒']);
  assert.deepEqual(wrapCanvasText(ctx, '天地玄黄宇宙洪荒', 40, 1), ['天地玄黄…']);
});

test('支持文件分享时发送 PNG 文件', async () => {
  const shared = [];
  class FakeFile {
    constructor(parts, name, options) { Object.assign(this, { parts, name, type: options.type }); }
  }
  const result = await deliverShareImage({
    blob: { size: 20 },
    filename: '坎.png',
    title: '坎',
    text: '分享坎卦',
    navigatorRef: {
      canShare: (data) => data.files[0].type === 'image/png',
      share: async (data) => shared.push(data),
    },
    FileCtor: FakeFile,
  });
  assert.equal(result.mode, 'share');
  assert.equal(shared[0].files[0].name, '坎.png');
});

test('不支持文件分享时下载 PNG', async () => {
  const clicks = [];
  const revoked = [];
  class FakeFile {
    constructor() {}
  }
  const result = await deliverShareImage({
    blob: { size: 20 },
    filename: '坎.png',
    title: '坎',
    text: '分享坎卦',
    navigatorRef: {},
    documentRef: {
      createElement: () => ({
        click() { clicks.push({ href: this.href, download: this.download }); },
      }),
    },
    urlRef: {
      createObjectURL: () => 'blob:share-card',
      revokeObjectURL: (url) => revoked.push(url),
    },
    FileCtor: FakeFile,
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(result.mode, 'download');
  assert.deepEqual(clicks, [{ href: 'blob:share-card', download: '坎.png' }]);
  assert.deepEqual(revoked, ['blob:share-card']);
});
