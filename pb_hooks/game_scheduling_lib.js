// Shared game scheduling logic — loaded via require(__hooks + "/game_scheduling_lib.js")

/**
 * Check team conflicts: same-day + 1-day gap rule
 * @param {string} teamId - KSCW team ID
 * @param {string} dateStr - Date to check (YYYY-MM-DD)
 * @param {string} seasonId - Season record ID (optional, for scoping)
 * @returns {{ ok: boolean, reason?: string }}
 */
function checkTeamConflicts(teamId, dateStr) {
  var d = new Date(dateStr + "T00:00:00Z")

  // Day before and after
  var prev = new Date(d.getTime() - 86400000)
  var next = new Date(d.getTime() + 86400000)

  function fmt(dt) {
    return dt.getFullYear() + "-" +
      String(dt.getMonth() + 1).padStart(2, "0") + "-" +
      String(dt.getDate()).padStart(2, "0")
  }

  var prevStr = fmt(prev)
  var nextStr = fmt(next)

  // Check games collection for this team within ±1 day
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
  } catch (_) {
    // No games found — that's fine
  }

  // Also check already-booked scheduling slots
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
 * @param {string} teamId - KSCW team ID
 * @param {string} dateStr - Date to check
 * @returns {{ ok: boolean, reason?: string, teams?: string }}
 */
function checkCrossTeamConflicts(teamId, dateStr) {
  try {
    // Find members on this team
    var memberTeams = $app.findRecordsByFilter(
      "member_teams",
      'team = "' + teamId + '"',
      "",
      200,
      0
    )

    // Collect unique member IDs
    var memberIds = {}
    for (var i = 0; i < memberTeams.length; i++) {
      memberIds[memberTeams[i].getString("member")] = true
    }

    // Find other teams these members are on
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

    // Check conflicts for each related team
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
 * @param {string} hallId
 * @param {string} dateStr
 * @param {string} startTime
 * @param {string} endTime
 * @returns {{ ok: boolean, reason?: string }}
 */
function checkHallAvailability(hallId, dateStr, startTime, endTime) {
  try {
    // Check existing games at this hall on this date
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
      // Simple overlap: if game time falls within our slot
      if (gTime >= startTime && gTime < endTime) {
        return { ok: false, reason: "double_booking" }
      }
    }

    // Check booked scheduling slots
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
      // Time overlap check
      if (startTime < sEnd && endTime > sStart) {
        return { ok: false, reason: "double_booking" }
      }
    }
  } catch (_) {}

  return { ok: true }
}

/**
 * Check hall closures
 * @param {string} hallId
 * @param {string} dateStr
 * @returns {{ ok: boolean, reason?: string }}
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
  checkTeamConflicts: checkTeamConflicts,
  checkCrossTeamConflicts: checkCrossTeamConflicts,
  checkHallAvailability: checkHallAvailability,
  checkClosures: checkClosures,
  checkAllConflicts: checkAllConflicts,
  generateToken: generateToken,
}
