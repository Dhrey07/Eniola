// LayeredPlane fragment shader: RGB shift, noise-edged reveal wipe, grade, fog.
#import ./noise.glsl
#import ./tonemap_inv.glsl
uniform sampler2D uMap;
uniform float uReveal;      // 0..1 wipe
uniform float uOpacity;
uniform float uVelocity;
uniform float uSaturation;  // global grade (Style station → ~0.1)
uniform float uSeed;
uniform float uTime;
uniform vec3 uTint;         // driven by the light rig colour
uniform float uRgbShift;    // 0 disables (reduced motion)
uniform vec4 uCrop;         // sub-rect of the image (u, v, w, h)
uniform float uInvTone;     // 1 = pre-compensate ACES so photos keep their true colours
uniform float uExposure;
uniform vec3 uFogDisplay;   // fog colour as it should appear on screen
varying vec2 vUv;
#include <common>
#include <fog_pars_fragment>

void main() {
  vec2 uv = uCrop.xy + vUv * uCrop.zw;
  float shift = clamp(uVelocity, -1.0, 1.0) * 0.012 * uRgbShift;
  vec4 c = texture2D(uMap, uv);
  float r = texture2D(uMap, uv + vec2(0.0, shift)).r;
  float b = texture2D(uMap, uv - vec2(0.0, shift)).b;
  vec3 col = vec3(r, c.g, b);

  // noise-edged reveal wipe (bottom → top)
  float n = fbm(vUv * 5.0 + uSeed * 13.7);
  float edge = vUv.y * 0.8 + n * 0.3;
  float m = smoothstep(edge - 0.06, edge, uReveal * 1.15);

  float g = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(g), col, uSaturation);
  col *= uTint;
  // warm glow on the wipe edge
  float rim = smoothstep(edge - 0.06, edge, uReveal * 1.15) - smoothstep(edge, edge + 0.04, uReveal * 1.15);
  col += vec3(0.83, 0.66, 0.29) * rim * 0.9;

  // fog in display space (before the inverse tone map), so photos keep their contrast
  #ifdef USE_FOG
    float fogF = 1.0 - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
    col = mix(col, uFogDisplay, fogF);
  #endif
  if (uInvTone > 0.5) col = inverseACES(col, uExposure);
  float alpha = c.a * m * uOpacity;
  if (alpha < 0.004) discard;
  gl_FragColor = vec4(col, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
