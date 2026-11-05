uniform float uTime;
uniform float uSize;
uniform float uPixelRatio;
uniform float uDrift;
attribute float aSeed;
varying float vAlpha;
void main() {
  vec3 p = position;
  float t = uTime * uDrift;
  p.x += sin(t * 0.6 + aSeed * 6.283) * 0.35;
  p.y += mod(t * (0.08 + aSeed * 0.12) + aSeed * 10.0, 4.0) - 2.0;
  p.z += cos(t * 0.5 + aSeed * 4.0) * 0.35;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uSize * uPixelRatio * (0.5 + aSeed) * (10.0 / -mv.z);
  vAlpha = smoothstep(60.0, 4.0, -mv.z) * smoothstep(0.3, 2.0, -mv.z);
}
