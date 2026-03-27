/// <reference path="../node_modules/pocketbase/dist/pocketbase.d.ts" />

// Basketplan → PocketBase sync hook
// Schedule: daily at 06:05 UTC (5 min after SV sync)
// Manual:   POST /api/bp-sync (superuser auth required)
// NOTE: PB 0.36 JSVM isolates each callback scope — require() must be called inside each callback.

// ── Cron: daily at 06:05 ────────────────────────────────────────────

cronAdd("bp-sync", "5 6 * * *", function() {
  if ($os.getenv("DISABLE_CRONS") === "true") return
  console.log("[BP Sync] Starting daily sync...")
  try {
    var lib = require(__hooks + "/bp_sync_lib.js")
    lib.syncGames()
    lib.syncRankings()
    console.log("[BP Sync] Daily sync completed successfully")
  } catch (e) {
    console.log("[BP Sync] Daily sync failed: " + e)
  }
})

// ── Manual trigger: POST /api/bp-sync (superuser only) ──────────────

routerAdd("POST", "/api/bp-sync", function(e) {
  console.log("[BP Sync] Manual sync triggered")
  try {
    var lib = require(__hooks + "/bp_sync_lib.js")
    lib.syncGames()
    lib.syncRankings()
    e.json(200, {
      success: true,
      synced_at: new Date().toISOString(),
    })
  } catch (err) {
    e.json(500, {
      success: false,
      error: String(err),
    })
  }
}, $apis.requireSuperuserAuth())
