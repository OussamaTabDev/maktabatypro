document.addEventListener('DOMContentLoaded', async () => {

  // ======================== I18N ENGINE ========================

  function detectLanguage() {
    const params = new URLSearchParams(window.location.search);
    const urlLang = params.get('lang');
    if (urlLang && ['en', 'fr', 'ar'].includes(urlLang)) return urlLang;
    const stored = localStorage.getItem('maktabaty_lang');
    if (stored && ['en', 'fr', 'ar'].includes(stored)) return stored;
    return 'en';
  }

  function applyTranslations(translations) {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (translations[key]) {
        if (el.tagName === 'TITLE') {
          document.title = translations[key];
        } else {
          el.innerHTML = translations[key];
        }
      }
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (translations[key]) el.placeholder = translations[key];
    });
    document.querySelectorAll('[data-i18n-alt]').forEach(el => {
      const key = el.getAttribute('data-i18n-alt');
      if (translations[key]) el.alt = translations[key];
    });
    document.querySelectorAll('[data-i18n-value]').forEach(el => {
      const key = el.getAttribute('data-i18n-value');
      if (translations[key]) el.value = translations[key];
    });
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      const key = el.getAttribute('data-i18n-title');
      if (translations[key]) el.title = translations[key];
    });
  }

  function setLanguageDirection(lang) {
    if (lang === 'ar') {
      document.documentElement.dir = 'rtl';
      document.documentElement.lang = 'ar';
    } else {
      document.documentElement.dir = 'ltr';
      document.documentElement.lang = lang;
    }
  }

  function updateActiveLangButton(lang) {
    document.querySelectorAll('[data-lang]').forEach(el => {
      el.classList.toggle('text-white', el.getAttribute('data-lang') === lang);
      el.classList.toggle('text-dim', el.getAttribute('data-lang') !== lang);
    });
  }

  async function loadTranslations(lang) {
    try {
      const res = await fetch(`lang/${lang}.json`);
      if (res.ok) return res.json();
    } catch (e) {}
    if (window.__langPack && window.__langPack[lang]) {
      return window.__langPack[lang];
    }
    throw new Error(`Failed to load translations for ${lang}`);
  }

  window.switchLanguage = async function switchLanguage(lang) {
    localStorage.setItem('maktabaty_lang', lang);
    try {
      currentTranslations = await loadTranslations(lang);
      applyTranslations(currentTranslations);
      setLanguageDirection(lang);
      updateActiveLangButton(lang);
      if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
      }
    } catch (err) {
      console.error('Language switch failed:', err);
    }
  };

  let currentTranslations = {};

  async function initI18n() {
    const lang = detectLanguage();
    localStorage.setItem('maktabaty_lang', lang);
    try {
      currentTranslations = await loadTranslations(lang);
      applyTranslations(currentTranslations);
      setLanguageDirection(lang);
      updateActiveLangButton(lang);
    } catch (err) {
      console.error('Initial i18n load failed:', err);
    }

    document.querySelectorAll('[data-lang]').forEach(el => {
      el.addEventListener('click', () => {
        switchLanguage(el.getAttribute('data-lang'));
      });
    });
  }

  // ======================== INIT I18N ========================
  await initI18n();

  // ======================== LUCIDE ICONS ========================
  if (typeof lucide !== 'undefined' && lucide.createIcons) {
    lucide.createIcons();
  }

  // ======================== DOWNLOAD CHOOSER ========================
  const downloadChooserModal = document.getElementById('downloadChooserModal');
  const downloadChooserOverlay = document.getElementById('downloadChooserOverlay');
  const closeDownloadChooserBtn = document.getElementById('closeDownloadChooser');

  function openDownloadChooser(e) {
    if (e) e.preventDefault();
    closeContactModal();
    downloadChooserModal.classList.remove('invisible', 'opacity-0');
  }

  function closeDownloadChooser() {
    downloadChooserModal.classList.add('invisible', 'opacity-0');
  }

  if (closeDownloadChooserBtn) closeDownloadChooserBtn.addEventListener('click', closeDownloadChooser);
  if (downloadChooserOverlay) downloadChooserOverlay.addEventListener('click', closeDownloadChooser);

  async function downloadAsset(ext) {
    const options = document.querySelectorAll('.download-option');
    options.forEach(opt => {
      opt.disabled = true;
      opt.classList.add('loading');
    });

    try {
      const res = await fetch('https://api.github.com/repos/OussamaTabDev/maktabatypro/releases/latest');
      const release = await res.json();

      let asset = null;
      if (ext === '.exe') {
        asset = release.assets.find(a => a.name.endsWith('.exe')) || release.assets.find(a => a.name.endsWith('.msi'));
      } else if (ext === '.deb') {
        asset = release.assets.find(a => a.name.endsWith('.deb'));
      } else if (ext === '.AppImage') {
        asset = release.assets.find(a => a.name.endsWith('.AppImage'));
      }

      if (asset) {
        window.location.href = asset.browser_download_url;
      } else {
        window.location.href = release.html_url;
      }
    } catch (err) {
      console.error('Download failed', err);
      window.location.href = 'https://github.com/OussamaTabDev/maktabatypro/releases';
    }

    options.forEach(opt => {
      opt.disabled = false;
      opt.classList.remove('loading');
    });
  }

  document.querySelectorAll('.download-option').forEach(opt => {
    opt.addEventListener('click', () => downloadAsset(opt.dataset.ext));
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeDownloadChooser();
  });

  document.querySelectorAll('.download-btn').forEach(btn => {
    btn.dataset.originalText = btn.innerHTML;
    btn.addEventListener('click', openDownloadChooser);
  });

  // ======================== SCROLL REVEAL ========================
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

  // ======================== NAV BACKGROUND ========================
  const nav = document.getElementById('nav');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 100) {
      nav.style.background = 'rgba(5, 5, 5, 0.85)';
    } else {
      nav.style.background = 'rgba(5, 5, 5, 0.7)';
    }
  });

  // ======================== CONTACT MODAL ========================
  const contactModal = document.getElementById('contactModal');
  const modalOverlay = document.getElementById('modalOverlay');
  const closeModalBtn = document.getElementById('closeModal');

  function openContactModal(e) {
    e.preventDefault();
    contactModal.classList.remove('invisible', 'opacity-0');
  }

  function closeContactModal() {
    contactModal.classList.add('invisible', 'opacity-0');
  }

  document.querySelectorAll('.get-started-btn').forEach(btn => {
    btn.addEventListener('click', openContactModal);
  });
  if (closeModalBtn) closeModalBtn.addEventListener('click', closeContactModal);
  if (modalOverlay) modalOverlay.addEventListener('click', closeContactModal);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeContactModal();
  });

  // ======================== SMOOTH SCROLL ========================
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
});
