/* ================================================================
   KSC Wiedikon — Main JavaScript
   Plain vanilla JS, no dependencies.
   ================================================================ */

(function () {
  'use strict';

  /* ── 1. Sticky Header Shadow ──────────────────────────────── */

  function initStickyHeader() {
    var header = document.querySelector('.site-header');
    if (!header) return;

    function onScroll() {
      header.classList.toggle('scrolled', window.scrollY > 10);
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll(); // set initial state
  }

  /* ── 2. Mobile Navigation ─────────────────────────────────── */

  function initMobileNav() {
    var hamburger = document.querySelector('.nav-hamburger');
    var mobileNav = document.querySelector('.mobile-nav');
    if (!hamburger) return;

    // Toggle mobile nav open/close
    hamburger.addEventListener('click', function (e) {
      e.stopPropagation();
      document.body.classList.toggle('nav-open');
    });

    // Close when clicking outside the mobile nav
    document.addEventListener('click', function (e) {
      if (!document.body.classList.contains('nav-open')) return;
      if (mobileNav && mobileNav.contains(e.target)) return;
      if (hamburger.contains(e.target)) return;
      document.body.classList.remove('nav-open');
    });

    // Close when clicking a link inside mobile nav
    if (mobileNav) {
      mobileNav.addEventListener('click', function (e) {
        var link = e.target.closest('a');
        if (link) {
          document.body.classList.remove('nav-open');
        }
      });
    }

    // Mobile accordion sub-navigation
    var mobileLinks = document.querySelectorAll('.mobile-nav-link');
    mobileLinks.forEach(function (link) {
      var parent = link.closest('.mobile-nav-item');
      if (!parent) return;
      var subnav = parent.querySelector('.mobile-subnav');
      if (!subnav) return;

      link.addEventListener('click', function (e) {
        e.preventDefault();
        // Close other open items
        document.querySelectorAll('.mobile-nav-item.open').forEach(function (item) {
          if (item !== parent) item.classList.remove('open');
        });
        parent.classList.toggle('open');
      });
    });
  }

  /* ── 3. Desktop Dropdown Touch Support ────────────────────── */

  function initDesktopDropdowns() {
    var navItems = document.querySelectorAll('.nav-item');
    if (!navItems.length) return;

    navItems.forEach(function (item) {
      var dropdown = item.querySelector('.nav-dropdown');
      if (!dropdown) return;

      var link = item.querySelector('.nav-link');
      if (!link) return;

      // On touch devices, first tap opens dropdown, second tap follows link
      link.addEventListener('click', function (e) {
        // Only intercept on touch devices (no hover support)
        if (window.matchMedia('(hover: hover)').matches) return;

        if (!item.classList.contains('open')) {
          e.preventDefault();
          // Close other open dropdowns
          navItems.forEach(function (other) {
            if (other !== item) other.classList.remove('open');
          });
          item.classList.add('open');
        }
      });
    });

    // Close dropdowns when clicking outside
    document.addEventListener('click', function (e) {
      navItems.forEach(function (item) {
        if (!item.contains(e.target)) {
          item.classList.remove('open');
        }
      });
    });
  }

  /* ── 4. Tabs ──────────────────────────────────────────────── */

  function initTabs() {
    var tabButtons = document.querySelectorAll('[data-tab]');
    if (!tabButtons.length) return;

    function activateTab(tabId) {
      // Deactivate all tab buttons and panels
      tabButtons.forEach(function (btn) {
        btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
      });

      var panels = document.querySelectorAll('[data-tab-panel]');
      panels.forEach(function (panel) {
        panel.classList.toggle('active', panel.getAttribute('data-tab-panel') === tabId);
      });
    }

    // Click handler for tab buttons
    tabButtons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var tabId = btn.getAttribute('data-tab');
        activateTab(tabId);
        // Update URL hash without scrolling
        history.replaceState(null, '', '#' + tabId);
      });
    });

    // Activate tab from URL hash on page load
    var hash = window.location.hash.replace('#', '');
    if (hash) {
      var matchingBtn = document.querySelector('[data-tab="' + hash + '"]');
      if (matchingBtn) {
        activateTab(hash);
      }
    }
  }

  /* ── 5. Sponsor Carousel ──────────────────────────────────── */

  function initSponsorCarousel() {
    var track = document.querySelector('.sponsor-track');
    if (!track) return;

    var children = Array.from(track.children);
    if (!children.length) return;

    // Clone all children and append for seamless infinite scroll
    children.forEach(function (child) {
      var clone = child.cloneNode(true);
      clone.setAttribute('aria-hidden', 'true');
      track.appendChild(clone);
    });
  }

  /* ── 6. Scroll Animations (IntersectionObserver) ──────────── */

  function initScrollAnimations() {
    var fadeElements = document.querySelectorAll('.fade-in');
    if (!fadeElements.length) return;

    // Respect prefers-reduced-motion
    var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      fadeElements.forEach(function (el) {
        el.classList.add('visible');
      });
      return;
    }

    // Use IntersectionObserver where supported
    if (!('IntersectionObserver' in window)) {
      // Fallback: show everything immediately
      fadeElements.forEach(function (el) {
        el.classList.add('visible');
      });
      return;
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.15,
        rootMargin: '0px 0px -50px 0px',
      }
    );

    fadeElements.forEach(function (el) {
      observer.observe(el);
    });
  }

  /* ── 7. Stat Counter Animation ────────────────────────────── */

  function initStatCounters() {
    var statElements = document.querySelectorAll('.stat-number[data-value]');
    if (!statElements.length) return;

    var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function animateCounter(el) {
      var targetValue = parseInt(el.getAttribute('data-value'), 10);
      if (isNaN(targetValue)) return;

      var rawText = el.getAttribute('data-value');
      var suffix = rawText.replace(/[\d]/g, ''); // e.g., "+"

      if (prefersReducedMotion) {
        el.textContent = targetValue + suffix;
        return;
      }

      var duration = 1500;
      var startTime = null;

      function step(timestamp) {
        if (!startTime) startTime = timestamp;
        var elapsed = timestamp - startTime;
        var progress = Math.min(elapsed / duration, 1);

        // Ease-out: decelerate towards the end
        var easedProgress = 1 - Math.pow(1 - progress, 3);
        var currentValue = Math.round(easedProgress * targetValue);

        el.textContent = currentValue + (progress === 1 ? suffix : '');

        if (progress < 1) {
          requestAnimationFrame(step);
        }
      }

      requestAnimationFrame(step);
    }

    if (!('IntersectionObserver' in window) || prefersReducedMotion) {
      statElements.forEach(function (el) {
        var value = el.getAttribute('data-value');
        var num = parseInt(value, 10);
        var suffix = value.replace(/[\d]/g, '');
        el.textContent = (isNaN(num) ? value : num) + suffix;
      });
      return;
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            animateCounter(entry.target);
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.15,
      }
    );

    statElements.forEach(function (el) {
      observer.observe(el);
    });
  }

  /* ── 8. Active Nav Highlighting ───────────────────────────── */

  function initActiveNav() {
    var currentPath = window.location.pathname;
    // Normalize: remove trailing slash (except for root)
    if (currentPath !== '/' && currentPath.endsWith('/')) {
      currentPath = currentPath.slice(0, -1);
    }

    var navLinks = document.querySelectorAll('.nav-link, .dropdown-link, .mobile-nav-link, .mobile-sublink');
    navLinks.forEach(function (link) {
      var href = link.getAttribute('href');
      if (!href) return;

      // Normalize href the same way
      var linkPath = href.split('#')[0].split('?')[0];
      if (linkPath !== '/' && linkPath.endsWith('/')) {
        linkPath = linkPath.slice(0, -1);
      }

      if (linkPath === currentPath) {
        link.classList.add('active');
        // Also mark the parent .nav-item for desktop dropdown highlighting
        var parentItem = link.closest('.nav-item');
        if (parentItem) {
          var parentLink = parentItem.querySelector('.nav-link');
          if (parentLink) parentLink.classList.add('active');
        }
      }
    });
  }

  /* ── 9. Smooth Scroll for Anchor Links ────────────────────── */

  function initSmoothScroll() {
    document.addEventListener('click', function (e) {
      var link = e.target.closest('a[href*="#"]');
      if (!link) return;

      var href = link.getAttribute('href');
      // Only handle same-page anchors
      var hashIndex = href.indexOf('#');
      if (hashIndex === -1) return;

      var path = href.substring(0, hashIndex);
      // If there is a path portion, ensure it matches current page
      if (path && path !== '' && path !== window.location.pathname) return;

      var targetId = href.substring(hashIndex + 1);
      if (!targetId) return;

      var targetEl = document.getElementById(targetId);
      if (!targetEl) return;

      e.preventDefault();

      // Account for sticky header height
      var header = document.querySelector('.site-header');
      var headerHeight = header ? header.offsetHeight : 0;

      var targetPosition = targetEl.getBoundingClientRect().top + window.scrollY - headerHeight - 16;

      window.scrollTo({
        top: targetPosition,
        behavior: 'smooth',
      });

      // Update URL hash without jumping
      history.pushState(null, '', '#' + targetId);
    });
  }

  /* ── 10. Theme Toggle (dark/light) ────────────────────────── */

  function initThemeToggle() {
    // Default is dark mode. Check localStorage for user preference.
    var saved = localStorage.getItem('kscw-theme');
    if (saved === 'light') {
      document.documentElement.classList.add('light');
    }

    var toggles = document.querySelectorAll('.theme-toggle');
    toggles.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var isLight = document.documentElement.classList.toggle('light');
        localStorage.setItem('kscw-theme', isLight ? 'light' : 'dark');
        // Update button text
        toggles.forEach(function (b) {
          var icon = b.querySelector('[data-lucide]');
          var label = b.querySelector('.theme-label');
          if (icon) icon.setAttribute('data-lucide', isLight ? 'moon' : 'sun');
          if (label) label.textContent = isLight
            ? (window.i18n ? i18n.t('themeDark') : 'Dark Mode')
            : (window.i18n ? i18n.t('themeLight') : 'Light Mode');
          // Re-render lucide icons
          if (typeof lucide !== 'undefined') lucide.createIcons();
        });
      });
    });
  }

  /* ── Load Shared Header ──────────────────────────────────── */

  function loadHeader(callback) {
    var placeholder = document.getElementById('site-header');
    if (!placeholder) { if (callback) callback(); return; }

    fetch('/partials/header.html')
      .then(function (r) { return r.text(); })
      .then(function (html) {
        placeholder.outerHTML = html;
        if (callback) callback();
      })
      .catch(function () { if (callback) callback(); });
  }

  /* ── Load Shared Footer ──────────────────────────────────── */

  function loadFooter(callback) {
    var el = document.getElementById('site-footer');
    if (!el) { if (callback) callback(); return; }
    fetch('/partials/footer.html')
      .then(function (r) { return r.text(); })
      .then(function (html) {
        el.outerHTML = html;
        if (callback) callback();
      })
      .catch(function () { if (callback) callback(); });
  }

  /* ── Initialize Everything on DOM Ready ───────────────────── */

  document.addEventListener('DOMContentLoaded', function () {
    loadHeader(function () {
      initThemeToggle();
      initStickyHeader();
      initMobileNav();
      initDesktopDropdowns();
      initTabs();
      initSponsorCarousel();
      initScrollAnimations();
      initStatCounters();
      initActiveNav();
      initSmoothScroll();
      // Re-render lucide icons (header has lock icon)
      if (typeof lucide !== 'undefined') lucide.createIcons();

      // Load footer partial, then re-init theme toggle, icons, and i18n
      loadFooter(function () {
        initThemeToggle();
        if (typeof lucide !== 'undefined') lucide.createIcons();

        // Initialize i18n after header + footer are in the DOM
        if (window.i18n) {
          window.i18n.init().then(function () {
            // Wire up language toggle buttons (desktop + mobile)
            document.querySelectorAll('.lang-btn, .lang-btn-mobile').forEach(function (btn) {
              btn.addEventListener('click', function () {
                var lang = btn.getAttribute('data-lang') || 'de';
                window.i18n.setLang(lang);
              });
            });
          });
        }
      });
    });
  });
})();
