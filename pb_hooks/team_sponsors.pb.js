/// <reference path="../node_modules/pocketbase/dist/pocketbase.d.ts" />

// Permission guard: only coaches/team_responsibles of linked teams (or admins) can manage sponsors

onRecordCreate("sponsors", (e) => {
  var lib = require(__hooks + "/team_sponsors_lib.js")
  lib.checkSponsorPermission($app, e)
  e.next()
})

onRecordUpdate("sponsors", (e) => {
  var lib = require(__hooks + "/team_sponsors_lib.js")
  lib.checkSponsorPermission($app, e)
  e.next()
})

onRecordDelete("sponsors", (e) => {
  var lib = require(__hooks + "/team_sponsors_lib.js")
  var authRecord = e.auth
  if (!authRecord) throw new ForbiddenError("Authentication required")
  if (authRecord.collection().name === "_superusers") { e.next(); return }
  if (lib.isAdminOrSuperuser(authRecord)) { e.next(); return }

  var teamIds = e.record.get("teams") || []
  if (!teamIds.length) throw new ForbiddenError("Only admins can delete club-level sponsors")
  if (!lib.isCoachOfAnyTeam($app, authRecord, teamIds)) {
    throw new ForbiddenError("You must be a coach or team responsible of a linked team")
  }
  e.next()
})
