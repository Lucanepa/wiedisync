/// <reference path="../pb_data/types.d.ts" />

// Team permissions — hook registrations for teams, member_teams, members, hall_slots
//
// IMPORTANT: Uses onRecord*Request hooks (not onRecord*) because only Request
// hooks have e.requestInfo() which is needed to identify the authenticated user.
// onRecordCreate/Update/Delete hooks only have e.record, e.app, e.context — no auth info.

// ── helpers (inlined from team_permissions_lib.js) ──

// Fields that coaches are NOT allowed to modify on member records.
// IMPORTANT: When adding new fields to the members collection, add them here too
// unless coaches should be able to edit them (see COACH_EDITABLE_MEMBER_FIELDS below).
var RESTRICTED_MEMBER_FIELDS = [
  "email", "name", "first_name", "last_name", "phone", "license_nr",
  "photo", "role", "kscw_membership_active", "birthdate", "yob", "coach_approved_team",
  "requested_team", "language", "hide_phone", "wiedisync_active"
]

// The only fields coaches/TR can edit on team members.
// Keep in sync with RESTRICTED_MEMBER_FIELDS above — every member field
// should be in exactly one of these two arrays.
var COACH_EDITABLE_MEMBER_FIELDS = ["position", "number", "licences", "birthdate_visibility"]

function arrayContains(arr, value) {
  if (!arr || !arr.length) return false
  for (var i = 0; i < arr.length; i++) {
    if (arr[i] === value) return true
  }
  return false
}

function getAuth(e) {
  var auth = e.requestInfo().auth
  if (!auth) {
    throw new ForbiddenError("Authentication required.")
  }
  return auth
}

function isSuperuser(e) {
  var auth = e.requestInfo().auth
  return auth && auth.collection().name === "_superusers"
}

function getRoles(auth) {
  var roles = auth.get("role")
  if (!roles || !roles.length) return []
  return roles
}

function assertTeamAccess(e, teamId) {
  // PB _superusers (admin UI) bypass all checks
  if (isSuperuser(e)) return

  var auth = getAuth(e)
  var authId = auth.id
  var roles = getRoles(auth)

  // superuser or admin role → allow
  if (arrayContains(roles, "superuser") || arrayContains(roles, "admin")) {
    return
  }

  // Guard: teamId must be present
  if (!teamId) {
    throw new BadRequestError("Team ID is required.")
  }

  // Fetch the team record
  var team = $app.findRecordById("teams", teamId)

  // vb_admin → allow if team sport is volleyball
  if (arrayContains(roles, "vb_admin")) {
    if (team.getString("sport") === "volleyball") return
  }

  // bb_admin → allow if team sport is basketball
  if (arrayContains(roles, "bb_admin")) {
    if (team.getString("sport") === "basketball") return
  }

  // Coach or team_responsible on this team → allow
  var coaches = team.get("coach") || []
  var trs = team.get("team_responsible") || []

  if (arrayContains(coaches, authId) || arrayContains(trs, authId)) {
    return
  }

  console.log("[team_permissions] Denied: user " + authId + " has no access to team " + teamId)
  throw new ForbiddenError("You don't have permission to modify this team.")
}

