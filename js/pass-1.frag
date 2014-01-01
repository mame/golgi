varying float power;
varying vec2 coord;

void main() {
  vec2 xy = coord * 2.0 - 1.0;
  float v = 1.0 - sqrt(dot(xy, xy));
  if (v < 0.0) v = 0.0;
  v *= v / 3.0 * power;
  gl_FragColor = vec4(vec3(v, v, v),1.0);
}
