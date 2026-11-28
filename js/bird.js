// A herring gull built in code. The body and head are sculpted from cross-sections (deep chest,
// slim neck, round head) and painted with feathers: white below, a grey mantle on the back. The
// long wings bend at the wrist as they beat, with grey upper coverts, white trailing edges, black
// primaries that separate into "fingers" with white mirrors, and a paler underside. The face has a
// pale yellow eye with a red orbital ring and a hooked yellow bill with the red gonys spot.
// Faces +z so Object3D.lookAt() points it along the flight path.
import * as THREE from '../vendor/three.module.min.js';

const SPAN = 5.2;          // one wing, shoulder to tip
const COLS = 32, ROWS = 8; // wing mesh resolution (span x chord)
const W = 1024, H = 512;   // wing texture size

/* ---------- Feather painting ---------- */

let seed = 3;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

/** Paints one feather: a rounded vane along a shaft from (x0,y0) to (x1,y1), with a soft edge and shaft line. */
function feather(x, x0, y0, x1, y1, width, fill, edge, shaft) {
  const ang = Math.atan2(y1 - y0, x1 - x0), len = Math.hypot(x1 - x0, y1 - y0);
  x.save(); x.translate(x0, y0); x.rotate(ang);
  x.beginPath();
  x.moveTo(0, -width * 0.35);
  x.bezierCurveTo(len * 0.3, -width * 0.55, len * 0.85, -width * 0.5, len, 0);
  x.bezierCurveTo(len * 0.85, width * 0.5, len * 0.3, width * 0.55, 0, width * 0.35);
  x.closePath();
  x.fillStyle = fill; x.fill();
  if (edge) { x.strokeStyle = edge; x.lineWidth = 1.2; x.stroke(); }
  if (shaft) { x.strokeStyle = shaft; x.lineWidth = 0.9; x.beginPath(); x.moveTo(0, 0); x.lineTo(len * 0.92, 0); x.stroke(); }
  x.restore();
}

/** Cuts the gaps between the outer primaries and rounds the wingtip (the same cut for both sides). */
function cutWingShape(x) {
  x.save();
  x.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 6; i++) { // slots between the "fingers"
    const u = 742 + i * 46, depth = 150 + i * 30;
    x.beginPath(); x.moveTo(u + 8, H + 2); x.quadraticCurveTo(u + 22, H - depth * 0.5, u + 30, H - depth); x.lineTo(u + 40, H + 2); x.fill();
  }
  x.beginPath(); x.moveTo(W + 2, -2); x.lineTo(W + 2, H + 2); x.lineTo(958, H + 2); x.quadraticCurveTo(1012, 230, W + 2, -2); x.fill();
  // fine serration along the trailing edge of the secondaries
  for (let u = 8; u < 720; u += 22) { x.beginPath(); x.moveTo(u, H + 2); x.lineTo(u + 11, H - 7); x.lineTo(u + 22, H + 2); x.fill(); }
  x.restore();
}

