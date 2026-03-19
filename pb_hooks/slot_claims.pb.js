/// <reference path="../node_modules/pocketbase/dist/pocketbase.d.ts" />

// Slot claims — validation guard + auto-revocation + email notification

// ── Guard: validate claim on create ──────────────────────────────────

onRecordCreate((e) => {
  var record = e.record

  // 1. Validate date is not in the past
  var claimDate = record.getString("date").slice(0, 10)
  var today = new Date()
  var todayStr = today.getFullYear() + "-" +
    String(today.getMonth() + 1).padStart(2, "0") + "-" +
    String(today.getDate()).padStart(2, "0")

  if (claimDate < todayStr) {
    throw new BadRequestError("Cannot claim past dates.")
  }

  // 2. Check no active claim exists for the same hall_slot + date
  var hallSlotId = record.getString("hall_slot")
  var existing = $app.findRecordsByFilter(
    "slot_claims",
    'hall_slot = "' + hallSlotId + '" && date ~ "' + claimDate + '" && status = "active"',
    "",
    1,
    0
  )

  if (existing && existing.length > 0) {
    throw new BadRequestError("This slot has already been claimed.")
  }

  // 3. Validate that claimed_by_member matches the authenticated user
  var authRecord = e.requestInfo().auth
  if (authRecord && record.getString("claimed_by_member") !== authRecord.id) {
    throw new BadRequestError("claimed_by_member must match the authenticated user.")
  }

  // 4. Force status to "active" on creation
  record.set("status", "active")

  e.next()
}, "slot_claims")


// ── Auto-revoke claims when training is uncancelled ─────────────────

onRecordUpdate((e) => {
  var record = e.record
  var original = e.record.original()

  // Check if cancelled changed from true to false (uncancelled)
  var wasCancelled = original.getBool("cancelled")
  var isCancelled = record.getBool("cancelled")

  e.next()

  if (wasCancelled && !isCancelled) {
    console.log("[SlotClaims] Training uncancelled: " + record.id + " — revoking active claims")
    try {
      var claims = $app.findRecordsByFilter(
        "slot_claims",
        'freed_source_id = "' + record.id + '" && status = "active"',
        "",
        100,
        0
      )
      for (var i = 0; i < claims.length; i++) {
        claims[i].set("status", "revoked")
        $app.save(claims[i])
        console.log("[SlotClaims] Revoked claim: " + claims[i].id)
      }
    } catch (err) {
      console.log("[SlotClaims] Error revoking claims for training " + record.id + ": " + err)
    }
  }
}, "trainings")


// ── Auto-revoke claims when game is postponed ───────────────────────

onRecordUpdate((e) => {
  var record = e.record
  var original = e.record.original()

  var oldStatus = original.getString("status")
  var newStatus = record.getString("status")

  e.next()

  if (oldStatus !== "postponed" && newStatus === "postponed") {
    console.log("[SlotClaims] Game postponed: " + record.id + " — revoking active claims")
    try {
      var claims = $app.findRecordsByFilter(
        "slot_claims",
        'freed_source_id = "' + record.id + '" && status = "active"',
        "",
        100,
        0
      )
      for (var i = 0; i < claims.length; i++) {
        claims[i].set("status", "revoked")
        $app.save(claims[i])
        console.log("[SlotClaims] Revoked claim: " + claims[i].id)
      }
    } catch (err) {
      console.log("[SlotClaims] Error revoking claims for game " + record.id + ": " + err)
    }
  }
}, "games")


// ── Email notification when training is cancelled (slot freed) ───────

