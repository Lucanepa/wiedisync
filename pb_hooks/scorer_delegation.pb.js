/// <reference path="../node_modules/pocketbase/dist/pocketbase.d.ts" />

// Scorer duty delegation hook
// Handles same-team (instant) and cross-team (pending confirmation) duty transfers.
// On create: validates, then either instantly transfers or creates pending request.
// On update (status change): transfers duty on acceptance, notifies on decline.
// Cron: expires pending delegations for past games daily at 05:00 UTC.

// ── Role → game field mapping ──────────────────────────────────────────
var ROLE_MEMBER_FIELD = {
  scorer: "scorer_member",
  taefeler: "taefeler_member",
  scorer_taefeler: "scorer_taefeler_member",
  bb_anschreiber: "bb_anschreiber",
  bb_zeitnehmer: "bb_zeitnehmer",
  bb_24s_official: "bb_24s_official",
}

var ROLE_TEAM_FIELD = {
  scorer: "scorer_duty_team",
  taefeler: "taefeler_duty_team",
  scorer_taefeler: "scorer_taefeler_duty_team",
  bb_anschreiber: "bb_duty_team",
  bb_zeitnehmer: "bb_duty_team",
  bb_24s_official: "bb_duty_team",
}

var ROLE_LICENCE = {
  scorer: ["scorer_vb"],
  scorer_taefeler: ["scorer_vb"],
  bb_anschreiber: ["otr1_bb"],
  bb_zeitnehmer: ["otr1_bb"],
  bb_24s_official: ["otr2_bb", "otn_bb"],
  // taefeler has no licence requirement
}

// ── Helper: get member name ───────────────────────────────────────────
function getMemberName(app, memberId) {
  try {
    var member = app.findRecordById("members", memberId)
    return member.getString("first_name") + " " + member.getString("last_name")
  } catch (e) {
    return ""
  }
}

// ── Helper: create notification ───────────────────────────────────────
function createNotification(app, memberId, type, title, body, activityType, activityId, teamId) {
  try {
    var collection = app.findCollectionByNameOrId("notifications")
    var record = new Record(collection)
    record.set("member", memberId)
    record.set("type", type)
    record.set("title", title)
    record.set("body", JSON.stringify(body))
    record.set("activity_type", activityType || "scorer_duty")
    record.set("activity_id", activityId || "")
    record.set("team", teamId || "")
    record.set("read", false)
    app.save(record)
  } catch (e) {
    console.log("[Scorer Delegation] Failed to create notification: " + e)
  }
}

// ── Helper: transfer duty on game ─────────────────────────────────────
function transferDuty(app, delegation) {
  var role = delegation.getString("role")
  var gameId = delegation.getString("game")
  var toMember = delegation.getString("to_member")
  var toTeam = delegation.getString("to_team")
  var memberField = ROLE_MEMBER_FIELD[role]
  var teamField = ROLE_TEAM_FIELD[role]

  if (!memberField || !teamField) {
    throw new BadRequestError("Invalid role: " + role)
  }

  var game = app.findRecordById("games", gameId)

  // Update member assignment
  game.set(memberField, toMember)

  // Update duty team (for cross-team transfers)
  if (!delegation.getBool("same_team")) {
    game.set(teamField, toTeam)
  }

  app.save(game)
}

// ── Helper: validate delegation ───────────────────────────────────────
function validateDelegation(app, delegation) {
  var role = delegation.getString("role")
  var gameId = delegation.getString("game")
  var fromMember = delegation.getString("from_member")
  var toMember = delegation.getString("to_member")
  var memberField = ROLE_MEMBER_FIELD[role]

  if (!memberField) {
    throw new BadRequestError("Invalid role: " + role)
  }

  // Check game exists and is not in the past
  var game = app.findRecordById("games", gameId)
  var today = new Date().toISOString().split("T")[0]
  if (game.getString("date") < today) {
    throw new BadRequestError("Cannot delegate duty for a past game")
  }

  // Verify from_member is currently assigned
  var currentAssignee = game.getString(memberField)
  if (currentAssignee !== fromMember) {
    throw new BadRequestError("You are not currently assigned to this duty")
  }

  // Check licence requirements for to_member
  var requiredLicences = ROLE_LICENCE[role]
  if (requiredLicences) {
    var toMemberRecord = app.findRecordById("members", toMember)
    var memberLicences = toMemberRecord.get("licences") || []
    var hasLicence = false
    for (var i = 0; i < requiredLicences.length; i++) {
      if (memberLicences.indexOf(requiredLicences[i]) >= 0) {
        hasLicence = true
        break
      }
    }
    if (!hasLicence) {
      throw new BadRequestError("Target member does not have the required licence")
    }
  }

  // Check no duplicate pending delegation for same game+role
  try {
    var existing = app.findFirstRecordByFilter(
      "scorer_delegations",
      'game = "' + gameId + '" && role = "' + role + '" && status = "pending"'
    )
    if (existing) {
      throw new BadRequestError("A pending delegation already exists for this duty")
    }
  } catch (e) {
    if (e.message && e.message.indexOf("pending delegation") >= 0) {
      throw e
    }
    // No existing record found — that's fine
  }
}

// ── On create: validate + process ─────────────────────────────────────
onRecordCreateRequest("scorer_delegations", function(e) {
  var delegation = e.record
  validateDelegation(e.app, delegation)
})

onRecordAfterCreateSuccess("scorer_delegations", function(e) {
  var delegation = e.record
  var sameTeam = delegation.getBool("same_team")
  var gameId = delegation.getString("game")
  var role = delegation.getString("role")
  var fromMember = delegation.getString("from_member")
  var toMember = delegation.getString("to_member")

  var fromName = getMemberName(e.app, fromMember)
  var toName = getMemberName(e.app, toMember)

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
      transferDuty(e.app, delegation)
      delegation.set("status", "accepted")
      e.app.save(delegation)

      // Notify the new assignee
      createNotification(
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
    createNotification(
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
  var delegation = e.record
  var newStatus = delegation.getString("status")
  var oldStatus = e.record.original().getString("status")

  if (oldStatus !== "pending") return

  var gameId = delegation.getString("game")
  var role = delegation.getString("role")
  var fromMember = delegation.getString("from_member")
  var toMember = delegation.getString("to_member")

  var fromName = getMemberName(e.app, fromMember)
  var toName = getMemberName(e.app, toMember)

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
    var memberField = ROLE_MEMBER_FIELD[role]
    var currentAssignee = game.getString(memberField)
    if (currentAssignee !== fromMember) {
      // Assignment changed while pending — auto-expire
      delegation.set("status", "expired")
      e.app.save(delegation)
      console.log("[Scorer Delegation] Auto-expired: assignee changed for " + role + " on game " + gameId)
      return
    }

    try {
      transferDuty(e.app, delegation)

      // Notify from_member that transfer was accepted
      createNotification(
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
    createNotification(
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