/** The upper wing: grey coverts in overlapping rows, white-tipped secondaries, black primaries. */
function upperWing() {
  seed = 11;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  // u (left to right) = shoulder to tip; v (top to bottom) = leading edge to trailing edge
  const base = x.createLinearGradient(0, 0, 0, H);
  base.addColorStop(0, '#b9c3cc'); base.addColorStop(0.4, '#a5b0bb'); base.addColorStop(1, '#9ca8b4');
  x.fillStyle = base; x.fillRect(0, 0, W, H);
  // secondaries: long feathers pointing back, with broad white tips
  for (let u = 6; u < 735; u += 21) feather(x, u + 10, 250, u + 14, H + 30, 30, '#9eaab6', 'rgba(70,82,96,.28)', 'rgba(70,82,96,.25)');
  const tips = x.createLinearGradient(0, H - 92, 0, H);
  tips.addColorStop(0, 'rgba(255,255,255,0)'); tips.addColorStop(0.45, 'rgba(250,251,252,.92)'); tips.addColorStop(1, '#fbfcfd');
  x.fillStyle = tips; x.fillRect(0, H - 92, 735, 92);
  // greater, median and lesser coverts: rows of overlapping rounded feathers, smaller toward the leading edge
  [[250, 44, 34], [175, 34, 27], [112, 26, 21], [62, 18, 15], [26, 12, 10]].forEach(([v, len, step], row) => {
    for (let u = 4 + (row % 2) * step * 0.5; u < 760 - row * 10; u += step) {
      const g = 164 + Math.round(rnd() * 10) + row * 4;
      feather(x, u, v - len * 0.7, u + 4, v + len * 0.35, step * 1.25, `rgb(${g - 8},${g},${g + 9})`, 'rgba(70,82,96,.2)', null);
    }
  });
  // leading edge: a soft pale band
  const lead = x.createLinearGradient(0, 0, 0, 40);
  lead.addColorStop(0, 'rgba(240,244,247,.85)'); lead.addColorStop(1, 'rgba(240,244,247,0)');
  x.fillStyle = lead; x.fillRect(0, 0, W, 40);
  // primaries: black outer feathers fanning to the tip, with white "mirrors" and small white tips
  const prim = x.createLinearGradient(700, 0, 860, 0);
  prim.addColorStop(0, 'rgba(26,28,33,0)'); prim.addColorStop(1, 'rgba(26,28,33,1)');
  for (let i = 0; i < 10; i++) {
    const u0 = 640 + i * 30, tipX = 760 + i * 28, tipY = H - 10 - i * 34;
    const grey = i < 3 ? '#9ea9b4' : '#1d2025';
    feather(x, u0, 70 + i * 8, tipX, tipY, 46, grey, 'rgba(0,0,0,.45)', 'rgba(255,255,255,.12)');
    if (i >= 3) { x.fillStyle = 'rgba(250,250,250,.95)'; x.beginPath(); x.ellipse(tipX - 6, tipY - 4, 7, 5, 0, 0, Math.PI * 2); x.fill(); }
  }
  x.fillStyle = prim; x.fillRect(700, 0, W - 700, 60); // dark leading edge out at the hand
  const hand = x.createLinearGradient(770, 0, 860, 0); // the outer wing is black above
  hand.addColorStop(0, 'rgba(24,26,30,0)'); hand.addColorStop(1, 'rgba(24,26,30,.92)');
  x.fillStyle = hand; x.fillRect(770, 0, W - 770, H);
  x.fillStyle = 'rgba(248,249,250,.95)';
  [[972, 70, 13, 22], [930, 150, 10, 17]].forEach(([u, v, rx, ry]) => { x.beginPath(); x.ellipse(u, v, rx, ry, -0.4, 0, Math.PI * 2); x.fill(); });
  cutWingShape(x);
  return finishTexture(c);
}

/** The underwing: white, with translucent grey flight feathers and black tips. */
function underWing() {
  seed = 11;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  x.fillStyle = '#eef1f3'; x.fillRect(0, 0, W, H);
  for (let u = 6; u < 735; u += 21) feather(x, u + 10, 260, u + 14, H + 30, 30, 'rgba(196,205,213,.9)', 'rgba(120,130,142,.2)', 'rgba(255,255,255,.5)');
  const tips = x.createLinearGradient(0, H - 70, 0, H);
  tips.addColorStop(0, 'rgba(255,255,255,0)'); tips.addColorStop(1, 'rgba(252,253,253,.95)');
  x.fillStyle = tips; x.fillRect(0, H - 70, 735, 70);
  for (let i = 0; i < 10; i++) {
    const u0 = 640 + i * 30, tipX = 760 + i * 28, tipY = H - 10 - i * 34;
    feather(x, u0, 70 + i * 8, tipX, tipY, 46, 'rgba(160,168,178,.95)', 'rgba(60,66,74,.3)', null);
    if (i >= 3) { // dark tips show through from below
      x.save(); x.globalAlpha = 0.9;
      feather(x, u0 + (tipX - u0) * 0.62, 70 + i * 8 + (tipY - 70 - i * 8) * 0.62, tipX, tipY, 40, '#2a2d33', null, null);
      x.restore();
      x.fillStyle = 'rgba(250,250,250,.9)'; x.beginPath(); x.ellipse(tipX - 6, tipY - 4, 7, 5, 0, 0, Math.PI * 2); x.fill();
    }
  }
  x.fillStyle = 'rgba(248,249,250,.9)';
  [[972, 70, 13, 22], [930, 150, 10, 17]].forEach(([u, v, rx, ry]) => { x.beginPath(); x.ellipse(u, v, rx, ry, -0.4, 0, Math.PI * 2); x.fill(); });
  // leading-edge coverts: small and white
  for (let u = 4; u < 700; u += 14) feather(x, u, 6, u + 4, 70, 18, 'rgba(250,251,252,.9)', 'rgba(150,160,170,.15)', null);
  cutWingShape(x);
  return finishTexture(c);
}

