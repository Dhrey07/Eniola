// Specular sheen sweep across a card face.
uniform float uSheen;   // 0..1 sweep position
uniform float uStrength;
varying vec2 vUv;
void main() {
  float x = vUv.x + vUv.y * 0.6;
  float band = smoothstep(0.18, 0.0, abs(x - (uSheen * 2.2 - 0.3)));
  float a = band * uStrength;
  gl_FragColor = vec4(vec3(1.0, 0.92, 0.78) * a, a);
  #include <colorspace_fragment>
}
