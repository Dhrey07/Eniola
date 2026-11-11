import 'lenis/dist/lenis.css';
import './styles/main.css';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { Experience } from './experience/Experience';
import { buildOverlay, buildNav, buildProgress } from './dom/overlay';
import { initCursor, initMagnetic } from './dom/cursor';
import { runLoader } from './dom/loader';
import { toast } from './dom/toast';
import { initPerfOverlay } from './dom/perf';
import { buildMaster, type Master } from './scroll/MasterTimeline';
import { standins } from './experience/globals';
import { content, site, stationOrder, type StationId } from './content';

gsap.registerPlugin(ScrollTrigger);

const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector<T>(s)!;
const expoInOut = (t: number) =>
  t === 0 ? 0 : t === 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2;

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

function applyMeta() {
  document.title = site.title;
  document.querySelector('meta[name="description"]')?.setAttribute('content', site.description);
  document.querySelector('meta[property="og:title"]')?.setAttribute('content', site.title);
}

const cleanups: (() => void)[] = [];

function boot() {
  applyMeta();
  history.scrollRestoration = 'manual';
  const { stations: dom, helpCards } = buildOverlay($('#overlay'));
  buildNav($('#nav'));
  const setProgress = buildProgress($('#progress'));
  cleanups.push(initCursor($('#cursor')), initMagnetic(document));

  // email: copy to clipboard + toast (falls through to mailto if blocked)
  const onClick = (e: MouseEvent) => {
    const copy = (e.target as HTMLElement).closest<HTMLElement>('[data-copy]');
    if (copy && navigator.clipboard) {
      e.preventDefault();
      navigator.clipboard.writeText(copy.dataset.copy!).then(
        () => toast(content.sayhi.copiedToast),
        () => (location.href = (copy as HTMLAnchorElement).href)
      );
    }
  };
  document.addEventListener('click', onClick);
  cleanups.push(() => document.removeEventListener('click', onClick));

  const webgl = hasWebGL() && !new URLSearchParams(location.search).has('static');
  if (!webgl) return bootStatic();
  document.documentElement.classList.add('webgl');
  window.scrollTo(0, 0);

  // ── 3D ──────────────────────────────────────────────────
  const exp = new Experience($<HTMLCanvasElement>('#webgl'));
  exp.world.help.bind(helpCards);

  // ── smooth scroll: Lenis is the ONLY scroll smoother ────
  const reducedMQ = matchMedia('(prefers-reduced-motion: reduce)');
  const lenis = new Lenis({
    lerp: reducedMQ.matches ? 1 : 0.1, // responsive but silky
    smoothWheel: !reducedMQ.matches,
    wheelMultiplier: 1,
    syncTouch: false, // native momentum on touch devices
  });
  lenis.on('scroll', ScrollTrigger.update);
  lenis.on('scroll', (l: Lenis) => exp.setScrollVelocity(l.velocity));
  gsap.ticker.lagSmoothing(0);
  lenis.stop();

  // pointer activity wakes the renderer from its idle half-rate (card tilt, sheen sweeps)
  const onPointer = () => exp.keepAwake(1.5);
  window.addEventListener('pointermove', onPointer, { passive: true });

  // ── master timeline (rebuilt per media condition) ───────
  let master!: Master;
  let reduced = reducedMQ.matches;
  const mm = gsap.matchMedia();
  mm.add({ any: 'all', reduce: '(prefers-reduced-motion: reduce)', mobile: '(max-width: 767px)' }, (ctx) => {
    const c = ctx.conditions as { reduce: boolean; mobile: boolean };
    reduced = c.reduce;
    exp.rig.follow = c.reduce ? Infinity : 14;
    master = buildMaster(exp, dom, { reduced: c.reduce, scrollScale: c.mobile ? 0.7 : 1 });
  });

  // ── UI tick: progress rail, active nav ──────────────────
  const navLinks = Array.from(document.querySelectorAll<HTMLElement>('[data-nav]'));
  let lastIdx = -1;
  let lastP = -1;
  const ui = () => {
    if (!master) return;
    const p = master.tl.progress();
    if (p === lastP) return; // nothing moved: no DOM writes
    lastP = p;
    const idx = master.stationAt(master.tl.time());
    setProgress(p, idx);
    if (idx !== lastIdx) {
      lastIdx = idx;
      const id = stationOrder[idx];
      navLinks.forEach((a) => (a.dataset.nav === id ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current')));
    }
  };

  // ── ONE loop: gsap.ticker drives Lenis → (ScrollTrigger scrubs the timeline
  //    inside lenis.raf) → 3D update + render → UI, in that order, so a wheel
  //    event reaches the screen in the same frame ──────────
  const perf = initPerfOverlay(() => exp.stats());
  const frame = (t: number, deltaMs: number) => {
    lenis.raf(t * 1000);
    exp.update(deltaMs);
    ui();
    perf?.(t * 1000);
  };
  gsap.ticker.add(frame);

  // ── camera fly-to (nav, CTAs, keyboard) ─────────────────
  const flyTo = (id: StationId, focus = false) => {
    const y = id === 'hero' ? 0 : master.labelScroll(id);
    const done = () => {
      if (focus) dom[id].section.focus({ preventScroll: true });
      history.replaceState(null, '', id === 'hero' ? location.pathname : `#${id}`);
    };
    if (reduced) {
      const v = exp.world.veilUniform;
      gsap.timeline()
        .to(v, { value: 1, duration: 0.35, ease: 'sine.in' })
        .add(() => lenis.scrollTo(y, { immediate: true, force: true }))
        .to(v, { value: 0, duration: 0.45, ease: 'sine.out', onComplete: done }, '+=0.05');
      return;
    }
    lenis.scrollTo(y, { duration: id === 'hero' ? 3 : 2.2, easing: expoInOut, force: true, onComplete: done });
  };
  for (const s of Object.values(dom)) s.section.tabIndex = -1;

  const onFly = (e: MouseEvent) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-fly]');
    if (!el) return;
    e.preventDefault();
    flyTo(el.dataset.fly as StationId, e.detail === 0);
  };
  document.addEventListener('click', onFly);

  const onKey = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement;
    if (t.closest('input, textarea, select, [contenteditable]')) return;
    const onControl = !!t.closest('a, button');
    const cur = master.stationAt(master.tl.time());
    let next = -1;
    if (e.key === 'ArrowDown' || e.key === 'PageDown' || (e.key === ' ' && !e.shiftKey && !onControl)) next = cur + 1;
    else if (e.key === 'ArrowUp' || e.key === 'PageUp' || (e.key === ' ' && e.shiftKey && !onControl)) next = cur - 1;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = stationOrder.length - 1;
    if (next < 0 || next >= stationOrder.length) return;
    e.preventDefault();
    flyTo(stationOrder[next], true);
  };
  window.addEventListener('keydown', onKey);

  // ── loader → intro ──────────────────────────────────────
  const hero = dom.hero;
  gsap.set([...hero.words, ...hero.body], { yPercent: 110 });
  gsap.set([...hero.fades, hero.parts.cue], { autoAlpha: 0, y: 20 });
  const heroRoom = exp.world.rooms[0];
  heroRoom.state.reveal = 0;

  // the loader holds at 100 until every texture is on the GPU and every shader is compiled
  const warmed = exp.assets.ready.then(() => exp.prewarm()).catch((e) => console.warn('[prewarm]', e));
  runLoader($('#loader'), exp.assets, warmed).then(() => {
    const intro = gsap.timeline({ defaults: { ease: 'expo.out' } });
    intro
      .to(exp.world.veilUniform, { value: 0, duration: reduced ? 0.6 : 2.0, ease: 'sine.inOut' }, 0)
      .to(exp.rig.intro, { v: 0, duration: reduced ? 0.01 : 2.4 }, 0)
      .to(heroRoom.state, { reveal: 1, duration: 1.8, ease: 'power2.out' }, 0.3)
      .to(hero.words, { yPercent: 0, duration: 1.2, stagger: 0.06, ease: 'power3.out' }, 0.7)
      .to(hero.body, { yPercent: 0, duration: 0.9, stagger: 0.012, ease: 'power3.out' }, 1.0)
      .to(hero.fades, { autoAlpha: 1, y: 0, duration: 0.9, ease: 'power3.out' }, 1.35)
      .to(hero.parts.cue, { autoAlpha: 1, y: 0, duration: 0.8, ease: 'power2.out' }, 1.6)
      .add(() => {
        lenis.start();
        ScrollTrigger.refresh();
        const hash = location.hash.slice(1) as StationId;
        if (hash && stationOrder.includes(hash) && hash !== 'hero') flyTo(hash);
      }, 1.4);
  });

  // ── QA hooks (console): __perf(), __fly('work') ─────────
  const w = window as unknown as Record<string, unknown>;
  w.__perf = () => exp.stats();
  w.__perfRun = (seconds = 30) => perfRun(exp, lenis, seconds);
  w.__fly = (id: StationId) => flyTo(id);
  w.__app = { exp, lenis, get master() { return master; } };

  cleanups.push(() => {
    document.removeEventListener('click', onFly);
    window.removeEventListener('keydown', onKey);
    gsap.ticker.remove(frame);
    window.removeEventListener('pointermove', onPointer);
    document.getElementById('perf')?.remove();
    mm.revert();
    ScrollTrigger.getAll().forEach((t) => t.kill());
    lenis.destroy();
    exp.destroy();
  });
}

