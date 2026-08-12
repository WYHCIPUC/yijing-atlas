import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir } from 'node:fs/promises';
import sharp from '../../../promo-video/node_modules/sharp/dist/index.mjs';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const backgroundDir = path.join(currentDir, 'backgrounds');
const outputDir = path.join(currentDir, 'complete-set');
const coverPath = path.join(currentDir, '..', 'teaser-cover-final.png');

const pages = [
  {
    input: '01-star-map.png',
    output: '02-why-i-built-it.png',
    eyebrow: 'WHY I BUILT IT',
    title: ['六十四卦', '从来不是孤岛'],
    body: ['错卦、综卦、互卦与变卦，', '共同织成一张彼此牵引的关系网。'],
    cardTitle: '创作手记',
    cardLines: ['我想做的，不是另一份卦辞列表，', '而是一种看见《易经》结构的方法。'],
    zoom: true,
  },
  {
    input: '01-star-map.png',
    output: '03-relationship-atlas.png',
    eyebrow: 'RELATIONSHIP ATLAS',
    title: ['先看见关系', '再理解卦象'],
    body: ['拖动、缩放、选择任意一卦，', '让隐藏的结构在星图中被逐层点亮。'],
    cardTitle: '一张星图 · 四种关系',
    cardLines: ['错卦｜阴阳全换', '综卦｜视角倒转', '互卦｜内藏之卦', '变卦｜一爻牵动'],
  },
  {
    input: '02-evolution-lab.png',
    output: '04-evolution-lab.png',
    eyebrow: 'EVOLUTION LAB',
    title: ['改变一爻', '看见全卦如何转'],
    body: ['逐爻切换并对照前后结构，', '同时理解“象如何变、义如何转”。'],
    cardTitle: '演变实验室',
    cardLines: ['01　选择原卦与关系预设', '02　逐爻观察结构变化', '03　同步阅读经传与释义'],
    note: '用于结构学习，不替代传统占筮判断。',
  },
  {
    input: '03-learning-loop.png',
    output: '05-study-and-review.png',
    eyebrow: 'STUDY & REVIEW',
    title: ['学习不是看过', '而是能够记住'],
    body: ['把课程、测验、复习卡片和进度记录，', '连成一条可以长期坚持的学习路径。'],
    cardTitle: '完整学习节奏',
    cardLines: ['01　循序学习', '02　即时检验', '03　间隔复习', '04　回到薄弱处'],
    note: '学习进度保存在本地设备。',
  },
  {
    input: '04-almanac.png',
    output: '06-almanac.png',
    eyebrow: 'ALMANAC',
    title: ['把传统历法', '放回具体的一天'],
    body: ['查看农历、干支、节气与黄历知识，', '不只给出结果，也解释术语和出处。'],
    cardTitle: '从时间进入传统文化',
    cardLines: ['农历与干支', '二十四节气', '宜忌与术语解读', '今日卦象关联'],
  },
  {
    input: '05-complete-system.png',
    output: '07-complete-loop.png',
    eyebrow: 'THE COMPLETE LOOP',
    title: ['星图是入口', '学习形成闭环'],
    body: ['探索关系 → 理解变化 → 系统学习', '→ 检验掌握 → 持续复习 → 回到日用'],
    cardTitle: '易象图谱 · 项目预告',
    cardLines: ['这是一个传统文化学习工具，', '正在继续打磨，暂不公开链接。'],
    note: '你最想先体验哪一个功能？欢迎留言告诉我。',
    closing: true,
  },
];

const escapeXml = (value) => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;');

const renderLines = (lines, x, y, options = {}) => {
  const {
    size = 27,
    gap = 43,
    fill = '#d9c69c',
    family = 'Microsoft YaHei, sans-serif',
    weight = 400,
  } = options;
  return lines.map((line, index) => (
    `<text x="${x}" y="${y + index * gap}" fill="${fill}" font-family="${family}" font-size="${size}" font-weight="${weight}">${escapeXml(line)}</text>`
  )).join('\n');
};

