# Scroll performance pass: changelog

Nothing shown on screen was removed or restyled. Section order, station timings, camera rails, lights, shaders and copy are untouched; the changes are in how frames are computed.

## Findings (ranked by impact)

1. **Three smoothing layers in series.** Lenis `lerp 0.08` → ScrollTrigger `scrub: 1.2` → camera damping `0.075`/frame. Each waited on the one before, so the camera trailed the wheel by well over a second. This was the drag.
2. **Render ran before Lenis in each tick.** `exp.start()` registered its ticker callback ahead of Lenis, so every frame drew the previous frame's scroll position (one extra frame of latency).
3. **Shaders compiled mid-scroll.** 11 new programs appeared between the hero and the footer (19 → 30 on the mobile pipeline, 29 → 44 with post-processing): rooms first entering the frustum, the bokeh depth pass at Style, and the Interesting spotlight toggling `visible`, which changed the light count and swapped every lit material to a new program. These were the stutters at specific points.
4. **Textures uploaded mid-scroll.** `World.update` uploaded each room's textures as it came within two stations, on the main thread, during the corridor move.
5. **Per-frame layout and garbage.** The three Help cards had `width`/`height`/`transform` rewritten every frame of the whole visit (forced style + layout even when off stage); `Room.textures` built new arrays for five rooms per frame; `Lights` allocated ~8 arrays per frame; the progress rail was rewritten every frame.
6. **Compositor load from the overlay.** Every split word (`.wi`, several hundred) held a permanent `will-change: transform` layer; the cursor's `mix-blend-mode` sat on a full-viewport element; the Work headline kept a `filter: blur(0px)` layer after its reveal.
7. **GPU fill.** 4× MSAA half-float target at DPR 2, plus separate grain and output full-screen passes; the reveal noise (4-octave fbm) ran for every photo pixel even after the wipe had finished.
8. Already fine: one `requestAnimationFrame` loop (gsap.ticker), bloom already at half resolution, bokeh already gated to the Style window, draw calls already under 120.

## Fixes

| # | Fix | Root cause | File |
|---|---|---|---|
| 1 | Lenis is the only scroll smoother (`lerp 0.1`, `syncTouch: false`); timeline `scrub: true` | Stacked smoothing | `main.ts`, `MasterTimeline.ts` |
| 2 | Camera follow is `1 - exp(-14·dt)` on real time (was 0.075/frame); parallax rate unchanged | Stacked smoothing | `Camera.ts` |
| 3 | One ordered tick: Lenis → timeline → 3D update + render → UI | Render loop | `main.ts`, `Experience.ts` |
| 4 | Per-frame allocations removed: reused frame context, scalar inverse-ACES, loops instead of closures, cached projections | Render loop | `Experience.ts`, `Lights.ts`, `World.ts`, rooms |
| 5 | Help cards: projected only while the section is on stage; DOM written only when a value changes (same 0.1px precision) | Render loop / overlay | `HelpRoom.ts` |
| 6 | Progress rail, nav state, cursor and magnetic links write only on change; magnetic measures once per frame instead of per pointer event | Overlay | `main.ts`, `cursor.ts` |
| 7 | Idle: nothing moving for 500ms → render every 2nd frame; any input wakes it instantly. Resize debounced 150ms; mobile URL-bar resizes no longer reallocate render targets | Render loop | `Experience.ts` |
| 8 | Pre-warm behind the loader: every texture uploaded, whole world drawn once un-culled through the real post chain, with and without bokeh. Loader holds at 100 until done | Mid-scroll hitches | `Experience.ts`, `loader.ts`, `main.ts` |
| 9 | Interesting spotlight stays in the light list at intensity 0 (identical output); its shadow map only renders while lit | Mid-scroll hitches | `InterestingRoom.ts` |
| 10 | DPR cap 1.5 desktop / 1.25 mobile, with adaptive DPR (<52fps for 1s steps down 0.25 to a floor of 1.0; >58fps for 3s steps back up, with back-off so it cannot oscillate) | GPU cost | `globals.ts`, `Experience.ts` |
| 11 | GPU tier presets (high / mid / low) from the renderer string, no new dependency: DPR cap, shadow map 2048 / 1024, MSAA 4 / 2 | GPU cost | `globals.ts` |
| 12 | Grain + vignette folded into the output pass (same maths, same position before tone mapping): one full-screen pass fewer | GPU cost | `Experience.ts` |
| 13 | Reveal noise skipped once a photo's wipe is complete (provably the same pixels) | GPU cost | `plane.frag` |
| 14 | Fog-safe room culling: a room is hidden only when it is more than two stations away and under 0.1% visible through the fog. Lights are never hidden | GPU cost | `World.ts`, `Room.ts` |
| 15 | `will-change` removed from every word (GSAP promotes a word only while it animates); cursor blend element shrunk from full-viewport to the dot and ring; Work headline drops its filter once the blur reaches 0 | Overlay / CSS | `main.css`, `MasterTimeline.ts` |
| 16 | `?perf` overlay and `__perfRun()` | Diagnosis | `dom/perf.ts`, `main.ts` |

