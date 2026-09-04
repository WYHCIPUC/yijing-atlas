const REVEAL_SELECTORS = [
  ':scope > .mode-panel',
  ':scope > .hex-detail',
  ':scope > .mode-error',
  ':scope > .mode-loading',
];

const MAGNETIC_SELECTOR = [
  '.mode-btn',
  '.daily-enter',
  '.quick-btn',
  '.coin-cast',
  '.zoom-btn',
  '.explore-tool',
  '.learning-tab',
].join(',');

function getRevealTargets(scope) {
  const surface = scope.querySelector(REVEAL_SELECTORS.join(', ')) || scope.firstElementChild;
  if (!surface) return [];
  const children = [...surface.children].filter((element) => !element.hidden).slice(0, 14);
  return children.length ? children : [surface];
}

export function initCinematicMotion(options = {}) {
  const windowRef = options.windowRef || window;
  const documentRef = options.documentRef || document;
  const panel = options.panel;
  const panelContent = options.panelContent;
  const gsap = options.gsap || windowRef.gsap;
  const Lenis = options.Lenis || windowRef.Lenis;
  const motionPreference = windowRef.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = windowRef.matchMedia('(hover: hover) and (pointer: fine)');
  const aura = documentRef.querySelector('.pointer-aura');
  const cursorTrail = documentRef.querySelector('.cursor-trail');
  const portal = documentRef.querySelector('.mode-portal');
  const hoverCard = documentRef.querySelector('.star-hover-card');
  const modeSwitcher = documentRef.querySelector('.mode-switcher');
  const modeIndicator = documentRef.querySelector('.mode-indicator');
  const readingProgress = documentRef.querySelector('.panel-reading-progress i');
  let lenis = null;
  let observer = null;
  let ticker = null;
  let moveAura = null;
  let activeMagnetic = null;
  let magneticFrame = null;
  let progressFrame = null;
  let pointerX = 0;
  let pointerY = 0;
  let hoverXTo = null;
  let hoverYTo = null;
  let trailIndex = 0;
  let lastTrailX = 0;
  let lastTrailY = 0;
  let lastTrailAt = 0;
  const trailMotes = [];
  const rippleTimers = new Set();
  let activeReadingSection = null;
  let destroyed = false;

  function decorateControls(scope = documentRef) {
    scope.querySelectorAll?.(MAGNETIC_SELECTOR).forEach((control) => control.classList.add('magnetic-control'));
  }

  function clearMagnetic() {
    if (!activeMagnetic) return;
    activeMagnetic.classList.remove('is-magnetic');
    activeMagnetic.style.removeProperty('--magnetic-x');
    activeMagnetic.style.removeProperty('--magnetic-y');
    activeMagnetic = null;
  }

  function paintMagnetic() {
    magneticFrame = null;
    if (!activeMagnetic || motionPreference.matches || !finePointer.matches) return;
    const rect = activeMagnetic.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const x = Math.max(-1, Math.min(1, (pointerX - rect.left - rect.width / 2) / (rect.width / 2)));
    const y = Math.max(-1, Math.min(1, (pointerY - rect.top - rect.height / 2) / (rect.height / 2)));
    activeMagnetic.style.setProperty('--magnetic-x', `${(x * 5.5).toFixed(2)}px`);
    activeMagnetic.style.setProperty('--magnetic-y', `${(y * 4).toFixed(2)}px`);
  }

  function onInteractivePointerOver(event) {
    if (motionPreference.matches || !finePointer.matches) return;
    const control = event.target.closest?.(MAGNETIC_SELECTOR);
    if (!control || control === activeMagnetic) return;
    clearMagnetic();
    activeMagnetic = control;
    control.classList.add('is-magnetic');
  }

  function onInteractivePointerMove(event) {
    pointerX = event.clientX;
    pointerY = event.clientY;
    if (activeMagnetic && magneticFrame === null) magneticFrame = windowRef.requestAnimationFrame(paintMagnetic);
  }

  function onInteractivePointerOut(event) {
    if (!activeMagnetic || activeMagnetic.contains(event.relatedTarget)) return;
    clearMagnetic();
  }

  function onControlPress(event) {
    if (motionPreference.matches) return;
    const control = event.target.closest?.('button, [role="button"]');
    if (!control || control.disabled) return;
    const rect = control.getBoundingClientRect();
    const ripple = documentRef.createElement('span');
    ripple.className = 'motion-ripple';
    ripple.setAttribute('aria-hidden', 'true');
    ripple.style.left = `${event.clientX > 0 ? event.clientX - rect.left : rect.width / 2}px`;
    ripple.style.top = `${event.clientY > 0 ? event.clientY - rect.top : rect.height / 2}px`;
    control.append(ripple);
    const timer = windowRef.setTimeout(() => {
      ripple.remove();
      rippleTimers.delete(timer);
    }, 720);
    rippleTimers.add(timer);
  }

  function syncReadingProgress() {
    progressFrame = null;
    if (!panel || !readingProgress) return;
    const maximum = Math.max(0, panel.scrollHeight - panel.clientHeight);
    const progress = maximum ? Math.min(1, panel.scrollTop / maximum) : 0;
    readingProgress.style.transform = `scaleX(${progress.toFixed(4)})`;
    readingProgress.parentElement?.style.setProperty('--reading-progress', progress.toFixed(4));

    const sections = [...panelContent?.querySelectorAll?.('.detail-section') || []];
    const focusLine = panel.getBoundingClientRect().top + panel.clientHeight * 0.38;
    const nextSection = sections.find((section) => section.getBoundingClientRect().bottom >= focusLine) || sections.at(-1) || null;
    if (nextSection !== activeReadingSection) {
      activeReadingSection?.classList.remove('is-reading');
      activeReadingSection = nextSection;
      activeReadingSection?.classList.add('is-reading');
    }
  }

  function onPanelScroll() {
    if (progressFrame === null) progressFrame = windowRef.requestAnimationFrame(syncReadingProgress);
  }

  function ensureTrailMotes() {
    if (!cursorTrail || trailMotes.length) return;
    for (let index = 0; index < 9; index += 1) {
      const mote = documentRef.createElement('i');
      mote.style.setProperty('--mote-index', index);
      cursorTrail.append(mote);
      trailMotes.push(mote);
    }
  }

  function paintPointerTrail(event) {
    if (!gsap || motionPreference.matches || !finePointer.matches || !trailMotes.length) return;
    const now = windowRef.performance.now();
    const dx = event.clientX - lastTrailX;
    const dy = event.clientY - lastTrailY;
    if (now - lastTrailAt < 42 || Math.hypot(dx, dy) < 15) return;
    lastTrailAt = now;
    lastTrailX = event.clientX;
    lastTrailY = event.clientY;
    const mote = trailMotes[trailIndex % trailMotes.length];
    const offset = trailIndex % 3 - 1;
    trailIndex += 1;
    gsap.killTweensOf(mote);
    gsap.set(mote, {
      x: event.clientX,
      y: event.clientY,
      xPercent: -50,
      yPercent: -50,
      opacity: 0.72,
      scale: 0.72 + (trailIndex % 4) * 0.12,
    });
    gsap.to(mote, {
      x: event.clientX - dx * 0.36 + offset * 4,
      y: event.clientY - dy * 0.36 + offset * 6,
      opacity: 0,
      scale: 0.08,
      duration: 0.64,
      ease: 'power2.out',
      overwrite: true,
    });
  }

  function positionHoverCard(event) {
    if (!hoverCard || !hoverXTo || !hoverYTo) return;
    const x = event.clientX > windowRef.innerWidth - 250 ? event.clientX - 230 : event.clientX + 22;
    const y = event.clientY > windowRef.innerHeight - 150 ? event.clientY - 128 : event.clientY + 18;
    hoverXTo(x);
    hoverYTo(y);
  }

  function hidePointerEffects() {
    hoverCard?.classList.remove('is-visible');
    aura?.classList.remove('is-visible');
    clearMagnetic();
    gsap?.to?.(trailMotes, { opacity: 0, duration: 0.16, overwrite: true });
  }

  function previewHexagram(hexagram, meta = {}) {
    if (!hoverCard || motionPreference.matches || !finePointer.matches || !hexagram) {
      hoverCard?.classList.remove('is-visible');
      return;
    }
    hoverCard.querySelector('[data-hover-number]').textContent = String(hexagram.number).padStart(2, '0');
    hoverCard.querySelector('[data-hover-name]').textContent = hexagram.name;
    hoverCard.querySelector('[data-hover-full-name]').textContent = hexagram.fullName;
    hoverCard.querySelector('[data-hover-code]').textContent = hexagram.binaryCode;
    const degree = Math.max(0, Number(meta.degree) || 0);
    const depth = Number(meta.depthFactor) || 1;
    hoverCard.querySelector('[data-hover-degree]').textContent = String(degree);
    hoverCard.querySelector('[data-hover-depth]').textContent = depth > 1.16 ? '前景星位' : (depth < 0.84 ? '远景星位' : '中景星位');
    hoverCard.querySelector('[data-hover-balance]').textContent = `阳 ${Number(meta.yangCount) || 0} · 阴 ${Number(meta.yinCount) || 0}`;
    hoverCard.classList.add('is-visible');
  }

  function syncModeIndicator(button = modeSwitcher?.querySelector('.mode-btn.active'), { immediate = false } = {}) {
    if (!modeIndicator || !button) return;
    const properties = { x: button.offsetLeft, width: button.offsetWidth, opacity: 1 };
    if (!gsap || motionPreference.matches || immediate) {
      if (gsap) gsap.set(modeIndicator, properties);
      else {
        modeIndicator.style.width = `${properties.width}px`;
        modeIndicator.style.transform = `translateX(${properties.x}px)`;
        modeIndicator.style.opacity = '1';
      }
      return;
    }
    gsap.to(modeIndicator, { ...properties, duration: 0.52, ease: 'power3.out', overwrite: true });
  }

  function onWindowResize() {
    lenis?.resize();
    syncModeIndicator(undefined, { immediate: true });
  }

  function onVisibilityChange() {
    if (documentRef.hidden) hidePointerEffects();
  }

  function ensureLenis() {
    if (lenis || !Lenis || !panel || !panelContent || motionPreference.matches) return;
    lenis = new Lenis({
      wrapper: panel,
      content: panelContent,
      duration: 1.05,
      easing: (value) => Math.min(1, 1.001 - 2 ** (-10 * value)),
      smoothWheel: true,
      syncTouch: false,
      wheelMultiplier: 0.86,
    });
    if (gsap?.ticker) {
      ticker = (time) => lenis?.raf(time * 1000);
      gsap.ticker.add(ticker);
      gsap.ticker.lagSmoothing(0);
    } else {
      const raf = (time) => {
        if (destroyed || !lenis) return;
        lenis.raf(time);
        windowRef.requestAnimationFrame(raf);
      };
      windowRef.requestAnimationFrame(raf);
    }
    observer = new windowRef.MutationObserver((mutations) => {
      lenis?.resize();
      mutations.forEach((mutation) => mutation.addedNodes.forEach((node) => {
        if (node.nodeType === 1) decorateControls(node);
      }));
      syncReadingProgress();
    });
    observer.observe(panelContent, { childList: true, subtree: true });
  }

  function destroyLenis() {
    observer?.disconnect();
    observer = null;
    if (ticker && gsap?.ticker) gsap.ticker.remove(ticker);
    ticker = null;
    lenis?.destroy();
    lenis = null;
  }

  function configureAura() {
    if (!aura || !gsap || motionPreference.matches || !finePointer.matches) {
      aura?.classList.remove('is-visible');
      return;
    }
    gsap.set(aura, { xPercent: -50, yPercent: -50 });
    ensureTrailMotes();
    if (hoverCard) {
      hoverXTo = gsap.quickTo(hoverCard, 'x', { duration: 0.28, ease: 'power3.out' });
      hoverYTo = gsap.quickTo(hoverCard, 'y', { duration: 0.28, ease: 'power3.out' });
    }
    const xTo = gsap.quickTo(aura, 'x', { duration: 0.34, ease: 'power3.out' });
    const yTo = gsap.quickTo(aura, 'y', { duration: 0.34, ease: 'power3.out' });
    moveAura = (event) => {
      xTo(event.clientX);
      yTo(event.clientY);
      aura.classList.add('is-visible');
      paintPointerTrail(event);
      positionHoverCard(event);
    };
    windowRef.addEventListener('pointermove', moveAura, { passive: true });
  }

  function beginMode(mode) {
    if (!gsap || motionPreference.matches) return;
    if (portal) {
      portal.dataset.mode = mode;
      gsap.killTweensOf(portal);
      gsap.timeline().fromTo(portal, {
        autoAlpha: 0,
        scale: 0.64,
        rotation: -14,
      }, {
        autoAlpha: 0.86,
        scale: 1,
        rotation: 0,
        duration: 0.32,
        ease: 'power3.out',
      }).to(portal, {
        autoAlpha: 0,
        scale: 1.52,
        rotation: 18,
        duration: 0.58,
        ease: 'power2.in',
      }, 0.2);
    }
    gsap.killTweensOf(panelContent);
    gsap.to(panelContent, {
      opacity: 0.48,
      y: mode === 'explore' ? 0 : 8,
      duration: 0.18,
      ease: 'power2.out',
      overwrite: true,
    });
    gsap.fromTo('.workspace-insight-bar', { opacity: 0.45, y: 9 }, {
      opacity: 1,
      y: 0,
      duration: 0.72,
      ease: 'power3.out',
      overwrite: true,
    });
  }

  function enterSurface(scope = panelContent, mode = 'explore') {
    lenis?.resize();
    decorateControls(scope);
    syncReadingProgress();
    if (!scope) return;
    const targets = getRevealTargets(scope);
    if (!gsap || motionPreference.matches) {
      targets.forEach((target) => target.removeAttribute('style'));
      scope.style.opacity = '';
      scope.style.transform = '';
      return;
    }
    gsap.killTweensOf(scope);
    gsap.set(scope, { opacity: 1, y: 0 });
    gsap.killTweensOf(targets);
    gsap.fromTo(targets, {
      opacity: 0,
      y: mode === 'quiz' ? 22 : 14,
      scale: 0.992,
      filter: 'blur(5px)',
    }, {
      opacity: 1,
      y: 0,
      scale: 1,
      filter: 'blur(0px)',
      duration: 0.78,
      stagger: 0.055,
      ease: 'power3.out',
      clearProps: 'opacity,transform,filter',
      overwrite: true,
    });
  }

  function resetScroll() {
    if (lenis) lenis.scrollTo(0, { immediate: true, force: true });
    else if (panel) panel.scrollTop = 0;
    syncReadingProgress();
  }

  function onPreferenceChange() {
    if (motionPreference.matches) {
      destroyLenis();
      if (moveAura) windowRef.removeEventListener('pointermove', moveAura);
      moveAura = null;
      aura?.classList.remove('is-visible');
      hidePointerEffects();
      clearMagnetic();
      gsap?.set?.(portal, { clearProps: 'all' });
      gsap?.set?.([panelContent, '.workspace-insight-bar'], { clearProps: 'all' });
      return;
    }
    ensureLenis();
    configureAura();
  }

  ensureLenis();
  configureAura();
  decorateControls();
  syncModeIndicator(undefined, { immediate: true });
  documentRef.addEventListener('pointerover', onInteractivePointerOver, { passive: true });
  documentRef.addEventListener('pointermove', onInteractivePointerMove, { passive: true });
  documentRef.addEventListener('pointerout', onInteractivePointerOut, { passive: true });
  documentRef.addEventListener('pointerdown', onControlPress, { passive: true });
  panel?.addEventListener('scroll', onPanelScroll, { passive: true });
  windowRef.addEventListener('resize', onWindowResize, { passive: true });
  windowRef.addEventListener('blur', hidePointerEffects);
  documentRef.addEventListener('visibilitychange', onVisibilityChange);
  if (motionPreference.addEventListener) motionPreference.addEventListener('change', onPreferenceChange);
  else motionPreference.addListener?.(onPreferenceChange);

  return {
    available: Boolean(gsap || lenis),
    beginMode,
    enterSurface,
    previewHexagram,
    resetScroll,
    syncModeIndicator,
    resize: onWindowResize,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      destroyLenis();
      documentRef.removeEventListener('pointerover', onInteractivePointerOver);
      documentRef.removeEventListener('pointermove', onInteractivePointerMove);
      documentRef.removeEventListener('pointerout', onInteractivePointerOut);
      documentRef.removeEventListener('pointerdown', onControlPress);
      panel?.removeEventListener('scroll', onPanelScroll);
      windowRef.removeEventListener('resize', onWindowResize);
      windowRef.removeEventListener('blur', hidePointerEffects);
      documentRef.removeEventListener('visibilitychange', onVisibilityChange);
      if (moveAura) windowRef.removeEventListener('pointermove', moveAura);
      if (motionPreference.removeEventListener) motionPreference.removeEventListener('change', onPreferenceChange);
      else motionPreference.removeListener?.(onPreferenceChange);
      moveAura = null;
      if (magneticFrame !== null) windowRef.cancelAnimationFrame(magneticFrame);
      if (progressFrame !== null) windowRef.cancelAnimationFrame(progressFrame);
      rippleTimers.forEach((timer) => windowRef.clearTimeout(timer));
      rippleTimers.clear();
      documentRef.querySelectorAll('.motion-ripple').forEach((ripple) => ripple.remove());
      gsap?.killTweensOf?.([portal, panelContent, hoverCard, modeIndicator, ...trailMotes, '.workspace-insight-bar']);
      cursorTrail?.replaceChildren();
      trailMotes.length = 0;
      activeReadingSection?.classList.remove('is-reading');
      activeReadingSection = null;
      clearMagnetic();
    },
  };
}
