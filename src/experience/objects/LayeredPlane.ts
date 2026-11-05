import * as THREE from 'three';
import vert from '../shaders/plane.vert';
import frag from '../shaders/plane.frag';
import type { ImageLayer } from '../../content';
import { globals, quality, standins } from '../globals';
import type { Assets } from '../Assets';

const geoCache = new Map<string, THREE.PlaneGeometry>();
function sharedPlane(w: number, h: number) {
  const k = `${w.toFixed(3)}x${h.toFixed(3)}`;
  let g = geoCache.get(k);
  if (!g) {
    g = new THREE.PlaneGeometry(w, h, 20, 20);
    geoCache.set(k, g);
  }
  return g;
}
export function disposePlaneGeometries() {
  geoCache.forEach((g) => g.dispose());
  geoCache.clear();
}

export interface LayeredPlaneOptions {
  width: number;
  height: number;
  castShadow?: boolean;
  bend?: number;
  parallax?: number;
}

/**
 * A "photo" built from 3–5 planes separated in Z (background plate,
 * alpha-cut subject, frame/foreground, light leak). The moving
 * perspective camera produces the parallax; the vertex shader adds a
 * mouse-keyed offset per layer and a velocity bend.
 */
export class LayeredPlane extends THREE.Group {
  materials: THREE.ShaderMaterial[] = [];
  textures: THREE.Texture[] = [];
  reveal = { value: 0 };
  opacity = { value: 1 };

  constructor(assets: Assets, layers: ImageLayer[], opts: LayeredPlaneOptions) {
    super();
    const use = layers.slice(0, quality.maxLayers);
    const seed = Math.random() * 10;
    use.forEach((raw, i) => {
      // while a site photo is still a stand-in, cropped frames show their own quote card
      const layer: ImageLayer =
        raw.standin && standins.has(raw.src) ? { ...raw, src: raw.standin, crop: undefined } : raw;
      const tex = assets.load(layer.src);
      this.textures.push(tex);
      const s = layer.scale ?? 1;
      const mat = new THREE.ShaderMaterial({
        vertexShader: vert,
        fragmentShader: frag,
        transparent: true,
        depthWrite: i === 0,
        fog: true,
        side: THREE.FrontSide,
        uniforms: THREE.UniformsUtils.merge([
          THREE.UniformsLib.fog,
          {
            uMap: { value: null },
            uBend: { value: (opts.bend ?? 0.35) * (1 + i * 0.25) },
            uDepth: { value: layer.z },
            uParallax: { value: quality.touch ? 0 : opts.parallax ?? 0.12 },
            uSeed: { value: seed + i },
            uOpacity: { value: layer.opacity ?? 1 },
            uCrop: { value: new THREE.Vector4(...(layer.crop ?? [0, 0, 1, 1])) },
          },
        ]),
      });
      // shared-by-reference uniforms (merge() clones, so assign after)
      Object.assign(mat.uniforms, {
        uMap: { value: tex },
        uReveal: this.reveal,
        uTime: globals.uTime,
        uVelocity: globals.uVelocity,
        uSaturation: globals.uSaturation,
        uTint: globals.uTint,
        uMouse: globals.uMouse,
        uRgbShift: globals.uRgbShift,
        uInvTone: globals.uInvTone,
        uExposure: globals.uExposure,
        uFogDisplay: globals.uFogDisplay,
      });
      const baseOpacity = layer.opacity ?? 1;
      mat.uniforms.uOpacity = { value: baseOpacity };
      (mat.userData as { baseOpacity: number }).baseOpacity = baseOpacity;

      const h = opts.height * s;
      const w = layer.aspect ? h * layer.aspect : opts.width * s;
      const mesh = new THREE.Mesh(sharedPlane(w, h), mat);
      mesh.position.z = layer.z;
      mesh.renderOrder = i;
      if (opts.castShadow !== false && baseOpacity >= 1) {
        mesh.castShadow = true;
        mesh.customDepthMaterial = new THREE.MeshDepthMaterial({
          depthPacking: THREE.RGBADepthPacking,
          map: tex,
          alphaTest: 0.5,
        });
      }
      this.add(mesh);
      this.materials.push(mat);
    });
  }

  setOpacity(v: number) {
    for (const m of this.materials) m.uniforms.uOpacity.value = (m.userData as { baseOpacity: number }).baseOpacity * v;
  }
}
