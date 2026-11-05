import * as THREE from 'three';

/**
 * Loads every texture up front through one LoadingManager (drives the
 * preloader counter). GPU upload is deferred: World calls `upload()` for
 * rooms within two stations of the camera (renderer.initTexture).
 */
export class Assets {
  manager = new THREE.LoadingManager();
  private loader = new THREE.TextureLoader(this.manager);
  private cache = new Map<string, THREE.Texture>();
  private uploaded = new Set<THREE.Texture>();
  maxAnisotropy = 1;
  progress = 0;
  onProgress?: (p: number) => void;
  ready: Promise<void>;

  constructor() {
    let res!: () => void;
    this.ready = new Promise<void>((r) => (res = r));
    this.manager.onProgress = (_u, loaded, total) => {
      this.progress = loaded / total;
      this.onProgress?.(this.progress);
    };
    this.manager.onLoad = () => {
      this.progress = 1;
      this.onProgress?.(1);
      res();
    };
    this.manager.onError = (u) => console.warn('[assets] failed to load', u);
  }

  load(src: string, opts: { repeat?: boolean } = {}) {
    const key = src + (opts.repeat ? '#r' : '');
    let tex = this.cache.get(key);
    if (tex) return tex;
    tex = this.loader.load(src, (t) => this.fit(t));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = this.maxAnisotropy;
    if (opts.repeat) tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    this.cache.set(key, tex);
    return tex;
  }

  /** cap texture size (photos from the web are 1400px+; GPU budget is 40 MB) */
  maxSize = 1024;
  private fit(t: THREE.Texture) {
    const img = t.image as HTMLImageElement | undefined;
    if (!img || !img.width) return;
    const big = Math.max(img.width, img.height);
    if (big <= this.maxSize) return;
    const k = this.maxSize / big;
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * k);
    c.height = Math.round(img.height * k);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    t.image = c;
    t.needsUpdate = true;
  }

  upload(renderer: THREE.WebGLRenderer, textures: Iterable<THREE.Texture>) {
    for (const t of textures) {
      if (this.uploaded.has(t) || !t.image) continue;
      renderer.initTexture(t);
      this.uploaded.add(t);
    }
  }

  /** total GPU bytes estimate (RGBA8 + mips) for the perf readout */
  estimateBytes() {
    let b = 0;
    for (const t of this.cache.values()) {
      const img = t.image as { width?: number; height?: number } | undefined;
      if (img?.width && img.height) b += img.width * img.height * 4 * 1.33;
    }
    return b;
  }

  dispose() {
    for (const t of this.cache.values()) t.dispose();
    this.cache.clear();
    this.uploaded.clear();
  }
}

/** Soft radial shadow texture for cheap baked contact shadows. */
let contactTex: THREE.CanvasTexture | null = null;
export function contactShadow(w: number, d: number, opacity = 0.6) {
  if (!contactTex) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d')!;
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, 'rgba(0,0,0,1)');
    grd.addColorStop(0.5, 'rgba(0,0,0,0.45)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
    contactTex = new THREE.CanvasTexture(c);
  }
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d),
    new THREE.MeshBasicMaterial({ map: contactTex, transparent: true, opacity, depthWrite: false, toneMapped: false })
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.012;
  m.renderOrder = 1;
  return m;
}
export function disposeContactShadowTexture() {
  contactTex?.dispose();
  contactTex = null;
}
