import * as THREE from 'three';
import type { LightPreset } from '../scroll/sections';
import { globals, quality } from './globals';

/** Flat, tweenable numeric light state (colours as r/g/b numbers). */
export type LightState = Record<string, number>;

const colorKeys = ['bg', 'key', 'hemiSky', 'hemiGround', 'rim', 'accent'] as const;
const numKeys = [
  'keyIntensity',
  'hemiIntensity',
  'rimIntensity',
  'accentIntensity',
  'exposure',
  'fog',
  'saturation',
  'practical',
  'gold',
  'glow',
  'bloom',
] as const;

export function presetToState(p: LightPreset): LightState {
  const s: LightState = {};
  const c = new THREE.Color();
  for (const k of colorKeys) {
    c.set(p[k]);
    s[k + 'R'] = c.r;
    s[k + 'G'] = c.g;
    s[k + 'B'] = c.b;
  }
  for (const k of numKeys) s[k] = p[k];
  s.dirX = p.keyDir[0];
  s.dirY = p.keyDir[1];
  s.dirZ = p.keyDir[2];
  return s;
}

// exact inverse of three.js ACESFilmic (r150+) — see shaders/tonemap_inv.glsl
const IN_INV = [
  [1.764741, -0.6757777, -0.0889633],
  [-0.1470279, 1.1602515, -0.0132237],
  [-0.0363368, -0.1624364, 1.1987733],
];
const OUT_INV = [
  [0.6430382, 0.3111868, 0.0457755],
  [0.0592687, 0.9314365, 0.0092949],
  [0.0059619, 0.063929, 0.9301184],
];
const mul = (m: number[][], v: number[]) => m.map((r) => r[0] * v[0] + r[1] * v[1] + r[2] * v[2]);
function inverseACES(c: number[], exposure: number) {
  const y = mul(OUT_INV, c).map((v) => Math.min(0.985, Math.max(0, v)));
  const v = y.map((y) => {
    const A = 1 - 0.983729 * y;
    const B = 0.0245786 - 0.432951 * y;
    const C = -(0.000090537 + 0.238081 * y);
    return (-B + Math.sqrt(Math.max(B * B - 4 * A * C, 0))) / (2 * A);
  });
  return mul(IN_INV, v).map((x) => (x * 0.6) / exposure);
}

/**
 * Key (directional, shadow-casting, follows the camera target), hemisphere
 * fill, rim spot behind subjects, a teal/coral accent and the shared fog.
 */
export class Lights {
  key: THREE.DirectionalLight;
  hemi: THREE.HemisphereLight;
  rim: THREE.SpotLight;
  accent: THREE.PointLight;
  state: LightState;
  private dir = new THREE.Vector3();
  private tmp = new THREE.Vector3();
  private white = new THREE.Color(1, 1, 1);
  private bgTarget = new THREE.Color();
  /** HDR luminance of the background (bloom threshold sits just above it) */
  bgLuminance = 1;

  /**
   * @param toneMappedPost true when tone mapping happens in a post pass (OutputPass):
   *   the background/fog colour is then pre-compensated so the page colour
   *   comes out exactly (#fdf7ef cream, #f8e6d7 blush) after ACES.
   */
  constructor(
    private scene: THREE.Scene,
    private renderer: THREE.WebGLRenderer,
    initial: LightPreset,
    private toneMappedPost = false
  ) {
    this.state = presetToState(initial);

    this.key = new THREE.DirectionalLight(0xffffff, 2.5);
    this.key.castShadow = true;
    const sc = this.key.shadow;
    sc.mapSize.set(quality.shadowMapSize, quality.shadowMapSize);
    sc.bias = -0.0005;
    sc.normalBias = 0.02;
    sc.radius = 4;
    const cam = sc.camera as THREE.OrthographicCamera;
    cam.left = -14;
    cam.right = 14;
    cam.top = 14;
    cam.bottom = -14;
    cam.near = 0.5;
    cam.far = 70;
    scene.add(this.key, this.key.target);

    this.hemi = new THREE.HemisphereLight(0xf3e9dc, 0x5e1a17, 0.5);
    scene.add(this.hemi);

    this.rim = new THREE.SpotLight(0xffcf9a, 40, 40, Math.PI / 5, 0.6, 2);
    scene.add(this.rim, this.rim.target);

    this.accent = new THREE.PointLight(0x5fb3ad, 0, 30, 2);
    scene.add(this.accent);

    scene.fog = new THREE.FogExp2(initial.bg, 0.03);
    scene.background = new THREE.Color(initial.bg);
  }

  /** set scene background + fog to a colour that renders as exactly `target` on screen */
  private applyBackground(target: THREE.Color, exposure: number) {
    const bg = this.scene.background as THREE.Color;
    const fog = (this.scene.fog as THREE.FogExp2).color;
    if (!this.toneMappedPost) {
      bg.copy(target);
      fog.copy(target);
      this.bgLuminance = 1;
      return;
    }
    const x = inverseACES([target.r, target.g, target.b], exposure);
    bg.setRGB(x[0], x[1], x[2]);
    fog.copy(bg);
    this.bgLuminance = 0.2126 * x[0] + 0.7152 * x[1] + 0.0722 * x[2];
  }

  update(camera: THREE.Camera, look: THREE.Vector3, time: number) {
    const s = this.state;
    this.key.color.setRGB(s.keyR, s.keyG, s.keyB);
    this.key.intensity = s.keyIntensity;
    this.dir.set(s.dirX, s.dirY, s.dirZ);
    // the shadow frustum follows the look target (tight, crisp shadows)
    this.key.target.position.copy(look);
    this.key.position.copy(look).add(this.dir.normalize().multiplyScalar(30));

    this.hemi.color.setRGB(s.hemiSkyR, s.hemiSkyG, s.hemiSkyB);
    this.hemi.groundColor.setRGB(s.hemiGroundR, s.hemiGroundG, s.hemiGroundB);
    this.hemi.intensity = s.hemiIntensity;

    // rim: behind the subject, opposite the camera, raised
    this.tmp.copy(look).sub(camera.position).setY(0).normalize();
    this.rim.position.copy(look).addScaledVector(this.tmp, 7);
    this.rim.position.y += 5;
    this.rim.target.position.copy(look);
    this.rim.color.setRGB(s.rimR, s.rimG, s.rimB);
    this.rim.intensity = s.rimIntensity;

    this.accent.color.setRGB(s.accentR, s.accentG, s.accentB);
    this.accent.intensity = s.accentIntensity;
    this.accent.position.set(look.x + Math.sin(time * 0.7) * 4, look.y + 2, look.z + Math.cos(time * 0.7) * 4);

    this.renderer.toneMappingExposure = s.exposure;
    (this.scene.fog as THREE.FogExp2).density = s.fog;
    this.bgTarget.setRGB(s.bgR, s.bgG, s.bgB);
    this.applyBackground(this.bgTarget, s.exposure);
    globals.uFogDisplay.value.copy(this.bgTarget);

    // image planes are unlit; tint them with the rig so the grade evolves
    const tint = globals.uTint.value;
    tint.setRGB(s.keyR, s.keyG, s.keyB).lerp(this.white, 0.92);
    const b = 0.9 + 0.1 * THREE.MathUtils.clamp(s.keyIntensity / 2.4 + s.hemiIntensity * 0.3 - 0.6, 0, 1);
    tint.multiplyScalar(b);
    globals.uExposure.value = s.exposure;
    globals.uSaturation.value = s.saturation;
  }
}
