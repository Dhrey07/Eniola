import * as THREE from 'three';
import { Room, type RoomContext, type FrameContext, glowSprite } from './Room';
import { LayeredPlane } from '../objects/LayeredPlane';
import { content } from '../../content';
import type { StationDef } from '../../scroll/sections';

/** People: 6 portrait stacks in a loose arc around one warm light. */
export class PeopleRoom extends Room {
  frames: LayeredPlane[] = [];
  light: THREE.PointLight;
  orb: THREE.Sprite;
  private q = new THREE.Quaternion();
  private m = new THREE.Matrix4();
  private wp = new THREE.Vector3();
  private tp = new THREE.Vector3();

  constructor(def: StationDef, ctx: RoomContext) {
    super(def, ctx);
    const hub = this.local(11.2, 2.5, -19.5);
    const portraits = content.people.portraits;
    const R = 3.8;
    portraits.forEach((layers, i) => {
      const a = THREE.MathUtils.degToRad(-56 + (112 * i) / (portraits.length - 1));
      const p = this.addPlane(new LayeredPlane(ctx.assets, layers, { width: 1.8, height: 2.25, bend: 0.3 }));
      p.position.set(hub.x + Math.sin(a) * R, hub.y + Math.sin(i * 1.7) * 0.35, hub.z - Math.cos(a) * R * 0.8);
      this.frames.push(p);
    });
    this.light = new THREE.PointLight('#ffb07a', 0, 16, 2);
    this.light.position.copy(hub);
    this.orb = glowSprite('#ffcf9e', 3.4, 0.6);
    this.orb.position.copy(hub);
    this.group.add(this.light, this.orb);
  }

  update(f: FrameContext) {
    super.update(f);
    const k = f.light.practical;
    this.light.intensity = k * 26;
    this.orb.material.opacity = 0.1 + k * 0.5 + Math.sin(f.time * 1.3) * 0.05 * k;
    // billboard lerp: each frame turns (yaw only) toward the camera
    const damp = 1 - Math.pow(0.95, f.dt * 60);
    for (const fr of this.frames) {
      fr.getWorldPosition(this.wp);
      const target = this.tp.copy(f.camera.position).setY(this.wp.y);
      this.m.lookAt(target, this.wp, THREE.Object3D.DEFAULT_UP);
      this.q.setFromRotationMatrix(this.m);
      fr.quaternion.slerp(this.q, damp);
    }
  }
}
