/* Node board: Source (Word) + Prompt (rules) -> AI model -> TemplateFlow output -> live demo.

   - Everything shown in the nodes is derived from window.__demoParts (demo/templates/*.html), so editing a
     template and running `node scripts/build-demo.mjs` updates the source text, the generated TemplateFlow
     and the field stats automatically.
   - The lines are an SVG layer (#fb-svg) re-drawn from the real position of every port, so they follow the
     layout in LTR, RTL and on mobile (single column).
   - Delivery uses window.__demo (exposed by js/demo.js): the demo switches template only when the packets land.
*/
(function () {
  'use strict';

  var PARTS = window.__demoParts;
  var DEMO = window.__demo;
  var board = document.getElementById('flowboard');
  if (!PARTS || !PARTS.length || !board) return;

  var SVGNS = 'http://www.w3.org/2000/svg';
  var $ = function (id) { return document.getElementById(id); };
  var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var stackedMQ = window.matchMedia('(max-width: 1023px)');

  var els = {
    svg: $('fb-svg'), edges: $('fb-edges'), pads: $('fb-pads'), pk: $('fb-pk'),
    src: $('fb-src'), tabs: $('fb-src-tabs'), paper: $('fb-paper'), beam: $('fb-beam'), file: $('fb-src-file'), blanks: $('fb-blanks'),
    prompt: $('fb-prompt'), rules: $('fb-rules'),
    model: $('fb-model'), status: $('fb-status'), barFill: $('fb-bar-fill'), tokIn: $('fb-tok-in'), tokOut: $('fb-tok-out'),
    go: $('fb-go'), goT: $('fb-go-t'),
    out: $('fb-out'), outFile: $('fb-out-file'), meta: $('fb-meta'), code: $('fb-code'), stats: $('fb-stats'),
    demo: $('fb-demo'), demoLinkBox: $('fb-demo-linkbox'), demoLed: $('fb-demo-led'), demoLink: $('fb-demo-link'), demoFile: $('fb-demo-file'),
    panel: $('dm-panel-host'), paperWrap: $('dm-paper-wrap')
  };

  /* ---------------------------------------------------------------- i18n + helpers */
  function langOf() { return (document.documentElement.lang || 'ar').slice(0, 2); }
  function T(key) {
    var p = window.__langPack || {}, l = langOf();
    return (p[l] && p[l][key]) || (p.en && p.en[key]) || '';
  }
  function tplName(t) { var l = langOf(); return (l === 'en' ? t.nameEn : l === 'fr' ? t.nameFr : t.nameAr) || t.nameEn; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function svgEl(name, attrs) {
    var n = document.createElementNS(SVGNS, name);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }

  /* ---------------------------------------------------------------- template -> text views */
  // Plain lines of the template, one per paragraph, loop markers on their own line.
  function flowLines(t) {
    var s = t.template
      .replace(/\{\{#each\s+(\w+)\}\}/g, '\n{{#each $1}}\n')
      .replace(/\{\{\/each\}\}/g, '\n{{/each}}\n')
      .replace(/&nbsp;/g, ' ')
      .replace(/<\/p>/g, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    return s.split('\n').map(function (x) { return x.replace(/\s+/g, ' ').trim(); }).filter(Boolean);
  }
  // The same document as the user would have it in Word: every placeholder is just a blank.
  function sourceLines(lines) {
    return lines
      .filter(function (l) { return !/^\{\{[#\/]each/.test(l); })
      .map(function (l) {
        return l.replace(/\{\{#if[^}]*\}\}|\{\{\/if\}\}/g, '').replace(/\{\{[^}]+\}\}/g, '\u0001');
      });
  }
  function segs(line) {
    return line.split(/(\{\{[^}]+\}\})/).filter(Boolean).map(function (v) {
      return /^\{\{/.test(v) ? { k: 'tok', v: v } : { k: 'txt', v: v };
    });
  }
  function tokInner(v) {
    var inner = v.slice(2, -2).trim(), m;
    var B1 = '<span class="tf-b">{{</span>', B2 = '<span class="tf-b">}}</span>';
    if ((m = inner.match(/^#(each|if)\s+(.+)$/))) return B1 + '<span class="tf-k">#' + m[1] + '</span> <span class="tf-n">' + esc(m[2]) + '</span>' + B2;
    if (inner.charAt(0) === '/') return B1 + '<span class="tf-k">' + esc(inner) + '</span>' + B2;
    m = inner.match(/^([\w.]+)(?::([A-Za-z]+)(!)?)?(\|[\s\S]+)?$/);
    if (!m) return esc(v);
    return B1 + '<span class="tf-n">' + esc(m[1]) + '</span>' +
      (m[2] ? '<span class="tf-b">:</span><span class="tf-t">' + esc(m[2]) + '</span>' : '') +
      (m[3] ? '<span class="tf-r">!</span>' : '') +
      (m[4] ? '<span class="tf-o">' + esc(m[4]) + '</span>' : '') + B2;
  }
  function statsOf(t) {
    var loops = t.loops || [];
    return {
      fields: t.fields.length + loops.reduce(function (n, l) { return n + l.fields.length; }, 0),
      required: t.required.length,
      dates: t.dates.length + loops.reduce(function (n, l) { return n + l.fields.filter(function (f) { return f.type === 'date'; }).length; }, 0),
      loops: loops.length
    };
  }
  function ruleUse(t) {
    return [true, true, true, t.required.length > 0, /\|default=/.test(t.template), !!(t.loops && t.loops.length), true];
  }
  function charCount(t) { return flowLines(t).join('').length; }

  /* ---------------------------------------------------------------- state */
  var cur = null;            // template id shown in the nodes
  var running = false, hasRun = false, started = false;
  var chosen = false, pickShown = false, pickDismissed = false;
  var runId = 0, phaseKey = 'idle', lastStats = null, blankCount = 0, demoLinked = false;
  var CANCEL = {};
  function sleep(ms, id) { return new Promise(function (res, rej) { setTimeout(function () { id === runId ? res() : rej(CANCEL); }, ms); }); }
  function partOf(id) { return PARTS.filter(function (p) { return p.id === id; })[0] || PARTS[0]; }

  /* ---------------------------------------------------------------- rendering of node contents */
  function renderTabs() {
    els.tabs.setAttribute('aria-label', T('ai.flow.src.pick'));
    els.tabs.innerHTML = PARTS.map(function (p) {
      return '<button type="button" class="fb-tab" data-tpl="' + p.id + '" aria-pressed="' + (p.id === cur) + '">' + esc(tplName(p)) + '</button>';
    }).join('');
  }
  function renderSource(t) {
    els.paper.innerHTML = sourceLines(flowLines(t)).map(function (l, i) {
      var body = esc(l).replace(/\u0001/g, '<span class="fb-blank"></span>');
      return i === 0 ? '<p class="t">' + body + '</p>' : '<p>' + body + '</p>';
    }).join('');
  }
  function renderMeta(t) {
    var font = (t.template.match(/font-family:\s*([A-Za-z ]+?)[;"]/) || [])[1] || 'Cairo';
    var dir = (t.template.match(/direction:\s*(rtl|ltr)/) || [])[1] || 'rtl';
    els.meta.innerHTML = '<span>' + esc(font) + '</span><span>' + dir.toUpperCase() + '</span><span>A4</span>';
  }
  function renderStats(st) {
    lastStats = st;
    if (!st) { els.stats.innerHTML = ''; return; }
    var parts = [['fields', st.fields], ['required', st.required], ['dates', st.dates], ['loops', st.loops]];
    els.stats.innerHTML = parts.filter(function (x) { return x[1] > 0; }).map(function (x) {
      return '<span class="fb-stat"><b>' + x[1] + '</b>' + esc(T('ai.flow.stat.' + x[0])) + '</span>';
    }).join('');
  }
  function markRules(t, lit) {
    var use = t ? ruleUse(t) : [];
    Array.prototype.forEach.call(els.rules.children, function (li, i) {
      li.classList.toggle('use', !!use[i]);
      li.classList.toggle('read', !!(lit && use[i]));
    });
  }
  // which {{#each X}} block (if any) every line belongs to, so loop fields can be linked to their loop card
  function lineLoops(lines) {
    var cur = null;
    return lines.map(function (l) {
      var m = l.match(/^\{\{#each\s+(\w+)\}\}$/);
      if (m) { cur = m[1]; return null; }
      if (/^\{\{\/each\}\}$/.test(l)) { cur = null; return null; }
      return cur;
    });
  }
  function tokEl(v, loop, animate) {
    var w = document.createElement('span');
    w.className = 'tok' + (animate ? ' new' : '');
    w.innerHTML = tokInner(v);
    var inner = v.slice(2, -2).trim(), m = inner.match(/^([\w.]+)(?::([A-Za-z]+)(!)?)?/), c0 = inner.charAt(0);
    if (m && c0 !== '#' && c0 !== '/') {
      w.setAttribute('data-f', m[1]);
      if (loop) w.setAttribute('data-loop', loop);
      w.tabIndex = 0; w.setAttribute('role', 'button');
      w.title = m[1] + (m[2] ? ' \u00b7 ' + m[2] : '') + (m[3] ? ' \u00b7 ' + T('ai.flow.tok.required') : '') + ' \u2014 ' + T('ai.flow.tok.jump');
    }
    return w;
  }
  function codeRow(line, animate, loop) {
    var row = document.createElement('div');
    row.className = 'fb-line';
    segs(line).forEach(function (s) {
      if (s.k === 'txt') { var x = document.createElement('span'); x.className = 'tx'; x.textContent = s.v; row.appendChild(x); return; }
      row.appendChild(tokEl(s.v, loop, animate));
    });
    return row;
  }
  function renderCodeFull(t) {
    els.code.innerHTML = '';
    var lines = flowLines(t), lp = lineLoops(lines);
    lines.forEach(function (l, i) { els.code.appendChild(codeRow(l, false, lp[i])); });
    els.code.classList.add('done');
    els.code.scrollTop = 0;
    updateCounts(t);
  }
  function renderWait() {
    els.code.classList.remove('done');
    els.code.innerHTML = '<div class="fb-wait">' + esc(T('ai.flow.out.wait')) + '<span class="fb-caret"></span></div>';
  }
  function prepare(t) {
    cur = t.id;
    renderTabs();
    els.file.textContent = t.id + '.docx';
    els.outFile.textContent = t.id + '.tflow';
    renderSource(t);
    markRules(t, false);
    renderMeta(t);
  }

  /* ---------------------------------------------------------------- small state setters */
  function nodeOn(n, on) { n.classList.toggle('on', !!on); }
  function phase(name) {
    phaseKey = name;
    els.model.setAttribute('data-phase', name);
    els.status.textContent = T('ai.flow.phase.' + name);
  }
  function bar(p) { els.barFill.style.width = Math.max(0, Math.min(100, p)) + '%'; }
  function syncBtn() {
    els.go.disabled = running;
    var key = !cur ? 'ai.flow.pick.open' : hasRun ? 'ai.flow.model.again' : 'ai.flow.model.go';
    els.goT.setAttribute('data-i18n', key);
    els.goT.textContent = T(key);
  }
  function setDemoLink(on, t) {
    demoLinked = !!on;
    els.demoLed.classList.toggle('ok', demoLinked);
    els.demoLinkBox.classList.toggle('ok', demoLinked);
    var key = demoLinked ? 'ai.flow.demo.got' : 'ai.flow.demo.wait';
    els.demoLink.setAttribute('data-i18n', key);
    els.demoLink.textContent = T(key);
    els.demoFile.textContent = demoLinked && t ? t.id + '.tflow' : '';
  }
  function countTo(el, to, ms, id) {
    var t0 = performance.now();
    (function step(now) {
      if (id !== runId) return;
      var k = Math.min(1, (now - t0) / ms);
      el.textContent = Math.round(to * k);
      if (k < 1) requestAnimationFrame(step);
    })(t0);
  }

  /* ---------------------------------------------------------------- edges (circuit traces) */
  var EDGE_IDS = ['e1', 'e2', 'e3', 'e4', 'e5', 'e6'];
  var EDGE_LABEL = { e1: 'ai.flow.edge.doc', e2: 'ai.flow.edge.rules', e3: null, e4: 'ai.flow.edge.tpl', e5: 'ai.flow.edge.fields', e6: 'ai.flow.edge.preview' };
  var edges = {};
  EDGE_IDS.forEach(function (id) {
    var g = svgEl('g', { 'class': 'fe', 'data-s': 'idle' });
    var base = svgEl('path', { 'class': 'fe-base' }), hot = svgEl('path', { 'class': 'fe-hot' }), dots = svgEl('path', { 'class': 'fe-dots' });
    var label = svgEl('g', { 'class': 'fe-label' }), rect = svgEl('rect', { rx: 9, ry: 9, height: 18, y: -9 }), text = svgEl('text', {});
    label.appendChild(rect); label.appendChild(text);
    g.appendChild(base); g.appendChild(hot); g.appendChild(dots); g.appendChild(label);
    els.edges.appendChild(g);
    edges[id] = { id: id, g: g, base: base, hot: hot, dots: dots, label: label, rect: rect, text: text, ends: [] };
  });
  // arrival pads drawn on the demo's own panels (SVG, so they can sit just outside those elements)
  ['pad-panel', 'pad-paper', 'pad-panel-out'].forEach(function (name) {
    var g = svgEl('g', { 'class': 'fe-pad', 'data-port': name });
    g.appendChild(svgEl('circle', { 'class': 'pp', r: 6 }));
    g.appendChild(svgEl('circle', { 'class': 'pq', r: 2.6 }));
    els.pads.appendChild(g);
  });
  function portEl(name) { return board.querySelector('[data-port="' + name + '"]'); }

  function vPath(a, b, midT) {              // down, across, down (rounded corners)
    var my = a.y + (b.y - a.y) * midT, dx = b.x - a.x;
    if (Math.abs(dx) < 1.5) return 'M' + a.x + ' ' + a.y + 'L' + b.x + ' ' + b.y;
    var d = dx > 0 ? 1 : -1, r = Math.max(0, Math.min(14, Math.abs(dx) / 2, my - a.y, b.y - my));
    return 'M' + a.x + ' ' + a.y + 'V' + (my - r) + 'Q' + a.x + ' ' + my + ' ' + (a.x + d * r) + ' ' + my +
      'H' + (b.x - d * r) + 'Q' + b.x + ' ' + my + ' ' + b.x + ' ' + (my + r) + 'V' + b.y;
  }
  function hPath(a, b) {                    // sideways, with a small jog if the ports are not level
    var dy = b.y - a.y;
    if (Math.abs(dy) < 1.5) return 'M' + a.x + ' ' + a.y + 'L' + b.x + ' ' + b.y;
    var mx = (a.x + b.x) / 2, sx = b.x > a.x ? 1 : -1, sy = dy > 0 ? 1 : -1;
    var r = Math.max(0, Math.min(14, Math.abs(dy) / 2, Math.abs(b.x - a.x) / 2));
    return 'M' + a.x + ' ' + a.y + 'H' + (mx - sx * r) + 'Q' + mx + ' ' + a.y + ' ' + mx + ' ' + (a.y + sy * r) +
      'V' + (b.y - sy * r) + 'Q' + mx + ' ' + b.y + ' ' + (mx + sx * r) + ' ' + b.y + 'H' + b.x;
  }

  function setEdge(id, state) {
    var e = edges[id];
    e.g.setAttribute('data-s', state);
    syncPorts();
  }
  function syncPorts() {
    Array.prototype.forEach.call(board.querySelectorAll('[data-port].hot'), function (p) { p.classList.remove('hot'); });
    EDGE_IDS.forEach(function (id) {
      var e = edges[id];
      if (e.g.getAttribute('data-s') === 'idle') return;
      e.ends.forEach(function (n) { var p = portEl(n); if (p) p.classList.add('hot'); });
    });
  }

  var layoutQueued = 0;
  function scheduleLayout() {
    if (layoutQueued) return;
    layoutQueued = requestAnimationFrame(function () { layoutQueued = 0; try { layout(); } catch (err) { console.error('flow layout', err); } });
  }
  function layout() {
    var bb = board.getBoundingClientRect();
    if (!bb.width) return;
    els.svg.setAttribute('width', bb.width);
    els.svg.setAttribute('height', bb.height);
    var stacked = stackedMQ.matches;

    // demo node: its two outgoing ports sit above the panel and the paper they feed
    var dn = els.demo.getBoundingClientRect(), pr = els.panel.getBoundingClientRect(), pw = els.paperWrap.getBoundingClientRect();
    var panelCx = pr.left + pr.width / 2, paperCx = pw.left + pw.width / 2;
    var clampX = function (x) { return Math.min(Math.max(x, dn.left + 30), dn.right - 30) - dn.left; };
    var outA = portEl('demo-out-a'), outB = portEl('demo-out-b');
    outA.style.left = (stacked ? dn.width / 2 : clampX(panelCx)) - 6 + 'px';
    outB.style.left = (clampX(paperCx)) - 6 + 'px';
    outB.style.display = stacked ? 'none' : '';

    var C = function (name) {
      var r = portEl(name).getBoundingClientRect();
      return { x: r.left + r.width / 2 - bb.left, y: r.top + r.height / 2 - bb.top };
    };
    var panelIn = { x: panelCx - bb.left, y: pr.top - bb.top - 9 };
    var paperIn = { x: paperCx - bb.left, y: pw.top - bb.top - 9 };
    var panelOut = { x: panelCx - bb.left, y: pr.bottom - bb.top + 9 };
    var put = function (name, p, show) {
      var g = els.pads.querySelector('[data-port="' + name + '"]');
      g.setAttribute('transform', 'translate(' + p.x + ',' + p.y + ')');
      g.style.display = show ? '' : 'none';
    };
    put('pad-panel', panelIn, true);
    put('pad-paper', paperIn, true);
    put('pad-panel-out', panelOut, stacked);

    var set = function (id, d, ends) {
      var e = edges[id];
      e.base.setAttribute('d', d); e.hot.setAttribute('d', d); e.dots.setAttribute('d', d);
      e.ends = ends;
    };
    if (!stacked) {
      var s = [{ id: 'e1', n: 'src-out' }, { id: 'e2', n: 'prompt-out' }].map(function (o) { o.p = C(o.n); return o; }).sort(function (a, b) { return a.p.x - b.p.x; });
      var pads = ['model-in-a', 'model-in-b'].map(function (n) { return { n: n, p: C(n) }; }).sort(function (a, b) { return a.p.x - b.p.x; });
      var near = Math.abs(s[0].p.x - pads[0].p.x) <= Math.abs(s[1].p.x - pads[1].p.x) ? 0 : 1;
      s.forEach(function (o, i) { set(o.id, vPath(o.p, pads[i].p, i === near ? 0.3 : 0.68), [o.n, pads[i].n]); });
      set('e3', hPath(C('model-out-h'), C('out-in-h')), ['model-out-h', 'out-in-h']);
      set('e5', vPath(C('demo-out-a'), panelIn, 0.5), ['demo-out-a', 'pad-panel']);
      set('e6', vPath(C('demo-out-b'), paperIn, 0.5), ['demo-out-b', 'pad-paper']);
    } else {
      set('e1', vPath(C('src-out'), C('prompt-in'), 0.5), ['src-out', 'prompt-in']);
      set('e2', vPath(C('prompt-out'), C('model-in-a'), 0.5), ['prompt-out', 'model-in-a']);
      set('e3', vPath(C('model-out-v'), C('out-in-v'), 0.5), ['model-out-v', 'out-in-v']);
      set('e5', vPath(C('demo-out-a'), panelIn, 0.5), ['demo-out-a', 'pad-panel']);
      set('e6', vPath(panelOut, paperIn, 0.5), ['pad-panel-out', 'pad-paper']);
    }
    set('e4', vPath(C('out-out'), C('demo-in'), 0.5), ['out-out', 'demo-in']);

    // labels sit on the middle of each trace and cut it
    EDGE_IDS.forEach(function (id) {
      var e = edges[id], key = EDGE_LABEL[id];
      if (!key) { e.label.style.display = 'none'; return; }
      e.label.style.display = '';
      e.text.textContent = T(key);
      var len = e.base.getTotalLength(), m = e.base.getPointAtLength(len / 2);
      var w = 0;
      try { w = e.text.getComputedTextLength(); } catch (err) { /* hidden */ }
      if (!w) w = e.text.textContent.length * 6.2;
      e.rect.setAttribute('width', w + 16); e.rect.setAttribute('x', -(w + 16) / 2);
      e.label.setAttribute('transform', 'translate(' + m.x + ',' + m.y + ')');
    });
    syncPorts();
  }

  /* ---------------------------------------------------------------- packets travelling along the traces */
  var packets = [], raf = 0;
  function sendPacket(id, o) {
    o = o || {};
    return new Promise(function (res) {
      var e = edges[id];
      if (!e || !e.base.getAttribute('d')) { res(false); return; }
      var g = svgEl('g', {}), tr = svgEl('circle', { 'class': 'pk-t', r: 5 }), hd = svgEl('circle', { 'class': 'pk', r: 2.6 });
      g.style.opacity = '0'; g.appendChild(tr); g.appendChild(hd); els.pk.appendChild(g);
      packets.push({ e: e, g: g, tr: tr, hd: hd, t0: performance.now() + (o.delay || 0), dur: o.dur || 850, res: res, run: o.run });
      if (!raf) raf = requestAnimationFrame(frame);
    });
  }
  function frame(now) {
    packets = packets.filter(function (p) {
      if (p.run !== runId) { p.g.remove(); p.res(false); return false; }
      var t = (now - p.t0) / p.dur;
      if (t < 0) return true;
      if (t >= 1) { p.g.remove(); p.res(true); return false; }
      var L = p.e.base.getTotalLength(), k = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      var a = p.e.base.getPointAtLength(L * k), b = p.e.base.getPointAtLength(Math.max(0, L * k - 16));
      p.hd.setAttribute('cx', a.x); p.hd.setAttribute('cy', a.y);
      p.tr.setAttribute('cx', b.x); p.tr.setAttribute('cy', b.y);
      p.g.style.opacity = '1';
      return true;
    });
    raf = packets.length ? requestAnimationFrame(frame) : 0;
  }

  /* ---------------------------------------------------------------- pipeline steps */
  function reset() {
    packets.forEach(function (p) { p.g.remove(); p.res(false); });
    packets = [];
    EDGE_IDS.forEach(function (id) { edges[id].g.setAttribute('data-s', 'idle'); });
    syncPorts();
    [els.src, els.prompt, els.model, els.out, els.demo].forEach(function (n) { nodeOn(n, false); });
    Array.prototype.forEach.call(els.rules.children, function (li) { li.classList.remove('read'); });
    els.beam.style.transition = 'none'; els.beam.style.opacity = '0';
    els.blanks.hidden = true;
    bar(0); els.tokIn.textContent = '0'; els.tokOut.textContent = '0';
    renderWait(); renderStats(null); clearCounts(); setPin(null);
    phase('idle');
  }

  function scan(id, dur) {
    var wrap = els.paper.parentElement, wr = wrap.getBoundingClientRect(), H = wr.height;
    var blanks = Array.prototype.slice.call(els.paper.querySelectorAll('.fb-blank'));
    els.beam.style.transition = 'none'; els.beam.style.opacity = '1'; els.beam.style.transform = 'translateY(-100%)';
    void els.beam.offsetWidth;
    els.beam.style.transition = 'transform ' + dur + 'ms linear, opacity .4s ease ' + dur + 'ms';
    els.beam.style.transform = 'translateY(' + (H - 48) + 'px)';
    setTimeout(function () { if (id === runId) els.beam.style.opacity = '0'; }, dur + 40);
    blanks.forEach(function (b) {
      var y = b.getBoundingClientRect().bottom - wr.top;
      setTimeout(function () { if (id === runId) b.classList.add('hit'); }, Math.max(0, Math.min(1, y / H)) * dur);
    });
    blankCount = blanks.length;
    setTimeout(function () {
      if (id !== runId) return;
      els.blanks.hidden = false;
      els.blanks.textContent = blankCount + ' ' + T('ai.flow.src.blanks');
    }, dur);
  }
  function lightRules(id, S) {
    (async function () {
      var items = Array.prototype.slice.call(els.rules.children);
      for (var i = 0; i < items.length; i++) {
        if (!items[i].classList.contains('use')) continue;
        await S(150);
        items[i].classList.add('read');
      }
    })().catch(function () { /* cancelled */ });
  }

  async function typeFlow(t, S, onProgress) {
    var lines = flowLines(t), lp = lineLoops(lines), el = els.code;
    el.innerHTML = ''; el.classList.remove('done'); el.scrollTop = 0;
    var caret = document.createElement('span'); caret.className = 'fb-caret';
    var total = 0;
    lines.forEach(function (l) { segs(l).forEach(function (s) { total += s.k === 'txt' ? s.v.length : 8; }); });
    var dur = Math.min(3600, Math.max(2300, total * 3.4)), tick = 34, per = Math.max(1, Math.ceil(total / (dur / tick)));
    var done = 0, acc = 0;
    async function pace(cost) {
      acc += cost; done += cost; onProgress(Math.min(1, done / total));
      while (acc >= per) { acc -= per; await S(tick); }
    }
    for (var li = 0; li < lines.length; li++) {
      var row = document.createElement('div'); row.className = 'fb-line'; el.appendChild(row);
      var ss = segs(lines[li]);
      for (var si = 0; si < ss.length; si++) {
        var s = ss[si];
        if (s.k === 'tok') {
          var w = tokEl(s.v, lp[li], true);
          row.appendChild(w); row.appendChild(caret); el.scrollTop = el.scrollHeight;
          await pace(8);
        } else {
          var tx = document.createElement('span'); tx.className = 'tx';
          var tn = document.createTextNode(''); tx.appendChild(tn); row.appendChild(tx);
          for (var i = 0; i < s.v.length; i += per) {
            tn.data += s.v.slice(i, i + per);
            row.appendChild(caret); el.scrollTop = el.scrollHeight;
            await pace(Math.min(per, s.v.length - i));
          }
        }
      }
    }
    caret.remove();
  }

  // The template lands in the real demo: switch (if needed) and let its fields + paper "boot".
  function deliver(t) {
    if (DEMO && DEMO.activeId() !== t.id) DEMO.select(t.id);
    liftVeil();
    setDemoLink(true, t);
    if (reduce) return;
    var host = els.panel, wrap = els.paperWrap, paper = document.getElementById('dm-paper');
    Array.prototype.forEach.call(host.querySelectorAll('[data-field-id]'), function (c, i) { c.style.setProperty('--i', i); });
    host.classList.add('fb-boot'); wrap.classList.add('fb-boot');
    if (paper) paper.classList.add('fb-print');
    setTimeout(function () {
      host.classList.remove('fb-boot'); wrap.classList.remove('fb-boot');
      if (paper) paper.classList.remove('fb-print');
    }, 1900);
    scheduleLayout();
  }

  function finishInstant(t) {
    renderCodeFull(t);
    renderStats(statsOf(t));
    markRules(t, true);
    bar(100);
    els.tokIn.textContent = Math.round(charCount(t) / 3 + 190);
    els.tokOut.textContent = Math.round(charCount(t) / 3.1);
    phase('done');
    EDGE_IDS.forEach(function (id) { edges[id].g.setAttribute('data-s', 'armed'); });
    syncPorts();
    if (DEMO && DEMO.activeId() !== t.id) DEMO.select(t.id);
    liftVeil();
    setDemoLink(true, t);
    running = false; hasRun = true; syncBtn();
    layout();
  }

  async function run(tplId, o) {
    o = o || {};
    var t = partOf(tplId);
    var id = ++runId;
    var S = function (ms) { return sleep(ms, id); };
    var alive = function (ok) { if (!ok || id !== runId) throw CANCEL; };
    reset(); prepare(t);
    chosen = true; board.classList.remove('fb-unchosen'); running = true; syncBtn();
    if (reduce || o.instant) { finishInstant(t); return; }
    veilBuilding();
    var pkTimer = 0;
    try {
      var inTotal = Math.round(charCount(t) / 3 + 190), outTotal = Math.round(charCount(t) / 3.1);

      // read: the beam finds the blanks while the model reads the rules
      phase('read'); nodeOn(els.src, true); nodeOn(els.prompt, true);
      scan(id, 1300); lightRules(id, S);
      await S(450);
      setEdge('e1', 'hot'); setEdge('e2', 'hot');
      for (var i = 0; i < 3; i++) { sendPacket('e1', { run: id, delay: i * 240, dur: 900 }); sendPacket('e2', { run: id, delay: 80 + i * 240, dur: 1100 }); }
      await S(1250);

      // think
      nodeOn(els.src, false); nodeOn(els.prompt, false); nodeOn(els.model, true);
      phase('think'); bar(30); countTo(els.tokIn, inTotal, 900, id);
      await S(1000);

      // write: the template is typed into the output node
      phase('write'); setEdge('e1', 'armed'); setEdge('e2', 'armed'); setEdge('e3', 'hot'); nodeOn(els.out, true);
      pkTimer = setInterval(function () { sendPacket('e3', { run: id, dur: 560 }); }, 360);
      await typeFlow(t, S, function (p) { bar(30 + p * 62); els.tokOut.textContent = Math.round(outTotal * p); });
      clearInterval(pkTimer); pkTimer = 0;
      els.code.classList.add('done');
      renderStats(statsOf(t));
      updateCounts(t);
      layout();   // the output node just grew: re-measure before packets start

      // send: output -> demo node -> panel + paper
      phase('send'); bar(96); nodeOn(els.out, false); setEdge('e3', 'armed');
      setEdge('e4', 'hot');
      var p4 = [0, 1, 2].map(function (k) { return sendPacket('e4', { run: id, delay: k * 230, dur: 800 }); });
      alive((await Promise.all(p4)).every(Boolean));
      nodeOn(els.model, false); nodeOn(els.demo, true);
      setEdge('e5', 'hot'); setEdge('e6', 'hot');
      var p56 = [];
      for (var k = 0; k < 2; k++) { p56.push(sendPacket('e5', { run: id, delay: k * 240, dur: 650 })); p56.push(sendPacket('e6', { run: id, delay: k * 240, dur: 650 })); }
      alive((await Promise.all(p56)).every(Boolean));

      // landed
      deliver(t);
      phase('done'); bar(100);
      await S(500);
      nodeOn(els.demo, false);
      EDGE_IDS.forEach(function (eid) { edges[eid].g.setAttribute('data-s', 'armed'); });
      syncPorts();
      running = false; hasRun = true; syncBtn();
    } catch (err) {
      if (err !== CANCEL) { console.error(err); running = false; syncBtn(); }
    } finally {
      if (pkTimer) clearInterval(pkTimer);
    }
  }



  /* ---------------------------------------------------------------- first visit: nothing chosen yet */
  var ICON_DOC = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/></svg>';
  var ICON_LOCK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';
  var ICON_SPIN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M21 12a9 9 0 1 1-6.2-8.56"/></svg>';
  var ICON_X = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';

  function renderEmpty() {
    cur = null;
    renderTabs();
    els.file.textContent = ''; els.outFile.textContent = ''; els.meta.innerHTML = '';
    markRules(null, false);
    els.paper.innerHTML = '<div class="fb-empty">' + ICON_DOC + '<p>' + esc(T('ai.flow.src.empty')) + '</p><button type="button" class="fb-btn" data-open-pick>' + esc(T('ai.flow.pick.open')) + '</button></div>';
  }

  // the demo stays locked behind a veil until the first template lands
  var veil = null;
  function fillVeil() {
    if (!veil || veil.classList.contains('gone')) return;
    var building = veil.classList.contains('building');
    veil.querySelector('.fb-veil-ico').innerHTML = building ? ICON_SPIN : ICON_LOCK;
    veil.querySelector('h3').textContent = T(building ? 'ai.flow.veil.building' : 'ai.flow.veil.title');
    var p = veil.querySelector('p'); p.textContent = building ? '' : T('ai.flow.veil.sub'); p.style.display = building ? 'none' : '';
    veil.querySelector('.fb-btn').textContent = T('ai.flow.pick.open');
  }
  function makeVeil() {
    var grid = document.querySelector('.fb-demo-grid');
    if (!grid) return;
    veil = document.createElement('div');
    veil.className = 'fb-veil'; veil.id = 'fb-veil';
    veil.innerHTML = '<div class="fb-veil-card"><span class="fb-veil-ico"></span><h3></h3><p></p><button type="button" class="fb-btn" data-open-pick></button></div>';
    grid.appendChild(veil);
    els.panel.inert = true; els.paperWrap.inert = true;
    fillVeil();
  }
  function veilBuilding() { if (veil && !veil.classList.contains('gone')) { veil.classList.add('building'); fillVeil(); } }
  function liftVeil() {
    if (!veil || veil.classList.contains('gone')) return;
    veil.classList.add('gone');
    els.panel.inert = false; els.paperWrap.inert = false;
  }

  // the "choose your template" popup
  var pick = null, pickOpen = false, pickReturn = null, pickOverflow = '';
  function buildPicker() {
    if (!pick) {
      pick = document.createElement('div');
      pick.id = 'fb-pick'; pick.className = 'fb-pick'; pick.hidden = true;
      pick.setAttribute('role', 'dialog'); pick.setAttribute('aria-modal', 'true'); pick.setAttribute('aria-labelledby', 'fb-pick-h');
      document.body.appendChild(pick);
      pick.addEventListener('click', function (e) {
        if (e.target.classList.contains('fb-pick-back') || (e.target.closest && e.target.closest('[data-pick-close]'))) { dismissPicker(); return; }
        var it = e.target.closest && e.target.closest('[data-pick]');
        if (it) choose(it.getAttribute('data-pick'), it);
      });
      pick.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { e.preventDefault(); dismissPicker(); return; }
        if (e.key !== 'Tab') return;
        var f = pick.querySelectorAll('button');
        if (!f.length) return;
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      });
    }
    pick.innerHTML =
      '<div class="fb-pick-back"></div><div class="fb-pick-card">' +
      '<button type="button" class="fb-pick-x" data-pick-close aria-label="' + esc(T('ai.flow.pick.closeLabel')) + '">' + ICON_X + '</button>' +
      '<h3 id="fb-pick-h">' + esc(T('ai.flow.pick.title')) + '</h3><p>' + esc(T('ai.flow.pick.sub')) + '</p>' +
      '<div class="fb-pick-list">' + PARTS.map(function (t) {
        var st = statsOf(t), title = flowLines(t)[0] || '';
        var chips = [['fields', st.fields], ['required', st.required], ['dates', st.dates], ['loops', st.loops]].filter(function (x) { return x[1] > 0; })
          .map(function (x) { return '<span>' + x[1] + ' ' + esc(T('ai.flow.stat.' + x[0])) + '</span>'; }).join('');
        return '<button type="button" class="fb-pick-item" data-pick="' + t.id + '"><span class="fb-pick-doc" aria-hidden="true"><b>' + esc(title) +
          '</b><i></i><i></i><i class="k"></i><i></i><i></i></span><span class="fb-pick-name">' + esc(tplName(t)) + '</span><span class="fb-pick-meta">' + chips + '</span></button>';
      }).join('') + '</div>' +
      '<button type="button" class="fb-pick-skip" data-pick-close>' + esc(T('ai.flow.pick.close')) + '</button></div>';
  }
  function openPicker() {
    if (pickOpen) return;
    buildPicker();
    pickReturn = document.activeElement;
    pick.hidden = false; pickOpen = true; pickShown = true;
    pickOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    setTimeout(function () { var b = pick.querySelector('.fb-pick-item'); if (b) b.focus(); }, 60);
  }
  function closePicker() {
    if (!pickOpen) return;
    pick.hidden = true; pickOpen = false;
    document.documentElement.style.overflow = pickOverflow;
  }
  function dismissPicker() {
    pickDismissed = true; closePicker();
    if (pickReturn && pickReturn.focus) { try { pickReturn.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
  }
  function choose(id, el) {
    if (window.burstAt && el) { var r = el.getBoundingClientRect(); window.burstAt(r.left + r.width / 2, r.top + r.height / 2); }
    closePicker();
    // make sure the person actually sees the animation start
    var m = els.model.getBoundingClientRect();
    if (m.bottom < 120 || m.top > window.innerHeight - 120) els.model.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
    run(id);
  }
  board.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('[data-open-pick]')) openPicker(); });

  /* ---------------------------------------------------------------- interactions */
  // Rules: hover or focus one to see where it was applied in the output; click to pin it.
  var pinned = null;
  function focusKey(k) { if (k) els.code.setAttribute('data-focus', k); else els.code.removeAttribute('data-focus'); }
  function setPin(k) {
    pinned = k;
    Array.prototype.forEach.call(els.rules.children, function (li, i) { li.classList.toggle('pin', k === 'r' + (i + 1)); });
    focusKey(k);
  }
  function updateCounts(t) {
    var q = function (sel) { return els.code.querySelectorAll(sel).length; };
    var counts = [0, q('.tok[data-f]'), q('.tf-t'), q('.tf-r'), q('.tf-o'), (t.loops || []).length, 0];
    Array.prototype.forEach.call(els.rules.children, function (li, i) {
      var n = li.querySelector('.fb-n');
      if (!n) return;
      n.textContent = counts[i] > 0 ? '\u00d7' + counts[i] : '';
      n.title = counts[i] > 0 ? counts[i] + ' ' + T('ai.flow.rule.in') : '';
    });
  }
  function clearCounts() {
    Array.prototype.forEach.call(els.rules.querySelectorAll('.fb-n'), function (n) { n.textContent = ''; n.title = ''; });
  }
  Array.prototype.forEach.call(els.rules.children, function (li, i) {
    var key = 'r' + (i + 1);
    li.tabIndex = 0;
    var n = document.createElement('em'); n.className = 'fb-n'; li.appendChild(n);
    var on = function () { if (li.classList.contains('use')) focusKey(key); };
    var off = function () { focusKey(pinned); };
    li.addEventListener('pointerenter', on); li.addEventListener('pointerleave', off);
    li.addEventListener('focus', on); li.addEventListener('blur', off);
    li.addEventListener('click', function () { if (li.classList.contains('use')) setPin(pinned === key ? null : key); });
    li.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); li.click(); } });
  });

  // Template tokens: click one to jump to its field in the live demo.
  function cardFor(name, loop) {
    var q = function (id) { return els.panel.querySelector('[data-field-id="' + id + '"]'); };
    return q(name) || (loop ? q(loop) : null);
  }
  function jumpTo(name, loop) {
    var c = cardFor(name, loop);
    if (!c) return;
    c.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
    c.classList.remove('fb-ping'); void c.offsetWidth; c.classList.add('fb-ping');
    var inp = c.querySelector('input, textarea, select');
    if (inp) setTimeout(function () { try { inp.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }, 600);
    setTimeout(function () { c.classList.remove('fb-ping'); }, 3200);
    if (window.burstAt) setTimeout(function () { var r = c.getBoundingClientRect(); window.burstAt(r.left + r.width / 2, r.top + r.height / 2); }, 750);
  }
  els.code.addEventListener('click', function (e) {
    var tk = e.target.closest && e.target.closest('.tok[data-f]');
    if (tk) jumpTo(tk.getAttribute('data-f'), tk.getAttribute('data-loop'));
  });
  els.code.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') return;
    var tk = e.target.closest && e.target.closest('.tok[data-f]');
    if (tk) jumpTo(tk.getAttribute('data-f'), tk.getAttribute('data-loop'));
  });

  // Live status chip on the paper: invites the first edit, then reports required fields.
  var chip = document.createElement('div');
  chip.id = 'fb-ready'; chip.className = 'fb-ready'; chip.hidden = true; chip.setAttribute('aria-live', 'polite');
  els.paperWrap.appendChild(chip);
  var prog = (DEMO && DEMO.last) || null, touched = false, wasOk = null;
  function updateReadyView() {
    if (!prog) { chip.hidden = true; return; }
    chip.hidden = false;
    var ok = !!prog.ok && touched;
    chip.classList.toggle('ok', ok);
    if (!touched) {
      chip.innerHTML = '<i class="fb-led"></i><span>' + esc(T('ai.flow.chip.try')) + '</span>';
    } else if (prog.ok) {
      chip.innerHTML = '<i class="fb-led"></i><span>' + esc(T('ai.flow.chip.ready')) + '</span>';
    } else {
      chip.innerHTML = '<i class="fb-led"></i><span><b>' + Math.max(0, prog.total - prog.done) + '</b> ' + esc(T('ai.flow.chip.left')) + '</span>';
    }
    if (touched && wasOk === false && prog.ok) {
      chip.classList.remove('pop'); void chip.offsetWidth; chip.classList.add('pop');
      if (window.burstAt) { var r = chip.getBoundingClientRect(); window.burstAt(r.left + r.width / 2, r.top + r.height / 2); }
    }
    if (touched) wasOk = !!prog.ok;
  }
  document.addEventListener('demo:progress', function (e) { prog = e.detail; updateReadyView(); });
  ['pointerdown', 'keydown'].forEach(function (ev) {
    els.panel.addEventListener(ev, function () { if (!touched) { touched = true; wasOk = prog ? !!prog.ok : null; updateReadyView(); } });
  });

  // Typing in the demo: the matching token lights up in the template and a signal runs down the preview line.
  var lastPk = 0;
  els.panel.addEventListener('input', function (e) {
    var card = e.target.closest && e.target.closest('[data-field-id]');
    if (card) {
      var id = card.getAttribute('data-field-id');
      Array.prototype.forEach.call(els.code.querySelectorAll('.tok[data-f]'), function (t) {
        if (t.getAttribute('data-f') === id || t.getAttribute('data-loop') === id) { t.classList.remove('lit'); void t.offsetWidth; t.classList.add('lit'); }
      });
    }
    var now = performance.now();
    if (!running && !reduce && now - lastPk > 260) { lastPk = now; sendPacket('e6', { run: runId, dur: 520 }); }
  });

  /* ---------------------------------------------------------------- wiring */
  els.tabs.addEventListener('click', function (e) {
    var b = e.target.closest('[data-tpl]');
    if (!b) return;
    if (running && b.dataset.tpl === cur) return;
    run(b.dataset.tpl);
  });
  els.go.addEventListener('click', function () { if (cur) run(cur); else openPicker(); });

  // the demo's own template buttons: keep the nodes in step (no replay, the demo already switched)
  document.addEventListener('demo:template', function (e) {
    var id = e.detail && e.detail.id;
    touched = false; wasOk = null; updateReadyView();
    if (id && id !== cur) { started = true; run(id, { instant: true }); }
  });

  // first time the board (or the demo) comes into view: offer the template choice
  function autoPick() {
    if (chosen || pickShown || pickDismissed) return;
    pickShown = true;
    setTimeout(function () { if (!chosen && !pickDismissed) { pickShown = false; openPicker(); } }, 350);
  }
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (ents) { ents.forEach(function (en) { if (en.isIntersecting) autoPick(); }); }, { threshold: 0.4 });
    io.observe(els.src); io.observe(els.demo);
  }

  window.refreshFlowLang = function () {
    renderTabs();
    if (!cur) renderEmpty();
    fillVeil();
    if (pickOpen) buildPicker();
    els.status.textContent = T('ai.flow.phase.' + phaseKey);
    syncBtn();
    setDemoLink(demoLinked, partOf(cur));
    if (!els.blanks.hidden) els.blanks.textContent = blankCount + ' ' + T('ai.flow.src.blanks');
    if (els.code.querySelector('.fb-wait')) renderWait();
    renderStats(lastStats);
    if (els.code.classList.contains('done')) { var keep = els.code.scrollTop; renderCodeFull(partOf(cur)); els.code.scrollTop = keep; }
    updateReadyView();
    scheduleLayout();
  };

  /* ---------------------------------------------------------------- init */
  reset(); renderEmpty(); phase('pick'); makeVeil(); syncBtn(); setDemoLink(false);
  board.classList.add('fb-unchosen');
  updateReadyView();
  layout();
  if (window.ResizeObserver) {
    var ro = new ResizeObserver(scheduleLayout);
    [board, els.src, els.prompt, els.model, els.out, els.demo, els.panel, els.paperWrap].forEach(function (n) { if (n) ro.observe(n); });
  }
  window.addEventListener('resize', scheduleLayout);
  if (stackedMQ.addEventListener) stackedMQ.addEventListener('change', scheduleLayout);
  window.addEventListener('load', function () { setTimeout(scheduleLayout, 250); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(scheduleLayout);
})();
