/// <reference path="../pb_data/types.d.ts" />

// Team permissions helpers — loaded via require() inside hook callbacks
// because PB 0.36 JSVM isolates each handler's scope.

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
  if (isSuperuser(e)) return

  var auth = getAuth(e)
  var authId = auth.id
  var roles = getRoles(auth)

  if (arrayContains(roles, "superuser") || arrayContains(roles, "admin")) {
    return
  }

  if (!teamId) {
    throw new BadRequestError("Team ID is required.")
  }

  var team = $app.findRecordById("teams", teamId)

  if (arrayContains(roles, "vb_admin")) {
    if (team.getString("sport") === "volleyball") return
  }

  if (arrayContains(roles, "bb_admin")) {
    if (team.getString("sport") === "basketball") return
  }

  var coaches = team.get("coach") || []
  var trs = team.get("team_responsible") || []

  if (arrayContains(coaches, authId) || arrayContains(trs, authId)) {
    return
  }

  console.log("[team_permissions] Denied: user " + authId + " has no access to team " + teamId)
  throw new ForbiddenError("You don't have permission to modify this team.")
}

function assertMemberFieldAccess(e) {
  if (isSuperuser(e)) return

  var auth = getAuth(e)
  var authId = auth.id
  var roles = getRoles(auth)

  if (arrayContains(roles, "superuser") || arrayContains(roles, "admin")) {
    return
  }

  if (arrayContains(roles, "vb_admin") || arrayContains(roles, "bb_admin")) {
    return
  }

  var targetId = e.record.id
  if (authId === targetId) {
    return
  }

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

  var coachTeamIds = []
  for (var i = 0; i < coachTeams.length; i++) {
    coachTeamIds.push(coachTeams[i].id)
  }

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
  if (isSuperuser(e)) return

  var auth = getAuth(e)
  var authId = auth.id
  var roles = getRoles(auth)

  if (arrayContains(roles, "superuser") || arrayContains(roles, "admin")) {
    return
  }

  if (collectionHint === "hall_slots") {
    var teamIds = e.record.get("team") || []
    for (var t = 0; t < teamIds.length; t++) {
      try {
        var team = $app.findRecordById("teams", teamIds[t])
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

module.exports = {
  assertTeamAccess: assertTeamAccess,
  assertMemberFieldAccess: assertMemberFieldAccess,
  assertAdminAccess: assertAdminAccess,
}
