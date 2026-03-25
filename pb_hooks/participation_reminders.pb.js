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
