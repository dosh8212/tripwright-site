// Low-poly islands, one per stop on the journey. Each builder returns a Group;
// an optional group.tick(time, night) animates it (flags, boats, the lighthouse beam, lit windows).
import * as THREE from '../vendor/three.module.min.js';

const C = {
  sand: 0xf1d6a2, wetSand: 0xd9b97f, grass: 0x5fae6e, grassDark: 0x3f8a55, rock: 0x8d8478, rockDark: 0x5f5a55,
  trunk: 0x7a5233, leaf: 0x2f8a5a, leafLight: 0x46ad72, coral: 0xef6f56, cream: 0xfff4dc, ink: 0x0c2340,
  amber: 0xf2b44a, wood: 0x8a5d3b,
};
const matCache = {};
/** Returns a shared flat-shaded material for a colour. */
function mat(color, extra) {
  const key = color + (extra ? JSON.stringify(extra) : '');
  if (!matCache[key]) matCache[key] = new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.85, flatShading: true }, extra));
  return matCache[key];
}
/** Seeded random so every visit builds the same islands. */
function rng(seed) { let s = seed; return () => ((s = (s * 16807) % 2147483647) / 2147483647); }

/** Roughens a geometry's vertices for a hand-carved low-poly look. */
function jitter(geo, amount, rand, keepBase) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    if (keepBase && p.getY(i) < 0.01) continue;
    p.setXYZ(i, p.getX(i) + (rand() - 0.5) * amount, p.getY(i) + (rand() - 0.5) * amount * 0.6, p.getZ(i) + (rand() - 0.5) * amount);
  }
  geo.computeVertexNormals();
  return geo;
}

/** Sand base with a wet edge. (The shallow-water halo is drawn by the ocean shader.) */
function base(radius, rand) {
  const g = new THREE.Group();
  const wet = new THREE.Mesh(new THREE.CylinderGeometry(radius * 1.06, radius * 1.3, 1.2, 28), mat(C.wetSand));
  wet.position.y = -0.2;
  g.add(wet);
  const sand = new THREE.Mesh(jitter(new THREE.CylinderGeometry(radius * 0.92, radius * 1.05, 1.6, 28, 1), 0.5, rand), mat(C.sand));
  sand.position.y = 0.5;
  g.add(sand);
  return g;
}

/** A hill: a jittered cone in two greens. */
function hill(radius, height, rand, color) {
  const geo = jitter(new THREE.ConeGeometry(radius, height, 9, 3), radius * 0.12, rand, true);
  const m = new THREE.Mesh(geo, mat(color || C.grass));
  m.position.y = height / 2 + 1;
  return m;
}

/** A leaning palm tree with drooping fronds. */
export function palm(height, rand) {
  const g = new THREE.Group();
  const lean = (rand() - 0.5) * 0.5;
  const segs = 5;
  let x = 0, y = 0;
  for (let i = 0; i < segs; i++) {
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.22 - i * 0.02, 0.28 - i * 0.02, height / segs + 0.1, 6), mat(C.trunk));
    x += lean * i * 0.25;
    y += height / segs;
    seg.position.set(x, y - height / segs / 2, 0);
    seg.rotation.z = -lean * 0.5;
    g.add(seg);
  }
  const crown = new THREE.Group();
  crown.position.set(x, y, 0);
  for (let i = 0; i < 7; i++) {
    const frond = new THREE.Mesh(new THREE.ConeGeometry(0.55, 3.4, 3), mat(i % 2 ? C.leaf : C.leafLight));
    frond.scale.set(1, 1, 0.25);
    frond.position.y = 0;
    const holder = new THREE.Group();
    holder.rotation.y = (i / 7) * Math.PI * 2 + rand();
    frond.rotation.z = -Math.PI / 2 - 0.45 - rand() * 0.3;
    frond.position.x = 1.6;
    frond.position.y = -0.5;
    holder.add(frond);
    crown.add(holder);
  }
  g.add(crown);
  g.userData.crown = crown;
  return g;
}

/** Places palms around the beach and returns them for swaying. */
function palms(group, count, radius, rand, minH) {
  const list = [];
  for (let i = 0; i < count; i++) {
    const a = rand() * Math.PI * 2;
    const r = radius * (0.55 + rand() * 0.3);
    const p = palm((minH || 5) + rand() * 3, rand);
    p.position.set(Math.cos(a) * r, 1.2, Math.sin(a) * r);
    p.rotation.y = rand() * 6;
    group.add(p);
    list.push(p);
  }
  return list;
}

/** Gentle sway shared by every island's palms. */
function sway(list, t) {
  list.forEach((p, i) => { p.userData.crown.rotation.z = Math.sin(t * 1.2 + i) * 0.06; p.userData.crown.rotation.x = Math.cos(t + i) * 0.05; });
}

