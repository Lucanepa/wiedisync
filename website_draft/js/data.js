/**
 * KSCW Data Layer — KSC Wiedikon (Volleyball & Basketball)
 *
 * Fetches REAL data from the PocketBase API at kscw-api.lucanepa.com.
 * Falls back to hardcoded mock data if the API is unreachable.
 * All text in German. Colors from src/utils/teamColors.ts.
 *
 * The same `window.KSCW` interface is preserved so all HTML pages work unchanged.
 * After async fetch completes, a `kscw-data-ready` custom event is dispatched on `document`.
 */

// ─── Team Colors (hardcoded from codebase) ──────────────────────────
var teamColors = {
  // Volleyball Men (Blue)
  H1:      { bg: '#1e40af', text: '#ffffff', border: '#1e3a8a' },
  H2:      { bg: '#2563eb', text: '#ffffff', border: '#1d4ed8' },
  H3:      { bg: '#3b82f6', text: '#ffffff', border: '#2563eb' },
  HU23:    { bg: '#60a5fa', text: '#1e3a8a', border: '#3b82f6' },
  HU20:    { bg: '#93c5fd', text: '#1e3a8a', border: '#60a5fa' },
  Legends: { bg: '#1e3a5f', text: '#ffffff', border: '#162d4d' },

  // Volleyball Women (Rose)
  D1:      { bg: '#be123c', text: '#ffffff', border: '#9f1239' },
  D2:      { bg: '#e11d48', text: '#ffffff', border: '#be123c' },
  D3:      { bg: '#f43f5e', text: '#881337', border: '#e11d48' },
  D4:      { bg: '#fb7185', text: '#881337', border: '#f43f5e' },
  DU23:    { bg: '#fda4af', text: '#881337', border: '#fb7185' },

  // Basketball Men (Orange)
  'BB-H1':         { bg: '#9a3412', text: '#ffffff', border: '#7c2d12' },
  'BB-H3':         { bg: '#c2410c', text: '#ffffff', border: '#9a3412' },
  'BB-H4':         { bg: '#ea580c', text: '#ffffff', border: '#c2410c' },
  'BB-HU18':       { bg: '#f97316', text: '#ffffff', border: '#ea580c' },
  'BB-HU16':       { bg: '#fb923c', text: '#7c2d12', border: '#f97316' },
  'BB-HU14':       { bg: '#fdba74', text: '#7c2d12', border: '#fb923c' },
  'BB-HU12':       { bg: '#fed7aa', text: '#7c2d12', border: '#fdba74' },
  'BB-H-Classics': { bg: '#78350f', text: '#ffffff', border: '#451a03' },

  // Basketball Women (Purple)
  'BB-D1':         { bg: '#7e22ce', text: '#ffffff', border: '#6b21a8' },
  'BB-D3':         { bg: '#a855f7', text: '#ffffff', border: '#9333ea' },
  'BB-DU18':       { bg: '#c084fc', text: '#581c87', border: '#a855f7' },
  'BB-DU16':       { bg: '#d8b4fe', text: '#581c87', border: '#c084fc' },
  'BB-DU14':       { bg: '#e9d5ff', text: '#581c87', border: '#d8b4fe' },
  'BB-DU12':       { bg: '#f3e8ff', text: '#581c87', border: '#e9d5ff' },
  'BB-DU10':       { bg: '#faf5ff', text: '#581c87', border: '#f3e8ff' },
  'BB-D-Classics': { bg: '#581c87', text: '#ffffff', border: '#3b0764' },

  // Basketball Mixed (Teal)
  'BB-MU10': { bg: '#14b8a6', text: '#042f2e', border: '#0d9488' },
  'BB-MU8':  { bg: '#0d9488', text: '#ffffff', border: '#0f766e' },

  // Sub-brands
  'BB-Lions':      { bg: '#6d28d9', text: '#ffffff', border: '#5b21b6' },
  'BB-Lions D1':   { bg: '#6d28d9', text: '#ffffff', border: '#5b21b6' },
  'BB-Lions D3':   { bg: '#8b5cf6', text: '#ffffff', border: '#7c3aed' },
  'BB-Rhinos':     { bg: '#059669', text: '#ffffff', border: '#047857' },
  'BB-Rhinos D1':  { bg: '#059669', text: '#ffffff', border: '#047857' },
  'BB-Rhinos D3':  { bg: '#34d399', text: '#064e3b', border: '#10b981' },

  // Fallback
  Other: { bg: '#6b7280', text: '#ffffff', border: '#4b5563' },
};

// ─── Team Pictures (from PocketBase) ─────────────────────────────────
var PB_FILES = 'https://kscw-api.lucanepa.com/api/files/pbc_1568971955/';
var teamPictures = {
  // Volleyball
  H1:      PB_FILES + 'qz7y8l4tz48f65j/h193rllc4ye3_7d834yw8do.jpg',
  H2:      PB_FILES + '601p27iw4xvw1ds/h29vraeson3m_zzvezaah1z.jpg',
  H3:      PB_FILES + 'il1wd1p018hrb61/image1000852_fbnjri0thk.jpg',
  Legends: PB_FILES + 'e352q254s1cip8y/image1000856_d4zcs4gmho.jpg',
  D1:      PB_FILES + 'p1i9cs4km520dd6/d1jfiquwbimv_si9bndu1ir.jpg',
  D2:      PB_FILES + '9kwn129z84967fc/d24vsjosw59i_83r02oi737.jpg',
  D3:      PB_FILES + 'c18yey33vwx9yo4/d35u0ihf626u_2ll1lkswhm.jpg',
  D4:      PB_FILES + '2h55x265r941a4k/d4jgm2oo03ah_7ouliepg2p.jpg',
  // Basketball
  'BB-H1':       PB_FILES + 'wpg9887276cdkd9/bbh1_bo760yoe5s.jpg',
  'BB-H3':       PB_FILES + 'oqqn58l012ie36e/bbh2_x8bm3fove3.jpg',
  'BB-H4':       PB_FILES + '4e65vlw744mldc0/bbh3_w5h2xtpj2x.jpg',
  'BB-Lions D1': PB_FILES + '31k9c1qk62p23oe/bblions_ldzkbkw0b2.jpg',
  'BB-Rhinos D3':PB_FILES + 'cj55682587v210q/bbrhinos_jzjphi50in.jpg',
};

// ─── teamIds map (PB team_id → display short name) ─────────────────
var teamIdMap = {
  'vb_12747': 'H3',     'vb_1394': 'D4',      'vb_14040': 'DU23',
  'vb_7563': 'HU23',    'vb_1393': 'D2',       'vb_541': 'H2',
  'vb_6023': 'Legends', 'vb_4689': 'D3',       'vb_2743': 'H1',
  'vb_1395': 'D1',      'vb_2301': 'DU23',
  'bb_1348': 'BB-H1',   'bb_4829': 'BB-H3',    'bb_7183': 'BB-H4',
  'bb_4934': 'BB-D-Classics', 'bb_4935': 'BB-H-Classics',
  'bb_4445': 'BB-Lions D1',   'bb_1077': 'BB-Rhinos D3',
  'bb_5104': 'BB-DU12', 'bb_5441': 'BB-DU14',  'bb_7182': 'BB-DU16',
  'bb_5697': 'BB-DU18', 'bb_5791': 'BB-HU12',  'bb_5790': 'BB-HU14',
  'bb_5498': 'BB-HU16', 'bb_5789': 'BB-HU18',  'bb_5287': 'BB-MU10',
  'bb_6724': 'BB-MU8',
};

/**
 * Resolve a PB team name to a teamColors key.
 * VB teams: name matches directly (e.g. "H1").
 * BB teams: need "BB-" prefix (e.g. "DU12" → "BB-DU12", "Lions D1" → "BB-Lions D1").
 */
function pbNameToColorKey(name, sport) {
  if (sport === 'volleyball') return name;
  var direct = 'BB-' + name;
  if (teamColors[direct]) return direct;
  // Long basketball names like "Herren 1 H1" — try matching known keys
  var keys = Object.keys(teamColors);
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    if (k.indexOf('BB-') !== 0) continue;
    var sc = k.slice(3);
    if (name === sc || name.indexOf(' ' + sc) === name.length - sc.length - 1) return k;
  }
  return direct;
}

/** Look up color entry for a team short name */
function getColor(short) {
  return teamColors[short] || teamColors.Other;
}

