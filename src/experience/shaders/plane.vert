// LayeredPlane vertex shader: scroll-velocity bend + vertical stretch + mouse parallax.
uniform float uVelocity;   // clamped Lenis velocity, -1..1
uniform float uBend;       // per-layer bend strength
uniform float uDepth;      // layer depth (0 = back), drives extra parallax
uniform float uParallax;   // parallax strength
uniform vec2 uMouse;       // -1..1
uniform float uReveal;
varying vec2 vUv;
#include <common>
#include <fog_pars_vertex>

void main() {
  vUv = uv;
  vec3 p = position;
  float v = clamp(uVelocity, -1.0, 1.0);
  // curl/bend while moving, plus a lift while revealing
  p.z += sin(uv.y * PI) * uBend * v;
  p.z += sin(uv.x * PI) * uBend * 0.5 * abs(v);
  p.z -= (1.0 - uReveal) * sin(uv.y * PI) * 0.25;
  p.y *= 1.0 + abs(v) * 0.035;
  p.xy += uMouse * uParallax * uDepth;
  vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
