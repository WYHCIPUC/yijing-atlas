import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir } from 'node:fs/promises';
import sharp from '../../../promo-video/node_modules/sharp/dist/index.mjs';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const backgroundDir = path.join(currentDir, 'backgrounds');
const outputDir = path.join(currentDir, 'final');

const posters = [
  {
    input: '01-star-map.png',
    output: '01-hexagram-star-map.png',
    title: ['六十四卦', '原来彼此相连'],
    subtitle: '错 · 综 · 互 · 变',
  },
  {
    input: '02-evolution-lab.png',
    output: '02-evolution-lab.png',
    title: ['看见一爻', '如何改变全卦'],
    subtitle: '演变实验室 · 逐爻观察',
  },
  {
    input: '03-learning-loop.png',
    output: '03-study-and-review.png',
    title: ['不只看懂', '还要真正记住'],
    subtitle: '学习 · 检验 · 复习 · 回炉',
  },
  {
    input: '04-almanac.png',
    output: '04-almanac.png',
    title: ['把古老历法', '放回具体的一天'],
    subtitle: '节气 · 干支 · 卦象 · 日用',
  },
  {
    input: '05-complete-system.png',
    output: '05-complete-learning-system.png',
    title: ['一套完整的', '《易经》学习闭环'],
    subtitle: '星图 · 演变 · 学习 · 复习 · 黄历',
  },
];

const escapeXml = (value) => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;');

const createOverlay = ({ title, subtitle }) => `
<svg width="1080" height="1440" viewBox="0 0 1080 1440" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="textShade" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#06101d" stop-opacity="0.82"/>
      <stop offset="0.46" stop-color="#06101d" stop-opacity="0.50"/>
      <stop offset="0.72" stop-color="#06101d" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="footerShade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#06101d" stop-opacity="0"/>
      <stop offset="1" stop-color="#06101d" stop-opacity="0.62"/>
    </linearGradient>
  </defs>
  <rect x="28" y="92" width="780" height="590" fill="url(#textShade)"/>
  <rect x="0" y="1180" width="1080" height="260" fill="url(#footerShade)"/>
  <text x="88" y="194" fill="#caa86a" font-family="Georgia, serif" font-size="19" font-weight="600" letter-spacing="8">INTERACTIVE I CHING ATLAS</text>
  <text x="86" y="316" fill="#f3e4be" stroke="#07111f" stroke-width="1.5" paint-order="stroke" font-family="SimSun, Songti SC, serif" font-size="82" font-weight="700">${escapeXml(title[0])}</text>
  <text x="86" y="432" fill="#f3e4be" stroke="#07111f" stroke-width="1.5" paint-order="stroke" font-family="SimSun, Songti SC, serif" font-size="82" font-weight="700">${escapeXml(title[1])}</text>
  <line x1="88" y1="506" x2="430" y2="506" stroke="#b98c4f" stroke-width="1.5"/>
  <path d="M448 498 L456 506 L448 514 L440 506 Z" fill="#c59a5b"/>
  <text x="88" y="579" fill="#d6b676" stroke="#07111f" stroke-width="1" paint-order="stroke" font-family="SimSun, Songti SC, serif" font-size="29" letter-spacing="4">${escapeXml(subtitle)}</text>
  <text x="88" y="1342" fill="#c7a86b" font-family="Microsoft YaHei, sans-serif" font-size="19" letter-spacing="3">易象图谱 · 项目预告</text>
  <text x="992" y="1342" fill="#a88a56" text-anchor="end" font-family="Microsoft YaHei, sans-serif" font-size="17" letter-spacing="2">传统文化学习工具</text>
</svg>`;

await mkdir(outputDir, { recursive: true });

for (const poster of posters) {
  const inputPath = path.join(backgroundDir, poster.input);
  const outputPath = path.join(outputDir, poster.output);
  await sharp(inputPath)
    .resize(1080, 1440, { fit: 'cover', position: 'centre' })
    .composite([{ input: Buffer.from(createOverlay(poster)) }])
    .png({ compressionLevel: 9 })
    .toFile(outputPath);
}

console.log(`Rendered ${posters.length} posters to ${outputDir}`);
