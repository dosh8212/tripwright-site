// The 3D world: sky, ocean, clouds, stars, seven islands and the seabird's route between them.
// world.render(film, dt) draws one frame for a film position: 0 = departure, 1..7 = arrived at island n.
import * as THREE from '../vendor/three.module.min.js';
import { createBird } from './bird.js';
import { islandBuilders } from './islands.js';
import { makeOcean } from './ocean.js';
import { seabed } from './terrain.js';

/* Sky for each stop: zenith, horizon, sun colour, sun height (radians), night amount. */
const SKIES = [
  { top: 0x6f8fc7, hor: 0xffc29a, sun: 0xffd2a0, elev: 0.06, night: 0.15 }, // departure: dawn
  { top: 0x5aa6e6, hor: 0xd7f0ff, sun: 0xfff3d6, elev: 0.55, night: 0 },    // isle of plans: morning
  { top: 0x3f97e0, hor: 0xc9ecff, sun: 0xffffff, elev: 0.95, night: 0 },    // inbox atoll: noon
  { top: 0x4fa0d8, hor: 0xe6f4ea, sun: 0xfff1c8, elev: 0.6, night: 0 },     // snapshot key: afternoon
  { top: 0x5a7fc0, hor: 0xffc98a, sun: 0xffb46b, elev: 0.2, night: 0 },     // twin isles: golden hour
  { top: 0x3b3f7a, hor: 0xff8a66, sun: 0xff6f4a, elev: 0.03, night: 0.3 },  // harbor isle: sunset
  { top: 0x050c1f, hor: 0x1d2f57, sun: 0x9fb4ff, elev: -0.3, night: 1 },    // lighthouse rock: night
  { top: 0x3c5d9a, hor: 0xffb88c, sun: 0xffcf9e, elev: 0.08, night: 0.25 }, // home port: next dawn
];

/* Island centres, winding across the sea. */
const ISLANDS = [
  [0, 0, -170], [140, 0, -330], [20, 0, -500], [170, 0, -670], [40, 0, -850], [190, 0, -1010], [70, 0, -1190],
].map(([x, y, z]) => new THREE.Vector3(x, y, z));
const ORBIT_R = 64;

const tmpA = new THREE.Color(), tmpB = new THREE.Color();
/** Blends two hex colours into target. */
function mixHex(a, b, t, target) { return target.copy(tmpA.setHex(a)).lerp(tmpB.setHex(b), t); }

