import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '..');
const rawDir = path.join(projectRoot, 'public', 'textures', 'raw');
const elementsDir = path.join(projectRoot, 'public', 'textures', 'elements');
const layoutPath = path.join(projectRoot, 'src', 'live-layout.json');
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const baseUrl = process.env.YIJING_BASE_URL || 'http://localhost:3030/';

await fs.mkdir(rawDir, { recursive: true });
await fs.mkdir(elementsDir, { recursive: true });

const fixedNow = Date.parse('2026-08-07T10:00:00+08:00');
const lessonIds = ['l1-1', 'l1-2', 'l1-3', 'l1-4', 'l2-1', 'l2-2', 'l3-1', 'l4-1', 'l5-1'];
const lessons = Object.fromEntries(lessonIds.map((id, index) => [id, {
  viewedAt: `2026-08-0${Math.min(7, index + 1)}T02:00:00.000Z`,
  lastStudiedAt: '2026-08-07T02:00:00.000Z',
  attempts: index % 3 + 1,
  bestScore: [1, 0.84, 0.67][index % 3],
}]));
const learningRecord = {
  version: 2,
  lessons,
  spotChecks: [{ at: '2026-08-06T02:00:00.000Z', correct: 4, total: 5 }],
  exams: [{ at: '2026-08-05T02:00:00.000Z', correct: 8, total: 10 }],
  oralReviews: [{ at: '2026-08-07T02:00:00.000Z', lessonId: 'l1-1', score: 86 }],
};
const reviewCards = Object.fromEntries(Array.from({ length: 64 }, (_, value) => {
  const code = value.toString(2).padStart(6, '0');
  return [code, {
    code,
    stage: value % 7,
    due: value < 6 ? fixedNow - 1000 : fixedNow + 86400000 * (value % 15 + 1),
    lapses: value % 4 === 0 ? 1 : 0,
    reps: value % 5 + 1,
    lastReview: fixedNow - 86400000 * (value % 8 + 1),
  }];
}));

const browser = await chromium.launch({ executablePath: edgePath, headless: true });
const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 2,
  colorScheme: 'dark',
  locale: 'zh-CN',
});

await context.addInitScript(({ learningRecordValue, reviewCardsValue }) => {
  sessionStorage.setItem('yijing-daily-seen', '1');
  localStorage.setItem('yijing-panel-layout', 'bottom');
  localStorage.setItem('yijing-drawer-size', 'large');
  localStorage.setItem('yijing-learning-record-v2', JSON.stringify(learningRecordValue));
  localStorage.setItem('yijing-activity-v1', JSON.stringify({ days: ['2026-08-01', '2026-08-02', '2026-08-03', '2026-08-04', '2026-08-05', '2026-08-06', '2026-08-07'] }));
  localStorage.setItem('yijing-review-cards', JSON.stringify(reviewCardsValue));
  localStorage.setItem('yijing-quiz-stats', JSON.stringify({ total: 48, correct: 39 }));
  localStorage.setItem('yijing-quiz-wrong', JSON.stringify(['001010', '101001', '011100', '110011']));
  let seed = 0x1a2b3c4d;
  Math.random = () => {
    seed |= 0;
    seed = seed + 0x6d2b79f5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}, { learningRecordValue: learningRecord, reviewCardsValue: reviewCards });

const page = await context.newPage();
const layout = { pageW: 1920, pageH: 1080, scale: 2, states: {} };

async function settle(extra = 800) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(extra);
}

async function openApp(pathname = '') {
  await page.goto(new URL(pathname, baseUrl).toString(), { waitUntil: 'networkidle' });
  await page.waitForSelector('#loading', { state: 'hidden', timeout: 15000 });
  await settle(1000);
}

