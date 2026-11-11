import gsap from 'gsap';

export interface Loadable {
  progress: number;
  onProgress?: (p: number) => void;
  ready: Promise<void>;
}

/**
 * Preloader: counts 0–100 following the LoadingManager, then the digits
 * fall away. Resolves as the loader starts to clear (min ~1.2s for rhythm).
 * An optional `hold` promise keeps it at 100 until the GPU pre-warm is done.
 */
export function runLoader(el: HTMLElement, assets: Loadable | null, hold?: Promise<unknown>) {
  const count = el.querySelector<HTMLElement>('.loader__count span')!;
  const shown = { v: 0 };
  const started = performance.now();
  const render = () => (count.textContent = String(Math.round(shown.v)));
  const go = (p: number) =>
    gsap.to(shown, { v: p * 100, duration: 0.6, ease: 'power2.out', overwrite: true, onUpdate: render });

  return new Promise<void>((resolve) => {
    const finish = () => {
      go(1);
      const wait = Math.max(0, 1200 - (performance.now() - started)) / 1000 + 0.65;
      gsap.delayedCall(wait, () => {
        count.textContent = '100';
        count.innerHTML = '100'.split('').map((d) => `<i>${d}</i>`).join('');
        const tl = gsap.timeline({ onComplete: () => (el.style.display = 'none') });
        tl.to(count.querySelectorAll('i'), { yPercent: 120, rotate: 8, opacity: 0, stagger: 0.07, duration: 0.7, ease: 'power3.in' })
          .to(el.querySelector('.loader__label'), { opacity: 0, duration: 0.4 }, 0)
          .to(el, { autoAlpha: 0, duration: 0.6, ease: 'power2.out' }, 0.45)
          .add(resolve, 0.35);
      });
    };
    if (!assets) return finish();
    go(assets.progress);
    assets.onProgress = go;
    // `hold` (GPU pre-warm) keeps the counter at 100 until nothing is left to compile or upload
    Promise.all([assets.ready, hold]).then(finish);
  });
}
