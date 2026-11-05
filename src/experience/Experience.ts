import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import gsap from 'gsap';
import { CameraRig } from './Camera';
import { Lights } from './Lights';
import { World } from './World';
import { Assets, disposeContactShadowTexture } from './Assets';
import { globals, quality } from './globals';
import { stations } from '../scroll/sections';
import { disposePlaneGeometries } from './objects/LayeredPlane';
import { disposeGlowTexture } from './rooms/Room';
import grainFrag from './shaders/grain.frag';

const grainVert = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

/** Singleton: renderer, scene, camera rig, lights, world, post, clock. */
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
  grain?: ShaderPass;
  /** depth-of-field state, tweened by the master timeline (Style rack focus) */
  dof = { aperture: 0, focus: 14 };

  width = window.innerWidth;
  height = window.innerHeight;
  time = 0;
  private velocity = 0;
  private frame = 0;
  private running = false;
  private hidden = false;
  private onResize = () => this.resize();
  private onVisibility = () => (this.hidden = document.hidden);
  private tick = (_t: number, deltaMs: number) => this.update(Math.min(deltaMs / 1000, 0.1));

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

    if (quality.post) this.setupPost();
    window.addEventListener('resize', this.onResize);
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  private setupPost() {
    const rt = new THREE.WebGLRenderTarget(this.width, this.height, { type: THREE.HalfFloatType, samples: 4 });
    const c = (this.composer = new EffectComposer(this.renderer, rt));
    c.setPixelRatio(quality.dpr);
    c.setSize(this.width, this.height);
    c.addPass(new RenderPass(this.scene, this.rig.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(this.width / 2, this.height / 2), 0.35, 0.5, 0.85);
    c.addPass(this.bloom);
    this.bokeh = new BokehPass(this.scene, this.rig.camera, { focus: 14, aperture: 0, maxblur: 0.012 });
    this.bokeh.enabled = false;
    c.addPass(this.bokeh);
    this.grain = new ShaderPass({
      uniforms: {
        tDiffuse: { value: null },
        uTime: { value: 0 },
        uGrain: { value: quality.reduced ? 0 : 0.035 },
        uVignette: { value: 0 },
      },
      vertexShader: grainVert,
      fragmentShader: grainFrag,
    });
    c.addPass(this.grain);
    c.addPass(new OutputPass());
  }

  start() {
    if (this.running) return;
    this.running = true;
    gsap.ticker.add(this.tick);
  }

  /** Lenis velocity (px/frame) → damped shader velocity */
  setScrollVelocity(v: number) {
    this.velocity = quality.reduced ? 0 : THREE.MathUtils.clamp(v / 40, -1, 1);
  }

  update(dt: number) {
    if (this.hidden) return;
    this.time += dt;
    this.frame++;
    globals.uTime.value = this.time;
    const kv = 1 - Math.pow(0.9, dt * 60);
    globals.uVelocity.value += (this.velocity - globals.uVelocity.value) * kv;

    this.rig.update(dt);
    const cam = this.rig.camera;
    this.lights.update(cam, this.rig.target, this.time);
    this.world.update({
      dt,
      time: this.time,
      camera: cam,
      light: this.lights.state,
      width: this.width,
      height: this.height,
    });

    // shadows: every frame while the camera is moving, every 4th when slow
    if (this.rig.speed > 0.4 || this.frame % 4 === 0) this.renderer.shadowMap.needsUpdate = true;

    this.renderer.info.reset();
    if (this.composer) {
      this.bloom!.strength = this.lights.state.bloom;
      this.bloom!.threshold = this.lights.bgLuminance * 1.05;
      const b = this.bokeh!;
      b.enabled = this.dof.aperture > 0.0001;
      (b.uniforms as Record<string, THREE.IUniform>).focus.value = this.dof.focus;
      (b.uniforms as Record<string, THREE.IUniform>).aperture.value = this.dof.aperture;
      this.grain!.uniforms.uTime.value = this.time;
      this.composer.render(dt);
    } else {
      this.renderer.render(this.scene, cam);
    }
  }

  resize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.rig.resize(this.width / this.height);
    this.renderer.setSize(this.width, this.height);
    this.composer?.setSize(this.width, this.height);
    this.bloom?.resolution.set(this.width / 2, this.height / 2);
  }

  /** draw calls etc. for the perf pass: window.__perf() */
  stats() {
    const i = this.renderer.info;
    return {
      calls: i.render.calls,
      triangles: i.render.triangles,
      geometries: i.memory.geometries,
      textures: i.memory.textures,
      textureMB: +(this.assets.estimateBytes() / 1048576).toFixed(1),
      programs: i.programs?.length,
    };
  }

  destroy() {
    gsap.ticker.remove(this.tick);
    this.running = false;
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
