// A seabird (a gull) built in code: a smooth body turned from a side profile, long wings that bend
// at the wrist as they beat, painted feathers with separated black primaries, and a fanned tail.
// Faces +z so Object3D.lookAt() points it along the flight path.
import * as THREE from '../vendor/three.module.min.js';

const SPAN = 5.2;          // one wing, shoulder to tip
const COLS = 28, ROWS = 7; // wing mesh resolution (span x chord)

/** Paints the upper wing: grey coverts, white trailing edge, black primaries with white spots, ragged tips. */
function wingTexture() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256;
  const x = c.getContext('2d');
  // u (left to right) = shoulder to tip; v (top to bottom) = leading edge to trailing edge
  const base = x.createLinearGradient(0, 0, 512, 0);
  base.addColorStop(0, '#c9d1da'); base.addColorStop(0.62, '#b7c1cc'); base.addColorStop(0.72, '#2a2f36'); base.addColorStop(1, '#14171c');
  x.fillStyle = base; x.fillRect(0, 0, 512, 256);
  // soft shading toward the leading edge
  const lead = x.createLinearGradient(0, 0, 0, 256);
  lead.addColorStop(0, 'rgba(255,255,255,.35)'); lead.addColorStop(0.35, 'rgba(255,255,255,0)');
  x.fillStyle = lead; x.fillRect(0, 0, 512, 256);
  // white trailing edge on the inner wing
  const trail = x.createLinearGradient(0, 180, 0, 256);
  trail.addColorStop(0, 'rgba(255,255,255,0)'); trail.addColorStop(1, 'rgba(255,255,255,.95)');
  x.fillStyle = trail; x.fillRect(0, 180, 360, 76);
  // secondary feather lines
  x.strokeStyle = 'rgba(80,92,110,.35)'; x.lineWidth = 1.2;
  for (let i = 0; i < 26; i++) { const u = 20 + i * 13; x.beginPath(); x.moveTo(u, 150); x.lineTo(u + 6, 256); x.stroke(); }
  // primaries: long black feathers with gaps between their tips, and white "mirror" spots near the end
  x.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 7; i++) {
    const u = 370 + i * 20;
    x.beginPath(); x.moveTo(u + 10, 256); x.quadraticCurveTo(u + 15, 200 - i * 6, u + 19, 150 - i * 12); x.lineTo(u + 22, 256); x.fill();
  }
  x.beginPath(); x.moveTo(512, 0); x.lineTo(512, 256); x.lineTo(470, 256); x.quadraticCurveTo(505, 120, 512, 0); x.fill();
  x.globalCompositeOperation = 'source-over';
  x.fillStyle = 'rgba(255,255,255,.9)';
  [[488, 70, 9], [462, 120, 7]].forEach(([u, v, r]) => { x.beginPath(); x.ellipse(u, v, r, r * 1.6, 0, 0, Math.PI * 2); x.fill(); });
  x.strokeStyle = 'rgba(0,0,0,.45)'; x.lineWidth = 1;
  for (let i = 0; i < 9; i++) { const u = 372 + i * 16; x.beginPath(); x.moveTo(u, 60); x.lineTo(u + 8, 256); x.stroke(); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

/** Paints the tail: white feathers with faint shafts and a soft rounded edge. */
function tailTexture() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = '#f7f8f9'; x.beginPath(); x.moveTo(64, 0); x.lineTo(4, 112); x.quadraticCurveTo(64, 132, 124, 112); x.closePath(); x.fill();
  x.strokeStyle = 'rgba(150,160,175,.4)';
  for (let i = -5; i <= 5; i++) { x.beginPath(); x.moveTo(64, 6); x.lineTo(64 + i * 11, 118); x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/** Leading and trailing edge of the wing at span fraction s (z, forward is +). */
function edges(s) {
  const le = 0.55 - 1.15 * Math.pow(s, 2.1);
  const te = -0.85 + 0.08 * s - 0.25 * Math.pow(s, 4);
  return [le, te];
}

/** One wing as a bendable grid. Returns the mesh and bend(shoulder, wrist, tip, side) which re-poses it. */
function makeWing(side, material) {
  const geo = new THREE.PlaneGeometry(1, 1, COLS, ROWS);
  const uv = geo.attributes.uv;
  for (let r = 0; r <= ROWS; r++) for (let c = 0; c <= COLS; c++) uv.setXY(r * (COLS + 1) + c, c / COLS, 1 - r / ROWS);
  const pos = geo.attributes.position;
  const mesh = new THREE.Mesh(geo, material);
  mesh.frustumCulled = false;
  const ss = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };

  /** Bends the wing: each column is placed from the previous one at the angle for its span position. */
  function bend(shoulder, wrist, tip, sweep) {
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
        const camber = Math.sin(Math.PI * Math.min(1, v * 1.25)) * 0.09 * (1 - s * 0.6);
        pos.setXYZ(r * (COLS + 1) + c, side * x, y + camber, z + le + (te - le) * v);
      }
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
  }
  return { mesh, bend };
}

