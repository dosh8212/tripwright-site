// Shared GLSL snippets: value noise, fractal noise and a ridged pattern used for seabed caustics.
export const NOISE = /* glsl */ `
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3. - 2. * f);
  return mix(mix(hash12(i), hash12(i + vec2(1., 0.)), u.x), mix(hash12(i + vec2(0., 1.)), hash12(i + vec2(1., 1.)), u.x), u.y);
}
float fbm3(vec2 p){ float a = .5, s = 0.; for (int i = 0; i < 3; i++){ s += a * vnoise(p); p = p * 2.03 + 17.1; a *= .5; } return s; }
// Bright thin lines like sunlight focused through ripples
float caustic(vec2 p, float t){
  float a = 1. - abs(vnoise(p * .55 + vec2(t * .35, t * .2)) * 2. - 1.);
  float b = 1. - abs(vnoise(p * .8 - vec2(t * .25, -t * .3) + 7.3) * 2. - 1.);
  return pow(a, 7.) + pow(b, 7.);
}
`;
