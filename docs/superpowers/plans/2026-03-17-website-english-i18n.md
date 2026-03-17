# KSCW Website English i18n — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add English language support to the KSCW public website with client-side i18n, browser detection, and a DE/EN toggle.

**Architecture:** Lightweight client-side i18n using JSON translation files, `data-i18n` DOM attributes, and a `t(key)` function. Language detection via localStorage → navigator.language → German default. No page reload on switch — DOM manipulation + custom events.

**Tech Stack:** Vanilla JS, JSON translation files, Cloudflare Pages static hosting.

**Spec:** `docs/superpowers/specs/2026-03-17-website-english-i18n-design.md`

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `website_draft/js/i18n.js` | i18n module: detection, loading, `t()`, `applyTranslations()`, `setLang()`, FOUC mitigation |
| `website_draft/js/i18n/de.json` | German translation strings (~200-250 keys) |
| `website_draft/js/i18n/en.json` | English translation strings (~200-250 keys) |
| `website_draft/partials/footer.html` | Shared footer partial (extracted from 12 pages) |

### Modified Files

| File | Changes |
|------|---------|
| `website_draft/partials/header.html` | Add `data-i18n` attributes to all nav labels, add language toggle |
| `website_draft/js/main.js` | Integrate i18n init into `loadHeader` callback, load footer partial, wire up lang toggle |
| `website_draft/js/team-page.js` | Replace all German strings with `t()` calls, listen for `langChanged` |
| `website_draft/js/contact-form.js` | Replace all German strings with `t()` calls, listen for `langChanged` |
| `website_draft/js/data.js` | Replace position labels and date formatting with `t()` / locale-aware code |
| `website_draft/index.html` | Add `data-i18n` attributes, extract footer to placeholder, add i18n head script |
| `website_draft/team.html` | Add `data-i18n` attributes, inline script strings to `t()`, add i18n head script |
| `website_draft/club/kontakt.html` | Add `data-i18n` attributes on form labels/placeholders/options |
| `website_draft/club/ueber-uns.html` | Add `data-i18n` attributes on all sections |
| `website_draft/club/vorstand.html` | Add `data-i18n` attributes |
| `website_draft/volleyball/index.html` | Add `data-i18n` attributes |
| `website_draft/basketball/index.html` | Add `data-i18n` attributes |
| `website_draft/basketball/teams/nachwuchs.html` | Add `data-i18n` attributes |
| `website_draft/sponsoren/index.html` | Add `data-i18n` attributes |
| `website_draft/weiteres/kalender.html` | Add `data-i18n` attributes |
| `website_draft/weiteres/mitgliedschaft.html` | Add `data-i18n` attributes (if exists) |
| `website_draft/weiteres/spielplanung.html` | Add `data-i18n` attributes (if exists) |
| `website_draft/css/styles.css` | Add `.i18n-loading`, `.lang-toggle`, `.lang-btn` styles |

---

## Task 1: Create i18n Module

**Files:**
- Create: `website_draft/js/i18n.js`

- [ ] **Step 1: Create the i18n module**

Create `website_draft/js/i18n.js` with:
- `detectLang()`: checks localStorage('lang') then navigator.language then defaults to 'de'
- `loadTranslations(lang)`: fetches `/js/i18n/{lang}.json?v=1`, caches in memory, sets `document.documentElement.lang`
- `t(key, params)`: returns translated string with optional `{param}` interpolation, falls back to key
- `applyTranslations(container)`: scans `[data-i18n]` elements and sets textContent; scans `[data-i18n-placeholder]`, `[data-i18n-title]`, `[data-i18n-aria-label]` and sets those attributes; reads `<meta name="i18n-title">` to set `document.title`
- `setLang(lang)`: saves to localStorage, loads translations, applies, updates toggle button states (`.lang-btn`, `.lang-btn-mobile`), dispatches `langChanged` CustomEvent on document
- `getLang()`: returns current language code
- `init()`: detects lang, loads translations; if non-German, applies and removes `i18n-loading` class from body; resolves `window.i18nReady` promise
- Expose all as `window.i18n` object and `window.i18nReady` promise

**Note on data-i18n-html**: If needed for keys containing simple markup (like links within translated text), use a `[data-i18n-html]` selector that sets `el.innerHTML`. This is safe because translation values come from our own JSON files, not user input.

