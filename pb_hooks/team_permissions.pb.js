/// <reference path="../pb_data/types.d.ts" />

// Team permissions — hook registrations for teams, member_teams, members, hall_slots
//
// IMPORTANT: Uses onRecord*Request hooks (not onRecord*) because only Request
// hooks have e.requestInfo() which is needed to identify the authenticated user.
// onRecordCreate/Update/Delete hooks only have e.record, e.app, e.context — no auth info.

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
