/* Site-wide effects (see css/site-fx.css).
   1. Circuit background: a faint grid that wakes up around the cursor, with signal pulses travelling along it.
      Click or tap anywhere to send a burst. Static (drawn once) when the visitor prefers reduced motion.
   2. Scroll progress bar + section rail (scrollspy) + current link in the top nav.
   3. Cursor spotlight on cards, hero tilt.
   4. Hours-saved calculator.
   Exposes window.burstAt(x, y) so other scripts (the demo) can celebrate with the background. */
(function () {
  'use strict';

  var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var coarse = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  var langOf = function () { return (document.documentElement.lang || 'ar').slice(0, 2); };
  var T = function (k) { var p = window.__langPack || {}, l = langOf(); return (p[l] && p[l][k]) || (p.en && p.en[k]) || ''; };

  /* ======================================================================== 1. background */
  (function background() {
    var cv = document.getElementById('fx-bg');
    if (!cv || !cv.getContext) return;
    var ctx = cv.getContext('2d');
    var W = 0, H = 0, G = 56, dpr = 1, cols = 0, rows = 0;
    var mouse = { x: -9999, y: -9999, k: 0, target: 0, last: 0 };
    var pulses = [], rings = [];
    var lastT = 0, spawnIn = 0.6, scrollY = window.scrollY || 0;
    var MAXP = coarse ? 3 : 6;
    var DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      W = window.innerWidth; H = window.innerHeight;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      G = W < 700 ? 44 : 56;
      cols = Math.ceil(W / G) + 2; rows = Math.ceil(H / G) + 3;
      if (reduce) draw(0);
    }
    var offY = function () { return -((scrollY * 0.18) % G); };   // grid drifts slower than the page: a little depth

    function spawn(gx, gy, dir, o) {
      o = o || {};
      pulses.push({ x: gx, y: gy, dir: dir, speed: o.speed || (120 + Math.random() * 70), acc: 0, life: 0, max: o.max || (3.2 + Math.random() * 2.4), turn: o.turn == null ? 0.32 : o.turn, hist: [], ht: 0 });
    }
    function spawnAmbient() {
      var i = 1 + Math.floor(Math.random() * (cols - 3)), j = Math.floor(Math.random() * (rows - 2));
      spawn(i * G, j * G, Math.floor(Math.random() * 4));
    }
    function burst(x, y) {
      var oy = offY();
      var gi = Math.round(x / G), gj = Math.round((y - oy) / G);
      for (var d = 0; d < 4; d++) spawn(gi * G, gj * G, d, { speed: 300, max: 1.5, turn: 0.22 });
      rings.push({ x: x, y: y, t: 0 });
    }
    window.burstAt = function (x, y) { if (!reduce) burst(x, y); };

    function draw(dt) {
      ctx.clearRect(0, 0, W, H);
      var oy = offY(), R = 190;
      // faint dot grid
      ctx.fillStyle = 'rgba(130,160,230,.11)';
      for (var j = -1; j < rows; j++) {
        var y = j * G + oy;
        for (var i = 0; i < cols; i++) ctx.fillRect(i * G - 1, y - 1, 2, 2);
      }
      // cursor: soft glow + lit nodes + lit traces between neighbours
      if (mouse.k > 0.01) {
        var g = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, R * 1.25);
        g.addColorStop(0, 'rgba(255,122,26,' + (0.085 * mouse.k) + ')'); g.addColorStop(1, 'rgba(255,122,26,0)');
        ctx.fillStyle = g; ctx.fillRect(mouse.x - R * 1.3, mouse.y - R * 1.3, R * 2.6, R * 2.6);
        var i0 = Math.max(0, Math.floor((mouse.x - R) / G)), i1 = Math.min(cols, Math.ceil((mouse.x + R) / G));
        var j0 = Math.floor((mouse.y - R - oy) / G), j1 = Math.ceil((mouse.y + R - oy) / G);
        var aAt = function (px, py) { var d = Math.hypot(px - mouse.x, py - mouse.y); return d >= R ? 0 : Math.pow(1 - d / R, 2) * mouse.k; };
        ctx.lineWidth = 1;
        for (var jj = j0; jj <= j1; jj++) {
          for (var ii = i0; ii <= i1; ii++) {
            var px = ii * G, py = jj * G + oy, a = aAt(px, py);
            if (a <= 0.01) continue;
            var ar = aAt(px + G, py), ad = aAt(px, py + G);
            if (ar > 0.01) { ctx.strokeStyle = 'rgba(255,150,70,' + (0.4 * Math.min(a, ar)) + ')'; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + G, py); ctx.stroke(); }
            if (ad > 0.01) { ctx.strokeStyle = 'rgba(255,150,70,' + (0.4 * Math.min(a, ad)) + ')'; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, py + G); ctx.stroke(); }
            ctx.fillStyle = 'rgba(255,170,100,' + (0.18 + a * 0.75) + ')';
            ctx.beginPath(); ctx.arc(px, py, 1 + a * 1.9, 0, 6.2832); ctx.fill();
          }
        }
      }
      // pulses travelling along grid lines
      for (var p = pulses.length - 1; p >= 0; p--) {
        var s = pulses[p];
        s.life += dt;
        if (s.life > s.max) { pulses.splice(p, 1); continue; }
        var step = s.speed * dt;
        s.x += DIRS[s.dir][0] * step; s.y += DIRS[s.dir][1] * step; s.acc += step;
        if (s.acc >= G) {                              // reached a node: snap, maybe turn
          s.acc -= G;
          s.x = Math.round(s.x / G) * G; s.y = Math.round(s.y / G) * G;
          if (Math.random() < s.turn) s.dir = (s.dir + (Math.random() < 0.5 ? 1 : 3)) % 4;
        }
        s.ht += dt;
        if (s.ht > 0.018) { s.ht = 0; s.hist.push(s.x, s.y); if (s.hist.length > 52) s.hist.splice(0, 2); }
        var sy = s.y + oy, fade = Math.min(1, s.life / 0.3) * Math.min(1, (s.max - s.life) / 0.6);
        var n = s.hist.length / 2;
        ctx.lineWidth = 1.6; ctx.lineCap = 'round';
        for (var k = 1; k < n; k++) {
          ctx.strokeStyle = 'rgba(255,140,50,' + ((k / n) * 0.8 * fade) + ')';
          ctx.beginPath(); ctx.moveTo(s.hist[(k - 1) * 2], s.hist[(k - 1) * 2 + 1] + oy); ctx.lineTo(s.hist[k * 2], s.hist[k * 2 + 1] + oy); ctx.stroke();
        }
        ctx.fillStyle = 'rgba(255,122,26,' + (0.18 * fade) + ')'; ctx.beginPath(); ctx.arc(s.x, sy, 7, 0, 6.2832); ctx.fill();
        ctx.fillStyle = 'rgba(255,225,190,' + (0.95 * fade) + ')'; ctx.beginPath(); ctx.arc(s.x, sy, 2.1, 0, 6.2832); ctx.fill();
      }
      // click rings
      for (var r = rings.length - 1; r >= 0; r--) {
        var rg = rings[r]; rg.t += dt;
        if (rg.t > 0.8) { rings.splice(r, 1); continue; }
        var q = rg.t / 0.8;
        ctx.strokeStyle = 'rgba(255,160,92,' + (0.55 * (1 - q)) + ')'; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.arc(rg.x, rg.y, 8 + q * 150, 0, 6.2832); ctx.stroke();
      }
    }

    function frame(now) {
      requestAnimationFrame(frame);
      if (document.hidden) { lastT = now; return; }
      var dt = Math.min(0.05, (now - lastT) / 1000 || 0.016); lastT = now;
      scrollY = window.scrollY || 0;
      // ease the cursor intensity; touch fades out shortly after the finger stops
      var want = mouse.target;
      if (coarse && now - mouse.last > 700) want = 0;
      mouse.k += (want - mouse.k) * Math.min(1, dt * 7);
      spawnIn -= dt;
      if (spawnIn <= 0) { if (pulses.length < MAXP) spawnAmbient(); spawnIn = 1.1 + Math.random() * 1.6; }
      draw(dt);
    }

    window.addEventListener('resize', resize, { passive: true });
    resize();
    if (reduce) return;
    window.addEventListener('pointermove', function (e) {
      mouse.x = e.clientX; mouse.y = e.clientY; mouse.target = 1; mouse.last = performance.now();
    }, { passive: true });
    document.addEventListener('pointerleave', function () { mouse.target = 0; });
    window.addEventListener('blur', function () { mouse.target = 0; });
    window.addEventListener('pointerdown', function (e) {
      mouse.x = e.clientX; mouse.y = e.clientY; mouse.last = performance.now();
      burst(e.clientX, e.clientY);
    }, { passive: true });
    requestAnimationFrame(frame);
  })();

  /* ======================================================================== 2. progress, rail, nav */
  (function progressAndRail() {
    var bar = document.querySelector('#fx-progress i'), rail = document.getElementById('fx-rail');
    var order = ['ai', 'demo', 'speed', 'use-cases', 'features', 'showcase', 'pricing', 'faq'];
    var alias = { demo: 'ai' };
    var links = rail ? Array.prototype.slice.call(rail.querySelectorAll('a[data-sec]')) : [];
    var navLinks = Array.prototype.slice.call(document.querySelectorAll('#nav a[href^="#"]'));
    var queued = false;
    function update() {
      queued = false;
      var y = window.scrollY || 0, max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      if (bar) bar.style.transform = 'scaleX(' + Math.min(1, y / max) + ')';
      var cur = '';
      for (var i = 0; i < order.length; i++) {
        var el = document.getElementById(order[i]);
        if (el && el.getBoundingClientRect().top <= window.innerHeight * 0.4) cur = alias[order[i]] || order[i];
      }
      var feet = document.querySelectorAll('footer'), foot = feet[feet.length - 1], nearEnd = foot && foot.getBoundingClientRect().top < window.innerHeight * 0.6;
      if (rail) rail.classList.toggle('show', y > window.innerHeight * 0.5 && !nearEnd);
      links.forEach(function (a) { a.classList.toggle('on', a.getAttribute('data-sec') === cur); });
      navLinks.forEach(function (a) { var h = a.getAttribute('href').slice(1); a.classList.toggle('fx-cur', h === cur || (cur === 'ai' && h === 'demo')); });
    }
    function queue() { if (!queued) { queued = true; requestAnimationFrame(update); } }
    window.addEventListener('scroll', queue, { passive: true });
    window.addEventListener('resize', queue, { passive: true });
    update();
  })();

  /* ======================================================================== 3. spotlight + tilt */
  (function spotlightAndTilt() {
    var SPOT = '.card-hover, .fb-node, .pricing-popular, .fx-calc';
    document.addEventListener('pointermove', function (e) {
      var el = e.target.closest && e.target.closest(SPOT);
      if (!el) return;
      var r = el.getBoundingClientRect();
      el.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      el.style.setProperty('--my', (e.clientY - r.top) + 'px');
    }, { passive: true });

    if (reduce || coarse) return;
    Array.prototype.forEach.call(document.querySelectorAll('[data-tilt]'), function (el) {
      var host = el.parentElement || el;
      host.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        var nx = (e.clientX - r.left) / r.width - 0.5, ny = (e.clientY - r.top) / r.height - 0.5;
        el.style.transform = 'perspective(1400px) rotateX(' + (-ny * 3).toFixed(2) + 'deg) rotateY(' + (nx * 4).toFixed(2) + 'deg)';
      }, { passive: true });
      host.addEventListener('pointerleave', function () { el.style.transform = ''; });
    });
  })();

  /* ======================================================================== 4. calculator */
  (function calculator() {
    var $ = function (id) { return document.getElementById(id); };
    var docs = $('calc-docs'), mins = $('calc-min');
    if (!docs || !mins) return;
    var shown = { day: 0, month: 0, hand: 0, app: 0 }, anim = 0;
    var fmt = function (n) { var s = (Math.round(n * 10) / 10).toFixed(1); return s.replace(/\.0$/, ''); };

    function fill(inp) { inp.style.setProperty('--p', ((inp.value - inp.min) / (inp.max - inp.min) * 100) + '%'); }
    function target() {
      var d = +docs.value, m = +mins.value;
      var hand = d * m / 60, app = d * 1 / 60;
      return { day: hand - app, month: (hand - app) * 20, hand: hand, app: app, ratio: 1 / m };
    }
    function paint(v) {
      $('calc-day').textContent = fmt(v.day);
      $('calc-month').textContent = Math.round(v.month);
      var h = T('calc.h') || 'h';
      $('calc-hand-v').textContent = fmt(v.hand) + ' ' + h;
      $('calc-app-v').textContent = fmt(v.app) + ' ' + h;
    }
    function update() {
      [docs, mins].forEach(fill);
      $('calc-docs-v').textContent = docs.value;
      $('calc-min-v').textContent = mins.value;
      var t = target();
      $('calc-bar-hand').style.width = '100%';
      $('calc-bar-app').style.width = Math.max(3, t.ratio * 100) + '%';
      if (reduce) { shown = t; paint(t); return; }
      cancelAnimationFrame(anim);
      var from = { day: shown.day, month: shown.month, hand: shown.hand, app: shown.app }, t0 = performance.now();
      (function step(now) {
        var k = Math.min(1, (now - t0) / 380), e = 1 - Math.pow(1 - k, 3);
        shown = { day: from.day + (t.day - from.day) * e, month: from.month + (t.month - from.month) * e, hand: from.hand + (t.hand - from.hand) * e, app: from.app + (t.app - from.app) * e };
        paint(shown);
        if (k < 1) anim = requestAnimationFrame(step);
      })(t0);
    }
    docs.addEventListener('input', update); mins.addEventListener('input', update);
    shown = target(); update();
    window.refreshFxLang = function () { paint(shown); };
  })();
})();
