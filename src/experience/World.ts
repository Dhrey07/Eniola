import * as THREE from 'three';
import { stations, stationIndex } from '../scroll/sections';
import type { CameraRig } from './Camera';
import type { Lights } from './Lights';
import { globals, quality } from './globals';
import { Room, type RoomContext, type FrameContext } from './rooms/Room';
import { HeroRoom } from './rooms/HeroRoom';
import { PeopleRoom } from './rooms/PeopleRoom';
import { FaithRoom } from './rooms/FaithRoom';
import { WorkRoom } from './rooms/WorkRoom';
import { HelpRoom } from './rooms/HelpRoom';
import { FunRoom } from './rooms/FunRoom';
import { StyleRoom } from './rooms/StyleRoom';
import { InterestingRoom } from './rooms/InterestingRoom';
import { SayHiRoom, FooterRoom } from './rooms/SayHiRoom';
import dustVert from './shaders/dust.vert';
import dustFrag from './shaders/dust.frag';
import fsVert from './shaders/fullscreen.vert';
import veilFrag from './shaders/transition.frag';

const roomClasses = [HeroRoom, PeopleRoom, FaithRoom, WorkRoom, HelpRoom, FunRoom, StyleRoom, InterestingRoom, SayHiRoom, FooterRoom];

/**
 * Builds everything that lives in the one scene: the shared corridor
 * (floor, pillars, glowing path, dust) and the ten station rooms.
 */
export class World {
  rooms: Room[];
  floor: THREE.Mesh;
  pillars: THREE.InstancedMesh;
  path: THREE.Mesh<THREE.TubeGeometry, THREE.MeshBasicMaterial>;
  dust: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  veil: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  help: HelpRoom;

  constructor(private scene: THREE.Scene, ctx: RoomContext, private rig: CameraRig, private lights: Lights) {
    // ── floor ──────────────────────────────────────────────
    this.floor = new THREE.Mesh(
      new THREE.PlaneGeometry(520, 520),
      new THREE.MeshStandardMaterial({ color: '#f3e9df', roughness: 0.95, metalness: 0 })
    );
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.position.set(0, 0, -90);
    this.floor.receiveShadow = true;
    scene.add(this.floor);

    // ── ground track of the camera rail (corridor spine) ──
    const tEnd = rig.railT[stationIndex('interesting')].leave;
    const N = 260;
    const ground: THREE.Vector3[] = [];
    for (let i = 0; i <= N; i++) {
      const p = rig.positionRail.getPoint((i / N) * tEnd);
      ground.push(new THREE.Vector3(p.x, 0.03, p.z));
    }
    const spine = new THREE.CatmullRomCurve3(ground, false, 'centripetal');

    // pillars every ~7 units either side of the spine
    const len = spine.getLength();
    const count = Math.floor(len / 7);
    const geo = new THREE.BoxGeometry(0.22, 7.5, 0.22);
    const mat = new THREE.MeshStandardMaterial({ color: '#e0cbbb', roughness: 0.85, metalness: 0 });
    this.pillars = new THREE.InstancedMesh(geo, mat, count * 2);
    const d = new THREE.Object3D();
    let k = 0;
    const side = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      const u = (i + 0.5) / count;
      const p = spine.getPointAt(u);
      const tan = spine.getTangentAt(u);
      side.set(-tan.z, 0, tan.x).normalize();
      for (const s of [-1, 1]) {
        d.position.copy(p).addScaledVector(side, 8.6 * s).setY(3.75);
        d.rotation.y = Math.atan2(tan.x, tan.z);
        d.updateMatrix();
        this.pillars.setMatrixAt(k++, d.matrix);
      }
    }
    this.pillars.castShadow = true;
    this.pillars.receiveShadow = true;
    scene.add(this.pillars);

    // glowing path along the spine (brightens for the Say-hi reveal)
    this.path = new THREE.Mesh(
      new THREE.TubeGeometry(spine, 500, 0.07, 6, false),
      new THREE.MeshBasicMaterial({
        color: '#af8471',
        transparent: true,
        opacity: 0.3,
        depthWrite: false,
      })
    );
    scene.add(this.path);

