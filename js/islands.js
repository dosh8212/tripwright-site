// The seven islands of the journey. Each has natural terrain (js/terrain.js), palms and jungle, plus
// one landmark for its feature. Each builder returns a Group; group.tick(time, night) animates it.
import * as THREE from '../vendor/three.module.min.js';
import { heightFn, terrain, scatter, palmGrove, bushes, boulders, rng } from './terrain.js';

const C = { trunk: 0x7a5233, coral: 0xef6f56, cream: 0xfff4dc, ink: 0x0c2340, amber: 0xf2b44a, wood: 0x8a6a48, rock: 0x7d746a };
const matCache = {};
/** Shared smooth material per colour. */
function mat(color, extra) {
  const key = color + (extra ? JSON.stringify(extra) : '');
  if (!matCache[key]) matCache[key] = new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.8 }, extra));
  return matCache[key];
}
/** Marks every mesh in an object as casting and receiving shadows. */
function shadows(o) { o.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); return o; }

/** Common island body: terrain, palms along the beach, jungle inland, a few boulders. */
function nature(g, h, extent, seed, opts = {}) {
  const rand = rng(seed);
  g.add(terrain(h, extent, { seed, rocky: opts.rocky }));
  const palms = scatter(h, extent, opts.palms ?? 16, rand, (y, s) => y > 1.4 && y < 6 && s < 0.45);
  const grove = palmGrove(palms, rand);
  g.add(grove);
  const jungle = scatter(h, extent, Math.round((opts.bushes ?? 180) * 2), rand, (y, s) => y > 2.4 && s < 1.7);
  if (jungle.length) g.add(bushes(jungle, rand, opts.tint));
  const rocks = scatter(h, extent, opts.rocks ?? 10, rand, (y) => y > -0.6 && y < 1.4);
  if (rocks.length) g.add(boulders(rocks, rand));
  return grove;
}

/** Sways the fronds of a grove a little in the breeze. */
function sway(grove, t) { if (grove.userData.fronds) grove.userData.fronds.rotation.y = Math.sin(t * 0.6) * 0.004; }

/** A cottage with a pitched roof and a window that glows at night. */
function house(w, wallColor, roofColor) {
  const g = new THREE.Group();
  const walls = new THREE.Mesh(new THREE.BoxGeometry(w, w * 0.8, w * 1.2), mat(wallColor, { roughness: 0.9 }));
  walls.position.y = w * 0.4;
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.01, w * 0.95, w * 0.6, 4, 1), mat(roofColor, { roughness: 0.7, flatShading: true }));
  roof.position.y = w * 0.8 + w * 0.3; roof.rotation.y = Math.PI / 4; roof.scale.z = 1.2;
  const win = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.3, w * 0.3), new THREE.MeshStandardMaterial({ color: 0x223344, emissive: 0xffc861, emissiveIntensity: 0 }));
  win.position.set(0, w * 0.42, w * 0.6 + 0.01);
  g.add(walls, roof, win);
  g.userData.window = win;
  return shadows(g);
}

/** A small sailboat that bobs on the swell. */
function boat(size, sailColor) {
  const g = new THREE.Group();
  const hullGeo = new THREE.CylinderGeometry(size * 0.55, size * 0.3, size * 0.5, 16, 1, false, 0, Math.PI);
  hullGeo.rotateZ(Math.PI / 2); hullGeo.rotateY(Math.PI / 2); hullGeo.scale(1, 1, 2.4);
  const hull = new THREE.Mesh(hullGeo, mat(C.cream, { roughness: 0.4 }));
  hull.rotation.x = Math.PI; hull.position.y = size * 0.25;
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, size * 2.4, 6), mat(C.trunk));
  mast.position.y = size * 1.3;
  const sailGeo = new THREE.BufferGeometry();
  sailGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, size * 0.4, 0.1, 0, size * 2.4, 0, 0, size * 0.4, -size * 1.3]), 3));
  sailGeo.computeVertexNormals();
  const sail = new THREE.Mesh(sailGeo, mat(sailColor, { side: THREE.DoubleSide, roughness: 0.9 }));
  g.add(hull, mast, sail);
  return shadows(g);
}

/* ---------- The seven islands ---------- */

