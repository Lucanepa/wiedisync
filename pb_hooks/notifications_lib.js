/// <reference path="../pb_data/types.d.ts" />

// ─── Notifications Library ───
// Shared helper for creating per-member notifications.
// Usage: var notifLib = require(__hooks + "/notifications_lib.js")
//        notifLib.notifyTeamMembers(type, titleKey, bodyData, activityType, activityId, teamIds)

/**
 * Get current season string (e.g. "2025/26")
 */
function getCurrentSeason() {
  var now = new Date()
  var year = now.getFullYear()
  var month = now.getMonth() // 0-indexed
  // Season starts in August
  if (month < 7) year-- // before August → previous year's season
  var nextYear = (year + 1) % 100
  return year + "/" + (nextYear < 10 ? "0" + nextYear : nextYear)
}

/**
 * Resolve all member IDs for a list of team IDs (current season)
 * Returns array of unique member IDs
 */
function getTeamMemberIds(teamIds) {
  if (!teamIds || teamIds.length === 0) return []

  var season = getCurrentSeason()
  var memberSet = {}

  for (var i = 0; i < teamIds.length; i++) {
    try {
      var members = $app.findRecordsByFilter(
        "member_teams",
        'team = "' + teamIds[i] + '" && season = "' + season + '"',
        "", 200, 0
      )
      for (var j = 0; j < members.length; j++) {
        memberSet[members[j].getString("member")] = true
      }
    } catch (e) {
      console.log("[notifications] Error fetching members for team " + teamIds[i] + ": " + e)
    }
  }

  var result = []
  for (var id in memberSet) {
    if (memberSet.hasOwnProperty(id)) {
      result.push(id)
    }
  }
  return result
}

/**
 * Create notification records for team members (with dedup).
 * @param {string} type - "activity_change" | "upcoming_activity" | "deadline_reminder" | "result_available"
 * @param {string} titleKey - i18n key (e.g. "game_created")
 * @param {Object} bodyData - interpolation data (serialized as JSON)
 * @param {string} activityType - "game" | "training" | "event"
 * @param {string} activityId - record ID of the activity
 * @param {string[]} teamIds - array of team IDs to notify
 */
function notifyTeamMembers(type, titleKey, bodyData, activityType, activityId, teamIds) {
  var memberIds = getTeamMemberIds(teamIds)
  if (memberIds.length === 0) return 0

  var bodyStr = JSON.stringify(bodyData || {})
  var created = 0
  var notifiedMemberIds = []

  for (var i = 0; i < memberIds.length; i++) {
    try {
      // Dedup check: same member + title + activity_id within last hour
      var existing = []
      try {
        existing = $app.findRecordsByFilter(
          "notifications",
          'member = "' + memberIds[i] + '" && title = "' + titleKey + '" && activity_id = "' + activityId + '" && created > "' + oneHourAgo() + '"',
          "", 1, 0
        )
      } catch (e) {
        // No existing = OK
      }
      if (existing.length > 0) continue

      var collection = $app.findCollectionByNameOrId("notifications")
      var record = new Record(collection)
      record.set("member", memberIds[i])
      record.set("type", type)
      record.set("title", titleKey)
      record.set("body", bodyStr)
      record.set("activity_type", activityType)
      record.set("activity_id", activityId)
      record.set("read", false)
      // Set team to first team ID if available
      if (teamIds.length > 0) {
        record.set("team", teamIds[0])
      }
      $app.save(record)
      created++
      notifiedMemberIds.push(memberIds[i])
    } catch (e) {
      console.log("[notifications] Error creating notification for member " + memberIds[i] + ": " + e)
    }
  }

  console.log("[notifications] Created " + created + " notifications (type=" + type + ", key=" + titleKey + ")")

  // Send Web Push notifications to all notified members (batch)
  if (notifiedMemberIds.length > 0) {
    try {
      var pushLib = require(__hooks + "/push_lib.js")
      var pushTitle = buildPushTitle(titleKey, bodyData)
      var pushBody = buildPushBody(titleKey, bodyData)
      var pushUrl = buildPushUrl(activityType, activityId)
      var pushResult = pushLib.sendPushToMembers(notifiedMemberIds, pushTitle, pushBody, pushUrl, activityType + "_" + activityId)
      if (pushResult.sent > 0) {
        console.log("[notifications] Push sent: " + pushResult.sent + " delivered, " + pushResult.failed + " failed, " + pushResult.cleaned + " cleaned")
      }
    } catch (pushErr) {
      console.log("[notifications] Push error (non-fatal): " + pushErr)
    }
  }

  return created
}

// ─── Push notification text builders (German, keep short for push) ───

