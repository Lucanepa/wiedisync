/// <reference path="../node_modules/pocketbase/dist/pocketbase.d.ts" />

// Scorer duty email reminders
// Schedule: daily at 11:00 Zurich time (10:00 UTC winter / 09:00 UTC summer)
// Sends reminders to assigned members for tomorrow's games
// Manual: POST /api/scorer-reminders (superuser auth required)

// ── Cron: daily at 09:00 UTC (= 11:00 CEST / 10:00 CET) ──────────
// Using 09:00 UTC to cover both summer (11:00) and winter (10:00).
// In winter it fires at 10:00 Zurich, in summer at 11:00 Zurich.

cronAdd("scorer-reminders", "0 9 * * *", function() {
  var lib = require(__hooks + "/scorer_reminders_lib.js")
  console.log("[Scorer Reminders] Starting daily reminder cron...")
  try {
    var result = lib.sendReminders($app)
    console.log("[Scorer Reminders] Cron completed: " + result.sent + " sent")
  } catch (e) {
    console.log("[Scorer Reminders] Cron failed: " + e)
  }
})

// ── Manual trigger: POST /api/scorer-reminders (superuser only) ────

routerAdd("POST", "/api/scorer-reminders", function(e) {
  var lib = require(__hooks + "/scorer_reminders_lib.js")
  console.log("[Scorer Reminders] Manual trigger")
  try {
    var result = lib.sendReminders(e.app)
    return e.json(200, {
      success: true,
      tomorrow: lib.tomorrowYMD(),
      sent: result.sent,
      errors: result.errors,
    })
  } catch (err) {
    console.log("[Scorer Reminders] Manual trigger failed: " + err)
    return e.json(500, {
      success: false,
      error: String(err),
    })
  }
}, $apis.requireSuperuserAuth())

// ── Dry-run: POST /api/scorer-reminders/dry-run (superuser only) ──
// Sends a test reminder email with fake game data to a given address.
// Body: { "email": "you@example.com", "sport": "vb" | "bb", "role": "scorer" | "taefeler" | "scorer_taefeler" | "bb_anschreiber" | "bb_zeitnehmer" | "bb_24s_official" }

routerAdd("POST", "/api/scorer-reminders/dry-run", function(e) {
  var lib = require(__hooks + "/scorer_reminders_lib.js")
  var body = e.requestInfo().body
  var email = body.email || ""
  var sport = body.sport || "vb"
  var roleKey = body.role || (sport === "bb" ? "bb_anschreiber" : "scorer")

  if (!email) {
    throw new BadRequestError("email is required")
  }

  var lang = "de"
  var firstName = "Test"
  // Try to find member by email to get their language preference
  try {
    var member = e.app.findFirstRecordByFilter("members", "email = {:email}", { email: email })
    if (member) {
      lang = lib.parseLang(member.getString("language") || "")
      firstName = member.getString("first_name") || "Test"
    }
  } catch (_) {}

  // Build a fake game record-like object with getString()
  var isVb = sport !== "bb"
  var fakeGame = {
    _data: {
      date: lib.tomorrowYMD(),
      time: isVb ? "19:30:00" : "20:00:00",
      home_team: isVb ? "KSC Wiedikon H3" : "KSC Wiedikon U16",
      away_team: isVb ? "VBC Z\u00fcri Unterland H3" : "Basket Z\u00fcrich U16",
      league: isVb ? "3. Liga Herren" : "U16 Herren",
      source: isVb ? "swiss_volley" : "basketplan",
    },
    getString: function(key) { return this._data[key] || "" },
    getId: function() { return "dry-run-test" },
  }

  var hallName = isVb ? "Utogrund, Z\u00fcrich" : "Hardau, Z\u00fcrich"
  var hallUrl = isVb ? "https://maps.google.com/?q=Utogrund,+Uetlibergstrasse+350,+8045+Z%C3%BCrich" : "https://maps.google.com/?q=Sportanlage+Hardau,+Bullingerstrasse+71,+8004+Z%C3%BCrich"

  // Use lib functions for plain text and HTML
  var plainText = lib.buildPlainText(firstName, roleKey, fakeGame, hallName, lang, hallUrl)
  var html = lib.buildHtml(firstName, roleKey, fakeGame, hallName, lang, hallUrl)

  // Override subject with [DRY RUN] tag
  var strings = { de: "Erinnerung Schreibereinsatz", en: "Scorer Duty Reminder" }
  var subject = (strings[lang] || strings["de"]) + " [DRY RUN]"

  try {
    var message = new MailerMessage({
      from: {
        address: e.app.settings().meta.senderAddress,
        name: lang === "en" ? "Wiedisync - Scorer Duty" : "Wiedisync - Schreibereins\u00e4tze",
      },
      to: [{ address: email, name: firstName }],
      subject: subject,
      text: plainText,
      html: html,
    })

    e.app.newMailClient().send(message)

    console.log("[Scorer Reminders] Dry-run sent to " + email + " (" + sport + ", " + roleKey + ", " + lang + ")")
    return e.json(200, {
      success: true,
      dryRun: true,
      email: email,
      sport: sport,
      role: roleKey,
      lang: lang,
      tomorrow: lib.tomorrowYMD(),
    })
  } catch (err) {
    console.log("[Scorer Reminders] Dry-run failed: " + err)
    return e.json(500, { success: false, error: String(err) })
  }
}, $apis.requireSuperuserAuth())