/** 1. Isle of Plans: a green volcanic peak with a flag at the summit. */
function islePlans() {
  const g = new THREE.Group();
  const h = heightFn({ seed: 11, blobs: [{ x: 0, z: 0, r: 26 }, { x: 10, z: 8, r: 16 }], peaks: [{ x: 0, z: -2, r: 22, h: 24 }, { x: 10, z: 9, r: 12, h: 8 }] });
  const grove = nature(g, h, 48, 11, { palms: 18, bushes: 240 });
  const top = h(0, -2);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 5, 6), mat(C.trunk)); pole.position.set(0, top + 2.3, -2);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.5, 10, 2), mat(C.coral, { side: THREE.DoubleSide }));
  flag.position.set(1.3, top + 4, -2); g.add(shadows(pole), shadows(flag));
  const fp = flag.geometry.attributes.position, fx = Float32Array.from(fp.array);
  g.tick = (t) => {
    for (let i = 0; i < fp.count; i++) fp.setZ(i, Math.sin(t * 6 + fx[i * 3] * 2.2) * 0.2 * (fx[i * 3] + 1.3));
    fp.needsUpdate = true; sway(grove, t);
  };
  return g;
}

/** 2. Inbox Atoll: a ring of sand and palms around a bright shallow lagoon, with a red mailbox. */
function inboxAtoll() {
  const g = new THREE.Group();
  const h = heightFn({ seed: 23, ring: { r: 22, w: 7 }, rough: 0.3 });
  const grove = nature(g, h, 46, 23, { palms: 26, bushes: 40, rocks: 6 });
  const box = new THREE.Group();
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.25, 2.4, 0.25), mat(C.wood)); post.position.y = 1.2;
  const bin = new THREE.Mesh(new THREE.CapsuleGeometry(0.75, 1.4, 6, 16), mat(C.coral, { roughness: 0.4, metalness: 0.2 }));
  bin.rotation.x = Math.PI / 2; bin.position.y = 2.7;
  const flagArm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.2, 0.3), mat(C.amber)); flagArm.position.set(0.85, 3.2, -0.4);
  const letter = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 0.05), mat(0xffffff)); letter.position.set(0, 3.4, 0.4);
  box.add(post, bin, flagArm, letter);
  const a = 0.6, bx = Math.cos(a) * 22, bz = Math.sin(a) * 22;
  box.position.set(bx, h(bx, bz) - 0.2, bz); box.rotation.y = -a + Math.PI / 2; box.scale.setScalar(1.4);
  g.add(shadows(box));
  g.tick = (t) => { letter.position.y = 3.4 + Math.max(0, Math.sin(t * 1.6)) * 1.2; sway(grove, t); };
  return g;
}

/** 3. Snapshot Key: low hills, a natural rock arch, and a giant photo print standing in the sand. */
function snapshotKey() {
  const g = new THREE.Group();
  const h = heightFn({ seed: 37, blobs: [{ x: 0, z: 0, r: 22 }, { x: -14, z: 6, r: 12 }], peaks: [{ x: 4, z: -6, r: 16, h: 9 }] });
  const grove = nature(g, h, 44, 37, { palms: 14, bushes: 150 });
  const archGeo = new THREE.TorusGeometry(6, 2, 14, 28, Math.PI), ap = archGeo.attributes.position;
  for (let i = 0; i < ap.count; i++) { const k = 0.85 + Math.sin(ap.getX(i) * 1.7 + ap.getY(i) * 2.3) * 0.12; ap.setXYZ(i, ap.getX(i) * (1 + (k - 1) * 0.3), ap.getY(i), ap.getZ(i) * k); }
  archGeo.computeVertexNormals();
  const arch = new THREE.Mesh(archGeo, mat(0x8a7f72, { roughness: 0.95 })); arch.position.set(-14, h(-14, 6) - 1, 6); arch.rotation.y = 0.7;
  g.add(shadows(arch));
  const frame = new THREE.Group();
  const card = new THREE.Mesh(new THREE.BoxGeometry(7, 8.2, 0.3), mat(0xfffaf0, { roughness: 0.5 }));
  const photo = new THREE.Mesh(new THREE.PlaneGeometry(5.8, 5.4), mat(0x7fc8e0, { roughness: 0.3 })); photo.position.set(0, 0.8, 0.16);
  const sun = new THREE.Mesh(new THREE.CircleGeometry(0.8, 24), mat(0xffd36e)); sun.position.set(1.4, 2.2, 0.17);
  const hillA = new THREE.Mesh(new THREE.CircleGeometry(2.6, 3), mat(0x2f6a2a)); hillA.position.set(-0.8, -0.6, 0.18); hillA.rotation.z = Math.PI / 2;
  frame.add(card, photo, sun, hillA);
  frame.position.set(12, h(12, 10) + 4, 10); frame.rotation.set(0, -0.5, 0.1);
  g.add(shadows(frame));
  const fy = frame.position.y;
  g.tick = (t) => { frame.position.y = fy + Math.sin(t * 1.3) * 0.3; sway(grove, t); };
  return g;
}

