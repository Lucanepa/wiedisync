/// <reference path="../pb_data/types.d.ts" />

// ─── Participation Reminders ───
// Sends email reminders to team members who haven't responded to upcoming activities
// when the respond_by deadline is tomorrow.
// Cron: daily at 07:00 UTC (= 09:00 CEST / 08:00 CET)
// Manual: POST /api/participation-reminders (superuser)
// NOTE: PB goja isolates each callback scope, so functions must be
// defined as vars before cronAdd/routerAdd to be accessible inside callbacks.

var sendRemindersForActivity = function(activityType, activityId, teamId, activityDate, activityTime, activityLabel) {
  var tpl = require(__hooks + "/email_template_lib.js")
  var sent = 0

  if (!teamId) {
    console.log("[participation-reminders] No team for " + activityType + " " + activityId)
    return 0
  }

  // Get team members
  var memberTeams = []
  try {
    memberTeams = $app.findRecordsByFilter(
      "member_teams",
      'team = "' + teamId + '"',
      "", 200, 0
    )
  } catch (e) {
    console.log("[participation-reminders] Error fetching members for team " + teamId + ": " + e)
    return 0
  }

  if (memberTeams.length === 0) return 0

  var memberIds = []
  for (var i = 0; i < memberTeams.length; i++) {
    memberIds.push(memberTeams[i].getString("member"))
  }

  // Get existing participations
  var participations = []
  try {
    var memberFilter = memberIds.map(function(id) { return 'member = "' + id + '"' }).join(" || ")
    participations = $app.findRecordsByFilter(
      "participations",
      '(' + memberFilter + ') && activity_type = "' + activityType + '" && activity_id = "' + activityId + '"',
      "", 200, 0
    )
  } catch (e) {
    console.log("[participation-reminders] Error fetching participations: " + e)
  }

  var respondedSet = {}
  for (var p = 0; p < participations.length; p++) {
    respondedSet[participations[p].getString("member")] = true
  }

  // Get absences overlapping activity date
  var absenceSet = {}
  try {
    var absFilter = memberIds.map(function(id) { return 'member = "' + id + '"' }).join(" || ")
    var absences = $app.findRecordsByFilter(
      "absences",
      '(' + absFilter + ') && start_date <= "' + activityDate + '" && end_date >= "' + activityDate + '"',
      "", 200, 0
    )
    for (var a = 0; a < absences.length; a++) {
      absenceSet[absences[a].getString("member")] = true
    }
  } catch (e) {
    console.log("[participation-reminders] Error fetching absences: " + e)
  }

  // Find members who need reminders
  var needsReminder = []
  for (var m = 0; m < memberIds.length; m++) {
    var mid = memberIds[m]
    if (!respondedSet[mid] && !absenceSet[mid]) {
      needsReminder.push(mid)
    }
  }

  if (needsReminder.length === 0) {
    console.log("[participation-reminders] All members responded for " + activityType + " " + activityId)
    return 0
  }

  console.log("[participation-reminders] Sending " + needsReminder.length + " reminders for " + activityType + " " + activityId)

  // Get team name for email
  var teamName = ""
  try {
    var team = $app.findRecordById("teams", teamId)
    teamName = team.getString("name")
  } catch (e) {
    teamName = "Team"
  }

  // Send emails
  for (var r = 0; r < needsReminder.length; r++) {
    try {
      var member = $app.findRecordById("members", needsReminder[r])
      var email = member.getString("email")
      var firstName = member.getString("first_name") || member.getString("name") || ""
      var lang = member.getString("language") || ""
      var isEn = lang === "english" || lang === "en"

      if (!email) continue

      var subject, plainText, html

      // Format date nicely
      var dateParts = activityDate.split("-")
      var dateFormatted = dateParts[2] + "." + dateParts[1] + "." + dateParts[0]

      var activityTypeLabel
      if (isEn) {
        activityTypeLabel = activityType === "training" ? "Training" : activityType === "game" ? "Game" : "Event"
      } else {
        activityTypeLabel = activityType === "training" ? "Training" : activityType === "game" ? "Spiel" : "Event"
      }

      if (isEn) {
        subject = "Reminder: Please RSVP for " + activityTypeLabel + " on " + dateFormatted
      } else {
        subject = "Erinnerung: Bitte melde dich f\u00fcr " + activityTypeLabel + " am " + dateFormatted
      }

      // Plain text via shared layout
      var plainLines = [
        (isEn ? "Hi" : "Hoi") + " " + firstName + ",",
        "",
        (isEn ? "Please respond to the upcoming " + activityTypeLabel.toLowerCase() + ":" : "Bitte melde dich f\u00fcr den kommenden Anlass:"),
        "",
        "  " + activityLabel,
        "  " + (isEn ? "Date" : "Datum") + ": " + dateFormatted,
      ]
      if (activityTime) plainLines.push("  " + (isEn ? "Time" : "Zeit") + ": " + activityTime)
      plainLines.push("  Team: " + teamName)
      plainLines.push("")
      plainLines.push(isEn
        ? "The response deadline is tomorrow. Please open the app and confirm your participation."
        : "Die Anmeldefrist l\u00e4uft morgen ab. Bitte \u00f6ffne die App und best\u00e4tige deine Teilnahme.")
      plainText = tpl.buildPlainLayout(plainLines, {
        title: subject,
        url: "https://wiedisync.kscw.ch",
      })

      // HTML via shared branded layout
      var infoRows = [
        { label: isEn ? "Activity" : "Anlass", value: activityLabel },
        { label: isEn ? "Date" : "Datum", value: dateFormatted, halfWidth: true },
      ]
      if (activityTime) {
        infoRows.push({ label: isEn ? "Time" : "Zeit", value: activityTime, halfWidth: true })
      }
      infoRows.push({ label: "Team", value: teamName })

      var bodyHtml = tpl.buildInfoCard(infoRows)
      bodyHtml += '<div style="height:12px"></div>'
      bodyHtml += tpl.buildParagraph(
        isEn
          ? "The response deadline is tomorrow. Please confirm your participation."
          : "Die Anmeldefrist l\u00e4uft morgen ab. Bitte best\u00e4tige deine Teilnahme.",
        { color: "#94a3b8", size: "13px" }
      )

      html = tpl.buildEmailLayout(bodyHtml, {
        lang: isEn ? "en" : "de",
        title: isEn ? "RSVP Reminder" : "Teilnahme-Erinnerung",
        greeting: (isEn ? "Hi" : "Hoi") + ' <strong style="color:#ffffff">' + firstName + '</strong>,',
        ctaUrl: "https://wiedisync.kscw.ch",
        ctaLabel: isEn ? "Open App" : "App \u00f6ffnen",
      })

      var message = new MailerMessage({
        from: {
          address: $app.settings().meta.senderAddress,
          name: "KSC Wiedikon"
        },
        to: [{ address: email, name: firstName }],
        subject: subject,
        text: plainText,
        html: html,
      })

      $app.newMailClient().send(message)
      sent++
      console.log("[participation-reminders] Sent to " + email + " for " + activityType + " " + activityId)
    } catch (e) {
      console.log("[participation-reminders] Failed to send to member " + needsReminder[r] + ": " + e)
    }
  }

  return sent
}

