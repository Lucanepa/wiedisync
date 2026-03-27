/// <reference path="../pb_data/types.d.ts" />

// ── Participation Priority helpers ──
// Extracted from participation_priority.pb.js for PB 0.36 JSVM scope isolation.

/**
 * Get max_players/max_participants for an activity.
 * Returns null if not set (no limit).
 */
function getMaxPlayers(activityType, activityId) {
  try {
    if (activityType === "training") {
      var training = $app.findRecordById("trainings", activityId)
      var max = training.getInt("max_participants")
      return max > 0 ? max : null
    }
    if (activityType === "event") {
      var event = $app.findRecordById("events", activityId)
      var maxP = event.getInt("max_players")
      return maxP > 0 ? maxP : null
    }
    return null
  } catch (e) {
    console.log("[participation-priority] getMaxPlayers error: " + e)
    return null
  }
}

/**
 * Count confirmed non-staff participations for an activity.
 */
function getConfirmedCount(activityType, activityId, excludeId) {
  try {
    var filter = 'activity_type = "' + activityType + '" && activity_id = "' + activityId + '" && status = "confirmed" && is_staff = false'
    if (excludeId) {
      filter += ' && id != "' + excludeId + '"'
    }
    var records = $app.findRecordsByFilter("participations", filter, "", 500, 0)
    return records.length
  } catch (e) {
    return 0
  }
}

/**
 * Get the team ID for an activity (training/game/event).
 */
function getActivityTeamId(activityType, activityId) {
  try {
    if (activityType === "training") {
      var training = $app.findRecordById("trainings", activityId)
      return training.getString("team")
    }
    if (activityType === "game") {
      var game = $app.findRecordById("games", activityId)
      return game.getString("kscw_team")
    }
    if (activityType === "event") {
      var event = $app.findRecordById("events", activityId)
      var teams = event.get("teams")
      if (Array.isArray(teams) && teams.length > 0) return teams[0]
      return ""
    }
    return ""
  } catch (e) {
    console.log("[participation-priority] getActivityTeamId error: " + e)
    return ""
  }
}

/**
 * Get guest_level for a member on a specific team.
 */
function getGuestLevel(memberId, teamId) {
  try {
    if (!teamId) return 0
    var mts = $app.findRecordsByFilter(
      "member_teams",
      'member = "' + memberId + '" && team = "' + teamId + '"',
      "-created", 1, 0
    )
    if (mts.length === 0) return 0
    return mts[0].getInt("guest_level") || 0
  } catch (e) {
    return 0
  }
}

/**
 * Check if a member is a guest on a specific team.
 */
function isGuestOnTeam(memberId, teamId) {
  return getGuestLevel(memberId, teamId) > 0
}

/**
 * Notify a single member via the notifications collection.
 */
function notifyMember(memberId, titleKey, bodyData, activityType, activityId) {
  try {
    var collection = $app.findCollectionByNameOrId("notifications")
    var record = new Record(collection)
    record.set("member", memberId)
    record.set("type", "activity_change")
    record.set("title", titleKey)
    record.set("body", JSON.stringify(bodyData || {}))
    record.set("activity_type", activityType || "")
    record.set("activity_id", activityId || "")
    record.set("read", false)
    $app.save(record)
  } catch (e) {
    console.log("[participation-priority] notifyMember error: " + e)
  }
}

/**
 * Bump the lowest-priority guest to waitlisted status.
 */
function bumpLowestPriorityGuest(activityType, activityId, teamId) {
  try {
    var confirmed = $app.findRecordsByFilter(
      "participations",
      'activity_type = "' + activityType + '" && activity_id = "' + activityId + '" && status = "confirmed" && is_staff = false',
      "-created",
      500, 0
    )

    var guests = []
    for (var i = 0; i < confirmed.length; i++) {
      var p = confirmed[i]
      var memberId = p.getString("member")
      var level = getGuestLevel(memberId, teamId)
      if (level > 0) {
        guests.push({ record: p, memberId: memberId, guestLevel: level, index: i })
      }
    }

    if (guests.length === 0) return false

    guests.sort(function(a, b) {
      if (b.guestLevel !== a.guestLevel) return b.guestLevel - a.guestLevel
      return a.index - b.index
    })

    var toBump = guests[0]
    toBump.record.set("status", "waitlisted")
    toBump.record.set("waitlisted_at", new Date().toISOString().replace("T", " ").replace("Z", ""))
    $app.save(toBump.record)

    notifyMember(toBump.memberId, "bumped_to_waitlist", {}, activityType, activityId)
    console.log("[participation-priority] Bumped guest " + toBump.memberId + " (level " + toBump.guestLevel + ") to waitlist for " + activityType + "/" + activityId)
    return true
  } catch (e) {
    console.log("[participation-priority] bumpLowestPriorityGuest error: " + e)
    return false
  }
}

