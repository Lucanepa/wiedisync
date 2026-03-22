// Shared scorer duty reminder logic — loaded via require() from hooks
// Sends email reminders to assigned scorer/taefeler members the day before their game
// Language-aware: reads member.language ("german" | "english"), defaults to "de"
// Sport-aware: VB gets arrival time + warning, BB gets game info only

var tpl = require(__hooks + "/email_template_lib.js")

var PB_URL = "https://api.kscw.ch"

// ── Helpers ──────────────────────────────────────────────────────────

function tomorrowYMD() {
  var now = new Date()
  var year = now.getUTCFullYear()
  var marchLast = new Date(Date.UTC(year, 2, 31))
  var marchSun = 31 - marchLast.getUTCDay()
  var octLast = new Date(Date.UTC(year, 9, 31))
  var octSun = 31 - octLast.getUTCDay()
  var dstStart = Date.UTC(year, 2, marchSun, 1, 0, 0)
  var dstEnd = Date.UTC(year, 9, octSun, 1, 0, 0)
  var utcMs = now.getTime()
  var offsetHours = (utcMs >= dstStart && utcMs < dstEnd) ? 2 : 1
  var zurichMs = utcMs + offsetHours * 3600000
  var tmr = new Date(zurichMs + 24 * 3600000)
  var y = tmr.getUTCFullYear()
  var m = String(tmr.getUTCMonth() + 1).padStart(2, "0")
  var d = String(tmr.getUTCDate()).padStart(2, "0")
  return y + "-" + m + "-" + d
}

// Arrival time in minutes before game start
function arrivalMinutes(roleKey, sport) {
  if (sport === "bb") return 15
  if (roleKey === "taefeler") return 10
  return 30 // scorer or scorer_taefeler
}

// Detect sport from game record source field
function detectSport(game) {
  var source = game.getString("source") || ""
  if (source === "basketplan") return "bb"
  return "vb"
}

// Parse member language field ("german"/"english"/"de"/"en") to "de"/"en"
function parseLang(rawLang) {
  if (rawLang === "english" || rawLang === "en") return "en"
  return "de"
}

// ── i18n strings ─────────────────────────────────────────────────────

var STRINGS = {
  de: {
    subject: "Erinnerung Schreibereinsatz",
    headerTitle: "Schreibereinsatz",
    greeting: "Hallo",
    intro: "Du hast morgen einen Einsatz:",
    roleScorer: "Schreiber",
    roleTaefeler: "T\u00e4feler",
    roleCombined: "Schreiber+T\u00e4feler",
    roleBbAnschreiber: "Anschreiber",
    roleBbZeitnehmer: "Zeitnehmer",
    roleBb24s: "24s-Operator",
    dateLabel: "Datum",
    timeLabel: "Zeit",
    hallLabel: "Halle",
    arrivalLabel: "Ankunftszeit",
    arrivalText: "Bitte sei mindestens <strong>{{mins}} Minuten</strong> vor Spielbeginn in der Halle.",
    arrivalTextPlain: "Bitte sei mindestens {{mins}} Minuten vor Spielbeginn in der Halle.",
    warningLabel: "Achtung",
    warningText: "Versp\u00e4tetes Erscheinen oder Nichterscheinen wird mit einer <strong>Busse (50.\u2013 CHF)</strong> bestraft.",
    warningTextPlain: "Verspaetetes Erscheinen oder Nichterscheinen wird mit einer Busse (50.- CHF) bestraft.",
    thanks: "Vielen Dank f\u00fcr deinen Einsatz!",
    thanksPlain: "Vielen Dank fuer deinen Einsatz!",
    addToCalendar: "\ud83d\udcc5 Zum Kalender hinzuf\u00fcgen",
  },
  en: {
    subject: "Scorer Duty Reminder",
    headerTitle: "Scorer Duty",
    greeting: "Hello",
    intro: "You have a duty tomorrow:",
    roleScorer: "Scorer",
    roleTaefeler: "Scoreboard",
    roleCombined: "Scorer+Scoreboard",
    roleBbAnschreiber: "Scorekeeper",
    roleBbZeitnehmer: "Timekeeper",
    roleBb24s: "24s Operator",
    dateLabel: "Date",
    timeLabel: "Time",
    hallLabel: "Hall",
    arrivalLabel: "Arrival Time",
    arrivalText: "Please be at the hall at least <strong>{{mins}} minutes</strong> before the game starts.",
    arrivalTextPlain: "Please be at the hall at least {{mins}} minutes before the game starts.",
    warningLabel: "Warning",
    warningText: "Late arrival or failure to appear will result in a <strong>fine (50.\u2013 CHF)</strong>.",
    warningTextPlain: "Late arrival or failure to appear will result in a fine (50.- CHF).",
    thanks: "Thank you for your support!",
    thanksPlain: "Thank you for your support!",
    addToCalendar: "\ud83d\udcc5 Add to Calendar",
  },
}