/**
 * QA: scroll top → bottom at a constant speed and report frame statistics.
 * Run `await __perfRun()` in the console (same call before/after a change).
 */
function perfRun(exp: Experience, lenis: Lenis, seconds: number) {
  return new Promise((resolve) => {
    lenis.scrollTo(0, { immediate: true, force: true });
    const dts: number[] = [];
    const info = exp.renderer.info;
    const programs0 = info.programs?.length ?? 0;
    let calls = 0;
    let callsMax = 0;
    let last = 0;
    let done = false;
    const tick = (now: number) => {
      if (last) dts.push(now - last);
      last = now;
      calls += info.render.calls;
      callsMax = Math.max(callsMax, info.render.calls);
      if (!done) return requestAnimationFrame(tick);
      dts.sort((a, b) => a - b);
      const n = dts.length;
      const avg = dts.reduce((a, b) => a + b, 0) / n;
      resolve({
        frames: n,
        avgFps: +(1000 / avg).toFixed(1),
        avgMs: +avg.toFixed(2),
        p95Ms: +dts[Math.floor(n * 0.95)].toFixed(2),
        maxMs: +dts[n - 1].toFixed(1),
        over32ms: dts.filter((d) => d > 32).length,
        over50ms: dts.filter((d) => d > 50).length,
        callsAvg: Math.round(calls / (n + 1)),
        callsMax,
        programsStart: programs0,
        programsEnd: info.programs?.length ?? 0,
        dpr: exp.renderer.getPixelRatio(),
      });
    };
    setTimeout(() => {
      requestAnimationFrame(tick);
      lenis.scrollTo(lenis.limit, { duration: seconds, easing: (t) => t, force: true, onComplete: () => setTimeout(() => (done = true), 600) });
    }, 800);
  });
}

/** No WebGL (or ?static): the same content as a styled static page. */
function bootStatic() {
  document.documentElement.classList.add('static');
  $('#webgl').remove();
  $('#loader').style.display = 'none';
  $('#scroll-track').remove();
  const onFly = (e: MouseEvent) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-fly]');
    if (!el) return;
    e.preventDefault();
    document.getElementById(el.dataset.fly!)?.scrollIntoView({ behavior: 'smooth' });
  };
  document.addEventListener('click', onFly);
  cleanups.push(() => document.removeEventListener('click', onFly));
}

function teardown() {
  while (cleanups.length) cleanups.pop()!();
}

/** which of her site photos are still quote cards (so cropped frames can swap to portrait cards) */
async function loadStandins() {
  try {
    const r = await fetch('/images/eniola/placeholders.txt', { cache: 'no-store' });
    if (!r.ok) return;
    for (const name of (await r.text()).split('\n').map((s) => s.trim()).filter(Boolean))
      standins.add(`/images/eniola/${name}.jpg`);
  } catch {
    /* offline or file:// preview; nothing to swap */
  }
}

loadStandins().then(boot);
window.addEventListener('pagehide', teardown, { once: true });
if (import.meta.hot) import.meta.hot.dispose(teardown);
