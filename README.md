# Eniola — Get to know me · cinematic 3D scroll site

A single-page personal site for **Eniola** that plays as one continuous camera move: the scroll is the timeline, and the camera travels through one Three.js world past ten "rooms" (stations). No cuts, no page breaks.

**Stack:** Vite + TypeScript · three · GSAP (ScrollTrigger, CustomEase) · Lenis · vite-plugin-glsl

```bash
npm install
npm run dev        # downloads her site photos on first run, then http://localhost:5173
npm run build      # type-check + production build → dist/
npm run preview    # serve the build
```

Add `?static` to the URL to preview the no-WebGL fallback.

---

## 1. Content

**Every word lives in `src/content.ts`**, copied word-for-word from her Lovable page (https://genuine-connections-me.lovable.app/). Wrap words in `*asterisks*` for emphasis: it renders in the clay accent colour, the way "Eniola" does in her original headline.

Two pieces of structure come from the build brief rather than her page. Both use her exact words:
- **Help:** her paragraph is split into three cards (CV revamps, Mentoring, Event moderating & hosting). Each card's body is her own sentence, and her closing line sits under the cards.
- **Pull-quote / gold tag:** "If you're in, you're really in." and "Real gold or nothing at all." are lifted from her own paragraphs.

Twitter and Instagram point at the generic sites, as they do on her Lovable page. Swap in her handles in `content.sayhi.links`.

## 2. Images

| File (`public/images/eniola/`) | What it is |
|---|---|
| `eniola-cutout.png` | Her portrait, background removed. Used as the hero subject layer, the Style foreground and one carousel frame |
| `eniola-plate.webp` | The same photo with her removed and softly blurred. It's the hero's background layer, so the cut-out has real parallax depth |
| `relationships.jpg`, `faith.jpg`, `career.jpg`, `help.jpg`, `love-doing.jpg`, `style.jpg`, `gold.jpg` | The seven photos from her Lovable site |

The seven site photos are fetched by **`scripts/fetch-images.mjs`**, which runs automatically before `npm run dev` and `npm run build`. It only downloads files still listed in `public/images/eniola/placeholders.txt`, so if you drop in your own photo with the same name and remove its line from that file, it won't be overwritten. Until the download runs, quote cards in her palette stand in for each photo, and the People and Fun frames show their own portrait quote cards (`public/images/eniola/quotes/`). Edit the quotes in `scripts/make_placeholders.py` and run `npm run placeholders` to regenerate them.

Large photos are scaled to 1024px (768px on phones) in the browser before they reach the GPU, which keeps texture memory around 24 MB.

**Photo stacks:** each "photo" is 2–4 planes separated in depth (`z`). People and the Fun carousel show different `crop`s of the landscape photos (`[u, v, width, height]` in `content.ts`). The Style stack uses `aspect` to put her portrait 5.5 units in front of the wardrobe flat lay, which is what the rack focus pulls between.

## 2b. Palette (from her site's theme tokens)

| Role | Colour | Where |
|---|---|---|
| Page background | `#fdf7ef` cream | `--cream`, the 3D scene background and fog |
| Section background | `#f8e6d7` blush | `--blush`, the Say-hi station (the scene fades to it), Help cards |
| Buttons | `#281c18` ink with cream text, `#af8471` clay on hover | `.btn--solid`; outline buttons use the border colour `#e8dbd1` |

Fonts match her site: **Fraunces** (display) and **Inter** (text). Kickers are uppercase Inter at 0.24em tracking in clay.

The desktop post-processing pipeline tone-maps the whole frame (ACES). The background, fog and photos are fed through the exact inverse of that curve, so the page colour comes out as exactly `#fdf7ef` / `#f8e6d7` and photos keep their true colours. See `Lights.applyBackground` and `shaders/tonemap_inv.glsl`; light keyframes live in `src/scroll/sections.ts` (`palette`, `bg`).

## 3. Tuning the camera

**`src/scroll/sections.ts` is the director's sheet.** Each station has:

- `arrive` / `leave`: the camera `pos` and the `look` target at the start and end of the station's dwell. The camera moves between them while the copy is on screen. For example, People uses this for an orbit, Help for a truck left and Interesting for an extreme push-in.
- `via`: optional extra rail points inside the corridor *into* the station. Fun uses one to climb before its spiral descent, and Say hi uses one to turn around before the pull-back.
- `dwell` / `corridor`: scroll length in vh. The total is ~1165vh on desktop and ×0.7 on mobile.
- `fov` `[arrive, leave]`, `fovPunch` (a mid-corridor FOV punch, as in the Work whoosh), and `roll` (dutch tilt in degrees).
- `light`: the keyframe for the key, fill, rim and accent colours and intensities, plus exposure, fog density, image saturation, bloom, and the practical/gold/glow levels. The master timeline lerps between keyframes during each corridor.

World axes: forward is −Z, the floor is y = 0, and 1 unit ≈ 1 m.

Other tuning knobs:

| What | Where |
|---|---|
| Camera weight (damping 0.075) and mouse parallax (±0.15) | `src/experience/Camera.ts` |
| Scrub lag (1.2s), text-reveal timing, per-station signature moves | `src/scroll/MasterTimeline.ts` (`stationExtras`) |
| Room props and layout | `src/experience/rooms/*.ts` |
| Lenis smoothing (`lerp 0.08`) and the nav fly duration (2.2s, expo in-out) | `src/main.ts` |
| Mobile and reduced-motion quality switches | `src/experience/globals.ts` |

## 4. How it fits together

```
src/
  content.ts                 all copy + image paths
  main.ts                    boot, loader → intro, Lenis ↔ GSAP, nav fly-to, keyboard, fallback, HMR teardown
  scroll/
    sections.ts              rails, scroll lengths, light keyframes
    MasterTimeline.ts        ONE scrubbed timeline drives camera, FOV, roll, lights, fog, rooms and text
  experience/
    Experience.ts            singleton: renderer, scene, post (bloom → bokeh → grain → output), render loop
    Camera.ts                CatmullRom position rail + look-target rail, damping, mouse parallax
    Lights.ts                key (follows camera, casts shadows) / hemisphere / rim / accent + fog + image tint
    World.ts                 floor, pillars (instanced), glowing path, dust, rooms, full-screen veil
    Assets.ts                LoadingManager (drives the counter), lazy GPU upload, contact shadows
    objects/LayeredPlane.ts  the 2.5D photo stack
    rooms/                   Hero, People, Faith, Work, Help, Fun, Style, Interesting, SayHi (+ Footer)
    shaders/                 plane (bend, RGB shift, noise reveal), beam, dust, grain, transition, sheen
  dom/
    overlay.ts               semantic HTML for every station, nav, progress rail
    split.ts                 word splitter for masked reveals
    cursor.ts                custom cursor + magnetic links
    loader.ts, toast.ts
```

- **One timeline, one scene.** The `<canvas>` and the text overlay are both `position: fixed`. The tall `#scroll-track` div feeds ScrollTrigger, and every value (camera, light, fog, text) is a scrubbed tween on the same master timeline, so text and 3D can't drift apart. Scrolling up reverses everything.
- **Rails.** The camera sits on a CatmullRom (centripetal) curve. Each station contributes an `arrive` and a `leave` point, and the timeline tweens the rail parameter between them. Corridors use the `cine` ease (`0.65, 0, 0.35, 1`), and dwells use `sine.inOut`. The real camera is then damped toward the rail every frame.
- **Help cards** are real 3D rounded boxes. Their HTML twins (title, copy and "Ask me" link) are positioned each frame by projecting the card face to the screen, so the text stays crisp and accessible while the card tilts toward your cursor. On mobile the twins become a stacked list.
- **Lights.** The key light's shadow frustum follows the look target, so shadows stay tight. Shadow maps re-render every frame while the camera moves and every fourth frame when it's slow. Image planes are unlit, but they're tinted by the rig colour, so the grade still evolves across the journey.

## 5. Modes

| Mode | Behaviour |
|---|---|
| Desktop | Full post-processing (bloom, rack-focus bokeh on Style, grain and vignette), PCF shadows, mouse parallax |
| Mobile (< 768px) | Scroll ~30% shorter, no post-processing, basic shadows, max 3 layers per stack, DPR 1.5, no parallax |
| `prefers-reduced-motion` | No camera travel. Each corridor becomes a noise-dissolve crossfade between static framings, and velocity distortion and grain are off |
| No WebGL / `?static` | A styled static page with the same content and anchors |

**Accessibility:** all copy is real HTML in `<section aria-labelledby>`, and the canvas is `aria-hidden`. Arrow keys, Page Up/Down, Space, Home and End move station to station and move focus with you. There's a skip link and visible focus rings.

## 6. QA hooks (browser console)

```js
__perf()          // { calls, triangles, textures, textureMB, programs }
__fly('work')     // fly the camera to a station
```

Measured in headless Chrome at 1440×900: **37–117 draw calls per frame** (shadow passes included), ~24 MB estimated texture memory, and no console errors across all stations and in mobile, reduced-motion and static modes. Frame rate wasn't measurable in the software-GL test environment, so do a real perf pass on your own hardware with `__perf()` or Spector.js.

## 7. Notes and deviations from the brief

- `PCFSoftShadowMap` was removed in recent three.js releases, so the code uses `PCFShadowMap` with a blur radius.
- The rails use `getPoint` with explicit per-station control points rather than `getPointAt`. That way each station lands exactly on its scroll label, which nav fly-to depends on.
- Help (FOV 38) and Fun (FOV 36 → 40) are a little wider than the shot list specifies, so all three cards and the carousel fit on screen.
- Fonts are Fraunces (display) and Inter (text), as on her site, plus JetBrains Mono (small labels) and Caveat (the handwritten coffee line), loaded from Google Fonts. To self-host, swap the `<link>` in `index.html`.
