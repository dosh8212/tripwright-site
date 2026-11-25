// The sea. Rolling Gerstner swell, fine ripples, sky reflections with Fresnel, sun glitter, light
// through the wave crests, and clear water: it reads what lies beneath (the seabed and island slopes,
// drawn first into a texture) and tints it by depth, so shallows glow turquoise over sand and deep
// water turns blue. Foam gathers where the water is thinnest along each shore.
import * as THREE from '../vendor/three.module.min.js';
import { NOISE } from './glsl.js';

// [direction x, direction z, wavelength, steepness]: long swell down to short chop
const WAVES = [[1, 0.35, 95, 0.09], [0.6, 1, 57, 0.08], [-0.4, 1, 33, 0.07], [1, -0.7, 19, 0.06], [-1, -0.3, 11, 0.05], [0.2, -1, 7, 0.04]];
const GLSL_WAVES = WAVES.map(([x, z, l, q]) => {
  const len = Math.hypot(x, z);
  return `w(p, vec2(${(x / len).toFixed(4)}, ${(z / len).toFixed(4)}), ${l.toFixed(1)}, ${q.toFixed(3)}, D, N, H);`;
}).join('\n        ');

const WAVE_FN = /* glsl */ `
uniform float time;
// Adds one Gerstner wave: horizontal displacement D, normal terms N, height H.
void w(vec2 p, vec2 dir, float L, float q, inout vec3 D, inout vec3 N, inout float H){
  float k = 6.28318 / L, c = sqrt(9.8 / k), a = q / k;
  float f = k * (dot(dir, p) - c * time * .9);
  float cf = cos(f), sf = sin(f);
  D += vec3(dir.x * a * cf, a * sf, dir.y * a * cf);
  N += vec3(dir.x * k * a * cf, q * sf, dir.y * k * a * cf);
  H += a * sf;
}
`;

