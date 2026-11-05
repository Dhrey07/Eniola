// Post pass: film grain + vignette (desktop only).
#import ./noise.glsl
uniform sampler2D tDiffuse;
uniform float uTime;
uniform float uGrain;
uniform float uVignette;
varying vec2 vUv;
void main() {
  vec4 c = texture2D(tDiffuse, vUv);
  float g = hash12(vUv * 1000.0 + fract(uTime * 7.13) * 100.0) - 0.5;
  c.rgb += g * uGrain;
  float d = distance(vUv, vec2(0.5));
  c.rgb *= mix(1.0, smoothstep(0.85, 0.25, d), uVignette);
  gl_FragColor = c;
}
