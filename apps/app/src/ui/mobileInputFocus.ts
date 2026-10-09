// One focus owner per web viewport. Wait for keyboard/browser panning to settle,
// then scroll the form once; typing and result updates never trigger scrolling.
export function installMobileInputFocus(root: HTMLElement) {
  const viewport = window.visualViewport;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let frame = 0;
  let previousField: HTMLElement | null = null;
  let fullHeight = viewport?.height ?? window.innerHeight;
  let keyboardOpen = false;
  let dismissed = false;
  const padding = new Map<HTMLElement, { inline: string; base: number; extra: number }>();

  const restore = () => {
    for (const [content, value] of padding) content.style.paddingBottom = value.inline;
    padding.clear();
  };
  const cancel = () => {
    clearTimeout(timer);
    cancelAnimationFrame(frame);
  };
  const activeField = () => {
    const input = document.activeElement;
    if (!(input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement)) return null;
    if (!root.contains(input) || input.disabled || input.readOnly) return null;
    return input.closest<HTMLElement>('[data-keyboard-placement]');
  };
  const reveal = () => {
    if (viewport && viewport.scale !== 1) return;
    if (window.innerWidth >= 900) {
      restore();
      return;
    }
    const height = viewport?.height ?? window.innerHeight;
    fullHeight = Math.max(fullHeight, height);
    if (fullHeight - height > 120) {
      keyboardOpen = true;
      dismissed = false;
    } else if (keyboardOpen && fullHeight - height < 60) {
      keyboardOpen = false;
      dismissed = true;
      restore();
    }
    const field = activeField();
    if (field !== previousField) restore();
    previousField = field;
    if (!field || dismissed) {
      restore();
      return;
    }
    const results = field.dataset.keyboardPlacement === 'results';
    const parents: HTMLElement[] = [];
    for (
      let parent = field.parentElement;
      parent && root.contains(parent);
      parent = parent.parentElement
    ) {
      if (/^(auto|scroll)$/.test(getComputedStyle(parent).overflowY)) parents.push(parent);
    }
    const viewportTop = viewport?.offsetTop ?? 0;
    const viewportBottom = viewportTop + (viewport?.height ?? window.innerHeight);
    // Outer containers must expose a nested picker before its own scroll is computed.
    parents.reverse();
    for (const [index, scroll] of parents.entries()) {
      const bounds = scroll.getBoundingClientRect();
      const top = Math.max(viewportTop, bounds.top + scroll.clientTop) + 12;
      const bottom =
        Math.min(viewportBottom, bounds.top + scroll.clientTop + scroll.clientHeight) - 12;
      if (bottom <= top) continue;
      const rect = (parents[index + 1] ?? field).getBoundingClientRect();
      const delta =
        results || rect.height > bottom - top || rect.top < top
          ? rect.top - top
          : Math.max(0, rect.bottom - bottom);
      if (Math.abs(delta) < 1) continue;
      const target = Math.max(0, scroll.scrollTop + delta);
      const missing = target - (scroll.scrollHeight - scroll.clientHeight);
      // A short result list still needs enough trailing space to lift its query.
      const content = scroll.firstElementChild;
      if (missing > 0 && content instanceof HTMLElement && content.contains(field)) {
        const saved = padding.get(content) ?? {
          inline: content.style.paddingBottom,
          base: parseFloat(getComputedStyle(content).paddingBottom) || 0,
          extra: 0,
        };
        saved.extra += missing;
        padding.set(content, saved);
        content.style.paddingBottom = `${saved.base + saved.extra}px`;
      }
      // React Native Web replaces the host node's scrollTo with its { x, y }
      // imperative API. Call the DOM method explicitly for pixel/behavior options.
      const scrollTo: (options: ScrollToOptions) => void = Element.prototype.scrollTo;
      scrollTo.call(scroll, {
        top: target,
        behavior:
          scroll === parents[parents.length - 1] &&
          !window.matchMedia('(prefers-reduced-motion: reduce)').matches
            ? 'smooth'
            : 'instant',
      });
    }
  };
  const schedule = () => {
    cancel();
    timer = setTimeout(() => {
      frame = requestAnimationFrame(reveal);
    }, 120);
  };
  const focus = () => {
    dismissed = false;
    schedule();
  };
  const removedField = new MutationObserver(() => {
    if (previousField && !root.contains(previousField)) {
      cancel();
      restore();
      previousField = null;
    }
  });
  removedField.observe(root, { childList: true, subtree: true });
  root.addEventListener('focusin', focus);
  root.addEventListener('focusout', schedule);
  viewport?.addEventListener('resize', schedule);
  viewport?.addEventListener('scroll', schedule);
  window.addEventListener('resize', schedule);
  return () => {
    removedField.disconnect();
    cancel();
    restore();
    root.removeEventListener('focusin', focus);
    root.removeEventListener('focusout', schedule);
    viewport?.removeEventListener('resize', schedule);
    viewport?.removeEventListener('scroll', schedule);
    window.removeEventListener('resize', schedule);
  };
}
