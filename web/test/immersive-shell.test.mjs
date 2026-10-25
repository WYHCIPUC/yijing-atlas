import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

function region(start, end) {
  return html.slice(html.indexOf(start), html.indexOf(end, html.indexOf(start)));
}

test('紧凑星仪常驻图式和关系，辅助内容由语义按钮控制并默认隐藏', () => {
  const controls = region('<section class="relation-layers"', '<aside class="detail-panel"');
  const optionsStart = controls.indexOf('id="relation-options"');
  assert.ok(optionsStart > 0, '提供可折叠的工具详情');
  const alwaysVisible = controls.slice(0, optionsStart);
  assert.match(alwaysVisible, /id="relation-toggle"[^>]*aria-expanded="false"[^>]*aria-controls="relation-options"/);
  assert.match(alwaysVisible, /id="star-layout-mode"/);
  assert.match(alwaysVisible, /id="star-relation-status"/);
  assert.equal((alwaysVisible.match(/data-relation-layer=/g) || []).length, 4);
  const options = controls.slice(optionsStart);
  assert.match(options, /^id="relation-options"[^>]*hidden/);
  for (const selector of ['star-layout-description', 'galaxy-legend', 'star-map-sequence', 'changing-position-buttons', 'star-accessible-list']) {
    assert.ok(options.includes(selector), `${selector} 留在展开区域`);
  }
  assert.match(html, /aria-describedby="star-canvas-description star-layout-description star-relation-status"/);
});

test('聚焦与阅读层提供独立入口，保留现有六导航及三种开始路径', () => {
  assert.match(html, /id="star-focus-summary"[^>]*hidden/);
  for (const field of ['number', 'name', 'full', 'trigrams', 'description']) {
    assert.ok(html.includes(`data-focus-${field}`));
  }
  for (const id of ['focus-read', 'focus-clear', 'reading-back', 'reading-deepen', 'reading-quicken']) {
    assert.ok(html.includes(`id="${id}"`), id);
  }
  const panel = region('<aside class="detail-panel"', '<div class="hint-bar"');
  assert.match(panel, /id="reading-toolbar"[^>]*hidden/);
  assert.ok(panel.indexOf('id="reading-toolbar"') < panel.indexOf('id="detail-content"'));
  assert.deepEqual([...panel.matchAll(/data-reading-tab="([^"]+)"/g)].map((match) => match[1]),
    ['overview', 'judgement', 'commentary', 'lines', 'relations']);
  assert.deepEqual([...html.matchAll(/class="mode-btn(?: active)?" data-mode="([^"]+)"/g)].map((match) => match[1]),
    ['almanac', 'explore', 'learning', 'review', 'quiz', 'divination']);
  assert.deepEqual([...html.matchAll(/data-entry="([^"]+)"/g)].map((match) => match[1]), ['beginner', 'explore', 'daily']);
});
