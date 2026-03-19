/// <reference path="../pb_data/types.d.ts" />

// ─── Feedback: Turnstile Validation ───
// Validates Cloudflare Turnstile token for unauthenticated feedback submissions.
// Authenticated users (Wiedisync) skip validation.
// Clears the token field after validation so it's never stored.

onRecordCreateRequest((e) => {
  // Skip for authenticated users (Wiedisync members)
  if (e.requestInfo().auth) {
    e.record.set("turnstile_token", "")
    return e.next()
  }

  var token = e.record.get("turnstile_token")
  if (!token) {
    throw new BadRequestError("Turnstile token required")
  }

  var secret = $os.getenv("TURNSTILE_SECRET_KEY")
  if (!secret) {
    console.log("[feedback-turnstile] TURNSTILE_SECRET_KEY not set, skipping validation")
    e.record.set("turnstile_token", "")
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

  // Clear token so it's not persisted
  e.record.set("turnstile_token", "")

  return e.next()
}, "feedback")
