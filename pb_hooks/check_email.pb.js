/// <reference path="../pb_data/types.d.ts" />

// ── POST /api/check-email ─────────────────────────────────────────────
// Public endpoint: checks if an email exists in the members collection.
// Used by the signup form to determine the registration flow.
//
// Body: { email: string }
// Returns: { exists: bool, claimed: bool }
//   - exists: true if a member record with this email exists
//   - claimed: true if the member has set a password (tokenKey present)

routerAdd("POST", "/api/check-email", function (e) {
  var body = e.requestInfo().body
  var email = (body.email || "").trim().toLowerCase()

  if (!email) {
    throw new BadRequestError("email is required.")
  }

  var members
  try {
    members = $app.findRecordsByFilter(
      "members",
      'email = "' + email + '"',
      "",
      1,
      0
    )
  } catch (_) {
    members = []
  }

  if (!members || members.length === 0) {
    return e.json(200, { exists: false, claimed: false })
  }

  var member = members[0]
  // A member is "claimed" if they have set a password (tokenKey is rotated on password set)
  var tokenKey = member.getString("tokenKey")
  var claimed = !!tokenKey && tokenKey.length > 0

  return e.json(200, { exists: true, claimed: claimed })
})