- [ ] **Step 2: Verify file was created correctly**

Open `website_draft/js/i18n.js` and check structure is correct.

- [ ] **Step 3: Commit**

```bash
git add website_draft/js/i18n.js
git commit -m "feat(website): add i18n module with detection, t(), and DOM translation"
```

---

## Task 2: Create German Translation File

**Files:**
- Create: `website_draft/js/i18n/de.json`

- [ ] **Step 1: Create the German JSON with all keys**

Create `website_draft/js/i18n/de.json` with all German strings extracted from the website. Keys use camelCase with page/component prefix. Read every HTML and JS file in `website_draft/` to extract every German string.

Categories to include:
- **nav***: All navigation labels (navNews, navClub, navAbout, navBoard, navContact, navVolleyball, navOverview, navWomen, navMen, navYouth, navBasketball, navSponsors, navMore, navCalendar, navMembership, navScheduling, navLogin, navOpenMenu)
- **home***: Homepage sections (homeSubtitle, homeNews, homeUpcomingGames, homeRecentResults, homePartners, homeAllSponsors)
- **about***: About page (aboutTitle, aboutSubtitle, aboutHistory, aboutHistoryText1, aboutHistoryText2, aboutStatFounded, aboutStatMembers, aboutStatTeams, aboutStatSports, aboutValues, aboutCommunity, aboutCommunityText, aboutFairplay, aboutFairplayText, aboutDevelopment, aboutDevelopmentText, aboutHalls, aboutHallUtogrund, aboutHallLavater, aboutHallSihlfeld, aboutCTA, aboutCTAText, aboutCTAButton)
- **board***: Vorstand page (boardTitle, boardSubtitle, boardPresident, boardVicePresident, boardTreasurer, and all other role labels)
- **contact***: Contact form (contactTitle, contactSubtitle, contactFormHeading, contactFirstName, contactLastName, contactEmail, contactSubject, contactTeam, contactMessage, contactFirstNamePlaceholder, contactLastNamePlaceholder, contactEmailPlaceholder, contactSubjectPlaceholder, contactTeamPlaceholder, contactMessagePlaceholder, contactSubjectGeneral, contactSubjectVolleyball, contactSubjectBasketball, contactSubjectSponsoring, contactSubjectOther, contactSubmit, contactSending, contactSuccess, contactError, contactErrorRetry, contactValidationName, contactValidationEmail, contactValidationSubject, contactValidationMessage, contactValidationCaptcha, contactSidebar, contactGeneral, contactSocialMedia)
- **team***: Team page (teamTabRoster, teamTabGames, teamTabRankings, teamTabTraining, teamUpcoming, teamResults, teamNoGames, teamNoResults, teamNoRankings, teamLoadingRoster, teamLoadingGames, teamLoadingResults, teamLoadingTrainings, teamLoadingRankings, teamNotFound, teamNoTeam, teamBackHome, teamCTA, teamCTAText, teamCTAButton, teamCaptain, teamCoach, teamSeason, teamPhoto, teamBadgeHome, teamBadgeAway)
- **pos***: Position names (posSetter, posOpposite, posOutsideHitter, posMiddleBlocker, posLibero, posPlayer, posPointGuard, posShootingGuard, posSmallForward, posPowerForward, posCenter)
- **ranking***: Table headers (rankingRank, rankingPoints, rankingTeam, rankingPlayed, rankingWon, rankingLost, rankingSets, rankingRankings)
- **vb***: Volleyball overview (vbTitle, vbSubtitle, vbMen, vbWomen, vbYouth, vbCTA, vbCTAText, vbCTAButton, vbMore)
- **bb***: Basketball overview (bbTitle, bbSubtitle, bbWomen, bbMen, bbYouth, bbCTA, bbCTAText, bbCTAButton, bbMore)
- **sponsors***: Sponsors page (sponsorsTitle, sponsorsTierGold, sponsorsTierSilver, sponsorsTierBronze)
- **calendar***: Calendar page (calendarTitle, calendarSubtitle, calendarHeading, calendarDescription)
- **footer***: Footer (footerDescription, footerClub, footerSport, footerMore, footerAbout, footerBoard, footerContact, footerVolleyball, footerBasketball, footerCalendar, footerMembership, footerScheduling, footerPrivacy, footerImprint, footerCopyright, footerThemeToggle)
- **date***: Date labels (dateMon, dateTue, dateWed, dateThu, dateFri, dateSat, dateSun, dateJan, dateFeb, dateMar, dateApr, dateMay, dateJun, dateJul, dateAug, dateSep, dateOct, dateNov, dateDec)
- **theme***: Theme toggle (themeDark, themeLight, themeToggle)
- **general***: General strings (generalTeamGeneral)

