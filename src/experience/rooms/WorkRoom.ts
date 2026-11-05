import * as THREE from 'three';
import { Room, type RoomContext, type FrameContext } from './Room';
import { LayeredPlane } from '../objects/LayeredPlane';
import { content } from '../../content';
import type { StationDef } from '../../scroll/sections';
import { stationIndex } from '../../scroll/sections';

/**
 * Work: a ring ("globe") of instanced map tiles straddling the corridor
 * into the room — the camera flies straight through its centre.
 */
export class WorkRoom extends Room {
  ring = new THREE.Group();
  tiles: THREE.InstancedMesh;
  tileTex: THREE.Texture;

  constructor(def: StationDef, ctx: RoomContext) {
    super(def, ctx);
    const plane = this.addPlane(new LayeredPlane(ctx.assets, content.work.image, { width: 3.8, height: 2.71 }));
    plane.position.copy(this.local(0.2, 2.9, -70.5));

    // ring sits at the corridor midpoint, oriented along the rail tangent
    const rig = ctx.rig;
    const prev = rig.railT[stationIndex('work') - 1];
    const cur = rig.railT[stationIndex('work')];
    const tMid = (prev.leave + cur.arrive) / 2;
    const c = rig.positionRail.getPoint(tMid);
    const tan = rig.positionRail.getTangent(tMid);
    this.ring.position.copy(c);
    this.ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tan.negate());
    this.detached.add(this.ring);

    this.tileTex = ctx.assets.load(content.work.tile);
    const rows = 3;
    const per = 22;
    const R = 4.4;
    const geo = new THREE.PlaneGeometry(1.05, 0.78);
    const mat = new THREE.MeshStandardMaterial({
      map: this.tileTex,
      side: THREE.DoubleSide,
      roughness: 0.55,
      metalness: 0.1,
      emissive: new THREE.Color('#f8e6d7'),
      emissiveIntensity: 0.25,
    });
    this.tiles = new THREE.InstancedMesh(geo, mat, rows * per);
    const d = new THREE.Object3D();
    const col = new THREE.Color();
    let k = 0;
    for (let r = 0; r < rows; r++) {
      for (let i = 0; i < per; i++) {
        const a = (i / per) * Math.PI * 2 + r * 0.14;
        const z = (r - 1) * 1.6;
        d.position.set(Math.cos(a) * R, Math.sin(a) * R, z);
        d.lookAt(0, 0, z);
        d.rotateZ((Math.random() - 0.5) * 0.2);
        d.scale.setScalar(0.8 + Math.random() * 0.45);
        d.updateMatrix();
        this.tiles.setMatrixAt(k, d.matrix);
        col.setHSL(0.07 + Math.random() * 0.04, 0.3, 0.78 + Math.random() * 0.2);
        this.tiles.setColorAt(k, col);
        k++;
      }
    }
    this.tiles.castShadow = true;
    this.ring.add(this.tiles);
  }

  get textures() {
    return [...super.textures, this.tileTex];
  }

  update(f: FrameContext) {
    super.update(f);
    this.ring.rotateZ(f.dt * 0.06);
    this.ring.scale.setScalar(0.6 + this.state.reveal * 0.4);
  }
}