/** The body: white plumage with a grey mantle on the back, all in small soft feathers. */
function bodyTexture() {
  seed = 5;
  const c = document.createElement('canvas'); c.width = 512; c.height = 512;
  const x = c.getContext('2d');
  // u (left to right) = around the body, starting on top; v (top to bottom) = tail to bill
  x.fillStyle = '#f6f7f8'; x.fillRect(0, 0, 512, 512);
  // grey mantle along the back (top = both edges of the texture), from the rump to the base of the neck
  const mantle = (u0) => {
    const g = x.createRadialGradient(u0, 205, 10, u0, 205, 150);
    g.addColorStop(0, 'rgba(172,184,196,1)'); g.addColorStop(0.6, 'rgba(176,188,199,.9)'); g.addColorStop(1, 'rgba(176,188,199,0)');
    x.fillStyle = g; x.save(); x.translate(u0, 205); x.scale(0.62, 1); x.translate(-u0, -205);
    x.beginPath(); x.arc(u0, 205, 150, 0, Math.PI * 2); x.fill(); x.restore();
  };
  mantle(0); mantle(512);
  // feather scales everywhere: faint arcs, denser and finer on the head
  for (let i = 0; i < 2600; i++) {
    const u = rnd() * 512, v = rnd() * 512, s = v > 380 ? 3 + rnd() * 3 : 6 + rnd() * 7;
    const onMantle = (u < 120 || u > 392) && v > 60 && v < 360;
    x.strokeStyle = onMantle ? 'rgba(90,104,120,.16)' : 'rgba(150,158,170,.12)';
    x.lineWidth = 1; x.beginPath(); x.arc(u, v, s, 0.15 * Math.PI, 0.85 * Math.PI); x.stroke();
    x.strokeStyle = 'rgba(255,255,255,.25)'; x.beginPath(); x.arc(u, v - 1.5, s, 0.25 * Math.PI, 0.75 * Math.PI); x.stroke();
  }
  // belly: very slightly warm and shaded underneath
  const belly = x.createLinearGradient(170, 0, 342, 0);
  belly.addColorStop(0, 'rgba(232,226,218,0)'); belly.addColorStop(0.5, 'rgba(232,226,218,.35)'); belly.addColorStop(1, 'rgba(232,226,218,0)');
  x.fillStyle = belly; x.fillRect(0, 60, 512, 330);
  return finishTexture(c);
}

function finishTexture(c) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.generateMipmaps = true;
  return t;
}

/** Paints the tail: white feathers with faint shafts and a soft rounded edge. */
function tailTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const x = c.getContext('2d');
  for (let i = -5; i <= 5; i++) feather(x, 128, 10, 128 + i * 21, 236 - Math.abs(i) * 4, 34, '#f7f8f9', 'rgba(150,160,175,.35)', 'rgba(150,160,175,.4)');
  return finishTexture(c);
}

/* ---------- Shapes ---------- */

