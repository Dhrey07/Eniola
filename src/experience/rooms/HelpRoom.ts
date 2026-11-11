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
import { Experience } from '../Experience';

interface Card {
  slot: THREE.Object3D; // un-tilted anchor (used for the HTML projection)
  mesh: THREE.Mesh;
  sheen: THREE.ShaderMaterial;
  tilt: THREE.Vector2;
  tiltTarget: THREE.Vector2;
  el?: HTMLElement;
  /** last values written to the DOM (tenths of a px) so unchanged frames write nothing */
  lx: number;
  ly: number;
  lw: number;
  lh: number;
}

const PARKED = -99990;

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
  private corner = new THREE.Vector3();
  /** the Help <section>: its twins are only projected while it is visible */
  private section: HTMLElement | null = null;

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
      this.cards.push({ slot, mesh, sheen, tilt: new THREE.Vector2(), tiltTarget: new THREE.Vector2(), lx: NaN, ly: NaN, lw: NaN, lh: NaN });
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
      this.section ??= el.closest<HTMLElement>('.station');
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
    Experience.instance?.keepAwake(1.5);
    gsap.fromTo(c.sheen.uniforms.uSheen, { value: 0 }, { value: 1, duration: 1.1, ease: 'power2.inOut' });
    gsap.fromTo(c.sheen.uniforms.uStrength, { value: 0.35 }, { value: 0, duration: 1.2, ease: 'power1.in' });
  }

  update(f: FrameContext) {
    super.update(f);
    const k = 1 - Math.pow(0.9, f.dt * 60);
    const max = THREE.MathUtils.degToRad(10);
    // gsap's autoAlpha parks the section at visibility:hidden while it is off stage
    const onStage = !quality.mobile && !!this.section && this.section.style.visibility !== 'hidden';
    for (let i = 0; i < this.cards.length; i++) {
      const c = this.cards[i];
      c.tilt.lerp(c.tiltTarget, k);
      c.mesh.rotation.x = c.tilt.x * max;
      c.mesh.rotation.y = c.tilt.y * max;
      if (c.el && onStage) this.project(c, f);
    }
  }

  /** project the un-tilted card face to screen space and size the HTML twin */
  private project(c: Card, f: FrameContext) {
    c.slot.updateWorldMatrix(true, false);
    const hw = W / 2;
    const hh = H / 2;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let behind = false;
    for (let i = 0; i < 4; i++) {
      // corners: (-hw, hh) (hw, hh) (hw, -hh) (-hw, -hh)
      const v = this.corner
        .set(i === 0 || i === 3 ? -hw : hw, i < 2 ? hh : -hh, D / 2)
        .applyMatrix4(c.slot.matrixWorld)
        .project(f.camera);
      if (v.z > 1) behind = true;
      const sx = (v.x * 0.5 + 0.5) * f.width;
      const sy = (-v.y * 0.5 + 0.5) * f.height;
      if (sx < minX) minX = sx;
      if (sx > maxX) maxX = sx;
      if (sy < minY) minY = sy;
      if (sy > maxY) maxY = sy;
    }
    const el = c.el!;
    if (behind) {
      if (c.lx !== PARKED) {
        c.lx = PARKED;
        el.style.transform = 'translate3d(-9999px,0,0)';
      }
      return;
    }
    // same 0.1px precision as before; the DOM is only touched when a value actually changed,
    // so a settled camera costs no style or layout work
    const x = Math.round(minX * 10);
    const y = Math.round(minY * 10);
    const w = Math.round((maxX - minX) * 10);
    const h = Math.round((maxY - minY) * 10);
    if (x !== c.lx || y !== c.ly) {
      c.lx = x;
      c.ly = y;
      el.style.transform = `translate3d(${(x / 10).toFixed(1)}px, ${(y / 10).toFixed(1)}px, 0)`;
    }
    if (w !== c.lw) {
      c.lw = w;
      el.style.width = `${(w / 10).toFixed(1)}px`;
    }
    if (h !== c.lh) {
      c.lh = h;
      el.style.height = `${(h / 10).toFixed(1)}px`;
    }
  }
}
