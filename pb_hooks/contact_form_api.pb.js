/// <reference path="../pb_data/types.d.ts" />

// ── Contact Form API ────────────────────────────────────────────────
// POST /api/contact — public endpoint with Turnstile verification
// Resolves email recipients from team leadership relations in PB
// Auto-deployed via GitHub webhook (verified working)

var _secrets = JSON.parse(String.fromCharCode.apply(null, new Uint8Array($os.readFile(__hooks + "/secrets.json"))))
var TURNSTILE_SECRET = _secrets.TURNSTILE_SECRET

// General sport email routing (no specific team selected)
var SPORT_EMAILS = {
  volleyball: ["volleyball@kscw.ch"],
  basketball: ["anja.jimenez@kscw.ch", "rachel.moser@kscw.ch"],
}
var GENERAL_EMAIL = "kontakt@kscw.ch"

function verifyTurnstile(token) {
  if (!token) return false
  try {
    var resp = $http.send({
      method: "POST",
      url: "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret: TURNSTILE_SECRET,
        response: token,
      }),
    })
    var data = JSON.parse(resp.raw)
    return data.success === true
  } catch (err) {
    console.log("[ContactForm] Turnstile verification error: " + err)
    return false
  }
}

routerAdd("POST", "/api/contact", function (e) {
  var tpl = require(__hooks + "/email_template_lib.js")

  // ── Parse body ──────────────────────────────────────────────────
  var body = $apis.requestInfo(e).body
  var firstName = (body.first_name || "").trim()
  var lastName = (body.last_name || "").trim()
  var senderEmail = (body.email || "").trim()
  var subject = (body.subject || "").trim()
  var teamId = (body.team_id || "").trim()
  var message = (body.message || "").trim()
  var turnstileToken = (body.turnstile_token || "").trim()

  // ── Validate ────────────────────────────────────────────────────
  if (!firstName || !lastName) throw new BadRequestError("Vor- und Nachname erforderlich.")
  if (!senderEmail) throw new BadRequestError("E-Mail erforderlich.")
  if (!subject) throw new BadRequestError("Betreff erforderlich.")
  if (!message) throw new BadRequestError("Nachricht erforderlich.")
  if (!turnstileToken) throw new BadRequestError("Captcha erforderlich.")

  // ── Turnstile ───────────────────────────────────────────────────
  if (!verifyTurnstile(turnstileToken)) {
    throw new BadRequestError("Captcha-Verifizierung fehlgeschlagen.")
  }

  // ── Resolve recipients ──────────────────────────────────────────
  var toEmails = []
  var ccEmails = []
  var teamName = ""
  var sport = null

  if (subject === "volleyball" || subject === "basketball") {
    sport = subject === "volleyball" ? "vb" : "bb"

    if (teamId) {
      // Specific team — get coach + team_responsible emails
      try {
        var team = $app.findRecordById("teams", teamId)
        teamName = team.getString("name") || team.getString("full_name") || ""

        var coachIds = team.get("coach") || []
        var trIds = team.get("team_responsible") || []

        for (var i = 0; i < coachIds.length; i++) {
          try {
            var coach = $app.findRecordById("members", coachIds[i])
            var email = coach.getString("email")
            if (email) toEmails.push(email)
          } catch (e) { /* member not found */ }
        }

        for (var j = 0; j < trIds.length; j++) {
          try {
            var tr = $app.findRecordById("members", trIds[j])
            var trEmail = tr.getString("email")
            if (trEmail) ccEmails.push(trEmail)
          } catch (e) { /* member not found */ }
        }
      } catch (err) {
        console.log("[ContactForm] Team lookup failed: " + err)
      }

      // Always CC the sport TK when a specific team is selected
      var sportCc = SPORT_EMAILS[subject] || []
      for (var k = 0; k < sportCc.length; k++) {
        if (ccEmails.indexOf(sportCc[k]) === -1 && toEmails.indexOf(sportCc[k]) === -1) {
          ccEmails.push(sportCc[k])
        }
      }

      // Fallback: if no coach emails, use sport general
      if (toEmails.length === 0) {
        toEmails = SPORT_EMAILS[subject] || [GENERAL_EMAIL]
      }
    } else {
      // General sport inquiry
      toEmails = SPORT_EMAILS[subject] || [GENERAL_EMAIL]
    }
  } else {
    // allgemein, sponsoring, sonstiges
    toEmails = [GENERAL_EMAIL]
  }

  // ── Build email ─────────────────────────────────────────────────
  var subjectLabels = {
    allgemein: "Allgemein",
    volleyball: "Volleyball",
    basketball: "Basketball",
    sponsoring: "Sponsoring",
    sonstiges: "Sonstiges",
  }
  var subjectLabel = subjectLabels[subject] || subject
  var emailSubject = "[KSCW Kontaktformular] " + subjectLabel
  if (teamName) emailSubject += " — " + teamName
  emailSubject += " — " + firstName + " " + lastName

  var infoRows = [
    { label: "Name", value: firstName + " " + lastName },
    { label: "E-Mail", value: senderEmail },
    { label: "Betreff", value: subjectLabel },
  ]
  if (teamName) {
    infoRows.push({ label: "Team", value: teamName })
  }

  var bodyHtml = tpl.buildInfoCard(infoRows)
    + tpl.buildDivider()
    + tpl.buildParagraph(message.replace(/\n/g, "<br>"))

  var html = tpl.buildEmailLayout(bodyHtml, {
    title: "Neue Kontaktanfrage",
    subtitle: subjectLabel + (teamName ? " — " + teamName : ""),
    sport: sport,
    greeting: "",
  })

  var plainLines = [
    "Name: " + firstName + " " + lastName,
    "E-Mail: " + senderEmail,
    "Betreff: " + subjectLabel,
  ]
  if (teamName) plainLines.push("Team: " + teamName)
  plainLines.push("")
  plainLines.push("Nachricht:")
  plainLines.push(message)

  var textBody = tpl.buildPlainLayout(plainLines, { title: "Neue Kontaktanfrage" })

  // ── Send email ──────────────────────────────────────────────────
  var allRecipients = toEmails.concat(ccEmails)

  try {
    var msg = new MailerMessage({
      from: { address: "admin@volleyball.lucanepa.com", name: "KSC Wiedikon" },
      to: toEmails.map(function (addr) { return { address: addr } }),
      cc: ccEmails.length ? ccEmails.map(function (addr) { return { address: addr } }) : undefined,
      replyTo: [{ address: senderEmail, name: firstName + " " + lastName }],
      subject: emailSubject,
      html: html,
      text: textBody,
    })
    $app.newMailClient().send(msg)
    console.log("[ContactForm] Email sent to: " + allRecipients.join(", "))
  } catch (err) {
    console.log("[ContactForm] Email send failed: " + err)
    throw new BadRequestError("E-Mail konnte nicht gesendet werden.")
  }

  // ── Response ────────────────────────────────────────────────────
  e.json(200, { success: true })
})