function buildPushTitle(titleKey, bodyData) {
  var titles = {
    game_created: "Neues Spiel",
    game_updated: "Spiel aktualisiert",
    game_deleted: "Spiel abgesagt",
    game_result: "Resultat",
    training_created: "Neues Training",
    training_updated: "Training aktualisiert",
    training_cancelled: "Training abgesagt",
    training_deleted: "Training gelöscht",
    event_created: "Neuer Event",
    event_updated: "Event aktualisiert",
    event_deleted: "Event abgesagt",
    upcoming_game: "Morgen: Spiel",
    upcoming_training: "Morgen: Training",
    upcoming_event: "Morgen: Event",
    deadline_game: "Anmeldefrist morgen",
    deadline_training: "Anmeldefrist morgen",
    deadline_event: "Anmeldefrist morgen",
    duty_delegation_request: "Schreiberdienst",
    duty_delegation_accepted: "Einsatz übernommen",
    duty_delegation_declined: "Einsatz abgelehnt",
  }
  return titles[titleKey] || "KSC Wiedikon"
}

function buildPushBody(titleKey, bodyData) {
  if (!bodyData) return ""
  var d = bodyData
  if (d.home_team && d.away_team) return d.home_team + " vs " + d.away_team
  if (d.title) return d.title
  if (d.date) return d.date
  if (d.time) return d.time
  return ""
}

function buildPushUrl(activityType, activityId) {
  var base = "https://kscw.lucanepa.com"
  switch (activityType) {
    case "game": return base + "/games"
    case "training": return base + "/trainings"
    case "event": return base + "/events"
    case "scorer_duty": return base + "/scorer"
    default: return base
  }
}

function oneHourAgo() {
  var d = new Date(Date.now() - 3600000)
  return d.toISOString().replace("T", " ").replace("Z", "")
}

/**
 * Format a date string (YYYY-MM-DD ...) as DD.MM.YYYY
 */
function formatDate(dateStr) {
  if (!dateStr) return ""
  var parts = dateStr.split(" ")[0].split("-")
  if (parts.length < 3) return dateStr
  return parts[2] + "." + parts[1] + "." + parts[0]
}

/**
 * Daily reminder logic: upcoming activities + deadline reminders + cleanup
 */
