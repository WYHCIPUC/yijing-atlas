const MOTION_ITEM_SELECTOR = [
  '.daily-kicker',
  '.daily-intro h1',
  '.daily-intro > p',
  '.daily-roadmap > *',
  '.daily-entry-actions > *',
  '.daily-oracle > *',
  '.mode-hero > *',
  '.learning-tabs > *',
  '.today-primary-card > *',
  '.today-support-grid > *',
  '.library-grid > *',
  '.ability-list > *',
  '.seal-list > *',
  '.study-stage',
  '.study-stat',
  '.lesson-stage-rail > *',
  '.lesson-concept-card > *',
  '.lesson-progress-strip > *',
  '.alm-card',
  '.review-due-item',
  '.quiz-question',
  '.quiz-option',
  '.divine-ritual > *',
  '.cast-result-head > *',
  '.cast-lines > *',
  '.divine-insight-grid > *',
  '.detail-section',
  '.search-option',
  '.workspace-insight-bar > *',
  '.guaxu-header > *',
  '.guaxu-wheel-stage > *',
  '.guaxu-result-card > *',
].join(',');

const MOTION_SURFACE_SELECTOR = [
  '.daily-card',
  '.lesson-overview-workspace',
  '.today-primary-card',
  '.today-support-card',
  '.library-card',
  '.ability-panel',
  '.seal-panel',
  '.alm-card',
  '.review-due-item',
  '.flip-card',
  '.quiz-question',
  '.quiz-option',
  '.divine-cast-stage',
  '.cast-result-head',
  '.detail-section',
  '.guaxu-dialog',
].join(',');

const AMBIENT_SELECTOR = [
  '.daily-card',
  '.daily-oracle',
  '.academy-celestial-scene',
  '.lesson-taiji-map img',
  '.guaxu-dialog',
].join(',');

const PRESS_SELECTOR = 'button, [role="button"]';
const MAX_STAGGER_INDEX = 18;

function collect(root, selector) {
  if (!root) return [];
  const found = [];
  if (root.nodeType === 1 && root.matches?.(selector)) found.push(root);
  root.querySelectorAll?.(selector).forEach((element) => found.push(element));
  return found;
}

export function getMotionDelay(index) {
  return Math.min(Math.max(0, index), MAX_STAGGER_INDEX) * 34;
}