/** A small house with a pitched roof and a window that glows at night. */
function house(w, wallColor, roofColor) {
  const g = new THREE.Group();
  const walls = new THREE.Mesh(new THREE.BoxGeometry(w, w * 0.8, w), mat(wallColor));
  walls.position.y = w * 0.4;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(w * 0.85, w * 0.6, 4), mat(roofColor));
  roof.position.y = w * 0.8 + w * 0.3; roof.rotation.y = Math.PI / 4;
  const win = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.3, w * 0.3), new THREE.MeshStandardMaterial({ color: 0x334, emissive: 0xffc861, emissiveIntensity: 0 }));
  win.position.set(0, w * 0.42, w / 2 + 0.01);
  g.add(walls, roof, win);
  g.userData.window = win;
  return g;
}

/** A sailboat that bobs on the water. */
function boat(size, sailColor) {
  const g = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.CylinderGeometry(size * 0.5, size * 0.3, size * 0.4, 4, 1), mat(C.cream));
  hull.scale.set(0.6, 1, 2.2); hull.rotation.y = Math.PI / 4;
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, size * 2.2, 4), mat(C.trunk));
  mast.position.y = size * 1.1;
  const sail = new THREE.Mesh(new THREE.ConeGeometry(size * 0.7, size * 1.9, 3), mat(sailColor));
  sail.scale.set(0.1, 1, 1); sail.position.set(0, size * 1.2, -size * 0.15);
  g.add(hull, mast, sail);
  return g;
}

/* ---------- The seven islands ---------- */

/** 1. Isle of Plans: a tall green peak with a winding path and a coral flag on top. */
function islePlans() {
  const rand = rng(11), g = new THREE.Group();
  g.add(base(16, rand));
  g.add(hill(12, 16, rand));
  const inner = hill(7, 9, rand, C.grassDark); inner.position.x = 5; inner.position.z = 4; g.add(inner);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 4, 4), mat(C.trunk)); pole.position.y = 19; g.add(pole);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.4, 6, 1), mat(C.coral, { side: THREE.DoubleSide }));
  flag.position.set(1.2, 20.2, 0); g.add(flag);
  const fp = flag.geometry.attributes.position, fx = Float32Array.from(fp.array);
  const p = palms(g, 6, 16, rand);
  g.tick = (t) => {
    for (let i = 0; i < fp.count; i++) fp.setZ(i, Math.sin(t * 6 + fx[i * 3] * 2) * 0.18 * (fx[i * 3] + 1.2));
    fp.needsUpdate = true;
    sway(p, t);
  };
  return g;
}

/** 2. Inbox Atoll: a ring of sand around a bright lagoon, with a red mailbox. */
function inboxAtoll() {
  const rand = rng(23), g = new THREE.Group();
  const ring = new THREE.Mesh(jitter(new THREE.TorusGeometry(15, 3.2, 6, 32), 0.6, rand), mat(C.sand));
  ring.rotation.x = Math.PI / 2; ring.scale.z = 0.45; ring.position.y = 1.1; g.add(ring);
  const lagoon = new THREE.Mesh(new THREE.CircleGeometry(13, 32), new THREE.MeshBasicMaterial({ color: 0x8fe6e2 }));
  lagoon.rotation.x = -Math.PI / 2; lagoon.position.y = 1.3; g.add(lagoon);
  const box = new THREE.Group();
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.3, 2.4, 0.3), mat(C.wood)); post.position.y = 1.2;
  const bin = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 2.4, 8, 1, false, 0, Math.PI), mat(C.coral));
  bin.rotation.z = Math.PI / 2; bin.rotation.y = Math.PI / 2; bin.position.y = 2.5;
  const binBase = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.9, 2.4), mat(C.coral)); binBase.position.y = 2.1;
  const letter = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.85, 0.05), mat(0xffffff)); letter.position.set(0, 3.2, 0.2);
  box.add(post, binBase, bin, letter);
  box.position.set(13.5, 1, 6); box.rotation.y = -0.6; box.scale.setScalar(1.3);
  g.add(box);
  const p = palms(g, 0, 0, rand);
  for (let i = 0; i < 7; i++) { const a = i * 0.9 + 0.3; const pt = palm(4.5 + rand() * 3, rand); pt.position.set(Math.cos(a) * 15, 1, Math.sin(a) * 15); g.add(pt); p.push(pt); }
  g.tick = (t) => { letter.position.y = 3.2 + Math.max(0, Math.sin(t * 1.6)) * 1.2; sway(p, t); };
  return g;
}

