import { Room, type RoomContext } from './Room';
import { LayeredPlane } from '../objects/LayeredPlane';
import { content } from '../../content';
import type { StationDef } from '../../scroll/sections';

/**
 * My Style: stripped back. One deep stack — a background plate, the
 * garment 5.5 units in front of it, a faint leak in front of that — so the
 * Bokeh rack focus has real distance to travel. Grade goes monochrome via
 * the shared uSaturation uniform (light keyframe).
 */
export class StyleRoom extends Room {
  constructor(def: StationDef, ctx: RoomContext) {
    super(def, ctx);
    const stack = this.addPlane(
      new LayeredPlane(ctx.assets, content.style.image, { width: 6.3, height: 4.5, bend: 0.15, parallax: 0.08 })
    );
    stack.position.copy(this.local(3.2, 2.75, -133));
  }
}
