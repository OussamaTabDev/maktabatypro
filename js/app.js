document.addEventListener('DOMContentLoaded', async () => {

  // ======================== I18N ENGINE ========================

  function detectLanguage() {
    const params = new URLSearchParams(window.location.search);
    const urlLang = params.get('lang');
    if (urlLang && ['en', 'fr', 'ar'].includes(urlLang)) return urlLang;
    const stored = localStorage.getItem('maktabaty_lang');
    if (stored && ['en', 'fr', 'ar'].includes(stored)) return stored;
    return 'fr';
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
      const res = await fetch(`lang/${lang}.json?v=20260821-fr-default-tutorials`);
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
      renderLimitedOfferCountdown();
      if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
      }
    } catch (err) {
      console.error('Language switch failed:', err);
    }
  };

  let currentTranslations = {};

  // ======================== LIMITED-TIME MULTI OFFER ========================
  // Promotion is active through 25 August 2026 in Morocco (UTC+1).
  const OFFER_DEADLINE = '2026-08-26T00:00:00+01:00';

  function renderLimitedOfferCountdown() {
    const banner = document.getElementById('limitedOfferBanner');
    if (!banner) return;

    const deadline = Date.parse(banner.dataset.offerDeadline || OFFER_DEADLINE);
    const remaining = Math.max(0, deadline - Date.now());
    const active = Number.isFinite(deadline) && remaining > 0;

    // Hide the entire promotion after expiry; do not leave a stale zero countdown
    // or an expired-sales message visible to visitors.
    banner.hidden = !active;
    banner.setAttribute('aria-hidden', String(!active));
    banner.classList.toggle('hidden', !active);
    const totalSeconds = Math.floor(remaining / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const setText = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    };
    const t = (key, fallback) => currentTranslations[key] || fallback;
    const pad = (value) => String(value).padStart(2, '0');

    setText('offerCountdownDays', pad(days));
    setText('offerCountdownHours', pad(hours));
    setText('offerCountdownMinutes', pad(minutes));
    setText('offerCountdownSeconds', pad(seconds));

    const countdownWrap = document.getElementById('offerCountdownWrap');
    const note = document.getElementById('offerCountdownNote');
    if (countdownWrap) countdownWrap.style.display = active ? 'flex' : 'none';
    if (note) {
      note.textContent = active
        ? t('pricing.offer.activeNote', 'Offer price valid until 25 August 2026 at 23:59 Morocco time.')
        : '';
      note.classList.toggle('text-amber-200/80', active);
      note.classList.toggle('text-red-300/80', !active);
    }
    banner.classList.toggle('border-red-400/30', !active);
    banner.classList.toggle('border-amber-400/30', active);

    const offerFields = [
      ['multiPrice', 'pricing.multi.price', 'pricing.multi.expiredPrice'],
      ['multiPeriod', 'pricing.multi.period', 'pricing.multi.expiredPeriod'],
      ['multiMachines', 'pricing.multi.machines', 'pricing.multi.expiredMachines'],
      ['multiLifetime', 'pricing.multi.lifetime', 'pricing.multi.expiredLifetime'],
      ['multiFeature2', 'pricing.multi.feature2', 'pricing.multi.expiredFeature2'],
      ['multiFeature3', 'pricing.multi.feature3', 'pricing.multi.expiredFeature3'],
      ['multiExtraText', 'pricing.multi.extratext', 'pricing.multi.expiredExtraText'],
      ['multiOfferButton', 'pricing.multi.button', 'pricing.multi.expiredButton'],
    ];
    offerFields.forEach(([id, activeKey, expiredKey]) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (active) {
        // Translation application owns active copy; this keeps the markup correct after language changes.
        if (currentTranslations[activeKey]) el.innerHTML = currentTranslations[activeKey];
      } else if (currentTranslations[expiredKey]) {
        el.innerHTML = currentTranslations[expiredKey];
      }
    });
  }

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
  renderLimitedOfferCountdown();
  window.setInterval(renderLimitedOfferCountdown, 1000);

  // ======================== LUCIDE ICONS ========================
  if (typeof lucide !== 'undefined' && lucide.createIcons) {
    lucide.createIcons();
  }

  // ======================== DOWNLOAD CHOOSER ========================
  const downloadChooserModal = document.getElementById('downloadChooserModal');
  const downloadChooserOverlay = document.getElementById('downloadChooserOverlay');
  const closeDownloadChooserBtn = document.getElementById('closeDownloadChooser');
  const versionWrap = document.getElementById('downloadChooserVersionWrap');
  const versionEl = document.getElementById('downloadChooserVersion');

  let latestVersion = null;

  async function refreshLatestVersion() {
    if (!versionWrap || !versionEl) return;
    if (latestVersion) {
      versionEl.textContent = 'Latest version: v' + latestVersion;
      versionWrap.style.display = 'inline-flex';
      return;
    }
    try {
      const res = await fetch('https://api.github.com/repos/OussamaTabDev/maktabatypro/releases/latest');
      if (!res.ok) return;
      const release = await res.json();
      if (release && release.tag_name) {
        latestVersion = release.tag_name.replace(/^v/i, '');
        versionEl.textContent = 'Latest version: v' + latestVersion;
        versionWrap.style.display = 'inline-flex';
      }
    } catch (e) {
      // silently keep the badge hidden
    }
  }

  function openDownloadChooser(e) {
    if (e) e.preventDefault();
    closeContactModal();
    refreshLatestVersion();
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
        asset = release.assets.find(a => /MaktabatyPro-Setup-.*\.exe$/.test(a.name)) || release.assets.find(a => a.name.endsWith('.exe')) || release.assets.find(a => a.name.endsWith('.msi'));
      } else if (ext === '.win7exe') {
        asset = release.assets.find(a => /MaktabatyPro-Win7-Setup-.*\.exe$/.test(a.name)) || release.assets.find(a => a.name.endsWith('.exe'));
      } else if (ext === '.deb') {
        asset = release.assets.find(a => a.name.endsWith('.deb'));
      } else if (ext === '.AppImage') {
        asset = release.assets.find(a => a.name.endsWith('.AppImage'));
      } else if (ext === '.rpm') {
        asset = release.assets.find(a => a.name.endsWith('.rpm'));
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

    closeDownloadChooser();
    openInstallGuide();
  }

  document.querySelectorAll('.download-option').forEach(opt => {
    opt.addEventListener('click', () => downloadAsset(opt.dataset.ext));
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeDownloadChooser();
  });

  // ======================== INSTALL GUIDE MODAL ========================
  const installGuideModal = document.getElementById('installGuideModal');
  const installGuideOverlay = document.getElementById('installGuideOverlay');
  const closeInstallGuideBtn = document.getElementById('closeInstallGuide');
  const installGuideDoneBtn = document.getElementById('installGuideDone');

  function openInstallGuide() {
    if (!installGuideModal) return;
    installGuideModal.classList.remove('invisible', 'opacity-0');
    document.body.style.overflow = 'hidden';
  }

  function closeInstallGuide() {
    if (!installGuideModal) return;
    installGuideModal.classList.add('invisible', 'opacity-0');
    document.body.style.overflow = '';
  }

  if (closeInstallGuideBtn) closeInstallGuideBtn.addEventListener('click', closeInstallGuide);
  if (installGuideDoneBtn) installGuideDoneBtn.addEventListener('click', closeInstallGuide);
  if (installGuideOverlay) installGuideOverlay.addEventListener('click', closeInstallGuide);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeInstallGuide();
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
