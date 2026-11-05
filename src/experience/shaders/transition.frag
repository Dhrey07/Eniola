// Full-screen veil. uTransition 1 = black, 0 = clear. Noise-edged dissolve.
#import ./noise.glsl
uniform float uTransition;
uniform vec2 uResolution;
uniform vec3 uColor;
varying vec2 vUv;
void main() {
  vec2 p = vUv * vec2(uResolution.x / uResolution.y, 1.0);
  float n = fbm(p * 3.0);
  float t = uTransition * 1.3 - 0.15;
  float a = smoothstep(n - 0.15, n + 0.15, t);
  if (a < 0.002) discard;
  gl_FragColor = vec4(uColor, a);
  #include <colorspace_fragment>
}
