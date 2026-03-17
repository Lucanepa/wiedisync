# KSCW Website — English i18n

## Goal

Add English language support to the KSCW public website (`website_draft/`) with client-side translation, browser language detection, and a DE/EN toggle.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Language switching | Client-side JS (no URL/subdomain change) | Simple, no CF Pages routing changes |
| Translation storage | JSON files per language | Clean separation, easy to review/extend |
| Language detection | `localStorage` override → `navigator.language` → German default | Auto-serves English speakers, remembers preference |
| Toggle placement | Header, next to theme switcher | Immediately visible, consistent with existing UI |
| Translation scope | Static UI text only | Dynamic PocketBase data stays German (mostly numbers/names) |

## Architecture

### New Files

```
website_draft/
├── js/
│   ├── i18n.js          # i18n module
│   └── i18n/
│       ├── de.json      # German strings (~200-250 keys)
│       └── en.json      # English strings (~200-250 keys)
```

### i18n Module (`js/i18n.js`)

Responsibilities:
- Detect language: `localStorage.getItem('lang')` → `navigator.language.startsWith('en')` → `'de'`
- Load and cache the active language JSON via `fetch('js/i18n/{lang}.json')`
- Expose `t(key)` function returning translated string (falls back to key if missing)
- Expose `setLang(code)` to switch language (saves to localStorage, re-applies)
- Expose `getLang()` returning current language code
- Apply translations to DOM: scan `[data-i18n]` elements, set `textContent`
- Apply attribute translations: `[data-i18n-placeholder]`, `[data-i18n-title]`, `[data-i18n-aria-label]`
- Update `<html lang="...">` attribute
- Dispatch `langChanged` CustomEvent on `document` for JS-rendered content

### HTML Changes

All hardcoded German text replaced with `data-i18n` attributes:

```html
<!-- Before -->
<h1>Über uns</h1>
<input placeholder="Dein Vorname">

<!-- After -->
<h1 data-i18n="aboutTitle">Über uns</h1>
<input data-i18n-placeholder="contactFirstNamePlaceholder" placeholder="Dein Vorname">
```

German text kept as fallback content (visible before JS loads / if JS fails).

### FOUC Mitigation

English-preferring users would see German text flash before the JSON loads. Mitigation:
1. A synchronous `<script>` in `<head>` detects language from `localStorage` / `navigator.language` and sets `<html lang>` + adds class `i18n-loading` to `<body>` if lang ≠ `de`
2. A `<style>` rule `.i18n-loading [data-i18n] { visibility: hidden }` hides translatable elements
3. After `applyTranslations()` completes, remove `i18n-loading` class → text appears in English
4. German users see no flash (no `i18n-loading` class added, German fallback text visible immediately)

### Initialization Order

The header is loaded asynchronously via `loadHeader()` in `main.js`. To avoid race conditions:
1. `i18n.js` is loaded via `<script>` before other JS files (but after the inline head detection script)
2. `i18n.js` exposes a global `i18nReady` promise that resolves after JSON is loaded
3. In `main.js`, after `loadHeader()` injects the HTML, call `applyTranslations()` to translate header elements and wire up the language toggle
4. `team-page.js` and `contact-form.js` register `langChanged` event listeners during their own initialization — these fire after first render, so timing is safe

### Footer Partial Extraction

The footer is currently duplicated across all 12 HTML pages. Before adding `data-i18n` attributes, extract it to `partials/footer.html` and load it dynamically (same pattern as the header). This avoids maintaining translations in 12 places.

### Page Titles

`document.title` is set programmatically via `i18n.js`:
- Static pages: a `<meta name="i18n-title" content="pageTitleAbout">` tag in `<head>`, read by `applyTranslations()`
- Team page: `team-page.js` calls `document.title = t('teamPageTitle', { team: teamName })` after data loads

### `<option>` Elements

Contact form `<select>` options (both static HTML and dynamically generated via `contact-form.js` `makeOption()`) use `data-i18n` on static `<option>` elements and `t()` calls in JS-generated options. The `value` attribute stays untranslated.

### Cache Busting

Translation JSON files use a query string with a version number: `fetch('/js/i18n/${lang}.json?v=1')`. Bump the version on each deployment that changes translations. Alternatively, CF Pages `_headers` can set short `Cache-Control` for `/js/i18n/*.json`.

