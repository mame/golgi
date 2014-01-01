uniform float time, scale, size;
uniform vec2 origin;
attribute vec3 src, dst;
varying float power;
varying vec2 coord;

void main() {
  float t = time;
  coord = uv;
  vec3 p = position;
  t = t * t * (3.0 - 2.0 * t);
  p *= size;
  p.xy -= origin;
  p.x += mix(src.x, dst.x, t);
  p.y += mix(src.y, dst.y, t);
  power = mix(src.z, dst.z, t);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0 / scale);
}
