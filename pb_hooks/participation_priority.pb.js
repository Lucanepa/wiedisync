/// <reference path="../pb_data/types.d.ts" />

// ─── Participation Priority Hook ───
// Enforces guest bumping and waitlist auto-promotion when activities have max_players set.
// NOTE: PB goja isolates each callback scope, so require() must be called inside each callback.

// ═══════════════════════════════════════════════════
// BEFORE PARTICIPATION CREATE — block guests from games
// ═══════════════════════════════════════════════════

// Block guests from game participation
// Platform-wide rule: guests (any level > 0) cannot participate in games
onRecordCreateRequest("participations", function(e) {
  var record = e.record
  var activityType = record.getString("activity_type")
  var status = record.getString("status")

  // Only block game confirmations/tentative
  if (activityType !== "game") {
    return e.next()
  }
  if (status !== "confirmed" && status !== "tentative") {
    return e.next()
  }

  var memberId = record.getString("member")
  var activityId = record.getString("activity_id")

  // Find the game to get the team
  var game = $app.findRecordById("games", activityId)
  var teamId = game.getString("kscw_team")

  // Check guest level using existing helper
  var lib = require(__hooks + "/participation_priority_lib.js")
  var guestLevel = lib.getGuestLevel(memberId, teamId)

  if (guestLevel > 0) {
    throw new BadRequestError("Guests cannot participate in games")
  }

  e.next()
})

// ═══════════════════════════════════════════════════
// ON PARTICIPATION CREATE — check capacity & bump
// ═══════════════════════════════════════════════════

onRecordAfterCreateSuccess("participations", function(e) {
  try {
    var record = e.record
    if (record.getString("status") !== "confirmed") return
    if (record.getBool("is_staff")) return

    var lib = require(__hooks + "/participation_priority_lib.js")
    lib.handleConfirmation(record)
  } catch (err) {
    console.log("[participation-priority] create error: " + err)
  }
})

// ═══════════════════════════════════════════════════
// ON PARTICIPATION UPDATE — bump on confirm, promote on cancel
// ═══════════════════════════════════════════════════

onRecordAfterUpdateSuccess("participations", function(e) {
  try {
    var record = e.record
    var oldStatus = record.original().getString("status")
    var newStatus = record.getString("status")

    if (oldStatus === newStatus) return

    var lib = require(__hooks + "/participation_priority_lib.js")
    var activityType = record.getString("activity_type")
    var activityId = record.getString("activity_id")

    // Someone just confirmed — check capacity
    if (newStatus === "confirmed" && !record.getBool("is_staff")) {
      lib.handleConfirmation(record)
    }

    // Someone cancelled/declined from confirmed — promote from waitlist
    if (oldStatus === "confirmed" && (newStatus === "declined" || newStatus === "tentative")) {
      lib.handleCancellation(activityType, activityId)
    }
  } catch (err) {
    console.log("[participation-priority] update error: " + err)
  }
})

// ═══════════════════════════════════════════════════
// ON PARTICIPATION DELETE — promote from waitlist if spot opened
// ═══════════════════════════════════════════════════

onRecordAfterDeleteSuccess("participations", function(e) {
  try {
    var record = e.record
    if (record.getString("status") !== "confirmed") return
    if (record.getBool("is_staff")) return

    var lib = require(__hooks + "/participation_priority_lib.js")
    lib.handleCancellation(
      record.getString("activity_type"),
      record.getString("activity_id")
    )
  } catch (err) {
    console.log("[participation-priority] delete error: " + err)
  }
})
