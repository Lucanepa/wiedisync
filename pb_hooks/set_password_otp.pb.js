/// <reference path="../pb_data/types.d.ts" />

// Set password endpoint for OTP-authenticated users.
// Requires an authenticated request (auth record must be present).
//
// IMPORTANT: Each hook callback runs in an isolated goja scope.
// All helpers and strings MUST be defined inside each callback (or via require).

routerAdd("POST", "/api/set-password", function(e) {
  var info = e.requestInfo()
  var auth = info.auth
  if (!auth) {
    throw new BadRequestError("Authentication required")
  }

  var body = info.body || {}
  var password = body.password || ""
  var passwordConfirm = body.passwordConfirm || ""

  if (!password || !passwordConfirm) {
    throw new BadRequestError("Password and password confirmation are required")
  }

  if (password !== passwordConfirm) {
    throw new BadRequestError("Passwords do not match")
  }

  if (password.length < 8) {
    throw new BadRequestError("Password must be at least 8 characters")
  }

  // Update the authenticated member's password
  var record = $app.findRecordById("members", auth.id)
  record.setPassword(password)
  $app.save(record)

  // Auto-approve ClubDesk imports: they verified email ownership via OTP,
  // so no coach approval needed. Only for members who have a member_teams
  // record (real ClubDesk imports). Graceful — approval failure doesn't
  // block password setting.
  var approved = false
  if (!record.getBool("coach_approved_team")) {
    try {
      // Re-fetch to avoid stale data after password save
      var fresh = $app.findRecordById("members", record.id)
      fresh.set("coach_approved_team", true)
      $app.save(fresh)
      approved = true
    } catch (_) {
      // Guard rejected (no member_teams) — that's OK, user goes to pending
    }
  }

  return e.json(200, { success: true, approved: approved })
}, $apis.requireAuth())
