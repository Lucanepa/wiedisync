/* ================================================================
   KSC Wiedikon — Internationalization (i18n) Module
   Plain vanilla JS, no dependencies.
   Detects language, loads JSON translations, applies to DOM.
   ================================================================ */

(function () {
  'use strict';

  var cache = {};
  var currentLang = 'de';
  var readyResolve;

  window.i18nReady = new Promise(function (resolve) {
    readyResolve = resolve;
  });

  /* ── Language Detection ───────────────────────────────────── */

  function detectLang() {
    var stored = localStorage.getItem('lang');
    if (stored) return stored;
    if (navigator.language && navigator.language.startsWith('en')) return 'en';
    return 'de';
  }

  /* ── Load Translations ────────────────────────────────────── */

  function loadTranslations(lang) {
    if (cache[lang]) {
      currentLang = lang;
      document.documentElement.lang = lang;
      return Promise.resolve(cache[lang]);
    }

    return fetch('/js/i18n/' + lang + '.json?v=1')
      .then(function (res) {
        if (!res.ok) throw new Error('Failed to load translations for ' + lang);
        return res.json();
      })
      .then(function (data) {
        cache[lang] = data;
        currentLang = lang;
        document.documentElement.lang = lang;
        return data;
      });
  }

  /* ── Translation Lookup ───────────────────────────────────── */

  function t(key, params) {
    var strings = cache[currentLang] || {};
    var value = strings[key];
    if (value === undefined) return key;

    if (params) {
      Object.keys(params).forEach(function (k) {
        value = value.split('{' + k + '}').join(params[k]);
      });
    }

    return value;
  }

  /* ── Apply Translations to DOM ────────────────────────────── */

  function applyTranslations(container) {
    var root = container || document;

    // data-i18n → textContent
    var textNodes = root.querySelectorAll('[data-i18n]');
    for (var i = 0; i < textNodes.length; i++) {
      var key = textNodes[i].getAttribute('data-i18n');
      if (key) textNodes[i].textContent = t(key);
    }

    // data-i18n-html → innerHTML
    // Safe: values come exclusively from our own bundled JSON translation
    // files which are static assets under our control, not user input.
    var htmlNodes = root.querySelectorAll('[data-i18n-html]');
    for (var j = 0; j < htmlNodes.length; j++) {
      var htmlKey = htmlNodes[j].getAttribute('data-i18n-html');
      if (htmlKey) htmlNodes[j].innerHTML = t(htmlKey);
    }

    // data-i18n-placeholder → placeholder attribute
    var phNodes = root.querySelectorAll('[data-i18n-placeholder]');
    for (var p = 0; p < phNodes.length; p++) {
      var phKey = phNodes[p].getAttribute('data-i18n-placeholder');
      if (phKey) phNodes[p].setAttribute('placeholder', t(phKey));
    }

    // data-i18n-title → title attribute
    var titleNodes = root.querySelectorAll('[data-i18n-title]');
    for (var ti = 0; ti < titleNodes.length; ti++) {
      var titleKey = titleNodes[ti].getAttribute('data-i18n-title');
      if (titleKey) titleNodes[ti].setAttribute('title', t(titleKey));
    }

    // data-i18n-aria-label → aria-label attribute
    var ariaNodes = root.querySelectorAll('[data-i18n-aria-label]');
    for (var a = 0; a < ariaNodes.length; a++) {
      var ariaKey = ariaNodes[a].getAttribute('data-i18n-aria-label');
      if (ariaKey) ariaNodes[a].setAttribute('aria-label', t(ariaKey));
    }

    // <meta name="i18n-title"> → document.title
    var metaTitle = document.querySelector('meta[name="i18n-title"]');
    if (metaTitle) {
      var metaKey = metaTitle.getAttribute('content');
      if (metaKey) document.title = t(metaKey);
    }
  }

  /* ── Update Language Switcher Buttons ─────────────────────── */

  function updateLangButtons(lang) {
    var buttons = document.querySelectorAll('.lang-btn, .lang-btn-mobile');
    for (var i = 0; i < buttons.length; i++) {
      var btn = buttons[i];
      var btnLang = btn.getAttribute('data-lang');
      var isActive = btnLang === lang;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    }
  }

  /* ── Set Language ─────────────────────────────────────────── */

  function setLang(lang) {
    localStorage.setItem('lang', lang);
    return loadTranslations(lang).then(function () {
      applyTranslations();
      updateLangButtons(lang);
      document.dispatchEvent(new CustomEvent('langChanged', { detail: { lang: lang } }));
    });
  }

  /* ── Initialize ───────────────────────────────────────────── */

  function init() {
    var lang = detectLang();
    return loadTranslations(lang).then(function () {
      if (lang !== 'de') {
        applyTranslations();
        document.body.classList.remove('i18n-loading');
      }
      updateLangButtons(lang);
      readyResolve(lang);
    });
  }

  /* ── Public API ───────────────────────────────────────────── */

  window.i18n = {
    t: t,
    setLang: setLang,
    getLang: function () { return currentLang; },
    applyTranslations: applyTranslations,
    init: init
  };

})();
