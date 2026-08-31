#!/usr/bin/env node
/**
 * build-doc.mjs — generates docs.html for the landing site.
 *
 * It parses the React "Deep Documentation" page from the MaktabatyPro app
 * (service-hub-morocco/src/pages/TemplateDeepDocPage.tsx), runs the actual
 * component in a sandbox with stubbed React/lucide/ui modules, and serializes
 * the rendered output to static HTML in three languages (ar/en/fr).
 *
 * The generated chapter bodies + a small metadata blob are injected into
 * scripts/docs-template.html, producing docs.html at the landing root.
 *
 * Usage:
 *   node scripts/build-doc.mjs
 *   (optionally override paths with env vars APP_ROOT / LANDING_ROOT)
 */

import { createRequire } from 'module';
import { readFileSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import vm from 'vm';
import os from 'os';

const SCRIPT_DIR = dirname(decodeURIComponent(new URL(import.meta.url).pathname));
const LANDING_ROOT = process.env.LANDING_ROOT || resolve(SCRIPT_DIR, '..');
const APP_ROOT = process.env.APP_ROOT || resolve(LANDING_ROOT, '..', 'service-hub-morocco');
const SRC_FILE = resolve(APP_ROOT, 'src', 'pages', 'TemplateDeepDocPage.tsx');
const TEMPLATE_FILE = resolve(SCRIPT_DIR, 'docs-template.html');
const OUT_FILE = resolve(LANDING_ROOT, 'docs.html');

// Host copy of the language state the sandbox can mutate.
const LANG_STATE = { language: 'ar', isRTL: true };
const req = createRequire(resolve(APP_ROOT, '_index.js'));
const ts = req('typescript');

// ─────────────────────────────────────────────────────────────────────────────
// 1. Source preparation: strip imports, add a full stub runtime.
// ─────────────────────────────────────────────────────────────────────────────

const ICON_NAMES = {
  ArrowLeft: 'arrow-left', ArrowRight: 'arrow-right', BookOpen: 'book-open',
  Type: 'type', Calendar: 'calendar', Hash: 'hash', List: 'list',
  ToggleLeft: 'toggle-left', ImageIcon: 'image', Pencil: 'pencil',
  Blocks: 'blocks', Repeat: 'repeat', Table2: 'table', FolderCog: 'folder-cog',
  EyeOff: 'eye-off', Variable: 'variable', Calculator: 'calculator',
  Link2: 'link', Languages: 'languages', GitBranch: 'git-branch',
  ShieldCheck: 'shield-check', Zap: 'zap', Copy: 'copy', Check: 'check',
  Search: 'search', AlertTriangle: 'alert-triangle', Lightbulb: 'lightbulb',
  Info: 'info', Cpu: 'cpu', Layers: 'layers', Sparkles: 'sparkles',
  Code2: 'code-xml', ChevronRight: 'chevron-right', BookMarked: 'book-marked',
  Menu: 'menu', X: 'x', HelpCircle: 'help-circle', FileText: 'file-text',
  Keyboard: 'keyboard', Globe: 'globe', Download: 'download',
  LifeBuoy: 'life-buoy', LayoutTemplate: 'layout-template', Database: 'database',
  Braces: 'braces', ArrowUp: 'arrow-up', Gauge: 'gauge',
};

const preamble = String.raw`
const __flatten = (arr) => {
  const out = [];
  const walk = (a) => {
    for (const x of a) {
      if (Array.isArray(x)) walk(x); else out.push(x);
    }
  };
  walk(arr);
  return out;
};
const __normalize = (v) => {
  if (Array.isArray(v)) return { tag: '__frag', props: null, children: v };
  return v;
};
const __h = function (type, props) {
  const rest = Array.prototype.slice.call(arguments, 2);
  if (typeof type === 'function') {
    const pr = props || {};
    if (rest.length) {
      const incoming = pr.children !== undefined ? __flatten([pr.children]) : [];
      pr.children = incoming.concat(__flatten(rest));
    }
    return __normalize(type(pr));
  }
  if (type === '__fragment__') return { tag: '__frag', props: null, children: __flatten(rest) };
  const pr = props || {};
  const kids = __flatten(rest);
  const pc = pr.children !== undefined ? __flatten([pr.children]) : [];
  return { tag: type, props: pr, children: pc.concat(kids) };
};
const React = {
  createElement: __h,
  Fragment: '__fragment__',
  useState: (i) => { const v = (typeof i === 'function') ? i() : i; return [v, () => {}]; },
  useMemo: (f) => f(),
  useRef: (i) => ({ current: i }),
  useEffect: () => {},
};
const { useState, useMemo, useRef, useEffect } = React;
const useNavigate = () => () => {};
const useLanguage = () => __LANG;
const cn = (...a) => a.map((x) => Array.isArray(x) ? cn.apply(null, x) : (x == null ? '' : x)).filter(Boolean).join(' ');
const toast = { success() {}, error() {} };
const __Icon = (name) => (p) => {
  const props = Object.assign({}, p || {}, { 'data-lucide': name });
  return React.createElement('i', props);
};
const __Icons = {
${Object.entries(ICON_NAMES).map(([id, name]) => `  ${id}: __Icon('${name}'),`).join('\n')}
};
const { ${Object.keys(ICON_NAMES).join(', ')} } = __Icons;
const Button = (p) => React.createElement('button', Object.assign({}, p));
const Badge = (p) => React.createElement('span', Object.assign({}, p));
const Input = (p) => React.createElement('input', Object.assign({}, p));
const Card = (p) => React.createElement('div', Object.assign({}, p));
const CardContent = Card;
const CardHeader = Card;
const CardTitle = Card;
`;

let src = readFileSync(SRC_FILE, 'utf8');
// Remove all import statements (they are replaced by the injected stubs).
src = src.replace(/^import React,.*\n/gm, '');
src = src.replace(/^import \{ useNavigate \}.*\n/gm, '');
src = src.replace(/^import \{ useLanguage \}.*\n/gm, '');
src = src.replace(/^import \{ Card[^\n]*\n/gm, '');
src = src.replace(/^import \{ Button \}.*\n/gm, '');
src = src.replace(/^import \{ Badge \}.*\n/gm, '');
src = src.replace(/^import \{ Input \}.*\n/gm, '');
src = src.replace(/^import \{\n[\s\S]*?\} from 'lucide-react';\n/gm, '');
src = src.replace(/^import \{ cn \}.*\n/gm, '');
src = src.replace(/^import \{ toast \}.*\n/gm, '');
src = src.replace(/^export default TemplateDeepDocPage;[\s\S]*$/m, '');

// ─────────────────────────────────────────────────────────────────────────────
// 2. Transpile TSX into a CommonJS-ish JS function of plain string tags.
// ─────────────────────────────────────────────────────────────────────────────

const transpiled = ts.transpileModule(preamble + src, {
  fileName: 'TemplateDeepDocPage.tsx',
  compilerOptions: {
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.CommonJS,
    jsx: ts.JsxEmit.React,
    esModuleInterop: true,
    allowJs: false,
    isolatedModules: true,
  },
}).outputText;

// Remove CommonJS noise the transpiler may add.
const finalCode = transpiled
  .replace(/^"use strict";\s*\n?/, '')
  .replace(/^Object\.defineProperty\(exports, "__esModule", \{ value: true \}\);\s*\n?/, '')
  .replace(/^exports\.__esModule = true;\s*\n?/, '')
  .replace(/^exports\.default = [\s\S]*?;\s*\n?/, '');

const sandbox = { console };
sandbox.__LANG = LANG_STATE;
vm.createContext(sandbox);
const factory = vm.runInContext(
  `(function () { ${finalCode} return TemplateDeepDocPage; })()`,
  sandbox,
  { filename: 'TemplateDeepDocPage.js' }
);

// ─────────────────────────────────────────────────────────────────────────────
// 3. Serialization helpers (plain-DOM → static HTML).
// ─────────────────────────────────────────────────────────────────────────────

const VOID = new Set(['br', 'img', 'input', 'hr', 'meta', 'link', 'area', 'base', 'col', 'embed', 'source', 'track', 'wbr']);
const ATTRS = new Set([
  'id', 'dir', 'type', 'placeholder', 'title', 'name', 'alt', 'src', 'width', 'height',
  'value', 'href', 'target', 'rel', 'role', 'open', 'checked', 'selected', 'disabled',
  'autoplay', 'controls', 'loop', 'muted', 'poster', 'download', 'downloadattr',
]);

const escAttr = (v) => String(v)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');
const escText = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function serialize(node) {
  if (node == null || node === false || node === true) return '';
  if (Array.isArray(node)) return node.map(serialize).join('');
  if (typeof node === 'string' || typeof node === 'number') return escText(node);
  if (node.tag === '__frag') return serialize(node.children);

  const props = node.props || {};
  const attrs = [];
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'key' || k === 'ref' || k === 'children' || k === 'style' || k === 'component') continue;
    if (k === 'className' || k === 'class') { attrs.push(` class="${escAttr(v)}"`); continue; }
    if (k.startsWith('on') ) continue; // handlers are wired by docs.js
    if (k.startsWith('data-') || k.startsWith('aria-') || ATTRS.has(k) || k === 'rows' || k === 'cols' || k === 'tabindex' || k === 'colspan' || k === 'rowspan') {
      attrs.push(` ${k}="${escAttr(v)}"`);
    }
  }
  const inner = serialize(node.children);
  if (VOID.has(node.tag)) return `<${node.tag}${attrs.join('')}>`;
  return `<${node.tag}${attrs.join('')}>${inner}</${node.tag}>`;
}

