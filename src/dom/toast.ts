import gsap from 'gsap';

let el: HTMLElement | null = null;
export function toast(msg: string) {
  el ??= document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  gsap.killTweensOf(el);
  gsap.fromTo(el, { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.45, ease: 'power3.out' });
  gsap.to(el, { autoAlpha: 0, y: -8, duration: 0.4, delay: 2.2, ease: 'power2.in' });
}
