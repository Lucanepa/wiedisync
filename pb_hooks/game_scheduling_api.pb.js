/// <reference path="../node_modules/pocketbase/dist/pocketbase.d.ts" />

// Game Scheduling (Terminplanung) — API endpoints

var lib = require(__hooks + "/game_scheduling_lib.js")

var _secrets = JSON.parse(String.fromCharCode.apply(null, new Uint8Array($os.readFile(__hooks + "/secrets.json"))))
var TURNSTILE_SECRET = _secrets.TURNSTILE_SECRET

function verifyTurnstile(token) {
  if (!token) return false
  try {
    var resp = $http.send({
      method: "POST",
      url: "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret: TURNSTILE_SECRET,
        response: token,
      }),
    })
    var data = JSON.parse(resp.raw)
    return data.success === true
  } catch (err) {
    console.log("[GameScheduling] Turnstile verification error: " + err)
    return false
  }
}

// Input validation helpers
var PB_ID_PATTERN = /^[a-z0-9]{15}$/i
var TOKEN_PATTERN = /^[a-z0-9]{32}$/
var EMAIL_PATTERN = /^[^\s"\\]+@[^\s"\\]+\.[^\s"\\]+$/

function validatePbId(id) {
  if (!PB_ID_PATTERN.test(id)) throw new BadRequestError("invalid_id")
  return id
}

function validateToken(token) {
  if (!TOKEN_PATTERN.test(token)) throw new BadRequestError("invalid_token_format")
  return token
}

function validateEmail(email) {
  if (!EMAIL_PATTERN.test(email) || email.length > 254) throw new BadRequestError("invalid_email")
  return email
}

function isSuperuser(e) {
  var info = e.requestInfo()
  return info.auth && info.auth.collectionName === "_superusers"
}

function isAdmin(e) {
  if (isSuperuser(e)) return true
  var info = e.requestInfo()
  if (!info.auth) return false
  try {
    var member = $app.findRecordById("members", info.auth.id)
    var roles = member.get("role")
    if (roles && (roles.indexOf("admin") >= 0 || roles.indexOf("superuser") >= 0)) {
      return true
    }
  } catch (_) {}
  return false
}

// ── POST /api/terminplanung/register ──────────────────────────────────
// Public endpoint. Opponent registers with club info + Turnstile token.

routerAdd("POST", "/api/terminplanung/register", function (e) {
  var body = e.requestInfo().body

  var turnstileToken = body.turnstile_token || ""
  if (!verifyTurnstile(turnstileToken)) {
    throw new BadRequestError("turnstile_failed")
  }

  var clubName = (body.club_name || "").trim()
  var contactName = (body.contact_name || "").trim()
  var contactEmail = (body.contact_email || "").trim()
  var kscwTeamId = (body.kscw_team_id || "").trim()

  if (!clubName || !contactName || !contactEmail || !kscwTeamId) {
    throw new BadRequestError("missing_fields")
  }

  validateEmail(contactEmail)
  validatePbId(kscwTeamId)

  // Validate team exists
  var team
  try {
    team = $app.findRecordById("teams", kscwTeamId)
  } catch (_) {
    throw new BadRequestError("invalid_team")
  }

  // Find the active/open season
  var seasons
  try {
    seasons = $app.findRecordsByFilter(
      "game_scheduling_seasons",
      'status = "open"',
      "-created",
      1,
      0
    )
  } catch (_) {}

  if (!seasons || seasons.length === 0) {
    throw new BadRequestError("season_not_open")
  }
  var season = seasons[0]

  // Check if opponent already registered for this team+season
  try {
    var existing = $app.findRecordsByFilter(
      "game_scheduling_opponents",
      'season = "' + season.id + '" && kscw_team = "' + kscwTeamId + '" && contact_email = "' + contactEmail + '"',
      "",
      1,
      0
    )
    if (existing && existing.length > 0) {
      // Return existing token
      return e.json(200, {
        token: existing[0].getString("token"),
        team_name: team.getString("name"),
        already_registered: true,
      })
    }
  } catch (_) {}

  // Generate unique token
  var token = lib.generateToken()

  // Create opponent record
  var collection = $app.findCollectionByNameOrId("game_scheduling_opponents")
  var record = new Record(collection)
  record.set("season", season.id)
  record.set("club_name", clubName)
  record.set("contact_name", contactName)
  record.set("contact_email", contactEmail)
  record.set("kscw_team", kscwTeamId)
  record.set("token", token)

  $app.save(record)

  console.log("[GameScheduling] Registered opponent: " + clubName + " for team " + team.getString("name"))

  return e.json(200, {
    token: token,
    team_name: team.getString("name"),
    already_registered: false,
  })
})


// ── GET /api/terminplanung/slots/:token ───────────────────────────────
// Returns available slots for the opponent's KSCW team.

routerAdd("GET", "/api/terminplanung/slots/{token}", function (e) {
  var token = e.request.pathValue("token")
  if (!token) throw new BadRequestError("missing_token")
  validateToken(token)

  // Find opponent by token
  var opponents
  try {
    opponents = $app.findRecordsByFilter(
      "game_scheduling_opponents",
      'token = "' + token + '"',
      "",
      1,
      0
    )
  } catch (_) {}

  if (!opponents || opponents.length === 0) {
    throw new NotFoundError("invalid_token")
  }

  var opponent = opponents[0]
  var teamId = opponent.getString("kscw_team")
  var seasonId = opponent.getString("season")

  // Fetch available slots for this team
  var slots
  try {
    slots = $app.findRecordsByFilter(
      "game_scheduling_slots",
      'season = "' + seasonId + '" && kscw_team = "' + teamId + '" && status = "available"',
      "+date",
      500,
      0
    )
  } catch (_) {
    slots = []
  }

  // Expand hall names
  var result = []
  for (var i = 0; i < slots.length; i++) {
    var s = slots[i]
    var hallName = ""
    try {
      var hall = $app.findRecordById("halls", s.getString("hall"))
      hallName = hall.getString("name")
    } catch (_) {}

    result.push({
      id: s.id,
      date: s.getString("date").slice(0, 10),
      start_time: s.getString("start_time"),
      end_time: s.getString("end_time"),
      hall_id: s.getString("hall"),
      hall_name: hallName,
      source: s.getString("source"),
    })
  }

  // Also return opponent info and existing bookings
  var bookings
  try {
    bookings = $app.findRecordsByFilter(
      "game_scheduling_bookings",
      'opponent = "' + opponent.id + '"',
      "",
      10,
      0
    )
  } catch (_) {
    bookings = []
  }

  var bookingData = []
  for (var b = 0; b < bookings.length; b++) {
    var bk = bookings[b]
    bookingData.push({
      id: bk.id,
      type: bk.getString("type"),
      status: bk.getString("status"),
      slot: bk.getString("slot"),
      proposed_datetime_1: bk.getString("proposed_datetime_1"),
      proposed_place_1: bk.getString("proposed_place_1"),
      proposed_datetime_2: bk.getString("proposed_datetime_2"),
      proposed_place_2: bk.getString("proposed_place_2"),
      proposed_datetime_3: bk.getString("proposed_datetime_3"),
      proposed_place_3: bk.getString("proposed_place_3"),
      confirmed_proposal: bk.getInt("confirmed_proposal"),
    })
  }

  // Get team name
  var teamName = ""
  try {
    var t = $app.findRecordById("teams", teamId)
    teamName = t.getString("name")
  } catch (_) {}

  return e.json(200, {
    opponent: {
      id: opponent.id,
      club_name: opponent.getString("club_name"),
      contact_name: opponent.getString("contact_name"),
      kscw_team_id: teamId,
      kscw_team_name: teamName,
      home_game: opponent.getString("home_game"),
      away_game: opponent.getString("away_game"),
    },
    slots: result,
    bookings: bookingData,
  })
})


// ── POST /api/terminplanung/book-home/:token ──────────────────────────
// Opponent picks a home game slot. Atomic check + book.

routerAdd("POST", "/api/terminplanung/book-home/{token}", function (e) {
  var token = e.request.pathValue("token")
  var body = e.requestInfo().body
  var slotId = body.slot_id || ""

  if (!token || !slotId) {
    throw new BadRequestError("missing_fields")
  }
  validateToken(token)
  validatePbId(slotId)

  // Find opponent
  var opponents
  try {
    opponents = $app.findRecordsByFilter(
      "game_scheduling_opponents",
      'token = "' + token + '"',
      "",
      1,
      0
    )
  } catch (_) {}
  if (!opponents || opponents.length === 0) {
    throw new NotFoundError("invalid_token")
  }
  var opponent = opponents[0]

  // Check slot is still available
  var slot
  try {
    slot = $app.findRecordById("game_scheduling_slots", slotId)
  } catch (_) {
    throw new NotFoundError("slot_not_found")
  }

  if (slot.getString("status") !== "available") {
    throw new BadRequestError("slot_unavailable")
  }

  // Verify slot belongs to the opponent's team
  if (slot.getString("kscw_team") !== opponent.getString("kscw_team")) {
    throw new BadRequestError("wrong_team")
  }

  var teamId = opponent.getString("kscw_team")
  var dateStr = slot.getString("date").slice(0, 10)
  var hallId = slot.getString("hall")
  var startTime = slot.getString("start_time")
  var endTime = slot.getString("end_time")

  // Run conflict checks
  var conflicts = lib.checkAllConflicts(teamId, dateStr, hallId, startTime, endTime)
  if (!conflicts.ok) {
    throw new BadRequestError("conflict_" + conflicts.reason)
  }

  // Create booking
  var bookingCol = $app.findCollectionByNameOrId("game_scheduling_bookings")
  var booking = new Record(bookingCol)
  booking.set("season", opponent.getString("season"))
  booking.set("opponent", opponent.id)
  booking.set("type", "home_slot_pick")
  booking.set("game", slot.getString("game") || "")
  booking.set("slot", slotId)
  booking.set("status", "confirmed") // Home picks are auto-confirmed
  $app.save(booking)

  // Update slot status
  slot.set("status", "booked")
  slot.set("booking", booking.id)
  $app.save(slot)

  console.log("[GameScheduling] Home slot booked: " + slotId + " by " + opponent.getString("club_name"))

  // Send confirmation email (fire-and-forget)
  try {
    var teamName = ""
    try {
      var team = $app.findRecordById("teams", teamId)
      teamName = team.getString("name")
    } catch (_) {}

    var hallName = ""
    try {
      var hall = $app.findRecordById("halls", hallId)
      hallName = hall.getString("name")
    } catch (_) {}

    // Email to opponent
    var tpl = require(__hooks + "/email_template_lib.js")
    var opponentBody = tpl.buildInfoCard([
      { label: "Datum", value: dateStr, halfWidth: true },
      { label: "Zeit", value: startTime + " - " + endTime, halfWidth: true },
      { label: "Halle", value: hallName },
      { label: "KSCW Team", value: teamName },
    ])
    var message = new MailerMessage({
      from: {
        address: $app.settings().meta.senderAddress,
        name: $app.settings().meta.senderName,
      },
      to: [{ address: opponent.getString("contact_email") }],
      subject: "Spieltermin best\u00e4tigt \u2013 KSCW " + teamName,
      html: tpl.buildEmailLayout(opponentBody, {
        title: "Terminbest\u00e4tigung",
        sport: "vb",
        greeting: "Hallo <strong style=\"color:#ffffff\">" + opponent.getString("contact_name") + "</strong>,<br>" +
          "<span style=\"font-size:14px;color:#94a3b8\">Der Spieltermin wurde best\u00e4tigt:</span>",
        footerExtra: "Viele Gr\u00fcsse, KSCW",
      }),
      text: tpl.buildPlainLayout([
        "Hallo " + opponent.getString("contact_name") + ",",
        "",
        "Der Spieltermin wurde best\u00e4tigt:",
        "",
        "  Datum: " + dateStr,
        "  Zeit: " + startTime + " - " + endTime,
        "  Halle: " + hallName,
        "  KSCW Team: " + teamName,
        "",
        "Viele Gr\u00fcsse, KSCW",
      ], { title: "Terminbest\u00e4tigung" }),
    })
    $app.newMailClient().send(message)

    // Email to admin
    var adminBody = tpl.buildInfoCard([
      { label: "Gegner", value: opponent.getString("club_name") },
      { label: "Kontakt", value: opponent.getString("contact_name") + " (" + opponent.getString("contact_email") + ")" },
      { label: "KSCW Team", value: teamName },
      { label: "Datum", value: dateStr, halfWidth: true },
      { label: "Zeit", value: startTime + " - " + endTime, halfWidth: true },
      { label: "Halle", value: hallName },
    ])
    var adminMessage = new MailerMessage({
      from: {
        address: $app.settings().meta.senderAddress,
        name: $app.settings().meta.senderName,
      },
      to: [{ address: "admin@volleyball.lucanepa.com" }],
      subject: "Neue Terminbuchung \u2013 " + opponent.getString("club_name") + " (" + teamName + ")",
      html: tpl.buildEmailLayout(adminBody, {
        title: "Neue Heimspiel-Buchung",
        sport: "vb",
      }),
      text: tpl.buildPlainLayout([
        "Neue Heimspiel-Buchung:",
        "",
        "  Gegner: " + opponent.getString("club_name"),
        "  Kontakt: " + opponent.getString("contact_name") + " (" + opponent.getString("contact_email") + ")",
        "  KSCW Team: " + teamName,
        "  Datum: " + dateStr,
        "  Zeit: " + startTime + " - " + endTime,
        "  Halle: " + hallName,
      ], { title: "Neue Terminbuchung" }),
    })
    $app.newMailClient().send(adminMessage)
  } catch (mailErr) {
    console.log("[GameScheduling] Email send error: " + mailErr)
  }

  return e.json(200, {
    booking_id: booking.id,
    status: "confirmed",
  })
})


// ── POST /api/terminplanung/propose-away/:token ───────────────────────
// Opponent submits 3 away game proposals.

routerAdd("POST", "/api/terminplanung/propose-away/{token}", function (e) {
  var token = e.request.pathValue("token")
  var body = e.requestInfo().body

  if (!token) throw new BadRequestError("missing_token")
  validateToken(token)

  // Find opponent
  var opponents
  try {
    opponents = $app.findRecordsByFilter(
      "game_scheduling_opponents",
      'token = "' + token + '"',
      "",
      1,
      0
    )
  } catch (_) {}
  if (!opponents || opponents.length === 0) {
    throw new NotFoundError("invalid_token")
  }
  var opponent = opponents[0]
  var teamId = opponent.getString("kscw_team")

  // Validate proposals
  var proposals = []
  var errors = []

  for (var i = 1; i <= 3; i++) {
    var dt = (body["proposed_datetime_" + i] || "").trim()
    var place = (body["proposed_place_" + i] || "").trim()

    if (!dt || !place) {
      errors.push({ proposal: i, error: "missing_fields" })
      continue
    }

    // Extract date from datetime for conflict checking
    var dateStr = dt.slice(0, 10)

    // Check team conflicts (away game still affects the KSCW team's schedule)
    var teamCheck = lib.checkTeamConflicts(teamId, dateStr)
    if (!teamCheck.ok) {
      errors.push({ proposal: i, error: "conflict_" + teamCheck.reason })
    }

    var crossCheck = lib.checkCrossTeamConflicts(teamId, dateStr)
    if (!crossCheck.ok) {
      errors.push({ proposal: i, error: "conflict_cross_team", teams: crossCheck.teams })
    }

    proposals.push({ datetime: dt, place: place })
  }

  if (proposals.length < 3) {
    throw new BadRequestError("need_3_proposals")
  }

  // Check for existing away proposal
  try {
    var existingBookings = $app.findRecordsByFilter(
      "game_scheduling_bookings",
      'opponent = "' + opponent.id + '" && type = "away_proposal"',
      "",
      1,
      0
    )
    if (existingBookings && existingBookings.length > 0) {
      // Update existing instead of creating new
      var existing = existingBookings[0]
      existing.set("proposed_datetime_1", body.proposed_datetime_1 || "")
      existing.set("proposed_place_1", body.proposed_place_1 || "")
      existing.set("proposed_datetime_2", body.proposed_datetime_2 || "")
      existing.set("proposed_place_2", body.proposed_place_2 || "")
      existing.set("proposed_datetime_3", body.proposed_datetime_3 || "")
      existing.set("proposed_place_3", body.proposed_place_3 || "")
      existing.set("status", "pending")
      existing.set("confirmed_proposal", 0)
      $app.save(existing)

      console.log("[GameScheduling] Away proposals updated for " + opponent.getString("club_name"))
      return e.json(200, { booking_id: existing.id, status: "pending", updated: true })
    }
  } catch (_) {}

  // Create booking with proposals
  var bookingCol = $app.findCollectionByNameOrId("game_scheduling_bookings")
  var booking = new Record(bookingCol)
  booking.set("season", opponent.getString("season"))
  booking.set("opponent", opponent.id)
  booking.set("type", "away_proposal")
  booking.set("game", opponent.getString("away_game") || "")
  booking.set("proposed_datetime_1", body.proposed_datetime_1 || "")
  booking.set("proposed_place_1", body.proposed_place_1 || "")
  booking.set("proposed_datetime_2", body.proposed_datetime_2 || "")
  booking.set("proposed_place_2", body.proposed_place_2 || "")
  booking.set("proposed_datetime_3", body.proposed_datetime_3 || "")
  booking.set("proposed_place_3", body.proposed_place_3 || "")
  booking.set("status", "pending")
  $app.save(booking)

  console.log("[GameScheduling] Away proposals submitted by " + opponent.getString("club_name"))

  // Notify admin
  try {
    var teamName = ""
    try {
      var team = $app.findRecordById("teams", teamId)
      teamName = team.getString("name")
    } catch (_) {}

    var tpl = require(__hooks + "/email_template_lib.js")
    var proposalBody = tpl.buildParagraph(
      "Neue Ausw\u00e4rtsvorschl\u00e4ge von <strong>" + opponent.getString("club_name") + "</strong> f\u00fcr KSCW " + teamName + ":",
      { color: "#e2e8f0" }
    )
    proposalBody += tpl.buildInfoCard([
      { label: "Vorschlag 1", value: (body.proposed_datetime_1 || "\u2014") + " \u2013 " + (body.proposed_place_1 || "\u2014") },
      { label: "Vorschlag 2", value: (body.proposed_datetime_2 || "\u2014") + " \u2013 " + (body.proposed_place_2 || "\u2014") },
      { label: "Vorschlag 3", value: (body.proposed_datetime_3 || "\u2014") + " \u2013 " + (body.proposed_place_3 || "\u2014") },
    ])
    var adminMessage = new MailerMessage({
      from: {
        address: $app.settings().meta.senderAddress,
        name: $app.settings().meta.senderName,
      },
      to: [{ address: "admin@volleyball.lucanepa.com" }],
      subject: "Neue Ausw\u00e4rtsvorschl\u00e4ge \u2013 " + opponent.getString("club_name") + " (" + teamName + ")",
      html: tpl.buildEmailLayout(proposalBody, {
        title: "Ausw\u00e4rtsvorschl\u00e4ge",
        sport: "vb",
        ctaUrl: "https://kscw.lucanepa.com/admin/terminplanung/dashboard",
        ctaLabel: "Zum Dashboard",
      }),
      text: tpl.buildPlainLayout([
        "Neue Auswaertsvorschlaege von " + opponent.getString("club_name") + " fuer KSCW " + teamName + ":",
        "",
        "  1. " + (body.proposed_datetime_1 || "-") + " - " + (body.proposed_place_1 || "-"),
        "  2. " + (body.proposed_datetime_2 || "-") + " - " + (body.proposed_place_2 || "-"),
        "  3. " + (body.proposed_datetime_3 || "-") + " - " + (body.proposed_place_3 || "-"),
      ], { title: "Auswaertsvorschlaege", url: "https://kscw.lucanepa.com/admin/terminplanung/dashboard" }),
    })
    $app.newMailClient().send(adminMessage)
  } catch (mailErr) {
    console.log("[GameScheduling] Email error: " + mailErr)
  }

  return e.json(200, {
    booking_id: booking.id,
    status: "pending",
    warnings: errors.length > 0 ? errors : undefined,
  })
})


// ── POST /api/terminplanung/admin/generate-slots ──────────────────────
// Admin-only. Generates game_scheduling_slots from hall_slots + Spielsamstage.

routerAdd("POST", "/api/terminplanung/admin/generate-slots", function (e) {
  if (!isAdmin(e)) {
    throw new ForbiddenError("admin_required")
  }

  var body = e.requestInfo().body
  var seasonId = body.season_id || ""
  if (!seasonId) throw new BadRequestError("missing_season_id")
  validatePbId(seasonId)

  var season
  try {
    season = $app.findRecordById("game_scheduling_seasons", seasonId)
  } catch (_) {
    throw new NotFoundError("season_not_found")
  }

  var seasonStr = season.getString("season") // e.g. "2025/26"
  var teamSlotConfig = season.get("team_slot_config") || {}

  // Parse season date range (Sep 1 – May 31)
  var parts = seasonStr.split("/")
  var startYear = parseInt(parts[0])
  var endYearShort = parseInt(parts[1])
  var endYear = startYear + 1

  var seasonStart = startYear + "-09-01"
  var seasonEnd = endYear + "-05-31"

  // Fetch all active volleyball teams
  var teams
  try {
    teams = $app.findRecordsByFilter("teams", 'active = true && sport = "volleyball"', "", 50, 0)
  } catch (_) {
    throw new BadRequestError("failed_to_fetch_teams")
  }

  // Fetch hall closures for the season
  var closures
  try {
    closures = $app.findRecordsByFilter(
      "hall_closures",
      'start_date <= "' + seasonEnd + '" && end_date >= "' + seasonStart + '"',
      "",
      1000,
      0
    )
  } catch (_) {
    closures = []
  }

  // Helper: check if date falls within any closure for a hall
  function isClosedOn(hallId, dateStr) {
    for (var c = 0; c < closures.length; c++) {
      if (closures[c].getString("hall") === hallId) {
        var cStart = closures[c].getString("start_date").slice(0, 10)
        var cEnd = closures[c].getString("end_date").slice(0, 10)
        if (dateStr >= cStart && dateStr <= cEnd) return true
      }
    }
    return false
  }

  // Fetch existing games for conflict avoidance
  var existingGames
  try {
    existingGames = $app.findRecordsByFilter(
      "games",
      'date >= "' + seasonStart + '" && date <= "' + seasonEnd + '" && status != "postponed"',
      "",
      1000,
      0
    )
  } catch (_) {
    existingGames = []
  }

  function hasGameOnDate(teamId, dateStr) {
    for (var g = 0; g < existingGames.length; g++) {
      if (existingGames[g].getString("kscw_team") === teamId &&
          existingGames[g].getString("date").slice(0, 10) === dateStr) {
        return true
      }
    }
    return false
  }

  // Delete existing generated slots for this season (regenerate)
  try {
    var oldSlots = $app.findRecordsByFilter(
      "game_scheduling_slots",
      'season = "' + seasonId + '" && status = "available"',
      "",
      5000,
      0
    )
    for (var d = 0; d < oldSlots.length; d++) {
      $app.delete(oldSlots[d])
    }
    console.log("[GameScheduling] Cleared " + oldSlots.length + " old available slots")
  } catch (_) {}

  var slotCol = $app.findCollectionByNameOrId("game_scheduling_slots")
  var totalCreated = 0

  function fmt(dt) {
    return dt.getFullYear() + "-" +
      String(dt.getMonth() + 1).padStart(2, "0") + "-" +
      String(dt.getDate()).padStart(2, "0")
  }

  for (var t = 0; t < teams.length; t++) {
    var teamId = teams[t].id
    var teamName = teams[t].getString("name")
    var config = teamSlotConfig[teamId] || {}
    var source = config.source || "hall_slot"

    if (source === "spielsamstag") {
      // This team uses Spielsamstag slots — generated separately below
      continue
    }

    // Find hall_slots for this team
    var hallSlots
    try {
      hallSlots = $app.findRecordsByFilter(
        "hall_slots",
        'team = "' + teamId + '" && recurring = true',
        "-start_time",
        50,
        0
      )
    } catch (_) {
      hallSlots = []
    }

    if (hallSlots.length === 0) {
      console.log("[GameScheduling] No hall_slots for team " + teamName + ", skipping")
      continue
    }

    // Find the "latest" slot (highest start_time)
    var latestSlot = hallSlots[0] // Already sorted by -start_time
    if (config.hall_slot_id) {
      // Admin specified a specific slot
      for (var hs = 0; hs < hallSlots.length; hs++) {
        if (hallSlots[hs].id === config.hall_slot_id) {
          latestSlot = hallSlots[hs]
          break
        }
      }
    }

    var dow = latestSlot.getInt("day_of_week") // 0=Mon, 6=Sun (ISO)
    var startTime = latestSlot.getString("start_time").slice(0, 5)
    var endTime = latestSlot.getString("end_time").slice(0, 5)
    var hallId = latestSlot.getString("hall")

    // Generate weekly dates for the season
    var current = new Date(seasonStart + "T00:00:00Z")
    var end = new Date(seasonEnd + "T00:00:00Z")

    // Align to the correct day of week
    // JS: 0=Sun..6=Sat → ISO: 0=Mon..6=Sun
    var jsDow = (dow + 1) % 7 // Convert ISO→JS
    var currentJsDow = current.getUTCDay()
    var daysToAdd = (jsDow - currentJsDow + 7) % 7
    current = new Date(current.getTime() + daysToAdd * 86400000)

    while (current <= end) {
      var dateStr = fmt(current)

      // Skip closures
      if (!isClosedOn(hallId, dateStr) && !hasGameOnDate(teamId, dateStr)) {
        var record = new Record(slotCol)
        record.set("season", seasonId)
        record.set("kscw_team", teamId)
        record.set("date", dateStr)
        record.set("start_time", startTime)
        record.set("end_time", endTime)
        record.set("hall", hallId)
        record.set("source", "hall_slot")
        record.set("status", "available")
        $app.save(record)
        totalCreated++
      }

      current = new Date(current.getTime() + 7 * 86400000) // Next week
    }

    console.log("[GameScheduling] Generated slots for " + teamName)
  }

  // Generate Spielsamstag slots
  var spielsamstage = season.get("spielsamstage") || []
  for (var s = 0; s < spielsamstage.length; s++) {
    var ss = spielsamstage[s]
    var ssDate = ss.date
    var ssSlots = ss.slots || []

    if (isClosedOn(ssSlots.length > 0 && ssSlots[0].hall_id ? ssSlots[0].hall_id : "", ssDate)) {
      continue
    }

    for (var sl = 0; sl < ssSlots.length; sl++) {
      var ssSlot = ssSlots[sl]
      // Determine end time (2h game windows)
      var endTimeMap = { "11:00": "13:00", "13:30": "15:30", "16:00": "18:00" }
      var ssEndTime = endTimeMap[ssSlot.time] || "18:00"

      // Find teams configured for Spielsamstag
      var ssTeamIds = []
      for (var tk in teamSlotConfig) {
        if (teamSlotConfig[tk].source === "spielsamstag") {
          ssTeamIds.push(tk)
        }
      }

      // Create one slot per Spielsamstag team (or unassigned if no teams configured)
      if (ssTeamIds.length === 0) {
        // Create generic slot (no team assigned)
        var record = new Record(slotCol)
        record.set("season", seasonId)
        record.set("kscw_team", "")
        record.set("date", ssDate)
        record.set("start_time", ssSlot.time)
        record.set("end_time", ssEndTime)
        record.set("hall", ssSlot.hall_id || "")
        record.set("source", "spielsamstag")
        record.set("status", "available")
        $app.save(record)
        totalCreated++
      } else {
        for (var sti = 0; sti < ssTeamIds.length; sti++) {
          if (!hasGameOnDate(ssTeamIds[sti], ssDate)) {
            var rec = new Record(slotCol)
            rec.set("season", seasonId)
            rec.set("kscw_team", ssTeamIds[sti])
            rec.set("date", ssDate)
            rec.set("start_time", ssSlot.time)
            rec.set("end_time", ssEndTime)
            rec.set("hall", ssSlot.hall_id || "")
            rec.set("source", "spielsamstag")
            rec.set("status", "available")
            $app.save(rec)
            totalCreated++
          }
        }
      }
    }
  }

  console.log("[GameScheduling] Total slots generated: " + totalCreated)

  return e.json(200, {
    total_created: totalCreated,
    season: seasonStr,
  })
})


// ── POST /api/terminplanung/admin/confirm-away ────────────────────────
// Admin confirms one of 3 away proposals.

routerAdd("POST", "/api/terminplanung/admin/confirm-away", function (e) {
  if (!isAdmin(e)) {
    throw new ForbiddenError("admin_required")
  }

  var body = e.requestInfo().body
  var bookingId = body.booking_id || ""
  var proposalNumber = parseInt(body.proposal_number || "0")

  if (!bookingId || proposalNumber < 1 || proposalNumber > 3) {
    throw new BadRequestError("invalid_params")
  }
  validatePbId(bookingId)

  var booking
  try {
    booking = $app.findRecordById("game_scheduling_bookings", bookingId)
  } catch (_) {
    throw new NotFoundError("booking_not_found")
  }

  if (booking.getString("type") !== "away_proposal") {
    throw new BadRequestError("not_away_proposal")
  }

  var confirmedDatetime = booking.getString("proposed_datetime_" + proposalNumber)
  var confirmedPlace = booking.getString("proposed_place_" + proposalNumber)

  if (!confirmedDatetime) {
    throw new BadRequestError("proposal_empty")
  }

  // Update booking
  booking.set("confirmed_proposal", proposalNumber)
  booking.set("status", "confirmed")
  booking.set("admin_notes", body.admin_notes || "")
  $app.save(booking)

  // Update the game record if it exists
  var gameId = booking.getString("game")
  if (gameId) {
    try {
      var game = $app.findRecordById("games", gameId)
      var dateStr = confirmedDatetime.slice(0, 10)
      var timeStr = confirmedDatetime.length > 10 ? confirmedDatetime.slice(11, 16) : ""
      game.set("date", dateStr)
      if (timeStr) game.set("time", timeStr)
      $app.save(game)
    } catch (_) {}
  }

  // Email confirmation to opponent
  try {
    var opponent = $app.findRecordById("game_scheduling_opponents", booking.getString("opponent"))
    var teamName = ""
    try {
      var team = $app.findRecordById("teams", opponent.getString("kscw_team"))
      teamName = team.getString("name")
    } catch (_) {}

    var tpl = require(__hooks + "/email_template_lib.js")
    var awayBody = tpl.buildInfoCard([
      { label: "Datum/Zeit", value: confirmedDatetime },
      { label: "Ort", value: confirmedPlace },
      { label: "KSCW Team", value: teamName },
    ])
    var message = new MailerMessage({
      from: {
        address: $app.settings().meta.senderAddress,
        name: $app.settings().meta.senderName,
      },
      to: [{ address: opponent.getString("contact_email") }],
      subject: "Ausw\u00e4rtsspiel best\u00e4tigt \u2013 KSCW " + teamName,
      html: tpl.buildEmailLayout(awayBody, {
        title: "Terminbest\u00e4tigung",
        sport: "vb",
        greeting: "Hallo <strong style=\"color:#ffffff\">" + opponent.getString("contact_name") + "</strong>,<br>" +
          "<span style=\"font-size:14px;color:#94a3b8\">Der Ausw\u00e4rtsspiel-Termin wurde best\u00e4tigt:</span>",
        footerExtra: "Viele Gr\u00fcsse, KSCW",
      }),
      text: tpl.buildPlainLayout([
        "Hallo " + opponent.getString("contact_name") + ",",
        "",
        "Der Auswaertsspiel-Termin wurde bestaetigt:",
        "",
        "  Datum/Zeit: " + confirmedDatetime,
        "  Ort: " + confirmedPlace,
        "  KSCW Team: " + teamName,
        "",
        "Viele Gruesse, KSCW",
      ], { title: "Terminbestaetigung" }),
    })
    $app.newMailClient().send(message)
  } catch (mailErr) {
    console.log("[GameScheduling] Email error: " + mailErr)
  }

  console.log("[GameScheduling] Away proposal " + proposalNumber + " confirmed for booking " + bookingId)

  return e.json(200, {
    status: "confirmed",
    confirmed_datetime: confirmedDatetime,
    confirmed_place: confirmedPlace,
  })
})


// ── POST /api/terminplanung/admin/block-slot ──────────────────────────
// Admin manually blocks/unblocks a slot.

routerAdd("POST", "/api/terminplanung/admin/block-slot", function (e) {
  if (!isAdmin(e)) {
    throw new ForbiddenError("admin_required")
  }

  var body = e.requestInfo().body
  var slotId = body.slot_id || ""
  var action = body.action || "" // "block" or "unblock"

  if (!slotId || (action !== "block" && action !== "unblock")) {
    throw new BadRequestError("invalid_params")
  }
  validatePbId(slotId)

  var slot
  try {
    slot = $app.findRecordById("game_scheduling_slots", slotId)
  } catch (_) {
    throw new NotFoundError("slot_not_found")
  }

  if (action === "block") {
    if (slot.getString("status") === "booked") {
      throw new BadRequestError("cannot_block_booked")
    }
    slot.set("status", "blocked")
  } else {
    slot.set("status", "available")
  }

  $app.save(slot)

  return e.json(200, { status: slot.getString("status") })
})
