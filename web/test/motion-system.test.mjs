import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { getMotionDelay } from '../js/motion-system.js';

const webRoot = new URL('../', import.meta.url);

test('动效错峰有界，避免长列表拖慢交互', () => {
  assert.equal(getMotionDelay(-1), 0);
  assert.equal(getMotionDelay(3), 102);
  assert.equal(getMotionDelay(999), 612);
});

test('动效协调器集中管理可见性、动态节点与清理', async () => {
  const source = await readFile(new URL('js/motion-system.js', webRoot), 'utf8');
  assert.match(source, /prefers-reduced-motion: reduce/);
  assert.match(source, /new IntersectionObserver/);
  assert.match(source, /new MutationObserver/);
  assert.match(source, /visibilitychange/);
  assert.match(source, /mutationObserver\?\.disconnect\(\)/);
  assert.match(source, /ambientObserver\?\.disconnect\(\)/);
  assert.match(source, /cancelAnimationFrame/);
  assert.match(source, /activePressTimers\.forEach/);
  assert.match(source, /element\.closest\('\[hidden\]'\)/);
  assert.match(source, /activeEntrySettlers\.forEach/);
});

test('入口、离线缓存与样式都接入同一代动效系统', async () => {
  const [main, cinematic, serviceWorker, css, html] = await Promise.all([
    readFile(new URL('js/main.js', webRoot), 'utf8'),
    readFile(new URL('js/cinematic-motion.js', webRoot), 'utf8'),
    readFile(new URL('sw.js', webRoot), 'utf8'),
    readFile(new URL('styles/main.css', webRoot), 'utf8'),
    readFile(new URL('index.html', webRoot), 'utf8'),
  ]);
  assert.match(main, /initMotionSystem\(\)/);
  assert.match(main, /motionSystem\.reveal\(panelContent\)/);
  assert.match(serviceWorker, /\.\/js\/motion-system\.js/);
  assert.match(css, /\.motion-item-enter/);
  assert.match(css, /body\.motion-paused/);
  assert.match(css, /\.daily-overlay\[hidden\]/);
  assert.match(css, /\.motion-offscreen/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(html, /class="mode-portal"/);
  assert.match(html, /class="panel-reading-progress"/);
  assert.match(html, /class="cursor-trail"/);
  assert.match(html, /class="mode-indicator"/);
  assert.match(html, /class="star-hover-card"/);
  assert.match(cinematic, /MAGNETIC_SELECTOR/);
  assert.match(cinematic, /className = 'motion-ripple'/);
  assert.match(cinematic, /function previewHexagram\(hexagram, meta = \{\}\)/);
  assert.match(cinematic, /data-hover-degree/);
  assert.match(cinematic, /data-hover-depth/);
  assert.match(cinematic, /data-hover-balance/);
  assert.match(cinematic, /function syncModeIndicator\(button/);
  assert.match(cinematic, /const trailMotes = \[\]/);
  assert.match(cinematic, /cursorTrail\?\.replaceChildren\(\)/);
  assert.match(cinematic, /removeEventListener\('visibilitychange', onVisibilityChange\)/);
  assert.match(cinematic, /--reading-progress/);
  assert.match(cinematic, /activeReadingSection\?\.classList\.remove\('is-reading'\)/);
  assert.match(cinematic, /syncReadingProgress/);
  assert.match(cinematic, /removeEventListener\('scroll', onPanelScroll\)/);
});
