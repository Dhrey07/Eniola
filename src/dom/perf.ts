/**
 * Dev-only perf overlay, shown with ?perf in the URL: FPS, frame time,
 * draw calls, triangles, textures, programs and the current pixel ratio.
 * Refreshes four times a second from the main ticker; nothing is created
 * (and nothing runs) without the query flag.
 */
export interface PerfStats {
  fps: number;
  frameMs: number;
  frameMaxMs: number;
  slowFrames: number;
  calls: number;
  triangles: number;
  textures: number;
  programs: number;
  dpr: number;
  dprCap: number;
  tier: string;
  idle: boolean;
}

export function initPerfOverlay(read: () => PerfStats): ((now: number) => void) | null {
  if (!new URLSearchParams(location.search).has('perf')) return null;
  const el = document.createElement('pre');
  el.id = 'perf';
  el.setAttribute('aria-hidden', 'true');
  el.style.cssText =
    'position:fixed;left:12px;bottom:12px;z-index:300;margin:0;padding:10px 12px;border-radius:8px;' +
    'background:rgba(24,16,14,.86);color:#fdf7ef;font:11px/1.5 ui-monospace,Menlo,monospace;' +
    'pointer-events:none;white-space:pre;contain:content';
  document.body.appendChild(el);

  let longTasks = 0;
  let longMax = 0;
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        longTasks++;
        if (e.duration > longMax) longMax = e.duration;
      }
    }).observe({ entryTypes: ['longtask'] });
  } catch {
    /* longtask is Chromium-only */
  }

  let next = 0;
  return (now: number) => {
    if (now < next) return;
    next = now + 250;
    const s = read();
    el.textContent =
      `FPS       ${s.fps.toFixed(1)}${s.idle ? '  (idle: half rate)' : ''}\n` +
      `frame     ${s.frameMs.toFixed(2)} ms   max ${s.frameMaxMs.toFixed(1)} ms\n` +
      `>32ms     ${s.slowFrames} frames   long tasks ${longTasks}${longTasks ? ` (max ${longMax.toFixed(0)} ms)` : ''}\n` +
      `calls     ${s.calls}\n` +
      `triangles ${s.triangles}\n` +
      `textures  ${s.textures}\n` +
      `programs  ${s.programs}\n` +
      `DPR       ${s.dpr} / cap ${s.dprCap}   tier ${s.tier}`;
  };
}