function assertMemberFieldAccess(e) {
  // PB _superusers (admin UI) bypass all checks
  if (isSuperuser(e)) return

  var auth = getAuth(e)
  var authId = auth.id
  var roles = getRoles(auth)

  // superuser/admin role → allow all fields
  if (arrayContains(roles, "superuser") || arrayContains(roles, "admin")) {
    return
  }

  // vb_admin/bb_admin → allow all fields
  if (arrayContains(roles, "vb_admin") || arrayContains(roles, "bb_admin")) {
    return
  }

  // Self-edit → allow all fields
  var targetId = e.record.id
  if (authId === targetId) {
    return
  }

  // Coach/TR check: find teams where auth user is coach or TR
  var coachTeams
  try {
    coachTeams = $app.findRecordsByFilter(
      "teams",
      'active=true && (coach~"' + authId + '" || team_responsible~"' + authId + '")',
      "",
      100,
      0
    )
  } catch (err) {
    coachTeams = []
  }

  if (!coachTeams || coachTeams.length === 0) {
    console.log("[team_permissions] Denied: user " + authId + " is not coach/TR of any team, cannot edit member " + targetId)
    throw new ForbiddenError("You don't have permission to modify this member.")
  }

  // Build list of coach team IDs
  var coachTeamIds = []
  for (var i = 0; i < coachTeams.length; i++) {
    coachTeamIds.push(coachTeams[i].id)
  }

  // Check if target member is on one of the coach's teams
  // PB filter syntax: use || for each team ID (no IN operator)
  var teamFilter = []
  for (var t = 0; t < coachTeamIds.length; t++) {
    teamFilter.push('team="' + coachTeamIds[t] + '"')
  }
  var memberOnTeam
  try {
    memberOnTeam = $app.findRecordsByFilter(
      "member_teams",
      'member="' + targetId + '" && (' + teamFilter.join(' || ') + ')',
      "",
      1,
      0
    )
  } catch (err) {
    memberOnTeam = []
  }

  if (!memberOnTeam || memberOnTeam.length === 0) {
    console.log("[team_permissions] Denied: user " + authId + " is coach but member " + targetId + " is not on their teams")
    throw new ForbiddenError("You don't have permission to modify this member.")
  }

  // Coach has access — but restricted to certain fields only
  var original = e.record.original()
  for (var f = 0; f < RESTRICTED_MEMBER_FIELDS.length; f++) {
    var field = RESTRICTED_MEMBER_FIELDS[f]
    var oldVal = original.get(field)
    var newVal = e.record.get(field)
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      console.log("[team_permissions] Denied: coach " + authId + " tried to change restricted field '" + field + "' on member " + targetId)
      throw new ForbiddenError("Coaches can only edit: " + COACH_EDITABLE_MEMBER_FIELDS.join(", ") + ".")
    }
  }
}

function assertAdminAccess(e, collectionHint) {
  // PB _superusers (admin UI) bypass all checks
  if (isSuperuser(e)) return

  var auth = getAuth(e)
  var authId = auth.id
  var roles = getRoles(auth)

  // superuser/admin role → allow
  if (arrayContains(roles, "superuser") || arrayContains(roles, "admin")) {
    return
  }

  // Sport-scoped admin for hall_slots
  if (collectionHint === "hall_slots") {
    var teamId = e.record.getString("team")
    if (teamId) {
      try {
        var team = $app.findRecordById("teams", teamId)
        var sport = team.getString("sport")
        if (arrayContains(roles, "vb_admin") && sport === "volleyball") return
        if (arrayContains(roles, "bb_admin") && sport === "basketball") return
      } catch (err) {
        console.log("[team_permissions] Error fetching team for hall_slot: " + err)
      }
    }
  }

  console.log("[team_permissions] Denied: user " + authId + " lacks admin access" + (collectionHint ? " for " + collectionHint : ""))
  throw new ForbiddenError("Admin access required.")
}

// ── hooks ──

// ── teams ───────────────────────────────────────────────────────────

onRecordCreateRequest(function(e) {
  assertAdminAccess(e)
  e.next()
}, "teams")

onRecordUpdateRequest(function(e) {
  assertTeamAccess(e, e.record.id)
  e.next()
}, "teams")

onRecordDeleteRequest(function(e) {
  assertAdminAccess(e)
  e.next()
}, "teams")

// ── member_teams ────────────────────────────────────────────────────

onRecordCreateRequest(function(e) {
  assertTeamAccess(e, e.record.getString("team"))
  e.next()
}, "member_teams")

onRecordUpdateRequest(function(e) {
  // Check access on both old and new team (in case team field changed)
  var oldTeamId = e.record.original().getString("team")
  var newTeamId = e.record.getString("team")
  assertTeamAccess(e, oldTeamId)
  if (newTeamId !== oldTeamId) {
    assertTeamAccess(e, newTeamId)
  }
  e.next()
}, "member_teams")

onRecordDeleteRequest(function(e) {
  assertTeamAccess(e, e.record.getString("team"))
  e.next()
}, "member_teams")

// ── members ─────────────────────────────────────────────────────────

onRecordUpdateRequest(function(e) {
  assertMemberFieldAccess(e)
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
  assertAdminAccess(e, "hall_slots")
  e.next()
}, "hall_slots")

onRecordUpdateRequest(function(e) {
  assertAdminAccess(e, "hall_slots")
  e.next()
}, "hall_slots")

onRecordDeleteRequest(function(e) {
  assertAdminAccess(e, "hall_slots")
  e.next()
}, "hall_slots")
