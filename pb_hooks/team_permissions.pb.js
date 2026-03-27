/// <reference path="../pb_data/types.d.ts" />

// Team permissions — hook registrations for teams, member_teams, members, hall_slots
//
// IMPORTANT: PB 0.36 JSVM isolates each handler callback as a separate "program".
// Top-level var/function declarations are NOT accessible inside callbacks.
// All shared helpers must be loaded via require() inside each callback.
//
// Uses onRecord*Request hooks (not onRecord*) because only Request
// hooks have e.requestInfo() which is needed to identify the authenticated user.

// ── teams ───────────────────────────────────────────────────────────

onRecordCreateRequest(function(e) {
  var lib = require(__hooks + "/team_permissions_lib.js")
  lib.assertAdminAccess(e)
  e.next()
}, "teams")

onRecordUpdateRequest(function(e) {
  var lib = require(__hooks + "/team_permissions_lib.js")
  lib.assertTeamAccess(e, e.record.id)
  e.next()
}, "teams")

onRecordDeleteRequest(function(e) {
  var lib = require(__hooks + "/team_permissions_lib.js")
  lib.assertAdminAccess(e)
  e.next()
}, "teams")

// ── member_teams ────────────────────────────────────────────────────

onRecordCreateRequest(function(e) {
  var lib = require(__hooks + "/team_permissions_lib.js")
  lib.assertTeamAccess(e, e.record.getString("team"))
  e.next()
}, "member_teams")

onRecordUpdateRequest(function(e) {
  var lib = require(__hooks + "/team_permissions_lib.js")
  // Check access on both old and new team (in case team field changed)
  var oldTeamId = e.record.original().getString("team")
  var newTeamId = e.record.getString("team")
  lib.assertTeamAccess(e, oldTeamId)
  if (newTeamId !== oldTeamId) {
    lib.assertTeamAccess(e, newTeamId)
  }
  e.next()
}, "member_teams")

onRecordDeleteRequest(function(e) {
  var lib = require(__hooks + "/team_permissions_lib.js")
  lib.assertTeamAccess(e, e.record.getString("team"))
  e.next()
}, "member_teams")

// ── members ─────────────────────────────────────────────────────────

onRecordUpdateRequest(function(e) {
  var lib = require(__hooks + "/team_permissions_lib.js")
  lib.assertMemberFieldAccess(e)
  e.next()
}, "members")

// Guard: coach_approved_team can only be set to true if member_teams exists
onRecordUpdate(function(e) {
  var wasApproved = e.record.original().getBool("coach_approved_team")
  var isApproved = e.record.getBool("coach_approved_team")

  // Only check when changing from false → true
  if (!wasApproved && isApproved) {
    var memberId = e.record.id
    try {
      $app.findFirstRecordByFilter("member_teams", "member = {:id}", { id: memberId })
    } catch (_) {
      throw new BadRequestError("Cannot approve member: no member_teams record exists. Assign a team first.")
    }
  }

  e.next()
}, "members")

// ── hall_slots ──────────────────────────────────────────────────────

onRecordCreateRequest(function(e) {
  var lib = require(__hooks + "/team_permissions_lib.js")
  lib.assertAdminAccess(e, "hall_slots")
  e.next()
}, "hall_slots")

onRecordUpdateRequest(function(e) {
  var lib = require(__hooks + "/team_permissions_lib.js")
  lib.assertAdminAccess(e, "hall_slots")
  e.next()
}, "hall_slots")

onRecordDeleteRequest(function(e) {
  var lib = require(__hooks + "/team_permissions_lib.js")
  lib.assertAdminAccess(e, "hall_slots")
  e.next()
}, "hall_slots")