/**
 * Promote the next waitlisted participant to confirmed.
 */
function promoteNextWaitlisted(activityType, activityId) {
  try {
    var maxPlayers = getMaxPlayers(activityType, activityId)
    if (maxPlayers === null) return false

    var currentCount = getConfirmedCount(activityType, activityId)
    if (currentCount >= maxPlayers) return false

    var waitlisted = $app.findRecordsByFilter(
      "participations",
      'activity_type = "' + activityType + '" && activity_id = "' + activityId + '" && status = "waitlisted"',
      "waitlisted_at",
      1, 0
    )

    if (waitlisted.length === 0) return false

    var toPromote = waitlisted[0]
    toPromote.set("status", "confirmed")
    toPromote.set("waitlisted_at", "")
    $app.save(toPromote)

    var memberId = toPromote.getString("member")
    notifyMember(memberId, "promoted_from_waitlist", {}, activityType, activityId)

    console.log("[participation-priority] Promoted " + memberId + " from waitlist for " + activityType + "/" + activityId)
    return true
  } catch (e) {
    console.log("[participation-priority] promoteNextWaitlisted error: " + e)
    return false
  }
}

/**
 * Handle participation create/update when status becomes "confirmed".
 */
function handleConfirmation(participation) {
  var activityType = participation.getString("activity_type")
  var activityId = participation.getString("activity_id")
  var memberId = participation.getString("member")
  var isStaff = participation.getBool("is_staff")

  if (isStaff) return

  var maxPlayers = getMaxPlayers(activityType, activityId)
  if (maxPlayers === null) return

  var confirmedCount = getConfirmedCount(activityType, activityId)

  if (confirmedCount <= maxPlayers) return

  var teamId = getActivityTeamId(activityType, activityId)
  var memberGuestLevel = getGuestLevel(memberId, teamId)

  if (memberGuestLevel > 0) {
    participation.set("status", "waitlisted")
    participation.set("waitlisted_at", new Date().toISOString().replace("T", " ").replace("Z", ""))
    $app.save(participation)
    notifyMember(memberId, "bumped_to_waitlist", {}, activityType, activityId)
    console.log("[participation-priority] Guest " + memberId + " (level " + memberGuestLevel + ") auto-waitlisted (activity full)")
  } else {
    var bumped = bumpLowestPriorityGuest(activityType, activityId, teamId)
    if (!bumped) {
      participation.set("status", "waitlisted")
      participation.set("waitlisted_at", new Date().toISOString().replace("T", " ").replace("Z", ""))
      $app.save(participation)
      notifyMember(memberId, "bumped_to_waitlist", {}, activityType, activityId)
      console.log("[participation-priority] No guest to bump, player " + memberId + " waitlisted")
    }
  }
}

/**
 * Handle participation update/delete when someone cancels or declines.
 */
function handleCancellation(activityType, activityId) {
  promoteNextWaitlisted(activityType, activityId)
}

module.exports = {
  getMaxPlayers: getMaxPlayers,
  getConfirmedCount: getConfirmedCount,
  getActivityTeamId: getActivityTeamId,
  getGuestLevel: getGuestLevel,
  isGuestOnTeam: isGuestOnTeam,
  notifyMember: notifyMember,
  bumpLowestPriorityGuest: bumpLowestPriorityGuest,
  promoteNextWaitlisted: promoteNextWaitlisted,
  handleConfirmation: handleConfirmation,
  handleCancellation: handleCancellation,
}