// ─── Gender detection helper ────────────────────────────────────────
function detectGender(name, sport) {
  var n = name.toLowerCase();
  if (n.indexOf('damen') !== -1 || n.indexOf(' d') !== -1 && n.match(/\bd\d/)) return 'women';
  if (n.indexOf('herren') !== -1 || n.indexOf(' h') !== -1 && n.match(/\bh\d/)) return 'men';
  if (n.indexOf('mixed') !== -1 || n.indexOf('mu') !== -1) return 'mixed';
  if (n.indexOf('lions') !== -1 || n.indexOf('rhinos') !== -1) return 'women';
  // Fallback by first character
  if (/^D/.test(name)) return 'women';
  if (/^H/.test(name)) return 'men';
  return 'men';
}

// ─── Fallback Mock Data ─────────────────────────────────────────────
var MOCK_TEAMS = {
  H1: { name: 'Herren 1', short: 'H1', league: '2. Liga', sport: 'volleyball', gender: 'men', bg: '#1e40af', text: '#ffffff', border: '#1e3a8a', training: 'Di 20:00–21:30, Do 19:30–21:30', venue: 'Turnhalle Küngenmatt' },
  H2: { name: 'Herren 2', short: 'H2', league: '3. Liga', sport: 'volleyball', gender: 'men', bg: '#2563eb', text: '#ffffff', border: '#1d4ed8', training: 'Mo 20:00–21:30, Mi 20:00–21:30', venue: 'Turnhalle Küngenmatt' },
  H3: { name: 'Herren 3', short: 'H3', league: '3. Liga', sport: 'volleyball', gender: 'men', bg: '#3b82f6', text: '#ffffff', border: '#2563eb', training: 'Di 20:00–21:30, Do 20:00–21:30', venue: 'Turnhalle Küngenmatt' },
  Legends: { name: 'Legends', short: 'Legends', league: '4. Liga', sport: 'volleyball', gender: 'men', bg: '#1e3a5f', text: '#ffffff', border: '#162d4d', training: 'Mi 20:30–22:00', venue: 'Turnhalle Küngenmatt' },
  D1: { name: 'Damen 1', short: 'D1', league: '3. Liga', sport: 'volleyball', gender: 'women', bg: '#be123c', text: '#ffffff', border: '#9f1239', training: 'Di 20:00–21:30, Do 19:30–21:30', venue: 'Turnhalle Küngenmatt' },
  D2: { name: 'Damen 2', short: 'D2', league: '3. Liga', sport: 'volleyball', gender: 'women', bg: '#e11d48', text: '#ffffff', border: '#be123c', training: 'Di 20:00–21:30, Do 20:00–21:30', venue: 'Turnhalle Küngenmatt' },
  D3: { name: 'Damen 3', short: 'D3', league: '4. Liga', sport: 'volleyball', gender: 'women', bg: '#f43f5e', text: '#881337', border: '#e11d48', training: 'Mo 20:00–21:30, Mi 20:00–21:30', venue: 'Turnhalle Küngenmatt' },
  D4: { name: 'Damen 4', short: 'D4', league: '5. Liga', sport: 'volleyball', gender: 'women', bg: '#fb7185', text: '#881337', border: '#f43f5e', training: 'Di 20:00–21:30', venue: 'Turnhalle Küngenmatt' },
  DU23: { name: 'Damen U23', short: 'DU23', league: 'U23', sport: 'volleyball', gender: 'women', bg: '#fda4af', text: '#881337', border: '#fb7185', training: 'Mo 19:00–20:30', venue: 'Turnhalle Küngenmatt' },
  HU23: { name: 'Herren U23', short: 'HU23', league: 'U23', sport: 'volleyball', gender: 'men', bg: '#60a5fa', text: '#1e3a8a', border: '#3b82f6', training: 'Di 18:00–19:30', venue: 'Turnhalle Küngenmatt' },
  HU20: { name: 'Herren U20', short: 'HU20', league: 'U20', sport: 'volleyball', gender: 'men', bg: '#93c5fd', text: '#1e3a8a', border: '#60a5fa', training: 'Mi 18:00–19:30', venue: 'Turnhalle Küngenmatt' },
  'BB-H1': { name: 'Herren 1', short: 'BB-H1', league: '1. Liga', sport: 'basketball', gender: 'men', bg: '#9a3412', text: '#ffffff', border: '#7c2d12', training: 'Mo 20:00–21:30, Mi 20:00–21:30', venue: 'Turnhalle Küngenmatt' },
  'BB-H3': { name: 'Herren 3', short: 'BB-H3', league: '3. Liga', sport: 'basketball', gender: 'men', bg: '#c2410c', text: '#ffffff', border: '#9a3412', training: 'Di 20:00–21:30, Do 20:00–21:30', venue: 'Turnhalle Küngenmatt' },
  'BB-H4': { name: 'Herren 4', short: 'BB-H4', league: '4. Liga', sport: 'basketball', gender: 'men', bg: '#ea580c', text: '#ffffff', border: '#c2410c', training: 'Mi 20:00–21:30', venue: 'Turnhalle Küngenmatt' },
  'BB-H-Classics': { name: 'H-Classics', short: 'BB-H-Classics', league: 'Plausch', sport: 'basketball', gender: 'men', bg: '#78350f', text: '#ffffff', border: '#451a03', training: 'Fr 20:00–21:30', venue: 'Turnhalle Küngenmatt' },
  'BB-HU18': { name: 'Herren U18', short: 'BB-HU18', league: 'U18', sport: 'basketball', gender: 'men', bg: '#f97316', text: '#ffffff', border: '#ea580c', training: 'Mo 18:00–19:30, Mi 18:00–19:30', venue: 'Turnhalle Küngenmatt' },
  'BB-HU16': { name: 'Herren U16', short: 'BB-HU16', league: 'U16', sport: 'basketball', gender: 'men', bg: '#fb923c', text: '#7c2d12', border: '#f97316', training: 'Di 17:30–19:00, Do 17:30–19:00', venue: 'Turnhalle Küngenmatt' },
  'BB-HU14': { name: 'Herren U14', short: 'BB-HU14', league: 'U14', sport: 'basketball', gender: 'men', bg: '#fdba74', text: '#7c2d12', border: '#fb923c', training: 'Mo 17:00–18:30, Mi 17:00–18:30', venue: 'Turnhalle Küngenmatt' },
  'BB-HU12': { name: 'Herren U12', short: 'BB-HU12', league: 'U12', sport: 'basketball', gender: 'men', bg: '#fed7aa', text: '#7c2d12', border: '#fdba74', training: 'Di 16:00–17:30', venue: 'Turnhalle Küngenmatt' },
  'BB-Lions': { name: 'Lions', short: 'Lions', league: '1. Liga', sport: 'basketball', gender: 'women', bg: '#6d28d9', text: '#ffffff', border: '#5b21b6', training: 'Mo 20:00–21:30, Do 19:30–21:30', venue: 'Turnhalle Küngenmatt' },
  'BB-Rhinos': { name: 'Rhinos', short: 'Rhinos', league: '2. Liga', sport: 'basketball', gender: 'women', bg: '#059669', text: '#ffffff', border: '#047857', training: 'Di 20:00–21:30, Do 20:00–21:30', venue: 'Turnhalle Küngenmatt' },
  'BB-D1': { name: 'Damen 1', short: 'BB-D1', league: '1. Liga', sport: 'basketball', gender: 'women', bg: '#7e22ce', text: '#ffffff', border: '#6b21a8', training: 'Mo 20:00–21:30, Mi 20:00–21:30', venue: 'Turnhalle Küngenmatt' },
  'BB-D3': { name: 'Damen 3', short: 'BB-D3', league: '3. Liga', sport: 'basketball', gender: 'women', bg: '#a855f7', text: '#ffffff', border: '#9333ea', training: 'Di 19:00–20:30', venue: 'Turnhalle Küngenmatt' },
  'BB-D-Classics': { name: 'D-Classics', short: 'BB-D-Classics', league: 'Plausch', sport: 'basketball', gender: 'women', bg: '#581c87', text: '#ffffff', border: '#3b0764', training: 'Fr 19:00–20:30', venue: 'Turnhalle Küngenmatt' },
  'BB-DU18': { name: 'Damen U18', short: 'BB-DU18', league: 'U18', sport: 'basketball', gender: 'women', bg: '#c084fc', text: '#581c87', border: '#a855f7', training: 'Mo 17:30–19:00, Mi 17:30–19:00', venue: 'Turnhalle Küngenmatt' },
  'BB-DU16': { name: 'Damen U16', short: 'BB-DU16', league: 'U16', sport: 'basketball', gender: 'women', bg: '#d8b4fe', text: '#581c87', border: '#c084fc', training: 'Di 17:00–18:30, Do 17:00–18:30', venue: 'Turnhalle Küngenmatt' },
  'BB-DU14': { name: 'Damen U14', short: 'BB-DU14', league: 'U14', sport: 'basketball', gender: 'women', bg: '#e9d5ff', text: '#581c87', border: '#d8b4fe', training: 'Mo 16:00–17:30, Mi 16:00–17:30', venue: 'Turnhalle Küngenmatt' },
  'BB-DU12': { name: 'Damen U12', short: 'BB-DU12', league: 'U12', sport: 'basketball', gender: 'women', bg: '#f3e8ff', text: '#581c87', border: '#e9d5ff', training: 'Di 16:00–17:30', venue: 'Turnhalle Küngenmatt' },
  'BB-DU10': { name: 'Damen U10', short: 'BB-DU10', league: 'U10', sport: 'basketball', gender: 'women', bg: '#faf5ff', text: '#581c87', border: '#f3e8ff', training: 'Sa 10:00–11:30', venue: 'Turnhalle Küngenmatt' },
  'BB-MU10': { name: 'Mixed U10', short: 'BB-MU10', league: 'U10', sport: 'basketball', gender: 'mixed', bg: '#14b8a6', text: '#042f2e', border: '#0d9488', training: 'Sa 09:00–10:30', venue: 'Turnhalle Küngenmatt' },
  'BB-MU8': { name: 'Mixed U8', short: 'BB-MU8', league: 'U8', sport: 'basketball', gender: 'mixed', bg: '#0d9488', text: '#ffffff', border: '#0f766e', training: 'Sa 10:30–12:00', venue: 'Turnhalle Küngenmatt' },
};

