import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { CameraRig } from './Camera';
import { Lights } from './Lights';
import { World } from './World';
import { Assets, disposeContactShadowTexture } from './Assets';
import { globals, quality } from './globals';
import { stations } from '../scroll/sections';
import { disposePlaneGeometries } from './objects/LayeredPlane';
import { disposeGlowTexture, type FrameContext } from './rooms/Room';
import grainFrag from './shaders/grain.frag';

const grainVert = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

/**
 * Grain + vignette folded into the OutputPass shader, in the same place they
 * were applied before (linear HDR, ahead of tone mapping and the sRGB
 * transfer), so the frame is unchanged but one full-screen pass is gone.
 */
const OUTPUT_ANCHOR = 'gl_FragColor = texture2D( tDiffuse, vUv );';
const GRAIN_PARS = /* glsl */ `
uniform float uTime;
uniform float uGrain;
uniform float uVignette;
float grainHash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * .1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
void main() {`;
const GRAIN_BODY = /* glsl */ `${OUTPUT_ANCHOR}
  gl_FragColor.rgb += (grainHash12(vUv * 1000.0 + fract(uTime * 7.13) * 100.0) - 0.5) * uGrain;
  gl_FragColor.rgb *= mix(1.0, smoothstep(0.85, 0.25, distance(vUv, vec2(0.5))), uVignette);`;

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

/** frame-time ring for the ?perf overlay (fixed size, no per-frame allocation) */
const RING = 120;

/** Singleton: renderer, scene, camera rig, lights, world, post, frame update. */
export class Experience {
  static instance: Experience | null = null;

  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  rig: CameraRig;
  lights: Lights;
  world!: World;
  assets = new Assets();
  envMap: THREE.Texture;
  composer?: EffectComposer;
  bloom?: UnrealBloomPass;
  bokeh?: BokehPass;
  /** uniforms of whichever pass carries the grain (merged output pass, or the fallback ShaderPass) */
  grainUniforms?: Record<string, THREE.IUniform>;
  /** depth-of-field state, tweened by the master timeline (Style rack focus) */
  dof = { aperture: 0, focus: 14 };

  width = window.innerWidth;
  height = window.innerHeight;
  time = 0;
  private velocity = 0;
  private frame = 0;
  private hidden = false;
  private resizeTimer = 0;
  private onResize = () => {
    clearTimeout(this.resizeTimer);
    this.resizeTimer = window.setTimeout(() => this.resize(), 150);
  };
  private onVisibility = () => (this.hidden = document.hidden);
  /** reused every frame (no per-frame object) */
  private ctx: FrameContext;

  // ── idle throttle ──
  private lastActive = 0;
  private awakeUntil = 0;
  private pendingDt = 0;
  private pendingReal = 0;
  /** true while nothing is moving and the scene renders every 2nd frame */
  idle = false;

  // ── adaptive pixel ratio ──
  private winT = 0;
  private winN = 0;
  private lowT = 0;
  private highT = 0;
  private upLockUntil = 6;
  private upLock = 5;
  private lastStepUp = -1e9;
  private wall = 0;

  // ── perf readout (?perf) ──
  private ring = new Float32Array(RING);
  private ringI = 0;
  slowFrames = 0;

