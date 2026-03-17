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
      + '&fields=id,name,full_name'
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
    teamSelect.appendChild(makeOption('', 'Bitte wählen...', true, true));

    // "Allgemein" option for the sport
    teamSelect.appendChild(makeOption('', 'Allgemein (' + sportLabel + ')', false, false));

    // Each team
    for (var i = 0; i < teams.length; i++) {
      var t = teams[i];
      var label = t.name + (t.full_name ? ' — ' + t.full_name : '');
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
      submitBtn.textContent = 'Wird gesendet...';
    } else {
      submitBtn.textContent = submitBtn.dataset.originalText || 'Absenden';
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
    if (!firstName || !lastName) return showFeedback('error', 'Bitte Vor- und Nachname eingeben.');
    if (!email) return showFeedback('error', 'Bitte E-Mail eingeben.');
    if (!subject) return showFeedback('error', 'Bitte Betreff wählen.');
    if (!message) return showFeedback('error', 'Bitte Nachricht eingeben.');

    // Turnstile token
    var turnstileToken = '';
    if (window.turnstile && turnstileWidgetId !== null) {
      turnstileToken = window.turnstile.getResponse(turnstileWidgetId) || '';
    }
    if (!turnstileToken) return showFeedback('error', 'Bitte das Captcha lösen.');

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
        if (!r.ok) return r.json().then(function (d) { throw new Error(d.message || 'Fehler beim Senden.'); });
        return r.json();
      })
      .then(function () {
        showFeedback('success', 'Nachricht erfolgreich gesendet! Wir melden uns bald.');
        form.reset();
        hideTeamDropdown();
        if (window.turnstile && turnstileWidgetId !== null) {
          window.turnstile.reset(turnstileWidgetId);
        }
      })
      .catch(function (err) {
        showFeedback('error', err.message || 'Fehler beim Senden. Bitte versuche es erneut.');
      })
      .finally(function () {
        setLoading(false);
      });
  });
})();