var runReminders = function() {
  var totalSent = 0

  // Calculate tomorrow's date in Zurich timezone
  var now = new Date()
  // Zurich offset: UTC+1 (winter) or UTC+2 (summer)
  // Determine DST: last Sunday of March to last Sunday of October
  var year = now.getUTCFullYear()
  var marchLast = new Date(Date.UTC(year, 2, 31))
  var dstStart = new Date(Date.UTC(year, 2, 31 - marchLast.getUTCDay(), 1, 0, 0))
  var octLast = new Date(Date.UTC(year, 9, 31))
  var dstEnd = new Date(Date.UTC(year, 9, 31 - octLast.getUTCDay(), 1, 0, 0))
  var isDST = now >= dstStart && now < dstEnd
  var zurichOffset = isDST ? 2 : 1

  var zurichNow = new Date(now.getTime() + zurichOffset * 3600000)
  var tomorrow = new Date(zurichNow.getTime() + 86400000)
  var tomorrowStr = tomorrow.getUTCFullYear() + "-" +
    String(tomorrow.getUTCMonth() + 1).padStart(2, "0") + "-" +
    String(tomorrow.getUTCDate()).padStart(2, "0")

  console.log("[participation-reminders] Tomorrow (Zurich): " + tomorrowStr)

  // ─── Trainings ───
  try {
    var trainings = $app.findRecordsByFilter(
      "trainings",
      'respond_by ~ "' + tomorrowStr + '" && cancelled = false',
      "", 200, 0
    )
    console.log("[participation-reminders] Found " + trainings.length + " trainings with deadline tomorrow")
    for (var i = 0; i < trainings.length; i++) {
      var training = trainings[i]
      var sent = sendRemindersForActivity(
        "training",
        training.id,
        training.getString("team"),
        training.getString("date").split(" ")[0],
        training.getString("start_time"),
        "Training"
      )
      totalSent += sent
    }
  } catch (e) {
    console.log("[participation-reminders] Error processing trainings: " + e)
  }

  // ─── Games ───
  try {
    var games = $app.findRecordsByFilter(
      "games",
      'respond_by ~ "' + tomorrowStr + '" && status != "postponed" && status != "completed"',
      "", 200, 0
    )
    console.log("[participation-reminders] Found " + games.length + " games with deadline tomorrow")
    for (var j = 0; j < games.length; j++) {
      var game = games[j]
      var gameSent = sendRemindersForActivity(
        "game",
        game.id,
        game.getString("kscw_team"),
        game.getString("date").split(" ")[0],
        game.getString("time"),
        game.getString("home_team") + " vs " + game.getString("away_team")
      )
      totalSent += gameSent
    }
  } catch (e) {
    console.log("[participation-reminders] Error processing games: " + e)
  }

  // ─── Events ───
  try {
    var events = $app.findRecordsByFilter(
      "events",
      'respond_by ~ "' + tomorrowStr + '"',
      "", 200, 0
    )
    console.log("[participation-reminders] Found " + events.length + " events with deadline tomorrow")
    for (var k = 0; k < events.length; k++) {
      var evt = events[k]
      var teamIds = evt.get("teams")
      if (!teamIds || teamIds.length === 0) continue
      for (var ti = 0; ti < teamIds.length; ti++) {
        var evtSent = sendRemindersForActivity(
          "event",
          evt.id,
          teamIds[ti],
          evt.getString("start_date").split(" ")[0],
          "",
          evt.getString("title")
        )
        totalSent += evtSent
      }
    }
  } catch (e) {
    console.log("[participation-reminders] Error processing events: " + e)
  }

  // ─── Pre-deadline alerts: games with insufficient players ───
  try {
    var preDeadlineGames = $app.findRecordsByFilter(
      "games",
      'respond_by ~ "' + tomorrowStr + '" && status = "scheduled"',
      "", 200, 0
    )
    console.log("[participation-reminders] Checking " + preDeadlineGames.length + " games for pre-deadline roster alerts")
    for (var pg = 0; pg < preDeadlineGames.length; pg++) {
      var pdGame = preDeadlineGames[pg]
      var pdTeamId = pdGame.getString("kscw_team")
      if (!pdTeamId) continue

      // Determine sport and default minimum
      var pdTeam = null
      try { pdTeam = $app.findRecordById("teams", pdTeamId) } catch (e) { continue }
      var pdSport = pdTeam.getString("sport")
      var pdDefaultMin = pdSport === "basketball" ? 5 : 6
      var pdMin = pdGame.getInt("min_participants") || pdDefaultMin

      // Count confirmed non-staff
      var pdConfirmed = 0
      try {
        var pdParts = $app.findRecordsByFilter(
          "participations",
          'activity_type = "game" && activity_id = "' + pdGame.id + '" && status = "confirmed" && is_staff = false',
          "", 500, 0
        )
        pdConfirmed = pdParts.length
      } catch (e) { /* ignore */ }

      if (pdConfirmed < pdMin) {
        console.log("[participation-reminders] Game " + pdGame.id + " has " + pdConfirmed + "/" + pdMin + " players, sending alert")
        var pdAlertSent = sendRemindersForActivity(
          "game",
          pdGame.id,
          pdTeamId,
          pdGame.getString("date").split(" ")[0],
          pdGame.getString("time"),
          pdGame.getString("home_team") + " vs " + pdGame.getString("away_team") + " ⚠ " + pdConfirmed + "/" + pdMin
        )
        totalSent += pdAlertSent
      }
    }
  } catch (e) {
    console.log("[participation-reminders] Error processing pre-deadline game alerts: " + e)
  }

  // ─── Pre-deadline alerts: trainings with insufficient players ───
  try {
    var preDeadlineTrainings = $app.findRecordsByFilter(
      "trainings",
      'respond_by ~ "' + tomorrowStr + '" && cancelled = false && min_participants > 0',
      "", 200, 0
    )
    console.log("[participation-reminders] Checking " + preDeadlineTrainings.length + " trainings for pre-deadline min alerts")
    for (var pt = 0; pt < preDeadlineTrainings.length; pt++) {
      var pdTraining = preDeadlineTrainings[pt]
      var ptMin = pdTraining.getInt("min_participants")

      var ptConfirmed = 0
      try {
        var ptParts = $app.findRecordsByFilter(
          "participations",
          'activity_type = "training" && activity_id = "' + pdTraining.id + '" && status = "confirmed" && is_staff = false',
          "", 500, 0
        )
        ptConfirmed = ptParts.length
      } catch (e) { /* ignore */ }

      if (ptConfirmed < ptMin) {
        console.log("[participation-reminders] Training " + pdTraining.id + " has " + ptConfirmed + "/" + ptMin + " players, sending alert")
        var ptAlertSent = sendRemindersForActivity(
          "training",
          pdTraining.id,
          pdTraining.getString("team"),
          pdTraining.getString("date").split(" ")[0],
          pdTraining.getString("start_time"),
          "Training ⚠ " + ptConfirmed + "/" + ptMin
        )
        totalSent += ptAlertSent
      }
    }
  } catch (e) {
    console.log("[participation-reminders] Error processing pre-deadline training alerts: " + e)
  }

  // ─── Auto-cancel trainings where deadline passed and min not reached ───
  var todayStr = zurichNow.getUTCFullYear() + "-" +
    String(zurichNow.getUTCMonth() + 1).padStart(2, "0") + "-" +
    String(zurichNow.getUTCDate()).padStart(2, "0")

  try {
    var autoCancelTrainings = $app.findRecordsByFilter(
      "trainings",
      'auto_cancel_on_min = true && cancelled = false && min_participants > 0 && date >= "' + todayStr + '" && respond_by <= "' + todayStr + ' 23:59:59"',
      "", 200, 0
    )
    console.log("[participation-reminders] Checking " + autoCancelTrainings.length + " trainings for auto-cancel")
    for (var ac = 0; ac < autoCancelTrainings.length; ac++) {
      var acTraining = autoCancelTrainings[ac]
      var acMin = acTraining.getInt("min_participants")

      var acConfirmed = 0
      try {
        var acParts = $app.findRecordsByFilter(
          "participations",
          'activity_type = "training" && activity_id = "' + acTraining.id + '" && status = "confirmed" && is_staff = false',
          "", 500, 0
        )
        acConfirmed = acParts.length
      } catch (e) { /* ignore */ }

      if (acConfirmed < acMin) {
        console.log("[participation-reminders] Auto-cancelling training " + acTraining.id + " (" + acConfirmed + "/" + acMin + ")")
        acTraining.set("cancelled", true)
        acTraining.set("cancel_reason", "Automatisch abgesagt: Minimum von " + acMin + " Teilnehmern nicht erreicht (" + acConfirmed + " Zusagen)")
        $app.save(acTraining)

        // Send notification
        try {
          var notifCollection = $app.findCollectionByNameOrId("notifications")
          var acTeamId = acTraining.getString("team")
          var acMembers = $app.findRecordsByFilter(
            "member_teams",
            'team = "' + acTeamId + '"',
            "", 200, 0
          )
          for (var nm = 0; nm < acMembers.length; nm++) {
            var notif = new Record(notifCollection)
            notif.set("member", acMembers[nm].getString("member"))
            notif.set("type", "activity_change")
            notif.set("title", "training_cancelled")
            notif.set("body", JSON.stringify({
              date: acTraining.getString("date").split(" ")[0],
              reason: "auto_cancel_min"
            }))
            notif.set("activity_type", "training")
            notif.set("activity_id", acTraining.id)
            notif.set("read", false)
            $app.save(notif)
          }
        } catch (ne) {
          console.log("[participation-reminders] Error sending auto-cancel notifications: " + ne)
        }
      }
    }
  } catch (e) {
    console.log("[participation-reminders] Error processing auto-cancel: " + e)
  }

  // ─── Auto-decline tentative ("maybe") participations past respond_by deadline ───
  // For each activity type, find activities whose respond_by deadline has passed (≤ now),
  // then flip all "tentative" participations to "declined".
  var tentativeDeclined = 0

  // Helper: decline tentative participations for a set of activities
  var declineTentativeForActivities = function(activityType, activities, getActivityId) {
    for (var td = 0; td < activities.length; td++) {
      var actId = getActivityId(activities[td])
      try {
        var tentatives = $app.findRecordsByFilter(
          "participations",
          'activity_type = "' + activityType + '" && activity_id = "' + actId + '" && status = "tentative"',
          "", 500, 0
        )
        for (var tt = 0; tt < tentatives.length; tt++) {
          tentatives[tt].set("status", "declined")
          tentatives[tt].set("note", (tentatives[tt].getString("note") ? tentatives[tt].getString("note") + " | " : "") + "Auto-declined: deadline passed")
          $app.save(tentatives[tt])
          tentativeDeclined++
        }
      } catch (e) {
        console.log("[participation-reminders] Error declining tentatives for " + activityType + " " + actId + ": " + e)
      }
    }
  }

  // Trainings with passed deadline
  try {
    var pastTrainings = $app.findRecordsByFilter(
      "trainings",
      'respond_by != "" && respond_by <= "' + todayStr + ' 00:00:00" && cancelled = false && date >= "' + todayStr + '"',
      "", 500, 0
    )
    console.log("[participation-reminders] Checking " + pastTrainings.length + " trainings for tentative auto-decline")
    declineTentativeForActivities("training", pastTrainings, function(r) { return r.id })
  } catch (e) {
    console.log("[participation-reminders] Error finding trainings for tentative decline: " + e)
  }

  // Games with passed deadline
  try {
    var pastGames = $app.findRecordsByFilter(
      "games",
      'respond_by != "" && respond_by <= "' + todayStr + ' 00:00:00" && status = "scheduled"',
      "", 500, 0
    )
    console.log("[participation-reminders] Checking " + pastGames.length + " games for tentative auto-decline")
    declineTentativeForActivities("game", pastGames, function(r) { return r.id })
  } catch (e) {
    console.log("[participation-reminders] Error finding games for tentative decline: " + e)
  }

  // Events with passed deadline
  try {
    var pastEvents = $app.findRecordsByFilter(
      "events",
      'respond_by != "" && respond_by <= "' + todayStr + ' 00:00:00"',
      "", 500, 0
    )
    console.log("[participation-reminders] Checking " + pastEvents.length + " events for tentative auto-decline")
    declineTentativeForActivities("event", pastEvents, function(r) { return r.id })
  } catch (e) {
    console.log("[participation-reminders] Error finding events for tentative decline: " + e)
  }

  console.log("[participation-reminders] Tentative auto-declined: " + tentativeDeclined)

  console.log("[participation-reminders] Total emails sent: " + totalSent)
  return totalSent
}

// ─── Cron job ───
cronAdd("participation-reminders", "0 7 * * *", function() {
  if ($os.getenv("DISABLE_CRONS") === "true") return
  console.log("[participation-reminders] Cron started")
  try {
    runReminders()
  } catch (e) {
    console.log("[participation-reminders] Cron error: " + e)
  }
})

// ─── Manual trigger ───
routerAdd("POST", "/api/participation-reminders", function(e) {
  console.log("[participation-reminders] Manual trigger")
  try {
    var count = runReminders()
    return e.json(200, { sent: count })
  } catch (err) {
    console.log("[participation-reminders] Manual trigger error: " + err)
    return e.json(500, { error: String(err) })
  }
}, $apis.requireSuperuserAuth())