var MOCK_GAMES = [
  { id: 'vb-001', date: '2026-03-01', time: '17:00', teamShort: 'H1', opponent: 'VBC Oerlikon', isHome: true,  score: '3:1', setScore: '25:20, 22:25, 25:18, 25:21', sport: 'volleyball' },
  { id: 'vb-002', date: '2026-03-01', time: '15:00', teamShort: 'D1', opponent: 'TV Unterstrass', isHome: true,  score: '3:0', setScore: '25:17, 25:22, 25:19', sport: 'volleyball' },
  { id: 'vb-003', date: '2026-03-02', time: '14:00', teamShort: 'H2', opponent: 'VBC Züri Unterland', isHome: false, score: '1:3', setScore: '19:25, 25:23, 18:25, 20:25', sport: 'volleyball' },
  { id: 'vb-004', date: '2026-03-02', time: '16:00', teamShort: 'D2', opponent: 'VBC Adliswil', isHome: true,  score: '3:2', setScore: '25:22, 20:25, 25:27, 25:19, 15:12', sport: 'volleyball' },
  { id: 'vb-005', date: '2026-03-05', time: '20:00', teamShort: 'H3', opponent: 'VC Zug', isHome: false, score: '0:3', setScore: '18:25, 21:25, 19:25', sport: 'volleyball' },
  { id: 'vb-006', date: '2026-03-08', time: '17:00', teamShort: 'D3', opponent: 'STV Willisau', isHome: true,  score: '3:1', setScore: '25:18, 23:25, 25:20, 25:22', sport: 'volleyball' },
  { id: 'vb-007', date: '2026-03-08', time: '15:00', teamShort: 'Legends', opponent: 'TV Wohlen', isHome: false, score: '2:3', setScore: '25:21, 20:25, 25:23, 19:25, 12:15', sport: 'volleyball' },
  { id: 'vb-008', date: '2026-03-09', time: '14:00', teamShort: 'D4', opponent: 'VBC Winterthur', isHome: true,  score: '3:0', setScore: '25:15, 25:19, 25:17', sport: 'volleyball' },
  { id: 'vb-009', date: '2026-03-09', time: '16:00', teamShort: 'HU23', opponent: 'VBC Luzern', isHome: false, score: '2:3', setScore: '25:20, 18:25, 25:22, 21:25, 13:15', sport: 'volleyball' },
  { id: 'vb-010', date: '2026-03-12', time: '20:00', teamShort: 'DU23', opponent: 'VBC Oerlikon', isHome: true,  score: '3:1', setScore: '25:18, 22:25, 25:20, 25:17', sport: 'volleyball' },
  { id: 'bb-001', date: '2026-03-01', time: '19:30', teamShort: 'BB-Lions', opponent: 'BC Zürich Lions', isHome: true,  score: '78:65', setScore: null, sport: 'basketball' },
  { id: 'bb-002', date: '2026-03-02', time: '16:00', teamShort: 'BB-H1', opponent: 'BC Winterthur', isHome: false, score: '72:81', setScore: null, sport: 'basketball' },
  { id: 'bb-003', date: '2026-03-05', time: '20:00', teamShort: 'BB-Rhinos', opponent: 'Puma Zürich', isHome: true,  score: '68:55', setScore: null, sport: 'basketball' },
  { id: 'bb-004', date: '2026-03-07', time: '18:00', teamShort: 'BB-H3', opponent: 'Goldcoast Sharks', isHome: false, score: '59:63', setScore: null, sport: 'basketball' },
  { id: 'bb-005', date: '2026-03-08', time: '17:00', teamShort: 'BB-H4', opponent: 'BC Bülach', isHome: true,  score: '85:72', setScore: null, sport: 'basketball' },
  { id: 'bb-006', date: '2026-03-09', time: '15:00', teamShort: 'BB-H1', opponent: 'Lakers Rapperswil', isHome: true,  score: '88:79', setScore: null, sport: 'basketball' },
  { id: 'vb-011', date: '2026-03-18', time: '20:00', teamShort: 'H1', opponent: 'VBC Winterthur', isHome: false, score: null, setScore: null, sport: 'volleyball' },
  { id: 'vb-012', date: '2026-03-19', time: '20:00', teamShort: 'D1', opponent: 'VBC Adliswil', isHome: false, score: null, setScore: null, sport: 'volleyball' },
  { id: 'vb-013', date: '2026-03-21', time: '17:00', teamShort: 'H2', opponent: 'TV Unterstrass', isHome: true,  score: null, setScore: null, sport: 'volleyball' },
  { id: 'vb-014', date: '2026-03-21', time: '15:00', teamShort: 'D2', opponent: 'VBC Luzern', isHome: true,  score: null, setScore: null, sport: 'volleyball' },
  { id: 'vb-015', date: '2026-03-22', time: '14:00', teamShort: 'H3', opponent: 'VBC Züri Unterland', isHome: true,  score: null, setScore: null, sport: 'volleyball' },
  { id: 'vb-016', date: '2026-03-22', time: '16:00', teamShort: 'D3', opponent: 'VBC Oerlikon', isHome: false, score: null, setScore: null, sport: 'volleyball' },
  { id: 'vb-017', date: '2026-03-25', time: '20:00', teamShort: 'Legends', opponent: 'STV Willisau', isHome: true,  score: null, setScore: null, sport: 'volleyball' },
  { id: 'vb-018', date: '2026-03-28', time: '17:00', teamShort: 'HU20', opponent: 'TV Wohlen', isHome: false, score: null, setScore: null, sport: 'volleyball' },
  { id: 'bb-007', date: '2026-03-17', time: '20:00', teamShort: 'BB-Lions', opponent: 'Vipers Zürich', isHome: false, score: null, setScore: null, sport: 'basketball' },
  { id: 'bb-008', date: '2026-03-19', time: '20:00', teamShort: 'BB-H1', opponent: 'Goldcoast Sharks', isHome: true,  score: null, setScore: null, sport: 'basketball' },
  { id: 'bb-009', date: '2026-03-21', time: '18:00', teamShort: 'BB-Rhinos', opponent: 'BBC Monthey', isHome: false, score: null, setScore: null, sport: 'basketball' },
  { id: 'bb-010', date: '2026-03-22', time: '16:00', teamShort: 'BB-H3', opponent: 'BC Bülach', isHome: true,  score: null, setScore: null, sport: 'basketball' },
  { id: 'bb-011', date: '2026-03-25', time: '19:30', teamShort: 'BB-H4', opponent: 'BC Winterthur', isHome: false, score: null, setScore: null, sport: 'basketball' },
  { id: 'bb-012', date: '2026-03-28', time: '17:00', teamShort: 'BB-Lions', opponent: 'Puma Zürich', isHome: true,  score: null, setScore: null, sport: 'basketball' },
];