/** A disc of rings, very fine near the centre and coarse at the horizon; it follows the camera. */
function radialGrid(radius, rings, segs) {
  const pos = [], idx = [];
  pos.push(0, 0, 0);
  for (let r = 1; r <= rings; r++) {
    const rr = radius * (Math.exp((r / rings) * 6) - 1) / (Math.exp(6) - 1);
    for (let s = 0; s < segs; s++) { const a = (s / segs) * Math.PI * 2; pos.push(Math.cos(a) * rr, 0, Math.sin(a) * rr); }
  }
  for (let s = 0; s < segs; s++) idx.push(0, 1 + ((s + 1) % segs), 1 + s);
  for (let r = 1; r < rings; r++) {
    const a0 = 1 + (r - 1) * segs, a1 = 1 + r * segs;
    for (let s = 0; s < segs; s++) {
      const s1 = (s + 1) % segs;
      idx.push(a0 + s, a0 + s1, a1 + s, a0 + s1, a1 + s1, a1 + s);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}

/** Creates the ocean. Call setScene(colorTex, depthTex, w, h) each frame before drawing it. */
export function makeOcean(mobile) {
  const uniforms = {
    time: { value: 0 }, night: { value: 0 },
    top: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, sunCol: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3(0, 1, 0) },
    fogCol: { value: new THREE.Color() }, fogNear: { value: 260 }, fogFar: { value: 1500 },
    tScene: { value: null }, tDepth: { value: null }, res: { value: new THREE.Vector2(1, 1) },
    camNear: { value: 1 }, camFar: { value: 6000 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms, side: THREE.DoubleSide,
    vertexShader: /* glsl */ `${WAVE_FN}
      varying vec3 vWorld; varying vec2 vBase; varying float vDist, vHeight;
      void main(){
        vec3 wp = (modelMatrix * vec4(position, 1.)).xyz;
        vec2 p = wp.xz;
        vec3 D = vec3(0.), N = vec3(0.); float H = 0.;
        ${GLSL_WAVES.split('\n').slice(0, 4).join('\n')}
        vBase = p;
        wp += D;
        vWorld = wp; vHeight = H;
        vec4 mv = viewMatrix * vec4(wp, 1.);
        vDist = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `${WAVE_FN}${NOISE}
      uniform float night, fogNear, fogFar, camNear, camFar;
      uniform vec3 top, hor, sunCol, sunDir, fogCol;
      uniform sampler2D tScene, tDepth; uniform vec2 res;
      varying vec3 vWorld; varying vec2 vBase; varying float vDist, vHeight;

      vec3 skyAt(vec3 d){
        vec3 c = mix(hor, top, pow(max(d.y, 0.), .45));
        float s = max(dot(d, sunDir), 0.);
        return c + sunCol * pow(s, 24.) * .35 * (1. - night * .6);
      }
      float lin(float d){ float z = d * 2. - 1.; return 2. * camNear * camFar / (camFar + camNear - z * (camFar - camNear)); }

      void main(){
        // Swell normal, computed per pixel so short waves stay crisp
        vec3 D = vec3(0.), N = vec3(0.); float H = 0.;
        vec2 p = vBase;
        ${GLSL_WAVES}
        vec3 n = normalize(vec3(-N.x, 1. - N.y, -N.z));
        // Fine ripples from two drifting layers of noise, fading with distance
        float fade = 1. - smoothstep(40., 420., vDist);
        vec2 q1 = vWorld.xz * .32 + time * vec2(.35, .22), q2 = vWorld.xz * .85 - time * vec2(.28, -.4);
        float e = .2, a0 = fbm3(q1), b0 = fbm3(q2);
        vec2 g = vec2(fbm3(q1 + vec2(e, 0.)) - a0, fbm3(q1 + vec2(0., e)) - a0) * 1.4 + vec2(fbm3(q2 + vec2(e, 0.)) - b0, fbm3(q2 + vec2(0., e)) - b0);
        n = normalize(n + vec3(-g.x, 0., -g.y) * .8 * fade);

        vec3 V = normalize(cameraPosition - vWorld);
        float ndv = max(dot(n, V), 0.);
        float F = .02 + .98 * pow(1. - ndv, 5.);
        vec3 R = reflect(-V, n); R.y = abs(R.y);
        vec3 refl = skyAt(R);

        // What lies beneath: refracted seabed, absorbed by depth
        vec2 uv = gl_FragCoord.xy / res;
        vec2 ruv = clamp(uv + n.xz * .035 * fade, .001, .999);
        float sd = lin(texture2D(tDepth, ruv).x);
        if (sd < vDist) { ruv = uv; sd = lin(texture2D(tDepth, uv).x); }
        float thick = max(sd - vDist, 0.);
        float depth = thick * clamp(V.y + .12, .12, 1.);
        vec3 below = texture2D(tScene, ruv).rgb * mix(1., .35, night);
        vec3 absorb = exp(-(depth * .5 + thick * .5) * vec3(.38, .085, .062));
        vec3 deepCol = vec3(.004, .045, .09) * (1. - night * .7);
        vec3 scatter = mix(vec3(.02, .24, .27), deepCol, 1. - exp(-depth * .11)) * (1. - night * .8);
        vec3 refr = below * absorb + scatter * (1. - absorb);
        vec3 col = mix(refr, refl, F);

        // Light shining through the crests
        float sss = pow(max(dot(V, -normalize(sunDir + vec3(0., .4, 0.))), 0.), 3.) * clamp(vHeight * .5 + .5, 0., 1.);
        col += vec3(.05, .32, .3) * sss * .55 * (1. - night) * step(0., sunDir.y);
        // Sun glitter
        vec3 Hv = normalize(sunDir + V); float nh = max(dot(n, Hv), 0.);
        col += sunCol * (pow(nh, 700.) * 3.5 + pow(nh, 90.) * .35) * step(-.02, sunDir.y) * (1. - night);
        // Foam: along shores where the water is thin, and on the tallest crests
        float fn = fbm3(vWorld.xz * .55 + time * vec2(.25, .1)) + fbm3(vWorld.xz * 1.6 - time * .2) * .5;
        float shore = 1. - smoothstep(0., 1.6, depth);
        float foam = smoothstep(.55, .95, fn * .75 + shore * .8) * shore;
        foam += smoothstep(.68, .85, fbm3(vWorld.xz * 2.2 + time * .4)) * smoothstep(1., 1.7, vHeight) * .45 * fade;
        col = mix(col, vec3(.92, .96, .97) * (.25 + .75 * (1. - night)) * (.6 + .4 * max(sunDir.y + .3, 0.)), clamp(foam, 0., 1.) * .9);

        col = mix(col, fogCol, smoothstep(fogNear, fogFar, vDist));
        gl_FragColor = vec4(col, 1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(radialGrid(3200, mobile ? 150 : 200, mobile ? 128 : 192), mat);
  mesh.frustumCulled = false;
  return { mesh, uniforms };
}
