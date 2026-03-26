/// <reference path="../pb_data/types.d.ts" />

// ─── Auth: Turnstile Validation ───
// Validates Cloudflare Turnstile token for login (authWithPassword) requests.
// Reads token from X-Turnstile-Token header.
// Skips validation if TURNSTILE_SECRET is not set (dev environments).

onRecordAuthRequest((e) => {
  var info = e.requestInfo()

  // Skip Turnstile for OTP auth (no browser widget involved)
  var body = info.body || {}
  if (body.otpId) {
    return e.next()
  }

  // Skip Turnstile for auth-refresh (JWT renewal — no login form involved)
  if (!body.identity && !body.password && !body.provider) {
    return e.next()
  }

  var token = info.headers["x_turnstile_token"] || ""

  if (!token) {
    throw new BadRequestError("Turnstile token required")
  }

  var secret = $os.getenv("TURNSTILE_SECRET")
  if (!secret) {
    console.log("[auth-turnstile] TURNSTILE_SECRET not set, skipping validation")
    return e.next()
  }

  var res = $http.send({
    url: "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "secret=" + encodeURIComponent(secret)
      + "&response=" + encodeURIComponent(token),
  })

  var result = JSON.parse(res.raw)
  if (!result.success) {
    throw new BadRequestError("Turnstile validation failed")
  }

  return e.next()
}, "members")
