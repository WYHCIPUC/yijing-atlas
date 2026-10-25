import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const reviewMode = readFileSync(new URL('../js/modes/review-mode.js', import.meta.url), 'utf8');
const quizMode = readFileSync(new URL('../js/modes/quiz-mode.js', import.meta.url), 'utf8');
const divinationMode = readFileSync(new URL('../js/modes/divination-mode.js', import.meta.url), 'utf8');

test('复习队列保留标题状态，单卡保存结果位于四段反馈的学习记录区', () => {
  const queueHeaderStart = reviewMode.indexOf('<header class="mode-hero review-hero">');
  const queueHeaderEnd = reviewMode.indexOf('</header>', queueHeaderStart);
  const queueStatus = reviewMode.indexOf('class="review-storage-status"', queueHeaderStart);
  assert.ok(queueHeaderStart >= 0 && queueStatus > queueHeaderStart && queueStatus < queueHeaderEnd);

  assert.match(reviewMode, /changes:\s*`<p class="review-storage-status" role="status" aria-live="polite">/);
  assert.doesNotMatch(reviewMode, /class="review-feedback"[^>]*aria-live/);
});

test('测验按实际保存结果先显示反馈或重试行动，再聚焦当前行动', () => {
  const revealSource = quizMode.match(/^function revealQuizFeedback\([\s\S]*?^}/m)?.[0];
  assert.ok(revealSource, '测验反馈定位函数必须存在');
  assert.match(quizMode, /revealQuizFeedback\(feedback, current, schedule, !lastResult\.saved\)/);

  for (const failed of [false, true]) {
    for (const reducedMotion of [false, true]) {
      const calls = [];
      const frames = [];
      const selector = failed ? '[data-action="quiz-retry"]' : '.quiz-next';
      const action = {
        scrollIntoView: options => calls.push(['scroll', selector, { ...options }]),
        focus: options => calls.push(['focus', selector, { ...options }]),
      };
      const feedback = {
        isConnected: true,
        querySelector: value => { assert.equal(value, selector); return action; },
        scrollIntoView: options => calls.push(['scroll', 'feedback', { ...options }]),
      };
      const reveal = vm.runInNewContext(`${revealSource}; revealQuizFeedback`, {
        window: { matchMedia: query => {
          assert.equal(query, '(prefers-reduced-motion: reduce)');
          return { matches: reducedMotion };
        } },
      });
      reveal(feedback, () => true, callback => frames.push(callback), failed);
      assert.equal(frames.length, 1);
      assert.deepEqual(calls, [], '等待渲染帧后才定位当前反馈');
      frames.shift()();
      assert.deepEqual(calls, [
        ['scroll', failed ? selector : 'feedback', {
          behavior: reducedMotion ? 'auto' : 'smooth',
          block: failed ? 'center' : 'nearest', inline: 'nearest',
        }],
        ['focus', selector, { preventScroll: true }],
      ]);

      for (const staleReason of ['view', 'disconnected']) {
        let current = true;
        calls.length = 0;
        feedback.isConnected = true;
        reveal(feedback, () => current, callback => frames.push(callback), failed);
        if (staleReason === 'view') current = false;
        else feedback.isConnected = false;
        frames.shift()();
        assert.deepEqual(calls, [], '旧页面或已脱离反馈的排队动作不得滚动或聚焦');
      }
    }
  }
});

test('占筮阶段与结果滚动尊重 reduced-motion', () => {
  assert.match(divinationMode, /matchMedia\?\.\('\(prefers-reduced-motion: reduce\)'\)/);
  assert.match(divinationMode, /behavior:\s*reducedMotion \? 'auto' : 'smooth'/);
  assert.match(divinationMode, /block:\s*'nearest'/);
  assert.match(divinationMode, /revealDivinationArea\(mountEl\.querySelector\('\.divine-body'\)\)/);
  assert.match(divinationMode, /revealDivinationArea\(result, '\.divine-interpretation-heading h3'\)/);
  assert.match(divinationMode, /revealDivinationArea\(result, '#coin-result-title'\)/);
});
