/// <reference path="../pb_data/types.d.ts" />

// Pre-registration email verification via 8-digit OTP code.
// Users who don't yet exist in PB can verify their email before signup.
// Uses email_verifications collection for code storage and rate limiting.
//
// IMPORTANT: Each hook callback runs in an isolated goja scope.
// All helpers and strings MUST be defined inside each callback (or via require).

// ── Send Verification Code ────────────────────────────────────────────

routerAdd("POST", "/api/verify-email", function(e) {
  var tpl = require(__hooks + "/email_template_lib.js")

  var body = $apis.requestInfo(e).body
  var email = (body.email || "").trim().toLowerCase()

  if (!email) {
    throw new BadRequestError("Email is required")
  }

  // Rate limit: max 3 codes per email per hour
  var oneHourAgo = new Date(new Date().getTime() - 60 * 60 * 1000)
  var recentCodes = []
  try {
    recentCodes = $app.findRecordsByFilter(
      "email_verifications",
      "email = {:email} && created > {:since}",
      "-created",
      100,
      0,
      { email: email, since: oneHourAgo.toISOString().replace("T", " ") }
    )
  } catch (err) {
    // no records found — fine
  }

  if (recentCodes.length >= 3) {
    throw new BadRequestError("Too many verification attempts. Please try again later.")
  }

  // Delete any existing codes for this email
  try {
    var existing = $app.findRecordsByFilter(
      "email_verifications",
      "email = {:email}",
      "-created",
      100,
      0,
      { email: email }
    )
    for (var i = 0; i < existing.length; i++) {
      $app.delete(existing[i])
    }
  } catch (err) {
    // no existing records — fine
  }

  // Generate 8-digit code
  var code = ""
  for (var i = 0; i < 8; i++) {
    code += Math.floor(Math.random() * 10).toString()
  }

  // Create verification record (expires in 10 minutes)
  var now = new Date()
  var expiresAt = new Date(now.getTime() + 10 * 60 * 1000)

  var collection = $app.findCollectionByNameOrId("email_verifications")
  var record = new Record(collection)
  record.set("email", email)
  record.set("code", code)
  record.set("expires_at", expiresAt.toISOString().replace("T", " "))
  record.set("verification_token", "")
  $app.save(record)

  // Build branded email (DE default — new user has no language preference yet)
  var subject = "Dein Bestätigungscode \u2013 Wiedisync"
  var title = "Bestätigungscode"
  var greeting = "Hallo,"
  var bodyText = "Verwende den folgenden Code, um deine E-Mail-Adresse zu best\u00e4tigen:"
  var codeDisplay = '<div style="text-align:center;margin:16px 0">' +
    '<span style="display:inline-block;font-size:32px;font-weight:700;letter-spacing:8px;color:#FFC832;background:#0f172a;padding:16px 28px;border-radius:8px;border:1px solid #334155">' +
    code +
    '</span></div>'
  var expiry = "Der Code ist 10 Minuten g\u00fcltig."
  var ignore = "Falls du diese Verifizierung nicht angefordert hast, kannst du diese E-Mail ignorieren."
  var footer = "Dein Wiedisync Team"

  var bodyHtml = tpl.buildParagraph(bodyText) +
    codeDisplay +
    tpl.buildParagraph(expiry, { color: "#94a3b8", size: "12px" }) +
    tpl.buildParagraph("<em>" + ignore + "</em>", { color: "#94a3b8", size: "12px" })

  var htmlContent = tpl.buildEmailLayout(bodyHtml, {
    lang: "de",
    title: title,
    greeting: greeting,
    footerExtra: footer
  })

  var textContent = tpl.buildPlainLayout([
    greeting, "", bodyText, "", code, "", expiry, "", ignore
  ], { title: title })

  // Send email
  var message = new MailerMessage()
  message.from = { address: $app.settings().meta.senderAddress, name: $app.settings().meta.senderName }
  message.to = [{ address: email }]
  message.subject = subject
  message.html = htmlContent
  message.text = textContent
  $app.newMailClient().send(message)

  return e.json(200, { success: true })
})

// ── Confirm Verification Code ─────────────────────────────────────────

routerAdd("POST", "/api/verify-email/confirm", function(e) {
  var body = $apis.requestInfo(e).body
  var email = (body.email || "").trim().toLowerCase()
  var code = (body.code || "").trim()

  if (!email || !code) {
    throw new BadRequestError("Email and code are required")
  }

  var now = new Date()
  var records = []
  try {
    records = $app.findRecordsByFilter(
      "email_verifications",
      "email = {:email} && code = {:code} && expires_at > {:now}",
      "-created",
      1,
      0,
      { email: email, code: code, now: now.toISOString().replace("T", " ") }
    )
  } catch (err) {
    // no matching record
  }

  if (!records || records.length === 0) {
    throw new BadRequestError("Invalid or expired code")
  }

  var record = records[0]

  // Generate 32-char verification token
  var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
  var token = ""
  for (var i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length))
  }

  // Update record with token and extend expiry to 15 minutes
  var newExpiry = new Date(now.getTime() + 15 * 60 * 1000)
  record.set("verification_token", token)
  record.set("expires_at", newExpiry.toISOString().replace("T", " "))
  $app.save(record)

  return e.json(200, { verificationToken: token })
})