/** Soft round cloud puff drawn on a canvas, used as a sprite texture. */
function cloudTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  for (let i = 0; i < 9; i++) {
    const cx = 30 + Math.random() * 68, cy = 46 + Math.random() * 36, r = 22 + Math.random() * 20;
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/** Sky dome: gradient from horizon to zenith, sun disc and glow. */
function makeSky() {
  const uniforms = {
    top: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, sunCol: { value: new THREE.Color() },
    sunDir: { value: new THREE.Vector3(0, 0.3, -1).normalize() }, night: { value: 0 },
  };
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(3000, 32, 16), new THREE.ShaderMaterial({
    uniforms, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: `uniform vec3 top, hor, sunCol, sunDir; uniform float night; varying vec3 vDir;
      void main(){
        float h = max(vDir.y, 0.);
        vec3 col = mix(hor, top, pow(h, .45));
        col = mix(col, hor * .8, smoothstep(0., -.08, vDir.y));
        float s = max(dot(vDir, sunDir), 0.);
        col += sunCol * (pow(s, 900.) * 3. + pow(s, 24.) * .45 * (1. - night * .6));
        gl_FragColor = vec4(col, 1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));
  return { mesh, uniforms };
}

/** Stars that fade in with the night. */
function makeStars() {
  const n = 900, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const th = Math.random() * Math.PI * 2, ph = Math.random() * 1.3;
    pos.set([Math.cos(th) * Math.cos(ph) * 2500, Math.sin(ph) * 2500 + 60, Math.sin(th) * Math.cos(ph) * 2500], i * 3);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const m = new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false });
  return new THREE.Points(g, m);
}

/** Clouds: a bank the bird dives through at departure, plus scattered puffs on the horizon. */
function makeClouds() {
  const tex = cloudTexture(), group = new THREE.Group(), mats = [];
  const add = (x, y, z, s, o) => {
    const m = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: o, depthWrite: false, fog: true });
    const sp = new THREE.Sprite(m); sp.position.set(x, y, z); sp.scale.set(s, s * 0.55, 1);
    sp.userData.base = o; mats.push(m); group.add(sp);
  };
  for (let i = 0; i < 70; i++) add((Math.random() - 0.5) * 260, 70 + Math.random() * 40, 40 - Math.random() * 200, 40 + Math.random() * 60, 0.75);
  for (let i = 0; i < 40; i++) {
    const a = Math.random() * Math.PI * 2, r = 900 + Math.random() * 900;
    add(Math.cos(a) * r + 80, 120 + Math.random() * 160, Math.sin(a) * r - 600, 260 + Math.random() * 200, 0.55);
  }
  return { group, mats };
}

/** Builds the flight path: a dive from the clouds, then a sweeping arc past each island. */
function makeRoute() {
  const pts = [new THREE.Vector3(-30, 118, 150), new THREE.Vector3(-14, 108, 70), new THREE.Vector3(8, 70, -20)];
  const marks = []; // index of the "arrive" and "leave" points per island
  let prev = pts[pts.length - 1];
  ISLANDS.forEach((c, i) => {
    const toward = new THREE.Vector3().subVectors(c, prev).setY(0).normalize();
    const side = new THREE.Vector3(-toward.z, 0, toward.x).multiplyScalar(i % 2 ? 1 : -1);
    const arrive = c.clone().addScaledVector(toward, -ORBIT_R).addScaledVector(side, ORBIT_R * 0.5).setY(28);
    const pass = c.clone().addScaledVector(side, ORBIT_R).setY(21);
    const leave = c.clone().addScaledVector(toward, ORBIT_R * 0.8).addScaledVector(side, ORBIT_R * 0.6).setY(25);
    marks.push({ arrive: pts.length, leave: pts.length + 2 });
    pts.push(arrive, pass, leave);
    prev = leave;
  });
  pts.push(prev.clone().add(new THREE.Vector3(0, 20, -120)));
  return { curve: new THREE.CatmullRomCurve3(pts, false, 'centripetal'), marks, count: pts.length };
}

/** Creates the world on a canvas. Returns { render(film, dt), resize(), setFrame(side) }. */
export function createWorld(canvas) {
  const mobile = Math.min(window.innerWidth, window.innerHeight) < 700;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobile ? 1.5 : 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  // What lies under the water (seabed, island slopes), drawn first so the sea can show it through
  const under = new THREE.WebGLRenderTarget(4, 4, { depthTexture: new THREE.DepthTexture(4, 4), samples: 0 });
  const underScale = mobile ? 0.6 : 1;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xffffff, 260, 1500);
  const camera = new THREE.PerspectiveCamera(55, 1, 1, 6000);

  const sky = makeSky(); scene.add(sky.mesh);
  const ocean = makeOcean(mobile); scene.add(ocean.mesh);
  const stars = makeStars(); scene.add(stars);
  const clouds = makeClouds(); scene.add(clouds.group);

  const hemi = new THREE.HemisphereLight(0xffffff, 0x2a6f8a, 1.2); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 2.2); scene.add(sun, sun.target);
  sun.castShadow = true;
  sun.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 10, far: 700 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.06;
  const moon = new THREE.DirectionalLight(0x8ea8ff, 0); moon.position.set(-200, 300, -400); scene.add(moon);

  const islands = islandBuilders.map((build, i) => {
    const g = build(); g.position.copy(ISLANDS[i]); g.rotation.y = i * 1.7; scene.add(g); return g;
  });

  const bird = createBird(); bird.scale.setScalar(1.15); scene.add(bird);
  bird.traverse((m) => { if (m.isMesh) m.castShadow = true; });
  const route = makeRoute();
  // Landing: after circling Home Port the gull glides down onto the last post of its dock
  islands.forEach((g) => g.updateMatrixWorld(true));
  const perch = islands[6].localToWorld(islands[6].userData.perch.clone()).add(new THREE.Vector3(0, 1.15, 0));
  const LAND_FROM = 7.4;

  const state = { time: 0, camPos: new THREE.Vector3(-30, 140, 190), look: new THREE.Vector3(0, 90, 0), roll: 0, lastTan: new THREE.Vector3(0, 0, -1), frameX: 0, frameY: 0 };
  const sunCol = new THREE.Color(), horCol = new THREE.Color(), topCol = new THREE.Color();

  /** Maps the film position to a point on the route (curve parameter 0..1). */
  function routeParam(film) {
    const n = route.count - 1, m = route.marks;
    if (film <= 1) return THREE.MathUtils.lerp(0, m[0].arrive, ease(film)) / n;
    const i = Math.min(Math.floor(film), 7) - 1; // arrived at island i (0-based)
    const f = film - Math.floor(film);
    if (i >= 6) return (m[6].arrive + Math.min(film - 7, 1) * (m[6].leave - m[6].arrive) * 0.6) / n;
    // first 55%: circle past island i; last 45%: fly on to island i + 1
    if (f < 0.55) return THREE.MathUtils.lerp(m[i].arrive, m[i].leave, f / 0.55) / n;
    return THREE.MathUtils.lerp(m[i].leave, m[i + 1].arrive, ease((f - 0.55) / 0.45)) / n;
  }
  function ease(x) { return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2; }

  /** Sets sky, light and fog for a film position. */
  function applySky(film) {
    const i = Math.min(Math.floor(film), SKIES.length - 1), j = Math.min(i + 1, SKIES.length - 1);
    let t = film - i; t = THREE.MathUtils.smoothstep(t, 0.45, 1);
    const a = SKIES[i], b = SKIES[j];
    mixHex(a.top, b.top, t, topCol); mixHex(a.hor, b.hor, t, horCol); mixHex(a.sun, b.sun, t, sunCol);
    const elev = THREE.MathUtils.lerp(a.elev, b.elev, t), night = THREE.MathUtils.lerp(a.night, b.night, t);
    const az = -0.4 + film * 0.12;
    const dir = new THREE.Vector3(Math.sin(az) * Math.cos(elev), Math.sin(elev), -Math.cos(az) * Math.cos(elev));
    sky.uniforms.top.value.copy(topCol); sky.uniforms.hor.value.copy(horCol); sky.uniforms.sunCol.value.copy(sunCol);
    sky.uniforms.sunDir.value.copy(dir); sky.uniforms.night.value = night;
    const o = ocean.uniforms;
    o.top.value.copy(topCol); o.hor.value.copy(horCol); o.sunCol.value.copy(sunCol);
    o.sunDir.value.copy(dir); o.fogCol.value.copy(horCol); o.night.value = night;
    seabed.sun.value = Math.max(0, Math.sin(elev) + 0.1) * (1 - night);
    scene.fog.color.copy(horCol);
    sun.color.copy(sunCol); sun.intensity = Math.max(0, Math.sin(elev) + 0.15) * 2.6 * (1 - night);
    // Shadows cover the island in view (or the bird at departure)
    const focus = film >= 1 ? ISLANDS[Math.min(Math.floor(film + 0.45), 7) - 1] || ISLANDS[6] : state.look;
    sun.target.position.copy(focus); sun.position.copy(focus).addScaledVector(dir.y > 0.05 ? dir : new THREE.Vector3(0, 1, 0), 300);
    hemi.color.copy(topCol).lerp(new THREE.Color(0xffffff), 0.5); hemi.intensity = 0.55 + (1 - night) * 0.75;
    moon.intensity = night * 0.9;
    stars.material.opacity = Math.max(0, night - 0.1) * 1.1;
    clouds.mats.forEach((m) => { m.color.copy(horCol).lerp(new THREE.Color(0xffffff), 0.6 - night * 0.5); });
    return night;
  }

  /** Draws one frame. film: 0..8, dt: seconds since last frame. */
  function render(film, dt) {
    state.time += dt;
    const night = applySky(film);
    ocean.uniforms.time.value = state.time;
    seabed.time.value = state.time;

    const S = THREE.MathUtils.smoothstep;
    const land = S(film, LAND_FROM, 7.86), legs = S(film, 7.6, 7.78), fold = S(film, 7.86, 7.97);
    const u = routeParam(Math.min(film, LAND_FROM));
    const pos = route.curve.getPoint(u);
    const tan = route.curve.getTangent(Math.min(u + 0.0005, 1)).normalize();
    const seaward = new THREE.Vector3().subVectors(perch, ISLANDS[6]).setY(0).normalize();
    if (land > 0) {
      const dir = new THREE.Vector3().subVectors(perch, pos).setY(0).normalize();
      pos.lerp(perch, land);
      tan.lerp(dir, Math.min(1, land * 3)).setY(0).normalize().lerp(seaward, fold).normalize();
    }
    // Bank into turns: compare heading with last frame's heading.
    const turn = state.lastTan.x * tan.z - state.lastTan.z * tan.x;
    state.roll = THREE.MathUtils.lerp(state.roll, THREE.MathUtils.clamp(-turn * 40, -0.7, 0.7), 0.08) * (1 - land);
    state.lastTan.copy(tan);
    bird.position.copy(pos);
    bird.position.y += Math.sin(state.time * 1.7) * 0.4 * (1 - land);
    bird.lookAt(pos.clone().add(tan));
    bird.rotateZ(state.roll);
    bird.rotateX(-0.55 * legs * (1 - fold)); // flare: nose up, wings braking, just before touchdown
    const cruise = THREE.MathUtils.clamp(0.35 + tan.y * 2.5 + (film < 1 ? 0.3 : 0), 0.08, 1);
    bird.flap(dt, THREE.MathUtils.lerp(cruise, 1, legs), legs, fold);

    // Camera: behind and above the bird; while circling an island, swing out so the island is in shot.
    const local = film - Math.floor(film);
    const near = film >= 7 ? THREE.MathUtils.smoothstep(film - 7, 0, 0.3)
      : film >= 1 ? Math.sin(Math.PI * Math.min(local / 0.55, 1)) : 0;
    const island = film >= 1 ? ISLANDS[Math.min(Math.floor(film), 7) - 1] : null;
    const back = film < 1 ? 26 : 22, up = film < 1 ? 7 : 8;
    const want = pos.clone().addScaledVector(tan, -back).add(new THREE.Vector3(0, up, 0));
    if (island) {
      const out = new THREE.Vector3().subVectors(pos, island).setY(0).normalize();
      want.addScaledVector(out, 18 * near).add(new THREE.Vector3(0, 8 * near, 0));
    }
    const lookAt = pos.clone().addScaledVector(tan, 10);
    if (film < 1) lookAt.y += 8 * (1 - film);
    if (island) lookAt.lerp(island.clone().setY(6), 0.62 * near);
    if (land > 0) { // end on the gull on its post, with the town behind
      const side = new THREE.Vector3(-seaward.z, 0, seaward.x);
      want.lerp(pos.clone().addScaledVector(seaward, 9).addScaledVector(side, 4).add(new THREE.Vector3(0, 2.2, 0)), land);
      lookAt.lerp(pos.clone().lerp(ISLANDS[6].clone().setY(4), 0.12), land);
    }
    const k = 1 - Math.pow(0.0015, dt);
    state.camPos.lerp(want, k);
    state.look.lerp(lookAt, k);
    camera.position.copy(state.camPos);
    camera.lookAt(state.look);

    islands.forEach((g) => g.tick && g.tick(state.time, night));
    clouds.group.children.forEach((c, i) => { c.material.opacity = c.userData.base * (i < 70 ? THREE.MathUtils.clamp(1.4 - film * 1.2, 0, 1) : 1); });
    // Pass 1: everything except sea, sky and clouds into a texture; pass 2: the full scene
    ocean.mesh.position.set(camera.position.x, 0, camera.position.z);
    ocean.mesh.visible = false; sky.mesh.visible = false; clouds.group.visible = false; stars.visible = false;
    // No haze under water (the sea adds its own), so push the fog away for this pass
    const fogNear = scene.fog.near, fogFar = scene.fog.far;
    scene.fog.near = 1e6; scene.fog.far = 2e6;
    renderer.setRenderTarget(under);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    scene.fog.near = fogNear; scene.fog.far = fogFar;
    ocean.mesh.visible = true; sky.mesh.visible = true; clouds.group.visible = true; stars.visible = true;
    renderer.render(scene, camera);
  }

  /** Shifts the view so the subject sits beside the text panel (x, y as fractions of the screen). */
  function setFrame(x, y) { state.frameX = x; state.frameY = y; applyFrame(); }

  /** Offsets the camera's view by the frame fractions. */
  function applyFrame() {
    const w = window.innerWidth, h = window.innerHeight;
    if (state.frameX || state.frameY) camera.setViewOffset(w, h, -w * state.frameX, -h * state.frameY, w, h);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  }

  /** Matches the canvas and camera to the window. */
  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    const buf = renderer.getDrawingBufferSize(new THREE.Vector2());
    under.setSize(Math.round(buf.x * underScale), Math.round(buf.y * underScale));
    ocean.uniforms.res.value.copy(buf);
    ocean.uniforms.tScene.value = under.texture; ocean.uniforms.tDepth.value = under.depthTexture;
    camera.aspect = w / h;
    camera.fov = w < h ? 68 : 55;
    applyFrame();
  }
  resize();
  return { render, resize, setFrame };
}
