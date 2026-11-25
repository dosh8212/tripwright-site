// Natural-looking island terrain and plants, all generated in code.
// terrain() turns a few "land blobs" and "peaks" into a smooth height field that runs from jungle
// down through beach to a sandy seabed, coloured by height and slope, with light caustics under water.
import * as THREE from '../vendor/three.module.min.js';
import { NOISE } from './glsl.js';

/** Shared uniforms so every seabed ripples in step and dims at night. */
export const seabed = { time: { value: 0 }, sun: { value: 1 } };

/** Seeded random numbers so each island is built the same way on every visit. */
export function rng(seed) { let s = seed; return () => ((s = (s * 16807) % 2147483647) / 2147483647); }

/* ---------- 2D value noise on the CPU, matching the look of the shader noise ---------- */
function hash(x, y, seed) { const s = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x, y, seed) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi, seed), b = hash(xi + 1, yi, seed), c = hash(xi, yi + 1, seed), d = hash(xi + 1, yi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
/** Fractal noise, roughly 0..1. */
export function fbm(x, y, seed, oct = 4) {
  let s = 0, a = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { s += a * vnoise(x * f, y * f, seed + i * 13); f *= 2.03; a *= 0.5; }
  return s / (1 - Math.pow(0.5, oct));
}
const sstep = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };

/**
 * Builds a height function. opts:
 *   blobs: [{x, z, r}] land areas (the coast is where the mask crosses 0, wobbled by noise)
 *   peaks: [{x, z, r, h}] hills and mountains
 *   ring:  {r, w} makes an atoll: a ring of land around a shallow lagoon
 *   seed, rough (how rugged the hills are)
 */
export function heightFn(opts) {
  const seed = opts.seed || 1, rough = opts.rough ?? 1;
  return (x, z) => {
    const warp = (fbm(x * 0.03, z * 0.03, seed, 3) - 0.5) * 0.55;
    let m = -1;
    (opts.blobs || []).forEach((b) => { m = Math.max(m, 1 - Math.hypot(x - b.x, z - b.z) / b.r); });
    if (opts.ring) { const d = Math.hypot(x, z); m = Math.max(m, 1 - Math.abs(d - opts.ring.r) / opts.ring.w); }
    m += warp;
    // seabed -> reef -> beach shelf
    let h = -8 + 9.4 * sstep(-0.35, 0.14, m) + 0.5 * sstep(0.12, 0.4, m);
    if (opts.ring && Math.hypot(x, z) < opts.ring.r) h = Math.max(h, -2.4 + fbm(x * 0.1, z * 0.1, seed + 5, 2) * 0.8);
    // hills, with ridges and gullies from noise
    const land = sstep(0.05, 0.45, m);
    (opts.peaks || []).forEach((p) => {
      const d = Math.min(1, Math.hypot(x - p.x, z - p.z) / p.r);
      h += p.h * 0.5 * (1 + Math.cos(Math.PI * d)) * land * (0.8 + 0.4 * fbm(x * 0.05, z * 0.05, seed + 9, 3));
    });
    h += (fbm(x * 0.09, z * 0.09, seed + 3, 4) - 0.5) * 3.2 * rough * land;
    h -= Math.abs(fbm(x * 0.045, z * 0.045, seed + 21, 3) - 0.5) * 3 * rough * land * sstep(2, 8, h);
    return h;
  };
}

