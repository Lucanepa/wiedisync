/// <reference path="../pb_data/types.d.ts" />

// ── shell_password: convert shell account to full member on password set ──
//
// When a shell member sets a password for the first time (detected via
// tokenKey change), upgrade them to a full member account if they are
// still active. Expired shells must be extended by a coach first.
//
// NOTE: This hook fires twice on the first password save because our save()
// call below triggers another onRecordAfterUpdateSuccess. The second time,
// shell is already false, so we exit early — this is safe.

onRecordAfterUpdateSuccess("members", function(e) {
  var record = e.record
  var original = record.original()

  // Only care about shell accounts
  if (!original.getBool("shell")) {
    return
  }

  // Detect password change via tokenKey rotation
  var newTokenKey = record.getString("tokenKey")
  var oldTokenKey = original.getString("tokenKey")

  if (!newTokenKey || newTokenKey === oldTokenKey) {
    return
  }

  // Shell is still set to true — this is the first fire
  if (!record.getBool("shell")) {
    // Already converted (second fire) — nothing to do
    return
  }

  // Only convert if the account is still active
  if (!record.getBool("wiedisync_active")) {
    console.log("[shell_password] Shell member " + record.id + " set a password but account is inactive — coach must extend first")
    return
  }

  // Upgrade to full member
  record.set("shell", false)
  record.set("shell_expires", "")
  record.set("shell_reminder_sent", false)
  e.app.save(record)

  console.log("[shell_password] Converted shell member " + record.id + " (" + record.getString("email") + ") to full member")
})
