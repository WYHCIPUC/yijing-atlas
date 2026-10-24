import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { createPageDom } from './helpers/quiz-page-dom.mjs';

const source = readFileSync(new URL('../js/almanac-knowledge.js', import.meta.url), 'utf8')
  .replaceAll('export function ', 'function ');
const terms = [{ id: 'jian', name: '建日', category: '建除十二神', meaning: '建的原释义', principle: '项目整理，待校验' },
  { id: 'xiu', name: '休', category: '其他', meaning: '其他分类同样可定位' }];
function harness() {
  const dom = createPageDom(); const context = vm.createContext({ window: dom.window, document: dom.document });
  vm.runInContext(source, context);
  return { ...dom, render: options => context.renderAlmanacKnowledgePage(dom.mount, { almanacTerms: terms }, options) };
}
test('原术语按稳定ID展开并在外层归零后定位，保留上下文返回', () => {
  for (const termId of ['jian', 'xiu']) {
    const h = harness(); let returned = 0;
    h.render({ termId, showBackLink: false, onBack: () => returned++, backLabel: '返回错题回练' });
    h.flushFrames();
    const target = h.mount.querySelector(`[data-term-id="${termId}"]`);
    assert.ok(target); assert.equal(target.open, true); assert.ok(target.scrolled);
    assert.equal(h.document.activeElement, target.querySelector('summary'));
    h.click('[data-action="term-back"]'); assert.equal(returned, 1);
  }
});
test('术语已失效有真实原因与返回，不展开其他术语冒充原来源', () => {
  const h = harness(); let returned = 0;
  h.render({ termId: 'removed', onBack: () => returned++ }); h.flushFrames();
  assert.match(h.mount.textContent, /术语.*(?:已调整|不可用|未找到)/);
  assert.equal(h.mount.querySelectorAll('details').filter(item => item.open).length, 0);
  h.click('[data-action="term-back"]'); assert.equal(returned, 1);
});
test('销毁或替换DOM后来源定位不再滚动/抢焦点，返回也失效', () => {
  const h = harness(); let returned = 0;
  const cleanup = h.render({ termId: 'jian', onBack: () => returned++ });
  const target = h.mount.querySelector('[data-term-id="jian"]'); const back = h.mount.querySelector('[data-action="term-back"]');
  assert.equal(typeof cleanup, 'function'); cleanup(); h.mount.innerHTML = '<h3>下一页</h3>'; h.flushFrames(); h.click(back);
  assert.equal(target.scrolled, undefined); assert.equal(returned, 0); assert.equal(h.document.activeElement, null);
});