/** 3. Snapshot Key: a rock arch on a low key, with a giant photo frame stuck in the sand. */
function snapshotKey() {
  const rand = rng(37), g = new THREE.Group();
  g.add(base(15, rand));
  const archGeo = jitter(new THREE.TorusGeometry(6, 2.2, 6, 12, Math.PI), 0.7, rand);
  const arch = new THREE.Mesh(archGeo, mat(C.rock)); arch.position.set(-3, 1, 0); g.add(arch);
  const boulder = new THREE.Mesh(jitter(new THREE.DodecahedronGeometry(3.4, 0), 0.8, rand), mat(C.rockDark)); boulder.position.set(6, 2.4, -5); g.add(boulder);
  const frame = new THREE.Group();
  const card = new THREE.Mesh(new THREE.BoxGeometry(7, 8.2, 0.3), mat(0xfffaf0));
  const photo = new THREE.Mesh(new THREE.PlaneGeometry(5.8, 5.4), mat(0x7fc8e0)); photo.position.set(0, 0.8, 0.16);
  const sun = new THREE.Mesh(new THREE.CircleGeometry(0.8, 12), mat(0xffd36e)); sun.position.set(1.4, 2.2, 0.17);
  const hillA = new THREE.Mesh(new THREE.CircleGeometry(2.6, 3), mat(C.grassDark)); hillA.position.set(-0.8, -0.6, 0.18); hillA.rotation.z = Math.PI / 2;
  frame.add(card, photo, sun, hillA);
  frame.position.set(7, 6, 6); frame.rotation.set(0, -0.5, 0.12);
  g.add(frame);
  const p = palms(g, 4, 15, rand);
  g.tick = (t) => { frame.position.y = 6 + Math.sin(t * 1.3) * 0.4; frame.rotation.z = 0.12 + Math.sin(t * 0.8) * 0.04; sway(p, t); };
  return g;
}

/** 4. Twin Isles: two islands joined by a rope bridge, like a foldable with its hinge. A map pin floats above. */
function twinIsles() {
  const rand = rng(41), g = new THREE.Group();
  const a = new THREE.Group(), b = new THREE.Group();
  a.add(base(10, rand), hill(8, 11, rand)); a.position.x = -13;
  b.add(base(10, rand), hill(8, 9, rand, C.grassDark)); b.position.x = 13;
  g.add(a, b);
  const planks = new THREE.Group();
  for (let i = 0; i < 14; i++) {
    const x = -8 + i * (16 / 13);
    const sag = Math.cos((x / 8) * Math.PI / 2) * -1.4;
    const plank = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.2, 2.6), mat(C.wood));
    plank.position.set(x, 4 + sag, 0); planks.add(plank);
  }
  g.add(planks);
  const pin = new THREE.Group();
  const head = new THREE.Mesh(new THREE.SphereGeometry(2, 12, 10), mat(C.coral, { roughness: 0.4 }));
  const point = new THREE.Mesh(new THREE.ConeGeometry(1.6, 3.4, 12), mat(C.coral, { roughness: 0.4 }));
  point.rotation.x = Math.PI; point.position.y = -2.4;
  const dot = new THREE.Mesh(new THREE.SphereGeometry(0.8, 10, 8), mat(0xffffff)); dot.position.z = 1.5;
  pin.add(head, point, dot); pin.position.set(-13, 18, 0); g.add(pin);
  const p = palms(a, 3, 10, rand).concat(palms(b, 3, 10, rand));
  g.tick = (t) => { pin.position.y = 18 + Math.sin(t * 2) * 0.8; pin.rotation.y = t * 0.8; sway(p, t); };
  return g;
}

/** 5. Harbor Isle: a village, a jetty and sailboats bobbing alongside. */
function harborIsle() {
  const rand = rng(53), g = new THREE.Group();
  g.add(base(16, rand), hill(10, 8, rand));
  const houses = [[-6, 1.2, 8, C.cream, C.coral], [-1, 1.2, 10, 0xd9ecf2, C.ink], [4, 1.2, 9, 0xf7c9a9, C.grassDark]].map(([x, y, z, w, r]) => {
    const h = house(3, w, r); h.position.set(x, y, z); h.rotation.y = 0.2 - x * 0.03; g.add(h); return h;
  });
  const jetty = new THREE.Mesh(new THREE.BoxGeometry(3, 0.4, 16), mat(C.wood)); jetty.position.set(12, 1.2, 16); jetty.rotation.y = -0.5; g.add(jetty);
  const boats = [boat(2.2, 0xffffff), boat(1.8, C.coral), boat(1.6, C.amber)];
  boats[0].position.set(19, 0.4, 18); boats[1].position.set(9, 0.4, 25); boats[2].position.set(23, 0.4, 9);
  boats.forEach((b, i) => { b.rotation.y = i * 1.3; g.add(b); });
  const p = palms(g, 4, 16, rand);
  g.tick = (t, night) => {
    boats.forEach((b, i) => { b.rotation.z = Math.sin(t * 1.5 + i) * 0.08; b.position.y = 0.4 + Math.sin(t * 1.8 + i * 2) * 0.15; });
    houses.forEach((h) => { h.userData.window.material.emissiveIntensity = night * 1.6; });
    sway(p, t);
  };
  return g;
}