All values are the German strings exactly as they currently appear in the HTML/JS.

- [ ] **Step 2: Commit**

```bash
git add website_draft/js/i18n/de.json
git commit -m "feat(website): add German translation file (de.json)"
```

---

## Task 3: Create English Translation File

**Files:**
- Create: `website_draft/js/i18n/en.json`

- [ ] **Step 1: Create the English JSON with all keys**

Create `website_draft/js/i18n/en.json` with the same keys as `de.json`, but with English translations.

Key translation notes:
- Keep team names as-is (H1, D2, Lions, etc.)
- Keep hall names as-is (Turnhalle Utogrund, etc.)
- Keep league names as-is (2. Liga, etc.)
- Keep person names as-is
- Translate position names to English equivalents (Zuspieler -> Setter, etc.)
- Translate all UI chrome, labels, headings, descriptions
- Use English date abbreviations (Mon, Tue, etc.) and month names (January, February, etc.)
- Translate "Ueber uns" -> "About Us", "Vorstand" -> "Board", etc.
- For the Geschichte section, write a proper English translation of the club history

- [ ] **Step 2: Verify both JSON files have identical keys**

Run a quick check:
```bash
cd website_draft && node -e "
  const de = require('./js/i18n/de.json');
  const en = require('./js/i18n/en.json');
  const deKeys = Object.keys(de).sort();
  const enKeys = Object.keys(en).sort();
  const missingInEn = deKeys.filter(k => !en[k]);
  const missingInDe = enKeys.filter(k => !de[k]);
  if (missingInEn.length) console.log('Missing in en.json:', missingInEn);
  if (missingInDe.length) console.log('Missing in de.json:', missingInDe);
  if (!missingInEn.length && !missingInDe.length) console.log('OK: all', deKeys.length, 'keys match');
"
```

- [ ] **Step 3: Commit**

```bash
git add website_draft/js/i18n/en.json
git commit -m "feat(website): add English translation file (en.json)"
```

---

## Task 4: Extract Footer to Shared Partial

**Files:**
- Create: `website_draft/partials/footer.html`
- Modify: `website_draft/index.html`
- Modify: `website_draft/js/main.js`
- Modify: All other HTML pages with duplicated footers

- [ ] **Step 1: Create `partials/footer.html`**

Extract the `<footer>` from `index.html` into `website_draft/partials/footer.html`. Add `data-i18n` attributes to all translatable text. Keep the exact HTML structure — just add `data-i18n` on text nodes.

Key elements to annotate:
- `p.footer-description` -> `data-i18n="footerDescription"`
- Column headings (Club, Sport, Mehr) -> `data-i18n="footerClub"` etc.
- All link text -> `data-i18n="footerAbout"` etc.
- Theme toggle label -> `data-i18n="themeLight"` / button aria-label -> `data-i18n-aria-label="themeToggle"`
- Copyright -> `data-i18n="footerCopyright"`

- [ ] **Step 2: Replace footer in all HTML pages with placeholder**

In every HTML page that has a `<footer>`, replace the entire `<footer>...</footer>` with:

```html
<div id="site-footer"></div>
```

Pages to modify: `index.html`, `team.html`, `club/kontakt.html`, `club/ueber-uns.html`, `club/vorstand.html`, `volleyball/index.html`, `basketball/index.html`, `basketball/teams/nachwuchs.html`, `sponsoren/index.html`, `weiteres/kalender.html`, `weiteres/mitgliedschaft.html`, `weiteres/spielplanung.html`

- [ ] **Step 3: Add `loadFooter()` to `main.js`**

Add a `loadFooter` function similar to `loadHeader`:

```javascript
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
```