var MOCK_RANKINGS = {
  'VB Herren 2. Liga': {
    sport: 'volleyball', league: '2. Liga',
    teams: [
      { rank: 1, team: 'VBC Oerlikon',       played: 14, wins: 12, losses: 2,  setsWon: 39, setsLost: 12, points: 34 },
      { rank: 2, team: 'KSC Wiedikon H1',     played: 14, wins: 10, losses: 4,  setsWon: 35, setsLost: 18, points: 28, isKSCW: true },
      { rank: 3, team: 'VBC Winterthur',      played: 14, wins: 9,  losses: 5,  setsWon: 32, setsLost: 22, points: 26 },
      { rank: 4, team: 'TV Unterstrass',      played: 14, wins: 8,  losses: 6,  setsWon: 29, setsLost: 24, points: 23 },
      { rank: 5, team: 'VBC Züri Unterland',  played: 14, wins: 7,  losses: 7,  setsWon: 27, setsLost: 26, points: 21 },
      { rank: 6, team: 'VC Zug',              played: 14, wins: 5,  losses: 9,  setsWon: 22, setsLost: 30, points: 16 },
      { rank: 7, team: 'VBC Adliswil',        played: 14, wins: 3,  losses: 11, setsWon: 16, setsLost: 35, points: 11 },
      { rank: 8, team: 'STV Willisau',        played: 14, wins: 2,  losses: 12, setsWon: 12, setsLost: 38, points: 8 },
    ],
  },
  'VB Damen 3. Liga': {
    sport: 'volleyball', league: '3. Liga',
    teams: [
      { rank: 1, team: 'VBC Adliswil',        played: 14, wins: 13, losses: 1,  setsWon: 40, setsLost: 8,  points: 38 },
      { rank: 2, team: 'KSC Wiedikon D1',     played: 14, wins: 11, losses: 3,  setsWon: 36, setsLost: 15, points: 31, isKSCW: true },
      { rank: 3, team: 'TV Unterstrass',      played: 14, wins: 9,  losses: 5,  setsWon: 31, setsLost: 21, points: 26 },
      { rank: 4, team: 'KSC Wiedikon D2',     played: 14, wins: 8,  losses: 6,  setsWon: 28, setsLost: 24, points: 23, isKSCW: true },
      { rank: 5, team: 'VBC Oerlikon',        played: 14, wins: 7,  losses: 7,  setsWon: 26, setsLost: 25, points: 20 },
      { rank: 6, team: 'VBC Luzern',          played: 14, wins: 5,  losses: 9,  setsWon: 21, setsLost: 30, points: 15 },
      { rank: 7, team: 'VBC Züri Unterland',  played: 14, wins: 2,  losses: 12, setsWon: 13, setsLost: 37, points: 8 },
      { rank: 8, team: 'TV Wohlen',           played: 14, wins: 1,  losses: 13, setsWon: 9,  setsLost: 40, points: 5 },
    ],
  },
  'BB Lions 1. Liga': {
    sport: 'basketball', league: '1. Liga Damen',
    teams: [
      { rank: 1, team: 'BC Zürich Lions',     played: 18, wins: 15, losses: 3,  setsWon: null, setsLost: null, points: 33 },
      { rank: 2, team: 'KSCW Lions',          played: 18, wins: 13, losses: 5,  setsWon: null, setsLost: null, points: 31, isKSCW: true },
      { rank: 3, team: 'Vipers Zürich',       played: 18, wins: 12, losses: 6,  setsWon: null, setsLost: null, points: 30 },
      { rank: 4, team: 'Puma Zürich',         played: 18, wins: 10, losses: 8,  setsWon: null, setsLost: null, points: 28 },
      { rank: 5, team: 'BBC Monthey',         played: 18, wins: 9,  losses: 9,  setsWon: null, setsLost: null, points: 27 },
      { rank: 6, team: 'Lakers Rapperswil',   played: 18, wins: 7,  losses: 11, setsWon: null, setsLost: null, points: 25 },
      { rank: 7, team: 'BC Winterthur',       played: 18, wins: 5,  losses: 13, setsWon: null, setsLost: null, points: 23 },
      { rank: 8, team: 'Goldcoast Sharks',    played: 18, wins: 4,  losses: 14, setsWon: null, setsLost: null, points: 22 },
      { rank: 9, team: 'BC Bülach',           played: 18, wins: 3,  losses: 15, setsWon: null, setsLost: null, points: 21 },
      { rank: 10, team: 'Starwings Basket',   played: 18, wins: 2,  losses: 16, setsWon: null, setsLost: null, points: 20 },
    ],
  },
  'BB Herren 1. Liga': {
    sport: 'basketball', league: '1. Liga Herren',
    teams: [
      { rank: 1, team: 'Lakers Rapperswil',   played: 18, wins: 16, losses: 2,  setsWon: null, setsLost: null, points: 34 },
      { rank: 2, team: 'BC Winterthur',       played: 18, wins: 13, losses: 5,  setsWon: null, setsLost: null, points: 31 },
      { rank: 3, team: 'KSCW BB-H1',          played: 18, wins: 11, losses: 7,  setsWon: null, setsLost: null, points: 29, isKSCW: true },
      { rank: 4, team: 'Goldcoast Sharks',    played: 18, wins: 10, losses: 8,  setsWon: null, setsLost: null, points: 28 },
      { rank: 5, team: 'Puma Zürich',         played: 18, wins: 9,  losses: 9,  setsWon: null, setsLost: null, points: 27 },
      { rank: 6, team: 'BC Zürich Lions',     played: 18, wins: 8,  losses: 10, setsWon: null, setsLost: null, points: 26 },
      { rank: 7, team: 'Vipers Zürich',       played: 18, wins: 6,  losses: 12, setsWon: null, setsLost: null, points: 24 },
      { rank: 8, team: 'BC Bülach',           played: 18, wins: 5,  losses: 13, setsWon: null, setsLost: null, points: 23 },
      { rank: 9, team: 'BBC Monthey',         played: 18, wins: 3,  losses: 15, setsWon: null, setsLost: null, points: 21 },
    ],
  },
};

