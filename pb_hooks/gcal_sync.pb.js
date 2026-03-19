/// <reference path="../node_modules/pocketbase/dist/pocketbase.d.ts" />

// Google Calendar ICS → PocketBase sync hook
// Schedule: daily at 06:00 via cronAdd (same as SV sync)
// Manual:   POST /api/gcal-sync (superuser auth required)

// ── Cron: daily at 06:00 ────────────────────────────────────────────

cronAdd("gcal-sync", "0 6 * * *", function() {
  var lib = require(__hooks + "/gcal_sync_lib.js")
  console.log("[GCal Sync] Starting daily sync...")
  try {
    lib.syncHallEvents()
    console.log("[GCal Sync] Daily sync completed successfully")
  } catch (e) {
    console.log("[GCal Sync] Daily sync failed: " + e)
  }
})

// ── Manual trigger: POST /api/gcal-sync (superuser only) ──────────────

routerAdd("POST", "/api/gcal-sync", function(e) {
  var lib = require(__hooks + "/gcal_sync_lib.js")
  console.log("[GCal Sync] Manual sync triggered")
  try {
    lib.syncHallEvents()
    return e.json(200, {
      success: true,
      synced_at: new Date().toISOString(),
    })
  } catch (err) {
    return e.json(500, {
      success: false,
      error: String(err),
    })
  }
}, $apis.requireSuperuserAuth())