export function initMotionSystem({
  root = document,
  windowRef = window,
  documentRef = document,
} = {}) {
  const body = documentRef.body;
  const motionPreference = windowRef.matchMedia('(prefers-reduced-motion: reduce)');
  const coarsePointer = windowRef.matchMedia('(hover: none), (pointer: coarse)');
  const observedAmbient = new WeakSet();
  const pressTimers = new WeakMap();
  const activePressTimers = new Set();
  const entrySettlers = new WeakMap();
  const activeEntrySettlers = new Set();
  let reducedMotion = motionPreference.matches;
  let activeSurface = null;
  let pointerFrame = null;
  let pointerX = 0;
  let pointerY = 0;
  let mutationFrame = null;
  const pendingRoots = new Set();

  const ambientObserver = typeof IntersectionObserver === 'function'
    ? new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        entry.target.classList.toggle('motion-offscreen', !entry.isIntersecting);
      });
    }, { threshold: 0.01 })
    : null;

  function observeAmbient(scope) {
    if (!ambientObserver) return;
    collect(scope, AMBIENT_SELECTOR).forEach((element) => {
      if (observedAmbient.has(element)) return;
      observedAmbient.add(element);
      ambientObserver.observe(element);
    });
  }

  function reveal(scope = root, { animate = true } = {}) {
    const items = collect(scope, MOTION_ITEM_SELECTOR);
    items.forEach((element, index) => {
      element.classList.add('motion-item');
      element.style.setProperty('--motion-delay', `${getMotionDelay(index)}ms`);
      entrySettlers.get(element)?.();
      if (!animate || reducedMotion || documentRef.hidden || element.closest('[hidden]')) {
        element.classList.remove('motion-item-enter');
        return;
      }
      element.classList.add('motion-item-enter');
      const settle = () => {
        element.removeEventListener('animationend', settle);
        element.removeEventListener('animationcancel', settle);
        element.classList.remove('motion-item-enter');
        entrySettlers.delete(element);
        activeEntrySettlers.delete(settle);
      };
      entrySettlers.set(element, settle);
      activeEntrySettlers.add(settle);
      element.addEventListener('animationend', settle, { once: true });
      element.addEventListener('animationcancel', settle, { once: true });
    });
    collect(scope, MOTION_SURFACE_SELECTOR).forEach((element) => {
      element.classList.add('motion-surface');
      element.dataset.motionSurface = '';
    });
    observeAmbient(scope);
  }

  function clearSurface() {
    if (!activeSurface) return;
    activeSurface.classList.remove('is-motion-hovered');
    activeSurface.style.removeProperty('--motion-x');
    activeSurface.style.removeProperty('--motion-y');
    activeSurface.style.removeProperty('--motion-rotate-x');
    activeSurface.style.removeProperty('--motion-rotate-y');
    activeSurface = null;
  }

  function paintPointer() {
    pointerFrame = null;
    if (!activeSurface || reducedMotion || coarsePointer.matches || documentRef.hidden) return;
    const rect = activeSurface.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const x = Math.max(0, Math.min(1, (pointerX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (pointerY - rect.top) / rect.height));
    activeSurface.style.setProperty('--motion-x', `${(x * 100).toFixed(1)}%`);
    activeSurface.style.setProperty('--motion-y', `${(y * 100).toFixed(1)}%`);
    activeSurface.style.setProperty('--motion-rotate-x', `${((0.5 - y) * 1.8).toFixed(2)}deg`);
    activeSurface.style.setProperty('--motion-rotate-y', `${((x - 0.5) * 2.2).toFixed(2)}deg`);
  }

  function onPointerOver(event) {
    if (reducedMotion || coarsePointer.matches) return;
    const surface = event.target.closest?.('[data-motion-surface]');
    if (!surface || !root.contains(surface) || surface === activeSurface) return;
    clearSurface();
    activeSurface = surface;
    activeSurface.classList.add('is-motion-hovered');
  }

  function onPointerMove(event) {
    if (!activeSurface || reducedMotion || coarsePointer.matches) return;
    pointerX = event.clientX;
    pointerY = event.clientY;
    if (pointerFrame === null) pointerFrame = windowRef.requestAnimationFrame(paintPointer);
  }

  function onPointerOut(event) {
    if (!activeSurface || activeSurface.contains(event.relatedTarget)) return;
    clearSurface();
  }

  function onPress(event) {
    const control = event.target.closest?.(PRESS_SELECTOR);
    if (!control || !root.contains(control) || control.disabled || reducedMotion) return;
    const rect = control.getBoundingClientRect();
    const x = Number.isFinite(event.clientX) && event.clientX > 0 ? event.clientX - rect.left : rect.width / 2;
    const y = Number.isFinite(event.clientY) && event.clientY > 0 ? event.clientY - rect.top : rect.height / 2;
    control.style.setProperty('--motion-press-x', `${x}px`);
    control.style.setProperty('--motion-press-y', `${y}px`);
    control.classList.remove('motion-pressed');
    void control.offsetWidth;
    control.classList.add('motion-pressed');
    const previousTimer = pressTimers.get(control);
    if (previousTimer) {
      windowRef.clearTimeout(previousTimer);
      activePressTimers.delete(previousTimer);
    }
    const timer = windowRef.setTimeout(() => {
      control.classList.remove('motion-pressed');
      pressTimers.delete(control);
      activePressTimers.delete(timer);
    }, 460);
    pressTimers.set(control, timer);
    activePressTimers.add(timer);
  }

  function flushMutations() {
    mutationFrame = null;
    const roots = [...pendingRoots];
    pendingRoots.clear();
    const parentCounts = new Map();
    roots.forEach((scope) => {
      if (!scope.parentElement) return;
      parentCounts.set(scope.parentElement, (parentCounts.get(scope.parentElement) || 0) + 1);
    });
    const scopes = new Set(roots.map((scope) => (
      scope.parentElement && parentCounts.get(scope.parentElement) > 1
        ? scope.parentElement
        : scope
    )));
    scopes.forEach((scope) => reveal(scope));
  }

  const mutationObserver = typeof MutationObserver === 'function'
    ? new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        const addedElements = [...mutation.addedNodes].filter((node) => node.nodeType === 1);
        if (addedElements.length > 1 && mutation.target.nodeType === 1) {
          pendingRoots.add(mutation.target);
          return;
        }
        addedElements.forEach((node) => pendingRoots.add(node));
      });
      if (pendingRoots.size && mutationFrame === null) {
        mutationFrame = windowRef.requestAnimationFrame(flushMutations);
      }
    })
    : null;

  function syncMotionPreference(event = motionPreference) {
    reducedMotion = event.matches;
    body.classList.toggle('motion-reduced', reducedMotion);
    if (reducedMotion) clearSurface();
  }

  function syncVisibility() {
    body.classList.toggle('motion-paused', documentRef.hidden);
    if (documentRef.hidden) clearSurface();
  }

  root.addEventListener('pointerover', onPointerOver, { passive: true });
  root.addEventListener('pointermove', onPointerMove, { passive: true });
  root.addEventListener('pointerout', onPointerOut, { passive: true });
  root.addEventListener('pointerdown', onPress, { passive: true });
  documentRef.addEventListener('visibilitychange', syncVisibility);
  windowRef.addEventListener('blur', clearSurface);
  if (motionPreference.addEventListener) motionPreference.addEventListener('change', syncMotionPreference);
  else motionPreference.addListener?.(syncMotionPreference);
  mutationObserver?.observe(root, { childList: true, subtree: true });
  body.classList.add('motion-system-ready');
  syncMotionPreference();
  syncVisibility();
  reveal(root);

  return {
    reveal,
    destroy() {
      root.removeEventListener('pointerover', onPointerOver);
      root.removeEventListener('pointermove', onPointerMove);
      root.removeEventListener('pointerout', onPointerOut);
      root.removeEventListener('pointerdown', onPress);
      documentRef.removeEventListener('visibilitychange', syncVisibility);
      windowRef.removeEventListener('blur', clearSurface);
      if (motionPreference.removeEventListener) motionPreference.removeEventListener('change', syncMotionPreference);
      else motionPreference.removeListener?.(syncMotionPreference);
      mutationObserver?.disconnect();
      ambientObserver?.disconnect();
      if (pointerFrame !== null) windowRef.cancelAnimationFrame(pointerFrame);
      if (mutationFrame !== null) windowRef.cancelAnimationFrame(mutationFrame);
      activePressTimers.forEach((timer) => windowRef.clearTimeout(timer));
      activePressTimers.clear();
      activeEntrySettlers.forEach((settle) => settle());
      activeEntrySettlers.clear();
      clearSurface();
      body.classList.remove('motion-system-ready', 'motion-paused', 'motion-reduced');
    },
  };
}