## Measurements

Measured in headless Chrome on software GL (no GPU), original build vs this build, same viewport and tier:

| | Before | After |
|---|---|---|
| Shader programs compiled during a full scroll | 11 (19 → 30) | 0 (23 → 23) |
| Same, desktop post-processing pipeline | 15 (29 → 44) | 0 (36 → 36) |
| Draw calls per frame, average over a full scroll | 86 | 67 |
| Draw calls per frame, maximum | 117 | 118 |
| Smoothing layers between wheel and camera | 3 | 1 + a 70ms camera damp |
| Camera within 2% of rest after one wheel step (model, 60fps) | ~1470 ms | ~730 ms, of which ~650 ms is Lenis' own glide |
| Camera still moving after the scroll position has settled (model, 60fps) | ~670 ms | ~80 ms (the damp alone reaches 2% in ~280 ms) |
| Console errors (desktop, mobile, reduced motion, static; fly-to and rewind exercised) | not re-tested | 0 |

Frame parity: with ambient time frozen, 20 desktop frames (arrival and mid-dwell at all ten stations, including the Style rack focus and the Interesting spot) and 30 mobile-pipeline frames were captured from both builds. The WebGL canvas is pixel-identical. The only differences are sub-pixel antialiasing on text edges, from words no longer sitting on their own compositor layers.

**FPS and frame time on real hardware are not in this table.** The test environment has no GPU (about 1.5fps for both builds), so those numbers would be meaningless. To fill them in on your machine:

```js
// in the browser console, on the old build (git stash) and then the new one
await __perfRun()   // { avgFps, avgMs, p95Ms, maxMs, over32ms, over50ms, programsStart, programsEnd, dpr }
```

or open the site with `?perf` and read the overlay while scrolling.

## Kept as is, on purpose

- **Hero / footer ghost buttons keep `backdrop-filter: blur(6px)`.** Removing it visibly changes the button. It is two small pills, only composited while their section is visible. (The mobile Help cards lost theirs: behind a 92%-opaque card it was invisible.)
- **Cursor `mix-blend-mode: difference` stays in CSS.** Moving the inversion into the post shader would stop it inverting the HTML text it passes over, which is part of the look.
- **Cursor ring still animates `width`/`height`.** Scaling it instead would scale its 1px border and label.
- **The Interesting spotlight still casts its shadow** (the brief's table says key light only): removing it changes that station's frame.
- **Low tier keeps 3 layers per photo stack**, not 2, so frames are never dropped from photos.
- **Idle half-rate** affects only ambient motion (dust, grain, ring spin) while nothing is being touched. To turn it off, remove the `this.idle &&` early return in `Experience.update`.
- Mouse parallax (`rig.setPointer`, `uMouse`) was never wired to a pointer listener in the original and still isn't; wiring it would change what is shown.
