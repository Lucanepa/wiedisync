// Team sponsors permission helpers — shared across callbacks in team_sponsors.pb.js

var isAdminOrSuperuser = function(member) {
  if (!member) return false
  var role = member.getString("role")
  return role === "admin" || role === "superuser"
}

var isCoachOfAnyTeam = function(app, member, teamIds) {
  if (!teamIds || !teamIds.length) return false
  var memberId = member.id
  for (var i = 0; i < teamIds.length; i++) {
    try {
      var team = app.findRecordById("teams", teamIds[i])
      var coaches = team.get("coach") || []
      var responsibles = team.get("team_responsible") || []
      if (coaches.indexOf(memberId) >= 0 || responsibles.indexOf(memberId) >= 0) return true
    } catch (e) {}
  }
  return false
}

var checkSponsorPermission = function(app, e) {
  var authRecord = e.auth
  if (!authRecord) throw new ForbiddenError("Authentication required")

  // Superusers bypass (they use _superusers collection)
  if (authRecord.collection().name === "_superusers") return

  // Check member role
  if (isAdminOrSuperuser(authRecord)) return

  // Get teams from the record being created/updated
  var teamIds = e.record.get("teams") || []
  if (!teamIds.length) throw new ForbiddenError("Only admins can create club-level sponsors")

  if (!isCoachOfAnyTeam(app, authRecord, teamIds)) {
    throw new ForbiddenError("You must be a coach or team responsible of a linked team")
  }
}

module.exports = {
  isAdminOrSuperuser: isAdminOrSuperuser,
  isCoachOfAnyTeam: isCoachOfAnyTeam,
  checkSponsorPermission: checkSponsorPermission,
}