function t(lang, key) {
  var s = STRINGS[lang] || STRINGS["de"]
  return s[key] || STRINGS["de"][key] || key
}

function roleName(roleKey, lang) {
  if (roleKey === "scorer") return t(lang, "roleScorer")
  if (roleKey === "taefeler") return t(lang, "roleTaefeler")
  if (roleKey === "scorer_taefeler") return t(lang, "roleCombined")
  if (roleKey === "bb_anschreiber") return t(lang, "roleBbAnschreiber")
  if (roleKey === "bb_zeitnehmer") return t(lang, "roleBbZeitnehmer")
  if (roleKey === "bb_24s_official") return t(lang, "roleBb24s")
  return roleKey
}

// ── ICS calendar helper ─────────────────────────────────────────────
// Generates a data: URI for .ics with 2h reminder

function simpleEncode(str) {
  var out = ""
  for (var i = 0; i < str.length; i++) {
    var ch = str.charAt(i)
    if (/[A-Za-z0-9\-_.~]/.test(ch)) { out += ch }
    else if (ch === "\r") { out += "%0D" }
    else if (ch === "\n") { out += "%0A" }
    else if (ch === " ") { out += "%20" }
    else if (ch === ":") { out += "%3A" }
    else if (ch === "/") { out += "%2F" }
    else if (ch === ";") { out += "%3B" }
    else if (ch === "=") { out += "%3D" }
    else if (ch === ",") { out += "%2C" }
    else if (ch === "+") { out += "%2B" }
    else {
      var code = str.charCodeAt(i)
      out += "%" + (code < 16 ? "0" : "") + code.toString(16).toUpperCase()
    }
  }
  return out
}

// Build the URL to the ICS endpoint (public, no auth needed)
// Encodes game details as query params so the endpoint doesn't need DB access
function buildIcsUrl(game, hallName, role, lang) {
  var dateRaw = game.getString("date") || ""
  var timeRaw = game.getString("time") || "19:00:00"
  var home = game.getString("home_team") || ""
  var away = game.getString("away_team") || ""

  var params = "date=" + simpleEncode(dateRaw) +
    "&time=" + simpleEncode(timeRaw) +
    "&home=" + simpleEncode(home) +
    "&away=" + simpleEncode(away) +
    "&hall=" + simpleEncode(hallName || "") +
    "&role=" + simpleEncode(role) +
    "&lang=" + simpleEncode(lang)

  return PB_URL + "/api/scorer-reminders/ics?" + params
}

// Generate raw ICS content for a scorer duty event with 2h reminder
function buildIcsContent(date, time, home, away, hallName, role, lang) {
  var d = date.replace(/-/g, "")
  var t = (time || "19:00:00").replace(/:/g, "").slice(0, 6)
  var dtStart = d + "T" + t
  var hh = parseInt(t.slice(0, 2), 10) + 2
  var dtEnd = d + "T" + String(hh).padStart(2, "0") + t.slice(2)

  var summary = (lang === "en" ? "Scorer Duty: " : "Schreibereinsatz: ") + home + " vs " + away

  var icsLines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//KSC Wiedikon//Scorer Reminder//EN",
    "BEGIN:VEVENT",
    "DTSTART;TZID=Europe/Zurich:" + dtStart,
    "DTEND;TZID=Europe/Zurich:" + dtEnd,
    "SUMMARY:" + summary,
    "DESCRIPTION:" + role,
    "LOCATION:" + (hallName || ""),
    "BEGIN:VALARM",
    "TRIGGER:-PT2H",
    "ACTION:DISPLAY",
    "DESCRIPTION:" + (lang === "en" ? "Scorer duty in 2 hours" : "Schreibereinsatz in 2 Stunden"),
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR"
  ]

  return icsLines.join("\r\n")
}