// ─── Initialize window.KSCW with mock data (synchronous) ───────────
window.KSCW = {

  // Status flag: false while loading, true after PB fetch (or immediately if using mock)
  ready: false,
  dataSource: 'mock', // 'mock' | 'pocketbase'

  // ─── Club Info ──────────────────────────────────────────────
  club: {
    name: 'KSC Wiedikon',
    shortName: 'KSCW',
    founded: 1978,
    colors: { primary: '#4A55A2', secondary: '#FFC832' },
    address: 'Turnhalle Küngenmatt, Küngenmattstrasse 23, 8041 Zürich',
    email: 'info@kscw.ch',
    website: 'https://kscw.ch',
    social: {
      instagram: 'https://instagram.com/kscwiedikon',
      facebook: 'https://facebook.com/kscwiedikon',
    },
  },

  // ─── Teams (keyed by short name) ───────────────────────────
  teams: MOCK_TEAMS,

  // ─── Games ─────────────────────────────────────────────────
  games: MOCK_GAMES,

  // ─── Rankings ──────────────────────────────────────────────
  rankings: MOCK_RANKINGS,

  // ─── News (mock only — no PB collection yet) ──────────────
  news: [
    {
      id: 'n-001',
      title: 'Endlich! Das D3 darf den ersten Sieg der Saison feiern!',
      date: '2025-03-09',
      excerpt: 'Nach einer langen Durststrecke hat das Damen 3 endlich den ersten Sieg der Saison eingefahren. Mit einem überzeugenden 3:1 gegen STV Willisau zeigten die Spielerinnen, dass sich das harte Training auszahlt. Die Stimmung in der Halle war fantastisch und das Team feierte ausgelassen.',
      category: 'volleyball',
      image: 'images/news/d3-sieg.jpg',
    },
    {
      id: 'n-002',
      title: 'Das Damen 2 sieht rot, ZUZU am Ende aber auch',
      date: '2025-03-04',
      excerpt: 'Ein packendes Derby zwischen KSC Wiedikon D2 und VBC Züri Unterland endete mit einem dramatischen 3:2 Sieg für unsere Damen. Nach einem schwierigen Start mit zwei verlorenen Sätzen kämpfte sich das Team zurück und sicherte sich den Sieg im Tiebreak.',
      category: 'volleyball',
      image: 'images/news/d2-zuzu.jpg',
    },
    {
      id: 'n-003',
      title: 'D2: Auswärtsspiel gegen bisher ungeschlagenen Tabellenführer',
      date: '2024-11-26',
      excerpt: 'Am kommenden Samstag trifft das Damen 2 auswärts auf den bisher ungeschlagenen Tabellenführer VBC Adliswil. Die Mannschaft gibt sich kämpferisch und will dem Spitzenreiter das Leben so schwer wie möglich machen. Anpfiff ist um 15:00 Uhr.',
      category: 'volleyball',
      image: 'images/news/d2-auswaerts.jpg',
    },
    {
      id: 'n-004',
      title: 'Trainingsweekend in Näfels',
      date: '2024-11-06',
      excerpt: 'Über 40 Spielerinnen und Spieler aus verschiedenen Teams verbrachten ein intensives Trainingsweekend in Näfels. Neben Technik- und Taktikeinheiten standen auch Teambuilding-Aktivitäten auf dem Programm. Ein gelungenes Wochenende, das den Zusammenhalt im Verein gestärkt hat.',
      category: 'club',
      image: 'images/news/trainingsweekend.jpg',
    },
    {
      id: 'n-005',
      title: 'Erster Heimsieg für das Damen 1',
      date: '2024-10-31',
      excerpt: 'Das Damen 1 konnte endlich den ersten Heimsieg der Saison verbuchen. Vor begeisterten Fans in der Turnhalle Küngenmatt setzte sich das Team mit 3:0 gegen TV Unterstrass durch. Besonders die Aufschlagserie im zweiten Satz war beeindruckend.',
      category: 'volleyball',
      image: 'images/news/d1-heimsieg.jpg',
    },
    {
      id: 'n-006',
      title: 'VB D 2 gegen VB D 1: Drei Punkte für das Damen 2',
      date: '2023-12-26',
      excerpt: 'Das vereinsinterne Duell zwischen dem Damen 2 und dem Damen 1 ging an das D2. In einem spannenden und von Fairness geprägten Match setzten sich die Zweitligadamen mit 3:1 durch. Beide Teams zeigten guten Volleyball und sorgten für beste Unterhaltung.',
      category: 'volleyball',
      image: 'images/news/d2-vs-d1.jpg',
    },
  ],

  // ─── Board Members (mock only — not in PB) ────────────────
  board: [
    { name: 'Michelle Howald',          role: 'Präsidentin',       email: 'praesidium@kscw.ch' },
    { name: 'Anja Jiménez',             role: 'Vize-Präsidentin',  email: 'vize@kscw.ch' },
    { name: 'Dario Kaufmann',           role: 'Kassier',           email: 'finanzen@kscw.ch' },
    { name: 'Radomir Radovanovic',      role: 'Kassier',           email: 'finanzen@kscw.ch' },
    { name: 'Roger Rübsam',             role: 'Aktuar',            email: 'aktuar@kscw.ch' },
    { name: 'Anne Grimshaw',            role: 'Beisitzerin',       email: 'info@kscw.ch' },
    { name: 'Rachel Moser',             role: 'TK Basketball',     email: 'basketball@kscw.ch' },
    { name: 'Thamayanth Kanagalingam',  role: 'TK Volleyball',     email: 'volleyball@kscw.ch' },
  ],

  // ─── Sponsors (mock only — not in PB) ─────────────────────
  sponsors: {
    gold: [
      { name: 'Metzgerei Keller',  logo: 'sponsoren/metzgerei-keller.png',  url: 'https://metzgerei-keller.ch' },
      { name: 'Voitsport',         logo: 'sponsoren/voitsport.png',         url: 'https://voitsport.ch' },
      { name: 'functiomed',        logo: 'sponsoren/functiomed.png',        url: 'https://functiomed.ch' },
      { name: 'Honda Zürich',      logo: 'sponsoren/honda-zuerich.png',     url: 'https://honda-zuerich.ch' },
    ],
    silver: [
      { name: 'Apotheke Wiedikon',  logo: 'sponsoren/apotheke-wiedikon.png',  url: 'https://apotheke-wiedikon.ch' },
      { name: 'Bäckerei Steiner',   logo: 'sponsoren/baeckerei-steiner.png',  url: 'https://baeckerei-steiner.ch' },
      { name: 'Malerei Brunner',    logo: 'sponsoren/malerei-brunner.png',    url: 'https://malerei-brunner.ch' },
      { name: 'Physio Wiedikon',    logo: 'sponsoren/physio-wiedikon.png',    url: 'https://physio-wiedikon.ch' },
    ],
    bronze: [
      { name: 'Restaurant Falcone',   logo: 'sponsoren/restaurant-falcone.png',   url: 'https://restaurant-falcone.ch' },
      { name: 'Blumen Meyer',         logo: 'sponsoren/blumen-meyer.png',         url: 'https://blumen-meyer.ch' },
      { name: 'Druckerei Huber',      logo: 'sponsoren/druckerei-huber.png',      url: 'https://druckerei-huber.ch' },
      { name: 'IT Solutions Zürich',   logo: 'sponsoren/it-solutions-zuerich.png', url: 'https://it-solutions.ch' },
    ],
  },

  // ─── Rosters (mock only — members not public in PB) ───────
  rosters: {
    H1: [
      { name: 'Luca Meier',       position: 'Zuspieler',  number: 1 },
      { name: 'Fabian Keller',    position: 'Aussen',     number: 3 },
      { name: 'Marco Brunner',    position: 'Aussen',     number: 4 },
      { name: 'David Steiner',    position: 'Mitte',      number: 5 },
      { name: 'Nico Huber',       position: 'Mitte',      number: 7 },
      { name: 'Simon Müller',     position: 'Diagonal',   number: 8 },
      { name: 'Jan Schmid',       position: 'Libero',     number: 9 },
      { name: 'Patrick Baumann',  position: 'Aussen',     number: 10 },
      { name: 'Reto Frei',        position: 'Zuspieler',  number: 11 },
      { name: 'Stefan Zimmermann',position: 'Mitte',      number: 12 },
      { name: 'Tobias Gerber',    position: 'Diagonal',   number: 14 },
      { name: 'Adrian Bühler',    position: 'Libero',     number: 15 },
    ],
    H2: [
      { name: 'Thomas Weber',     position: 'Zuspieler',  number: 1 },
      { name: 'Marcel Fischer',   position: 'Aussen',     number: 2 },
      { name: 'Remo Widmer',      position: 'Aussen',     number: 4 },
      { name: 'Daniel Kunz',      position: 'Mitte',      number: 5 },
      { name: 'Florian Maurer',   position: 'Mitte',      number: 6 },
      { name: 'Sandro Roth',      position: 'Diagonal',   number: 7 },
      { name: 'Kevin Bachmann',   position: 'Libero',     number: 8 },
      { name: 'Tim Hartmann',     position: 'Aussen',     number: 9 },
      { name: 'Michael Stucki',   position: 'Zuspieler',  number: 10 },
      { name: 'Oliver Wyss',      position: 'Mitte',      number: 11 },
      { name: 'Pascal Berger',    position: 'Diagonal',   number: 13 },
      { name: 'Christian Hauser', position: 'Libero',     number: 14 },
    ],
    H3: [
      { name: 'Raphael Suter',    position: 'Zuspieler',  number: 1 },
      { name: 'Jonas Bosshard',   position: 'Aussen',     number: 2 },
      { name: 'Lukas Ammann',     position: 'Aussen',     number: 3 },
      { name: 'Dominik Pfister',  position: 'Mitte',      number: 5 },
      { name: 'Yannick Lehmann',  position: 'Mitte',      number: 6 },
      { name: 'Robin Egli',       position: 'Diagonal',   number: 7 },
      { name: 'Silvan Graf',      position: 'Libero',     number: 8 },
      { name: 'Nils Kuster',      position: 'Aussen',     number: 9 },
      { name: 'Severin Blaser',   position: 'Zuspieler',  number: 10 },
      { name: 'Manuel Zürcher',   position: 'Mitte',      number: 11 },
      { name: 'Andri Wirth',      position: 'Diagonal',   number: 12 },
      { name: 'Cedric Kuhn',      position: 'Libero',     number: 14 },
      { name: 'Timo Scherer',     position: 'Aussen',     number: 15 },
    ],
    Legends: [
      { name: 'Peter Zollinger',  position: 'Zuspieler',  number: 1 },
      { name: 'Martin Kramer',    position: 'Aussen',     number: 2 },
      { name: 'Urs Schlatter',    position: 'Aussen',     number: 4 },
      { name: 'Heinz Oberholzer', position: 'Mitte',      number: 5 },
      { name: 'Kurt Stalder',     position: 'Mitte',      number: 6 },
      { name: 'Fritz Hofmann',    position: 'Diagonal',   number: 7 },
      { name: 'Walter Egger',     position: 'Libero',     number: 8 },
      { name: 'Beat Grob',        position: 'Aussen',     number: 9 },
      { name: 'Rolf Wenger',      position: 'Zuspieler',  number: 10 },
      { name: 'Hansruedi Schwarz',position: 'Diagonal',   number: 11 },
      { name: 'Jürg Emmenegger',  position: 'Mitte',      number: 12 },
      { name: 'Markus Brändli',   position: 'Libero',     number: 13 },
    ],
    D1: [
      { name: 'Laura Fischer',    position: 'Zuspielerin', number: 1 },
      { name: 'Sarah Keller',     position: 'Aussen',      number: 2 },
      { name: 'Nina Brunner',     position: 'Aussen',      number: 3 },
      { name: 'Lea Steiner',      position: 'Mitte',       number: 5 },
      { name: 'Anna Huber',       position: 'Mitte',       number: 6 },
      { name: 'Julia Müller',     position: 'Diagonal',    number: 7 },
      { name: 'Rahel Schmid',     position: 'Libero',      number: 8 },
      { name: 'Corinne Baumann',  position: 'Aussen',      number: 9 },
      { name: 'Stefanie Frei',    position: 'Zuspielerin', number: 10 },
      { name: 'Nadja Zimmermann', position: 'Mitte',       number: 11 },
      { name: 'Miriam Gerber',    position: 'Diagonal',    number: 12 },
      { name: 'Fabienne Bühler',  position: 'Libero',      number: 14 },
      { name: 'Christina Roth',   position: 'Aussen',      number: 15 },
    ],
    D2: [
      { name: 'Vanessa Weber',    position: 'Zuspielerin', number: 1 },
      { name: 'Tamara Fischer',   position: 'Aussen',      number: 2 },
      { name: 'Sandra Widmer',    position: 'Aussen',      number: 3 },
      { name: 'Monika Kunz',      position: 'Mitte',       number: 4 },
      { name: 'Patrizia Maurer',  position: 'Mitte',       number: 6 },
      { name: 'Claudia Bachmann', position: 'Diagonal',    number: 7 },
      { name: 'Sabrina Hartmann', position: 'Libero',      number: 8 },
      { name: 'Denise Stucki',    position: 'Aussen',      number: 9 },
      { name: 'Martina Wyss',     position: 'Zuspielerin', number: 10 },
      { name: 'Simone Berger',    position: 'Mitte',       number: 11 },
      { name: 'Eveline Hauser',   position: 'Diagonal',    number: 12 },
      { name: 'Katrin Suter',     position: 'Libero',      number: 13 },
    ],
    D3: [
      { name: 'Michelle Bosshard',position: 'Zuspielerin', number: 1 },
      { name: 'Jasmin Ammann',    position: 'Aussen',      number: 2 },
      { name: 'Noemi Pfister',    position: 'Aussen',      number: 3 },
      { name: 'Seraina Lehmann',  position: 'Mitte',       number: 5 },
      { name: 'Aline Egli',       position: 'Mitte',       number: 6 },
      { name: 'Flurina Graf',     position: 'Diagonal',    number: 7 },
      { name: 'Larissa Kuster',   position: 'Libero',      number: 8 },
      { name: 'Tanja Blaser',     position: 'Aussen',      number: 9 },
      { name: 'Dominique Zürcher',position: 'Zuspielerin', number: 10 },
      { name: 'Nathalie Wirth',   position: 'Mitte',       number: 11 },
      { name: 'Fiona Kuhn',       position: 'Diagonal',    number: 12 },
      { name: 'Samira Scherer',   position: 'Libero',      number: 14 },
    ],
    D4: [
      { name: 'Melanie Hofer',    position: 'Zuspielerin', number: 1 },
      { name: 'Daniela Aebersold',position: 'Aussen',      number: 2 },
      { name: 'Andrea Stettler',  position: 'Aussen',      number: 3 },
      { name: 'Carmen Siegrist',   position: 'Mitte',       number: 4 },
      { name: 'Petra Käser',      position: 'Mitte',       number: 5 },
      { name: 'Sonja Lanz',       position: 'Diagonal',    number: 7 },
      { name: 'Helena Bärtschi',  position: 'Libero',      number: 8 },
      { name: 'Isabelle Gasser',  position: 'Aussen',      number: 9 },
      { name: 'Nicole Liechti',   position: 'Zuspielerin', number: 10 },
      { name: 'Regula Flückiger', position: 'Mitte',       number: 11 },
      { name: 'Vera Schwab',      position: 'Diagonal',    number: 12 },
      { name: 'Susanne Tschanz',  position: 'Libero',      number: 13 },
    ],
    DU23: [
      { name: 'Lena Bieri',       position: 'Zuspielerin', number: 1 },
      { name: 'Alina Rüegg',      position: 'Aussen',      number: 2 },
      { name: 'Jana Moser',       position: 'Aussen',      number: 3 },
      { name: 'Zoe Schaffner',    position: 'Mitte',       number: 5 },
      { name: 'Mia Ochsner',      position: 'Mitte',       number: 6 },
      { name: 'Emma Häfliger',    position: 'Diagonal',    number: 7 },
      { name: 'Leonie Brun',      position: 'Libero',      number: 8 },
      { name: 'Sofia Ritschard',  position: 'Aussen',      number: 9 },
      { name: 'Nora Bättig',      position: 'Zuspielerin', number: 10 },
      { name: 'Lara Vonlanthen',  position: 'Mitte',       number: 11 },
      { name: 'Chiara Rentsch',   position: 'Diagonal',    number: 12 },
      { name: 'Anja Würsch',      position: 'Libero',      number: 14 },
    ],
    HU23: [
      { name: 'Noah Leuthold',    position: 'Zuspieler',  number: 1 },
      { name: 'Elias Friedli',    position: 'Aussen',     number: 2 },
      { name: 'Levin Imhof',      position: 'Aussen',     number: 3 },
      { name: 'Finn Graber',      position: 'Mitte',      number: 5 },
      { name: 'Loris Wälti',      position: 'Mitte',      number: 6 },
      { name: 'Elia Baumgartner', position: 'Diagonal',   number: 7 },
      { name: 'Jannis Bärlocher', position: 'Libero',     number: 8 },
      { name: 'Matteo Scherrer',  position: 'Aussen',     number: 9 },
      { name: 'Dario Flury',      position: 'Zuspieler',  number: 10 },
      { name: 'Ben Kuratli',      position: 'Mitte',      number: 11 },
      { name: 'Jan Blattner',     position: 'Diagonal',   number: 12 },
      { name: 'Samuel Stutz',     position: 'Libero',     number: 14 },
    ],
    HU20: [
      { name: 'Leon Eggli',       position: 'Zuspieler',  number: 1 },
      { name: 'Tim Dietrich',     position: 'Aussen',     number: 2 },
      { name: 'Lio Schär',        position: 'Aussen',     number: 3 },
      { name: 'Milo Reinhard',    position: 'Mitte',      number: 5 },
      { name: 'Nicola Thommen',   position: 'Mitte',      number: 6 },
      { name: 'Joel Portmann',    position: 'Diagonal',   number: 7 },
      { name: 'Rafael Nussbaum',  position: 'Libero',     number: 8 },
      { name: 'Livio Benz',       position: 'Aussen',     number: 9 },
      { name: 'Sven Zaugg',       position: 'Zuspieler',  number: 10 },
      { name: 'Aaron Kneubühl',   position: 'Mitte',      number: 11 },
      { name: 'Robin Aebi',       position: 'Diagonal',   number: 12 },
      { name: 'Yanik Stadelmann', position: 'Libero',     number: 13 },
    ],
    'BB-Lions': [
      { name: 'Alisha Meier',     position: 'Point Guard',    number: 1 },
      { name: 'Yara Schneider',   position: 'Shooting Guard', number: 3 },
      { name: 'Selina Fankhauser',position: 'Small Forward',  number: 5 },
      { name: 'Tamina Bühler',    position: 'Power Forward',  number: 7 },
      { name: 'Nadia Senn',       position: 'Center',         number: 9 },
      { name: 'Olivia Burkart',   position: 'Point Guard',    number: 10 },
      { name: 'Céline Ackermann', position: 'Shooting Guard', number: 11 },
      { name: 'Nora Hediger',     position: 'Small Forward',  number: 12 },
      { name: 'Rahel Studer',     position: 'Power Forward',  number: 14 },
      { name: 'Svenja Wüthrich',  position: 'Center',         number: 15 },
      { name: 'Leandra Eigenmann',position: 'Shooting Guard', number: 20 },
      { name: 'Pia Thalmann',     position: 'Small Forward',  number: 21 },
      { name: 'Seraina Küng',     position: 'Point Guard',    number: 23 },
    ],
    'BB-Rhinos': [
      { name: 'Martina Guyer',    position: 'Point Guard',    number: 2 },
      { name: 'Angela Rüfenacht', position: 'Shooting Guard', number: 4 },
      { name: 'Beatrice Krähenbühl', position: 'Small Forward', number: 6 },
      { name: 'Dominique Lüscher',position: 'Power Forward',  number: 8 },
      { name: 'Carla Siegenthaler',position: 'Center',         number: 10 },
      { name: 'Fabienne Mathys',  position: 'Point Guard',    number: 11 },
      { name: 'Irene Salzmann',   position: 'Shooting Guard', number: 12 },
      { name: 'Nadine Grunder',   position: 'Small Forward',  number: 14 },
      { name: 'Regula Ziegler',   position: 'Power Forward',  number: 15 },
      { name: 'Vera Neuhaus',     position: 'Center',         number: 21 },
      { name: 'Ladina Tschudi',   position: 'Shooting Guard', number: 22 },
      { name: 'Tabea Flückiger',  position: 'Small Forward',  number: 24 },
    ],
    'BB-H1': [
      { name: 'Remo Kaufmann',    position: 'Point Guard',    number: 1 },
      { name: 'Sandro Gygax',     position: 'Shooting Guard', number: 3 },
      { name: 'Dario Aeschbacher',position: 'Small Forward',  number: 5 },
      { name: 'Yannick Moser',    position: 'Power Forward',  number: 7 },
      { name: 'Marc Rohner',      position: 'Center',         number: 9 },
      { name: 'Nicolas Bischof',  position: 'Point Guard',    number: 10 },
      { name: 'Fabian Tanner',    position: 'Shooting Guard', number: 11 },
      { name: 'Christoph Geiger', position: 'Small Forward',  number: 13 },
      { name: 'Lukas Eichenberger',position: 'Power Forward', number: 14 },
      { name: 'Benjamin Nef',     position: 'Center',         number: 15 },
      { name: 'Mischa Steiger',   position: 'Shooting Guard', number: 21 },
      { name: 'Valentin Fehr',    position: 'Small Forward',  number: 23 },
      { name: 'Patrick Rüegsegger',position: 'Point Guard',   number: 25 },
    ],
    'BB-H3': [
      { name: 'André Brügger',    position: 'Point Guard',    number: 2 },
      { name: 'Mike Schüpbach',   position: 'Shooting Guard', number: 4 },
      { name: 'Claudio Zulauf',   position: 'Small Forward',  number: 6 },
      { name: 'Kevin Aeberhard',  position: 'Power Forward',  number: 8 },
      { name: 'Philip Staub',     position: 'Center',         number: 10 },
      { name: 'Diego Reber',      position: 'Point Guard',    number: 11 },
      { name: 'Silvio Gfeller',   position: 'Shooting Guard', number: 12 },
      { name: 'Raphael Burri',    position: 'Small Forward',  number: 14 },
      { name: 'Dominic Schneider',position: 'Power Forward',  number: 15 },
      { name: 'Ivo Gerber',       position: 'Center',         number: 20 },
      { name: 'Stefan Herrmann',  position: 'Shooting Guard', number: 22 },
      { name: 'Curdin Caduff',    position: 'Small Forward',  number: 24 },
    ],
    'BB-H4': [
      { name: 'Roger Lüthy',      position: 'Point Guard',    number: 1 },
      { name: 'Bruno Badertscher',position: 'Shooting Guard', number: 3 },
      { name: 'Matthias Zwahlen', position: 'Small Forward',  number: 5 },
      { name: 'René Isler',       position: 'Power Forward',  number: 7 },
      { name: 'Thomas Anderegg',  position: 'Center',         number: 9 },
      { name: 'Pirmin Blaser',    position: 'Point Guard',    number: 10 },
      { name: 'Ueli Rüegg',       position: 'Shooting Guard', number: 12 },
      { name: 'Linus Pfiffner',   position: 'Small Forward',  number: 14 },
      { name: 'Mario Haldemann',  position: 'Power Forward',  number: 15 },
      { name: 'Gregor Schilter',  position: 'Center',         number: 20 },
      { name: 'Hans Schwyter',    position: 'Shooting Guard', number: 22 },
      { name: 'Armin Hess',       position: 'Small Forward',  number: 23 },
    ],
  },

  // ─── Helpers ────────────────────────────────────────────────

  /** Get team object by short name */
  getTeam: function (short) {
    return this.teams[short] || null;
  },

  /** Get all teams for a sport */
  getTeamsBySport: function (sport) {
    return Object.values(this.teams).filter(function (t) { return t.sport === sport; });
  },

  /** Get upcoming games (score === null) */
  getUpcomingGames: function () {
    return this.games
      .filter(function (g) { return g.score === null; })
      .sort(function (a, b) { return a.date.localeCompare(b.date) || a.time.localeCompare(b.time); });
  },

  /** Get completed games (score !== null), most recent first */
  getCompletedGames: function () {
    return this.games
      .filter(function (g) { return g.score !== null; })
      .sort(function (a, b) { return b.date.localeCompare(a.date) || b.time.localeCompare(a.time); });
  },

  /** Get games for a specific team */
  getGamesByTeam: function (teamShort) {
    return this.games.filter(function (g) { return g.teamShort === teamShort; });
  },

  /** Get sponsors by tier */
  getSponsorsByTier: function (tier) {
    return this.sponsors[tier] || [];
  },

  /** Get team picture URL (or null) */
  getTeamPicture: function (short) {
    return teamPictures[short] || null;
  },

  /** Get roster for a team */
  getRoster: function (teamShort) {
    return this.rosters[teamShort] || [];
  },

  /** Format date as "DD.MM.YYYY" (Swiss format) */
  formatDate: function (isoDate) {
    var parts = isoDate.split('-');
    return parts[2] + '.' + parts[1] + '.' + parts[0];
  },

  /** Format date as "Sa, 1. März 2026" */
  formatDateLong: function (isoDate) {
    var days = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
    var months = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
    var d = new Date(isoDate + 'T12:00:00');
    return days[d.getDay()] + ', ' + d.getDate() + '. ' + months[d.getMonth()] + ' ' + d.getFullYear();
  },

  /** Check if a game is a win for KSCW */
  isWin: function (game) {
    if (!game.score) return null;
    var parts = game.score.split(':');
    var a = parseInt(parts[0], 10);
    var b = parseInt(parts[1], 10);
    return game.isHome ? a > b : b > a;
  },
};

