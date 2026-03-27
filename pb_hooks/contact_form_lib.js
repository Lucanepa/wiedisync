// Contact form helpers — shared across callbacks in contact_form_api.pb.js

var TURNSTILE_SECRET = $os.getenv("TURNSTILE_SECRET")

// General sport email routing (no specific team selected)
var SPORT_EMAILS = {
  volleyball: ["volleyball@kscw.ch"],
  basketball: ["anja.jimenez@kscw.ch", "rachel.moser@kscw.ch"],
}
var GENERAL_EMAIL = "kontakt@kscw.ch"

var verifyTurnstile = function(token) {
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

module.exports = {
  TURNSTILE_SECRET: TURNSTILE_SECRET,
  SPORT_EMAILS: SPORT_EMAILS,
  GENERAL_EMAIL: GENERAL_EMAIL,
  verifyTurnstile: verifyTurnstile,
}
