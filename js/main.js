// Scroll film: turns the page's scroll position into a "film" position (0 = departure, n = island n)
// and drives the 3D world, the text panels, the top bar and the island rail from it.
// Without WebGL, or with reduced motion, the page stays a plain stacked page (no .film class).

const root = document.documentElement;
const beats = Array.from(document.querySelectorAll('.beat'));
const railLinks = Array.from(document.querySelectorAll('.rail a'));
const whereLabel = document.querySelector('.where-label');
const canvas = document.getElementById('world');

/** True when the browser can draw WebGL. */
function hasWebGL() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; }
}

/** Splits each panel heading into words so they can rise in one after another. */
function splitHeadings() {
  document.querySelectorAll('.panel h2, .hero h1').forEach((h) => {
    let i = 0;
    const walk = (node) => {
      Array.from(node.childNodes).forEach((n) => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach((w) => {
            if (!w) return;
            if (/^\s+$/.test(w)) { frag.appendChild(document.createTextNode(w)); return; }
            const s = document.createElement('span'); s.className = 'w'; s.style.setProperty('--i', i++);
            const inner = document.createElement('span'); inner.textContent = w; s.appendChild(inner);
            frag.appendChild(s);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1) walk(n);
      });
    };
    walk(h);
  });
}

/** Reads the film position the scroll asks for: beat index + progress through that beat. */
function targetFilm() {
  const y = window.scrollY, vh = window.innerHeight;
  let film = 0;
  for (let i = 0; i < beats.length; i++) {
    const b = beats[i];
    if (y + 1 < b.offsetTop) break;
    const span = Math.max(1, b.offsetHeight - vh);
    film = i + Math.min(1, (y - b.offsetTop) / span);
  }
  return film;
}

let current = -1;
/** Marks the island in view in the top bar and the rail. */
function setCurrent(i) {
  if (i === current) return;
  current = i;
  railLinks.forEach((a, k) => {
    a.classList.toggle('here', k === i);
    a.classList.toggle('visited', k < i);
    if (k === i) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current');
  });
  const label = beats[i] && beats[i].dataset.label;
  if (!whereLabel || !label) return;
  whereLabel.classList.add('swap');
  setTimeout(() => { whereLabel.textContent = label; whereLabel.classList.remove('swap'); }, 180);
}

/* Between islands a small "next stop" card says where the bird is flying, so some text is always
   on screen: the island's card shows while the bird circles it, then hands over to this card. */
const PANEL_END = 0.7, ARRIVE = 0.97;
let enroute, erName, erKicker, erTeaser, erBar, erTarget = -1;
function makeEnroute() {
  enroute = document.createElement('a');
  enroute.className = 'enroute';
  enroute.innerHTML = '<span class="er-k"></span><strong class="er-name"></strong><span class="er-t"></span><span class="er-bar"><i></i></span>';
  [erKicker, erName, erTeaser, erBar] = ['.er-k', '.er-name', '.er-t', '.er-bar i'].map((q) => enroute.querySelector(q));
  document.body.appendChild(enroute);
}
function setEnroute(next, progress) {
  if (next !== erTarget) {
    erTarget = next;
    const b = beats[next], h = b.querySelector('h2');
    enroute.href = '#' + b.id;
    erKicker.textContent = next === beats.length - 1 ? 'Flying home' : `Next stop · Island ${next} of ${beats.length - 1}`;
    erName.textContent = b.dataset.label;
    erTeaser.textContent = h ? h.textContent.replace(/\s+/g, ' ').trim() : '';
  }
  erBar.style.transform = `scaleX(${Math.max(0.04, Math.min(1, progress)).toFixed(3)})`;
}

/** Shows exactly one thing at every scroll position: the island's card while the bird circles it,
    otherwise the "next stop" card for the island ahead. */
function updatePanels(film) {
  const last = beats.length - 1;
  let i = Math.floor(film + (1 - ARRIVE)), local = film - i;
  i = Math.min(i, last);
  const end = i === 0 ? 0.4 : PANEL_END;
  const panelOn = i === last || local < end;
  beats.forEach((b, k) => b.classList.toggle('on', panelOn && k === i));
  const flying = !panelOn;
  if (flying) setEnroute(i + 1, (local - end) / (ARRIVE - end));
  enroute.classList.toggle('on', flying);
  setCurrent(i);
  root.style.setProperty('--progress', (film / beats.length).toFixed(4));
}

/* Soft snapping: when the visitor stops scrolling partway through a flight, the page glides on to
   the island ahead (or back to the card they left, if they were scrolling up), so it never rests on
   open sea with nothing to read. It waits for fingers to lift and momentum to settle, and never
   fights a visitor who is still scrolling. */
function scrollForFilm(f) {
  const i = Math.min(Math.floor(f), beats.length - 1), b = beats[i];
  return b.offsetTop + Math.max(1, b.offsetHeight - window.innerHeight) * (f - i);
}
function setupSnap() {
  let lastY = window.scrollY, dir = 1, timer = 0, touching = false, gliding = false;
  const settle = () => {
    timer = 0;
    if (touching) return;
    if (gliding) { gliding = false; return; }
    const f = targetFilm(), last = beats.length - 1;
    let i = Math.floor(f + (1 - ARRIVE)); const local = f - i;
    if (i >= last) return;
    const end = i === 0 ? 0.4 : PANEL_END;
    if (local < end) return; // a card is showing
    const ahead = dir > 0 || (local - end) / (ARRIVE - end) > 0.5;
    const to = ahead ? scrollForFilm(i + 1 + 0.02) : scrollForFilm(i + end - 0.08);
    if (Math.abs(to - window.scrollY) < 2) return;
    gliding = true;
    window.scrollTo({ top: Math.round(to), behavior: 'smooth' });
  };
  const arm = (ms) => { clearTimeout(timer); timer = setTimeout(settle, ms); };
  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    if (Math.abs(y - lastY) > 1 && !gliding) dir = y > lastY ? 1 : -1;
    lastY = y;
    arm(gliding ? 160 : 260);
  }, { passive: true });
  window.addEventListener('touchstart', () => { touching = true; gliding = false; clearTimeout(timer); }, { passive: true });
  window.addEventListener('touchend', () => { touching = false; arm(320); }, { passive: true });
  ['wheel', 'keydown', 'mousedown'].forEach((t) => window.addEventListener(t, () => { gliding = false; }, { passive: true }));
}

