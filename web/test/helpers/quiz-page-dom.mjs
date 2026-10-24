// Small DOM fixture for executing the real native page modules in a VM.
export function createPageDom() {
  const document = { activeElement: null };
  function node(tag = 'div', attributes = {}, root = false) {
    const item = {
      tagName: tag.toUpperCase(), attributes: { ...attributes }, children: [], parentElement: null,
      events: {}, dataset: {}, disabled: false, hidden: false, scrollTop: 0, focusCount: 0,
      get isConnected() { return root || Boolean(this.parentElement?.isConnected); },
      setAttribute(name, value) {
        this.attributes[name] = String(value);
        if (name.startsWith('data-')) this.dataset[name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = String(value);
        if (name === 'disabled' || name === 'hidden' || name === 'open') this[name] = true;
      },
      getAttribute(name) { return this.attributes[name] ?? null; },
      removeAttribute(name) { delete this.attributes[name]; if (name === 'disabled' || name === 'hidden') this[name] = false; },
      addEventListener(type, callback) { this.events[type] = callback; },
      removeEventListener(type) { delete this.events[type]; },
      focus() { this.focusCount++; document.activeElement = this; },
      scrollIntoView(options) { this.scrolled = options; },
      contains(target) { return this === target || this.children.some(child => child.contains(target)); },
      closest(selector) { return matches(this, selector) ? this : this.parentElement?.closest(selector) || null; },
      querySelectorAll(selector) {
        const selectors = selector.split(',').map(value => value.trim());
        const found = [];
        const visit = current => current.children.forEach(child => {
          if (selectors.some(value => matchesPath(child, value))) found.push(child);
          visit(child);
        });
        visit(this); return found;
      },
      querySelector(selector) { return this.querySelectorAll(selector)[0] || null; },
      get textContent() { return this.tagName === '#TEXT' ? this.value : this.children.map(child => child.textContent).join(''); },
      set textContent(value) {
        this.children.forEach(child => { child.parentElement = null; });
        const text = node('#text'); text.value = String(value); text.parentElement = this; this.children = [text];
      },
      get innerHTML() { return this.html || ''; },
      set innerHTML(html) {
        this.html = html; this.children.forEach(child => { child.parentElement = null; }); this.children = [];
        const stack = [this];
        for (const match of html.matchAll(/<(\/?)([a-z][\w-]*)([^>]*)>|([^<]+)/gi)) {
          if (match[4] !== undefined) {
            const text = node('#text'); text.value = match[4]; text.parentElement = stack.at(-1); stack.at(-1).children.push(text);
          } else if (match[1]) {
            if (stack.length > 1) stack.pop();
          } else {
            const attrs = Object.fromEntries([...match[3].matchAll(/([\w-]+)(?:="([^"]*)")?/g)].map(([, name, value]) => [name, value ?? '']));
            const child = node(match[2], attrs); child.parentElement = stack.at(-1); stack.at(-1).children.push(child);
            if (!['input', 'br', 'img', 'hr', 'meta', 'link'].includes(match[2])) stack.push(child);
          }
        }
      },
    };
    item.classList = {
      contains: value => (item.attributes.class || '').split(/\s+/).includes(value),
      add(...values) { item.attributes.class = [...new Set([...(item.attributes.class || '').split(/\s+/).filter(Boolean), ...values])].join(' '); },
      remove(...values) { item.attributes.class = (item.attributes.class || '').split(/\s+/).filter(value => !values.includes(value)).join(' '); },
      toggle(value, enabled) { const add = enabled ?? !this.contains(value); if (add) this.add(value); else this.remove(value); },
    };
    Object.entries(attributes).forEach(([name, value]) => item.setAttribute(name, value));
    return item;
  }
  function matches(item, selector) {
    const name = selector.match(/^[a-z][\w-]*/i)?.[0];
    if (name && item.tagName !== name.toUpperCase()) return false;
    for (const [, kind, value] of selector.matchAll(/([.#])([\w-]+)/g)) {
      if (kind === '.' ? !item.classList.contains(value) : item.attributes.id !== value) return false;
    }
    for (const [, name, value] of selector.matchAll(/\[([\w-]+)(?:="([^"]*)")?\]/g)) {
      if (!Object.hasOwn(item.attributes, name) || (value !== undefined && item.attributes[name] !== value)) return false;
    }
    return item.tagName !== '#TEXT';
  }
  function matchesPath(item, selector) {
    const parts = selector.split(/\s+/); if (!matches(item, parts.pop())) return false;
    let parent = item.parentElement;
    while (parts.length) {
      const wanted = parts.pop(); while (parent && !matches(parent, wanted)) parent = parent.parentElement;
      if (!parent) return false; parent = parent.parentElement;
    }
    return true;
  }
  const panel = node('section', { class: 'detail-panel' }, true);
  const mount = node(); mount.parentElement = panel; panel.children.push(mount);
  const frames = new Map(); let nextFrame = 0;
  const window = {
    requestAnimationFrame(callback) { frames.set(++nextFrame, callback); return nextFrame; },
    cancelAnimationFrame(id) { frames.delete(id); },
    matchMedia: () => ({ matches: true }),
  };
  const flushFrames = () => { for (let i = 0; frames.size && i < 20; i++) { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(callback => callback()); } };
  const click = selector => {
    const target = typeof selector === 'string' ? mount.querySelector(selector) : selector;
    if (!target?.events.click) throw new Error(`Missing actionable target: ${selector}`);
    target.events.click({ currentTarget: target, target, preventDefault() {} });
  };
  return { document, window, mount, panel, click, flushFrames, node };
}