// Role badge color
function badgeColorForRole(roleKey) {
  if (roleKey === "scorer_taefeler") return "#7c3aed" // purple
  if (roleKey === "taefeler") return "#059669" // green
  if (roleKey === "bb_anschreiber") return "#ea580c" // orange
  if (roleKey === "bb_zeitnehmer") return "#0891b2" // cyan
  if (roleKey === "bb_24s_official") return "#d946ef" // fuchsia
  return "#2563eb" // blue for scorer
}

// ── Plain text ───────────────────────────────────────────────────────

function buildPlainText(firstName, roleKey, game, hallName, lang, hallUrl) {
  var dateStr = tpl.formatDateCH(game.getString("date"))
  var timeStr = tpl.formatTime(game.getString("time"))
  var home = game.getString("home_team")
  var away = game.getString("away_team")
  var sport = detectSport(game)
  var mins = arrivalMinutes(roleKey, sport)
  var role = roleName(roleKey, lang)
  var s = STRINGS[lang] || STRINGS["de"]

  var hallDisplay = hallName || "\u2014"
  if (hallUrl) hallDisplay += " (" + hallUrl + ")"

  var lines = [
    s.greeting + " " + firstName + ",",
    "",
    s.intro,
    "",
    "  " + role,
    "  " + s.dateLabel + ": " + dateStr,
    "  " + s.timeLabel + ": " + timeStr,
    "  " + home + " vs " + away,
    "  " + s.hallLabel + ": " + hallDisplay,
    "",
    s.arrivalTextPlain.replace("{{mins}}", String(mins)),
    "",
    s.warningTextPlain,
    "",
    s.thanksPlain,
  ]

  return tpl.buildPlainLayout(lines, { title: s.subject })
}

// ── HTML email (uses shared template layout) ─────────────────────────

function buildHtml(firstName, roleKey, game, hallName, lang, hallUrl) {
  var dateRaw = game.getString("date")
  var dateStr = tpl.weekday(dateRaw, lang) + ", " + tpl.formatDateCH(dateRaw)
  var timeStr = tpl.formatTime(game.getString("time"))
  var home = game.getString("home_team")
  var away = game.getString("away_team")
  var league = game.getString("league")
  var sport = detectSport(game)
  var mins = arrivalMinutes(roleKey, sport)
  var role = roleName(roleKey, lang)
  var s = STRINGS[lang] || STRINGS["de"]

  // Build custom game card body (too specific for buildInfoCard)
  var body = ''

  // Game card with role badge + match info + details
  body += '<table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;border:1px solid #334155;border-radius:8px;overflow:hidden">'

  // Role badge
  body += '<tr><td style="padding:16px 20px 10px">' +
    tpl.buildBadge(role, badgeColorForRole(roleKey)) +
    '</td></tr>'

  // Match info (Home vs Away)
  body += '<tr><td style="padding:4px 20px 6px">' +
    '<div style="font-size:18px;font-weight:700;color:#f1f5f9">' + home + '</div>' +
    '<div style="font-size:13px;color:#64748b;margin:2px 0">vs</div>' +
    '<div style="font-size:18px;font-weight:700;color:#f1f5f9">' + away + '</div>' +
    (league ? '<div style="font-size:12px;color:#64748b;margin-top:4px">' + league + '</div>' : '') +
    '</td></tr>'

  // Divider
  body += '<tr><td style="padding:0 20px"><div style="border-top:1px solid #334155"></div></td></tr>'

  // Date / Time / Hall details
  var hallValue = hallUrl
    ? '<a href="' + hallUrl + '" style="color:#60a5fa;text-decoration:none">' + (hallName || "\u2014") + ' \u2197</a>'
    : (hallName || "\u2014")

  body += '<tr><td style="padding:14px 20px 16px">' +
    '<table width="100%" cellpadding="0" cellspacing="0">' +
    '<tr>' +
    '<td style="width:50%;vertical-align:top;padding-right:8px">' +
    '<div style="font-size:11px;text-transform:uppercase;color:#64748b;letter-spacing:0.5px;margin-bottom:2px">' + s.dateLabel + '</div>' +
    '<div style="font-size:14px;font-weight:600;color:#e2e8f0">' + dateStr + '</div>' +
    '</td>' +
    '<td style="width:50%;vertical-align:top;padding-left:8px">' +
    '<div style="font-size:11px;text-transform:uppercase;color:#64748b;letter-spacing:0.5px;margin-bottom:2px">' + s.timeLabel + '</div>' +
    '<div style="font-size:14px;font-weight:600;color:#e2e8f0">' + timeStr + '</div>' +
    '</td>' +
    '</tr>' +
    '<tr><td colspan="2" style="padding-top:10px">' +
    '<div style="font-size:11px;text-transform:uppercase;color:#64748b;letter-spacing:0.5px;margin-bottom:2px">' + s.hallLabel + '</div>' +
    '<div style="font-size:14px;font-weight:600;color:#e2e8f0">' + hallValue + '</div>' +
    '</td></tr>' +
    '</table>' +
    '</td></tr>'

  body += '</table>' // end game card

  // Spacing before alert boxes
  body += '<div style="height:12px"></div>'

  // Arrival time alert
  body += tpl.buildAlertBox("info", s.arrivalLabel, s.arrivalText.replace("{{mins}}", String(mins)))

  body += '<div style="height:12px"></div>'

  // Warning alert
  body += tpl.buildAlertBox("warning", s.warningLabel, s.warningText)

  // Build calendar download URL (served by PB endpoint)
  var icsUrl = buildIcsUrl(game, hallName, role, lang)

  // Wrap in shared branded layout
  return tpl.buildEmailLayout(body, {
    lang: lang,
    sport: sport,
    title: s.headerTitle,
    greeting: s.greeting + ' <strong style="color:#ffffff">' + firstName + '</strong>,<br>' +
      '<span style="font-size:14px;color:#94a3b8">' + s.intro + '</span>',
    ctaUrl: icsUrl,
    ctaLabel: t(lang, "addToCalendar"),
    footerExtra: s.thanks,
  })
}

