import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../styles/main.css', import.meta.url), 'utf8');
const main = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
const render = readFileSync(new URL('../js/render.js', import.meta.url), 'utf8');

assert.match(html, /class="brand-lockup"/);
assert.match(html, /class="brand-subtitle">观象 · 读经 · 知变/);
assert.match(html, /id="mode-switcher"[^>]*aria-label="主要功能"/);
assert.match(html, /id="detail-layout"[^>]*aria-label="详情面板布局"/);
assert.match(html, /id="detail-size"[^>]*aria-label="切换底部详情高度，当前：中等"/);
assert.match(html, /id="audio-toggle"[^>]*aria-label="关闭界面音效"[^>]*aria-pressed="true"/);
const modeOrder = [...html.matchAll(/class="mode-btn(?: active)?" data-mode="([^"]+)"/g)].map((match) => match[1]);
assert.deepEqual(modeOrder, ['almanac', 'explore', 'learning', 'review', 'quiz', 'divination']);
assert.doesNotMatch(html, /data-mode="guaxu"/);
assert.match(html, /class="explore-tool guaxu-tool" data-explore-tool="guaxu"/);

assert.match(css, /--panel-width:\s*clamp\(520px,\s*42vw,\s*640px\)/);
assert.match(css, /body\.panel-open\.panel-left #star-canvas\s*{[^}]*left:\s*var\(--panel-width\)/s);
assert.match(css, /body\.panel-open\.panel-bottom #star-canvas\s*{[^}]*height:\s*calc\(100vh - var\(--drawer-height\)\)/s);
assert.match(css, /\.detail-panel\[data-layout="bottom"\][^}]*height:\s*var\(--drawer-height\)[^}]*translateY\(100%\)/s);
assert.match(css, /\.detail-panel\[data-layout="bottom"\] \.detail-content[^}]*grid-template-columns:\s*repeat\(2/s);
assert.match(css, /@media \(max-width:\s*900px\)[\s\S]*?\.detail-panel[^\{]*{[^}]*inset:\s*0[^}]*width:\s*100vw/s);
assert.match(css, /@media \(max-width:\s*600px\)[\s\S]*?\.mode-switcher\s*{[^}]*overflow-x:\s*auto/s);
assert.match(css, /\.mode-btn\s*{[^}]*flex:\s*0 0 auto[^}]*white-space:\s*nowrap/s);
assert.match(css, /\.audio-toggle\s*{[^}]*position:\s*absolute[^}]*right:\s*7px/s);
assert.match(css, /\.explore-tools\s*{[^}]*right:\s*28px/s);
assert.match(css, /\.guaxu-overlay\s*{[^}]*position:\s*fixed[^}]*place-items:\s*center/s);
assert.match(css, /\.guaxu-wheel-rotor\s*{[^}]*transform-origin:\s*center/s);

assert.match(main, /document\.body\.classList\.add\('panel-open'\)/);
assert.match(main, /document\.body\.classList\.remove\('panel-open'\)/);
assert.match(main, /panel\.setAttribute\('aria-modal', String\(compactPanelQuery\.matches\)\)/);
assert.match(main, /const PANEL_LAYOUT_KEY = 'yijing-panel-layout'/);
assert.match(main, /const DRAWER_SIZES = \['compact', 'medium', 'large'\]/);
assert.match(main, /showGuaxuWheel\(\s*state\.hexagrams/);
assert.match(main, /bindInterfaceSounds\(document\)/);
assert.match(main, /setPanelLayout\(panelLayoutSelect\.value, \{ persist: true \}\)/);
assert.match(render, /<section class="detail-section/);
assert.match(render, /class="detail-heading-copy"/);

console.log('✓ 布局响应式契约测试通过');
