import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { Room, type RoomContext, type FrameContext } from './Room';
import { LayeredPlane } from '../objects/LayeredPlane';
import { content } from '../../content';
import type { StationDef } from '../../scroll/sections';
import { quality } from '../globals';

/**
 * What I Love Doing: seven frames on a helix that orbit the camera during
 * the spiral descent, plus a tiny phone whose feed scrolls forever.
 */
export class FunRoom extends Room {
  helix = new THREE.Group();
  feed: THREE.Texture;
  phone = new THREE.Group();
  frames: LayeredPlane[] = [];

  constructor(def: StationDef, ctx: RoomContext) {
    super(def, ctx);
    this.helix.position.copy(this.local(-4, 0, -103.6));
    this.group.add(this.helix);
    const R = 3.4;
    content.fun.frames.forEach((layers, i) => {
      const a = i * THREE.MathUtils.degToRad(72) + Math.PI * 0.5;
      const y = 7.4 - i * 0.85;
      const p = this.addPlane(new LayeredPlane(ctx.assets, layers, { width: 1.5, height: 1.85, bend: 0.5 }), this.helix);
      p.position.set(Math.cos(a) * R, y, Math.sin(a) * R);
      this.frames.push(p);
    });

    // the "2 hrs of scrolling" wink
    this.feed = ctx.assets.load(content.fun.phoneFeed, { repeat: true });
    this.feed.repeat.set(1, 0.32);
    const bezel = new THREE.Mesh(
      new RoundedBoxGeometry(0.62, 1.2, 0.06, 3, 0.06),
      new THREE.MeshStandardMaterial({ color: '#281c18', roughness: 0.35, metalness: 0.4 })
    );
    bezel.castShadow = true;
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(0.54, 1.08),
      new THREE.MeshBasicMaterial({ map: this.feed, toneMapped: false })
    );
    screen.position.z = 0.032;
    this.phone.add(bezel, screen);
    this.phone.position.copy(this.local(-5.6, 1.9, -100.5));
    this.phone.rotation.set(-0.05, 0.4, -0.08);
    this.phone.scale.setScalar(1.5);
    this.group.add(this.phone);
  }

  get textures() {
    return [...super.textures, this.feed];
  }

  update(f: FrameContext) {
    super.update(f);
    // spin = scroll-driven (state.extra, tweened by the master timeline) + slow drift
    const spin = this.state.extra * Math.PI * 1.2 + (quality.reduced ? 0 : f.time * 0.03);
    this.helix.rotation.y = spin;
    // carousel: frames orbit, but keep turning to face the camera side (+Z), with a slight lean
    for (let i = 0; i < this.frames.length; i++) this.frames[i].rotation.y = -spin + Math.sin(spin + i) * 0.25;
    this.feed.offset.y -= f.dt * (quality.reduced ? 0 : 0.09);
    this.phone.position.y = 1.9 + Math.sin(f.time * 1.4) * 0.04;
  }
}
