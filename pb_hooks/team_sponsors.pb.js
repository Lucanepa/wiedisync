/// <reference path="../node_modules/pocketbase/dist/pocketbase.d.ts" />

// Permission guard: only coaches/team_responsibles of linked teams (or admins) can manage sponsors

function isAdminOrSuperuser(member) {
  if (!member) return false
  var role = member.getString("role")
  return role === "admin" || role === "superuser"
}

function isCoachOfAnyTeam(member, teamIds) {
  if (!teamIds || !teamIds.length) return false
  var memberId = member.id
  for (var i = 0; i < teamIds.length; i++) {
    try {
      var team = $app.findRecordById("teams", teamIds[i])
      var coaches = team.get("coach") || []
      var responsibles = team.get("team_responsible") || []
      if (coaches.indexOf(memberId) >= 0 || responsibles.indexOf(memberId) >= 0) return true
    } catch (e) {}
  }
  return false
}

function checkSponsorPermission(e) {
  var authRecord = e.auth
  if (!authRecord) throw new ForbiddenError("Authentication required")

  // Superusers bypass (they use _superusers collection)
  if (authRecord.collection().name === "_superusers") return

  // Check member role
  if (isAdminOrSuperuser(authRecord)) return

  // Get teams from the record being created/updated
  var teamIds = e.record.get("teams") || []
  if (!teamIds.length) throw new ForbiddenError("Only admins can create club-level sponsors")

  if (!isCoachOfAnyTeam(authRecord, teamIds)) {
    throw new ForbiddenError("You must be a coach or team responsible of a linked team")
  }
}

onRecordCreate("sponsors", (e) => {
  checkSponsorPermission(e)
  e.next()
})

onRecordUpdate("sponsors", (e) => {
  checkSponsorPermission(e)
  e.next()
})

onRecordDelete("sponsors", (e) => {
  var authRecord = e.auth
  if (!authRecord) throw new ForbiddenError("Authentication required")
  if (authRecord.collection().name === "_superusers") { e.next(); return }
  if (isAdminOrSuperuser(authRecord)) { e.next(); return }

  var teamIds = e.record.get("teams") || []
  if (!teamIds.length) throw new ForbiddenError("Only admins can delete club-level sponsors")
  if (!isCoachOfAnyTeam(authRecord, teamIds)) {
    throw new ForbiddenError("You must be a coach or team responsible of a linked team")
  }
  e.next()
})
