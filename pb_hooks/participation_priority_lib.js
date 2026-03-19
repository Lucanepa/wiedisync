/// <reference path="../pb_data/types.d.ts" />

// ─── Participation Priority Library ───
// Handles guest bumping and waitlist auto-promotion for participation.
// Usage: var lib = require(__hooks + "/participation_priority_lib.js")

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
    // Games typically don't have max_players
    return null
  } catch (e) {
    console.log("[participation-priority] getMaxPlayers error: " + e)
    return null
  }
}

/**
 * Count confirmed non-staff participations for an activity.
 * @param {string} [excludeId] - participation ID to exclude from count
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
 * For events with multiple teams, returns the first team.
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
 * Get guest_level for a member on a specific team (from member_teams).
 * Returns 0 (not a guest) if no matching record or guest_level=0.
 * Returns 1-3 for guest levels.
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
 * Selects by highest guest_level (3 before 2 before 1), then most recently confirmed.
 * Returns true if a guest was bumped.
 */
function bumpLowestPriorityGuest(activityType, activityId, teamId) {
  try {
    // Find all confirmed non-staff participations
    var confirmed = $app.findRecordsByFilter(
      "participations",
      'activity_type = "' + activityType + '" && activity_id = "' + activityId + '" && status = "confirmed" && is_staff = false',
      "-created",  // most recent first
      500, 0
    )

    // Build list of guest participants with their guest levels
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

    // Sort: highest guest_level first (lowest priority guest), then highest index (most recent confirmation)
    guests.sort(function(a, b) {
      if (b.guestLevel !== a.guestLevel) return b.guestLevel - a.guestLevel
      return a.index - b.index  // lower index = more recent (already sorted -created)
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
 * Returns true if someone was promoted.
 */
function promoteNextWaitlisted(activityType, activityId) {
  try {
    var maxPlayers = getMaxPlayers(activityType, activityId)
    if (maxPlayers === null) return false

    var currentCount = getConfirmedCount(activityType, activityId)
    if (currentCount >= maxPlayers) return false

    // Find waitlisted, ordered by waitlisted_at (oldest first = first in queue)
    var waitlisted = $app.findRecordsByFilter(
      "participations",
      'activity_type = "' + activityType + '" && activity_id = "' + activityId + '" && status = "waitlisted"',
      "waitlisted_at",  // oldest first
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
 * Checks capacity and bumps guests if needed, or waitlists guests directly.
 */
function handleConfirmation(participation) {
  var activityType = participation.getString("activity_type")
  var activityId = participation.getString("activity_id")
  var memberId = participation.getString("member")
  var isStaff = participation.getBool("is_staff")

  // Staff don't count towards limits
  if (isStaff) return

  var maxPlayers = getMaxPlayers(activityType, activityId)
  if (maxPlayers === null) return  // No limit set

  var confirmedCount = getConfirmedCount(activityType, activityId)

  if (confirmedCount <= maxPlayers) return  // Still under limit (the new confirmation is already counted)

  // Over capacity — need to bump someone
  var teamId = getActivityTeamId(activityType, activityId)
  var memberGuestLevel = getGuestLevel(memberId, teamId)

  if (memberGuestLevel > 0) {
    // Guest confirmed when full — waitlist them directly
    participation.set("status", "waitlisted")
    participation.set("waitlisted_at", new Date().toISOString().replace("T", " ").replace("Z", ""))
    $app.save(participation)
    notifyMember(memberId, "bumped_to_waitlist", {}, activityType, activityId)
    console.log("[participation-priority] Guest " + memberId + " (level " + memberGuestLevel + ") auto-waitlisted (activity full)")
  } else {
    // Non-guest (regular member) confirmed when full — bump the lowest-priority guest
    var bumped = bumpLowestPriorityGuest(activityType, activityId, teamId)
    if (!bumped) {
      // No guest to bump — waitlist this player too (all slots taken by non-guests)
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
 * Auto-promotes from waitlist if there's now space.
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
