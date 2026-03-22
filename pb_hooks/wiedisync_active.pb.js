/// <reference path="../pb_data/types.d.ts" />

// ── wiedisync_active: activate members on successful authentication ──────
// When a member logs in (password or OAuth), set wiedisync_active=true.
// This marks them as having "claimed" their account.

onRecordAuthRequest(function(e) {
  // Let the auth proceed first
  e.next()

  // After successful auth, activate the member if not already active
  var record = e.record
  if (!record.getBool("wiedisync_active")) {
    record.set("wiedisync_active", true)
    e.app.save(record)
    console.log("[wiedisync_active] Activated member: " + record.getString("email"))
  }
}, "members")
