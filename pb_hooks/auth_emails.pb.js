/// <reference path="../pb_data/types.d.ts" />

// Override PocketBase default auth emails with branded, language-aware versions.
// Uses email_template_lib.js for consistent KSCW dark-mode branding.
// Reads member.language to send DE or EN emails.
//
// IMPORTANT: Each hook callback runs in an isolated goja scope.
// All helpers and strings MUST be defined inside each callback (or via require).

// ── Password Reset ──────────────────────────────────────────────────

onMailerRecordPasswordResetSend(function(e) {
  var tpl = require(__hooks + "/email_template_lib.js")
  var record = e.record
  var rawLang = record.getString("language") || ""
  var lang = (rawLang === "english" || rawLang === "en") ? "en" : "de"
  var name = record.getString("first_name") || record.getString("name").split(" ")[0] || ""

  // Extract token from default PB email body
  var token = ""
  var match = e.message.html.match(/confirm-password-reset\/([A-Za-z0-9_.-]+)/)
  if (match) token = match[1]

  var resetUrl = "https://wiedisync.kscw.ch/reset-password/" + token

  var subject = lang === "en"
    ? "Reset Password – Wiedisync"
    : "Passwort zurücksetzen – Wiedisync"
  var title = lang === "en" ? "Reset Password" : "Passwort zurücksetzen"
  var greeting = lang === "en" ? "Hello " + name + "," : "Hallo " + name + ","
  var body = lang === "en"
    ? "Click the button below to reset your password."
    : "Klicke auf den Button unten, um dein Passwort zurückzusetzen."
  var cta = lang === "en" ? "Reset Password" : "Passwort zurücksetzen"
  var ignore = lang === "en"
    ? "If you didn't request a password reset, you can ignore this email."
    : "Falls du kein neues Passwort angefordert hast, kannst du diese E-Mail ignorieren."
  var footer = lang === "en" ? "Your Wiedisync Team" : "Dein Wiedisync Team"

  var bodyHtml = tpl.buildParagraph(body) +
    tpl.buildParagraph("<em>" + ignore + "</em>", { color: "#94a3b8", size: "12px" })

  e.message.subject = subject
  e.message.html = tpl.buildEmailLayout(bodyHtml, {
    lang: lang,
    title: title,
    greeting: greeting,
    ctaUrl: resetUrl,
    ctaLabel: cta,
    footerExtra: footer
  })
  e.message.text = tpl.buildPlainLayout([
    greeting, "", body, "", resetUrl, "", ignore
  ], { title: title })
}, "members")

// ── Email Verification ──────────────────────────────────────────────

onMailerRecordVerificationSend(function(e) {
  var tpl = require(__hooks + "/email_template_lib.js")
  var record = e.record
  var rawLang = record.getString("language") || ""
  var lang = (rawLang === "english" || rawLang === "en") ? "en" : "de"
  var name = record.getString("first_name") || record.getString("name").split(" ")[0] || ""

  var token = ""
  var match = e.message.html.match(/confirm-verification\/([A-Za-z0-9_.-]+)/)
  if (match) token = match[1]

  var verifyUrl = "https://api.kscw.ch/_/#/auth/confirm-verification/" + token

  var subject = lang === "en" ? "Verify Email – Wiedisync" : "E-Mail bestätigen – Wiedisync"
  var title = lang === "en" ? "Verify Email" : "E-Mail bestätigen"
  var greeting = lang === "en" ? "Hello " + name + "," : "Hallo " + name + ","
  var body = lang === "en"
    ? "Click the button below to verify your email address."
    : "Klicke auf den Button unten, um deine E-Mail-Adresse zu bestätigen."
  var cta = lang === "en" ? "Verify Email" : "E-Mail bestätigen"
  var ignore = lang === "en"
    ? "If you didn't request this verification, you can ignore this email."
    : "Falls du diese Bestätigung nicht angefordert hast, kannst du diese E-Mail ignorieren."
  var footer = lang === "en" ? "Your Wiedisync Team" : "Dein Wiedisync Team"

  var bodyHtml = tpl.buildParagraph(body) +
    tpl.buildParagraph("<em>" + ignore + "</em>", { color: "#94a3b8", size: "12px" })

  e.message.subject = subject
  e.message.html = tpl.buildEmailLayout(bodyHtml, {
    lang: lang,
    title: title,
    greeting: greeting,
    ctaUrl: verifyUrl,
    ctaLabel: cta,
    footerExtra: footer
  })
  e.message.text = tpl.buildPlainLayout([
    greeting, "", body, "", verifyUrl, "", ignore
  ], { title: title })
}, "members")