Call `loadFooter` inside the existing `DOMContentLoaded` handler, after `loadHeader` completes. Re-init theme toggle and call `lucide.createIcons()` after footer loads to render the theme toggle icon.

- [ ] **Step 4: Verify footer loads on all pages**

Open a few pages in the browser and confirm the footer renders correctly.

- [ ] **Step 5: Commit**

```bash
git add website_draft/partials/footer.html website_draft/js/main.js website_draft/index.html website_draft/team.html website_draft/club/ website_draft/volleyball/ website_draft/basketball/ website_draft/sponsoren/ website_draft/weiteres/
git commit -m "refactor(website): extract footer to shared partial loaded dynamically"
```

---

## Task 5: Add i18n to Header + Language Toggle

**Files:**
- Modify: `website_draft/partials/header.html`
- Modify: `website_draft/css/styles.css`

- [ ] **Step 1: Add `data-i18n` attributes to all nav labels in `header.html`**

Every translatable text node in the header gets a `data-i18n` attribute. Both desktop and mobile nav variants need the same keys. Examples:

```html
<a href="/..." data-i18n="navNews">News</a>
<span data-i18n="navClub">Club</span>
<a href="/club/ueber-uns.html" data-i18n="navAbout">Ueber uns</a>
<span data-i18n="navVolleyball">Volleyball</span>
<a href="/volleyball/" data-i18n="navOverview">Uebersicht</a>
```

- [ ] **Step 2: Add language toggle to header**

Desktop: inside `.nav-actions` or equivalent, next to Wiedisync button:

```html
<div class="lang-toggle" role="radiogroup" aria-label="Language">
  <button id="lang-de" class="lang-btn active" lang="de" aria-pressed="true" aria-label="Deutsch">DE</button>
  <span class="lang-sep">|</span>
  <button id="lang-en" class="lang-btn" lang="en" aria-pressed="false" aria-label="English">EN</button>
</div>
```

Mobile: duplicate inside `.mobile-nav`, at top:

```html
<div class="lang-toggle mobile-lang-toggle" role="radiogroup" aria-label="Language">
  <button class="lang-btn-mobile active" lang="de" aria-pressed="true" aria-label="Deutsch" data-lang="de">DE</button>
  <span class="lang-sep">|</span>
  <button class="lang-btn-mobile" lang="en" aria-pressed="false" aria-label="English" data-lang="en">EN</button>
</div>
```

- [ ] **Step 3: Add CSS styles for language toggle**

Add to `website_draft/css/styles.css`:

```css
.lang-toggle {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  margin-left: 0.75rem;
}
.lang-btn, .lang-btn-mobile {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 0.8rem;
  font-weight: 400;
  color: var(--text-secondary);
  padding: 0.25rem 0.35rem;
  border-radius: 4px;
  transition: all 0.2s ease;
}
.lang-btn:hover, .lang-btn-mobile:hover { color: var(--text-primary); }
.lang-btn.active, .lang-btn-mobile.active { font-weight: 700; color: var(--kscw-gold); }
.lang-sep { color: var(--text-secondary); font-size: 0.8rem; user-select: none; }
.mobile-lang-toggle {
  justify-content: center;
  padding: 0.75rem 0;
  border-bottom: 1px solid var(--border-color);
  margin-bottom: 0.5rem;
}
```

- [ ] **Step 4: Commit**

```bash
git add website_draft/partials/header.html website_draft/css/styles.css
git commit -m "feat(website): add data-i18n attributes to header nav + language toggle UI"
```

---

## Task 6: Integrate i18n into main.js

**Files:**
- Modify: `website_draft/js/main.js`

- [ ] **Step 1: Wire up i18n initialization in the `loadHeader` callback**

In `main.js`, inside the `DOMContentLoaded` -> `loadHeader(function() { ... })` callback, call `loadFooter` and then init i18n:

```javascript
loadFooter(function () {
  // Initialize i18n (loads JSON, applies translations to header + footer + page)
  if (window.i18n) {
    window.i18n.init().then(function () {
      // Wire up language toggle buttons
      document.querySelectorAll('.lang-btn, .lang-btn-mobile').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var lang = btn.id === 'lang-en' || btn.getAttribute('data-lang') === 'en' ? 'en' : 'de';
          window.i18n.setLang(lang);
        });
      });
    });
  }
  // Re-render lucide icons in footer
  if (typeof lucide !== 'undefined') lucide.createIcons();
});
```