onRecordUpdate((e) => {
  var record = e.record
  var original = e.record.original()

  var wasCancelled = original.getBool("cancelled")
  var isCancelled = record.getBool("cancelled")

  e.next()

  // Only send when training goes from not-cancelled to cancelled
  if (!wasCancelled && isCancelled) {
    var hallSlotId = record.getString("hall_slot")
    if (!hallSlotId) return // Only trainings linked to a recurring slot

    try {
      // Get the training's team to exclude them from notification
      var trainingTeamId = record.getString("team")

      // Get the hall name for the email
      var hallId = record.getString("hall")
      var hallName = ""
      if (hallId) {
        try {
          var hall = $app.findRecordById("halls", hallId)
          hallName = hall.getString("name")
        } catch (_) {}
      }

      // Get the team name
      var teamName = ""
      if (trainingTeamId) {
        try {
          var team = $app.findRecordById("teams", trainingTeamId)
          teamName = team.getString("name")
        } catch (_) {}
      }

      // Find all active teams
      var allTeams = $app.findRecordsByFilter("teams", 'active = true', "", 100, 0)

      // Collect unique coach member IDs from other teams
      var coachIds = {}
      for (var t = 0; t < allTeams.length; t++) {
        if (allTeams[t].id === trainingTeamId) continue // Skip the team that cancelled

        var fields = ["coach", "assistant", "team_responsible"]
        for (var f = 0; f < fields.length; f++) {
          var ids = allTeams[t].get(fields[f])
          if (ids && ids.length) {
            for (var m = 0; m < ids.length; m++) {
              coachIds[ids[m]] = true
            }
          }
        }
      }

      var memberIds = Object.keys(coachIds)
      if (memberIds.length === 0) return

      // Fetch member emails
      var dateStr = record.getString("date").slice(0, 10)
      var startTime = record.getString("start_time").slice(0, 5)
      var endTime = record.getString("end_time").slice(0, 5)

      for (var i = 0; i < memberIds.length; i++) {
        try {
          var member = $app.findRecordById("members", memberIds[i])
          var email = member.getString("email")
          if (!email) continue

          var firstName = member.getString("first_name") || "Coach"

          var tpl = require(__hooks + "/email_template_lib.js")
          var slotBody = tpl.buildParagraph(
            "Das Training von <strong>" + teamName + "</strong> wurde abgesagt. Die Hallenzeit ist ab sofort verf\u00fcgbar.",
            { color: "#94a3b8", size: "13px" }
          )
          slotBody += '<div style="height:8px"></div>'
          slotBody += tpl.buildInfoCard([
            { label: "Datum", value: dateStr, halfWidth: true },
            { label: "Zeit", value: startTime + " - " + endTime, halfWidth: true },
            { label: "Halle", value: hallName || "\u2014" },
          ])
          var message = new MailerMessage({
            from: {
              address: $app.settings().meta.senderAddress,
              name: $app.settings().meta.senderName,
            },
            to: [{ address: email }],
            subject: "Hallenzeit frei: " + hallName + " am " + dateStr,
            html: tpl.buildEmailLayout(slotBody, {
              title: "Hallenzeit frei",
              greeting: "Hallo <strong style=\"color:#ffffff\">" + firstName + "</strong>,",
              ctaUrl: "https://kscw.lucanepa.com/hallenplan",
              ctaLabel: "Zum Hallenplan",
              footerExtra: "Viele Gr\u00fcsse, KSCW",
            }),
            text: tpl.buildPlainLayout([
              "Hallo " + firstName + ",",
              "",
              "Das Training von " + teamName + " am " + dateStr + " von " + startTime + " - " + endTime +
                (hallName ? " in " + hallName : "") + " wurde abgesagt.",
              "",
              "Die Hallenzeit ist ab sofort verfuegbar.",
            ], { title: "Hallenzeit frei", url: "https://kscw.lucanepa.com/hallenplan" }),
          })

          $app.newMailClient().send(message)
        } catch (mailErr) {
          console.log("[SlotClaims] Failed to send email to member " + memberIds[i] + ": " + mailErr)
        }
      }

      console.log("[SlotClaims] Sent freed-slot emails to " + memberIds.length + " coaches")
    } catch (err) {
      console.log("[SlotClaims] Error sending freed-slot notifications: " + err)
    }
  }
}, "trainings")
