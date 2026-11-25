/* TripWright landing page: scroll-driven journey between islands.
   - blends the sky colours between the island you're leaving and the next one
   - flies a paper plane along the dotted route between islands
   - marks the current island in the top bar and the island rail
   Everything is optional decoration: the page reads fine without this script. */
(function () {
  'use strict';

  var doc = document.documentElement;
  doc.classList.add('js');

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var stops = Array.prototype.slice.call(document.querySelectorAll('.stop'));
  var passages = Array.prototype.slice.call(document.querySelectorAll('.passage'));
  var railLinks = Array.prototype.slice.call(document.querySelectorAll('.rail a'));
  var whereLabel = document.querySelector('.where-label');
  var sky = document.querySelector('.sky');

  /** Turns "#rrggbb" into [r, g, b]. */
  function hexToRgb(hex) {
    var n = parseInt(hex.replace('#', ''), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  /** Mixes two [r, g, b] colours; t = 0 gives a, t = 1 gives b. */
  function mix(a, b, t) {
    return 'rgb(' + a.map(function (v, i) { return Math.round(v + (b[i] - v) * t); }).join(',') + ')';
  }

  // Each island's sky: top colour, bottom colour, and how much night (stars) it has.
  var palettes = stops.map(function (el) {
    var c = el.getAttribute('data-sky').split(',');
    return { a: hexToRgb(c[0]), b: hexToRgb(c[1]), night: parseFloat(el.getAttribute('data-night')) || 0 };
  });

  // Passages: measure each route once so the plane can follow it.
  var routes = passages.map(function (el) {
    var path = el.querySelector('.route-done');
    var len = path.getTotalLength();
    return { el: el, path: path, len: len, plane: el.querySelector('.passage-plane'), svg: el.querySelector('svg') };
  });

  var current = -1;

  /** Shows the name of the island in view, with a small fade. */
  function setCurrent(i) {
    if (i === current) return;
    current = i;
    railLinks.forEach(function (a, k) {
      a.classList.toggle('here', k === i);
      a.classList.toggle('visited', k < i);
      if (k === i) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current');
    });
    if (!whereLabel) return;
    var label = stops[i].getAttribute('data-label');
    if (reduceMotion) { whereLabel.textContent = label; return; }
    whereLabel.classList.add('swap');
    setTimeout(function () { whereLabel.textContent = label; whereLabel.classList.remove('swap'); }, 180);
  }

  /** Places a passage's plane on its route at progress p (0..1), pointing along the path. */
  function flyPlane(r, p) {
    r.el.style.setProperty('--p', p.toFixed(3));
    var box = r.svg.getBoundingClientRect();
    var vb = r.svg.viewBox.baseVal;
    var sx = box.width / vb.width, sy = box.height / vb.height;
    var at = r.path.getPointAtLength(r.len * p);
    var ahead = r.path.getPointAtLength(Math.min(r.len, r.len * p + 2));
    var behind = r.path.getPointAtLength(Math.max(0, r.len * p - 2));
    var angle = Math.atan2((ahead.y - behind.y) * sy, (ahead.x - behind.x) * sx) * 180 / Math.PI;
    r.plane.style.transform = 'translate(' + (at.x * sx).toFixed(1) + 'px,' + (at.y * sy).toFixed(1) + 'px) rotate(' + angle.toFixed(1) + 'deg)';
    r.plane.style.opacity = p <= 0.001 || p >= 0.999 ? '0.35' : '1';
  }

  /** Runs on every scroll frame: sky, progress, current island, planes. */
  function update() {
    ticking = false;
    var vh = window.innerHeight;
    var mid = vh * 0.55;

    // Which two islands is the middle of the screen between?
    var i = 0;
    for (var k = 0; k < stops.length; k++) {
      if (stops[k].getBoundingClientRect().top <= mid) i = k;
    }
    var t = 0;
    if (i < stops.length - 1) {
      var a = stops[i].getBoundingClientRect();
      var nextTop = stops[i + 1].getBoundingClientRect().top;
      // Start blending in the last stretch before the next island arrives.
      var span = Math.max(1, nextTop - (a.top + a.height * 0.45));
      t = Math.min(1, Math.max(0, (mid - (a.top + a.height * 0.45)) / span));
    }
    var from = palettes[i], to = palettes[Math.min(i + 1, palettes.length - 1)];
    sky.style.setProperty('--sky-a', mix(from.a, to.a, t));
    sky.style.setProperty('--sky-b', mix(from.b, to.b, t));
    sky.style.setProperty('--night', (from.night + (to.night - from.night) * t).toFixed(3));
    setCurrent(t > 0.5 && i < stops.length - 1 ? i + 1 : i);

    var max = doc.scrollHeight - vh;
    doc.style.setProperty('--progress', max > 0 ? Math.min(1, window.scrollY / max).toFixed(4) : '0');

    routes.forEach(function (r) {
      var box = r.el.getBoundingClientRect();
      if (box.bottom < -50 || box.top > vh + 50) return;
      // 0 when the passage enters at the bottom, 1 when it reaches the upper third.
      var p = (vh - box.top) / (vh * 0.67 + box.height * 0.2);
      flyPlane(r, Math.min(1, Math.max(0, p)));
    });
  }

  var ticking = false;
  function onScroll() {
    if (!ticking) { ticking = true; window.requestAnimationFrame(update); }
  }

  // Islands rise from the sea the first time they come into view.
  if ('IntersectionObserver' in window && !reduceMotion) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('arrived'); io.unobserve(e.target); }
      });
    }, { threshold: 0.18 });
    stops.forEach(function (s) { io.observe(s); });
  } else {
    stops.forEach(function (s) { s.classList.add('arrived'); });
  }

  if (reduceMotion) {
    // Show the whole route with the plane at its destination; no scroll animation of the planes.
    routes.forEach(function (r) { flyPlane(r, 1); });
    routes = [];
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  update();
})();