- [ ] **Step 2: Update theme toggle to use `t()`**

In `initThemeToggle`, replace hardcoded label strings:

```javascript
// Replace:
label.textContent = 'Dark Mode';
// With:
label.textContent = window.i18n ? i18n.t('themeDark') : 'Dark Mode';

// Replace:
label.textContent = 'Light Mode';
// With:
label.textContent = window.i18n ? i18n.t('themeLight') : 'Light Mode';
```

- [ ] **Step 3: Commit**

```bash
git add website_draft/js/main.js
git commit -m "feat(website): integrate i18n into main.js init chain + theme toggle"
```

---

## Task 7: Add i18n to All HTML Pages (Head Script + data-i18n Attributes)

**Files:**
- Modify: All HTML pages in `website_draft/`

- [ ] **Step 1: Add FOUC prevention + i18n script to `<head>` of every page**

In every HTML file, add this before the closing `</head>`:

```html
<!-- i18n: early language detection + FOUC prevention -->
<script>
  (function() {
    var lang = localStorage.getItem('lang');
    if (!lang && navigator.language && navigator.language.startsWith('en')) lang = 'en';
    if (lang && lang !== 'de') {
      document.documentElement.lang = lang;
      var style = document.createElement('style');
      style.textContent = '.i18n-loading [data-i18n],.i18n-loading [data-i18n-placeholder]{visibility:hidden}';
      document.head.appendChild(style);
      document.addEventListener('DOMContentLoaded', function() { document.body.classList.add('i18n-loading'); });
    }
  })();
</script>
<script src="/js/i18n.js"></script>
```

- [ ] **Step 2: Add `data-i18n` attributes to `index.html`**

Replace all German text nodes with `data-i18n` attributes. Keep German text as fallback content. Key areas:
- Hero subtitle: `data-i18n="homeSubtitle"`
- Section headings: `data-i18n="homeNews"`, `data-i18n="homeUpcomingGames"`, etc.
- Sponsor CTA: `data-i18n="homeAllSponsors"`
- Also add `<meta name="i18n-title" content="homeTitle">` in `<head>`

- [ ] **Step 3: Add `data-i18n` attributes to `club/ueber-uns.html`**

All sections: heading, subtitle, history paragraphs, stats labels, values cards (title + text), halls cards, CTA.

- [ ] **Step 4: Add `data-i18n` attributes to `club/kontakt.html`**

Form labels, placeholders (`data-i18n-placeholder`), select options, sidebar headings, error containers.

- [ ] **Step 5: Add `data-i18n` attributes to `club/vorstand.html`**

Heading, subtitle, role labels.

- [ ] **Step 6: Add `data-i18n` attributes to `volleyball/index.html`**

Heading, subtitle, section labels (Herren/Damen/Nachwuchs), "Mehr erfahren" links, CTA section.

- [ ] **Step 7: Add `data-i18n` attributes to `basketball/index.html`**

Same pattern as volleyball page.

- [ ] **Step 8: Add `data-i18n` attributes to `basketball/teams/nachwuchs.html`**

Heading, section labels.

- [ ] **Step 9: Add `data-i18n` attributes to `team.html`**

Inline script error messages use `t()` (requires `i18nReady` promise). CTA section text.

- [ ] **Step 10: Add `data-i18n` to remaining pages**

`sponsoren/index.html`, `weiteres/kalender.html`, `weiteres/mitgliedschaft.html`, `weiteres/spielplanung.html`.

- [ ] **Step 11: Commit**

```bash
git add website_draft/
git commit -m "feat(website): add data-i18n attributes to all HTML pages + FOUC prevention"
```

---

## Task 8: Translate team-page.js

**Files:**
- Modify: `website_draft/js/team-page.js`

- [ ] **Step 1: Replace all German strings with `t()` calls**

Key replacements:

Position labels — replace hardcoded `posLabels` object with a `getPosLabel(key)` function that maps position keys to i18n keys:
```
setter -> i18n.t('posSetter'), opposite -> i18n.t('posOpposite'), etc.
```

Tab labels:
```
'Kader' -> i18n.t('teamTabRoster')
'Spiele' -> i18n.t('teamTabGames')
'Rangliste' -> i18n.t('teamTabRankings')
'Training' -> i18n.t('teamTabTraining')
```

