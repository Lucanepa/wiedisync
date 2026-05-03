/**
 * Push notification i18n
 *
 * Buckets recipient member ids by their `members.language` and provides a
 * translation table for every push string the backend produces. Web push
 * payloads are baked at send time, so the recipient's in-app locale toggle
 * cannot localize them after delivery — strings must be picked per recipient
 * before fanout.
 *
 * `members.language` is a free-text DB column with values:
 *   german | swiss_german | english | french | italian | (null)
 * which we map to 5 short codes: de | gsw | en | fr | it.
 * Null / unknown falls back to `de` (canonical club language, same default
 * Postgres uses for new rows).
 */

// ── Member.language → short code ────────────────────────────────────
const LANG_TO_CODE = {
  german: 'de',
  swiss_german: 'gsw',
  english: 'en',
  french: 'fr',
  italian: 'it',
}

const LOCALES = ['de', 'gsw', 'en', 'fr', 'it']

export function memberLangToCode(lang) {
  return LANG_TO_CODE[lang] || 'de'
}

/**
 * Group `memberIds` into per-locale buckets keyed by short code.
 * Members without a `language` row (or with an unrecognised value) land in `de`.
 *
 * @param {object} db - knex instance
 * @param {Array<number|string>} memberIds
 * @returns {Promise<{de: number[], gsw: number[], en: number[], fr: number[], it: number[]}>}
 */
export async function bucketMembersByLocale(db, memberIds) {
  const buckets = { de: [], gsw: [], en: [], fr: [], it: [] }
  if (!Array.isArray(memberIds) || memberIds.length === 0) return buckets
  const ids = [...new Set(memberIds.filter(Boolean))]
  if (ids.length === 0) return buckets
  const rows = await db('members').whereIn('id', ids).select('id', 'language')
  const langMap = new Map()
  for (const r of rows) langMap.set(r.id, r.language)
  for (const id of ids) {
    const code = memberLangToCode(langMap.get(id))
    buckets[code].push(id)
  }
  return buckets
}

// ── Translation table ───────────────────────────────────────────────
// Keys mirror the call sites that previously hardcoded German strings.
// Variables are substituted via `{name}` / `{team}` placeholders.

const T = {
  'tomorrow.title': {
    de: 'Morgen',
    gsw: 'Morn',
    en: 'Tomorrow',
    fr: 'Demain',
    it: 'Domani',
  },
  'tomorrow.body': {
    de: 'Du hast morgen eine Aktivität',
    gsw: 'Du häsch morn ä Aktivität',
    en: 'You have an activity tomorrow',
    fr: 'Tu as une activité demain',
    it: 'Hai un’attività domani',
  },
  'deadline.title': {
    de: 'RSVP-Erinnerung',
    gsw: 'RSVP-Erinnerig',
    en: 'RSVP reminder',
    fr: 'Rappel RSVP',
    it: 'Promemoria RSVP',
  },
  'deadline.body': {
    de: 'Anmeldefrist läuft morgen ab',
    gsw: 'Aamäldefrist lauft morn ab',
    en: 'Sign-up deadline is tomorrow',
    fr: 'La date limite d’inscription est demain',
    it: 'La scadenza per l’iscrizione è domani',
  },
  'joinRequest.title': {
    de: 'Neue Beitrittsanfrage: {name}',
    gsw: 'Neui Bytrittsaafrog: {name}',
    en: 'New join request: {name}',
    fr: 'Nouvelle demande d’adhésion : {name}',
    it: 'Nuova richiesta di adesione: {name}',
  },
  'joinRequest.body': {
    de: '{name} möchte {team} beitreten',
    gsw: '{name} möcht zu {team}',
    en: '{name} wants to join {team}',
    fr: '{name} souhaite rejoindre {team}',
    it: '{name} vuole unirsi a {team}',
  },
  'delegation.accepted.title': {
    de: 'Delegation angenommen',
    gsw: 'Delegation aagnoh',
    en: 'Delegation accepted',
    fr: 'Délégation acceptée',
    it: 'Delega accettata',
  },
  'delegation.accepted.body': {
    de: 'Deine Schreiber-Delegation wurde angenommen',
    gsw: 'Dini Schryber-Delegation isch aagnoh worde',
    en: 'Your scorer delegation was accepted',
    fr: 'Ta délégation de marqueur a été acceptée',
    it: 'La tua delega di segnapunti è stata accettata',
  },
  'delegation.declined.title': {
    de: 'Delegation abgelehnt',
    gsw: 'Delegation abglehnt',
    en: 'Delegation declined',
    fr: 'Délégation refusée',
    it: 'Delega rifiutata',
  },
  'delegation.declined.body': {
    de: 'Deine Schreiber-Delegation wurde abgelehnt',
    gsw: 'Dini Schryber-Delegation isch abglehnt worde',
    en: 'Your scorer delegation was declined',
    fr: 'Ta délégation de marqueur a été refusée',
    it: 'La tua delega di segnapunti è stata rifiutata',
  },
  'eventInvite.body': {
    de: 'Du wurdest eingeladen',
    gsw: 'Du bisch yyglade',
    en: 'You were invited',
    fr: 'Tu as été invité·e',
    it: 'Sei stato invitato',
  },
  'message.generic': {
    de: 'Neue Nachricht in KSCW',
    gsw: 'Neui Nachricht i KSCW',
    en: 'New message in KSCW',
    fr: 'Nouveau message sur KSCW',
    it: 'Nuovo messaggio in KSCW',
  },
}

/**
 * Look up a translated push string for a locale, with `{name}` / `{team}`
 * variable substitution. Falls back to `de` if the locale is missing.
 */
export function tPush(locale, key, vars = {}) {
  const row = T[key]
  if (!row) return ''
  const code = LOCALES.includes(locale) ? locale : 'de'
  const tpl = row[code] || row.de || ''
  return tpl.replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? String(vars[k]) : ''))
}

/**
 * Convenience helper: bucket recipients and dispatch one push per locale.
 *
 * `sendFn(memberIds, title, body)` is supplied by the caller so this module
 * stays decoupled from the (two) `sendPushToMembers` implementations
 * (kscw-endpoints + kscw-hooks have their own).
 *
 * @param {object} db - knex
 * @param {Array<number|string>} memberIds
 * @param {(ids: any[], title: string, body: string) => Promise<unknown>} sendFn
 * @param {string} titleKey - translation key for the title (or null to use a literal)
 * @param {string} bodyKey - translation key for the body
 * @param {object} vars - variables for both keys
 * @param {string} [literalTitle] - if set, used verbatim in every locale (e.g. user content like an event title or announcement title which is itself already localized)
 */
export async function sendLocalizedPush(db, memberIds, sendFn, titleKey, bodyKey, vars = {}, literalTitle = null) {
  const buckets = await bucketMembersByLocale(db, memberIds)
  for (const code of LOCALES) {
    const ids = buckets[code]
    if (!ids || ids.length === 0) continue
    const title = literalTitle != null ? literalTitle : tPush(code, titleKey, vars)
    const body = tPush(code, bodyKey, vars)
    await sendFn(ids, title, body)
  }
}