async function capture(name, selectors = []) {
  const boxes = {};
  const elements = {};
  for (const selector of selectors) {
    const handles = await page.locator(selector).all();
    boxes[selector] = [];
    for (const handle of handles.slice(0, 12)) {
      const box = await handle.boundingBox();
      if (box) boxes[selector].push(box);
    }
  }
  await page.screenshot({ path: path.join(rawDir, `${name}.png`), fullPage: false });
  for (const selector of selectors) {
    const slug = selector.replace(/^[.#]/, '').replace(/[^a-z0-9]+/gi, '-');
    const handles = await page.locator(selector).all();
    elements[selector] = [];
    for (const [index, handle] of handles.slice(0, 5).entries()) {
      const box = await handle.boundingBox();
      if (!box) continue;
      const filename = `${name}-${slug}-${index}.png`;
      await handle.screenshot({
        path: path.join(elementsDir, filename),
        animations: 'disabled',
      });
      elements[selector].push({
        file: `textures/elements/${filename}`,
        box,
        pixelScale: 2,
      });
    }
  }
  layout.states[name] = { boxes, elements };
  console.log(`captured ${name}`);
}

await openApp();
await capture('star', ['.topbar', '.explore-tools', '.zoom-controls']);

await openApp('?hex=010001');
await page.waitForSelector('#detail-panel.open');
await settle(500);
await capture('star-detail', ['#detail-panel', '.hex-detail', '.relation-grid']);

await page.locator('.share-hexagram').click();
await page.waitForSelector('.share-card-overlay');
await page.waitForSelector('.share-card-preview img');
await page.evaluate(async () => {
  const [{ loadCoreData }, { generateHexagramShareImage }] = await Promise.all([
    import('./js/data-loader.js'),
    import('./js/share-card.js'),
  ]);
  const { hexagrams } = await loadCoreData();
  const hexagram = hexagrams.find((item) => item.binaryCode === '010001') || hexagrams[0];
  const payload = await generateHexagramShareImage(
    hexagram,
    'https://wyhcipuc.github.io/yijing-atlas/?hex=010001',
  );
  const preview = document.querySelector('.share-card-preview img');
  if (preview) preview.src = payload.previewUrl;
});
await settle(500);
await capture('share', ['.share-card-dialog', '.share-card-preview', '.share-card-preview img']);
await page.locator('.share-card-close').click();
await settle(250);

// The production manifest deliberately keeps the laboratory hidden until all
// commentary citations are released. For the public promo fixture we open the
// existing module directly with the same public dataset; no application data is
// changed and the captured UI is still the real implementation.
await page.evaluate(async () => {
  const [{ loadCoreData }, { showEvolutionLab }] = await Promise.all([
    import('./js/data-loader.js'),
    import('./js/evolution-lab.js'),
  ]);
  const { hexagrams } = await loadCoreData();
  const baseHex = hexagrams.find((item) => item.binaryCode === '010001') || hexagrams[0];
  showEvolutionLab(baseHex, hexagrams, () => {}, () => {});
});
await page.waitForSelector('.evolution-overlay');
await page.locator('[data-evolution-preset="opposite"]').click();
await settle(500);
await capture('evolution', ['.evolution-card', '.evolution-stage', '.evolution-meaning']);

await page.locator('.evolution-close').click();
await page.locator('[data-explore-tool="guaxu"]').click();
await page.waitForSelector('.guaxu-overlay');
await settle(400);
await capture('wheel', ['.guaxu-dialog', '.guaxu-wheel-frame', '.guaxu-result']);

await page.locator('.guaxu-close').click();
await page.locator('[data-mode="almanac"]').click();
await page.waitForSelector('.almanac-view');
const dateInput = page.locator('.alm-date input[type="date"]');
if (await dateInput.count()) {
  await dateInput.fill('2026-08-07');
  await dateInput.dispatchEvent('change');
  await settle(700);
}
await capture('almanac', ['.almanac-view', '.alm-date-card', '.alm-grid']);

await page.locator('[data-mode="learning"]').click();
await page.waitForSelector('.academy-rank-card');
await settle(700);
await capture('learning', ['.academy-rank-card', '.learning-dashboard', '.level-block']);

await page.locator('[data-mode="review"]').click();
await page.waitForSelector('.review-due-list');
await settle(500);
await capture('review', ['.review-due-list', '.mode-panel']);

await page.locator('[data-mode="quiz"]').click();
await page.waitForSelector('.mode-panel');
await settle(600);
await capture('quiz', ['.mode-panel', '.quiz-grid', '.quiz-question']);

await page.locator('[data-mode="divination"]').click();
await page.waitForSelector('.coin-cast');
await page.locator('.coin-cast').click();
await page.waitForSelector('.divine-interpretation');
await settle(700);
await capture('divination', ['.divine-panel', '.cast-lines', '.divine-interpretation']);

await fs.writeFile(layoutPath, JSON.stringify(layout, null, 2));
await browser.close();
console.log(`wrote ${layoutPath}`);
