/// <reference path="../pb_data/types.d.ts" />

// ── Game Scheduling helpers ──
// Extracted from game_scheduling_api.pb.js for PB 0.36 JSVM scope isolation.

// ── Validation & auth helpers ──

var TURNSTILE_SECRET = $os.getenv("TURNSTILE_SECRET")
var PB_ID_PATTERN = /^[a-z0-9]{15}$/i
var TOKEN_PATTERN = /^[a-z0-9]{32}$/
var EMAIL_PATTERN = /^[^\s"\\]+@[^\s"\\]+\.[^\s"\\]+$/

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

// ── Conflict checking helpers ──

/**
 * Check team conflicts: same-day + 1-day gap rule
 */
function checkTeamConflicts(teamId, dateStr) {
  var d = new Date(dateStr + "T00:00:00Z")

  var prev = new Date(d.getTime() - 86400000)
  var next = new Date(d.getTime() + 86400000)

  function fmt(dt) {
    return dt.getFullYear() + "-" +
      String(dt.getMonth() + 1).padStart(2, "0") + "-" +
      String(dt.getDate()).padStart(2, "0")
  }

  var prevStr = fmt(prev)
  var nextStr = fmt(next)

  try {
    var games = $app.findRecordsByFilter(
      "games",
      'kscw_team = "' + teamId + '" && status != "postponed" && date >= "' + prevStr + '" && date <= "' + nextStr + '"',
      "",
      100,
      0
    )

    for (var i = 0; i < games.length; i++) {
      var gameDate = games[i].getString("date").slice(0, 10)
      if (gameDate === dateStr) {
        return { ok: false, reason: "same_day" }
      }
      if (gameDate === prevStr || gameDate === nextStr) {
        return { ok: false, reason: "gap_rule" }
      }
    }
  } catch (_) {}

  try {
    var bookedSlots = $app.findRecordsByFilter(
      "game_scheduling_slots",
      'kscw_team = "' + teamId + '" && status = "booked" && date >= "' + prevStr + '" && date <= "' + nextStr + '"',
      "",
      100,
      0
    )

    for (var j = 0; j < bookedSlots.length; j++) {
      var slotDate = bookedSlots[j].getString("date").slice(0, 10)
      if (slotDate === dateStr) {
        return { ok: false, reason: "same_day" }
      }
      if (slotDate === prevStr || slotDate === nextStr) {
        return { ok: false, reason: "gap_rule" }
      }
    }
  } catch (_) {}

  return { ok: true }
}

/**
 * Check cross-team conflicts via shared members
 */
function checkCrossTeamConflicts(teamId, dateStr) {
  try {
    var memberTeams = $app.findRecordsByFilter(
      "member_teams",
      'team = "' + teamId + '"',
      "",
      200,
      0
    )

    var memberIds = {}
    for (var i = 0; i < memberTeams.length; i++) {
      memberIds[memberTeams[i].getString("member")] = true
    }

    var otherTeamIds = {}
    var memberIdList = Object.keys(memberIds)
    for (var m = 0; m < memberIdList.length; m++) {
      try {
        var otherMts = $app.findRecordsByFilter(
            "member_teams",
            'member = "' + memberIdList[m] + '" && team != "' + teamId + '"',
            "",
            20,
            0
          )
        for (var j = 0; j < otherMts.length; j++) {
          otherTeamIds[otherMts[j].getString("team")] = true
        }
      } catch (_) {}
    }

    var conflictTeamNames = []
    var otherIds = Object.keys(otherTeamIds)
    for (var t = 0; t < otherIds.length; t++) {
      var result = checkTeamConflicts(otherIds[t], dateStr)
      if (!result.ok) {
        try {
          var team = $app.findRecordById("teams", otherIds[t])
          conflictTeamNames.push(team.getString("name"))
        } catch (_) {
          conflictTeamNames.push(otherIds[t])
        }
      }
    }

    if (conflictTeamNames.length > 0) {
      return {
        ok: false,
        reason: "cross_team",
        teams: conflictTeamNames.join(", ")
      }
    }
  } catch (_) {}

  return { ok: true }
}

/**
 * Check hall availability (no double-booking at same time)
 */
function checkHallAvailability(hallId, dateStr, startTime, endTime) {
  try {
    var games = $app.findRecordsByFilter(
      "games",
      'hall = "' + hallId + '" && date ~ "' + dateStr + '" && status != "postponed"',
      "",
      50,
      0
    )

    for (var i = 0; i < games.length; i++) {
      var gTime = games[i].getString("time")
      if (!gTime) continue
      if (gTime >= startTime && gTime < endTime) {
        return { ok: false, reason: "double_booking" }
      }
    }

    var slots = $app.findRecordsByFilter(
      "game_scheduling_slots",
      'hall = "' + hallId + '" && date ~ "' + dateStr + '" && status = "booked"',
      "",
      50,
      0
    )

    for (var j = 0; j < slots.length; j++) {
      var sStart = slots[j].getString("start_time")
      var sEnd = slots[j].getString("end_time")
      if (startTime < sEnd && endTime > sStart) {
        return { ok: false, reason: "double_booking" }
      }
    }
  } catch (_) {}

  return { ok: true }
}

/**
 * Check hall closures
 */
function checkClosures(hallId, dateStr) {
  try {
    var closures = $app.findRecordsByFilter(
      "hall_closures",
      'hall = "' + hallId + '" && start_date <= "' + dateStr + '" && end_date >= "' + dateStr + '"',
      "",
      10,
      0
    )

    if (closures && closures.length > 0) {
      return { ok: false, reason: "closure" }
    }
  } catch (_) {}

  return { ok: true }
}

/**
 * Run all conflict checks for a date/team/hall combination
 */
function checkAllConflicts(teamId, dateStr, hallId, startTime, endTime) {
  var teamCheck = checkTeamConflicts(teamId, dateStr)
  if (!teamCheck.ok) return teamCheck

  var crossCheck = checkCrossTeamConflicts(teamId, dateStr)
  if (!crossCheck.ok) return crossCheck

  if (hallId) {
    var closureCheck = checkClosures(hallId, dateStr)
    if (!closureCheck.ok) return closureCheck

    if (startTime && endTime) {
      var hallCheck = checkHallAvailability(hallId, dateStr, startTime, endTime)
      if (!hallCheck.ok) return hallCheck
    }
  }

  return { ok: true }
}

/**
 * Generate a UUID v4 token
 */
function generateToken() {
  var chars = "abcdefghijklmnopqrstuvwxyz0123456789"
  var token = ""
  for (var i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return token
}

module.exports = {
  verifyTurnstile: verifyTurnstile,
  validatePbId: validatePbId,
  validateToken: validateToken,
  validateEmail: validateEmail,
  isSuperuser: isSuperuser,
  isAdmin: isAdmin,
  checkTeamConflicts: checkTeamConflicts,
  checkCrossTeamConflicts: checkCrossTeamConflicts,
  checkHallAvailability: checkHallAvailability,
  checkClosures: checkClosures,
  checkAllConflicts: checkAllConflicts,
  generateToken: generateToken,
}
