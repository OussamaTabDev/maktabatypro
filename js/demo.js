/* Live demo: uses the app's own panel HTML (one per template) and template HTML.
   This file only adds behaviour — it does not restyle anything.

   Multi-template support:
   - window.__demoParts is an array of templates
   - Each template has: { id, nameAr, nameEn, nameFr, fields, required, dates, loops, panel, template }
   - A template selector (rendered into #dm-selector) swaps both the panel and the template.
   - loops: [{ name, fields: [{name, type, required, conditional, format}], minRows }]
   - Templates can use:
     - {{FIELD}} and {{FIELD:type}} and {{FIELD:type!}} placeholders (type: text|cin|textarea|date)
     - {{OBJECT.field}} nested dotted names (treated as flat keys in snap.v)
     - {{#each NAME}}...{{/each}} blocks (loops)
     - {{#if field:type}}...{{/if}} conditionals inside loops
     - |default=VALUE modifier (use VALUE if empty; TODAY = current ISO date)
     - |format=long modifier (date fields: Arabic long format, index 3)
*/
(function () {
  const PARTS = window.__demoParts;
  const host = document.getElementById('dm-panel-host');
  const paper = document.getElementById('dm-paper');
  const stage = document.getElementById('dm-stage');
  const selector = document.getElementById('dm-selector');
  if (!PARTS || !Array.isArray(PARTS) || !host || !paper) return;

  /* ---------- i18n helpers (unchanged) ---------- */
  function currentLang() {
    try { return localStorage.getItem('maktabaty_lang') || 'ar'; }
    catch (e) { return 'ar'; }
  }
  function templateName(t) {
    const lang = currentLang();
    if (lang === 'en') return t.nameEn;
    if (lang === 'fr') return t.nameFr;
    return t.nameAr;
  }
  function templateFileSlug(t) {
    const map = { 'no-work': 'تصريح_بعدم_العمل', 'collective-life': 'تصريح_بالحياة_الجماعية', 'honor': 'تصريح_بالشرف' };
    return map[t.id] || t.id;
  }

  /* ---------- render template selector ---------- */
  if (selector) {
    selector.innerHTML = PARTS.map((t, i) => {
      const name = templateName(t);
      const cls = i === 0 ? 'dm-tpl-btn dm-tpl-active' : 'dm-tpl-btn';
      return `<button type="button" data-tpl="${t.id}" class="${cls}">${name}</button>`;
    }).join('');
  }

  /* ---------- state per active template ---------- */
  let active = PARTS[0];
  let fmt = {};      // {FIELD: {f, d}} for top-level date fields
  let loops = {};    // {CHILDREN: [{full_name, birth_date, cin, _fmt:{birth_date:{f,d}}}, ...]}
  let queue = [];    // snapshots in the print queue

  window.addEventListener('storage', (e) => {
    if (e.key === 'maktabaty_lang') setTimeout(rebuildSelector, 50);
  });
  window.refreshDemoLang = function () { rebuildSelector(); applyActiveTemplate(true); };

  function rebuildSelector() {
    if (!selector) return;
    [...selector.children].forEach((btn, i) => {
      btn.textContent = templateName(PARTS[i]);
    });
  }

  /* ---------- date formats ---------- */
  const DAY_LABELS = ['تاريخ فقط', 'يوم + تاريخ', 'اليوم فقط'];
  const FMT_LOCALE_WEEKDAY = ['ar', 'ar', 'ar', 'ar', 'fr-FR', 'en-US', 'ar'];
  const fmtDate = (iso, f, d) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    if (!m) return '';
    const [, y, mm, dd] = m;
    const date = new Date(+y, +mm - 1, +dd);
    const I = (loc, o) => new Intl.DateTimeFormat(loc, o).format(date);
    const long = { day: 'numeric', month: 'long', year: 'numeric' };
    let base;
    try {
      base = [
        () => `${dd}-${mm}-${y}`,
        () => `${y}/${mm}/${dd}`,
        () => `${dd}\u200F/${mm}\u200F/${y.slice(2)}`,
        () => I('ar-u-nu-latn', long),
        () => I('fr-FR', long),
        () => I('en-US', long),
        () => I('ar-SA-u-ca-islamic-umalqura', long)
      ][f]();
    } catch (e) { base = `${dd}-${mm}-${y}`; }
    if (!d) return base;
    let wk;
    try {
      const loc = FMT_LOCALE_WEEKDAY[f];
      wk = I(loc === 'ar' ? 'ar-u-nu-latn' : loc, { weekday: 'long' });
    } catch (e) { wk = ''; }
    return d === 2 ? wk : `${wk} ${base}`;
  };

  function todayISO() {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
  }

  // Detect format=long date fields in the template (top-level only — for loop fields see initLoops)
  function detectFormatLongFields() {
    const out = new Set();
    // Match placeholders with date type and format=long. Capture field name (without prefix).
    // Skip inside #each blocks (handled per-loop) — but matching the whole template is fine because loop date fields use bare names like birth_date and top-level uses dotted names; we just include both.
    const re = /\{\{([\w.]+):date[^}]*\|format=long[^}]*\}\}/g;
    let m;
    while ((m = re.exec(active.template)) !== null) out.add(m[1]);
    return out;
  }

  function initFmt() {
    fmt = {};
    const longFields = detectFormatLongFields();
    active.dates.forEach((k) => {
      const useLong = longFields.has(k);
      fmt[k] = { f: useLong ? 3 : 0, d: 0 };
    });
  }

  function initLoops() {
    loops = {};
    (active.loops || []).forEach((loopDef) => {
      loops[loopDef.name] = [];
      for (let i = 0; i < (loopDef.minRows || 1); i++) {
        loops[loopDef.name].push(makeEmptyLoopItem(loopDef));
      }
    });
  }

  function makeEmptyLoopItem(loopDef) {
    const item = { _fmt: {} };
    loopDef.fields.forEach((lf) => {
      item[lf.name] = '';
      if (lf.type === 'date') {
        item._fmt[lf.name] = { f: lf.format === 'long' ? 3 : 0, d: 0 };
      }
    });
    return item;
  }

  /* ---------- chip styling helpers (unchanged) ---------- */
  const CHIP_ON = ['bg-primary', 'text-primary-foreground', 'border-primary', 'shadow-sm', 'scale-105'];
  const CHIP_OFF = ['bg-muted/60', 'text-muted-foreground', 'border-border', 'hover:border-primary/50', 'hover:bg-muted'];
  const el = (id) => host.querySelector('#' + CSS.escape(id));
  const card = (id) => host.querySelector(`[data-field-id="${CSS.escape(id)}"]`);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function fmtChips(id) { return card(id) ? [...card(id).querySelectorAll('.mt-2 button')] : []; }
  function toggleBtn(id) { return card(id) ? card(id).querySelector('.ms-auto button') : null; }

  function syncDateUI(id) {
    if (!fmt[id]) return;
    fmtChips(id).forEach((b, i) => {
      const on = i === fmt[id].f;
      b.classList.remove(...(on ? CHIP_OFF : CHIP_ON));
      b.classList.add(...(on ? CHIP_ON : CHIP_OFF));
    });
    const tb = toggleBtn(id);
    if (!tb) return;
    const dot = tb.querySelector('span');
    const active = fmt[id].d !== 0;
    dot.classList.toggle('bg-primary', active);
    dot.classList.toggle('bg-muted-foreground/50', !active);
    tb.classList.toggle('text-foreground', active);
    tb.lastChild.textContent = DAY_LABELS[fmt[id].d];
  }

  /* ---------- loop UI helpers ---------- */
  function loopDef(name) {
    return (active.loops || []).find((l) => l.name === name);
  }
  function loopContainer(name) {
    return host.querySelector(`[data-dropzone="${name}"]`);
  }
  function loopCountEl(name) {
    return host.querySelector(`[data-field-id="${CSS.escape(name)}"] [data-loop-count]`);
  }
  function loopAddBtn(name) {
    return host.querySelector(`[data-loop-add="${name}"]`);
  }
  function labelForLoopField(name) {
    const labels = { full_name: 'الاسم الكامل', birth_date: 'تاريخ الازدياد', cin: 'رقم البطاقة' };
    return labels[name] || name;
  }

  function renderLoopRow(loopName, def, item, index, total) {
    const firstBadge = index === 0 ? '<span class="text-[9px] px-1 rounded bg-blue-500/10 text-blue-600 font-mono">@first</span>' : '';
    const lastBadge = index === total - 1 ? '<span class="text-[9px] px-1 rounded bg-amber-500/10 text-amber-600 font-mono">@last</span>' : '';
    const fieldsHtml = def.fields.map((lf) => {
      const v = item[lf.name] || '';
      if (lf.type === 'date') {
        return `<div class="min-w-0 flex-[1_1_12rem] sm:min-w-[155px]"><div class="space-y-1 relative"><label class="peer-disabled:cursor-not-allowed peer-disabled:opacity-70 min-w-0 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">${labelForLoopField(lf.name)}</label><input type="date" data-loop-field="${lf.name}" class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm text-sm text-start" dir="ltr" value="${esc(v)}"></div></div>`;
      }
      if (lf.type === 'cin') {
        const ifBadge = lf.conditional
          ? '<span class="flex shrink-0 items-center gap-0.5 rounded border border-border/60 bg-muted/60 px-1.5 py-0.5 text-[9px] font-mono text-muted-foreground"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-zap h-2.5 w-2.5"><path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"></path></svg>if</span>'
          : '';
        return `<div class="min-w-0 flex-[1_1_12rem] sm:min-w-[155px]"><div class="space-y-1 relative"><div class="flex items-center justify-between gap-2"><label class="peer-disabled:cursor-not-allowed peer-disabled:opacity-70 min-w-0 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">${labelForLoopField(lf.name)}</label>${ifBadge}</div><input type="text" data-loop-field="${lf.name}" class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm text-sm font-mono text-start" placeholder="AB123456" dir="ltr" value="${esc(v)}"></div></div>`;
      }
      return `<div class="min-w-0 flex-[1_1_12rem] sm:min-w-[155px]"><div class="space-y-1 relative"><label class="peer-disabled:cursor-not-allowed peer-disabled:opacity-70 min-w-0 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">${labelForLoopField(lf.name)}</label><input type="text" data-loop-field="${lf.name}" class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm text-sm text-start" dir="rtl" value="${esc(v)}"></div></div>`;
    }).join('');

    return `<div draggable="false" dir="rtl" data-row-index="${index}" role="listitem" class="min-w-0 border rounded-lg bg-muted/20 overflow-hidden transition-all duration-50 fill-enter border-border">
      <div class="flex min-w-0 items-center justify-between gap-2 px-3 py-2 cursor-default select-none border-b border-border/50 bg-muted/40">
        <div class="flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-down h-3.5 w-3.5 text-muted-foreground transition-transform duration-200"><path d="m6 9 6 6 6-6"></path></svg>
          <span class="text-xs font-semibold text-primary">العنصر ${index + 1}</span>
          <div class="flex gap-1">${firstBadge}${lastBadge}</div>
        </div>
        <div class="flex items-center gap-1">
          <button type="button" data-row-remove title="حذف" class="p-1 rounded hover:bg-destructive/10 hover:text-destructive transition-colors"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-trash2 h-3.5 w-3.5"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path><line x1="10" x2="10" y1="11" y2="17"></line><line x1="14" x2="14" y1="11" y2="17"></line></svg></button>
        </div>
      </div>
      <div class="min-w-0 overflow-hidden transition-all duration-200 max-h-[2000px] opacity-100">
        <div class="min-w-0 p-3 space-y-3">
          <div class="min-w-0 flex flex-wrap items-start" style="gap: 12px;">${fieldsHtml}</div>
        </div>
      </div>
    </div>`;
  }

  function syncLoopUI(name) {
    const def = loopDef(name);
    if (!def) return;
    const container = loopContainer(name);
    if (!container) return;
    const arr = loops[name] || [];
    container.innerHTML = arr.map((item, i) => renderLoopRow(name, def, item, i, arr.length)).join('');
    const countEl = loopCountEl(name);
    if (countEl) countEl.textContent = arr.length + ' عنصر';
  }

  /* ---------- snapshot / apply ---------- */
  const snapshot = () => ({
    tplId: active.id,
    v: Object.fromEntries(active.fields.map((k) => [k, el(k) ? el(k).value : ''])),
    fmt: JSON.parse(JSON.stringify(fmt)),
    loops: JSON.parse(JSON.stringify(loops))
  });

  function valueFor(snap, k) {
    const raw = (snap.v[k] || '').trim();
    if (active.dates.includes(k) && snap.fmt[k]) {
      return raw ? fmtDate(raw, snap.fmt[k].f, snap.fmt[k].d) : '';
    }
    return raw;
  }

  function isNumericKey(k) {
    if (/CIN/.test(k)) return true;
    if (active.dates.includes(k) && fmt[k] && fmt[k].d === 0 && fmt[k].f <= 2) return true;
    return false;
  }

  /* ---------- placeholder parsing & rendering ---------- */
  // Parse: "DECLARANT.full_name:text!" or "full_name:date|format=long" → {name, type, required, options}
  function parseExpr(expr) {
    const m = expr.match(/^([\w.]+)(?::([^|}]+))?(?:\|([^}]+))?$/);
    if (!m) return null;
    const type = m[2] || '';
    return {
      name: m[1],
      type: type.replace(/!$/, ''),
      required: type.endsWith('!'),
      options: m[3] || ''
    };
  }

  function applyDefault(value, optionsStr, type) {
    if (value) return value;
    if (!optionsStr) return '';
    const parts = optionsStr.split('|');
    for (const part of parts) {
      const m = part.match(/^\s*default\s*=\s*(.+?)\s*$/);
      if (m) {
        let d = m[1];
        if (d === 'TODAY') d = todayISO();
        return d;
      }
    }
    return '';
  }

  function isFormatLong(optionsStr) {
    return /\bformat=long\b/.test(optionsStr || '');
  }

  function renderTopPlaceholder(parsed, snap) {
    // Read the raw value (do NOT pre-format dates — valueFor already formats, which would double-format)
    const raw = (snap.v[parsed.name] || '').trim();
    let fmtObj = snap.fmt[parsed.name] || { f: 0, d: 0 };

    // If empty, try default
    if (!raw) {
      const defaulted = applyDefault('', parsed.options, parsed.type);
      if (defaulted) {
        // Format the defaulted date if it's a date field
        if (parsed.type === 'date' && active.dates.includes(parsed.name)) {
          const useLong = isFormatLong(parsed.options);
          return fmtDate(defaulted, useLong ? 3 : fmtObj.f, fmtObj.d);
        }
        // For non-date, just return the default value (escape it)
        const numeric = parsed.type === 'cin';
        return numeric ? `<bdi dir="ltr">${esc(defaulted)}</bdi>` : esc(defaulted);
      }
      return '…………';
    }

    // Format date fields once (use format=long override if requested)
    if (parsed.type === 'date' && active.dates.includes(parsed.name)) {
      const useLong = isFormatLong(parsed.options);
      const formatted = fmtDate(raw, useLong ? 3 : fmtObj.f, fmtObj.d);
      return formatted || '…………';
    }

    const numeric = isNumericKey(parsed.name) || parsed.type === 'cin';
    return numeric ? `<bdi dir="ltr">${esc(raw)}</bdi>` : esc(raw);
  }

  function renderLoopPlaceholder(parsed, item) {
    const value = (item[parsed.name] || '').trim();
    if (parsed.type === 'date') {
      if (!value) return '…………';
      const fmtObj = (item._fmt && item._fmt[parsed.name]) || { f: 3, d: 0 };
      const useLong = isFormatLong(parsed.options);
      return fmtDate(value, useLong ? 3 : fmtObj.f, fmtObj.d);
    }
    if (!value) return '…………';
    const numeric = parsed.type === 'cin';
    return numeric ? `<bdi dir="ltr">${esc(value)}</bdi>` : esc(value);
  }

  function processLoopItem(body, item, index, total, snap) {
    // {{#if field}}...{{/if}} — render content only if item[field] is non-empty
    body = body.replace(/\{\{#if\s+([\w.]+)(?::[^|}]+)?(?:\|[^}]+)?\}\}([\s\S]*?)\{\{\/if\}\}/g, (m, fieldName, content) => {
      const v = (item[fieldName] || '').trim();
      return v ? content : '';
    });
    // Replace remaining placeholders
    body = body.replace(/\{\{([^}]+)\}\}/g, (m, expr) => {
      const t = expr.trim();
      if (t.startsWith('#') || t.startsWith('/')) return m;
      const parsed = parseExpr(t);
      if (!parsed) return m;
      return renderLoopPlaceholder(parsed, item);
    });
    return body;
  }

  function processLoops(tpl, snap) {
    return tpl.replace(/\{\{#each\s+(\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g, (m, name, body) => {
      const arr = snap.loops[name] || [];
      return arr.map((item, i) => processLoopItem(body, item, i, arr.length, snap)).join('');
    });
  }

  function processConditionals(tpl, snap) {
    return tpl.replace(/\{\{#if\s+([\w.]+)(?::[^|}]+)?(?:\|[^}]+)?\}\}([\s\S]*?)\{\{\/if\}\}/g, (m, fieldName, content) => {
      const v = (snap.v[fieldName] || '').trim();
      return v ? content : '';
    });
  }

  function processPlaceholders(tpl, snap) {
    return tpl.replace(/\{\{([^}]+)\}\}/g, (m, expr) => {
      const t = expr.trim();
      if (t.startsWith('#') || t.startsWith('/')) return m;
      const parsed = parseExpr(t);
      if (!parsed) return m;
      return renderTopPlaceholder(parsed, snap);
    });
  }

  const docHTML = (snap) => {
    let tpl = active.template;
    tpl = processLoops(tpl, snap);
    tpl = processConditionals(tpl, snap);
    tpl = processPlaceholders(tpl, snap);
    return tpl;
  };

  /* ---------- paper preview ---------- */
  function fit() {
    const s = Math.min(1, stage.clientWidth / 794);
    paper.style.transform = `scale(${s})`;
    stage.style.height = Math.ceil(paper.offsetHeight * s) + 'px';
  }
  function render() {
    paper.innerHTML = docHTML(snapshot());
    updateProgress();
    fit();
  }
  if (window.ResizeObserver) new ResizeObserver(fit).observe(stage);
  window.addEventListener('resize', fit);

  /* ---------- progress ---------- */
  function updateProgress() {
    const bar = host.querySelector('[style*="width"][class*="transition-all"]');
    if (!bar) return;
    const countEl = bar.parentElement.nextElementSibling?.querySelector('span');
    // Count filled scalar fields
    const filledScalar = active.fields.filter((k) => el(k) && el(k).value.trim()).length;
    // Count filled required scalar fields
    const reqScalar = active.required.filter((k) => el(k) && el(k).value.trim()).length;
    // Count loop rows that have at least one filled field
    let loopFilledCount = 0;
    let loopReqCount = 0;
    let loopReqTarget = 0;
    (active.loops || []).forEach((loopDef) => {
      const arr = loops[loopDef.name] || [];
      arr.forEach((item) => {
        // Count this row as "filled" if any field has a value
        const anyFilled = loopDef.fields.some((lf) => (item[lf.name] || '').trim());
        if (anyFilled) loopFilledCount++;
        // Required loop fields (none in our case, but support it)
        const reqFields = loopDef.fields.filter((lf) => lf.required);
        loopReqTarget += reqFields.length;
        loopReqCount += reqFields.filter((lf) => (item[lf.name] || '').trim()).length;
      });
    });

    const totalFields = active.fields.length + loopFilledCount;
    const filled = filledScalar + loopFilledCount;
    const reqDone = reqScalar + loopReqCount === active.required.length + loopReqTarget;
    const reqTotal = active.required.length + loopReqTarget;

    bar.style.width = Math.round((filled / Math.max(1, totalFields)) * 100) + '%';
    bar.classList.toggle('bg-destructive', !reqDone);
    bar.classList.toggle('bg-primary', reqDone);
    if (countEl) {
      countEl.classList.toggle('text-destructive', !reqDone);
      countEl.classList.toggle('text-primary', reqDone);
      countEl.textContent = `(${reqScalar + loopReqCount}/${reqTotal} إلزامي)`;
    }
    // js/ai-flow.js shows a live "ready to print" badge from this
    const detail = { done: reqScalar + loopReqCount, total: reqTotal, ok: reqDone };
    if (window.__demo) window.__demo.last = detail;   // late listeners (ai-flow.js) read the current state from here
    document.dispatchEvent(new CustomEvent('demo:progress', { detail }));
  }

  /* ---------- wiring ---------- */
  function bindInputs() {
    host.addEventListener('input', (e) => {
      const t = e.target;
      // Top-level field input
      if (active.fields.includes(t.id)) {
        render();
        return;
      }
      // Loop field input — find row and update item
      if (t.dataset.loopField) {
        const row = t.closest('[data-row-index]');
        if (!row) return;
        const loopName = row.closest('[data-dropzone]')?.dataset.dropzone;
        if (!loopName) return;
        const idx = parseInt(row.dataset.rowIndex, 10);
        const fieldName = t.dataset.loopField;
        if (loops[loopName] && loops[loopName][idx]) {
          loops[loopName][idx][fieldName] = t.value;
          render();
        }
      }
    });

    // Sample chips under top-level text fields
    active.fields.forEach((k) => {
      const c = card(k);
      if (!c) return;
      c.querySelectorAll('.mt-1 > button').forEach((b) =>
        b.addEventListener('click', () => { if (el(k)) { el(k).value = b.textContent.trim(); render(); } }));
    });

    // Date chips and toggles
    active.dates.forEach((k) => {
      fmtChips(k).forEach((b, i) => b.addEventListener('click', () => { fmt[k].f = i; syncDateUI(k); render(); }));
      const tb = toggleBtn(k);
      if (tb) tb.addEventListener('click', () => { fmt[k].d = (fmt[k].d + 1) % 3; syncDateUI(k); render(); });
    });

    // Loop add buttons
    (active.loops || []).forEach((loopDef) => {
      const addBtn = loopAddBtn(loopDef.name);
      if (addBtn) {
        addBtn.addEventListener('click', () => {
          loops[loopDef.name].push(makeEmptyLoopItem(loopDef));
          syncLoopUI(loopDef.name);
          render();
        });
      }
      // Event delegation for row remove buttons and row input changes
      const container = loopContainer(loopDef.name);
      if (container) {
        container.addEventListener('click', (e) => {
          const btn = e.target.closest('[data-row-remove]');
          if (!btn) return;
          const row = btn.closest('[data-row-index]');
          if (!row) return;
          const idx = parseInt(row.dataset.rowIndex, 10);
          // Don't remove if it's the last row
          if (loops[loopDef.name].length <= 1) {
            // Clear instead
            loops[loopDef.name][0] = makeEmptyLoopItem(loopDef);
          } else {
            loops[loopDef.name].splice(idx, 1);
          }
          syncLoopUI(loopDef.name);
          render();
        });
      }
    });

    // Clear button
    const clearBtn = host.querySelector('h3').parentElement.querySelector('button');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        active.fields.forEach((k) => { if (el(k)) el(k).value = ''; });
        // Restore CITY default to خنيفرة
        const cityField = active.fields.find((f) => f === 'CITY');
        if (cityField && el(cityField)) {
          // Default to خنيفرة if template has |default=خنيفرة
          const re = /\{\{CITY:text[^}]*\|default=([^}|]+)[^}]*\}\}/;
          const m = active.template.match(re);
          if (m) el(cityField).value = m[1];
        }
        // Restore DOCUMENT_DATE default to TODAY
        const dateField = active.fields.find((f) => f === 'DOCUMENT_DATE');
        if (dateField && el(dateField)) {
          const re = /\{\{DOCUMENT_DATE:date[^}]*\|default=TODAY[^}]*\}\}/;
          if (re.test(active.template)) el(dateField).value = todayISO();
        }
        active.dates.forEach((k) => { fmt[k] = { f: fmt[k].f, d: 0 }; syncDateUI(k); });
        // Reset loops
        (active.loops || []).forEach((loopDef) => {
          loops[loopDef.name] = [];
          for (let i = 0; i < (loopDef.minRows || 1); i++) {
            loops[loopDef.name].push(makeEmptyLoopItem(loopDef));
          }
          syncLoopUI(loopDef.name);
        });
        render();
      });
    }
  }

  /* ---------- print / queue / recent exports ---------- */
  let printBtn, queueBtn, viewport, exportsH3, list, template_item, badge;

  function bindChromeOnce() {
    if (printBtn) return;
    printBtn = host.querySelector('.grid.gap-2 button');
    queueBtn = host.querySelector('.grid.gap-2').nextElementSibling;
    badge = document.createElement('span');
    badge.className = 'mx-1 rounded-full bg-primary text-primary-foreground px-1.5 text-[10px]';
    badge.hidden = true;
    queueBtn.appendChild(badge);
    viewport = host.querySelector('[data-radix-scroll-area-viewport]');
    exportsH3 = [...host.querySelectorAll('h3')].find((h) => h.textContent.includes('آخر الصادرات'));
    list = exportsH3.closest('.rounded-lg').querySelector('.space-y-2');
    template_item = list.firstElementChild.cloneNode(true);
    bindHistoryItems();
  }

  function setBadge() {
    if (!badge) return;
    badge.hidden = !queue.length;
    badge.textContent = queue.length;
  }

  function flashMissing() {
    // Check required scalar fields
    const miss = active.required.find((k) => !el(k) || !el(k).value.trim());
    if (miss) {
      const c = card(miss);
      if (c) {
        c.classList.add('dm-flash');
        setTimeout(() => c.classList.remove('dm-flash'), 1600);
        viewport.scrollTo({ top: viewport.scrollTop + c.getBoundingClientRect().top - viewport.getBoundingClientRect().top - 12, behavior: 'smooth' });
      }
      const inp = el(miss);
      if (inp) inp.focus({ preventScroll: true });
      return true;
    }
    // Check required loop fields (none in our case but support it)
    for (const loopDef of (active.loops || [])) {
      const reqFields = loopDef.fields.filter((lf) => lf.required);
      if (!reqFields.length) continue;
      const arr = loops[loopDef.name] || [];
      for (const item of arr) {
        for (const lf of reqFields) {
          if (!(item[lf.name] || '').trim()) {
            // Flash the loop container
            const c = card(loopDef.name);
            if (c) {
              c.classList.add('dm-flash');
              setTimeout(() => c.classList.remove('dm-flash'), 1600);
              viewport.scrollTo({ top: viewport.scrollTop + c.getBoundingClientRect().top - viewport.getBoundingClientRect().top - 12, behavior: 'smooth' });
            }
            return true;
          }
        }
      }
    }
    return false;
  }

  queueBtn && queueBtn.addEventListener('click', () => {
    if (flashMissing()) return;
    queue.push(snapshot());
    setBadge();
  });

  /* ---------- seeds ---------- */
  const SEEDS_BY_TPL = {
    'no-work': [
      { tplId: 'no-work', v: { FULL_NAME: 'عبد الرحمن الإدريسي', CIN: 'EA325805', BIRTH_DATE: '1986-04-18', ADDRESS: 'حي السلام، زنقة 28، رقم 109', CITY: 'خنيفرة', REQUEST_DATE: '2026-09-12' }, fmt: { BIRTH_DATE: { f: 0, d: 0 }, REQUEST_DATE: { f: 0, d: 0 } }, loops: {} },
      { tplId: 'no-work', v: { FULL_NAME: 'عبد الرحمن الإدريسي', CIN: 'EA325805', BIRTH_DATE: '1986-04-18', ADDRESS: 'حي السلام، زنقة 28، رقم 109', CITY: 'خنيفرة', REQUEST_DATE: '2026-09-12' }, fmt: { BIRTH_DATE: { f: 3, d: 0 }, REQUEST_DATE: { f: 3, d: 1 } }, loops: {} }
    ],
    'collective-life': [
      {
        tplId: 'collective-life',
        v: {
          'DECLARANT.full_name': 'محمد العالمي',
          'DECLARANT.cin': 'D12234343',
          'DECLARANT.address': 'حي المدينة زنقة 15 رقم 250 مكناس',
          FATHER_NAME: 'العالمي أحمد',
          FATHER_CIN: 'D12234343',
          FATHER_ADDRESS: 'حي المحمدي، زنقة 5',
          CITY: 'خنيفرة',
          DOCUMENT_DATE: '2026-09-26'
        },
        fmt: { DOCUMENT_DATE: { f: 3, d: 0 } },
        loops: {
          CHILDREN: [
            { full_name: 'ياسين العالمي', birth_date: '2015-03-12', cin: '', _fmt: { birth_date: { f: 3, d: 0 } } },
            { full_name: 'سارة العالمي', birth_date: '2017-09-22', cin: 'EA325805', _fmt: { birth_date: { f: 3, d: 0 } } }
          ]
        }
      },
      {
        tplId: 'collective-life',
        v: {
          'DECLARANT.full_name': 'فاطمة الزهراء بنعلي',
          'DECLARANT.cin': 'EA325805',
          'DECLARANT.address': 'حي السلام، زنقة 28، رقم 109',
          FATHER_NAME: 'بنعلي إدريس',
          FATHER_CIN: 'EA325805',
          FATHER_ADDRESS: 'حي النخيل، شارع 5، رقم 32',
          CITY: 'مكناس',
          DOCUMENT_DATE: '2026-09-12'
        },
        fmt: { DOCUMENT_DATE: { f: 3, d: 1 } },
        loops: {
          CHILDREN: [
            { full_name: 'سارة بنعلي', birth_date: '2017-09-22', cin: '', _fmt: { birth_date: { f: 3, d: 0 } } },
            { full_name: 'إيمان بنعلي', birth_date: '2018-11-05', cin: '', _fmt: { birth_date: { f: 3, d: 0 } } }
          ]
        }
      }
    ],
    'honor': [
      { tplId: 'honor', v: { DECLARANT_NAME: 'عبد الرحمن الإدريسي', DECLARANT_CIN: 'EW410378', DECLARANT_BIRTH_DATE: '1986-04-18', DECLARANT_PROFESSION: 'موظف(ة)', DECLARANT_ADDRESS: 'حي الأمل، زنقة 23، رقم 70', CITY: 'خنيفرة', REQUEST_DATE: '2026-09-26' }, fmt: { DECLARANT_BIRTH_DATE: { f: 3, d: 0 }, REQUEST_DATE: { f: 3, d: 0 } }, loops: {} },
      { tplId: 'honor', v: { DECLARANT_NAME: 'سمية التازي', DECLARANT_CIN: 'CO391756', DECLARANT_BIRTH_DATE: '1998-09-10', DECLARANT_PROFESSION: 'تاجر(ة)', DECLARANT_ADDRESS: 'حي النخيل، شارع 5، رقم 32', CITY: 'مكناس', REQUEST_DATE: '2026-09-12' }, fmt: { DECLARANT_BIRTH_DATE: { f: 4, d: 0 }, REQUEST_DATE: { f: 4, d: 0 } }, loops: {} }
    ]
  };

  function applySnap(snap, formatOnly) {
    if (snap.tplId && snap.tplId !== active.id) {
      const target = PARTS.find((p) => p.id === snap.tplId);
      if (target) { setActiveTemplate(target, true); }
    }
    if (!formatOnly) {
      active.fields.forEach((k) => { if (el(k)) el(k).value = (snap.v && snap.v[k]) || ''; });
      // Restore loops
      if (snap.loops) {
        (active.loops || []).forEach((loopDef) => {
          if (snap.loops[loopDef.name]) {
            loops[loopDef.name] = JSON.parse(JSON.stringify(snap.loops[loopDef.name]));
            syncLoopUI(loopDef.name);
          }
        });
      }
    }
    active.dates.forEach((k) => {
      fmt[k] = (snap.fmt && snap.fmt[k]) ? { ...snap.fmt[k] } : { f: 0, d: 0 };
      syncDateUI(k);
    });
    render();
    if (viewport) viewport.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function bindItem(item, snap) {
    const [onlyFmt, restore] = item.querySelectorAll('button');
    if (onlyFmt) onlyFmt.addEventListener('click', () => applySnap(snap, true));
    if (restore) restore.addEventListener('click', () => applySnap(snap, false));
  }

  function bindHistoryItems() {
    const seeds = SEEDS_BY_TPL[active.id] || SEEDS_BY_TPL['no-work'];
    [...list.children].forEach((c, i) => {
      const snap = seeds[i] || seeds[0];
      const p = c.querySelector('p.font-medium');
      if (p) p.textContent = filenameFor(snap);
      bindItem(c, snap);
    });
  }

  function filenameFor(snap) {
    const slug = templateFileSlug({ id: snap.tplId || active.id });
    const name = (snap.v && (snap.v.FULL_NAME || snap.v['DECLARANT.full_name'] || snap.v.DECLARANT_NAME)) || '';
    const safe = String(name).trim().replace(/\s+/g, '_');
    const now = new Date();
    const hhmm = String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0');
    return `${slug}__${safe}_${hhmm}.pdf`;
  }

  function addExport(snap) {
    const item = template_item.cloneNode(true);
    item.querySelector('p.font-medium').textContent = filenameFor(snap);
    item.querySelector('p.text-muted-foreground').lastChild.textContent = 'الآن';
    list.prepend(item);
    while (list.children.length > 5) list.lastElementChild.remove();
    bindItem(item, snap);
  }

  function printDocs(snaps) {
    const title = filenameFor(snaps[0]).replace(/\.pdf$/, '');
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
    document.body.appendChild(frame);
    const d = frame.contentDocument;
    d.open();
    const html = snaps.map((s) => {
      const tpl = PARTS.find((p) => p.id === s.tplId) || active;
      const save = active; active = tpl;
      const out = `<div class="doc">${docHTML(s)}</div>`;
      active = save;
      return out;
    }).join('');
    d.write(
      `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${esc(title)}</title>` +
      `<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet">` +
      `<style>@page{size:A4;margin:20mm}html,body{margin:0;padding:0;background:#fff;color:#000}` +
      `.doc{page-break-after:always;break-after:page}.doc:last-child{page-break-after:auto;break-after:auto}p{margin:0 0 .8em;min-height:1em}</style></head>` +
      `<body>${html}</body></html>`
    );
    d.close();
    let fired = false;
    const go = () => {
      if (fired) return;
      fired = true;
      try { frame.contentWindow.focus(); frame.contentWindow.print(); } catch (e) { window.print(); }
      setTimeout(() => frame.remove(), 3000);
    };
    (d.fonts && d.fonts.ready ? d.fonts.ready : Promise.resolve()).then(() => setTimeout(go, 150));
    setTimeout(go, 2500);
  }

  host.addEventListener('click', (e) => {
    const target = e.target.closest('button');
    if (!target) return;
    const grid = host.querySelector('.grid.gap-2');
    if (grid && grid.contains(target) && target === grid.querySelector('button')) {
      const cur = snapshot();
      const curOk = active.required.every((k) => el(k) && el(k).value.trim());
      if (!curOk && !queue.length) { flashMissing(); return; }
      const snaps = [...queue, ...(curOk ? [cur] : [])];
      printDocs(snaps);
      snaps.forEach(addExport);
      queue.length = 0;
      setBadge();
      return;
    }
    if (grid && grid.nextElementSibling && grid.nextElementSibling.contains(target) && target === grid.nextElementSibling) {
      if (flashMissing()) return;
      queue.push(snapshot());
      setBadge();
      return;
    }
  });

  /* ---------- initial sample data ---------- */
  const INITIAL_BY_TPL = {
    'no-work': { FULL_NAME: 'عبد الرحمن الإدريسي', CIN: 'EW410378', BIRTH_DATE: '1986-04-18', ADDRESS: 'حي الأمل، زنقة 23، رقم 70' },
    'collective-life': {
      'DECLARANT.full_name': 'محمد العالمي',
      'DECLARANT.cin': 'D12234343',
      'DECLARANT.address': 'حي المدينة زنقة 15 رقم 250 مكناس',
      FATHER_NAME: 'العالمي أحمد',
      FATHER_CIN: 'D12234343',
      FATHER_ADDRESS: 'حي المحمدي، زنقة 5',
      CITY: 'خنيفرة',
      DOCUMENT_DATE: todayISO()
    },
    'honor': {
      DECLARANT_NAME: 'عبد الرحمن الإدريسي', DECLARANT_CIN: 'EW410378', DECLARANT_BIRTH_DATE: '1986-04-18',
      DECLARANT_PROFESSION: 'موظف(ة)', DECLARANT_ADDRESS: 'حي الأمل، زنقة 23، رقم 70'
    }
  };

  const INITIAL_LOOPS_BY_TPL = {
    'collective-life': {
      CHILDREN: [
        { full_name: 'ياسين العالمي', birth_date: '2015-03-12', cin: '', _fmt: { birth_date: { f: 3, d: 0 } } },
        { full_name: 'سارة العالمي', birth_date: '2017-09-22', cin: 'EA325805', _fmt: { birth_date: { f: 3, d: 0 } } }
      ]
    }
  };

  /* ---------- activate template ---------- */
  function setActiveTemplate(tpl, keepHistory) {
    active = tpl;
    initFmt();
    initLoops();
    host.innerHTML = active.panel;
    bindChromeOnce();
    bindInputs();
    // populate initial sample data
    const init = INITIAL_BY_TPL[active.id] || {};
    Object.entries(init).forEach(([k, v]) => { if (el(k)) el(k).value = v; });
    // populate initial loop data (overrides the empty default rows)
    const initLoopsData = INITIAL_LOOPS_BY_TPL[active.id] || {};
    Object.entries(initLoopsData).forEach(([name, arr]) => {
      if (loops[name]) {
        loops[name] = JSON.parse(JSON.stringify(arr));
        syncLoopUI(name);
      }
    });
    active.dates.forEach(syncDateUI);
    (active.loops || []).forEach((loopDef) => syncLoopUI(loopDef.name));
    render();
    if (selector) {
      [...selector.children].forEach((btn) => {
        btn.classList.toggle('dm-tpl-active', btn.dataset.tpl === active.id);
      });
    }
    if (viewport) viewport.scrollTo({ top: 0, behavior: 'smooth' });
    // js/ai-flow.js listens to this so the node board stays in step with the demo
    document.dispatchEvent(new CustomEvent('demo:template', { detail: { id: active.id } }));
  }

  function applyActiveTemplate(skipInitial) {
    if (skipInitial) {
      const snap = snapshot();
      setActiveTemplate(active);
      active.fields.forEach((k) => { if (el(k) && snap.v[k]) el(k).value = snap.v[k]; });
      active.dates.forEach((k) => { if (snap.fmt[k]) { fmt[k] = { ...snap.fmt[k] }; syncDateUI(k); } });
      if (snap.loops) {
        Object.entries(snap.loops).forEach(([name, arr]) => {
          if (loops[name]) {
            loops[name] = JSON.parse(JSON.stringify(arr));
            syncLoopUI(name);
          }
        });
      }
      render();
    } else {
      setActiveTemplate(active);
    }
  }

  if (selector) {
    selector.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-tpl]');
      if (!btn) return;
      const tpl = PARTS.find((p) => p.id === btn.dataset.tpl);
      if (tpl && tpl.id !== active.id) setActiveTemplate(tpl);
    });
  }

  /* ---------- public hook used by js/ai-flow.js (the AI node board delivers templates here) ---------- */
  window.__demo = {
    parts: PARTS,
    activeId: function () { return active.id; },
    select: function (id) {
      const tpl = PARTS.find((p) => p.id === id);
      if (tpl && tpl.id !== active.id) setActiveTemplate(tpl);
    }
  };

  /* ---------- bootstrap ---------- */
  setActiveTemplate(PARTS[0]);
  window.addEventListener('load', () => setTimeout(fit, 300));
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
})();