/** 4. Twin Isles: two islands joined by a rope bridge (like a foldable's hinge), a map pin above. */
function twinIsles() {
  const g = new THREE.Group();
  const h = heightFn({ seed: 41, blobs: [{ x: -18, z: 0, r: 15 }, { x: 18, z: 0, r: 15 }], peaks: [{ x: -19, z: 0, r: 13, h: 13 }, { x: 19, z: 1, r: 12, h: 11 }] });
  const grove = nature(g, h, 48, 41, { palms: 16, bushes: 170 });
  const planks = new THREE.Group();
  for (let i = 0; i < 18; i++) {
    const x = -9 + i * (18 / 17), sag = Math.cos((x / 9) * Math.PI / 2) * -1.6;
    const plank = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.15, 2.4), mat(C.wood)); plank.position.set(x, 5 + sag, 0); planks.add(plank);
  }
  [-1.2, 1.2].forEach((z) => {
    const pts = []; for (let i = 0; i <= 12; i++) { const x = -10 + i * (20 / 12); pts.push(new THREE.Vector3(x, 6.4 + Math.cos((x / 10) * Math.PI / 2) * -1.6, z)); }
    planks.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.06, 4), mat(0xb08a5a)));
  });
  g.add(shadows(planks));
  const pin = new THREE.Group();
  const head = new THREE.Mesh(new THREE.SphereGeometry(2, 32, 20), mat(C.coral, { roughness: 0.3 }));
  const point = new THREE.Mesh(new THREE.ConeGeometry(1.6, 3.4, 32), mat(C.coral, { roughness: 0.3 }));
  point.rotation.x = Math.PI; point.position.y = -2.4;
  const dot = new THREE.Mesh(new THREE.SphereGeometry(0.8, 20, 14), mat(0xffffff)); dot.position.z = 1.5;
  pin.add(head, point, dot); pin.position.set(-19, h(-19, 0) + 9, 0); g.add(shadows(pin));
  const py = pin.position.y;
  g.tick = (t) => { pin.position.y = py + Math.sin(t * 2) * 0.8; pin.rotation.y = t * 0.8; sway(grove, t); };
  return g;
}

/** 5. Harbor Isle: a village above the beach, a jetty and sailboats bobbing alongside. */
function harborIsle() {
  const g = new THREE.Group();
  const h = heightFn({ seed: 53, blobs: [{ x: 0, z: -4, r: 25 }], peaks: [{ x: -4, z: -10, r: 18, h: 12 }] });
  const grove = nature(g, h, 46, 53, { palms: 14, bushes: 160 });
  const spots = [[-8, 10, C.cream, C.coral], [-2, 12, 0xd9ecf2, C.ink], [5, 11, 0xf7c9a9, 0x2f6a2a], [10, 7, 0xfff0c8, C.coral]];
  const houses = spots.map(([x, z, w, r]) => { const hs = house(3, w, r); hs.position.set(x, h(x, z) - 0.2, z); hs.rotation.y = -x * 0.04; g.add(hs); return hs; });
  const jetty = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.35, 18), mat(C.wood)); jetty.position.set(14, 1.1, 24); jetty.rotation.y = -0.5; g.add(shadows(jetty));
  const boats = [boat(2.2, 0xffffff), boat(1.8, C.coral), boat(1.6, C.amber)];
  boats[0].position.set(22, 0, 26); boats[1].position.set(10, 0, 34); boats[2].position.set(28, 0, 14);
  boats.forEach((b, i) => { b.rotation.y = i * 1.3; g.add(b); });
  g.tick = (t, night) => {
    boats.forEach((b, i) => { b.rotation.z = Math.sin(t * 1.3 + i) * 0.07; b.rotation.x = Math.sin(t * 0.9 + i) * 0.04; b.position.y = Math.sin(t * 1.4 + i * 2) * 0.35 - 0.1; });
    houses.forEach((hs) => { hs.userData.window.material.emissiveIntensity = night * 2; });
    sway(grove, t);
  };
  return g;
}

