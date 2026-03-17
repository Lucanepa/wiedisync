/**
 * KSCW Team Page — Dynamic Data Loader
 *
 * Fetches roster, trainings, coach/captain from the public PB API
 * and populates the team page sections. Games & rankings from window.KSCW.
 *
 * Usage: set window.TEAM_CONFIG = { short: 'H1', pbId: 'qz7y8l4tz48f65j' }
 */
(function () {
  'use strict';

  var CFG = window.TEAM_CONFIG;
  if (!CFG || !CFG.short) return;

  var PB = 'https://kscw-api.lucanepa.com';
  var TEAM = CFG.short;
  var TEAM_PB_ID = CFG.pbId;

  var posLabels = {
    setter: 'Zuspieler', opposite: 'Diagonal', outside_hitter: 'Aussen',
    middle_blocker: 'Mitte', libero: 'Libero', other: 'Spieler',
    point_guard: 'Point Guard', shooting_guard: 'Shooting Guard',
    small_forward: 'Small Forward', power_forward: 'Power Forward',
    center: 'Center',
  };

  function positionText(positions) {
    if (!positions || !positions.length) return '';
    return positions.map(function (p) { return posLabels[p] || p; }).join(', ');
  }

  function esc(s) { var d = document.createElement('span'); d.textContent = s; return d.innerHTML; }

  function hideSection(tabId) {
    var btn = document.querySelector('[data-tab="' + tabId + '"]');
    if (btn) btn.style.display = 'none';
    var panel = document.querySelector('[data-tab-panel="' + tabId + '"]');
    if (panel) panel.style.display = 'none';
  }

  // ── Render team photo dynamically if not already in HTML ──────────
  function renderTeamPhoto(data) {
    if (document.querySelector('.team-photo')) return; // already in HTML
    if (!data.team || !TEAM_PB_ID) return;
    // Fetch team record to get team_picture
    fetch(PB + '/api/collections/teams/records/' + TEAM_PB_ID)
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; })
      .then(function (team) {
        if (!team || !team.team_picture) return;
        var url = PB + '/api/files/' + team.collectionId + '/' + team.id + '/' + team.team_picture + '?thumb=1280x0';
        var hero = document.querySelector('.team-hero');
        if (!hero) return;
        var img = document.createElement('img');
        img.src = url;
        img.alt = 'Teamfoto ' + esc(data.team.name || TEAM);
        img.className = 'team-photo';
        img.loading = 'lazy';
        hero.parentNode.insertBefore(img, hero.nextSibling);
      });
  }

  // ── Fetch team data from public API ───────────────────────────────
  function fetchTeamData() {
    if (!TEAM_PB_ID) { hideSection('kader'); hideSection('training'); return; }

    fetch(PB + '/api/public/team/' + TEAM_PB_ID)
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (data) {
        renderRoster(data.roster || [], data.coach || [], data.captain || []);
        renderTrainings(data.trainings || []);
        renderTeamPhoto(data);
      })
      .catch(function () { hideSection('kader'); hideSection('training'); });
  }

  // ── Render Roster ─────────────────────────────────────────────────
  function renderRoster(roster, coach, captain) {
    var el = document.getElementById('roster-grid');
    if (!el) return;
    if (!roster.length) { hideSection('kader'); return; }

    roster.sort(function (a, b) {
      if (a.guest_level !== b.guest_level) return a.guest_level - b.guest_level;
      return (a.last_name || '').localeCompare(b.last_name || '');
    });

    var frag = document.createDocumentFragment();
    for (var i = 0; i < roster.length; i++) {
      var m = roster[i];
      if (m.guest_level > 0) continue;

      var card = document.createElement('div');
      card.className = 'roster-card';

      if (m.photo_url) {
        var img = document.createElement('img');
        img.src = PB + m.photo_url;
        img.alt = '';
        img.className = 'roster-avatar';
        img.style.objectFit = 'cover';
        img.loading = 'lazy';
        card.appendChild(img);
      } else {
        var av = document.createElement('div');
        av.className = 'roster-avatar';
        av.textContent = m.initials || '?';
        card.appendChild(av);
      }

      var info = document.createElement('div');
      var nameEl = document.createElement('div');
      nameEl.className = 'roster-name';
      nameEl.textContent = m.first_name + ' ' + m.last_name;
      info.appendChild(nameEl);

      var posText = positionText(m.position);
      var numText = m.number ? ' · #' + m.number : '';
      var subtitle = posText + numText;
      if (subtitle) {
        var posEl = document.createElement('div');
        posEl.className = 'roster-position';
        posEl.textContent = subtitle;
        info.appendChild(posEl);
      }

      card.appendChild(info);
      frag.appendChild(card);
    }

    el.textContent = '';
    el.appendChild(frag);

    var metaEl = document.getElementById('roster-meta');
    if (metaEl) {
      metaEl.textContent = '';
      var parts = [];
      if (coach.length) {
        parts.push('Trainer: ' + coach.map(function (c) { return c.first_name + ' ' + c.last_name; }).join(', '));
      }
      if (captain.length) {
        parts.push('Captain: ' + captain.map(function (c) { return c.first_name + ' ' + c.last_name; }).join(', '));
      }
      if (parts.length) {
        var p = document.createElement('p');
        p.style.fontWeight = '600';
        p.style.fontSize = 'var(--text-sm)';
        p.style.color = 'var(--text-secondary)';
        p.textContent = parts.join(' · ');
        metaEl.appendChild(p);
      }
    }
  }

  // ── Render Trainings ──────────────────────────────────────────────
  function renderTrainings(trainings) {
    var el = document.getElementById('training-list');
    if (!el) return;
    if (!trainings.length) { hideSection('training'); return; }

    var frag = document.createDocumentFragment();
    for (var i = 0; i < trainings.length; i++) {
      var t = trainings[i];
      var row = document.createElement('div');
      row.className = 'training-item';

      var dayEl = document.createElement('span');
      dayEl.className = 'training-day';
      dayEl.textContent = t.day;
      row.appendChild(dayEl);

      var timeEl = document.createElement('span');
      timeEl.className = 'training-time';
      timeEl.textContent = t.start_time + ' – ' + t.end_time;
      row.appendChild(timeEl);

      var hallEl = document.createElement('span');
      hallEl.className = 'training-hall';
      hallEl.textContent = t.hall_name + (t.hall_address ? ' · ' + t.hall_address : '');
      row.appendChild(hallEl);

      frag.appendChild(row);
    }

    el.textContent = '';
    el.appendChild(frag);
  }

  // ── Render Games (from window.KSCW) ───────────────────────────────
  function renderGames() {
    var D = window.KSCW;
    if (!D) return;

    var teamInfo = D.getTeam(TEAM) || {};
    var chipBg = teamInfo.bg || '#6b7280';
    var chipText = teamInfo.text || '#fff';

    // Upcoming
    var upEl = document.getElementById('upcoming-games');
    if (upEl) {
      var upcoming = D.getUpcomingGames().filter(function (g) { return g.teamShort === TEAM; }).slice(0, 5);
      upEl.textContent = '';
      if (upcoming.length) {
        var frag = document.createDocumentFragment();
        for (var u = 0; u < upcoming.length; u++) {
          frag.appendChild(makeGameRow(D, upcoming[u], chipBg, chipText, false));
        }
        upEl.appendChild(frag);
      } else {
        var p = document.createElement('p');
        p.className = 'text-muted text-sm';
        p.textContent = 'Keine anstehenden Spiele.';
        upEl.appendChild(p);
      }
    }

    // Results
    var resEl = document.getElementById('recent-results');
    if (resEl) {
      var results = D.getCompletedGames().filter(function (g) { return g.teamShort === TEAM; }).slice(0, 5);
      resEl.textContent = '';
      if (results.length) {
        var frag2 = document.createDocumentFragment();
        for (var r = 0; r < results.length; r++) {
          frag2.appendChild(makeGameRow(D, results[r], chipBg, chipText, true));
        }
        resEl.appendChild(frag2);
      } else {
        var p2 = document.createElement('p');
        p2.className = 'text-muted text-sm';
        p2.textContent = 'Keine Resultate vorhanden.';
        resEl.appendChild(p2);
      }
    }

    // Rankings
    var rankEl = document.getElementById('rankings-table');
    if (rankEl) {
      var teamRankings = findRankings(D);
      rankEl.textContent = '';
      if (teamRankings && teamRankings.rows && teamRankings.rows.length) {
        var h2 = document.createElement('h2');
        h2.style.fontSize = 'var(--text-2xl)';
        h2.style.marginBottom = 'var(--space-lg)';
        h2.textContent = teamRankings.league || 'Rangliste';
        rankEl.appendChild(h2);

        var wrap = document.createElement('div');
        wrap.className = 'table-wrap';
        var table = document.createElement('table');

        var thead = document.createElement('thead');
        var headRow = document.createElement('tr');
        ['#', 'Team', 'Sp', 'S', 'N', 'Pkt'].forEach(function (t) {
          var th = document.createElement('th');
          th.textContent = t;
          headRow.appendChild(th);
        });
        thead.appendChild(headRow);
        table.appendChild(thead);

        var tbody = document.createElement('tbody');
        for (var j = 0; j < teamRankings.rows.length; j++) {
          var rw = teamRankings.rows[j];
          var tr = document.createElement('tr');
          if (rw.isKSCW) tr.className = 'table-highlight';

          var cells = [
            { text: String(rw.rank), cls: 'table-rank' },
            { text: rw.team, cls: 'table-team' },
            { text: String(rw.played || '-') },
            { text: String(rw.wins || '-') },
            { text: String(rw.losses || '-') },
            { text: String(rw.points || '-'), bold: true },
          ];
          for (var c = 0; c < cells.length; c++) {
            var td = document.createElement('td');
            if (cells[c].cls) td.className = cells[c].cls;
            if (cells[c].bold) {
              var strong = document.createElement('strong');
              strong.textContent = cells[c].text;
              td.appendChild(strong);
            } else {
              td.textContent = cells[c].text;
            }
            tr.appendChild(td);
          }
          tbody.appendChild(tr);
        }
        table.appendChild(tbody);
        wrap.appendChild(table);
        rankEl.appendChild(wrap);
      } else {
        var p3 = document.createElement('p');
        p3.className = 'text-muted text-sm';
        p3.textContent = 'Keine Rangliste verfügbar.';
        rankEl.appendChild(p3);
      }
    }
  }

  function makeGameRow(D, g, chipBg, chipText, showScore) {
    var row = document.createElement('div');
    row.className = 'game-row';

    var dateEl = document.createElement('span');
    dateEl.className = 'game-date';
    dateEl.textContent = D.formatDate(g.date);
    row.appendChild(dateEl);

    var chip = document.createElement('span');
    chip.className = 'chip';
    chip.style.background = chipBg;
    chip.style.color = chipText;
    chip.textContent = g.teamShort;
    row.appendChild(chip);

    var badge = document.createElement('span');
    badge.className = 'game-badge ' + (g.isHome ? 'home' : 'away');
    badge.textContent = g.isHome ? 'Heim' : 'Auswärts';
    row.appendChild(badge);

    var teams = document.createElement('span');
    teams.className = 'game-teams';
    var homeTeam = g.isHome ? 'KSCW ' + g.teamShort : g.opponent;
    var awayTeam = g.isHome ? g.opponent : 'KSCW ' + g.teamShort;
    teams.appendChild(document.createTextNode(homeTeam + ' '));
    var vs = document.createElement('span');
    vs.className = 'vs';
    vs.textContent = 'vs';
    teams.appendChild(vs);
    teams.appendChild(document.createTextNode(' ' + awayTeam));
    row.appendChild(teams);

    if (showScore && g.score) {
      var win = D.isWin(g);
      var scoreEl = document.createElement('span');
      scoreEl.className = 'game-score' + (win === true ? ' win' : win === false ? ' loss' : '');
      scoreEl.textContent = g.score;
      row.appendChild(scoreEl);
    } else {
      var timeEl = document.createElement('span');
      timeEl.className = 'game-date';
      timeEl.textContent = g.time;
      row.appendChild(timeEl);
    }

    return row;
  }

  function findRankings(D) {
    if (!D.rankings) return null;
    var keys = Object.keys(D.rankings);
    for (var i = 0; i < keys.length; i++) {
      var r = D.rankings[keys[i]];
      if (r && r.rows) {
        for (var j = 0; j < r.rows.length; j++) {
          if (r.rows[j].isKSCW && r.rows[j].teamShort === TEAM) return r;
        }
      }
    }
    return null;
  }

  // ── Init ──────────────────────────────────────────────────────────
  fetchTeamData();
  var D = window.KSCW;
  if (D && D.ready) { renderGames(); }
  else { document.addEventListener('kscw-data-ready', renderGames); }
})();