// ── Main logic ───────────────────────────────────────────────────────

function sendReminders(app) {
  // Check if reminders are enabled via app_settings
  try {
    var setting = app.findFirstRecordByFilter("app_settings", 'key = "scorer_reminders_enabled"')
    if (!setting || !setting.getBool("enabled")) {
      console.log("[Scorer Reminders] Reminders are disabled in app_settings, skipping")
      return { sent: 0, errors: [], reason: "disabled" }
    }
  } catch (e) {
    console.log("[Scorer Reminders] Could not read app_settings, skipping: " + e)
    return { sent: 0, errors: [], reason: "settings_error" }
  }

  var tomorrow = tomorrowYMD()
  console.log("[Scorer Reminders] Checking games for " + tomorrow)

  var games
  try {
    games = app.findRecordsByFilter(
      "games",
      'type = "home" && (source = "swiss_volley" || source = "basketplan") && date >= {:dateStart} && date < {:dateEnd} && status != "completed" && status != "postponed"',
      "+time",
      200,
      0,
      { dateStart: tomorrow + " 00:00:00.000Z", dateEnd: tomorrow + " 23:59:59.999Z" }
    )
  } catch (e) {
    console.log("[Scorer Reminders] No games found for " + tomorrow)
    return { sent: 0, errors: [], reason: "no games tomorrow" }
  }

  if (!games || games.length === 0) {
    console.log("[Scorer Reminders] No games found for " + tomorrow)
    return { sent: 0, errors: [], reason: "no games tomorrow" }
  }

  console.log("[Scorer Reminders] Found " + games.length + " game(s)")

  var sent = 0
  var errors = []

  for (var i = 0; i < games.length; i++) {
    var game = games[i]
    var gameId = game.id

    var hallName = ""
    var hallUrl = ""
    var hallId = game.getString("hall")
    if (hallId) {
      try {
        var hall = app.findRecordById("halls", hallId)
        hallName = hall.getString("name")
        hallUrl = hall.getString("maps_url") || ""
      } catch (_) {}
    }

    var assignments = []
    var sport = detectSport(game)

    if (sport === "bb") {
      var bbAnschreiber = game.getString("bb_scorer_member")
      var bbZeitnehmer = game.getString("bb_timekeeper_member")
      var bb24s = game.getString("bb_24s_official")
      if (bbAnschreiber) assignments.push({ roleKey: "bb_anschreiber", memberId: bbAnschreiber })
      if (bbZeitnehmer) assignments.push({ roleKey: "bb_zeitnehmer", memberId: bbZeitnehmer })
      if (bb24s) assignments.push({ roleKey: "bb_24s_official", memberId: bb24s })
    } else {
      var scorerMember = game.getString("scorer_member")
      var taefelerMember = game.getString("taefeler_member")
      var combinedMember = game.getString("scorer_taefeler_member")
      if (scorerMember) assignments.push({ roleKey: "scorer", memberId: scorerMember })
      if (taefelerMember) assignments.push({ roleKey: "taefeler", memberId: taefelerMember })
      if (combinedMember) assignments.push({ roleKey: "scorer_taefeler", memberId: combinedMember })
    }

    if (assignments.length === 0) {
      console.log("[Scorer Reminders] Game " + gameId + " has no assignments, skipping")
      continue
    }

    for (var j = 0; j < assignments.length; j++) {
      var a = assignments[j]

      var member
      try {
        member = app.findRecordById("members", a.memberId)
      } catch (_) {
        console.log("[Scorer Reminders] Could not find member " + a.memberId)
        errors.push(a.memberId + ": member not found")
        continue
      }

      var email = member.getString("email")
      if (!email || email.indexOf("@placeholder") !== -1) {
        console.log("[Scorer Reminders] Member " + a.memberId + " has no email, skipping")
        continue
      }

      var firstName = member.getString("first_name")
      var lang = parseLang(member.getString("language") || "")

      var displayRole = roleName(a.roleKey, lang)
      var plainText = buildPlainText(firstName, a.roleKey, game, hallName, lang, hallUrl)
      var html = buildHtml(firstName, a.roleKey, game, hallName, lang, hallUrl)
      var subject = t(lang, "subject")

      try {
        var message = new MailerMessage({
          from: {
            address: app.settings().meta.senderAddress,
            name: lang === "en" ? "Wiedisync - Scorer Duty" : "Wiedisync - Schreibereins\u00e4tze",
          },
          to: [{ address: email, name: firstName }],
          cc: [{ address: "reminders@volleyball.lucanepa.com" }],
          subject: subject,
          text: plainText,
          html: html,
        })

        app.newMailClient().send(message)
        console.log("[Scorer Reminders] Sent to " + email + " (" + displayRole + ", " + lang + ")")
        sent++

        try {
          var log = new Record(app.findCollectionByNameOrId("email_logs"))
          log.set("type", "scorer_reminder")
          log.set("to_address", email)
          log.set("from_address", app.settings().meta.senderAddress)
          log.set("from_name", lang === "en" ? "Wiedisync - Scorer Duty" : "Wiedisync - Schreibereinsätze")
          log.set("subject", subject)
          log.set("success", true)
          log.set("error_message", "")
          log.set("topic", displayRole + " | " + game.getString("home_team") + " vs " + game.getString("away_team"))
          app.save(log)
        } catch (logErr) {
          console.log("[Scorer Reminders] Could not save log: " + logErr)
        }
      } catch (err) {
        var errMsg = String(err)
        console.log("[Scorer Reminders] Failed to send to " + email + ": " + errMsg)
        errors.push(email + ": " + errMsg)

        try {
          var logFail = new Record(app.findCollectionByNameOrId("email_logs"))
          logFail.set("type", "scorer_reminder")
          logFail.set("to_address", email)
          logFail.set("from_address", app.settings().meta.senderAddress)
          logFail.set("from_name", lang === "en" ? "Wiedisync - Scorer Duty" : "Wiedisync - Schreibereinsätze")
          logFail.set("subject", subject)
          logFail.set("success", false)
          logFail.set("error_message", errMsg)
          logFail.set("topic", displayRole + " | " + game.getString("home_team") + " vs " + game.getString("away_team"))
          app.save(logFail)
        } catch (_) {}
      }
    }
  }

  console.log("[Scorer Reminders] Done: " + sent + " sent, " + errors.length + " error(s)")
  return { sent: sent, errors: errors }
}

module.exports = {
  sendReminders: sendReminders,
  tomorrowYMD: tomorrowYMD,
  buildPlainText: buildPlainText,
  buildHtml: buildHtml,
  buildIcsContent: buildIcsContent,
  detectSport: detectSport,
  parseLang: parseLang,
}
