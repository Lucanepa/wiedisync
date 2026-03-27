/// <reference path="../pb_data/types.d.ts" />

// ─── Participation Reminders ───
// Sends email reminders to team members who haven't responded to upcoming activities
// when the respond_by deadline is tomorrow.
// Cron: daily at 07:00 UTC (= 09:00 CEST / 08:00 CET)
// Manual: POST /api/participation-reminders (superuser)

// ─── Cron job ───
cronAdd("participation-reminders", "0 7 * * *", function() {
  if ($os.getenv("DISABLE_CRONS") === "true") return
  var lib = require(__hooks + "/participation_reminders_lib.js")
  console.log("[participation-reminders] Cron started")
  try {
    lib.runReminders()
  } catch (e) {
    console.log("[participation-reminders] Cron error: " + e)
  }
})

// ─── Manual trigger ───
routerAdd("POST", "/api/participation-reminders", function(e) {
  var lib = require(__hooks + "/participation_reminders_lib.js")
  console.log("[participation-reminders] Manual trigger")
  try {
    var count = lib.runReminders()
    return e.json(200, { sent: count })
  } catch (err) {
    console.log("[participation-reminders] Manual trigger error: " + err)
    return e.json(500, { error: String(err) })
  }
}, $apis.requireSuperuserAuth())
