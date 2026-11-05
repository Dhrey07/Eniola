import * as THREE from 'three';
import { Room, type RoomContext, type FrameContext, glowSprite } from './Room';
import type { StationDef } from '../../scroll/sections';
import { stations } from '../../scroll/sections';

/**
 * Say hi: the finale. Beacons light up at every station along the
 * corridor so, when the camera pulls back, the whole journey reads as one
 * glowing path behind the headline.
 */
export class SayHiRoom extends Room {
  beacons: THREE.Sprite[] = [];

  constructor(def: StationDef, ctx: RoomContext) {
    super(def, ctx);
    for (const s of stations.slice(0, 8)) {
      const b = glowSprite('#d9a066', 5, 0);
      b.position.set(s.center[0], 0.4, s.center[2]);
      this.detached.add(b);
      this.beacons.push(b);
    }
  }

  update(f: FrameContext) {
    super.update(f);
    const g = f.light.glow;
    this.beacons.forEach((b, i) => {
      b.material.opacity = Math.max(0, g - 0.2) * 0.7 * (0.75 + 0.25 * Math.sin(f.time * 1.2 + i));
      b.scale.setScalar(5 + g * 9);
    });
  }
}

/** Footer: no props; the camera simply drifts up into the fog. */
export class FooterRoom extends Room {}
