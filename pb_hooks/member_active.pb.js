/// <reference path="../pb_data/types.d.ts" />

// ── member_active: activate members on successful authentication ──────
// When a member logs in (password or OAuth), set member_active=true.
// This marks them as having "claimed" their account.

onRecordAuthRequest(function(e) {
  // Let the auth proceed first
  e.next()

  // After successful auth, activate the member if not already active
  var record = e.record
  if (!record.getBool("member_active")) {
    record.set("member_active", true)
    e.app.save(record)
    console.log("[member_active] Activated member: " + record.getString("email"))
  }
}, "members")
