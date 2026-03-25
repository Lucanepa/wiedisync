/// <reference path="../pb_data/types.d.ts" />

// ── Shell Cron Jobs ───────────────────────────────────────────────────
// 1. shell_expiry    — daily 02:00 UTC — deactivate expired shell accounts
// 2. shell_reminder  — daily 09:00 UTC — email reminder 10 days before expiry
// 3. invite_expiry   — daily 03:00 UTC — mark stale pending invites as expired

// ── Helpers ──────────────────────────────────────────────────────────
// NOTE: PB goja isolates each callback scope, so helpers must be
// defined as vars before cronAdd to be accessible inside callbacks.

// toIsoString — formats a Date as PocketBase datetime string
var shellCrons_toIsoString = function(date) {
  return date.toISOString().replace("T", " ").slice(0, 23) + "Z"
}

// nowIsoString — current UTC time as PB datetime string
var shellCrons_nowIso = function() {
  return shellCrons_toIsoString(new Date())
}

// plusDaysIso — UTC time N days from now as PB datetime string
var shellCrons_plusDaysIso = function(days) {
  return shellCrons_toIsoString(new Date(new Date().getTime() + days * 24 * 60 * 60 * 1000))
}

// ── 1. shell_expiry — daily at 02:00 UTC ─────────────────────────────
// Deactivate shell members whose shell_expires has passed.

cronAdd("shell_expiry", "0 2 * * *", function() {
  if ($os.getenv("DISABLE_CRONS") === "true") return
  console.log("[shell_expiry] Cron started")
  try {
    var nowIso = shellCrons_nowIso()
    var expired = $app.findRecordsByFilter(
      "members",
      'shell = true && wiedisync_active = true && shell_expires != "" && shell_expires <= "' + nowIso + '"',
      "",
      500,
      0
    )
    var count = 0
    for (var i = 0; i < expired.length; i++) {
      try {
        expired[i].set("wiedisync_active", false)
        $app.save(expired[i])
        count++
      } catch (e) {
        console.log("[shell_expiry] Failed to deactivate member " + expired[i].id + ": " + e)
      }
    }
    console.log("[shell_expiry] Deactivated " + count + " expired shell member(s)")
  } catch (e) {
    console.log("[shell_expiry] Cron error: " + e)
  }
})

// ── 2. shell_reminder — daily at 09:00 UTC ───────────────────────────
// Send an expiry warning email to shell members expiring within 10 days
// who have not yet received a reminder.

cronAdd("shell_reminder", "0 9 * * *", function() {
  if ($os.getenv("DISABLE_CRONS") === "true") return
  console.log("[shell_reminder] Cron started")
  try {
    var nowIso = shellCrons_nowIso()
    var in10Iso = shellCrons_plusDaysIso(10)

    var upcoming = $app.findRecordsByFilter(
      "members",
      'shell = true && wiedisync_active = true && shell_reminder_sent = false && shell_expires != "" && shell_expires <= "' + in10Iso + '"',
      "",
      500,
      0
    )

    var sent = 0
    var senderAddress = $app.settings().meta.senderAddress
    var senderName = $app.settings().meta.senderName

    for (var i = 0; i < upcoming.length; i++) {
      var member = upcoming[i]
      var email = member.getString("email")
      var firstName = member.getString("first_name") || member.getString("name") || ""

      if (!email) {
        console.log("[shell_reminder] Skipping member " + member.id + " (no email)")
        continue
      }

      try {
        var message = new MailerMessage({
          from: {
            address: senderAddress,
            name: senderName
          },
          to: [{ address: email, name: firstName }],
          subject: "Your KSC Wiedikon access expires soon",
          html: "<p>Hi " + firstName + ",</p>" +
            "<p>Your guest access to the KSC Wiedikon platform will expire soon.</p>" +
            "<p>To keep your access permanently, please log in and set a password for your account at " +
            "<a href=\"https://wiedisync.kscw.ch\">wiedisync.kscw.ch</a>.</p>" +
            "<p>Once you set a password, your account will be automatically upgraded to a full member account.</p>" +
            "<p>If you have any questions, please contact your team coach.</p>" +
            "<p>Best regards,<br>KSC Wiedikon</p>",
          text: "Hi " + firstName + ",\n\n" +
            "Your guest access to the KSC Wiedikon platform will expire soon.\n\n" +
            "To keep your access permanently, please log in and set a password for your account at https://wiedisync.kscw.ch.\n\n" +
            "Once you set a password, your account will be automatically upgraded to a full member account.\n\n" +
            "If you have any questions, please contact your team coach.\n\n" +
            "Best regards,\nKSC Wiedikon"
        })

        $app.newMailClient().send(message)

        member.set("shell_reminder_sent", true)
        $app.save(member)
        sent++
        console.log("[shell_reminder] Sent reminder to " + email)
      } catch (e) {
        console.log("[shell_reminder] Failed to send/save for member " + member.id + " (" + email + "): " + e)
        // Leave shell_reminder_sent = false so it retries next run
      }
    }

    console.log("[shell_reminder] Sent " + sent + " reminder(s)")
  } catch (e) {
    console.log("[shell_reminder] Cron error: " + e)
  }
})

// ── 3. invite_expiry — daily at 03:00 UTC ────────────────────────────
// Mark pending team_invites as expired when their expires_at has passed.

cronAdd("invite_expiry", "0 3 * * *", function() {
  if ($os.getenv("DISABLE_CRONS") === "true") return
  console.log("[invite_expiry] Cron started")
  try {
    var nowIso = shellCrons_nowIso()
    var stale = $app.findRecordsByFilter(
      "team_invites",
      'status = "pending" && expires_at <= "' + nowIso + '"',
      "",
      500,
      0
    )
    var count = 0
    for (var i = 0; i < stale.length; i++) {
      try {
        stale[i].set("status", "expired")
        $app.save(stale[i])
        count++
      } catch (e) {
        console.log("[invite_expiry] Failed to expire invite " + stale[i].id + ": " + e)
      }
    }
    console.log("[invite_expiry] Expired " + count + " stale invite(s)")
  } catch (e) {
    console.log("[invite_expiry] Cron error: " + e)
  }
})