### Files to Modify

**HTML files** (add `data-i18n` attributes):
- `index.html` — homepage headings, sections, footer
- `team.html` — error states, CTA section, inline `<script>` error strings ("Team nicht gefunden", etc.)
- `club/kontakt.html` — form labels, placeholders, sidebar
- `club/ueber-uns.html` — all sections, history text, values, halls
- `club/vorstand.html` — heading, subtitle, roles
- `volleyball/index.html` — heading, section labels, CTAs
- `basketball/index.html` — heading, section labels, CTAs
- `basketball/teams/nachwuchs.html` — heading, section labels
- `sponsoren/index.html` — heading, tier labels
- `weiteres/kalender.html` — heading, description
- `weiteres/mitgliedschaft.html` — heading, content
- `weiteres/spielplanung.html` — heading, content
- `partials/header.html` — nav labels, language toggle

**JS files** (use `t()` for generated strings):
- `js/team-page.js` — tab labels, loading states, empty states, position names, CTA text, table headers, badges
- `js/contact-form.js` — validation messages, success/error messages, loading state, `<option>` text
- `js/data.js` — position label map, `formatDate()` locale parameter
- `js/main.js` — theme toggle labels ("Dark Mode"/"Light Mode" → `t()` calls), i18n init in `loadHeader` callback

**New HTML files:**

- `partials/footer.html` — extract shared footer (currently duplicated across 12 pages) to a partial loaded dynamically, same pattern as the header

### Language Toggle UI

In `partials/header.html`, next to the theme toggle:

```html
<div class="lang-toggle" role="radiogroup" aria-label="Language" data-i18n-ignore>
  <button id="lang-de" class="lang-btn active" lang="de" aria-pressed="true"
          aria-label="Deutsch">DE</button>
  <span class="lang-sep">|</span>
  <button id="lang-en" class="lang-btn" lang="en" aria-pressed="false"
          aria-label="English">EN</button>
</div>
```

Active language gets `active` class (bold/highlighted) and `aria-pressed="true"`. On mobile, same toggle appears in the hamburger menu. Keyboard-navigable (Tab between buttons).

### No-Reload Switching

1. User clicks "EN" → `setLang('en')` called
2. `i18n.js` fetches/caches `en.json`, applies to all `[data-i18n]` elements
3. Dispatches `langChanged` event
4. `team-page.js` listens → re-renders tabs, labels, states with `t()` calls
5. `contact-form.js` listens → updates form labels/placeholders/validation
6. `<html lang="en">` updated

### Date Formatting

`data.js` `formatDate()` uses `getLang()` for locale-aware formatting:
- German: `15. März 2026`
- English: `March 15, 2026`

### Translation Key Convention

Flat namespace, camelCase, prefixed by page/component:

```
navClub, navVolleyball, navBasketball, navSponsors, navMore
homeSubtitle, homeUpcomingGames, homeRecentResults
aboutTitle, aboutSubtitle, aboutHistory, aboutStats*
contactTitle, contactFormHeading, contactFirstName, ...
teamTabRoster, teamTabGames, teamTabRankings, teamTabTraining
teamNoGames, teamNoResults, teamNoRankings
positionSetter, positionOpposite, positionOutsideHitter, ...
footerCopyright, footerPrivacy, footerImprint
```

## What Stays German

- Team names (H1, D2, Lions, Rhinos, etc.)
- Hall names (Turnhalle Utogrund, etc.)
- Person names and email addresses
- League names (2. Liga, 3. Liga, etc.)
- All dynamic PocketBase API data (news articles, game details, rankings, roster info)
- Swiss-specific terms where no good English equivalent exists

## Known Limitations

- **SEO**: Client-side i18n means search engine crawlers see only the German HTML fallback. The English version is invisible to crawlers. Acceptable for a club website — SEO is not a priority for the English version.
- **Meta descriptions**: `<meta name="description">` stays German in the static HTML. Changing it via JS has no SEO benefit.
- **Dynamic API data**: News, game details, rankings, and roster data from PocketBase remain German.

## Out of Scope (Future)

- Backend/PocketBase multilingual fields
- News article translations
- Additional languages beyond DE/EN
- URL-based language routing