/** Smooth interpolation through a list of [t, ...values] keys (Catmull-Rom). */
function profile(keys) {
  return (t) => {
    let i = 0; while (i < keys.length - 2 && t > keys[i + 1][0]) i++;
    const k0 = keys[Math.max(0, i - 1)], k1 = keys[i], k2 = keys[i + 1], k3 = keys[Math.min(keys.length - 1, i + 2)];
    const f = Math.min(1, Math.max(0, (t - k1[0]) / (k2[0] - k1[0])));
    return k1.slice(1).map((_, j) => {
      const p0 = k0[j + 1], p1 = k1[j + 1], p2 = k2[j + 1], p3 = k3[j + 1];
      return 0.5 * (2 * p1 + (-p0 + p2) * f + (2 * p0 - 5 * p1 + 4 * p2 - p3) * f * f + (-p0 + 3 * p1 - 3 * p2 + p3) * f * f * f);
    });
  };
}

/** A smooth closed shape swept along z: each key gives centre height, half-width, and upper and lower depth. */
function sweptShape(keys, along, around, colorAt) {
  const prof = profile(keys), z0 = keys[0][0], z1 = keys[keys.length - 1][0];
  const pos = [], uv = [], col = [], idx = [];
  for (let i = 0; i <= along; i++) {
    const z = z0 + (z1 - z0) * (i / along), [cy, w, up, lo] = prof(z);
    for (let j = 0; j <= around; j++) {
      const a = (j / around) * Math.PI * 2; // 0 = top, then down the right side
      const sx = Math.sin(a), cy2 = Math.cos(a);
      const y = cy + (cy2 > 0 ? up : lo) * cy2;
      pos.push(Math.max(w, 0.001) * sx, y, z); uv.push(j / around, i / along);
      if (colorAt) col.push(...colorAt(i / along, a, sx, cy2));
    }
  }
  for (let i = 0; i < along; i++) for (let j = 0; j < around; j++) {
    const a = i * (around + 1) + j, b = a + around + 1;
    idx.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  if (colorAt) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

/** Body and head: [z, centre height, half-width, depth above, depth below], tail to the base of the bill. */
const BODY = [
  [-1.9, 0.06, 0.03, 0.03, 0.03], [-1.6, 0.07, 0.18, 0.12, 0.12], [-1.1, 0.05, 0.34, 0.25, 0.29],
  [-0.4, 0.0, 0.48, 0.33, 0.43], [0.3, 0.0, 0.5, 0.33, 0.45], [0.85, 0.06, 0.41, 0.29, 0.37],
  [1.18, 0.17, 0.27, 0.25, 0.24], [1.45, 0.27, 0.28, 0.29, 0.25], [1.72, 0.28, 0.25, 0.26, 0.22],
  [1.93, 0.22, 0.13, 0.15, 0.13], [2.0, 0.21, 0.02, 0.02, 0.02],
];

/** The bill: deep and slightly hooked, with the gonys angle on the lower edge. [z, centre, half-width, up, down] */
function billGeometry() {
  const keys = [];
  for (let k = 0; k <= 12; k++) {
    const t = k / 12, z = 1.9 + t * 0.62;
    const upE = 0.1 - 0.1 * t - 0.04 * THREE.MathUtils.smoothstep(t, 0.8, 1);
    const loE = -0.085 + 0.02 * t - 0.032 * Math.exp(-(((t - 0.7) / 0.09) ** 2)) + 0.025 * THREE.MathUtils.smoothstep(t, 0.78, 1);
    const w = (0.105 * (1 - t) + 0.02) * (t > 0.92 ? (1 - t) / 0.08 * 0.8 + 0.2 : 1);
    keys.push([z, 0.21 + (upE + loE) / 2, w, (upE - loE) / 2, (upE - loE) / 2]);
  }
  const yellow = new THREE.Color(0xf3c23a), tip = new THREE.Color(0xf7d978), red = new THREE.Color(0xd8382a), gape = new THREE.Color(0xa07818), c = new THREE.Color();
  return sweptShape(keys, 24, 16, (t, a, sx, cy) => {
    c.copy(yellow).lerp(tip, THREE.MathUtils.smoothstep(t, 0.75, 1));
    if (cy < -0.08 && t > 0.58 && t < 0.84) c.lerp(red, Math.min(1, THREE.MathUtils.smoothstep(-cy, 0.08, 0.3) * 1.4 * (1 - Math.abs(t - 0.71) / 0.13)));
    if (Math.abs(cy + 0.05) < 0.09 && t < 0.86) c.lerp(gape, 0.75); // the line where the mandibles meet
    return [c.r, c.g, c.b];
  });
}

/** Leading and trailing edge of the wing at span fraction s (z, forward is +). */
function edges(s) {
  const le = 0.55 - 1.15 * Math.pow(s, 2.1);
  const te = -0.85 + 0.08 * s - 0.25 * Math.pow(s, 4);
  return [le, te];
}

/** One wing as a bendable grid, painted grey above and pale below.
    Returns a group to position, and bend(shoulder, wrist, tip, sweep) which re-poses it. */
function makeWing(side, upperMat, underMat) {
  const geo = new THREE.PlaneGeometry(1, 1, COLS, ROWS);
  const uv = geo.attributes.uv;
  for (let r = 0; r <= ROWS; r++) for (let c = 0; c <= COLS; c++) uv.setXY(r * (COLS + 1) + c, c / COLS, 1 - r / ROWS);
  const pos = geo.attributes.position;
  const mesh = new THREE.Group();
  // The grid's front faces point up on one wing and down on the other, so pick sides to match
  const top = new THREE.Mesh(geo, upperMat[side > 0 ? 0 : 1]), bottom = new THREE.Mesh(geo, underMat[side > 0 ? 0 : 1]);
  [top, bottom].forEach((m) => { m.frustumCulled = false; mesh.add(m); });
  mesh.userData.parts = [top, bottom];
  const ss = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };

  /** Bends the wing: each column is placed from the previous one at the angle for its span position. */
  function bend(shoulder, wrist, tip, sweep, twist = 0) {
    let x = 0, y = 0, z = 0;
    for (let c = 0; c <= COLS; c++) {
      const s = c / COLS;
      const ang = shoulder + wrist * ss(0.38, 0.55, s) + tip * ss(0.72, 0.9, s);
      if (c > 0) {
        const step = SPAN / COLS;
        x += step * Math.cos(ang);
        y += step * Math.sin(ang);
        z -= step * sweep * ss(0.4, 0.8, s);
      }
      const [le, te] = edges(s);
      for (let r = 0; r <= ROWS; r++) {
        const v = r / ROWS;
        // aerofoil: rounded and thick at the leading edge, thin at the back
        const camber = Math.sin(Math.PI * Math.min(1, v * 1.2)) * 0.1 * (1 - s * 0.6) + (v < 0.12 ? (0.12 - v) * 0.25 * (1 - s) : 0);
        // twist: the outer wing pitches leading-edge-down on the downstroke and feathers on the upstroke
        const chord = (te - le) * v, tw = twist * ss(0.25, 1, s);
        pos.setXYZ(r * (COLS + 1) + c, side * x, y + camber - chord * Math.sin(tw), z + le + chord * Math.cos(tw));
      }
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
  }
  return { mesh, bend };
}

/** Creates the bird. Call bird.flap(dt, effort, legs, fold) every frame; effort 0 = glide, 1 = hard flapping. */
export function createBird() {
  // A little emissive lift stands in for light bounced up off the sea onto white undersides
  const feathers = (map, side, lift) => new THREE.MeshPhysicalMaterial({
    map, side, alphaTest: 0.5, roughness: 0.8, sheen: 0.6, sheenRoughness: 0.6, sheenColor: new THREE.Color(0xffffff),
    emissive: new THREE.Color(lift), emissiveMap: map,
  });
  const upTex = upperWing(), downTex = underWing();
  // [right wing, left wing]: which face of the grid shows the top differs because the left wing is mirrored
  const upperMat = [feathers(upTex, THREE.BackSide, 0x1c1f22), feathers(upTex, THREE.FrontSide, 0x1c1f22)];
  const underMat = [feathers(downTex, THREE.FrontSide, 0x9a9ea2), feathers(downTex, THREE.BackSide, 0x9a9ea2)];
  const bodyTex = bodyTexture();
  const plumage = new THREE.MeshPhysicalMaterial({ map: bodyTex, roughness: 0.85, sheen: 0.7, sheenRoughness: 0.55, sheenColor: new THREE.Color(0xffffff), emissive: new THREE.Color(0x4c5054), emissiveMap: bodyTex });
  const billMat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.32, clearcoat: 0.4, clearcoatRoughness: 0.4 });
  const legMat = new THREE.MeshStandardMaterial({ color: 0xe9b7a2, roughness: 0.55 });

  const bird = new THREE.Group();
  const body = new THREE.Group();
  bird.add(body);
  body.add(new THREE.Mesh(sweptShape(BODY, 64, 36), plumage));
  body.add(new THREE.Mesh(billGeometry(), billMat));

  // Eyes: pale yellow iris, small pupil, red-orange orbital ring, a wet highlight
  const irisMat = new THREE.MeshPhysicalMaterial({ color: 0xf0e4a0, roughness: 0.15, clearcoat: 1 });
  const pupilMat = new THREE.MeshStandardMaterial({ color: 0x0a0b0d, roughness: 0.1 });
  const ringMat = new THREE.MeshStandardMaterial({ color: 0xd9542f, roughness: 0.5 });
  [-1, 1].forEach((s) => {
    const eye = new THREE.Group();
    eye.position.set(s * 0.215, 0.37, 1.6);
    eye.rotation.y = s * Math.PI / 2 - s * 0.35; // looking out and a little forward
    const iris = new THREE.Mesh(new THREE.SphereGeometry(0.052, 16, 12), irisMat);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), pupilMat); pupil.position.z = 0.041;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.056, 0.011, 6, 20), ringMat); ring.position.z = 0.018;
    const glint = new THREE.Mesh(new THREE.SphereGeometry(0.008, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    glint.position.set(0.014, 0.016, 0.05);
    eye.add(iris, pupil, ring, glint); body.add(eye);
  });

  // Legs: tucked back under the tail in flight, lowered under the body to land
  const legs = [-1, 1].map((s) => {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.5, 4, 8), legMat);
    const footGeo = new THREE.BufferGeometry(); // webbed foot: three toes joined by skin
    footGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -0.04, -0.13, 0, 0.2, 0, 0, 0.24, 0, 0, -0.04, 0, 0, 0.24, 0.13, 0, 0.2], 3));
    footGeo.computeVertexNormals();
    const foot = new THREE.Mesh(footGeo, new THREE.MeshStandardMaterial({ color: 0xe0a895, roughness: 0.6, side: THREE.DoubleSide }));
    foot.position.set(0, -0.3, 0);
    leg.add(foot);
    leg.userData.s = s; body.add(leg); return leg;
  });
  const placeLegs = (down) => legs.forEach((leg) => {
    leg.rotation.x = THREE.MathUtils.lerp(Math.PI / 2 - 0.25, 0.08, down);
    leg.position.set(leg.userData.s * THREE.MathUtils.lerp(0.14, 0.17, down), THREE.MathUtils.lerp(-0.34, -0.7, down), THREE.MathUtils.lerp(-1.0, -0.12, down));
    leg.children[0].visible = down > 0.3;
  });
  placeLegs(0);

  // Tail fan
  const tailGeo = new THREE.PlaneGeometry(1.15, 1.0, 4, 4);
  tailGeo.rotateX(Math.PI / 2);
  const tailTex = tailTexture();
  const tail = new THREE.Mesh(tailGeo, new THREE.MeshStandardMaterial({ map: tailTex, side: THREE.DoubleSide, alphaTest: 0.5, roughness: 0.75, emissive: 0x6a6e72, emissiveMap: tailTex }));
  tail.position.set(0, 0.06, -2.05);
  body.add(tail);

  // Wings
  const right = makeWing(1, upperMat, underMat), left = makeWing(-1, upperMat, underMat);
  [right, left].forEach((w) => { w.mesh.position.set(0, 0.2, 0.15); body.add(w.mesh); });

  let phase = 0, ampS = 0.3, beats = 0, glideLeft = 0, lastSin = 0;
  /** Flies like a gull: a few deep wingbeats, then a long glide on stiff, slightly raised wings.
      The wrist and tip lag the shoulder, the outer wing twists through each stroke, and the
      wingtips sweep back on the upstroke. effort 0 = mostly gliding, 1 = flapping hard (climbing,
      landing). legs (0..1) lowers the legs to land; fold (0..1) folds the wings back along the body. */
  bird.flap = (dt, effort, legs = 0, fold = 0) => {
    // flap-and-glide rhythm: count beats, then glide for a while unless working hard
    const hard = effort > 0.75 || legs > 0;
    if (glideLeft > 0 && !hard) glideLeft -= dt;
    else phase += dt * (5.2 + effort * 3);
    const sn = Math.sin(phase);
    if (lastSin < 0 && sn >= 0) { // a beat completed
      beats++;
      if (!hard && beats >= 3 + Math.round(effort * 3)) { beats = 0; glideLeft = 1.6 + Math.random() * 1.6 - effort * 1.2; }
    }
    lastSin = sn;
    const gliding = glideLeft > 0 && !hard;
    const ampTarget = gliding ? 0.025 : 0.22 + effort * 0.5;
    ampS += (ampTarget - ampS) * (1 - Math.exp(-dt * (gliding ? 3 : 6)));
    const amp = ampS, s = gliding ? Math.sin(phase) * 0.15 : sn;
    const down = Math.cos(phase); // >0 while the wing is moving down
    const shoulder = s * amp + (gliding ? 0.14 : 0.1);
    const wrist = Math.sin(phase - 0.7) * amp * 0.75 - 0.06 - (s < 0 ? 0 : amp * 0.2);
    const tip = Math.sin(phase - 1.3) * amp * 0.6 + (gliding ? -0.02 : 0.04);
    const sweep = 0.14 + (gliding ? 0.06 : 0) + Math.max(0, -down) * 0.3 * amp; // tips swept back on the upstroke
    const twist = -down * amp * 0.55 + legs * 0.35; // flare: wings tilt up to brake when landing
    const L = THREE.MathUtils.lerp, f = fold * fold * (3 - 2 * fold);
    right.bend(L(shoulder, -0.12, f), L(wrist, 0.04, f), L(tip, 0.02, f), L(sweep, 0, f), L(twist, 0, f));
    left.bend(L(shoulder, -0.12, f), L(wrist, 0.04, f), L(tip, 0.02, f), L(sweep, 0, f), L(twist, 0, f));
    [right, left].forEach((w, k) => {
      const side = k ? -1 : 1;
      // swing the wing back to lie along the body, its outer edge tilted down over the flank
      w.mesh.rotation.set(0.45 * f, side * f * 1.47, 0, 'YXZ');
      w.mesh.scale.set(1 - 0.47 * f, 1, 1 - 0.35 * f);
      w.mesh.position.set(side * 0.5 * f, 0.2 + 0.14 * f, 0.15 + 0.45 * f);
    });
    placeLegs(legs);
    body.position.y = -s * amp * 0.12 * (1 - f); // the body lifts on each downstroke
    body.rotation.x = -0.2 * f; // standing: chest up, head held above the back
    tail.rotation.x = Math.sin(phase * 0.5) * 0.04 * (1 - f) - 0.12 * f - legs * 0.35 * (1 - f);
    tail.scale.x = 1 + legs * 0.45 * (1 - f); // fanned wide as an air brake to land
  };
  bird.flap(0, 0.5);
  return bird;
}
