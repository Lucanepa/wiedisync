/// <reference path="../pb_data/types.d.ts" />

// ── One-time migration: set birthdate_visibility = 'hidden' for all members ──
// Runs on PocketBase boot. Idempotent — skips if no members need updating.

onBootstrap(function (e) {
  e.next()

  try {
    var members = $app.findRecordsByFilter(
      "members",
      'birthdate_visibility = ""',
      "",
      0,
      0
    )

    if (!members || members.length === 0) {
      console.log("[Migration] birthdate_visibility: all members already have a value — skipping")
      return
    }

    console.log("[Migration] birthdate_visibility: updating " + members.length + " members to 'hidden'")

    for (var i = 0; i < members.length; i++) {
      members[i].set("birthdate_visibility", "hidden")
      $app.save(members[i])
    }

    console.log("[Migration] birthdate_visibility: done")
  } catch (err) {
    console.log("[Migration] birthdate_visibility: error — " + err)
  }
})
