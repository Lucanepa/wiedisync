/// <reference path="../node_modules/pocketbase/dist/pocketbase.d.ts" />

// ClubDesk CSV → PocketBase member sync hook
// Manual only: POST /api/clubdesk-sync
// Auth: PB superuser OR member with superadmin role
// Accepts JSON body: { csv: "..." }

routerAdd("POST", "/api/clubdesk-sync", function(e) {
  console.log("[ClubDesk Sync] Manual sync triggered")

  // ── Auth check ──────────────────────────────────────────────────
  var info = e.requestInfo()
  if (!info.auth) {
    e.json(401, { success: false, error: "Authentication required" })
    return
  }

  var authorized = false

  // Check member superadmin role
  try {
    var roles = info.auth.get("role")
    if (roles) {
      for (var i = 0; i < roles.length; i++) {
        if (roles[i] === "superuser") authorized = true
      }
    }
  } catch (_) {}

  // Check PB superuser
  if (!authorized) {
    try {
      $app.findRecordById("_superusers", info.auth.id)
      authorized = true
    } catch (_) {}
  }

  if (!authorized) {
    e.json(403, { success: false, error: "Superadmin role required" })
    return
  }

  // ── Sync logic ──────────────────────────────────────────────────
  try {
    var csvData = ""
    if (info.body && info.body.csv) {
      csvData = String(info.body.csv)
    }
    console.log("[ClubDesk Sync] CSV length: " + csvData.length)

    if (!csvData) {
      e.json(400, {
        success: false,
        error: "CSV data required. Upload a CSV exported from ClubDesk.",
      })
      return
    }

    var lib = require(__hooks + "/clubdesk_sync_lib.js")
    var result = lib.syncMembers(csvData)
    console.log("[ClubDesk Sync] Complete: " + result.created + " created, " + result.updated + " updated, " + result.skipped + " skipped, " + result.errors + " errors")

    e.json(200, {
      success: true,
      synced_at: new Date().toISOString(),
      created: result.created,
      updated: result.updated,
      skipped: result.skipped,
      errors: result.errors,
      details: result.details,
    })
  } catch (err) {
    console.log("[ClubDesk Sync] Error: " + err)
    e.json(500, {
      success: false,
      error: String(err),
    })
  }
})