// ─── PocketBase API Fetch ─────────────────────────────────────────
(function () {
  'use strict';

  var PB = 'https://kscw-api.lucanepa.com';
  var D = window.KSCW;

  /**
   * Fetch all pages from a PocketBase collection (auto-paginate).
   * Returns the full items array.
   */
  function fetchAll(collection, params) {
    var qs = params || '';
    var perPage = 200;
    var url = PB + '/api/collections/' + collection + '/records?perPage=' + perPage + (qs ? '&' + qs : '');
    return fetch(url)
      .then(function (r) {
        if (!r.ok) throw new Error('PB ' + collection + ' HTTP ' + r.status);
        return r.json();
      })
      .then(function (data) {
        // If there are more pages, fetch them too
        if (data.totalPages > 1) {
          var promises = [];
          for (var p = 2; p <= data.totalPages; p++) {
            promises.push(
              fetch(url + '&page=' + p)
                .then(function (r) { return r.json(); })
                .then(function (d) { return d.items || []; })
            );
          }
          return Promise.all(promises).then(function (pages) {
            var all = data.items || [];
            for (var i = 0; i < pages.length; i++) {
              all = all.concat(pages[i]);
            }
            return all;
          });
        }
        return data.items || [];
      });
  }

  // Build a PB record ID → team short name lookup from fetched teams
  var pbIdToShort = {};

  /**
   * Map a PB team record to the website_draft team object shape.
   * Returns [shortName, teamObj] tuple.
   */
  function mapTeam(t) {
    var sport = t.sport || 'volleyball';
    var colorKey = pbNameToColorKey(t.name, sport);
    var c = getColor(colorKey);
    // For BB teams, short name uses "BB-" prefix unless the name already has it
    var short = colorKey; // colorKey is the canonical short name
    // Preserve existing mock data fields when available
    var existing = MOCK_TEAMS[short];
    return [short, {
      name: t.full_name || t.name,
      short: short,
      league: t.league || '',
      sport: sport,
      gender: existing ? existing.gender : detectGender(t.name, sport),
      bg: c.bg,
      text: c.text,
      border: c.border,
      training: existing ? existing.training : '',
      venue: existing ? existing.venue : 'Turnhalle Küngenmatt',
      // Extra fields from PB
      teamId: t.team_id || '',
      pbId: t.id,
      slug: t.slug || '',
      season: t.season || '',
      active: t.active !== false,
    }];
  }

  /**
   * Determine the KSCW team short name for a game.
   * Uses the expand.kscw_team relation if available, otherwise the pbIdToShort lookup.
   */
  function resolveTeamShort(g) {
    // If expanded, use the expanded team name
    if (g.expand && g.expand.kscw_team) {
      var et = g.expand.kscw_team;
      var sport = et.sport || (g.game_id && g.game_id.indexOf('bb_') === 0 ? 'basketball' : 'volleyball');
      return pbNameToColorKey(et.name, sport);
    }
    // Fallback: look up by PB record ID
    if (g.kscw_team && pbIdToShort[g.kscw_team]) {
      return pbIdToShort[g.kscw_team];
    }
    return '';
  }

  /**
   * Map a PB game record to the website_draft game object shape.
   */
  function mapGame(g) {
    var teamShort = resolveTeamShort(g);
    var isHome = g.type === 'home';
    var hasScore = g.status === 'completed' && (g.home_score > 0 || g.away_score > 0);
    var score = hasScore ? g.home_score + ':' + g.away_score : null;
    var sport = (g.game_id && g.game_id.indexOf('bb_') === 0) ? 'basketball'
              : (g.source === 'basketplan') ? 'basketball'
              : 'volleyball';

    // Opponent: for home games it's away_team, for away games it's home_team
    var opponent = isHome ? (g.away_team || '') : (g.home_team || '');

    // Set score from sets_json if available
    var setScore = null;
    if (g.sets_json && typeof g.sets_json === 'object') {
      try {
        var sets = Array.isArray(g.sets_json) ? g.sets_json : [];
        if (sets.length > 0) {
          setScore = sets.map(function (s) {
            return (s.home || s[0] || 0) + ':' + (s.away || s[1] || 0);
          }).join(', ');
        }
      } catch (e) { /* ignore */ }
    }

    // Date formatting: PB stores as "2026-03-01 17:00:00.000Z" or ISO
    var date = (g.date || '').substring(0, 10);
    var time = g.time || '';
    // If time looks like "HH:MM:SS", trim to "HH:MM"
    if (time.length > 5) time = time.substring(0, 5);

    return {
      id: g.game_id || g.id,
      date: date,
      time: time,
      teamShort: teamShort,
      opponent: opponent,
      isHome: isHome,
      score: score,
      setScore: setScore,
      sport: sport,
      // Extra PB fields
      status: g.status || 'scheduled',
      league: g.league || '',
      season: g.season || '',
      hall: g.hall || '',
    };
  }

  /**
   * Map PB ranking records into the website_draft rankings structure.
   * Groups by league into { [leagueLabel]: { sport, league, teams: [...] } }
   */
  function mapRankings(items, teamLookup) {
    var byLeague = {};
    for (var i = 0; i < items.length; i++) {
      var r = items[i];
      var league = r.league || 'Unknown';
      var sport = (r.team_id && r.team_id.indexOf('bb_') === 0) ? 'basketball' : 'volleyball';
      var prefix = sport === 'volleyball' ? 'VB' : 'BB';
      var key = prefix + ' ' + league;

      if (!byLeague[key]) {
        byLeague[key] = { sport: sport, league: league, teams: [] };
      }

      // Determine if this is a KSCW team
      var isKSCW = false;
      if (r.team_id && teamIdMap[r.team_id]) isKSCW = true;
      if (r.team && teamLookup[r.team]) isKSCW = true;

      var entry = {
        rank: r.rank || 0,
        team: r.team_name || 'Unknown',
        played: r.played || 0,
        wins: r.won || 0,
        losses: r.lost || 0,
        setsWon: r.sets_won || null,
        setsLost: r.sets_lost || null,
        points: r.points || 0,
      };
      if (isKSCW) entry.isKSCW = true;

      byLeague[key].teams.push(entry);
    }

    // Sort each league by rank
    var keys = Object.keys(byLeague);
    for (var j = 0; j < keys.length; j++) {
      byLeague[keys[j]].teams.sort(function (a, b) { return a.rank - b.rank; });
    }

    return byLeague;
  }

  // ─── Execute the fetch ──────────────────────────────────────
  Promise.all([
    fetchAll('teams', 'filter=(active=true)'),
    fetchAll('games', 'sort=-date&expand=kscw_team'),
    fetchAll('rankings', 'sort=rank'),
    fetchAll('news', 'sort=-published_at&filter=(is_published=true)'),
  ]).then(function (results) {
    var pbTeams = results[0];
    var pbGames = results[1];
    var pbRankings = results[2];
    var pbNews = results[3];

    // ── Build teams map ────────────────────────────────
    var teamsMap = {};
    var teamPbIdSet = {}; // PB record IDs of KSCW teams
    for (var i = 0; i < pbTeams.length; i++) {
      var pair = mapTeam(pbTeams[i]);
      var short = pair[0];
      var obj = pair[1];
      teamsMap[short] = obj;
      pbIdToShort[pbTeams[i].id] = short;
      teamPbIdSet[pbTeams[i].id] = true;
    }

    // Merge: keep mock teams that weren't in PB (preserves training info etc.)
    var mockKeys = Object.keys(MOCK_TEAMS);
    for (var m = 0; m < mockKeys.length; m++) {
      var mk = mockKeys[m];
      if (!teamsMap[mk]) {
        teamsMap[mk] = MOCK_TEAMS[mk];
      } else {
        // Merge training/venue from mock if PB team doesn't have it
        if (!teamsMap[mk].training && MOCK_TEAMS[mk].training) {
          teamsMap[mk].training = MOCK_TEAMS[mk].training;
        }
        if (!teamsMap[mk].venue && MOCK_TEAMS[mk].venue) {
          teamsMap[mk].venue = MOCK_TEAMS[mk].venue;
        }
      }
    }

    D.teams = teamsMap;

    // ── Build games array ──────────────────────────────
    if (pbGames.length > 0) {
      D.games = pbGames.map(mapGame).filter(function (g) {
        return g.teamShort !== ''; // skip games without a resolved KSCW team
      });
    }
    // If PB returned zero games, keep mock games as fallback

    // ── Build rankings ─────────────────────────────────
    if (pbRankings.length > 0) {
      D.rankings = mapRankings(pbRankings, teamPbIdSet);
    }
    // If PB returned zero rankings, keep mock rankings as fallback

    // ── Map news ──────────────────────────────────────────
    if (pbNews && pbNews.length > 0) {
      D.news = pbNews.map(function (n) {
        return {
          id: n.id,
          title: n.title,
          slug: n.slug,
          date: n.published_at || n.created,
          excerpt: n.excerpt || '',
          body: n.body || '',
          category: n.category || 'club',
          author: n.author || 'KSCW',
          image: n.image ? PB + '/api/files/news/' + n.id + '/' + n.image : null,
        };
      });
    }

    D.ready = true;
    D.dataSource = 'pocketbase';
    console.log('[KSCW] Data loaded from PocketBase: ' + pbTeams.length + ' teams, ' + D.games.length + ' games, ' + pbRankings.length + ' ranking entries, ' + (pbNews ? pbNews.length : 0) + ' news');

    // Dispatch event for pages that want to re-render with live data
    document.dispatchEvent(new Event('kscw-data-ready'));

  }).catch(function (err) {
    console.warn('[KSCW] PocketBase fetch failed, using fallback mock data:', err);
    D.ready = true;
    D.dataSource = 'mock';
    document.dispatchEvent(new Event('kscw-data-ready'));
  });

})();
