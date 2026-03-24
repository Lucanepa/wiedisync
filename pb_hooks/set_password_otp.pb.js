/// <reference path="../pb_data/types.d.ts" />

// Set password endpoint for OTP-authenticated users.
// Requires an authenticated request (auth record must be present).
//
// IMPORTANT: Each hook callback runs in an isolated goja scope.
// All helpers and strings MUST be defined inside each callback (or via require).

routerAdd("POST", "/api/set-password", function(e) {
  var auth = e.auth
  if (!auth) {
    throw new BadRequestError("Authentication required")
  }

  var body = $apis.requestInfo(e).body
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
  var record = auth
  record.setPassword(password)
  $app.save(record)

  return e.json(200, { success: true })
})
