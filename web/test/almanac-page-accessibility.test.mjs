import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function loadJson(path) {
  return JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
}

function makeControl(documentRef, dataset = {}) {
  const attributes = new Map();
  const listeners = new Map();
  return {
    dataset,
    attributes,
    listeners,
    isConnected: true,
    onclick: null,
    onchange: null,
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
    setAttribute(name, value) {
      attributes.set(name, String(value));
    },
    focus() {
      documentRef.activeElement = this;
    },
  };
}

test('黄历术语使用按钮，并提供完整的模态弹层键盘交互', async () => {
  const listeners = new Map();
  const overlays = [];
  const documentRef = {
    activeElement: null,
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
    removeEventListener(type, listener) {
      if (listeners.get(type) === listener) listeners.delete(type);
    },
    createElement() {
      const closeButton = makeControl(documentRef);
      const dialog = makeControl(documentRef);
      dialog.querySelectorAll = () => [closeButton];
      const overlayListeners = new Map();
      const overlay = {
        className: '',
        innerHTML: '',
        isConnected: true,
        removed: false,
        listeners: overlayListeners,
        closeButton,
        dialog,
        querySelector(selector) {
          if (selector === '.alm-popup') return dialog;
          if (selector === '.alm-popup-close') return closeButton;
          return null;
        },
        addEventListener(type, listener) {
          overlayListeners.set(type, listener);
        },
        remove() {
          this.removed = true;
          this.isConnected = false;
        },
      };
      overlays.push(overlay);
      return overlay;
    },
    body: {
      appendChild(node) {
        node.isConnected = true;
      },
    },
  };

  globalThis.document = documentRef;
  globalThis.window = { scrollTo() {} };

  const trigger = makeControl(documentRef, { term: '建' });
  const controls = new Map([
    ['#alm-prev', makeControl(documentRef)],
    ['#alm-next', makeControl(documentRef)],
    ['#alm-picker', makeControl(documentRef)],
  ]);
  const mount = {
    innerHTML: '',
    querySelector(selector) {
      return controls.get(selector);
    },
    querySelectorAll(selector) {
      return selector === '.term-clickable, .yj-tag' ? [trigger] : [];
    },
  };

  const { renderAlmanacPage } = await import('../js/almanac-page.js');
  renderAlmanacPage(mount, {
    almanacTerms: loadJson('../data/almanac-terms.json'),
    almanacYiji: loadJson('../data/almanac-yiji.json'),
  });

  assert.match(mount.innerHTML, /<button type="button" class="zw-item term-clickable alm-term-button"/);
  assert.match(mount.innerHTML, /<button type="button" class="yj-tag"/);
  assert.match(mount.innerHTML, /aria-haspopup="dialog"/);

  trigger.onclick({ stopPropagation() {} });
  const firstOverlay = overlays.at(-1);
  assert.match(firstOverlay.innerHTML, /role="dialog"/);
  assert.match(firstOverlay.innerHTML, /aria-modal="true"/);
  assert.match(firstOverlay.innerHTML, /aria-labelledby="alm-popup-title"/);
  assert.match(firstOverlay.innerHTML, /id="alm-popup-title"/);
  assert.equal(trigger.attributes.get('aria-expanded'), 'true');
  assert.equal(documentRef.activeElement, firstOverlay.closeButton);

  let tabPrevented = false;
  listeners.get('keydown')({
    key: 'Tab',
    shiftKey: false,
    preventDefault() { tabPrevented = true; },
  });
  assert.equal(tabPrevented, true);
  assert.equal(documentRef.activeElement, firstOverlay.closeButton);

  let escapePrevented = false;
  listeners.get('keydown')({
    key: 'Escape',
    preventDefault() { escapePrevented = true; },
  });
  assert.equal(escapePrevented, true);
  assert.equal(firstOverlay.removed, true);
  assert.equal(trigger.attributes.get('aria-expanded'), 'false');
  assert.equal(documentRef.activeElement, trigger);
  assert.equal(listeners.has('keydown'), false);

  trigger.onclick({ stopPropagation() {} });
  const secondOverlay = overlays.at(-1);
  secondOverlay.listeners.get('click')({ target: secondOverlay });
  assert.equal(secondOverlay.removed, true);
  assert.equal(documentRef.activeElement, trigger);

  trigger.onclick({ stopPropagation() {} });
  const thirdOverlay = overlays.at(-1);
  thirdOverlay.closeButton.listeners.get('click')();
  assert.equal(thirdOverlay.removed, true);
  assert.equal(documentRef.activeElement, trigger);
});