    // ── drifting dust, end to end ─────────────────────────
    const n = quality.dust;
    const pos = new Float32Array(n * 3);
    const seed = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const p = spine.getPointAt(Math.random());
      pos.set([p.x + (Math.random() - 0.5) * 18, 0.3 + Math.random() * 9, p.z + (Math.random() - 0.5) * 10], i * 3);
      seed[i] = Math.random();
    }
    const dg = new THREE.BufferGeometry();
    dg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    dg.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    this.dust = new THREE.Points(
      dg,
      new THREE.ShaderMaterial({
        vertexShader: dustVert,
        fragmentShader: dustFrag,
        transparent: true,
        depthWrite: false,
        uniforms: {
          uTime: globals.uTime,
          uSize: { value: 2.0 },
          uPixelRatio: globals.uPixelRatio,
          uDrift: { value: quality.reduced ? 0 : 1 },
          uColor: { value: new THREE.Color('#b98a6c') },
          uOpacity: { value: 0.35 },
        },
      })
    );
    this.dust.frustumCulled = false;
    scene.add(this.dust);

    // ── rooms ──────────────────────────────────────────────
    this.rooms = stations.map((def, i) => {
      const r = new roomClasses[i](def, ctx);
      scene.add(r.group, r.detached);
      return r;
    });
    this.help = this.rooms[stationIndex('help')] as HelpRoom;

    // ── full-screen veil (loader fade + reduced-motion crossfades) ──
    const vg = new THREE.BufferGeometry();
    vg.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    vg.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 2, 0, 0, 2]), 2));
    this.veil = new THREE.Mesh(
      vg,
      new THREE.ShaderMaterial({
        vertexShader: fsVert,
        fragmentShader: veilFrag,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
        uniforms: {
          uTransition: { value: 1 },
          uResolution: { value: new THREE.Vector2(1, 1) },
          uColor: { value: new THREE.Color('#fdf7ef') },
        },
      })
    );
    this.veil.frustumCulled = false;
    this.veil.renderOrder = 9999;
    scene.add(this.veil);
  }

  /** index of the station the camera is nearest to (by rail parameter) */
  currentStation() {
    const t = this.rig.state.t;
    const rail = this.rig.railT;
    let best = 0;
    let bd = Infinity;
    for (let i = 0; i < rail.length; i++) {
      const d = Math.min(Math.abs(t - rail[i].arrive), Math.abs(t - rail[i].leave));
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    return best;
  }

  /** every texture any room uses (uploaded to the GPU once, behind the loader) */
  allTextures() {
    const set = new Set<THREE.Texture>();
    for (const r of this.rooms) for (const t of r.textures) set.add(t);
    return [...set];
  }

  /** measure each room once so `cull()` can test it against the fog */
  initCulling() {
    this.scene.updateMatrixWorld(true);
    for (const r of this.rooms) r.computeBounds();
  }

  /** show everything (shader/texture pre-warm) */
  showAll() {
    for (const r of this.rooms) r.setCulled(false);
  }

  /**
   * Hide a room only when it cannot contribute a visible pixel: it is more
   * than two stations away AND the fog between it and the camera leaves it
   * under 0.1% visible (less than half an 8-bit step). Rooms one or two
   * stations ahead always stay, and the Say-hi pull-back (thin fog) keeps
   * the whole corridor, so no frame changes.
   */
  private cull(camera: THREE.Camera, cur: number) {
    const density = (this.scene.fog as THREE.FogExp2).density;
    for (let i = 0; i < this.rooms.length; i++) {
      const r = this.rooms[i];
      if (!r.hasBounds) continue;
      let hide = false;
      if (Math.abs(i - cur) > 2) {
        const d = Math.max(0, camera.position.distanceTo(r.bounds.center) - r.bounds.radius) * density;
        hide = d * d > 6.9; // exp(-6.9) ≈ 0.001 transmittance
      }
      r.setCulled(hide);
    }
  }

  update(f: FrameContext) {
    const rooms = this.rooms;
    for (let i = 0; i < rooms.length; i++) rooms[i].update(f);
    this.cull(f.camera, this.currentStation());
    this.path.material.opacity = 0.18 + this.lights.state.glow * 0.7;
    this.veil.material.uniforms.uResolution.value.set(f.width, f.height);
  }

  get veilUniform() {
    return this.veil.material.uniforms.uTransition;
  }

  dispose() {
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mats = m.material ? (Array.isArray(m.material) ? m.material : [m.material]) : [];
      for (const mat of mats) {
        for (const v of Object.values(mat)) if (v instanceof THREE.Texture) v.dispose();
        mat.dispose();
      }
      if ((o as THREE.InstancedMesh).isInstancedMesh) (o as THREE.InstancedMesh).dispose();
      if ((o as THREE.Light).isLight) (o as THREE.Light).dispose();
    });
  }
}