/* Sound: off until the visitor turns it on; the choice is remembered for their next visit. */
const ICON_ON = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
const ICON_OFF = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16.5 9.5l5 5m0-5l-5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
/** A short silent WAV, played through an <audio> element alongside the Web Audio sound: on iPhone
    this lets the page's sound play even when the ring/silent switch is on silent. */
function silentWav() {
  const n = 4410, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
  const w = (o, str) => { for (let i = 0; i < str.length; i++) v.setUint8(o + i, str.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, 44100, true); v.setUint32(28, 88200, true);
  v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}

async function setupSound() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return { update() {} };
  let on = false, ctx = null, sound = null, keepAlive = null;
  try { on = localStorage.getItem('tw-sound') === 'on'; } catch (e) { /* storage blocked: stay off */ }
  const btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'sound-toggle';
  const show = () => {
    btn.setAttribute('aria-pressed', String(on));
    btn.setAttribute('aria-label', on ? 'Turn sound off' : 'Turn on ocean sounds');
    btn.innerHTML = (on ? ICON_ON : ICON_OFF) + `<span>${on ? 'Sound on' : 'Sound'}</span>`;
  };
  show();
  const contact = document.querySelector('.top-contact');
  contact.parentNode.insertBefore(btn, contact);
  // Fetch the sound code now, so nothing needs to load (and the tap isn't "used up") when it's pressed
  const modP = import('./sound.js');

  /** Runs inside the tap itself: browsers (Safari especially) only let sound start here. */
  function unlock() {
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { /* older Safari */ }
    if (!ctx) ctx = new AC();
    if (ctx.state !== 'running') ctx.resume();
    const blip = ctx.createBufferSource(); blip.buffer = ctx.createBuffer(1, 1, 22050); blip.connect(ctx.destination); blip.start(0);
    if (!keepAlive) { keepAlive = new Audio(silentWav()); keepAlive.loop = true; keepAlive.setAttribute('playsinline', ''); }
    keepAlive.play().catch(() => {});
  }
  async function apply() {
    if (on) unlock();
    else if (keepAlive) keepAlive.pause();
    if (!ctx) return;
    if (!sound) sound = (await modP).createSound(ctx);
    sound.setOn(on);
  }
  btn.addEventListener('click', () => {
    on = !on; show();
    try { localStorage.setItem('tw-sound', on ? 'on' : 'off'); } catch (e) { /* not remembered */ }
    apply();
  });
  if (on) { // remembered as on: sound can only start with a tap or key press, so start on the first one
    const events = ['click', 'touchend', 'keydown'];
    const start = (e) => {
      if (e.target.closest && e.target.closest('.sound-toggle')) return;
      events.forEach((t) => window.removeEventListener(t, start, true));
      if (on) apply();
    };
    events.forEach((t) => window.addEventListener(t, start, true));
  }
  // Silence while the tab is hidden, so it never plays in the background
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) { ctx.suspend(); if (keepAlive) keepAlive.pause(); }
    else if (on) { ctx.resume(); if (keepAlive) keepAlive.play().catch(() => {}); }
  });
  return { update: (film) => { if (sound && ctx.state === 'running') sound.update(film); } };
}

/** Where the subject should sit: right of the text on wide screens; on phones above the card,
    except at departure, where the bird flies below the headline. Eased toward every frame. */
const frame = { x: 0, y: 0 };
function frameFor(world, film, k) {
  const wide = window.innerWidth >= 900;
  const hero = Math.max(0, 1 - film * 1.6);
  const tx = wide ? 0.17 * (1 - hero) : 0;
  const ty = wide ? 0 : 0.06 * hero - 0.17 * (1 - hero);
  frame.x += (tx - frame.x) * k; frame.y += (ty - frame.y) * k;
  world.setFrame(frame.x, frame.y);
}

async function startFilm() {
  root.classList.add('film');
  splitHeadings();
  makeEnroute();
  let world;
  try {
    const mod = await import('./world.js');
    world = mod.createWorld(canvas);
  } catch (e) {
    root.classList.remove('film');
    return;
  }
  window.addEventListener('resize', () => { world.resize(); });
  setupSnap();
  const sound = await setupSound();
  let film = targetFilm(), last = performance.now(), first = true;
  const loop = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const want = targetFilm();
    film += (want - film) * (1 - Math.exp(-dt * 5)); // smooth, unhurried catch-up like a camera on rails
    if (Math.abs(want - film) < 0.0005) film = want;
    frameFor(world, film, first ? 1 : 1 - Math.exp(-dt * 4));
    world.render(film, dt);
    sound.update(film);
    updatePanels(film);
    if (first) { first = false; root.classList.add('ready'); }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (!reduce && hasWebGL() && canvas) startFilm();