Section headings:
```
'Naechste Spiele' -> i18n.t('teamUpcoming')
'Letzte Resultate' -> i18n.t('teamResults')
```

Empty states:
```
'Keine anstehenden Spiele.' -> i18n.t('teamNoGames')
'Keine Resultate vorhanden.' -> i18n.t('teamNoResults')
'Keine Rangliste verfuegbar.' -> i18n.t('teamNoRankings')
```

Loading states:
```
'Kader wird geladen...' -> i18n.t('teamLoadingRoster')
'Spiele werden geladen...' -> i18n.t('teamLoadingGames')
etc.
```

Badges: `'Heim' -> i18n.t('teamBadgeHome')`, `'Auswaerts' -> i18n.t('teamBadgeAway')`

Roster: `'Captain: ' -> i18n.t('teamCaptain')`, `'Trainer: ' -> i18n.t('teamCoach')`

CTA: `'Interesse am {team}?' -> i18n.t('teamCTA', { team: team })`, etc.

Rankings headers: `'Pkt' -> i18n.t('rankingPoints')`, `'Sp' -> i18n.t('rankingPlayed')`, etc.

Error states: `'Team nicht gefunden' -> i18n.t('teamNotFound')`, etc.

Season label: `'Saison' -> i18n.t('teamSeason')`

Photo alt: `'Teamfoto' -> i18n.t('teamPhoto')`

- [ ] **Step 2: Add `langChanged` event listener to re-render**

At the end of `team-page.js`:
```javascript
document.addEventListener('langChanged', function () {
  if (window.TEAM_CONFIG && window.TEAM_CONFIG.pbId) {
    renderTeamPage(window.TEAM_CONFIG);
  }
});
```

- [ ] **Step 3: Commit**

```bash
git add website_draft/js/team-page.js
git commit -m "feat(website): translate team-page.js strings to use i18n.t()"
```

---

## Task 9: Translate contact-form.js

**Files:**
- Modify: `website_draft/js/contact-form.js`

- [ ] **Step 1: Replace all German strings with `t()` calls**

```
'Bitte waehlen...' -> i18n.t('contactTeamPlaceholder')
'Allgemein (Volleyball/Basketball)' -> i18n.t('generalTeamGeneral')
'Wird gesendet...' -> i18n.t('contactSending')
'Absenden' -> i18n.t('contactSubmit')
```

Validation:
```
'Bitte Vor- und Nachname eingeben.' -> i18n.t('contactValidationName')
'Bitte E-Mail eingeben.' -> i18n.t('contactValidationEmail')
'Bitte Betreff waehlen.' -> i18n.t('contactValidationSubject')
'Bitte Nachricht eingeben.' -> i18n.t('contactValidationMessage')
'Bitte das Captcha loesen.' -> i18n.t('contactValidationCaptcha')
```

Success/error:
```
'Nachricht erfolgreich gesendet! Wir melden uns bald.' -> i18n.t('contactSuccess')
'Fehler beim Senden.' -> i18n.t('contactError')
'Fehler beim Senden. Bitte versuche es erneut.' -> i18n.t('contactErrorRetry')
```

Also update `makeOption()` to use `t()` for generated option text.

- [ ] **Step 2: Add `langChanged` listener to update form**

```javascript
document.addEventListener('langChanged', function () {
  i18n.applyTranslations(document.querySelector('.contact-form'));
  var btn = document.getElementById('contact-submit');
  if (btn && !btn.disabled) btn.textContent = i18n.t('contactSubmit');
  var teamPlaceholder = document.querySelector('#team-select option[value=""]');
  if (teamPlaceholder) teamPlaceholder.textContent = i18n.t('contactTeamPlaceholder');
});
```

- [ ] **Step 3: Commit**

```bash
git add website_draft/js/contact-form.js
git commit -m "feat(website): translate contact-form.js strings to use i18n.t()"
```

---

## Task 10: Translate data.js (Date Formatting + Position Labels)

**Files:**
- Modify: `website_draft/js/data.js`

- [ ] **Step 1: Update `formatDateLong` for locale-aware formatting**

Replace hardcoded German day/month arrays with `t()` calls:

