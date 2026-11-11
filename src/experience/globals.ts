import * as THREE from 'three';

/** Detected once at boot. */
const mq = (q: string) => typeof matchMedia !== 'undefined' && matchMedia(q).matches;

export type Tier = 'high' | 'mid' | 'low';

/**
 * GPU tier from the unmasked renderer string (no extra dependency). It only
 * picks internal quality (DPR cap, shadow size, MSAA, layer count); content
 * and choreography are the same on every tier. `?tier=high|mid|low` overrides
 * it for QA, and the adaptive DPR in Experience corrects a wrong guess at runtime.
 */
function detectTier(mobile: boolean): { tier: Tier; gpu: string } {
  let gpu = '';
  try {
    const c = document.createElement('canvas');
    const gl = (c.getContext('webgl2') || c.getContext('webgl')) as WebGLRenderingContext | null;
    if (gl) {
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      gpu = String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER) || '');
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
  } catch {
    /* fall through to the mid preset */
  }
  const forced = new URLSearchParams(location.search).get('tier');
  if (forced === 'high' || forced === 'mid' || forced === 'low') return { tier: forced, gpu };

  const g = gpu.toLowerCase();
  const cores = navigator.hardwareConcurrency || 4;
  let tier: Tier = 'mid';
  if (/swiftshader|llvmpipe|software|basic render/.test(g)) tier = 'low';
  else if (/apple m\d|apple gpu|rtx|gtx 1[06-9]|gtx 9[78]|radeon rx|radeon pro|arc\b|quadro|geforce [234]\d{3}/.test(g)) tier = 'high';
  else if (/intel.*(hd|uhd) graphics [2-6]\d{2,3}\b|mali-[t4]|adreno \(?tm\)? ?[2-5]\d\d|powervr/.test(g)) tier = 'low';
  else if (/iris|uhd|adreno|mali|radeon|geforce/.test(g)) tier = 'mid';
  // phones never get the high preset; very small CPUs drop one step
  if (mobile && tier === 'high') tier = 'mid';
  if (cores <= 2 && tier !== 'low') tier = tier === 'high' ? 'mid' : 'low';
  return { tier, gpu };
}

export const quality = (() => {
  const touch = mq('(pointer: coarse)');
  const mobile = mq('(max-width: 767px)');
  const reduced = mq('(prefers-reduced-motion: reduce)');
  const { tier, gpu } = detectTier(mobile);
  // DPR ceiling: desktop 1.5, mobile 1.25; lower tiers step down from there
  const dprCap = Math.min(
    window.devicePixelRatio || 1,
    mobile ? (tier === 'low' ? 1 : 1.25) : tier === 'high' ? 1.5 : tier === 'mid' ? 1.25 : 1
  );
  return {
    touch,
    mobile,
    reduced,
    tier,
    gpu,
    /** ceiling for the adaptive pixel ratio */
    dprCap,
    /** current pixel ratio (Experience steps it between 1 and dprCap) */
    dpr: dprCap,
    post: !mobile,
    /** MSAA samples on the post-processing target */
    msaa: tier === 'low' ? 2 : 4,
    maxLayers: mobile || tier === 'low' ? 3 : 5,
    dust: mobile ? 900 : 2400,
    shadowMapSize: !mobile && tier === 'high' ? 2048 : 1024,
    scrollScale: mobile ? 0.7 : 1,
  };
})();

/** image paths that are still quote-card stand-ins (from images/eniola/placeholders.txt) */
export const standins = new Set<string>();

/** Uniforms shared by reference across every image-plane material. */
export const globals = {
  uTime: { value: 0 },
  uVelocity: { value: 0 },
  uSaturation: { value: 1 },
  uTint: { value: new THREE.Color(1, 1, 1) },
  uMouse: { value: new THREE.Vector2() },
  uRgbShift: { value: quality.reduced ? 0 : 1 },
  uInvTone: { value: 1 },
  uExposure: { value: 1 },
  uFogDisplay: { value: new THREE.Color(1, 1, 1) },
  /** shared by every Points material so sprites keep their CSS-pixel size when the DPR adapts */
  uPixelRatio: { value: quality.dpr },
};
