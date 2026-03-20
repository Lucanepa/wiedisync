/// <reference path="../pb_data/types.d.ts" />

// ─── Feedback: Turnstile Validation ───
// Validates Cloudflare Turnstile token for unauthenticated feedback submissions.
// Authenticated users (Wiedisync) skip validation.
// Reads token from X-Turnstile-Token header (preferred) or request body fallback.

onRecordCreateRequest((e) => {
  // Skip for authenticated users (Wiedisync members)
  if (e.requestInfo().auth) {
    return e.next()
  }

  var info = e.requestInfo()

  // Read token: header (PocketBase normalizes keys to snake_case),
  // then body fallback (works with JSON requests to custom endpoints).
  var token = info.headers["x_turnstile_token"]
    || info.body.turnstile_token
    || ""

  if (!token) {
    throw new BadRequestError("Turnstile token required")
  }

  var secret = $os.getenv("TURNSTILE_SECRET_KEY")
  if (!secret) {
    console.log("[feedback-turnstile] TURNSTILE_SECRET_KEY not set, skipping validation")
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
}, "feedback")