/** Adds caustics to the seabed and a darker wet band near the waterline. */
function addSeabedShader(material) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = seabed.time; shader.uniforms.uSun = seabed.sun;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos; uniform float uTime, uSun;\n' + NOISE)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float under = smoothstep(0.2, -1.2, vWPos.y) * smoothstep(-14., -3., vWPos.y);
        totalEmissiveRadiance += vec3(.9, 1., .85) * caustic(vWPos.xz * .35, uTime) * under * .55 * uSun * diffuseColor.rgb;`);
  };
}

/** Builds the terrain mesh for a height function covering a square of half-size `extent`. */
export function terrain(h, extent, opts = {}) {
  const seg = opts.seg || 120, seed = opts.seed || 1;
  const geo = new THREE.PlaneGeometry(extent * 2, extent * 2, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    // Beyond the island the seabed falls away smoothly into deep water before the mesh ends
    const r = Math.hypot(x, z) / extent, hh = h(x, z);
    p.setY(i, Math.min(hh, hh * (1 - sstep(0.45, 0.8, r)) - 60 * sstep(0.5, 0.95, r)));
  }
  geo.computeVertexNormals();
  const n = geo.attributes.normal, col = new Float32Array(p.count * 3), c = new THREE.Color(), t = new THREE.Color();
  const pal = {
    seabed: new THREE.Color(0xd8c59a), wet: new THREE.Color(0xc4a878), sand: new THREE.Color(0xeedcb0),
    grass: new THREE.Color(0x6a9a3c), jungle: new THREE.Color(0x2f6a2a), dark: new THREE.Color(0x24502a),
    rock: new THREE.Color(0x857a6c), cliff: new THREE.Color(0x5e564d),
  };
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), slope = 1 - n.getY(i);
    const v1 = fbm(x * 0.12, z * 0.12, seed + 40, 3), v2 = fbm(x * 0.5, z * 0.5, seed + 41, 2);
    if (y < -0.2) c.copy(pal.seabed).lerp(pal.wet, sstep(-0.2, -1.5, y) * 0.3).multiplyScalar(0.85 + v2 * 0.25);
    else if (y < 0.5) c.copy(pal.wet).lerp(pal.sand, sstep(-0.2, 0.5, y));
    else if (opts.rocky && y > 0.9) c.copy(pal.rock).lerp(pal.cliff, v2 * 0.7 + slope).lerp(pal.jungle, sstep(0.55, 0.75, v1) * (1 - slope) * 0.6);
    else if (y < 1.9 + v1 * 1.2) c.copy(pal.sand).multiplyScalar(0.94 + v2 * 0.1);
    else {
      c.copy(pal.grass).lerp(pal.jungle, sstep(0.35, 0.7, v1) * 0.8 + sstep(4, 12, y) * 0.4).lerp(pal.dark, v2 * 0.25);
      const sandEdge = 1 - sstep(1.9, 3.2, y - v1 * 1.2);
      c.lerp(pal.sand, sandEdge * 0.7);
      const rocky = opts.rocky ? Math.max(sstep(0.05, 0.25, slope), 0.75) : sstep(0.38, 0.6, slope + (v1 - 0.5) * 0.2);
      t.copy(pal.rock).lerp(pal.cliff, v2 * 0.6 + sstep(0.6, 0.9, slope) * 0.4);
      c.lerp(t, rocky);
    }
    col.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 });
  addSeabedShader(mat);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true; mesh.castShadow = true;
  return mesh;
}

/** Finds spots on land for plants: height range and maximum slope, sampled by random tries. */
export function scatter(h, extent, count, rand, test) {
  const out = [];
  for (let i = 0; i < count * 12 && out.length < count; i++) {
    const x = (rand() * 2 - 1) * extent * 0.75, z = (rand() * 2 - 1) * extent * 0.75;
    const y = h(x, z), e = 0.6;
    const slope = Math.hypot(h(x + e, z) - h(x - e, z), h(x, z + e) - h(x, z - e)) / (2 * e);
    if (test(y, slope, x, z)) out.push([x, y, z, slope]);
  }
  return out;
}

/* ---------- Plants ---------- */

/** Paints one palm frond: a central rib with many thin leaflets, on a transparent background. */
function frondTexture() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 256;
  const x = c.getContext('2d');
  x.lineCap = 'round';
  for (let i = 0; i < 46; i++) {
    const v = 250 - i * 5.3, len = 54 * Math.sin(Math.PI * (0.1 + 0.9 * (i / 46))) + 6;
    const g = 70 + Math.floor(Math.random() * 50);
    x.strokeStyle = `rgb(${30 + g * 0.2},${g + 40},${30 + g * 0.15})`; x.lineWidth = 3.2;
    [-1, 1].forEach((s) => { x.beginPath(); x.moveTo(64, v); x.quadraticCurveTo(64 + s * len * 0.5, v - 6, 64 + s * len, v - 20 - len * 0.2); x.stroke(); });
  }
  x.strokeStyle = '#6c7a3a'; x.lineWidth = 4; x.beginPath(); x.moveTo(64, 256); x.lineTo(64, 6); x.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
let frondMat, trunkMat;
/** Materials shared by every palm on every island. */
function palmMaterials() {
  if (!frondMat) {
    frondMat = new THREE.MeshStandardMaterial({ map: frondTexture(), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.75 });
    trunkMat = new THREE.MeshStandardMaterial({ color: 0x8a6a4a, roughness: 0.95 });
  }
  return { frondMat, trunkMat };
}

/** Bakes a list of geometries (each with its own matrix) into one geometry, so a whole grove is one draw call. */
function merge(parts) {
  const geos = parts.map(([g, m]) => { const n = g.index ? g.toNonIndexed() : g.clone(); n.applyMatrix4(m); return n; });
  const total = geos.reduce((s, g) => s + g.attributes.position.count, 0);
  const out = new THREE.BufferGeometry();
  ['position', 'normal', 'uv'].forEach((name) => {
    const size = name === 'uv' ? 2 : 3, arr = new Float32Array(total * size);
    let o = 0;
    geos.forEach((g) => { arr.set(g.attributes[name].array, o); o += g.attributes[name].array.length; });
    out.setAttribute(name, new THREE.BufferAttribute(arr, size));
  });
  return out;
}

/** One frond: a strip that arches out and droops, folded slightly along its rib. */
function frondGeometry(len, width, droop) {
  const g = new THREE.PlaneGeometry(1, 1, 2, 10), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const a = p.getX(i), t = p.getY(i) + 0.5;
    const w = width * Math.sin(Math.PI * (0.12 + 0.88 * t)) * (1 - t * 0.45);
    const f = t * len;
    p.setXYZ(i, a * w, f * 0.45 - f * f * droop - Math.abs(a) * w * 0.35, f);
  }
  g.computeVertexNormals();
  return g;
}

/** A grove of palms at the given spots, as two meshes (trunks and fronds). */
export function palmGrove(spots, rand) {
  const { frondMat: fm, trunkMat: tm } = palmMaterials();
  const trunks = [], fronds = [];
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(1, 1, 1);
  spots.forEach(([x, y, z]) => {
    const h = 6 + rand() * 4, lean = 0.6 + rand() * 1.6, dir = rand() * Math.PI * 2;
    const lx = Math.cos(dir) * lean, lz = Math.sin(dir) * lean;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -0.5, 0), new THREE.Vector3(lx * 0.15, h * 0.35, lz * 0.15),
      new THREE.Vector3(lx * 0.55, h * 0.7, lz * 0.55), new THREE.Vector3(lx, h, lz),
    ]);
    const tube = new THREE.TubeGeometry(curve, 10, 0.24, 7, false), tp = tube.attributes.position;
    for (let i = 0; i < tp.count; i++) { // taper toward the top, with ring bumps
      const t = Math.floor(i / 8) / 10, c = curve.getPoint(t), k = (1 - 0.45 * t) * (1 + 0.06 * Math.sin(t * 70));
      tp.setXYZ(i, c.x + (tp.getX(i) - c.x) * k, c.y + (tp.getY(i) - c.y) * k, c.z + (tp.getZ(i) - c.z) * k);
    }
    tube.computeVertexNormals();
    trunks.push([tube, new THREE.Matrix4().makeTranslation(x, y, z)]);
    const nF = 8 + Math.floor(rand() * 4);
    for (let i = 0; i < nF; i++) {
      const g = frondGeometry(3.6 + rand() * 1.6, 1.5 + rand() * 0.5, 0.11 + rand() * 0.06);
      e.set(-0.15 + rand() * 0.5, (i / nF) * Math.PI * 2 + rand() * 0.4, 0, 'YXZ');
      q.setFromEuler(e); m.compose(new THREE.Vector3(x + lx, y + h - 0.2, z + lz), q, s);
      fronds.push([g, m.clone()]);
    }
  });
  const group = new THREE.Group();
  if (!spots.length) return group;
  const tMesh = new THREE.Mesh(merge(trunks), tm), fMesh = new THREE.Mesh(merge(fronds), fm);
  [tMesh, fMesh].forEach((o) => { o.castShadow = true; o.receiveShadow = true; group.add(o); });
  fMesh.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: fm.map, alphaTest: 0.45 });
  group.userData.fronds = fMesh;
  return group;
}

/** Dense round shrubs and trees for the jungle canopy, as one instanced mesh. */
export function bushes(spots, rand, tint) {
  const geo = new THREE.IcosahedronGeometry(1, 1), p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const k = 0.85 + hash(p.getX(i) * 3, p.getZ(i) * 3, p.getY(i)) * 0.3; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.8, p.getZ(i) * k); }
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true });
  const mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, spots.length));
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color(), base = new THREE.Color(tint || 0x3d7a33);
  spots.forEach(([x, y, z], i) => {
    const s = 0.7 + rand() * 1.3;
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand() * 6.28);
    m.compose(new THREE.Vector3(x, y + s * 0.45, z), q, new THREE.Vector3(s, s * (0.8 + rand() * 0.6), s));
    mesh.setMatrixAt(i, m);
    c.copy(base).offsetHSL((rand() - 0.5) * 0.06, (rand() - 0.5) * 0.15, (rand() - 0.5) * 0.12);
    mesh.setColorAt(i, c);
  });
  mesh.count = spots.length;
  mesh.castShadow = true; mesh.receiveShadow = true;
  return mesh;
}

/** Weathered boulders, instanced. */
export function boulders(spots, rand) {
  const geo = new THREE.DodecahedronGeometry(1, 1), p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const k = 0.8 + hash(p.getX(i) * 5, p.getY(i) * 5, p.getZ(i)) * 0.4; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.7, p.getZ(i) * k); }
  geo.computeVertexNormals();
  const mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: 0x7d746a, roughness: 0.95 }), Math.max(1, spots.length));
  const m = new THREE.Matrix4(), q = new THREE.Quaternion();
  spots.forEach(([x, y, z], i) => {
    const s = 0.6 + rand() * 1.6;
    q.setFromEuler(new THREE.Euler(rand(), rand() * 6, rand()));
    m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(s, s, s)); mesh.setMatrixAt(i, m);
  });
  mesh.count = spots.length; mesh.castShadow = true; mesh.receiveShadow = true;
  return mesh;
}