```javascript
formatDateLong: function (isoDate) {
  var dayKeys = ['dateSun', 'dateMon', 'dateTue', 'dateWed', 'dateThu', 'dateFri', 'dateSat'];
  var monthKeys = ['dateJan', 'dateFeb', 'dateMar', 'dateApr', 'dateMay', 'dateJun',
                   'dateJul', 'dateAug', 'dateSep', 'dateOct', 'dateNov', 'dateDec'];
  var d = new Date(isoDate + 'T12:00:00');
  var dayName = window.i18n ? i18n.t(dayKeys[d.getDay()]) : ['So','Mo','Di','Mi','Do','Fr','Sa'][d.getDay()];
  var monthName = window.i18n ? i18n.t(monthKeys[d.getMonth()]) : ['Januar','Februar',...][d.getMonth()];

  if (window.i18n && i18n.getLang() === 'en') {
    return dayName + ', ' + monthName + ' ' + d.getDate() + ', ' + d.getFullYear();
  }
  return dayName + ', ' + d.getDate() + '. ' + monthName + ' ' + d.getFullYear();
}
```

- [ ] **Step 2: Replace hardcoded position labels in data.js (if present)**

If `data.js` has its own position label map, replace with `t()` calls matching the same keys used in `team-page.js`.

- [ ] **Step 3: Commit**

```bash
git add website_draft/js/data.js
git commit -m "feat(website): locale-aware date formatting + position labels via i18n"
```

---

## Task 11: End-to-End Testing

- [ ] **Step 1: Test German default**

Open the site with `localStorage.clear()` and a German browser locale. Verify:
- All text renders in German
- No FOUC
- Language toggle shows "DE" as active
- Theme toggle label is correct

- [ ] **Step 2: Test English detection**

Clear localStorage, set browser to English locale (DevTools override). Verify:
- Page loads in English
- No visible German text flash (FOUC prevention works)
- All nav items, headings, labels, buttons are English
- Language toggle shows "EN" as active

- [ ] **Step 3: Test language switching**

Click "EN" toggle:
- All static text switches to English without page reload
- Team page tabs update
- Contact form labels/placeholders update
- Footer text updates
- Theme toggle label updates
- Date formats change

Click "DE" toggle:
- Everything reverts to German

- [ ] **Step 4: Test persistence**

Switch to English, reload page:
- Page loads directly in English (localStorage)
- Toggle still shows "EN" active

- [ ] **Step 5: Test team page**

Navigate to a team page (e.g., `/volleyball/h1`):
- Tab labels in correct language
- Position names translated
- Empty states in correct language
- CTA section translated
- Rankings table headers translated

- [ ] **Step 6: Test contact form**

Navigate to `/club/kontakt.html`:
- All form labels and placeholders in correct language
- Subject dropdown options translated
- Validation messages in correct language (submit empty form)
- Success/error messages in correct language

- [ ] **Step 7: Test mobile**

Open on mobile viewport:
- Language toggle visible in hamburger menu
- All nav items translated
- Footer translated
- No layout breaks from longer/shorter English text

- [ ] **Step 8: Commit any fixes**

```bash
git add website_draft/
git commit -m "fix(website): i18n testing fixes"
```

---

## Task 12: Final Cleanup

- [ ] **Step 1: Search for remaining hardcoded German strings**

```bash
cd website_draft && grep -rn "Keine\|Bitte\|wird geladen\|Fehler\|erfolgreich\|Zurueck\|Uebersicht\|Kontakt aufnehmen\|Nächste\|Letzte" js/ --include="*.js" | grep -v "i18n/"
```

Any hits that are not in comments or fallback values need `t()` wrapping.

- [ ] **Step 2: Verify key count and parity**

```bash
cd website_draft && node -e "
  const de = require('./js/i18n/de.json');
  const en = require('./js/i18n/en.json');
  console.log('DE keys:', Object.keys(de).length);
  console.log('EN keys:', Object.keys(en).length);
  const missing = Object.keys(de).filter(k => !en[k]);
  if (missing.length) console.log('Missing in EN:', missing);
  else console.log('All keys present in both files');
"
```

- [ ] **Step 3: Final commit**

```bash
git add website_draft/
git commit -m "feat(website): complete English i18n support with DE/EN toggle"
```
