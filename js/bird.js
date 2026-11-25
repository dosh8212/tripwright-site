// A low-poly seabird built in code: white body, grey wings with dark tips, orange beak.
// Faces +z so Object3D.lookAt() points it along the flight path.
import * as THREE from '../vendor/three.module.min.js';

/** Builds one wing half as a flat tapered quad from x=0 to x=len (mirrored when side = -1). */
function wingPanel(len, rootChord, tipChord, sweep, side, material) {
  const s = side;
  const v = new Float32Array([
    0, 0, rootChord * 0.5,
    0, 0, -rootChord * 0.5,
    s * len, 0.05, -sweep - tipChord * 0.5,
    s * len, 0.05, -sweep + tipChord * 0.5,
  ]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(v, 3));
  g.setIndex(s > 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2]);
  g.computeVertexNormals();
  return new THREE.Mesh(g, material);
}

/** Builds a wing (inner + outer joint) on one side; returns the shoulder pivot and the elbow pivot. */
function buildWing(side, mats) {
  const shoulder = new THREE.Group();
  shoulder.position.set(side * 0.35, 0.15, 0.2);
  shoulder.add(wingPanel(2.3, 1.35, 1.05, 0.25, side, mats.wing));
  const elbow = new THREE.Group();
  elbow.position.set(side * 2.3, 0.05, -0.25);
  shoulder.add(elbow);
  elbow.add(wingPanel(1.7, 1.05, 0.55, 0.55, side, mats.wing));
  const tip = new THREE.Group();
  tip.position.set(side * 1.7, 0.05, -0.55);
  elbow.add(tip);
  tip.add(wingPanel(1.1, 0.55, 0.08, 0.6, side, mats.tip));
  return { shoulder, elbow, tip };
}

/** Creates the bird. Call bird.flap(time, effort) every frame; effort 0 = glide, 1 = hard flapping. */
export function createBird() {
  const mats = {
    body: new THREE.MeshStandardMaterial({ color: 0xfbfaf6, roughness: 0.55, flatShading: true }),
    wing: new THREE.MeshStandardMaterial({ color: 0xdfe4ea, roughness: 0.6, flatShading: true, side: THREE.DoubleSide }),
    tip: new THREE.MeshStandardMaterial({ color: 0x1d2633, roughness: 0.7, flatShading: true, side: THREE.DoubleSide }),
    beak: new THREE.MeshStandardMaterial({ color: 0xf2a33a, roughness: 0.4, flatShading: true }),
    eye: new THREE.MeshBasicMaterial({ color: 0x0c2340 }),
  };
  const bird = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), mats.body);
  body.scale.set(1, 0.9, 2.6);
  bird.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.38, 10, 8), mats.body);
  head.position.set(0, 0.28, 1.35);
  bird.add(head);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.7, 6), mats.beak);
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, 0.22, 1.95);
  bird.add(beak);
  [-1, 1].forEach((s) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), mats.eye);
    eye.position.set(s * 0.27, 0.38, 1.52);
    bird.add(eye);
  });
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.1, 4), mats.body);
  tail.rotation.x = -Math.PI / 2;
  tail.scale.set(1.4, 1, 0.25);
  tail.position.set(0, 0.05, -1.65);
  bird.add(tail);

  const left = buildWing(-1, mats);
  const right = buildWing(1, mats);
  bird.add(left.shoulder, right.shoulder);

  let phase = 0;
  /** Animates the wings; effort blends between a soaring glide and full strokes. */
  bird.flap = (dt, effort) => {
    phase += dt * (5.5 + effort * 4.5);
    const amp = 0.12 + effort * 0.62;
    const a = Math.sin(phase) * amp + 0.06;
    const b = Math.sin(phase - 0.9) * amp * 0.8 - 0.04;
    const c = Math.sin(phase - 1.5) * amp * 0.5;
    right.shoulder.rotation.z = a; left.shoulder.rotation.z = -a;
    right.elbow.rotation.z = b; left.elbow.rotation.z = -b;
    right.tip.rotation.z = c; left.tip.rotation.z = -c;
    body.position.y = -Math.sin(phase) * 0.08 * effort;
  };
  return bird;
}