  constructor(public canvas: HTMLCanvasElement) {
    Experience.instance = this;
    const r = (this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !quality.post,
      powerPreference: 'high-performance',
    }));
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.0;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.shadowMap.enabled = true;
    r.shadowMap.type = quality.mobile ? THREE.BasicShadowMap : THREE.PCFShadowMap;
    r.shadowMap.autoUpdate = false;
    r.setPixelRatio(quality.dpr);
    r.setSize(this.width, this.height);
    r.info.autoReset = false;
    this.assets.maxAnisotropy = r.capabilities.getMaxAnisotropy();
    this.assets.maxSize = quality.mobile ? 768 : 1024;

    const pmrem = new THREE.PMREMGenerator(r);
    this.envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    this.rig = new CameraRig(this.width / this.height);
    this.lights = new Lights(this.scene, r, stations[0].light, quality.post);
    this.world = new World(
      this.scene,
      { assets: this.assets, renderer: r, rig: this.rig, envMap: this.envMap },
      this.rig,
      this.lights
    );
    this.world.initCulling();
    this.ctx = {
      dt: 0,
      time: 0,
      camera: this.rig.camera,
      light: this.lights.state,
      width: this.width,
      height: this.height,
    };

    if (quality.post) this.setupPost();
    window.addEventListener('resize', this.onResize);
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  private setupPost() {
    const rt = new THREE.WebGLRenderTarget(this.width, this.height, { type: THREE.HalfFloatType, samples: quality.msaa });
    const c = (this.composer = new EffectComposer(this.renderer, rt));
    c.setPixelRatio(quality.dpr);
    c.setSize(this.width, this.height);
    c.addPass(new RenderPass(this.scene, this.rig.camera));
    // bloom works on half-resolution mips of the frame (UnrealBloomPass halves the size it is given)
    this.bloom = new UnrealBloomPass(new THREE.Vector2(this.width / 2, this.height / 2), 0.35, 0.5, 0.85);
    c.addPass(this.bloom);
    // rack focus: only enabled inside the Style window (see update)
    this.bokeh = new BokehPass(this.scene, this.rig.camera, { focus: 14, aperture: 0, maxblur: 0.012 });
    this.bokeh.enabled = false;
    c.addPass(this.bokeh);

    const grain = { uTime: { value: 0 }, uGrain: { value: quality.reduced ? 0 : 0.035 }, uVignette: { value: 0 } };
    const out = new OutputPass();
    const frag = out.material.fragmentShader;
    if (frag.includes(OUTPUT_ANCHOR) && frag.includes('void main() {')) {
      // grain + vignette + tone map + sRGB in ONE full-screen pass
      out.material.fragmentShader = frag.replace('void main() {', GRAIN_PARS).replace(OUTPUT_ANCHOR, GRAIN_BODY);
      Object.assign(out.uniforms, grain);
      this.grainUniforms = out.uniforms;
    } else {
      // three changed its output shader: fall back to the separate grain pass (same picture)
      const pass = new ShaderPass({ uniforms: { tDiffuse: { value: null }, ...grain }, vertexShader: grainVert, fragmentShader: grainFrag });
      c.addPass(pass);
      this.grainUniforms = pass.uniforms;
    }
    c.addPass(out);
  }

  /** QA: film grain amount (0 disables) */
  setGrain(v: number) {
    if (this.grainUniforms) this.grainUniforms.uGrain.value = v;
  }

  /** Lenis velocity (px/frame) → damped shader velocity (clamped so the RGB shift can never spike) */
  setScrollVelocity(v: number) {
    this.velocity = quality.reduced ? 0 : THREE.MathUtils.clamp(v / 40, -1, 1);
    if (v !== 0) this.lastActive = this.wall;
  }

  /** keep rendering at the full rate for `seconds` of real time (pointer moved, tween started, …) */
  keepAwake(seconds = 0.6) {
    const until = this.wall + seconds;
    if (until > this.awakeUntil) this.awakeUntil = until;
  }

  /**
   * Upload every texture and compile every shader program behind the loader,
   * so nothing has to compile or upload when a room first scrolls into view.
   * Resolves when the pipeline is warm; the loader holds at 100 until then.
   */
  async prewarm() {
    const r = this.renderer;
    // 1. textures → GPU, a few per frame so the loader keeps animating
    const texes = this.world.allTextures();
    for (let i = 0; i < texes.length; i++) {
      if (texes[i].image) r.initTexture(texes[i]);
      if (i % 4 === 3) await nextFrame();
    }
    // 2. programs: draw the whole world once (nothing culled, shadows on), with and
    //    without the rack-focus pass, through the real post chain
    const unculled: THREE.Object3D[] = [];
    this.scene.traverse((o) => {
      if (o.frustumCulled) {
        o.frustumCulled = false;
        unculled.push(o);
      }
    });
    const shadows: THREE.LightShadow[] = [];
    this.scene.traverse((o) => {
      const l = o as THREE.DirectionalLight | THREE.SpotLight;
      if (l.isLight && l.castShadow && l.shadow) shadows.push(l.shadow);
    });
    try {
      for (const withBokeh of [false, true]) {
        this.world.showAll();
        for (const s of shadows) s.needsUpdate = true;
        r.shadowMap.needsUpdate = true;
        r.info.reset();
        if (this.composer) {
          this.bokeh!.enabled = withBokeh;
          this.composer.render(0);
        } else {
          r.render(this.scene, this.rig.camera);
          break;
        }
        await nextFrame();
      }
    } finally {
      for (const o of unculled) o.frustumCulled = true;
      if (this.bokeh) this.bokeh.enabled = false;
    }
    await nextFrame();
  }

  /** one tick of the single gsap.ticker loop (main.ts calls this right after Lenis and the timeline) */
  update(deltaMs: number) {
    if (this.hidden) return;
    const raw = deltaMs / 1000;
    this.wall += raw;
    // ?perf ring + budget counter (real frame time, before any clamping)
    this.ring[this.ringI] = deltaMs;
    this.ringI = (this.ringI + 1) % RING;
    if (deltaMs > 32 && deltaMs < 1000) this.slowFrames++;

    // animation time is clamped to 1/30s per tick; the camera follow uses real time
    // (an exponential damp is stable at any step) so a slow device never adds input lag
    this.pendingDt += Math.min(raw, 1 / 30);
    this.pendingReal += Math.min(raw, 0.1);
    this.frame++;

    // idle: nothing moved for 500ms → draw every 2nd frame (time still advances correctly)
    const rig = this.rig;
    const active =
      this.wall < this.awakeUntil ||
      rig.speed > 0.002 ||
      rig.intro.v > 0.0001 ||
      Math.abs(globals.uVelocity.value) > 0.002 ||
      this.world.veilUniform.value > 0.0001;
    if (active) this.lastActive = this.wall;
    this.idle = this.wall - this.lastActive > 0.5;
    if (this.idle && (this.frame & 1) === 1) return;

    const dt = this.pendingDt;
    this.pendingDt = 0;
    this.time += dt;
    globals.uTime.value = this.time;
    const kv = 1 - Math.pow(0.9, dt * 60);
    globals.uVelocity.value += (this.velocity - globals.uVelocity.value) * kv;

    rig.update(this.pendingReal);
    this.pendingReal = 0;
    const cam = rig.camera;
    this.lights.update(cam, rig.target, this.time);
    const f = this.ctx;
    f.dt = dt;
    f.time = this.time;
    f.width = this.width;
    f.height = this.height;
    this.world.update(f);

    // shadows: every frame while the camera is moving, every 4th when slow
    if (rig.speed > 0.4 || this.frame % 4 === 0) this.renderer.shadowMap.needsUpdate = true;

    this.renderer.info.reset();
    if (this.composer) {
      this.bloom!.strength = this.lights.state.bloom;
      this.bloom!.threshold = this.lights.bgLuminance * 1.05;
      const b = this.bokeh!;
      b.enabled = this.dof.aperture > 0.0001;
      (b.uniforms as Record<string, THREE.IUniform>).focus.value = this.dof.focus;
      (b.uniforms as Record<string, THREE.IUniform>).aperture.value = this.dof.aperture;
      this.grainUniforms!.uTime.value = this.time;
      this.composer.render(dt);
    } else {
      this.renderer.render(this.scene, cam);
    }

    if (!this.idle) this.adapt(raw);
  }

  /**
   * Adaptive pixel ratio: under 52fps for 1s → step down 0.25 (floor 1.0);
   * over 58fps for 3s → step back up toward the tier's cap. A ratio that just
   * failed is not retried straight away, so it cannot oscillate.
   */
  private adapt(raw: number) {
    if (raw > 0.25) return; // tab switch / breakpoint, not a slow frame
    this.winT += raw;
    this.winN++;
    if (this.winT < 0.5) return;
    const fps = this.winN / this.winT;
    const span = this.winT;
    this.winT = 0;
    this.winN = 0;
    if (this.wall < 4) return; // loader + intro are not representative
    if (fps < 52) {
      this.lowT += span;
      this.highT = 0;
    } else if (fps > 58) {
      this.highT += span;
      this.lowT = 0;
    } else {
      this.lowT = this.highT = 0;
    }
    const floor = Math.min(1, quality.dprCap);
    if (this.lowT >= 1 && quality.dpr > floor) {
      // a step-up that failed within 10s: wait longer before trying it again
      this.upLock = this.wall - this.lastStepUp < 10 ? Math.min(this.upLock * 2, 120) : 5;
      this.upLockUntil = this.wall + this.upLock;
      this.setDpr(Math.max(floor, quality.dpr - 0.25));
    } else if (this.highT >= 3 && quality.dpr < quality.dprCap && this.wall > this.upLockUntil) {
      this.lastStepUp = this.wall;
      this.setDpr(Math.min(quality.dprCap, quality.dpr + 0.25));
    }
  }

  setDpr(dpr: number) {
    if (dpr === quality.dpr) return;
    quality.dpr = dpr;
    globals.uPixelRatio.value = dpr;
    this.renderer.setPixelRatio(dpr);
    this.composer?.setPixelRatio(dpr);
    this.lowT = this.highT = 0;
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    // mobile URL bar showing/hiding: keep the drawing buffer (reallocating every
    // render target mid-scroll is a visible hitch); only the projection follows
    const barOnly = quality.touch && w === this.width && Math.abs(h - this.height) < this.height * 0.25;
    this.rig.resize(w / h);
    if (barOnly) return;
    this.width = w;
    this.height = h;
    this.renderer.setSize(w, h);
    this.composer?.setSize(w, h);
    this.bloom?.resolution.set(w / 2, h / 2);
    this.keepAwake(1);
  }

  /** draw calls etc. for the perf pass: window.__perf() and the ?perf overlay */
  stats() {
    const i = this.renderer.info;
    let sum = 0;
    let max = 0;
    let n = 0;
    for (let k = 0; k < RING; k++) {
      const v = this.ring[k];
      if (v > 0) {
        sum += v;
        n++;
        if (v > max) max = v;
      }
    }
    const ms = n ? sum / n : 0;
    return {
      fps: ms ? +(1000 / ms).toFixed(1) : 0,
      frameMs: +ms.toFixed(2),
      frameMaxMs: +max.toFixed(1),
      slowFrames: this.slowFrames,
      calls: i.render.calls,
      triangles: i.render.triangles,
      geometries: i.memory.geometries,
      textures: i.memory.textures,
      textureMB: +(this.assets.estimateBytes() / 1048576).toFixed(1),
      programs: i.programs?.length ?? 0,
      dpr: quality.dpr,
      dprCap: quality.dprCap,
      tier: quality.tier,
      idle: this.idle,
    };
  }

  destroy() {
    clearTimeout(this.resizeTimer);
    window.removeEventListener('resize', this.onResize);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.world.dispose();
    this.assets.dispose();
    this.envMap.dispose();
    disposePlaneGeometries();
    disposeContactShadowTexture();
    disposeGlowTexture();
    this.composer?.passes.forEach((p) => (p as { dispose?: () => void }).dispose?.());
    this.composer?.dispose();
    this.renderer.dispose();
    Experience.instance = null;
  }
}
