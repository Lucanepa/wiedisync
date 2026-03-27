// Scorer delegation helpers — shared across callbacks in scorer_delegation.pb.js

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
var getMemberName = function(app, memberId) {
  try {
    var member = app.findRecordById("members", memberId)
    return member.getString("first_name") + " " + member.getString("last_name")
  } catch (e) {
    return ""
  }
}

// ── Helper: create notification ───────────────────────────────────────
var createNotification = function(app, memberId, type, title, body, activityType, activityId, teamId) {
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
var transferDuty = function(app, delegation) {
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
var validateDelegation = function(app, delegation) {
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

module.exports = {
  ROLE_MEMBER_FIELD: ROLE_MEMBER_FIELD,
  ROLE_TEAM_FIELD: ROLE_TEAM_FIELD,
  ROLE_LICENCE: ROLE_LICENCE,
  getMemberName: getMemberName,
  createNotification: createNotification,
  transferDuty: transferDuty,
  validateDelegation: validateDelegation,
}