function textContent(node) {
  if (node == null || node === true || node === false) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node).replace(/\s+/g, ' ').trim();
  if (Array.isArray(node)) return node.map(textContent).join(' ');
  if (node.tag === '__frag') return textContent(node.children);
  const c = node.children;
  if (typeof c === 'string' || typeof c === 'number') return String(c).trim();
  return textContent(c || '');
}

function walkTree(node, fn) {
  if (node == null || typeof node !== 'object') return;
  if (Array.isArray(node)) { node.forEach((n) => walkTree(n, fn)); return; }
  fn(node);
  walkTree(node.children, fn);
}

function collectSections(root, out) {
  walkTree(root, (n) => {
    if (n && n.tag === 'section' && n.props && n.props.id) out.push(n);
  });
}

function findFirst(root, tag, classTest) {
  let found = null;
  walkTree(root, (n) => {
    if (found) return;
    if (n && n.tag === tag && n.props && typeof n.props.className === 'string' && classTest(n.props.className)) found = n;
  });
  return found;
}

// Add a stable hook on every rendered <button> so docs.js can wire copying.
function markCopyButtons(root) {
  walkTree(root, (n) => {
    if (n && n.tag === 'button') {
      n.props = Object.assign({}, n.props, { 'data-doc-copy': '' });
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Extract table-of-contents labels from the TSX source (authoritative).
// ─────────────────────────────────────────────────────────────────────────────

const tocRe = /\{\s*id:\s*'([^']+)',\s*icon:\s*[A-Za-z0-9_]+,\s*label:\s*tx\(\s*'([^']*)',\s*'([^']*)',\s*'([^']*)'(?:,\s*'[^']*')*\s*\)\s*\}/g;
const tocRaw = [];
let tm;
while ((tm = tocRe.exec(src)) !== null) {
  tocRaw.push({ id: tm[1], ar: tm[2], en: tm[3], fr: tm[4] });
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Render per language and build the final metadata + bodies.
// ─────────────────────────────────────────────────────────────────────────────

const LANGS = ['ar', 'en', 'fr'];
const meta = {};
const bodies = {};

// Simple, plain-language page titles (the component's H1 uses heavier phrasing).
const SIMPLE_TITLES = {
  ar: 'لغة قوالب MaktabatyPro',
  en: 'MaktabatyPro Template Language',
  fr: 'Langage de modèles MaktabatyPro',
};

for (const lang of LANGS) {
  LANG_STATE.language = lang;
  LANG_STATE.isRTL = lang === 'ar';

  const root = factory();

  const sections = [];
  collectSections(root, sections);
  markCopyButtons(root);

  const h1 = findFirst(root, 'h1', () => true);
  const subP = findFirst(root, 'p', (c) => c.includes('text-muted-foreground max-w-3xl'));
  const chips = [];
  walkTree(root, (n) => {
    if (n && n.tag === 'span' && n.props && typeof n.props.className === 'string' &&
        n.props.className.includes('rounded-full') && n.props.className.includes('bg-muted')) {
      const t = textContent(n);
      if (t) chips.push(t);
    }
  });

  meta[lang] = {
    title: SIMPLE_TITLES[lang] || textContent(h1) || 'MaktabatyPro Template Language',
    subtitle: textContent(subP) || '',
    chips,
    toc: tocRaw.map((t) => ({ id: t.id, label: t[lang] })),
  };

  bodies[lang] = sections
    .map(serialize)
    .map((html) => html.replace(/src="\/logo\.png"/g, 'src="assets/icon.webp"'))
    .join('\n\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Inject into the shell template and write docs.html.
// ─────────────────────────────────────────────────────────────────────────────

let template = readFileSync(TEMPLATE_FILE, 'utf8');

const bodiesHtml = LANGS.map((lang) =>
  `<div data-doc-lang="${lang}" class="doc-body">\n${bodies[lang]}\n</div>`
).join('\n');

template = template.replace('/*__DOC_META__*/', `window.DOC_META = ${JSON.stringify(meta)};`);
template = template.replace('<!--__DOC_BODIES__-->', bodiesHtml);

writeFileSync(OUT_FILE, template);

const sizeKb = Math.round(readFileSync(OUT_FILE, 'utf8').length / 1024);
const chapters = tocRaw.length;
console.log('Wrote', OUT_FILE, `(${sizeKb} KB, ${chapters} chapters x ${LANGS.length} langs)`);