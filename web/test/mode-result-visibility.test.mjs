import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const reviewMode = readFileSync(new URL('../js/modes/review-mode.js', import.meta.url), 'utf8');
const quizMode = readFileSync(new URL('../js/modes/quiz-mode.js', import.meta.url), 'utf8');
const divinationMode = readFileSync(new URL('../js/modes/divination-mode.js', import.meta.url), 'utf8');

test('复习完成状态位于队列与单卡的可见标题区', () => {
  const queueHeaderStart = reviewMode.indexOf('<header class="mode-hero review-hero">');
  const queueHeaderEnd = reviewMode.indexOf('</header>', queueHeaderStart);
  const queueStatus = reviewMode.indexOf('class="review-storage-status"', queueHeaderStart);
  assert.ok(queueHeaderStart >= 0 && queueStatus > queueHeaderStart && queueStatus < queueHeaderEnd);

  const cardHeading = reviewMode.indexOf('data-page-heading>今日温故</h2>');
  const cardStatus = reviewMode.indexOf('class="review-storage-status"', cardHeading);
  const cardButton = reviewMode.indexOf('class="flip-card"', cardHeading);
  assert.ok(cardHeading >= 0 && cardStatus > cardHeading && cardStatus < cardButton);
});

test('测验反馈进入最近视区后聚焦下一题', () => {
  const revealStart = quizMode.indexOf('function revealQuizFeedback');
  const revealEnd = quizMode.indexOf('\n}', revealStart);
  const revealSource = quizMode.slice(revealStart, revealEnd);
  assert.match(revealSource, /feedback\.scrollIntoView\?\.\(\{/);
  assert.match(revealSource, /block:\s*'nearest'/);
  assert.match(revealSource, /inline:\s*'nearest'/);
  assert.match(revealSource, /querySelector\('\.quiz-next'\)\?\.focus\(\{ preventScroll: true \}\)/);
  assert.ok(revealSource.indexOf('scrollIntoView') < revealSource.indexOf("querySelector('.quiz-next')"));
});

test('占筮阶段与结果滚动尊重 reduced-motion', () => {
  assert.match(divinationMode, /matchMedia\?\.\('\(prefers-reduced-motion: reduce\)'\)/);
  assert.match(divinationMode, /behavior:\s*reducedMotion \? 'auto' : 'smooth'/);
  assert.match(divinationMode, /block:\s*'nearest'/);
  assert.match(divinationMode, /revealDivinationArea\(mountEl\.querySelector\('\.divine-body'\)\)/);
  assert.match(divinationMode, /revealDivinationArea\(result, '\.divine-interpretation-heading h3'\)/);
  assert.match(divinationMode, /revealDivinationArea\(result, '#coin-result-title'\)/);
});
