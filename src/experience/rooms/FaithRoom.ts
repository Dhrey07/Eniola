import * as THREE from 'three';
import { Room, type RoomContext, type FrameContext, glowSprite } from './Room';
import { LayeredPlane } from '../objects/LayeredPlane';
import { content } from '../../content';
import type { StationDef } from '../../scroll/sections';
import beamVert from '../shaders/beam.vert';
import beamFrag from '../shaders/beam.frag';
import dustVert from '../shaders/dust.vert';
import dustFrag from '../shaders/dust.frag';
import { globals, quality } from '../globals';

/** Faith: a single vertical beam of light with dust drifting inside it. */
export class FaithRoom extends Room {
  beam: THREE.Mesh<THREE.ConeGeometry, THREE.ShaderMaterial>;
  dust: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  light: THREE.PointLight;
  pool: THREE.Sprite;

  constructor(def: StationDef, ctx: RoomContext) {
    super(def, ctx);
    const H = 15;
    this.beam = new THREE.Mesh(
      new THREE.ConeGeometry(2.7, H, 48, 1, true),
      new THREE.ShaderMaterial({
        vertexShader: beamVert,
        fragmentShader: beamFrag,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        uniforms: { uTime: globals.uTime, uIntensity: { value: 0 }, uColor: { value: new THREE.Color('#f1d39c') } },
      })
    );
    this.beam.position.y = H / 2;
    this.beam.renderOrder = 5;
    this.group.add(this.beam);

    const plane = this.addPlane(new LayeredPlane(ctx.assets, content.faith.image, { width: 3.2, height: 2.29, bend: 0.2 }));
    plane.position.set(0, 2.5, -1.4);

    // dust motes inside the beam
    const n = quality.mobile ? 120 : 280;
    const pos = new Float32Array(n * 3);
    const seed = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const r = Math.sqrt(Math.random()) * 2.0;
      const a = Math.random() * Math.PI * 2;
      pos.set([Math.cos(a) * r, 1 + Math.random() * 10, Math.sin(a) * r], i * 3);
      seed[i] = Math.random();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    this.dust = new THREE.Points(
      g,
      new THREE.ShaderMaterial({
        vertexShader: dustVert,
        fragmentShader: dustFrag,
        transparent: true,
        depthWrite: false,
        uniforms: {
          uTime: globals.uTime,
          uSize: { value: 3.2 },
          uPixelRatio: { value: quality.dpr },
          uDrift: { value: quality.reduced ? 0 : 0.6 },
          uColor: { value: new THREE.Color('#c99a52') },
          uOpacity: { value: 0 },
        },
      })
    );
    this.group.add(this.dust);

    this.light = new THREE.PointLight('#fff0d0', 0, 14, 2);
    this.light.position.set(0, 1.6, 0.6);
    this.pool = glowSprite('#f3d6a4', 7, 0);
    this.pool.position.set(0, 0.1, 0);
    this.group.add(this.light, this.pool);
  }

  update(f: FrameContext) {
    super.update(f);
    const k = f.light.practical * this.state.reveal;
    this.beam.material.uniforms.uIntensity.value = 0.6 * k;
    this.dust.material.uniforms.uOpacity.value = 0.6 * k;
    this.light.intensity = 22 * k;
    this.pool.material.opacity = 0.4 * k;
  }
}
