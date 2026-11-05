import * as THREE from 'three';
import type { StationDef } from '../../scroll/sections';
import type { Assets } from '../Assets';
import type { LayeredPlane } from '../objects/LayeredPlane';
import type { CameraRig } from '../Camera';
import type { LightState } from '../Lights';

export interface RoomContext {
  assets: Assets;
  renderer: THREE.WebGLRenderer;
  rig: CameraRig;
  envMap: THREE.Texture;
}

export interface FrameContext {
  dt: number;
  time: number;
  camera: THREE.PerspectiveCamera;
  light: LightState;
  width: number;
  height: number;
}

/**
 * A station "room": a group at the station centre. The master timeline
 * tweens `state` (scale for approach/exit, reveal for the image wipe,
 * focus for per-room extras); `update()` applies it every frame.
 */
export class Room {
  group = new THREE.Group();
  /** objects placed in world space, NOT affected by the room's scale tween */
  detached = new THREE.Group();
  planes: LayeredPlane[] = [];
  state = { reveal: 0, scale: 0.85, extra: 0 };
  center: THREE.Vector3;

  constructor(public def: StationDef, protected ctx: RoomContext) {
    this.center = new THREE.Vector3(...def.center);
    this.group.position.copy(this.center);
    this.group.name = def.id;
  }

  /** world → room-local coordinates */
  local(x: number, y: number, z: number) {
    return new THREE.Vector3(x, y, z).sub(this.center);
  }

  protected addPlane(p: LayeredPlane, parent: THREE.Object3D = this.group) {
    this.planes.push(p);
    parent.add(p);
    return p;
  }

  get textures(): THREE.Texture[] {
    return this.planes.flatMap((p) => p.textures);
  }

  update(_f: FrameContext) {
    this.group.scale.setScalar(this.state.scale);
    for (const p of this.planes) p.reveal.value = this.state.reveal;
  }
}

/** Soft additive glow sprite (canvas radial gradient). */
let glowTex: THREE.CanvasTexture | null = null;
export function glowSprite(color: THREE.ColorRepresentation, size: number, opacity = 1) {
  if (!glowTex) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d')!;
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.25, 'rgba(255,255,255,0.45)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
    glowTex = new THREE.CanvasTexture(c);
  }
  const s = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTex,
      color,
      transparent: true,
      opacity,
      depthWrite: false,
    })
  );
  s.scale.setScalar(size);
  return s;
}
export function disposeGlowTexture() {
  glowTex?.dispose();
  glowTex = null;
}
