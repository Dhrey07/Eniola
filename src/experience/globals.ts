import * as THREE from 'three';

/** Detected once at boot. */
const mq = (q: string) => typeof matchMedia !== 'undefined' && matchMedia(q).matches;

export const quality = (() => {
  const touch = mq('(pointer: coarse)');
  const mobile = mq('(max-width: 767px)');
  const reduced = mq('(prefers-reduced-motion: reduce)');
  return {
    touch,
    mobile,
    reduced,
    dpr: Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2),
    post: !mobile,
    maxLayers: mobile ? 3 : 5,
    dust: mobile ? 900 : 2400,
    shadowMapSize: mobile ? 1024 : 2048,
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
};