// ── ICS download: GET /api/scorer-reminders/ics (public) ──────────
// Generates and serves a .ics calendar file for a scorer duty event.
// Query params: date, time, home, away, hall, role, lang

routerAdd("GET", "/api/scorer-reminders/ics", function(e) {
  var lib = require(__hooks + "/scorer_reminders_lib.js")
  var q = e.request.url.query()

  var date = q.get("date") || ""
  var time = q.get("time") || "19:00:00"
  var home = q.get("home") || ""
  var away = q.get("away") || ""
  var hall = q.get("hall") || ""
  var role = q.get("role") || ""
  var lang = q.get("lang") || "de"

  if (!date || !home || !away) {
    throw new BadRequestError("missing required params: date, home, away")
  }

  var icsContent = lib.buildIcsContent(date, time, home, away, hall, role, lang)
  var filename = "scorer-duty-" + date + ".ics"

  e.response.header().set("Content-Type", "text/calendar; charset=utf-8")
  e.response.header().set("Content-Disposition", "attachment; filename=\"" + filename + "\"")
  return e.string(200, icsContent)
})

// ── Real-game dry-run: POST /api/scorer-reminders/dry-run-game (superuser only) ──
// Uses a real game's data but sends to the given email instead of the assigned member.
// Body: { "email": "you@example.com", "gameId": "abc123" }

routerAdd("POST", "/api/scorer-reminders/dry-run-game", function(e) {
  var lib = require(__hooks + "/scorer_reminders_lib.js")
  var body = e.requestInfo().body
  var email = body.email || ""
  var gameId = body.gameId || ""

  if (!email) throw new BadRequestError("email is required")
  if (!gameId) throw new BadRequestError("gameId is required")

  var game = e.app.findRecordById("games", gameId)

  var hallName = ""
  var hallUrl = ""
  var hallId = game.getString("hall")
  if (hallId) {
    try {
      var hall = e.app.findRecordById("halls", hallId)
      hallName = hall.getString("name")
      hallUrl = hall.getString("maps_url") || ""
    } catch (_) {}
  }

  var lang = "de"
  var firstName = "Test"
  try {
    var member = e.app.findFirstRecordByFilter("members", "email = {:email}", { email: email })
    if (member) {
      lang = lib.parseLang(member.getString("language") || "")
      firstName = member.getString("first_name") || "Test"
    }
  } catch (_) {}

  var roles = []
  var gameSport = lib.detectSport(game)
  if (gameSport === "bb") {
    if (game.getString("bb_anschreiber")) roles.push("bb_anschreiber")
    if (game.getString("bb_zeitnehmer")) roles.push("bb_zeitnehmer")
    if (game.getString("bb_24s_official")) roles.push("bb_24s_official")
    if (roles.length === 0) roles.push("bb_anschreiber")
  } else {
    if (game.getString("scorer_member")) roles.push("scorer")
    if (game.getString("taefeler_member")) roles.push("taefeler")
    if (game.getString("scorer_taefeler_member")) roles.push("scorer_taefeler")
    if (roles.length === 0) roles.push("scorer")
  }

  var sent = []
  for (var i = 0; i < roles.length; i++) {
    var roleKey = roles[i]
    var plainText = lib.buildPlainText(firstName, roleKey, game, hallName, lang, hallUrl)
    var html = lib.buildHtml(firstName, roleKey, game, hallName, lang, hallUrl)
    var strings = { de: "Erinnerung Schreibereinsatz", en: "Scorer Duty Reminder" }
    var subject = (strings[lang] || strings["de"]) + " [DRY RUN]"

    var message = new MailerMessage({
      from: {
        address: e.app.settings().meta.senderAddress,
        name: lang === "en" ? "Wiedisync - Scorer Duty" : "Wiedisync - Schreibereins\u00e4tze",
      },
      to: [{ address: email, name: firstName }],
      subject: subject,
      text: plainText,
      html: html,
    })
    e.app.newMailClient().send(message)
    sent.push(roleKey)
  }

  console.log("[Scorer Reminders] Dry-run-game sent to " + email + " for game " + gameId + " roles: " + sent.join(","))
  return e.json(200, {
    success: true,
    dryRun: true,
    email: email,
    gameId: gameId,
    rolesSent: sent,
    lang: lang,
    game: game.getString("home_team") + " vs " + game.getString("away_team"),
    date: game.getString("date"),
    hall: hallName,
  })
}, $apis.requireSuperuserAuth())
