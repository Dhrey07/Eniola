import * as THREE from 'three';
import { Room, type RoomContext, type FrameContext, glowSprite } from './Room';
import { LayeredPlane } from '../objects/LayeredPlane';
import { contactShadow } from '../Assets';
import { content } from '../../content';
import type { StationDef } from '../../scroll/sections';

/** Hero: layered portrait off to the right, a low golden-hour sun behind. */
export class HeroRoom extends Room {
  portrait: LayeredPlane;
  sun: THREE.Sprite;

  constructor(def: StationDef, ctx: RoomContext) {
    super(def, ctx);
    this.state.scale = 1;
    this.state.reveal = 0;
    this.portrait = this.addPlane(
      new LayeredPlane(ctx.assets, content.hero.image, { width: 3.0, height: 3.75, bend: 0.4, parallax: 0.16 })
    );
    this.portrait.position.copy(this.local(2.7, 2.35, 0));
    this.portrait.rotation.y = -0.16;

    const shadow = contactShadow(3.4, 1.4, 0.5);
    shadow.position.add(this.local(2.7, 0, 0.3));
    this.group.add(shadow);

    this.sun = glowSprite('#ffd7a8', 26, 0.4);
    this.sun.position.copy(this.local(-6, 6, -26));
    this.group.add(this.sun);
  }

  update(f: FrameContext) {
    super.update(f);
    this.sun.material.opacity = 0.3 + 0.12 * Math.sin(f.time * 0.3);
  }
}
