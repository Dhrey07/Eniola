// Faux volumetric light cone: additive, soft edges via view-angle falloff, drifting noise.
#import ./noise.glsl
uniform float uTime;
uniform float uIntensity;
uniform vec3 uColor;
varying vec2 vUv;
varying vec3 vNormalV;
varying vec3 vViewDir;
void main() {
  float facing = abs(dot(normalize(vNormalV), normalize(vViewDir)));
  float edge = pow(facing, 2.2);
  float n = fbm(vec2(vUv.x * 8.0, vUv.y * 2.0 - uTime * 0.08));
  float vertical = smoothstep(0.0, 0.25, vUv.y) * smoothstep(1.0, 0.55, vUv.y);
  float a = edge * vertical * (0.55 + 0.45 * n) * uIntensity;
  gl_FragColor = vec4(uColor, a);
  #include <colorspace_fragment>
}
