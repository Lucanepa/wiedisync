/// <reference path="../node_modules/pocketbase/dist/pocketbase.d.ts" />

// Scorer duty delegation hook
// Handles same-team (instant) and cross-team (pending confirmation) duty transfers.
// On create: validates, then either instantly transfers or creates pending request.
// On update (status change): transfers duty on acceptance, notifies on decline.
// Cron: expires pending delegations for past games daily at 05:00 UTC.

// ── On create: validate + process ─────────────────────────────────────
onRecordCreateRequest("scorer_delegations", function(e) {
  var lib = require(__hooks + "/scorer_delegation_lib.js")
  var delegation = e.record
  lib.validateDelegation(e.app, delegation)
})

onRecordAfterCreateSuccess("scorer_delegations", function(e) {
  var lib = require(__hooks + "/scorer_delegation_lib.js")
  var delegation = e.record
  var sameTeam = delegation.getBool("same_team")
  var gameId = delegation.getString("game")
  var role = delegation.getString("role")
  var fromMember = delegation.getString("from_member")
  var toMember = delegation.getString("to_member")

  var fromName = lib.getMemberName(e.app, fromMember)
  var toName = lib.getMemberName(e.app, toMember)

  var game
  try {
    game = e.app.findRecordById("games", gameId)
  } catch (err) {
    console.log("[Scorer Delegation] Game not found: " + gameId)
    return
  }

  var gameLabel = game.getString("home_team") + " – " + game.getString("away_team")
  var dateStr = game.getString("date")

  if (sameTeam) {
    // Instant transfer
    try {
      lib.transferDuty(e.app, delegation)
      delegation.set("status", "accepted")
      e.app.save(delegation)

      // Notify the new assignee
      lib.createNotification(
        e.app, toMember,
        "duty_delegation_request",
        "duty_delegation_accepted",
        { from: fromName, to: toName, role: role, game: gameLabel, date: dateStr },
        "scorer_duty", gameId, ""
      )

      console.log("[Scorer Delegation] Same-team transfer: " + role + " on game " + gameId + " from " + fromName + " to " + toName)
    } catch (err) {
      console.log("[Scorer Delegation] Same-team transfer failed: " + err)
    }
  } else {
    // Cross-team: create pending notification for target
    lib.createNotification(
      e.app, toMember,
      "duty_delegation_request",
      "duty_delegation_request",
      { from: fromName, to: toName, role: role, game: gameLabel, date: dateStr },
      "scorer_duty", gameId, ""
    )

    console.log("[Scorer Delegation] Cross-team request: " + role + " on game " + gameId + " from " + fromName + " to " + toName)
  }
})

// ── On update: handle accept/decline ──────────────────────────────────
onRecordUpdateRequest("scorer_delegations", function(e) {
  var delegation = e.record
  var newStatus = delegation.getString("status")
  var oldStatus = e.record.original().getString("status")

  // Only allow status changes from pending
  if (oldStatus !== "pending") {
    throw new BadRequestError("Can only update pending delegations")
  }

  if (newStatus !== "accepted" && newStatus !== "declined") {
    throw new BadRequestError("Invalid status transition")
  }
})

onRecordAfterUpdateSuccess("scorer_delegations", function(e) {
  var lib = require(__hooks + "/scorer_delegation_lib.js")
  var delegation = e.record
  var newStatus = delegation.getString("status")
  var oldStatus = e.record.original().getString("status")

  if (oldStatus !== "pending") return

  var gameId = delegation.getString("game")
  var role = delegation.getString("role")
  var fromMember = delegation.getString("from_member")
  var toMember = delegation.getString("to_member")

  var fromName = lib.getMemberName(e.app, fromMember)
  var toName = lib.getMemberName(e.app, toMember)

  var game
  try {
    game = e.app.findRecordById("games", gameId)
  } catch (err) {
    console.log("[Scorer Delegation] Game not found: " + gameId)
    return
  }

  var gameLabel = game.getString("home_team") + " – " + game.getString("away_team")
  var dateStr = game.getString("date")

  if (newStatus === "accepted") {
    // Verify from_member is still the assignee (admin might have changed it)
    var memberField = lib.ROLE_MEMBER_FIELD[role]
    var currentAssignee = game.getString(memberField)
    if (currentAssignee !== fromMember) {
      // Assignment changed while pending — auto-expire
      delegation.set("status", "expired")
      e.app.save(delegation)
      console.log("[Scorer Delegation] Auto-expired: assignee changed for " + role + " on game " + gameId)
      return
    }

    try {
      lib.transferDuty(e.app, delegation)

      // Notify from_member that transfer was accepted
      lib.createNotification(
        e.app, fromMember,
        "duty_delegation_request",
        "duty_delegation_accepted",
        { from: fromName, to: toName, role: role, game: gameLabel, date: dateStr },
        "scorer_duty", gameId, ""
      )

      console.log("[Scorer Delegation] Accepted: " + role + " on game " + gameId + " transferred to " + toName)
    } catch (err) {
      console.log("[Scorer Delegation] Transfer failed on acceptance: " + err)
    }
  } else if (newStatus === "declined") {
    // Notify from_member that request was declined
    lib.createNotification(
      e.app, fromMember,
      "duty_delegation_request",
      "duty_delegation_declined",
      { from: fromName, to: toName, role: role, game: gameLabel, date: dateStr },
      "scorer_duty", gameId, ""
    )

    console.log("[Scorer Delegation] Declined: " + role + " on game " + gameId + " by " + toName)
  }
})

// ── Cron: expire pending delegations for past games ───────────────────
cronAdd("scorer-delegation-expire", "0 5 * * *", function() {
  if ($os.getenv("DISABLE_CRONS") === "true") return
  console.log("[Scorer Delegation] Starting expiry cron...")
  var today = new Date().toISOString().split("T")[0]
  var count = 0

  try {
    var pendingDelegations = $app.findRecordsByFilter(
      "scorer_delegations",
      'status = "pending"',
      "-created",
      100,
      0
    )

    for (var i = 0; i < pendingDelegations.length; i++) {
      var d = pendingDelegations[i]
      try {
        var game = $app.findRecordById("games", d.getString("game"))
        if (game.getString("date") < today) {
          d.set("status", "expired")
          $app.save(d)
          count++
        }
      } catch (e) {
        // Game not found — expire the delegation
        d.set("status", "expired")
        $app.save(d)
        count++
      }
    }
  } catch (e) {
    console.log("[Scorer Delegation] Expiry cron error: " + e)
  }

  console.log("[Scorer Delegation] Expiry cron: expired " + count + " delegations")
})
