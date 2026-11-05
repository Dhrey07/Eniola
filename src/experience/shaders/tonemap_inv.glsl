// Exact inverse of three.js ACESFilmicToneMapping. Lets a photo (or the page
// background) come out of the tone-mapper at its true colour.
const mat3 ACES_IN_INV = mat3(vec3(1.7647410, -0.1470279, -0.0363368), vec3(-0.6757777, 1.1602515, -0.1624364), vec3(-0.0889633, -0.0132237, 1.1987733));
const mat3 ACES_OUT_INV = mat3(vec3(0.6430382, 0.0592687, 0.0059619), vec3(0.3111868, 0.9314365, 0.0639290), vec3(0.0457755, 0.0092949, 0.9301184));
vec3 invRRTAndODTFit(vec3 y) {
  vec3 A = 1.0 - 0.983729 * y;
  vec3 B = 0.0245786 - 0.4329510 * y;
  vec3 C = -(0.000090537 + 0.238081 * y);
  return (-B + sqrt(max(B * B - 4.0 * A * C, 0.0))) / (2.0 * A);
}
vec3 inverseACES(vec3 c, float exposure) {
  vec3 y = clamp(ACES_OUT_INV * c, 0.0, 0.985);
  return ACES_IN_INV * invRRTAndODTFit(y) * (0.6 / exposure);
}
