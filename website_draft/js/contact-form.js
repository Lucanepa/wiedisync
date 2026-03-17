/**
 * KSCW Contact Form — Dynamic Team Dropdown + Submission
 *
 * Reads URL params (?sport=volleyball&team=H1&teamId=xxx) to pre-fill.
 * Fetches active teams from PB when a sport subject is selected.
 * Submits to POST /api/contact with Turnstile CAPTCHA.
 */
(function () {
  'use strict';

  var PB = 'https://kscw-api.lucanepa.com';
  var TURNSTILE_SITE_KEY = '0x4AAAAAACoYmx3xiDfRbmv9';

  var betreffSelect = document.getElementById('betreff');
  var teamGroup = document.getElementById('team-group');
  var teamSelect = document.getElementById('team-select');
  var form = document.getElementById('contact-form');
  var feedback = document.getElementById('form-feedback');
  var submitBtn = form ? form.querySelector('.form-submit') : null;

  if (!betreffSelect || !form) return;

  // ── URL Params ────────────────────────────────────────────────────
  var params = new URLSearchParams(window.location.search);
  var prefillSport = params.get('sport');
  var prefillTeamId = params.get('teamId');

  // ── Turnstile widget ──────────────────────────────────────────────
  var turnstileWidgetId = null;
  var turnstileContainer = document.getElementById('turnstile-container');

  function renderTurnstile() {
    if (!turnstileContainer || !window.turnstile) return;
    if (turnstileWidgetId !== null) return;
    turnstileWidgetId = window.turnstile.render(turnstileContainer, {
      sitekey: TURNSTILE_SITE_KEY,
      theme: 'auto',
    });
  }

  if (window.turnstile) {
    renderTurnstile();
  } else {
    var pollCount = 0;
    var pollInterval = setInterval(function () {
      pollCount++;
      if (window.turnstile) { clearInterval(pollInterval); renderTurnstile(); }
      if (pollCount > 50) clearInterval(pollInterval);
    }, 100);
  }

  // ── Team cache ────────────────────────────────────────────────────
  var teamCache = {};

  function fetchTeams(sport, callback) {
    if (teamCache[sport]) return callback(teamCache[sport]);

    var url = PB + '/api/collections/teams/records'
      + '?filter=(sport=%27' + sport + '%27%20%26%26%20active=true)'
      + '&fields=id,name,league'
      + '&sort=name'
      + '&perPage=50';

    fetch(url)
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        var teams = (data && data.items) ? data.items : [];
        teamCache[sport] = teams;
        callback(teams);
      })
      .catch(function () { callback([]); });
  }

  // ── Helper: create <option> element safely ────────────────────────
  function makeOption(value, text, disabled, selected) {
    var opt = document.createElement('option');
    opt.value = value;
    opt.textContent = text;
    if (disabled) opt.disabled = true;
    if (selected) opt.selected = true;
    return opt;
  }

  // ── Populate team dropdown ────────────────────────────────────────
  function populateTeams(sport, teams) {
    if (!teamSelect || !teamGroup) return;

    var sportLabel = sport === 'volleyball' ? 'Volleyball' : 'Basketball';

    // Clear existing options using DOM methods
    while (teamSelect.firstChild) {
      teamSelect.removeChild(teamSelect.firstChild);
    }

    // Default placeholder
    teamSelect.appendChild(makeOption('', i18n.t('contactTeamPlaceholder'), true, true));

    // "Allgemein" option for the sport
    teamSelect.appendChild(makeOption('', i18n.t('generalTeamGeneral') + ' (' + sportLabel + ')', false, false));

    // Each team
    for (var i = 0; i < teams.length; i++) {
      var t = teams[i];
      var label = t.name + (t.league ? ' — ' + t.league : '');
      teamSelect.appendChild(makeOption(t.id, label, false, false));
    }

    teamGroup.style.display = '';

    // Pre-select if teamId from URL matches
    if (prefillTeamId) {
      teamSelect.value = prefillTeamId;
      prefillTeamId = null; // only apply once
    }
  }

  function hideTeamDropdown() {
    if (!teamGroup || !teamSelect) return;
    teamGroup.style.display = 'none';
    teamSelect.value = '';
  }

  // ── Betreff change handler ────────────────────────────────────────
  betreffSelect.addEventListener('change', function () {
    var val = betreffSelect.value;
    if (val === 'volleyball' || val === 'basketball') {
      fetchTeams(val, function (teams) {
        populateTeams(val, teams);
      });
    } else {
      hideTeamDropdown();
    }
  });

  // ── Pre-fill from URL params ──────────────────────────────────────
  if (prefillSport === 'volleyball' || prefillSport === 'basketball') {
    betreffSelect.value = prefillSport;
    fetchTeams(prefillSport, function (teams) {
      populateTeams(prefillSport, teams);
    });
  }

  // ── Feedback helpers ──────────────────────────────────────────────
  function showFeedback(type, msg) {
    if (!feedback) return;
    feedback.className = 'form-feedback form-feedback--' + type;
    feedback.textContent = msg;
    feedback.style.display = '';
  }

  function hideFeedback() {
    if (!feedback) return;
    feedback.style.display = 'none';
  }

  function setLoading(loading) {
    if (!submitBtn) return;
    submitBtn.disabled = loading;
    if (loading) {
      submitBtn.dataset.originalText = submitBtn.textContent;
      submitBtn.textContent = i18n.t('contactSending');
    } else {
      submitBtn.textContent = submitBtn.dataset.originalText || i18n.t('contactSubmit');
    }
  }

  // ── Form submit ───────────────────────────────────────────────────
  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    hideFeedback();

    var firstName = (document.getElementById('vorname').value || '').trim();
    var lastName = (document.getElementById('nachname').value || '').trim();
    var email = (document.getElementById('email').value || '').trim();
    var subject = betreffSelect.value;
    var teamIdVal = (teamSelect && teamGroup.style.display !== 'none') ? teamSelect.value : '';
    var message = (document.getElementById('nachricht').value || '').trim();

    // Client-side validation
    if (!firstName || !lastName) return showFeedback('error', i18n.t('contactValidationName'));
    if (!email) return showFeedback('error', i18n.t('contactValidationEmail'));
    if (!subject) return showFeedback('error', i18n.t('contactValidationSubject'));
    if (!message) return showFeedback('error', i18n.t('contactValidationMessage'));

    // Turnstile token
    var turnstileToken = '';
    if (window.turnstile && turnstileWidgetId !== null) {
      turnstileToken = window.turnstile.getResponse(turnstileWidgetId) || '';
    }
    if (!turnstileToken) return showFeedback('error', i18n.t('contactValidationCaptcha'));

    setLoading(true);

    fetch(PB + '/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        first_name: firstName,
        last_name: lastName,
        email: email,
        subject: subject,
        team_id: teamIdVal,
        message: message,
        turnstile_token: turnstileToken,
      }),
    })
      .then(function (r) {
        if (!r.ok) return r.json().then(function (d) { throw new Error(d.message || i18n.t('contactError')); });
        return r.json();
      })
      .then(function () {
        showFeedback('success', i18n.t('contactSuccess'));
        form.reset();
        hideTeamDropdown();
        if (window.turnstile && turnstileWidgetId !== null) {
          window.turnstile.reset(turnstileWidgetId);
        }
      })
      .catch(function (err) {
        showFeedback('error', err.message || i18n.t('contactErrorRetry'));
      })
      .finally(function () {
        setLoading(false);
      });
  });

  // ── Language change handler ───────────────────────────────────────
  document.addEventListener('langChanged', function () {
    if (window.i18n) {
      i18n.applyTranslations(document.querySelector('.contact-form') || document.querySelector('form'));
      var btn = document.getElementById('contact-submit') || document.querySelector('button[type="submit"]');
      if (btn && !btn.disabled) btn.textContent = i18n.t('contactSubmit');
      // Update dynamically generated select option placeholders
      var teamPlaceholder = document.querySelector('#team-select option[value=""]');
      if (teamPlaceholder) teamPlaceholder.textContent = i18n.t('contactTeamPlaceholder');
    }
  });
})();