/** Builds the body by turning a gull's side profile around its length, with a grey back. */
function makeBody(white) {
  // [z along the body, radius]: tail to chest to neck to head to beak base
  const prof = [[-1.75, 0.02], [-1.6, 0.12], [-1.2, 0.3], [-0.6, 0.48], [0, 0.56], [0.5, 0.52], [0.95, 0.38], [1.15, 0.33],
    [1.35, 0.37], [1.6, 0.34], [1.82, 0.22], [1.95, 0.08], [1.98, 0.0]];
  const pts = prof.map(([z, r]) => new THREE.Vector2(r, z));
  const geo = new THREE.LatheGeometry(pts, 28);
  geo.rotateX(Math.PI / 2); // lathe axis y -> z, head toward +z
  geo.scale(1, 0.88, 1);
  const p = geo.attributes.position, col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const head = THREE.MathUtils.smoothstep(p.getZ(i), 0.9, 1.3);
    // grey mantle on the back between the wings, white everywhere else
    const back = THREE.MathUtils.smoothstep(p.getY(i), 0.18, 0.42) * (1 - head) * THREE.MathUtils.smoothstep(p.getZ(i), -1.3, -0.6);
    const g = 1 - back * 0.22;
    col.set([g * 0.99, g * 0.99 + back * 0.01, g * 1.0], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return new THREE.Mesh(geo, white);
}

/** Creates the bird. Call bird.flap(dt, effort) every frame; effort 0 = glide, 1 = hard flapping. */
export function createBird() {
  const wingMat = new THREE.MeshStandardMaterial({ map: wingTexture(), side: THREE.DoubleSide, roughness: 0.75, alphaTest: 0.5 });
  const white = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 });
  const beakMat = new THREE.MeshStandardMaterial({ color: 0xf3c13a, roughness: 0.35 });
  const red = new THREE.MeshStandardMaterial({ color: 0xd8432e, roughness: 0.4 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x111418, roughness: 0.2, metalness: 0.1 });
  const legMat = new THREE.MeshStandardMaterial({ color: 0xe8b9a0, roughness: 0.6 });

  const bird = new THREE.Group();
  const body = new THREE.Group();
  bird.add(body);
  body.add(makeBody(white));

  // Beak: a slim tapered wedge with a slight hook and the gull's red spot
  const beakGeo = new THREE.CylinderGeometry(0.035, 0.11, 0.62, 12, 6);
  beakGeo.rotateX(Math.PI / 2);
  const bp = beakGeo.attributes.position;
  for (let i = 0; i < bp.count; i++) { const z = bp.getZ(i) + 0.31; bp.setY(i, bp.getY(i) * 0.8 - Math.pow(Math.max(0, z - 0.42), 2) * 0.9); }
  beakGeo.computeVertexNormals();
  const beak = new THREE.Mesh(beakGeo, beakMat);
  beak.position.set(0, 1.0 * 0.88 * 0.08, 2.12);
  body.add(beak);
  const spot = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), red);
  spot.position.set(0, 0.02, 2.28); body.add(spot);

  // Eyes with a tiny highlight
  [-1, 1].forEach((s) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.065, 12, 8), dark);
    eye.position.set(s * 0.29, 0.13, 1.62); body.add(eye);
    const glint = new THREE.Mesh(new THREE.SphereGeometry(0.015, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    glint.position.set(s * 0.335, 0.16, 1.67); body.add(glint);
  });

  // Legs: tucked back under the tail in flight, lowered under the body to land
  const legs = [-1, 1].map((s) => {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.5, 4, 6), legMat);
    const foot = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 4), legMat);
    foot.scale.set(1, 0.25, 1.5); foot.position.set(0, -0.3, 0.08); leg.add(foot);
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
  const tail = new THREE.Mesh(tailGeo, new THREE.MeshStandardMaterial({ map: tailTexture(), side: THREE.DoubleSide, alphaTest: 0.5, roughness: 0.7 }));
  tail.position.set(0, 0.02, -2.05);
  body.add(tail);

  // Wings
  const right = makeWing(1, wingMat), left = makeWing(-1, wingMat);
  [right, left].forEach((w) => { w.mesh.position.set(0, 0.2, 0.15); body.add(w.mesh); });

  let phase = 0;
  /** Beats the wings: strong strokes with a lagging wrist and tip, or a near-still glide.
      legs (0..1) lowers the legs to land; fold (0..1) folds the wings back along the body. */
  bird.flap = (dt, effort, legs = 0, fold = 0) => {
    phase += dt * (4.2 + effort * 3.6);
    const amp = 0.1 + effort * 0.55;
    const s = Math.sin(phase);
    const shoulder = s * amp + 0.1;
    const wrist = Math.sin(phase - 0.7) * amp * 0.75 - 0.08 - (s < 0 ? 0 : effort * 0.12);
    const tip = Math.sin(phase - 1.3) * amp * 0.55 + 0.04;
    const sweep = 0.12 + (1 - effort) * 0.1 + Math.max(0, Math.cos(phase)) * 0.12 * effort;
    const L = THREE.MathUtils.lerp, f = fold * fold * (3 - 2 * fold);
    right.bend(L(shoulder, -0.12, f), L(wrist, 0.04, f), L(tip, 0.02, f), L(sweep, 0, f));
    left.bend(L(shoulder, -0.12, f), L(wrist, 0.04, f), L(tip, 0.02, f), L(sweep, 0, f));
    [right, left].forEach((w, k) => {
      const side = k ? -1 : 1;
      // swing the wing back to lie along the body, its outer edge tilted down over the flank
      w.mesh.rotation.set(0.45 * f, side * f * 1.47, 0, 'YXZ');
      w.mesh.scale.set(1 - 0.47 * f, 1, 1 - 0.35 * f);
      w.mesh.position.set(side * 0.5 * f, 0.2 + 0.14 * f, 0.15 + 0.45 * f);
    });
    placeLegs(legs);
    body.position.y = -s * 0.1 * effort * (1 - f);
    tail.rotation.x = Math.sin(phase * 0.5) * 0.04 * (1 - f) - 0.12 * f;
  };
  bird.flap(0, 0.5);
  return bird;
}
