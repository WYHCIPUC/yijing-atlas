import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';

const here = path.dirname(fileURLToPath(import.meta.url));
const outputDir = path.join(here, 'output');
const pageUrl = pathToFileURL(path.join(here, 'review.html')).href;
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const frames = ['brand', 'star', 'learning'];

await fs.mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: edgePath,
  headless: true,
});

try {
  const page = await browser.newPage({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
  });

  for (const frame of frames) {
    await page.goto(`${pageUrl}?frame=${frame}`, { waitUntil: 'load' });
    await page.waitForFunction(() => document.documentElement.dataset.ready === 'true');
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({
      path: path.join(outputDir, `styleframe-${frame}.png`),
      type: 'png',
      fullPage: false,
    });
  }
} finally {
  await browser.close();
}

console.log(`Captured ${frames.length} styleframes in ${outputDir}`);
