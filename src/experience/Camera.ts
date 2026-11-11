import * as THREE from 'three';
import { buildRailPoints } from '../scroll/sections';
import { quality } from './globals';

const v3 = (a: number[]) => new THREE.Vector3(a[0], a[1], a[2]);
const PARALLAX_RATE = -Math.log(1 - 0.05) * 60;

/**
 * CatmullRom position rail + look-at rail. The master timeline writes
 * `state.t` (rail parameter), `state.fov` and `state.roll`; this class
 * follows those values with a short exponential damp every frame. The
 * cinematic weight lives in the timeline eases, not in input lag.
 */
export class CameraRig {
  camera: THREE.PerspectiveCamera;
  positionRail: THREE.CatmullRomCurve3;
  targetRail: THREE.CatmullRomCurve3;
  railT: { arrive: number; leave: number }[];
  state = { t: 0, fov: 35, roll: 0 };
  /** 1 = pulled far back (intro), 0 = on the rail */
  intro = { v: 1 };
  /** rail-follow rate in 1/s (exponential, frame-rate independent); Infinity = snap (reduced motion) */
  follow = quality.reduced ? Infinity : 14;
  lookAhead = 0.0015;
  speed = 0;

  private pos = new THREE.Vector3();
  private look = new THREE.Vector3();
  private tmpPos = new THREE.Vector3();
  private tmpLook = new THREE.Vector3();
  private mouse = new THREE.Vector2();
  private mouseTarget = new THREE.Vector2();
  private last = new THREE.Vector3();
  private introOffset = new THREE.Vector3(2, 9, 26);

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(35, aspect, 0.1, 400);
    const rail = buildRailPoints();
    this.positionRail = new THREE.CatmullRomCurve3(rail.pos.map(v3), false, 'centripetal', 0.5);
    this.targetRail = new THREE.CatmullRomCurve3(rail.look.map(v3), false, 'centripetal', 0.5);
    this.railT = rail.t;
    this.positionRail.getPoint(0, this.pos);
    this.targetRail.getPoint(0, this.look);
    this.camera.position.copy(this.pos);
    this.camera.lookAt(this.look);
  }

  setPointer(nx: number, ny: number) {
    if (quality.touch || quality.reduced) return;
    this.mouseTarget.set(nx * 0.15, ny * 0.15);
  }

  /** current damped look target (lights follow this) */
  get target() {
    return this.look;
  }

  update(dt: number) {
    const t = THREE.MathUtils.clamp(this.state.t, 0, 1);
    this.positionRail.getPoint(t, this.tmpPos);
    this.targetRail.getPoint(Math.min(1, t + this.lookAhead), this.tmpLook);

    // one light, frame-rate independent damp: the camera settles ~200ms after the scroll does
    const k = this.follow === Infinity ? 1 : 1 - Math.exp(-this.follow * dt);
    this.pos.lerp(this.tmpPos, k);
    this.look.lerp(this.tmpLook, k);
    // mouse parallax keeps its soft float (same rate as before: 0.05 per 60fps frame)
    this.mouse.lerp(this.mouseTarget, 1 - Math.exp(-PARALLAX_RATE * dt));

    const cam = this.camera;
    cam.position.copy(this.pos).addScaledVector(this.introOffset, this.intro.v);
    cam.position.x += this.mouse.x;
    cam.position.y += this.mouse.y;
    cam.up.set(0, 1, 0);
    cam.lookAt(this.look);
    if (this.state.roll) cam.rotateZ(THREE.MathUtils.degToRad(this.state.roll));

    if (Math.abs(cam.fov - this.state.fov) > 0.001) {
      cam.fov = this.state.fov;
      cam.updateProjectionMatrix();
    }
    this.speed = cam.position.distanceTo(this.last) / Math.max(dt, 1e-4);
    this.last.copy(cam.position);
  }

  resize(aspect: number) {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }
}
