/// <reference path="../pb_data/types.d.ts" />

// ─── Notifications Hook ───
// Creates in-app notifications when activities are created/updated/deleted
// and daily reminders for upcoming activities and deadlines.
// NOTE: PB goja isolates each callback scope, so require() must be called inside each callback.

// ═══════════════════════════════════════════════════
// GAMES
// ═══════════════════════════════════════════════════

onRecordAfterCreateSuccess("games", function(e) {
  try {
    var lib = require(__hooks + "/notifications_lib.js")
    var game = e.record
    var teamId = game.getString("kscw_team")
    if (!teamId) return
    var date = lib.formatDate(game.getString("date"))
    lib.notifyTeamMembers("activity_change", "game_created",
      { home_team: game.getString("home_team"), away_team: game.getString("away_team"), date: date },
      "game", game.id, [teamId])
  } catch (err) {
    console.log("[notifications] games create error: " + err)
  }
})

onRecordAfterUpdateSuccess("games", function(e) {
  try {
    var lib = require(__hooks + "/notifications_lib.js")
    var game = e.record
    var teamId = game.getString("kscw_team")
    if (!teamId) return
    var date = lib.formatDate(game.getString("date"))

    // Check if status changed to completed → result notification
    var oldStatus = game.original().getString("status")
    var newStatus = game.getString("status")
    if (newStatus === "completed" && oldStatus !== "completed") {
      lib.notifyTeamMembers("result_available", "game_result",
        { home_team: game.getString("home_team"), away_team: game.getString("away_team"),
          home_score: String(game.getInt("home_score")), away_score: String(game.getInt("away_score")) },
        "game", game.id, [teamId])
      return
    }

    lib.notifyTeamMembers("activity_change", "game_updated",
      { home_team: game.getString("home_team"), away_team: game.getString("away_team"), date: date },
      "game", game.id, [teamId])
  } catch (err) {
    console.log("[notifications] games update error: " + err)
  }
})

onRecordAfterDeleteSuccess("games", function(e) {
  try {
    var lib = require(__hooks + "/notifications_lib.js")
    var game = e.record
    var teamId = game.getString("kscw_team")
    if (!teamId) return
    var date = lib.formatDate(game.getString("date"))
    lib.notifyTeamMembers("activity_change", "game_deleted",
      { home_team: game.getString("home_team"), away_team: game.getString("away_team"), date: date },
      "game", game.id, [teamId])
  } catch (err) {
    console.log("[notifications] games delete error: " + err)
  }
})

// ═══════════════════════════════════════════════════
// TRAININGS
// ═══════════════════════════════════════════════════

onRecordAfterCreateSuccess("trainings", function(e) {
  try {
    var lib = require(__hooks + "/notifications_lib.js")
    var training = e.record
    var teamId = training.getString("team")
    if (!teamId) return
    var date = lib.formatDate(training.getString("date"))
    lib.notifyTeamMembers("activity_change", "training_created",
      { date: date, time: training.getString("start_time") || "" },
      "training", training.id, [teamId])
  } catch (err) {
    console.log("[notifications] trainings create error: " + err)
  }
})

onRecordAfterUpdateSuccess("trainings", function(e) {
  try {
    var lib = require(__hooks + "/notifications_lib.js")
    var training = e.record
    var teamId = training.getString("team")
    if (!teamId) return
    var date = lib.formatDate(training.getString("date"))

    var wasCancelled = training.original().getBool("cancelled")
    var nowCancelled = training.getBool("cancelled")
    if (nowCancelled && !wasCancelled) {
      lib.notifyTeamMembers("activity_change", "training_cancelled",
        { date: date }, "training", training.id, [teamId])
      return
    }

    lib.notifyTeamMembers("activity_change", "training_updated",
      { date: date }, "training", training.id, [teamId])
  } catch (err) {
    console.log("[notifications] trainings update error: " + err)
  }
})

onRecordAfterDeleteSuccess("trainings", function(e) {
  try {
    var lib = require(__hooks + "/notifications_lib.js")
    var training = e.record
    var teamId = training.getString("team")
    if (!teamId) return
    var date = lib.formatDate(training.getString("date"))
    lib.notifyTeamMembers("activity_change", "training_deleted",
      { date: date }, "training", training.id, [teamId])
  } catch (err) {
    console.log("[notifications] trainings delete error: " + err)
  }
})

// ═══════════════════════════════════════════════════
// EVENTS
// ═══════════════════════════════════════════════════

onRecordAfterCreateSuccess("events", function(e) {
  try {
    var lib = require(__hooks + "/notifications_lib.js")
    var evt = e.record
    var teamIds = evt.get("teams")
    if (!teamIds || teamIds.length === 0) return
    lib.notifyTeamMembers("activity_change", "event_created",
      { title: evt.getString("title") }, "event", evt.id, teamIds)
  } catch (err) {
    console.log("[notifications] events create error: " + err)
  }
})

onRecordAfterUpdateSuccess("events", function(e) {
  try {
    var lib = require(__hooks + "/notifications_lib.js")
    var evt = e.record
    var teamIds = evt.get("teams")
    if (!teamIds || teamIds.length === 0) return
    lib.notifyTeamMembers("activity_change", "event_updated",
      { title: evt.getString("title") }, "event", evt.id, teamIds)
  } catch (err) {
    console.log("[notifications] events update error: " + err)
  }
})

onRecordAfterDeleteSuccess("events", function(e) {
  try {
    var lib = require(__hooks + "/notifications_lib.js")
    var evt = e.record
    var teamIds = evt.get("teams")
    if (!teamIds || teamIds.length === 0) return
    lib.notifyTeamMembers("activity_change", "event_deleted",
      { title: evt.getString("title") }, "event", evt.id, teamIds)
  } catch (err) {
    console.log("[notifications] events delete error: " + err)
  }
})

// ═══════════════════════════════════════════════════
// DAILY CRON — upcoming activities + deadline reminders
// Runs at 06:30 UTC (= 08:30 CEST / 07:30 CET)
// ═══════════════════════════════════════════════════

cronAdd("notification-reminders", "30 6 * * *", function() {
  var lib = require(__hooks + "/notifications_lib.js")
  console.log("[notification-reminders] Cron started")
  try {
    lib.runNotificationReminders()
  } catch (e) {
    console.log("[notification-reminders] Cron error: " + e)
  }
})

// Manual trigger for testing
routerAdd("POST", "/api/notification-reminders", function(e) {
  var lib = require(__hooks + "/notifications_lib.js")
  var info = e.requestInfo()
  if (!info.auth) {
    e.json(401, { error: "Authentication required" })
    return
  }
  console.log("[notification-reminders] Manual trigger")
  try {
    var counts = lib.runNotificationReminders()
    e.json(200, counts)
  } catch (err) {
    console.log("[notification-reminders] Error: " + err)
    e.json(500, { error: String(err) })
  }
})
