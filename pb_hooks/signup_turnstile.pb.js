/// <reference path="../pb_data/types.d.ts" />

// ─── Signup: Turnstile Validation ───
// Validates Cloudflare Turnstile token for unauthenticated member creation (signup).
// Authenticated users (e.g. admins creating members) skip validation.
// Reads token from X-Turnstile-Token header.

onRecordCreateRequest((e) => {
  // Skip for authenticated users (admins creating members)
  if (e.requestInfo().auth) {
    return e.next()
  }

  var info = e.requestInfo()

  var token = info.headers["x_turnstile_token"] || ""

  if (!token) {
    throw new BadRequestError("Turnstile token required")
  }

  var secret = $os.getenv("TURNSTILE_SECRET")
  if (!secret) {
    console.log("[signup-turnstile] TURNSTILE_SECRET not set, skipping validation")
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