/** 6. Lighthouse Rock: a dark rock with a striped lighthouse whose beam sweeps the night. */
function lighthouseRock() {
  const rand = rng(67), g = new THREE.Group();
  const rock = new THREE.Mesh(jitter(new THREE.ConeGeometry(14, 9, 10, 3), 1.4, rand, true), mat(C.rockDark)); rock.position.y = 4; g.add(rock);
  const rock2 = new THREE.Mesh(jitter(new THREE.DodecahedronGeometry(5, 0), 1, rand), mat(C.rock)); rock2.position.set(10, 1.5, 6); g.add(rock2);
  const tower = new THREE.Group(); tower.position.y = 8;
  const stripes = 5;
  for (let i = 0; i < stripes; i++) {
    const r0 = 2.6 - i * 0.25, r1 = 2.6 - (i + 1) * 0.25;
    const s = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, 2.4, 12), mat(i % 2 ? C.coral : C.cream));
    s.position.y = i * 2.4 + 1.2; tower.add(s);
  }
  const gallery = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.3, 0.4, 12), mat(C.ink)); gallery.position.y = 12.2; tower.add(gallery);
  const lamp = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 2, 12), new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffe39a, emissiveIntensity: 1.5 }));
  lamp.position.y = 13.4; tower.add(lamp);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(1.9, 2, 12), mat(C.coral)); cap.position.y = 15.4; tower.add(cap);
  const beam = new THREE.Group(); beam.position.y = 13.4; tower.add(beam);
  // Beam: a cone from the lamp outwards, bright at the lamp and fading to nothing.
  const beamMat = new THREE.ShaderMaterial({
    uniforms: { strength: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: 'varying float vY; void main(){ vY = position.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: 'uniform float strength; varying float vY; void main(){ float a = smoothstep(-35., 35., vY); gl_FragColor = vec4(vec3(1., .91, .66) * a * a * strength, 1.); }',
  });
  [-1, 1].forEach((s) => {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(5, 70, 24, 1, true), beamMat);
    cone.rotation.z = s * Math.PI / 2; cone.position.x = s * 35; beam.add(cone);
  });
  const light = new THREE.PointLight(0xffd98a, 0, 70, 1.4); light.position.y = 13.4; tower.add(light);
  g.add(tower);
  g.tick = (t, night) => {
    beam.rotation.y = t * 0.9;
    beamMat.uniforms.strength.value = 0.05 + night * 0.4;
    light.intensity = night * 260;
  };
  return g;
}

/** 7. Home Port: a sunrise harbour town with a long dock, the end of the voyage. */
function homePort() {
  const rand = rng(79), g = new THREE.Group();
  g.add(base(20, rand), hill(14, 9, rand), (() => { const h = hill(8, 6, rand, C.grassDark); h.position.set(-9, 0, -6); return h; })());
  const colors = [[C.cream, C.coral], [0xd9ecf2, C.ink], [0xf7c9a9, C.grassDark], [0xfff0c8, C.coral], [0xe5f3ea, C.ink]];
  const houses = colors.map(([w, r], i) => { const h = house(3 + (i % 2), w, r); const a = -0.9 + i * 0.45; h.position.set(Math.sin(a) * 13, 1.2, Math.cos(a) * 13); h.rotation.y = a; g.add(h); return h; });
  const dock = new THREE.Mesh(new THREE.BoxGeometry(3, 0.4, 22), mat(C.wood)); dock.position.set(0, 1.2, 28); g.add(dock);
  for (let i = 0; i < 5; i++) { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 3, 5), mat(0x6d4a2f)); post.position.set(i % 2 ? 1.6 : -1.6, 0.2, 19 + i * 4.5); g.add(post); }
  const b = boat(2.4, C.coral); b.position.set(5, 0.4, 32); g.add(b);
  const p = palms(g, 5, 20, rand);
  g.tick = (t, night) => {
    b.rotation.z = Math.sin(t * 1.4) * 0.07;
    houses.forEach((h) => { h.userData.window.material.emissiveIntensity = night * 1.6; });
    sway(p, t);
  };
  return g;
}

export const islandBuilders = [islePlans, inboxAtoll, snapshotKey, twinIsles, harborIsle, lighthouseRock, homePort];
