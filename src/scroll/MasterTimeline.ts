import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { CustomEase } from 'gsap/CustomEase';
import { stations, type StationDef } from './sections';
import { presetToState } from '../experience/Lights';
import type { Experience } from '../experience/Experience';
import type { StationDom } from '../dom/overlay';
import type { StationId } from '../content';

gsap.registerPlugin(ScrollTrigger, CustomEase);
CustomEase.create('cine', '0.65, 0, 0.35, 1');

export interface MasterOptions {
  reduced: boolean;
  scrollScale: number;
  onUpdate?: (progress: number) => void;
}

export interface Master {
  tl: gsap.core.Timeline;
  /** timeline time at which each station "arrives" (label positions) */
  times: number[];
  total: number;
  labelScroll: (id: StationId) => number;
  stationAt: (time: number) => number;
}

/** jump halfway through a segment (reduced-motion: hidden behind the veil) */
const stepMid = (p: number) => (p < 0.5 ? 0 : 1);

/**
 * ONE scrubbed timeline drives everything: camera rail parameter, FOV,
 * roll, light rig, fog, grade, room scale/reveal, per-room extras and
 * every line of overlay text. Units are vh of scroll.
 */
export function buildMaster(exp: Experience, dom: Record<StationId, StationDom>, opts: MasterOptions): Master {
  const { reduced, scrollScale: k } = opts;
  const rig = exp.rig;
  const rooms = exp.world.rooms;
  const L = exp.lights.state;
  const total = stations.reduce((a, s) => a + (s.dwell + s.corridor) * k, 0);

  const track = document.getElementById('scroll-track')!;
  track.style.height = `${total + 100}vh`;

  const tl = gsap.timeline({
    defaults: { ease: 'none', immediateRender: false },
    scrollTrigger: {
      trigger: track,
      start: 'top top',
      end: 'bottom bottom',
      scrub: reduced ? true : 1.2,
      onUpdate: (self) => opts.onUpdate?.(self.progress),
    },
  });

  // initial states (everything except the hero is waiting off-stage)
  for (const s of stations) {
    if (s.id === 'hero') continue;
    const d = dom[s.id];
    gsap.set(d.section, { autoAlpha: 0 });
    if (reduced) continue;
    gsap.set([...d.words, ...d.body, ...(d.parts.gold as HTMLElement[])], { yPercent: 110 });
    if (d.fades.length) gsap.set(d.fades, { autoAlpha: 0 });
  }

  const times: number[] = [];
  let T = 0;

  stations.forEach((s, i) => {
    const room = rooms[i];
    const d = dom[s.id];
    const rt = rig.railT[i];

    // ── corridor: travel from the previous station into this one ──
    if (i > 0) {
      const prev = stations[i - 1];
      const prt = rig.railT[i - 1];
      const c = s.corridor * k;
      const camEase = reduced ? stepMid : 'cine';

      tl.fromTo(rig.state, { t: prt.leave }, { t: reduced ? (rt.arrive + rt.leave) / 2 : rt.arrive, ease: camEase, duration: c }, T);
      if (reduced) {
        const veil = exp.world.veilUniform;
        tl.fromTo(veil, { value: 0 }, { value: 1, ease: 'sine.in', duration: c / 2 }, T);
        tl.fromTo(veil, { value: 1 }, { value: 0, ease: 'sine.out', duration: c / 2 }, T + c / 2);
      }
      // FOV (with an optional mid-corridor punch for the whoosh)
      if (s.fovPunch && !reduced) {
        tl.fromTo(rig.state, { fov: prev.fov[1] }, { fov: s.fovPunch, ease: 'sine.in', duration: c / 2 }, T);
        tl.fromTo(rig.state, { fov: s.fovPunch }, { fov: s.fov[0], ease: 'sine.out', duration: c / 2 }, T + c / 2);
      } else {
        tl.fromTo(rig.state, { fov: prev.fov[1] }, { fov: s.fov[0], ease: camEase, duration: c }, T);
      }
      tl.fromTo(rig.state, { roll: prev.roll?.[1] ?? 0 }, { roll: s.roll?.[0] ?? 0, ease: camEase, duration: c }, T);

      // light rig, fog, grade
      tl.fromTo(L, presetToState(prev.light), { ...presetToState(s.light), ease: 'sine.inOut', duration: c }, T);

      // rooms: previous one passes through (1 → 1.15), this one approaches (0.85 → 1)
      tl.fromTo(rooms[i - 1].state, { scale: 1 }, { scale: 1.15, ease: 'power1.in', duration: c * 0.7 }, T);
      tl.fromTo(room.state, { scale: 0.85, reveal: 0 }, { scale: 1, reveal: 1, ease: 'power3.out', duration: c * 0.75 }, T + c * 0.25);

      // overlay text out / in
      textOut(tl, dom[prev.id], T, c * 0.4, reduced);
      textIn(tl, d, s, T + c * 0.4, c * 0.6, reduced);
      T += c;
    }

    tl.addLabel(s.id, T);
    times.push(T);

    // ── dwell: the station's own camera move while the copy is on screen ──
    const dw = s.dwell * k;
    if (reduced) {
      const mid = (rt.arrive + rt.leave) / 2;
      tl.fromTo(rig.state, { t: mid }, { t: mid, duration: dw }, T);
      tl.fromTo(rig.state, { fov: (s.fov[0] + s.fov[1]) / 2 }, { fov: (s.fov[0] + s.fov[1]) / 2, duration: dw }, T);
    } else {
      tl.fromTo(rig.state, { t: rt.arrive }, { t: rt.leave, ease: 'sine.inOut', duration: dw }, T);
      tl.fromTo(rig.state, { fov: s.fov[0] }, { fov: s.fov[1], ease: 'sine.inOut', duration: dw }, T);
      tl.fromTo(rig.state, { roll: s.roll?.[0] ?? 0 }, { roll: s.roll?.[1] ?? 0, ease: 'power2.out', duration: dw * 0.6 }, T);
    }
    stationExtras(tl, exp, s, i, T, dw, d, reduced, s.corridor * k);
    T += dw;
  });

  const st = tl.scrollTrigger!;
  return {
    tl,
    times,
    total,
    labelScroll: (id) => st.labelToScroll(id),
    stationAt: (time) => {
      let idx = 0;
      times.forEach((t, i) => {
        const lead = (stations[i].corridor * k) / 2;
        if (time >= t - lead) idx = i;
      });
      return idx;
    },
  };

  function textIn(tl: gsap.core.Timeline, d: StationDom, s: StationDef, at: number, dur: number, reduced: boolean) {
    tl.fromTo(d.section, { autoAlpha: 0, y: reduced ? 0 : 40 }, { autoAlpha: 1, y: 0, ease: 'power3.out', duration: dur * 0.5 }, at);
    if (reduced) return;
    if (d.words.length)
      tl.fromTo(
        d.words,
        { yPercent: 110 },
        { yPercent: 0, ease: 'power3.out', duration: dur * 0.55, stagger: Math.min(1.4, (dur * 0.35) / d.words.length) },
        at
      );
    if (d.body.length && s.id !== 'faith')
      tl.fromTo(
        d.body,
        { yPercent: 110 },
        { yPercent: 0, ease: 'power3.out', duration: dur * 0.45, stagger: Math.min(0.35, (dur * 0.35) / d.body.length) },
        at + dur * 0.2
      );
    if (d.fades.length)
      tl.fromTo(d.fades, { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, ease: 'power3.out', duration: dur * 0.4, stagger: dur * 0.06 }, at + dur * 0.4);
  }

  function textOut(tl: gsap.core.Timeline, d: StationDom, at: number, dur: number, reduced: boolean) {
    tl.fromTo(d.section, { autoAlpha: 1, y: 0 }, { autoAlpha: 0, y: reduced ? 0 : -50, ease: 'power2.in', duration: dur }, at);
  }
}

