import * as THREE from 'three';
import { Room, type RoomContext, type FrameContext } from './Room';
import { contactShadow } from '../Assets';
import { LayeredPlane } from '../objects/LayeredPlane';
import { content } from '../../content';
import type { StationDef } from '../../scroll/sections';
import dustVert from '../shaders/dust.vert';
import dustFrag from '../shaders/dust.frag';
import { globals, quality } from '../globals';

/** Something Interesting: a real-time PBR gold ring on a plinth, one sweeping spot. */
export class InterestingRoom extends Room {
  ring: THREE.Group = new THREE.Group();
  spot: THREE.SpotLight;
  motes: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;

  constructor(def: StationDef, ctx: RoomContext) {
    super(def, ctx);
    const gold = new THREE.MeshPhysicalMaterial({
      color: '#D4A84B',
      metalness: 1,
      roughness: 0.2,
      clearcoat: 0.4,
      clearcoatRoughness: 0.15,
      envMap: ctx.envMap,
      envMapIntensity: 1.1,
    });
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.075, 48, 160), gold);
    const link = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.05, 32, 120), gold);
    link.position.set(0.5, -0.28, 0);
    link.rotation.y = Math.PI / 2;
    band.castShadow = link.castShadow = true;
    this.ring.add(band, link);
    this.ring.position.set(0, 2.1, 0);
    this.ring.rotation.x = 0.35;
    this.group.add(this.ring);

    const plinth = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 0.62, 1.5, 48),
      new THREE.MeshStandardMaterial({ color: '#f4ece4', roughness: 0.7, metalness: 0 })
    );
    plinth.position.y = 0.75;
    plinth.castShadow = plinth.receiveShadow = true;
    this.group.add(plinth, contactShadow(2.2, 2.2, 0.7));

    // the real-gold photo from her site, as the backdrop
    const backdrop = this.addPlane(new LayeredPlane(ctx.assets, content.interesting.image, { width: 7, height: 5, bend: 0.1, castShadow: false }));
    backdrop.position.set(1.8, 3.0, -4.5);

    this.spot = new THREE.SpotLight('#ffe2a8', 0, 12, 0.32, 0.55, 2);
    this.spot.castShadow = !quality.mobile;
    this.spot.shadow.mapSize.set(1024, 1024);
    this.spot.shadow.bias = -0.0004;
    this.spot.target = this.ring;
    this.group.add(this.spot);

    const n = 140;
    const pos = new Float32Array(n * 3);
    const seed = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      pos.set([(Math.random() - 0.5) * 4, 1 + Math.random() * 3, (Math.random() - 0.5) * 3 + 0.5], i * 3);
      seed[i] = Math.random();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    this.motes = new THREE.Points(
      g,
      new THREE.ShaderMaterial({
        vertexShader: dustVert,
        fragmentShader: dustFrag,
        transparent: true,
        depthWrite: false,
        uniforms: {
          uTime: globals.uTime,
          uSize: { value: 1.4 },
          uPixelRatio: { value: quality.dpr },
          uDrift: { value: quality.reduced ? 0 : 0.25 },
          uColor: { value: new THREE.Color('#c99a52') },
          uOpacity: { value: 0 },
        },
      })
    );
    this.group.add(this.motes);
  }

  update(f: FrameContext) {
    super.update(f);
    const k = f.light.gold;
    // sweep: scroll-driven (state.extra) + slow breathing
    const a = -1.1 + this.state.extra * 2.2 + Math.sin(f.time * 0.6) * 0.25;
    this.spot.position.set(Math.sin(a) * 3.2, 4.6, 1.8 + Math.cos(a) * 1.2);
    this.spot.intensity = 140 * k;
    this.spot.visible = k > 0.01;
    this.ring.rotation.y = (quality.reduced ? 0 : f.time * 0.25) + this.state.extra * 1.5;
    this.motes.material.uniforms.uOpacity.value = 0.8 * k;
  }
}