function runNotificationReminders() {
  var counts = { upcoming: 0, deadlines: 0, cleaned: 0 }

  // Calculate tomorrow's date in Zurich timezone
  var now = new Date()
  var year = now.getUTCFullYear()
  var marchLast = new Date(Date.UTC(year, 2, 31))
  var dstStart = new Date(Date.UTC(year, 2, 31 - marchLast.getUTCDay(), 1, 0, 0))
  var octLast = new Date(Date.UTC(year, 9, 31))
  var dstEnd = new Date(Date.UTC(year, 9, 31 - octLast.getUTCDay(), 1, 0, 0))
  var isDST = now >= dstStart && now < dstEnd
  var zurichOffset = isDST ? 2 : 1
  var zurichNow = new Date(now.getTime() + zurichOffset * 3600000)
  var tomorrow = new Date(zurichNow.getTime() + 86400000)
  var tomorrowStr = tomorrow.getUTCFullYear() + "-" +
    String(tomorrow.getUTCMonth() + 1).padStart(2, "0") + "-" +
    String(tomorrow.getUTCDate()).padStart(2, "0")

  console.log("[notification-reminders] Tomorrow (Zurich): " + tomorrowStr)

  // ─── Upcoming games tomorrow ───
  try {
    var games = $app.findRecordsByFilter("games", 'date ~ "' + tomorrowStr + '" && status = "scheduled"', "", 200, 0)
    for (var i = 0; i < games.length; i++) {
      var g = games[i]
      var teamId = g.getString("kscw_team")
      if (!teamId) continue
      counts.upcoming += notifyTeamMembers("upcoming_activity", "upcoming_game",
        { home_team: g.getString("home_team"), away_team: g.getString("away_team"), time: g.getString("time") || "" },
        "game", g.id, [teamId])
    }
  } catch (e) { console.log("[notification-reminders] Error: upcoming games: " + e) }

  // ─── Upcoming trainings tomorrow ───
  try {
    var trainings = $app.findRecordsByFilter("trainings", 'date ~ "' + tomorrowStr + '" && cancelled = false', "", 200, 0)
    for (var j = 0; j < trainings.length; j++) {
      var tr = trainings[j]
      var trTeam = tr.getString("team")
      if (!trTeam) continue
      counts.upcoming += notifyTeamMembers("upcoming_activity", "upcoming_training",
        { time: tr.getString("start_time") || "" }, "training", tr.id, [trTeam])
    }
  } catch (e) { console.log("[notification-reminders] Error: upcoming trainings: " + e) }

  // ─── Upcoming events tomorrow ───
  try {
    var events = $app.findRecordsByFilter("events", 'start_date ~ "' + tomorrowStr + '"', "", 200, 0)
    for (var k = 0; k < events.length; k++) {
      var evt = events[k]
      var evtTeams = evt.get("teams")
      if (!evtTeams || evtTeams.length === 0) continue
      counts.upcoming += notifyTeamMembers("upcoming_activity", "upcoming_event",
        { title: evt.getString("title") }, "event", evt.id, evtTeams)
    }
  } catch (e) { console.log("[notification-reminders] Error: upcoming events: " + e) }

  // ─── Deadline reminders (respond_by is tomorrow) ───
  try {
    var dlGames = $app.findRecordsByFilter("games", 'respond_by ~ "' + tomorrowStr + '" && status != "completed" && status != "postponed"', "", 200, 0)
    for (var dg = 0; dg < dlGames.length; dg++) {
      var dlg = dlGames[dg]
      var dlgTeam = dlg.getString("kscw_team")
      if (!dlgTeam) continue
      counts.deadlines += notifyTeamMembers("deadline_reminder", "deadline_game",
        { home_team: dlg.getString("home_team"), away_team: dlg.getString("away_team") }, "game", dlg.id, [dlgTeam])
    }
  } catch (e) { console.log("[notification-reminders] Error: deadline games: " + e) }

  try {
    var dlTrainings = $app.findRecordsByFilter("trainings", 'respond_by ~ "' + tomorrowStr + '" && cancelled = false', "", 200, 0)
    for (var dt = 0; dt < dlTrainings.length; dt++) {
      var dlt = dlTrainings[dt]
      var dltTeam = dlt.getString("team")
      if (!dltTeam) continue
      counts.deadlines += notifyTeamMembers("deadline_reminder", "deadline_training",
        { date: formatDate(dlt.getString("date")) }, "training", dlt.id, [dltTeam])
    }
  } catch (e) { console.log("[notification-reminders] Error: deadline trainings: " + e) }

  try {
    var dlEvents = $app.findRecordsByFilter("events", 'respond_by ~ "' + tomorrowStr + '"', "", 200, 0)
    for (var de2 = 0; de2 < dlEvents.length; de2++) {
      var dle = dlEvents[de2]
      var dleTeams = dle.get("teams")
      if (!dleTeams || dleTeams.length === 0) continue
      counts.deadlines += notifyTeamMembers("deadline_reminder", "deadline_event",
        { title: dle.getString("title") }, "event", dle.id, dleTeams)
    }
  } catch (e) { console.log("[notification-reminders] Error: deadline events: " + e) }

  // ─── Cleanup: delete reminder notifications after activity date has passed ───
  var todayStr = zurichNow.getUTCFullYear() + "-" +
    String(zurichNow.getUTCMonth() + 1).padStart(2, "0") + "-" +
    String(zurichNow.getUTCDate()).padStart(2, "0")

  try {
    var reminders = $app.findRecordsByFilter(
      "notifications",
      'type = "upcoming_activity" || type = "deadline_reminder"',
      "", 500, 0
    )
    for (var r = 0; r < reminders.length; r++) {
      var rem = reminders[r]
      var aType = rem.getString("activity_type")
      var aId = rem.getString("activity_id")
      if (!aId) continue

      var activityDate = ""
      try {
        if (aType === "game") {
          var game = $app.findRecordById("games", aId)
          activityDate = game.getString("date").split(" ")[0]
        } else if (aType === "training") {
          var tr = $app.findRecordById("trainings", aId)
          activityDate = tr.getString("date").split(" ")[0]
        } else if (aType === "event") {
          var evt = $app.findRecordById("events", aId)
          activityDate = evt.getString("start_date").split(" ")[0]
        }
      } catch (lookupErr) {
        // Activity was deleted — remove the reminder too
        $app.delete(rem)
        counts.cleaned++
        continue
      }

      if (activityDate && activityDate < todayStr) {
        $app.delete(rem)
        counts.cleaned++
      }
    }
  } catch (e) { console.log("[notification-reminders] Reminder cleanup error: " + e) }

  // ─── Cleanup: delete notifications older than 60 days ───
  try {
    var cutoff = new Date(Date.now() - 60 * 86400000)
    var cutoffStr = cutoff.toISOString().replace("T", " ").replace("Z", "")
    var old = $app.findRecordsByFilter("notifications", 'created < "' + cutoffStr + '"', "", 500, 0)
    for (var c = 0; c < old.length; c++) {
      $app.delete(old[c])
      counts.cleaned++
    }
    if (counts.cleaned > 0) console.log("[notification-reminders] Cleaned up " + counts.cleaned + " old notifications")
  } catch (e) { console.log("[notification-reminders] Cleanup error: " + e) }

  console.log("[notification-reminders] Done: " + JSON.stringify(counts))
  return counts
}

module.exports = {
  notifyTeamMembers: notifyTeamMembers,
  getTeamMemberIds: getTeamMemberIds,
  formatDate: formatDate,
  runNotificationReminders: runNotificationReminders,
}
