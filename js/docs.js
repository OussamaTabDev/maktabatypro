(function () {
  'use strict';

  var LANGS = ['ar', 'en', 'fr'];
  var SUPPORTED = { ar: 1, en: 1, fr: 1 };
  var QUICK_IDS = ['intro', 'fieldtypes', 'conditionals', 'tables', 'cookbook', 'faq'];
  var VERSION = 'v=20260829-redesign';

  var currentLang = 'ar';
  var currentToc = [];
  var activeId = null;
  var translations = {};

  // ########## LANGUAGE HELPERS (mirrors js/app.js) ##########

  function detectLanguage() {
    var params = new URLSearchParams(window.location.search);
    var urlLang = params.get('lang');
    if (urlLang && SUPPORTED[urlLang]) return urlLang;
    var stored = localStorage.getItem('maktabaty_lang');
    if (stored && SUPPORTED[stored]) return stored;
    return 'ar';
  }

  function t(key, fallback) {
    return translations[key] || fallback || '';
  }

  function applyTranslations() {
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var key = el.getAttribute('data-i18n');
      if (!translations[key]) return;
      if (el.tagName === 'TITLE') {
        document.title = translations[key];
      } else {
        el.innerHTML = translations[key];
      }
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-placeholder');
      if (translations[key]) el.placeholder = translations[key];
    });
    document.querySelectorAll('[data-i18n-alt]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-alt');
      if (translations[key]) el.alt = translations[key];
    });
    document.querySelectorAll('[data-i18n-value]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-value');
      if (translations[key]) el.value = translations[key];
    });
    document.querySelectorAll('[data-i18n-title]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-title');
      if (translations[key]) el.title = translations[key];
    });
  }

  function setDirection(lang) {
    var html = document.documentElement;
    if (lang === 'ar') {
      html.dir = 'rtl';
      html.lang = 'ar';
    } else {
      html.dir = 'ltr';
      html.lang = lang;
    }
  }

  function setDirectionalIcons() {
    var isRtl = currentLang === 'ar';
    var prevIcon = document.getElementById('docsPrevIcon');
    var nextIcon = document.getElementById('docsNextIcon');
    if (prevIcon) prevIcon.setAttribute('data-lucide', isRtl ? 'chevron-right' : 'chevron-left');
    if (nextIcon) nextIcon.setAttribute('data-lucide', isRtl ? 'chevron-left' : 'chevron-right');
  }

  function updateLangButtons() {
    document.querySelectorAll('[data-lang]').forEach(function (el) {
      var on = el.getAttribute('data-lang') === currentLang;
      el.classList.toggle('text-white', on);
      el.classList.toggle('text-dim', !on);
    });
  }

  function loadTranslations(lang) {
    return fetch('lang/' + lang + '.json?' + VERSION)
      .then(function (res) { return res.ok ? res.json() : Promise.reject(); })
      .catch(function () {
        if (window.__langPack && window.__langPack[lang]) return window.__langPack[lang];
        return Promise.reject(new Error('no translations for ' + lang));
      });
  }

  // ########## RENDERING (hero / toc / bodies) ##########

  function metaFor() {
    return (window.DOC_META && window.DOC_META[currentLang]) || null;
  }

  function renderHero(meta) {
    var title = document.getElementById('docsHeroTitle');
    var subtitle = document.getElementById('docsHeroSubtitle');
    var chips = document.getElementById('docsHeroChips');
    var count = document.getElementById('docsTocCount');
    if (title && meta) title.textContent = meta.title;
    if (subtitle && meta) subtitle.textContent = meta.subtitle;
    if (chips && meta) {
      chips.innerHTML = (meta.chips || []).map(function (c) {
        return '<span class="text-[11px] font-medium rounded-full bg-white/[0.05] border border-border/50 px-2.5 py-1 text-muted">' + c + '</span>';
      }).join('');
    }
    if (count && meta) count.textContent = meta.toc.length;
  }

  function tocButtonHtml(item) {
    var arrow = currentLang === 'ar' ? 'chevron-left' : 'chevron-right';
    return '' +
      '<button type="button" class="docs-toc-btn w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] text-start text-foreground/80 transition-all duration-200 hover:bg-white/[0.06] hover:text-white border border-transparent" data-toc-id="' + item.id + '">' +
        '<i data-lucide="' + arrow + '" class="h-3.5 w-3.5 shrink-0 text-muted/70"></i>' +
        '<span class="truncate leading-snug">' + item.label + '</span>' +
      '</button>';
  }

  function renderToc(meta) {
    if (!meta) return;
    var sidebar = document.getElementById('docsSidebar');
    var mobileList = document.getElementById('mobileTocList');
    var html = meta.toc.map(tocButtonHtml).join('');
    if (sidebar) sidebar.innerHTML = html;
    if (mobileList) mobileList.innerHTML = html;
  }

  function renderQuickChips(meta) {
    var wrap = document.getElementById('docsQuickChips');
    if (!wrap || !meta) return;
    var byId = {};
    meta.toc.forEach(function (item) { byId[item.id] = item.label; });
    var chips = [];
    QUICK_IDS.forEach(function (id) {
      if (!byId[id]) return;
      chips.push(
        '<button type="button" class="quick-chip text-[11px] font-semibold rounded-full border border-border/50 text-muted hover:text-foreground hover:border-border px-3 py-1.5 transition-colors" data-quick-id="' + id + '">' + byId[id] + '</button>'
      );
    });
    chips.push(
      '<button type="button" class="quick-chip text-[11px] font-semibold rounded-full border border-border/50 text-muted hover:text-foreground hover:border-border px-3 py-1.5 transition-colors" data-quick-id="__top__">\u2191 ' + t('docs.backTop', 'Back to top') + '</button>'
    );
    wrap.innerHTML = chips.join('');
  }

  function renderBodies() {
    document.querySelectorAll('.doc-body').forEach(function (el) {
      var on = el.getAttribute('data-doc-lang') === currentLang;
      el.classList.toggle('active', on);
    });
  }

  function setActiveTocBtn() {
    document.querySelectorAll('[data-toc-id]').forEach(function (btn) {
      var on = btn.getAttribute('data-toc-id') === activeId;
      btn.classList.toggle('active', on);
    });
    document.querySelectorAll('[data-quick-id]').forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-quick-id') === activeId);
    });
  }

  function renderPrevNext(meta) {
    if (!meta) return;
    var idx = meta.toc.findIndex(function (x) { return x.id === activeId; });
    var prev = idx > 0 ? meta.toc[idx - 1] : null;
    var next = idx < meta.toc.length - 1 ? meta.toc[idx + 1] : null;
    var prevLabel = document.getElementById('docsPrevLabel');
    var nextLabel = document.getElementById('docsNextLabel');
    var prevBtn = document.getElementById('docsPrev');
    var nextBtn = document.getElementById('docsNext');
    if (prevLabel) prevLabel.textContent = prev ? prev.label : '';
    if (nextLabel) nextLabel.textContent = next ? next.label : '';
    if (prevBtn) {
      prevBtn.style.pointerEvents = prev ? '' : 'none';
      prevBtn.classList.toggle('opacity-40', !prev);
    }
    if (nextBtn) {
      nextBtn.style.pointerEvents = next ? '' : 'none';
      nextBtn.classList.toggle('opacity-40', !next);
    }
    if (prevBtn) prevBtn.dataset.jumpId = prev ? prev.id : '';
    if (nextBtn) nextBtn.dataset.jumpId = next ? next.id : '';
  }

  function jumpTo(id, smooth) {
    var el = document.querySelector('.doc-body.active section[id="' + id + '"]');
    if (!el) return;
    if (smooth === false) {
      window.scrollTo({ top: el.getBoundingClientRect().top + window.pageYOffset - 96, behavior: 'auto' });
    } else {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    activeId = id;
    setActiveTocBtn();
    renderPrevNext(currentToc);
    scrollIntoViewInSidebar(id);
  }

  function scrollIntoViewInSidebar(id) {
    var aside = document.getElementById('docsSidebar');
    if (!aside) return;
    var btn = aside.querySelector('[data-toc-id="' + id + '"]');
    if (!btn) return;
    var rect = btn.getBoundingClientRect();
    var wrap = aside.closest('.doc-scroll') || aside;
    var wrect = wrap.getBoundingClientRect();
    if (rect.top < wrect.top || rect.bottom > wrect.bottom) {
      btn.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  // ########## FULL RENDER ON LANGUAGE CHANGE ##########

  function renderAll() {
    var meta = metaFor();
    currentToc = meta ? meta.toc : [];
    renderHero(meta);
    renderToc(meta);
    renderQuickChips(meta);
    renderBodies();
    activeId = currentToc.length ? currentToc[0].id : null;
    setActiveTocBtn();
    renderPrevNext(meta);
    applyTranslations();
    setDirection(currentLang);
    setDirectionalIcons();
    updateLangButtons();
    refreshIcons();
  }

  function refreshIcons() {
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
      lucide.createIcons();
    }
  }

  function switchLanguage(lang) {
    if (!SUPPORTED[lang]) return Promise.resolve();
    currentLang = lang;
    localStorage.setItem('maktabaty_lang', lang);
    return loadTranslations(lang)
      .then(function (tr) {
        translations = tr;
        renderAll();
      })
      .catch(function (err) {
        console.error('Docs i18n failed:', err);
      });
  }

  // ########## SCROLL SPY ##########

  function onScroll() {
    if (!currentToc.length) return;
    var offset = window.innerHeight * 0.25;
    var current = null;
    document.querySelectorAll('.doc-body.active section[id]').forEach(function (el) {
      if (el.getBoundingClientRect().top <= offset) current = el.id;
    });
    if (current && current !== activeId) {
      activeId = current;
      setActiveTocBtn();
      renderPrevNext(currentToc);
      scrollIntoViewInSidebar(activeId);
    }
  }

  // ########## COPY BUTTONS (generated code blocks) ##########

  function setupCopy() {
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-doc-copy]');
      if (!btn) return;
      var host = btn.closest('.relative');
      var codeEl = host ? host.querySelector('pre code') : null;
      if (!codeEl) return;
      var text = codeEl.textContent;
      var span = btn.querySelector('span');
      var apply = function () {
        if (span) span.textContent = t('docs.copied', 'Copied');
        btn.classList.add('doc-copied');
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(apply).catch(apply);
      } else {
        apply();
      }
      setTimeout(function () {
        if (span) span.textContent = t('docs.copy', span.dataset.orig || 'Copy');
        btn.classList.remove('doc-copied');
      }, 1400);
    });
  }

  // ########## MOBILE NAV / TOC DRAWER ##########

  function setupDrawers() {
    var navToggle = document.getElementById('mobileNavToggle');
    var navMenu = document.getElementById('mobileNavMenu');
    var navOverlay = document.getElementById('mobileNavOverlay');
    if (navToggle && navMenu) {
      navToggle.addEventListener('click', function () {
        var open = navToggle.getAttribute('aria-expanded') === 'true';
        navMenu.classList.toggle('hidden', open);
        navToggle.setAttribute('aria-expanded', String(!open));
        navToggle.setAttribute('aria-label', open ? 'Open menu' : 'Close menu');
      });
      if (navOverlay) navOverlay.addEventListener('click', function () { navMenu.classList.add('hidden'); navToggle.setAttribute('aria-expanded', 'false'); });
      navMenu.querySelectorAll('.mobile-nav-link').forEach(function (a) {
        a.addEventListener('click', function () {
          navMenu.classList.add('hidden');
          navToggle.setAttribute('aria-expanded', 'false');
        });
      });
    }

    var tocToggle = document.getElementById('mobileTocToggle');
    var tocDrawer = document.getElementById('mobileTocDrawer');
    var tocOverlay = document.getElementById('mobileTocOverlay');
    var tocClose = document.getElementById('mobileTocClose');
    var toggleDrawer = function (open) {
      if (!tocDrawer) return;
      tocDrawer.classList.toggle('hidden', !open);
      document.body.style.overflow = open ? 'hidden' : '';
    };
    if (tocToggle) tocToggle.addEventListener('click', function () { toggleDrawer(true); refreshIcons(); });
    if (tocOverlay) tocOverlay.addEventListener('click', function () { toggleDrawer(false); });
    if (tocClose) tocClose.addEventListener('click', function () { toggleDrawer(false); });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        toggleDrawer(false);
        if (navMenu) navMenu.classList.add('hidden');
        if (navToggle) navToggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  function setupClicks() {
    document.addEventListener('click', function (e) {
      var tocLink = e.target.closest('[data-toc-id]');
      if (tocLink) {
        jumpTo(tocLink.getAttribute('data-toc-id'));
        return;
      }
      var quick = e.target.closest('[data-quick-id]');
      if (quick) {
        var id = quick.getAttribute('data-quick-id');
        if (id === '__top__') {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
          jumpTo(id);
        }
        return;
      }
      var jumpBtn = e.target.closest('[data-jump-id]');
      if (jumpBtn && jumpBtn.dataset.jumpId) {
        jumpTo(jumpBtn.dataset.jumpId);
      }
    });

    var search = document.getElementById('docsSearch');
    if (search) {
      search.addEventListener('input', function () {
        var q = search.value.trim().toLowerCase();
        document.querySelectorAll('.docs-toc-btn').forEach(function (btn) {
          var label = btn.textContent.toLowerCase();
          var show = !q || label.indexOf(q) !== -1;
          btn.style.display = show ? '' : 'none';
        });
      });
    }

    var topSm = document.getElementById('scrollTopSmall');
    if (topSm) topSm.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });

    document.querySelectorAll('[data-lang]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        switchLanguage(btn.getAttribute('data-lang'));
      });
    });
  }

  function setupNavBackground() {
    var nav = document.getElementById('nav');
    if (!nav) return;
    window.addEventListener('scroll', function () {
      nav.style.background = window.pageYOffset > 100 ? 'rgba(11, 11, 18, 0.85)' : 'rgba(11, 11, 18, 0.65)';
    });
  }

  function setupReveal() {
    var els = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window)) {
      els.forEach(function (el) { el.classList.add('visible'); });
      return;
    }
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    els.forEach(function (el) { obs.observe(el); });
  }

  // ########## INIT ##########

  document.addEventListener('DOMContentLoaded', function () {
    currentLang = detectLanguage();

    // Preserve the generated copy button labels across language switches.
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-doc-copy]');
      if (btn && btn.querySelector('span')) {
        var span = btn.querySelector('span');
        if (!span.dataset.orig) span.dataset.orig = span.textContent;
      }
    }, true);

    setupCopy();
    setupDrawers();
    setupClicks();
    setupNavBackground();
    setupReveal();
    window.addEventListener('scroll', onScroll, { passive: true });

    loadTranslations(currentLang)
      .then(function (tr) {
        translations = tr;
        renderAll();
        activeId = currentToc.length ? currentToc[0].id : null;
        setActiveTocBtn();
        renderPrevNext(currentToc);
        onScroll();
      })
      .catch(function (err) {
        console.error('Docs init i18n failed:', err);
        renderAll();
      });
  });
})();