/** per-station signature moves layered on top of the rail */
function stationExtras(
  tl: gsap.core.Timeline,
  exp: Experience,
  s: StationDef,
  i: number,
  T: number,
  dw: number,
  d: StationDom,
  reduced: boolean,
  corr: number
) {
  const room = exp.world.rooms[i];
  switch (s.id) {
    case 'hero': {
      // hero copy drifts up with the push-in
      if (!reduced) tl.fromTo(d.section.querySelector('.st-inner'), { y: 0 }, { y: -30, duration: dw }, T);
      tl.fromTo(d.parts.cue as HTMLElement, { autoAlpha: 1 }, { autoAlpha: 0, duration: dw * 0.25 }, T);
      break;
    }
    case 'faith': {
      // lines reveal one by one, slowly (≈ 1.6s windows at normal scroll speed)
      const lines = d.parts.faithLines as HTMLElement[];
      lines.forEach((line, li) => {
        const words = line.querySelectorAll('.wi');
        const at = T - dw * 0.15 + li * dw * 0.17;
        if (reduced) tl.fromTo(line, { autoAlpha: 0 }, { autoAlpha: 1, duration: dw * 0.15 }, at);
        else tl.fromTo(words, { yPercent: 110 }, { yPercent: 0, ease: 'sine.out', duration: dw * 0.16, stagger: 0.2 }, at);
      });
      break;
    }
    case 'work': {
      if (reduced) break;
      const l = d.parts.workLeft as HTMLElement;
      const r = d.parts.workRight as HTMLElement;
      const at = T - corr * 0.35;
      tl.fromTo(l, { xPercent: -35, scale: 1.12, opacity: 0 }, { xPercent: 0, scale: 1, opacity: 1, ease: 'expo.out', duration: dw * 0.55 }, at);
      tl.fromTo(r, { xPercent: 35, scale: 0.88, opacity: 0, filter: 'blur(8px)' }, { xPercent: 0, scale: 1, opacity: 1, filter: 'blur(0px)', ease: 'expo.out', duration: dw * 0.6 }, at + dw * 0.08);
      break;
    }
    case 'fun': {
      tl.fromTo(room.state, { extra: 0 }, { extra: 1, ease: 'sine.inOut', duration: dw + corr * 0.6 }, T - corr * 0.6);
      break;
    }
    case 'style': {
      // rack focus: background sharp → garment sharp
      if (!exp.bokeh) break;
      tl.fromTo(exp.dof, { aperture: 0 }, { aperture: 0.0028, ease: 'sine.out', duration: dw * 0.2 }, T - dw * 0.05);
      tl.fromTo(exp.dof, { focus: 14.8 }, { focus: 8.4, ease: 'cine', duration: dw * 0.5 }, T + dw * 0.2);
      tl.fromTo(exp.dof, { aperture: 0.0028 }, { aperture: 0, ease: 'sine.in', duration: dw * 0.25 }, T + dw * 0.9);
      break;
    }
    case 'interesting': {
      tl.fromTo(room.state, { extra: 0 }, { extra: 1, ease: 'sine.inOut', duration: dw }, T);
      tl.fromTo(d.parts.gold as HTMLElement[], { yPercent: 110 }, { yPercent: 0, ease: 'power3.out', duration: dw * 0.3, stagger: 1.2 }, T + dw * 0.15);
      break;
    }
  }
}
