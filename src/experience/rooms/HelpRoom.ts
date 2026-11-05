import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { Room, type RoomContext, type FrameContext } from './Room';
import { contactShadow } from '../Assets';
import { LayeredPlane } from '../objects/LayeredPlane';
import { content } from '../../content';
import type { StationDef } from '../../scroll/sections';
import sheenVert from '../shaders/sheen.vert';
import sheenFrag from '../shaders/sheen.frag';
import gsap from 'gsap';
import { quality } from '../globals';

interface Card {
  slot: THREE.Object3D; // un-tilted anchor (used for the HTML projection)
  mesh: THREE.Mesh;
  sheen: THREE.ShaderMaterial;
  tilt: THREE.Vector2;
  tiltTarget: THREE.Vector2;
  el?: HTMLElement;
}

const W = 2.8;
const H = 3.5;
const D = 0.1;

/**
 * Help: three physical cards at staggered depths, each casting a shadow.
 * Their HTML twins (title, copy, CTA) are positioned every frame by
 * projecting each card's face to the screen, so text stays crisp and
 * accessible while the 3D card tilts toward the cursor.
 */
export class HelpRoom extends Room {
  cards: Card[] = [];
  private corners = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];

  constructor(def: StationDef, ctx: RoomContext) {
    super(def, ctx);
    const geo = new RoundedBoxGeometry(W, H, D, 4, 0.07);
    const sheenGeo = new THREE.PlaneGeometry(W * 0.98, H * 0.98);
    const slots: [number, number, number, number][] = [
      [-11.5, 2.4, -80.6, 0.12], // card 1 (left)
      [-8.0, 2.4, -81.4, 0.0], // card 2
      [-4.5, 2.4, -80.0, -0.12], // card 3 (right)
    ];
    for (const [x, y, z, ry] of slots) {
      const slot = new THREE.Object3D();
      slot.position.copy(this.local(x, y, z));
      slot.rotation.y = ry;
      const mesh = new THREE.Mesh(
        geo,
        new THREE.MeshPhysicalMaterial({
          color: '#f8e6d7',
          roughness: 0.6,
          clearcoat: 0.3,
          clearcoatRoughness: 0.4,
          sheen: 0.3,
          sheenColor: new THREE.Color('#ffffff'),
        })
      );
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const sheen = new THREE.ShaderMaterial({
        vertexShader: sheenVert,
        fragmentShader: sheenFrag,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uSheen: { value: 0 }, uStrength: { value: 0 } },
      });
      const sheenMesh = new THREE.Mesh(sheenGeo, sheen);
      sheenMesh.position.z = D / 2 + 0.003;
      mesh.add(sheenMesh);
      slot.add(mesh);
      const sh = contactShadow(W * 1.4, 1.2, 0.55);
      sh.position.set(slot.position.x, 0.012, slot.position.z + 0.2);
      this.group.add(slot, sh);
      this.cards.push({ slot, mesh, sheen, tilt: new THREE.Vector2(), tiltTarget: new THREE.Vector2() });
    }
    // her mentoring photo as a backdrop behind the cards
    const back = this.addPlane(new LayeredPlane(ctx.assets, content.help.image, { width: 9.8, height: 7, bend: 0.1, castShadow: false }));
    back.position.copy(this.local(-8, 3.6, -90));
  }

  /** wire the HTML twins (one element per card) */
  bind(els: HTMLElement[]) {
    els.forEach((el, i) => {
      const c = this.cards[i];
      if (!c) return;
      c.el = el;
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const nx = (e.clientX - r.left) / r.width - 0.5;
        const ny = (e.clientY - r.top) / r.height - 0.5;
        c.tiltTarget.set(ny * 2, nx * 2); // ±1 → ±10°
      });
      el.addEventListener('pointerenter', () => this.sweep(c));
      el.addEventListener('focusin', () => this.sweep(c));
      el.addEventListener('pointerleave', () => c.tiltTarget.set(0, 0));
    });
  }

  private sweep(c: Card) {
    gsap.fromTo(c.sheen.uniforms.uSheen, { value: 0 }, { value: 1, duration: 1.1, ease: 'power2.inOut' });
    gsap.fromTo(c.sheen.uniforms.uStrength, { value: 0.35 }, { value: 0, duration: 1.2, ease: 'power1.in' });
  }

  update(f: FrameContext) {
    super.update(f);
    const k = 1 - Math.pow(0.9, f.dt * 60);
    const max = THREE.MathUtils.degToRad(10);
    for (const c of this.cards) {
      c.tilt.lerp(c.tiltTarget, k);
      c.mesh.rotation.x = c.tilt.x * max;
      c.mesh.rotation.y = c.tilt.y * max;
      if (c.el && !quality.mobile) this.project(c, f);
    }
  }

  /** project the un-tilted card face to screen space and size the HTML twin */
  private project(c: Card, f: FrameContext) {
    c.slot.updateWorldMatrix(true, false);
    const hw = W / 2;
    const hh = H / 2;
    const pts: [number, number][] = [
      [-hw, hh],
      [hw, hh],
      [hw, -hh],
      [-hw, -hh],
    ];
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let behind = false;
    pts.forEach(([x, y], i) => {
      const v = this.corners[i].set(x, y, D / 2).applyMatrix4(c.slot.matrixWorld).project(f.camera);
      if (v.z > 1) behind = true;
      const sx = (v.x * 0.5 + 0.5) * f.width;
      const sy = (-v.y * 0.5 + 0.5) * f.height;
      minX = Math.min(minX, sx);
      maxX = Math.max(maxX, sx);
      minY = Math.min(minY, sy);
      maxY = Math.max(maxY, sy);
    });
    const el = c.el!;
    if (behind) {
      el.style.transform = 'translate3d(-9999px,0,0)';
      return;
    }
    el.style.transform = `translate3d(${minX.toFixed(1)}px, ${minY.toFixed(1)}px, 0)`;
    el.style.width = `${(maxX - minX).toFixed(1)}px`;
    el.style.height = `${(maxY - minY).toFixed(1)}px`;
  }
}
