import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const hexagrams = JSON.parse(
  await readFile(join(webRoot, 'data/hexagrams.json'), 'utf8'),
);

const expectedNames = [
  '乾', '坤', '屯', '蒙', '需', '讼', '师', '比',
  '小畜', '履', '泰', '否', '同人', '大有', '谦', '豫',
  '随', '蛊', '临', '观', '噬嗑', '贲', '剥', '复',
  '无妄', '大畜', '颐', '大过', '坎', '离', '咸', '恒',
  '遁', '大壮', '晋', '明夷', '家人', '睽', '蹇', '解',
  '损', '益', '夬', '姤', '萃', '升', '困', '井',
  '革', '鼎', '震', '艮', '渐', '归妹', '丰', '旅',
  '巽', '兑', '涣', '节', '中孚', '小过', '既济', '未济',
];

test('orderRemark 说明当前卦承接前序的理由，且覆盖完整文王卦序', () => {
  assert.equal(hexagrams.length, expectedNames.length);
  assert.deepEqual(hexagrams.map(({ name }) => name), expectedNames);

  for (const [index, hexagram] of hexagrams.entries()) {
    assert.equal(hexagram.number, index + 1);
    assert.equal(typeof hexagram.orderRemark, 'string');
    assert.ok(hexagram.orderRemark.length > 0, `${hexagram.name} 缺少序卦说明`);

    if (index < 2) {
      assert.doesNotMatch(hexagram.orderRemark, /故受之以/);
      assert.match(hexagram.orderRemark, /未另述.+卦承接之由/);
      continue;
    }

    assert.match(
      hexagram.orderRemark,
      new RegExp(`故受之以${hexagram.name}(?:。|终焉)`),
      `${hexagram.name} 的 orderRemark 必须解释当前卦，而非后续卦`,
    );
  }

  assert.equal(
    new Set(hexagrams.map(({ orderRemark }) => orderRemark)).size,
    expectedNames.length,
    '每卦应有独立且未错位重复的序卦说明',
  );
});

test('序卦上下经边界及末卦文本保持可靠链条', () => {
  const byName = Object.fromEntries(
    hexagrams.map((hexagram) => [hexagram.name, hexagram.orderRemark]),
  );

  assert.equal(
    byName.屯,
    '有天地，然后万物生焉。盈天地之间者唯万物，故受之以屯。屯者，盈也；屯者，物之始生也。',
  );
  assert.equal(byName.否, '物不可以终通，故受之以否。');
  assert.equal(byName.咸, '有上下必有男女，故受之以咸。咸者，感也。');
  assert.equal(byName.未济, '物不可穷也，故受之以未济终焉。');

  for (const { name, orderRemark } of hexagrams) {
    assert.doesNotMatch(
      orderRemark,
      /男之穷|六十四卦终|循环复始/,
      `${name} 的序卦说明混入了非《序卦传》链条文本`,
    );
  }
});

test('fill-all 生成链不会回写旧版错位序卦说明', async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), 'yijing-fill-all-'));
  try {
    await mkdir(join(tempRoot, 'data'));
    await copyFile(
      join(webRoot, 'data/hexagrams.json'),
      join(tempRoot, 'data/hexagrams.json'),
    );

    const result = spawnSync(
      process.execPath,
      [join(webRoot, 'tool/fill-all.mjs')],
      { cwd: tempRoot, encoding: 'utf8' },
    );
    assert.equal(result.status, 0, result.stderr || result.stdout);

    const generated = JSON.parse(
      await readFile(join(tempRoot, 'data/hexagrams.json'), 'utf8'),
    );
    assert.deepEqual(
      generated.map(({ orderRemark }) => orderRemark),
      hexagrams.map(({ orderRemark }) => orderRemark),
    );
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