/** 6. Lighthouse Rock: a rugged rocky islet with a striped lighthouse whose beam sweeps the night. */
function lighthouseRock() {
  const g = new THREE.Group();
  const h = heightFn({ seed: 67, blobs: [{ x: 0, z: 0, r: 17 }], peaks: [{ x: 0, z: 0, r: 15, h: 12 }], rough: 2.2 });
  nature(g, h, 36, 67, { rocky: true, palms: 0, bushes: 20, rocks: 18, tint: 0x4a6a3a });
  const tower = new THREE.Group(); tower.position.y = h(0, 0) - 0.6;
  for (let i = 0; i < 5; i++) {
    const r0 = 2.6 - i * 0.25, r1 = 2.6 - (i + 1) * 0.25;
    const s = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, 2.4, 32), mat(i % 2 ? C.coral : C.cream, { roughness: 0.6 }));
    s.position.y = i * 2.4 + 1.2; tower.add(s);
  }
  const gallery = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.3, 0.35, 32), mat(C.ink)); gallery.position.y = 12.2; tower.add(gallery);
  const lamp = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 2, 32), new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffe39a, emissiveIntensity: 1.5 }));
  lamp.position.y = 13.4; tower.add(lamp);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(1.9, 2, 32), mat(C.coral, { roughness: 0.5 })); cap.position.y = 15.4; tower.add(cap);
  shadows(tower); lamp.castShadow = false;
  const beam = new THREE.Group(); beam.position.y = 13.4; tower.add(beam);
  // Beam: bright at the lamp, fading out along its length
  const beamMat = new THREE.ShaderMaterial({
    uniforms: { strength: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: 'varying float vY; void main(){ vY = position.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: 'uniform float strength; varying float vY; void main(){ float a = smoothstep(-35., 35., vY); gl_FragColor = vec4(vec3(1., .91, .66) * a * a * strength, 1.); }',
  });
  [-1, 1].forEach((s) => {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(5, 70, 32, 1, true), beamMat);
    cone.rotation.z = s * Math.PI / 2; cone.position.x = s * 35; beam.add(cone);
  });
  const light = new THREE.PointLight(0xffd98a, 0, 60, 1.8); light.position.y = 13.4; tower.add(light);
  g.add(tower);
  g.tick = (t, night) => {
    beam.rotation.y = t * 0.9;
    beamMat.uniforms.strength.value = 0.05 + night * 0.4;
    light.intensity = night * 120;
  };
  return g;
}

/** 7. Home Port: a larger island with a sunrise town along the shore and a long dock. */
function homePort() {
  const g = new THREE.Group();
  const h = heightFn({ seed: 79, blobs: [{ x: 0, z: -6, r: 30 }, { x: -16, z: -14, r: 16 }], peaks: [{ x: -4, z: -14, r: 22, h: 14 }, { x: -18, z: -16, r: 12, h: 8 }] });
  const grove = nature(g, h, 54, 79, { palms: 20, bushes: 230 });
  const colors = [[C.cream, C.coral], [0xd9ecf2, C.ink], [0xf7c9a9, 0x2f6a2a], [0xfff0c8, C.coral], [0xe5f3ea, C.ink], [0xffe0d0, 0x2f6a2a]];
  const houses = colors.map(([w, r], i) => {
    const a = -0.95 + i * 0.38, x = Math.sin(a) * 17, z = Math.cos(a) * 17 - 2;
    const hs = house(3 + (i % 2), w, r); hs.position.set(x, h(x, z) - 0.2, z); hs.rotation.y = a; g.add(hs); return hs;
  });
  const dock = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.35, 24), mat(C.wood)); dock.position.set(0, 1.1, 30); g.add(shadows(dock));
  for (let i = 0; i < 6; i++) { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 4, 8), mat(0x6d4a2f)); post.position.set(i % 2 ? 1.4 : -1.4, -0.6, 20 + i * 4); g.add(shadows(post)); }
  const b = boat(2.4, C.coral); b.position.set(5, 0, 36); g.add(b);
  g.tick = (t, night) => {
    b.rotation.z = Math.sin(t * 1.3) * 0.07; b.position.y = Math.sin(t * 1.4) * 0.35 - 0.1;
    houses.forEach((hs) => { hs.userData.window.material.emissiveIntensity = night * 2; });
    sway(grove, t);
  };
  return g;
}

export const islandBuilders = [islePlans, inboxAtoll, snapshotKey, twinIsles, harborIsle, lighthouseRock, homePort];
