/// <reference path="../pb_data/types.d.ts" />

// ── Boot migration: ensure birthdate_visibility = 'hidden' for all members ──
// Runs on every PocketBase boot. Catches NULL, empty string, and any invalid value.

onBootstrap(function (e) {
  e.next()

  try {
    // Fetch ALL members — SQLite NULL comparisons don't work in PB filters,
    // so we filter in JS to reliably catch NULL values.
    var allMembers = $app.findRecordsByFilter("members", "", "", 0, 0)

    var toUpdate = []
    for (var i = 0; i < allMembers.length; i++) {
      var val = allMembers[i].getString("birthdate_visibility")
      if (!val || (val !== "hidden" && val !== "full" && val !== "year_only")) {
        toUpdate.push(allMembers[i])
      }
    }

    if (toUpdate.length === 0) {
      console.log("[Migration] birthdate_visibility: all members already have a valid value — skipping")
      return
    }

    console.log("[Migration] birthdate_visibility: updating " + toUpdate.length + " members to 'hidden'")

    for (var j = 0; j < toUpdate.length; j++) {
      toUpdate[j].set("birthdate_visibility", "hidden")
      $app.save(toUpdate[j])
    }

    console.log("[Migration] birthdate_visibility: done")
  } catch (err) {
    console.log("[Migration] birthdate_visibility: error — " + err)
  }
})
