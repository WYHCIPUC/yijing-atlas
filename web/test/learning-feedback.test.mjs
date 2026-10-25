import assert from 'node:assert/strict';
import test from 'node:test';
import { renderLearningFeedback } from '../js/learning-feedback.js';
import { createPageDom } from './helpers/quiz-page-dom.mjs';

function input(extra = {}) {
  return {
    result: '<p>基于你的自评：能清楚复述。</p>',
    basis: '<p>对照卦辞与原课要点核对。</p>',
    changes: '<p class="review-storage-status">复习卡已保存，活动记录未能保存。</p>',
    primaryAction: '<button type="button" class="quick-btn" data-action="retry-save">重试未保存的记录</button>',
    ...extra,
  };
}

function mountFeedback(value) {
  const dom = createPageDom();
  dom.mount.innerHTML = renderLearningFeedback(value);
  return dom.mount;
}

test('反馈按结果、依据、实际记录、下一步的原生章节顺序呈现', () => {
  const mount = mountFeedback(input());
  const sections = mount.querySelectorAll('[data-feedback-section]');
  assert.deepEqual(sections.map(section => section.tagName), ['SECTION', 'SECTION', 'SECTION', 'SECTION']);
  assert.deepEqual(sections.map(section => section.dataset.feedbackSection), ['result', 'basis', 'changes', 'actions']);
  assert.deepEqual(sections.map(section => section.querySelector('h3')?.textContent), ['本次结果', '判断依据', '学习记录', '下一步']);
  assert.match(sections[0].textContent, /基于你的自评/);
  assert.match(sections[1].textContent, /原课要点/);
  assert.match(sections[2].textContent, /活动记录未能保存/);
  assert.equal(mount.querySelectorAll('[hidden]').length, 0);
});

test('保留一个主行动与最多两个次行动的原按钮属性及来源链接', () => {
  const value = input({ secondaryActions: [
    '<button type="button" class="text-button" data-action="return-review" aria-label="返回温故队列">返回温故</button>',
    '<a class="text-button" href="#lesson-l1-1" data-action="source">核对原课</a>',
  ] });
  const html = renderLearningFeedback(value);
  for (const fragment of [value.primaryAction, ...value.secondaryActions]) assert.ok(html.includes(fragment));
  const mount = mountFeedback(value);
  const actions = mount.querySelector('[data-feedback-section="actions"]');
  assert.equal(actions.querySelectorAll('[data-feedback-action="primary"]').length, 1);
  assert.equal(actions.querySelectorAll('[data-feedback-action="secondary"]').length, 2);
  assert.equal(actions.querySelectorAll('button, a').length, 3);
  assert.equal(actions.querySelector('[data-action="return-review"]').getAttribute('aria-label'), '返回温故队列');
  assert.equal(actions.querySelector('[data-action="source"]').getAttribute('href'), '#lesson-l1-1');
});

test('省略次行动时只有主行动，不生成空按钮或占位链接', () => {
  const mount = mountFeedback(input());
  assert.equal(mount.querySelectorAll('[data-feedback-action="primary"]').length, 1);
  assert.equal(mount.querySelectorAll('[data-feedback-action="secondary"]').length, 0);
  assert.equal(mount.querySelectorAll('button, a').length, 1);
});

test('缺失或非法必填片段明确报出字段，不用空反馈掩盖调用错误', () => {
  for (const value of [undefined, null, [], 'feedback']) assert.throws(() => renderLearningFeedback(value), TypeError);
  for (const field of ['result', 'basis', 'changes', 'primaryAction']) {
    for (const value of [undefined, null, '', '  ', 0, {}]) {
      assert.throws(() => renderLearningFeedback(input({ [field]: value })), error =>
        error instanceof TypeError && error.message.includes(field));
    }
  }
});

test('次行动超量或非法数组成员报错，不静默截断或跳过', () => {
  const action = '<button type="button">下一步</button>';
  assert.throws(() => renderLearningFeedback(input({ secondaryActions: [action, action, action] })), RangeError);
  for (const value of [null, action, {}, [undefined], [' '], new Array(1)]) {
    assert.throws(() => renderLearningFeedback(input({ secondaryActions: value })), TypeError);
  }
});

test('每个行动片段只接受一个原生按钮或链接，不能藏入多个行动', () => {
  for (const action of ['<span>继续</span>', '<button>继续</button><button>返回</button>',
    '<button>继续<a href="#back">返回</a></button>', '<input type="button" value="继续">']) {
    assert.throws(() => renderLearningFeedback(input({ primaryAction: action })), TypeError);
    assert.throws(() => renderLearningFeedback(input({ secondaryActions: [action] })), TypeError);
  }
});

test('可信片段只呈现一次，已转义正文不被重新转义或改写', () => {
  const value = input({ basis: '<p data-evidence="original">&lt;合成资料&gt; &amp; 要点</p>' });
  const html = renderLearningFeedback(value);
  assert.equal(html.split(value.basis).length - 1, 1);
  assert.ok(!html.includes('&amp;lt;'));
  assert.ok(!html.includes('&amp;amp;'));
});

test('重复渲染不访问DOM、存储或计时器，不修改冻结输入或制造全局身份', () => {
  const value = Object.freeze(input({ secondaryActions: Object.freeze([
    '<button type="button" data-action="back">返回温故</button>',
  ]) }));
  const previous = new Map();
  const forbidden = ['document', 'window', 'localStorage', 'sessionStorage', 'setTimeout', 'setInterval', 'requestAnimationFrame'];
  const touched = [];
  try {
    for (const key of forbidden) {
      previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
      Object.defineProperty(globalThis, key, { configurable: true, get() { touched.push(key); throw new Error(`Unexpected access: ${key}`); } });
    }
    const first = renderLearningFeedback(value);
    assert.equal(renderLearningFeedback(value), first);
    assert.doesNotMatch(first, /\b(?:aria-live|autofocus|tabindex|id)=|role="(?:alert|status)"/);
    assert.equal(value.secondaryActions.length, 1);
  } finally {
    for (const key of forbidden) {
      const descriptor = previous.get(key);
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
  assert.deepEqual(touched, []);
});
