import gsap from 'gsap';

/**
 * Custom cursor: 10px dot + damped follower ring that grows with a label
 * ("View", "Say hi", …) over [data-cursor] elements. Difference blend.
 * Also: magnetic pull for .magnetic elements within an 80px radius.
 */
export function initCursor(root: HTMLElement) {
  const fine = matchMedia('(pointer: fine)').matches;
  if (!fine) {
    root.remove();
    return () => {};
  }
  document.documentElement.classList.add('has-cursor');
  const dot = root.querySelector<HTMLElement>('.cursor__dot')!;
  const ring = root.querySelector<HTMLElement>('.cursor__ring')!;
  const label = ring.querySelector<HTMLElement>('span')!;
  const pos = { x: innerWidth / 2, y: innerHeight / 2 };
  const ringPos = { ...pos };
  const setDot = { x: gsap.quickSetter(dot, 'x', 'px'), y: gsap.quickSetter(dot, 'y', 'px') };
  const setRing = { x: gsap.quickSetter(ring, 'x', 'px'), y: gsap.quickSetter(ring, 'y', 'px') };

  const onMove = (e: PointerEvent) => {
    pos.x = e.clientX;
    pos.y = e.clientY;
    root.classList.add('is-visible');
  };
  const onOver = (e: PointerEvent) => {
    const t = (e.target as HTMLElement).closest<HTMLElement>('[data-cursor], a, button');
    if (t) {
      label.textContent = t.dataset.cursor ?? 'View';
      root.classList.add('is-active');
    } else {
      root.classList.remove('is-active');
    }
  };
  const onLeave = () => root.classList.remove('is-visible');

  // same ticker as the renderer; transforms are only written while something is moving
  let dotX = NaN;
  let dotY = NaN;
  let settled = false;
  const tick = () => {
    if (pos.x !== dotX || pos.y !== dotY) {
      dotX = pos.x;
      dotY = pos.y;
      setDot.x(dotX);
      setDot.y(dotY);
      settled = false;
    }
    if (settled) return;
    const k = 1 - Math.pow(0.82, gsap.ticker.deltaRatio());
    ringPos.x += (pos.x - ringPos.x) * k;
    ringPos.y += (pos.y - ringPos.y) * k;
    if (Math.abs(pos.x - ringPos.x) < 0.01 && Math.abs(pos.y - ringPos.y) < 0.01) {
      ringPos.x = pos.x;
      ringPos.y = pos.y;
      settled = true;
    }
    setRing.x(ringPos.x);
    setRing.y(ringPos.y);
  };
  window.addEventListener('pointermove', onMove);
  document.addEventListener('pointerover', onOver);
  document.addEventListener('pointerleave', onLeave);
  gsap.ticker.add(tick);
  return () => {
    window.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerover', onOver);
    document.removeEventListener('pointerleave', onLeave);
    gsap.ticker.remove(tick);
  };
}

export function initMagnetic(scope: ParentNode, radius = 80, strength = 0.35) {
  if (!matchMedia('(pointer: fine)').matches) return () => {};
  const els = Array.from(scope.querySelectorAll<HTMLElement>('.magnetic'));
  const movers = els.map((el) => ({
    el,
    x: gsap.quickTo(el, 'x', { duration: 0.6, ease: 'power3.out' }),
    y: gsap.quickTo(el, 'y', { duration: 0.6, ease: 'power3.out' }),
  }));
  // pointermove can fire several times per frame: record it, and measure once per tick
  let px = 0;
  let py = 0;
  let dirty = false;
  const onMove = (e: PointerEvent) => {
    px = e.clientX;
    py = e.clientY;
    dirty = true;
  };
  const tick = () => {
    if (!dirty) return;
    dirty = false;
    for (let i = 0; i < movers.length; i++) {
      const m = movers[i];
      const r = m.el.getBoundingClientRect();
      if (!r.width) continue;
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dx = px - cx;
      const dy = py - cy;
      // distance to the element's edge, not its centre
      const ex = Math.max(0, Math.abs(dx) - r.width / 2);
      const ey = Math.max(0, Math.abs(dy) - r.height / 2);
      if (Math.hypot(ex, ey) < radius) {
        m.x(dx * strength);
        m.y(dy * strength);
      } else {
        m.x(0);
        m.y(0);
      }
    }
  };
  window.addEventListener('pointermove', onMove, { passive: true });
  gsap.ticker.add(tick);
  return () => {
    window.removeEventListener('pointermove', onMove);
    gsap.ticker.remove(tick);
  };
}
