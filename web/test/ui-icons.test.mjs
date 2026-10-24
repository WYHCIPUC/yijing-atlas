import assert from 'node:assert/strict';
import test from 'node:test';

function makeDocument() {
  const documentRef = {
    createElementNS(namespace, tagName) {
      return {
        namespaceURI: namespace,
        tagName,
        attributes: new Map(),
        children: [],
        setAttribute(name, value) { this.attributes.set(name, String(value)); },
        appendChild(child) { this.children.push(child); },
      };
    },
  };
  return documentRef;
}

test('本地 Lucide 图标只创建白名单 SVG，默认从辅助技术中隐藏', async () => {
  const { createUIIcon } = await import('../js/ui-icons.js');
  const documentRef = makeDocument();
  const icon = createUIIcon('search', documentRef);
  assert.equal(icon.tagName, 'svg');
  assert.equal(icon.namespaceURI, 'http://www.w3.org/2000/svg');
  assert.equal(icon.attributes.get('viewBox'), '0 0 24 24');
  assert.equal(icon.attributes.get('aria-hidden'), 'true');
  assert.equal(icon.attributes.get('focusable'), 'false');
  assert.ok(icon.children.length > 0);
  assert.ok(icon.children.every((child) => ['path', 'circle', 'rect'].includes(child.tagName)));
  assert.equal(createUIIcon('<script>', documentRef), null);
  assert.equal(createUIIcon('__proto__', documentRef), null);
});

test('图标安装可重复调用，切换图标时只更新图形而保留宿主及按钮语义', async () => {
  const { installUIIcons } = await import('../js/ui-icons.js');
  const documentRef = makeDocument();
  const host = {
    ownerDocument: documentRef,
    dataset: { icon: 'volume-2' },
    children: [],
    matches(selector) { return selector === '[data-icon]'; },
    querySelectorAll() { return []; },
    replaceChildren(icon) { this.children = [icon]; },
  };
  assert.equal(installUIIcons(host), 1);
  const firstIcon = host.children[0];
  assert.equal(installUIIcons(host), 0);
  assert.equal(host.children[0], firstIcon);
  host.dataset.icon = 'volume-x';
  assert.equal(installUIIcons(host), 1);
  assert.notEqual(host.children[0], firstIcon);
  host.dataset.icon = 'not-an-icon';
  assert.equal(installUIIcons(host), 0);
});
