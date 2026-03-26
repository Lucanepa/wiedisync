/// <reference path="../pb_data/types.d.ts" />

// ── VPS Report: internal endpoint to send system reports via PB SMTP ──
// POST /api/vps-report { to, subject, body }
// Only accessible from localhost (127.0.0.1)

routerAdd("POST", "/api/vps-report", function(e) {
  // Only allow from localhost or Docker bridge network
  var ip = e.realIP()
  if (ip !== "127.0.0.1" && ip !== "::1" && ip.indexOf("10.0.") !== 0 && ip.indexOf("172.") !== 0) {
    return e.json(403, { error: "forbidden: " + ip })
  }

  var data = e.requestInfo().body
  var to = data.to || ""
  var subject = data.subject || "VPS Report"
  var body = data.body || ""

  if (!to || !body) {
    return e.json(400, { error: "to and body required" })
  }

  var mail = new MailerMessage()
  mail.from = { address: $app.settings().meta.senderAddress, name: "KSCW VPS Monitor" }
  mail.to = [{ address: to }]
  mail.subject = subject
  mail.text = body
  // Simple HTML: wrap in <pre> for monospace formatting
  mail.html = "<pre style=\"font-family:monospace;font-size:13px;line-height:1.5;\">" + body.replace(/</g, "&lt;").replace(/>/g, "&gt;") + "</pre>"

  $app.newMailClient().send(mail)

  return e.json(200, { ok: true })
})