// ── Confirm Email Change ────────────────────────────────────────────

onMailerRecordEmailChangeSend(function(e) {
  var tpl = require(__hooks + "/email_template_lib.js")
  var record = e.record
  var rawLang = record.getString("language") || ""
  var lang = (rawLang === "english" || rawLang === "en") ? "en" : "de"
  var name = record.getString("first_name") || record.getString("name").split(" ")[0] || ""

  var token = ""
  var match = e.message.html.match(/confirm-email-change\/([A-Za-z0-9_.-]+)/)
  if (match) token = match[1]

  var changeUrl = "https://api.kscw.ch/_/#/auth/confirm-email-change/" + token

  var subject = lang === "en" ? "Confirm New Email – Wiedisync" : "Neue E-Mail bestätigen – Wiedisync"
  var title = lang === "en" ? "Confirm New Email" : "Neue E-Mail-Adresse bestätigen"
  var greeting = lang === "en" ? "Hello " + name + "," : "Hallo " + name + ","
  var body = lang === "en"
    ? "Click the button below to confirm your new email address."
    : "Klicke auf den Button unten, um deine neue E-Mail-Adresse zu bestätigen."
  var cta = lang === "en" ? "Confirm New Email" : "Neue E-Mail bestätigen"
  var ignore = lang === "en"
    ? "If you didn't request this change, you can ignore this email."
    : "Falls du keine Änderung angefordert hast, kannst du diese E-Mail ignorieren."
  var footer = lang === "en" ? "Your Wiedisync Team" : "Dein Wiedisync Team"

  var bodyHtml = tpl.buildParagraph(body) +
    tpl.buildParagraph("<em>" + ignore + "</em>", { color: "#94a3b8", size: "12px" })

  e.message.subject = subject
  e.message.html = tpl.buildEmailLayout(bodyHtml, {
    lang: lang,
    title: title,
    greeting: greeting,
    ctaUrl: changeUrl,
    ctaLabel: cta,
    footerExtra: footer
  })
  e.message.text = tpl.buildPlainLayout([
    greeting, "", body, "", changeUrl, "", ignore
  ], { title: title })
}, "members")

// ── Login Alert ─────────────────────────────────────────────────────

onMailerRecordAuthAlertSend(function(e) {
  var tpl = require(__hooks + "/email_template_lib.js")
  var record = e.record
  var rawLang = record.getString("language") || ""
  var lang = (rawLang === "english" || rawLang === "en") ? "en" : "de"
  var name = record.getString("first_name") || record.getString("name").split(" ")[0] || ""

  // Extract alert info from default PB email (between <em> tags)
  var alertInfo = ""
  var alertMatch = e.message.html.match(/<em>([\s\S]*?)<\/em>/)
  if (alertMatch) alertInfo = alertMatch[1].trim()

  var subject = lang === "en" ? "New Login – Wiedisync" : "Neuer Login – Wiedisync"
  var title = lang === "en" ? "New Login Detected" : "Neuer Login erkannt"
  var greeting = lang === "en" ? "Hello " + name + "," : "Hallo " + name + ","
  var body = lang === "en"
    ? "We noticed a login to your Wiedisync account from a new location:"
    : "Wir haben einen Login in dein Wiedisync-Konto von einem neuen Standort erkannt:"
  var warning = lang === "en"
    ? "If this wasn't you, you should immediately change your password."
    : "Falls das nicht du warst, solltest du sofort dein Passwort ändern."
  var ignore = lang === "en"
    ? "If you just logged in, you can ignore this email."
    : "Falls du dich gerade eingeloggt hast, kannst du diese E-Mail ignorieren."
  var footer = lang === "en" ? "Your Wiedisync Team" : "Dein Wiedisync Team"

  var bodyHtml = tpl.buildParagraph(body)
  if (alertInfo) {
    bodyHtml += tpl.buildAlertBox("info", "Info", alertInfo)
  }
  bodyHtml += '<div style="height:12px"></div>'
  bodyHtml += tpl.buildAlertBox("warning", lang === "de" ? "Achtung" : "Warning", warning)
  bodyHtml += '<div style="height:8px"></div>'
  bodyHtml += tpl.buildParagraph("<em>" + ignore + "</em>", { color: "#94a3b8", size: "12px" })

  e.message.subject = subject
  e.message.html = tpl.buildEmailLayout(bodyHtml, {
    lang: lang,
    title: title,
    greeting: greeting,
    footerExtra: footer
  })
  e.message.text = tpl.buildPlainLayout([
    greeting, "", body, alertInfo || "", "", warning, "", ignore
  ], { title: title })
}, "members")