const createOverlay = (page, index) => {
  const cardHeight = 98 + page.cardLines.length * 46 + (page.note ? 58 : 10);
  const cardY = 602;
  const pageNumber = String(index + 2).padStart(2, '0');
  return `
<svg width="1080" height="1440" viewBox="0 0 1080 1440" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="textShade" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#06101d" stop-opacity="0.94"/>
      <stop offset="0.52" stop-color="#06101d" stop-opacity="0.72"/>
      <stop offset="0.76" stop-color="#06101d" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="footerShade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#06101d" stop-opacity="0"/>
      <stop offset="1" stop-color="#06101d" stop-opacity="0.70"/>
    </linearGradient>
  </defs>
  <rect x="28" y="82" width="760" height="930" rx="4" fill="url(#textShade)"/>
  <rect x="0" y="1190" width="1080" height="250" fill="url(#footerShade)"/>
  <text x="88" y="170" fill="#caa86a" font-family="Georgia, serif" font-size="18" font-weight="600" letter-spacing="7">${escapeXml(page.eyebrow)}</text>
  <text x="992" y="170" fill="#a98a56" text-anchor="end" font-family="Georgia, serif" font-size="17" letter-spacing="4">${pageNumber} / 07</text>
  <text x="86" y="286" fill="#f3e4be" stroke="#07111f" stroke-width="1.4" paint-order="stroke" font-family="SimSun, Songti SC, serif" font-size="70" font-weight="700">${escapeXml(page.title[0])}</text>
  <text x="86" y="390" fill="#f3e4be" stroke="#07111f" stroke-width="1.4" paint-order="stroke" font-family="SimSun, Songti SC, serif" font-size="70" font-weight="700">${escapeXml(page.title[1])}</text>
  <line x1="88" y1="454" x2="430" y2="454" stroke="#b98c4f" stroke-width="1.5"/>
  <path d="M448 446 L456 454 L448 462 L440 454 Z" fill="#c59a5b"/>
  ${renderLines(page.body, 88, 515, { size: 26, gap: 43, fill: '#d9c69c' })}
  <rect x="78" y="${cardY}" width="535" height="${cardHeight}" rx="22" fill="#07111f" fill-opacity="0.82" stroke="#9d7a46" stroke-opacity="0.82"/>
  <text x="112" y="${cardY + 52}" fill="#caa86a" font-family="Microsoft YaHei, sans-serif" font-size="19" font-weight="700" letter-spacing="3">${escapeXml(page.cardTitle)}</text>
  ${renderLines(page.cardLines, 112, cardY + 105, { size: 24, gap: 46, fill: '#f0dfb8' })}
  ${page.note ? `<line x1="112" y1="${cardY + 104 + page.cardLines.length * 46}" x2="565" y2="${cardY + 104 + page.cardLines.length * 46}" stroke="#8e7044" stroke-opacity="0.65"/><text x="112" y="${cardY + 142 + page.cardLines.length * 46}" fill="#b6a27b" font-family="Microsoft YaHei, sans-serif" font-size="18">${escapeXml(page.note)}</text>` : ''}
  <text x="88" y="1342" fill="#c7a86b" font-family="Microsoft YaHei, sans-serif" font-size="19" letter-spacing="3">易象图谱 · 项目预告</text>
  <text x="992" y="1342" fill="#a88a56" text-anchor="end" font-family="Microsoft YaHei, sans-serif" font-size="17" letter-spacing="2">传统文化学习工具</text>
  ${page.zoom ? '<rect x="16" y="16" width="1048" height="1408" rx="34" fill="none" stroke="#9f7b49" stroke-width="1.2"/>' : ''}
</svg>`;
};

await mkdir(outputDir, { recursive: true });

await sharp(coverPath)
  .resize(1080, 1440, { fit: 'cover', position: 'centre' })
  .png({ compressionLevel: 9 })
  .toFile(path.join(outputDir, '01-cover.png'));

for (const [index, page] of pages.entries()) {
  const base = sharp(path.join(backgroundDir, page.input));
  const prepared = page.zoom
    ? base.resize(1188, 1584, { fit: 'cover', position: 'centre' }).extract({ left: 54, top: 72, width: 1080, height: 1440 })
    : base.resize(1080, 1440, { fit: 'cover', position: 'centre' });
  await prepared
    .composite([{ input: Buffer.from(createOverlay(page, index)) }])
    .png({ compressionLevel: 9 })
    .toFile(path.join(outputDir, page.output));
}

console.log(`Rendered ${pages.length + 1} complete carousel pages to ${outputDir}`);
