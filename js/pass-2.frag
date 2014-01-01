varying vec2 coord;
uniform sampler2D tDiffuse;

vec3 c0 = vec3(0.0, 0.0, 0.0);
vec3 c1 = vec3(1.0, 1.0, 1.2);
vec3 c2 = vec3(0.0, 0.0, 0.2);
vec3 c3 = vec3(1.0, 0.5, 0.5);
vec3 c4 = vec3(0.6, 0.0, 0.0);

vec4 f(float lev, float x0, vec3 c0, float x1, vec3 c1) {
  lev = (lev - x0) / (x1 - x0);
  lev *= lev * lev * lev;
  return vec4(c1 * lev + c0 * (1.0 - lev), 1.0);
}

void main() {
  float lev = texture2D(tDiffuse, coord).x;
  /* XXX: should be configurable */
       if (lev < 0.01) gl_FragColor = f(lev, 0.01, c0, 0.00, c0);
  else if (lev < 0.10) gl_FragColor = f(lev, 0.01, c0, 0.10, c1);
  else if (lev < 0.30) gl_FragColor = f(lev, 0.30, c2, 0.10, c1);
  else if (lev < 0.40) gl_FragColor = f(lev, 0.30, c2, 0.40, c3);
  else if (lev < 1.00) gl_FragColor = f(lev, 1.00, c4, 0.40, c3);
  else                 gl_FragColor = f(lev, 1.00, c4, 9.99, c4);
  return;

       if (lev < 0.1) discard;
  else if (lev < 0.4) {
    float v = 0.5 - lev;
    v = v * v * v * 20.0;
    gl_FragColor = vec4(vec3(v, v, v + 0.2), 1.0);
  }
  else {
    float v = 1.0 - lev;
    v = v * v * v * v * 2.0;
    gl_FragColor = vec4(vec3(v + 0.8, v + 0.2, v + 0.2), 1.0);
  }
}
