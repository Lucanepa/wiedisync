/// <reference path="../pb_data/types.d.ts" />

// Audit logging for ALL collections — creates, updates, deletes, auth events.
// Writes JSON lines to pb_data/audit.log (see audit_log_lib.js).

// Every collection in the system
var ALL_COLLECTIONS = [
  "halls",
  "teams",
  "members",
  "member_teams",
  "hall_slots",
  "hall_closures",
  "games",
  "rankings",
  "absences",
  "events",
  "participations",
  "trainings",
  "scorer_delegations",
  "sponsors",
  "team_invites",
  "notifications",
  "feedback",
  "push_subscriptions",
  "game_scheduling_seasons",
  "game_scheduling_opponents",
  "game_scheduling_bookings",
  "game_scheduling_slots",
  "slot_claims",
]

// ── Register hooks for every collection ─────────────────────────────

for (var i = 0; i < ALL_COLLECTIONS.length; i++) {
  ;(function(colName) {

    // CREATE
    onRecordAfterCreateSuccess(function(e) {
      try {
        var audit = require(__hooks + "/audit_log_lib.js")
        var details = {}
        if (colName === "members") {
          details.email = e.record.getString("email")
          details.first_name = e.record.getString("first_name")
          details.last_name = e.record.getString("last_name")
          details.shell = e.record.getBool("shell")
          details.coach_approved_team = e.record.getBool("coach_approved_team")
        }
        if (colName === "member_teams") {
          details.member = e.record.getString("member")
          details.team = e.record.getString("team")
          details.season = e.record.getString("season")
        }
        audit.log("info", "create", colName, e.record.id, audit.getActor(e), details)
      } catch (err) {
        console.log("[audit-log] Create hook error (" + colName + "): " + err)
      }
      e.next()
    }, colName)

    // UPDATE
    onRecordAfterUpdateSuccess(function(e) {
      try {
        var audit = require(__hooks + "/audit_log_lib.js")
        var changes = audit.diffRecord(e.record)
        var keys = Object.keys(changes)
        if (keys.length > 0) {
          audit.log("info", "update", colName, e.record.id, audit.getActor(e), { changes: changes })
        }
      } catch (err) {
        console.log("[audit-log] Update hook error (" + colName + "): " + err)
      }
      e.next()
    }, colName)

    // DELETE
    onRecordAfterDeleteSuccess(function(e) {
      try {
        var audit = require(__hooks + "/audit_log_lib.js")
        var details = {}
        if (colName === "members") {
          details.email = e.record.getString("email")
          details.first_name = e.record.getString("first_name")
          details.last_name = e.record.getString("last_name")
        }
        if (colName === "member_teams") {
          details.member = e.record.getString("member")
          details.team = e.record.getString("team")
        }
        audit.log("warn", "delete", colName, e.record.id, audit.getActor(e), details)
      } catch (err) {
        console.log("[audit-log] Delete hook error (" + colName + "): " + err)
      }
      e.next()
    }, colName)

  })(ALL_COLLECTIONS[i])
}

// ── Auth events (members only) ──────────────────────────────────────

onRecordAuthRequest(function(e) {
  try {
    var audit = require(__hooks + "/audit_log_lib.js")
    audit.log("info", "auth", "members", e.record.id, e.record.id, {
      email: e.record.getString("email"),
      method: e.method || "unknown",
    })
  } catch (err) {
    console.log("[audit-log] Auth hook error: " + err)
  }
  e.next()
}, "members")

// ── Auth email events ───────────────────────────────────────────────

onMailerRecordPasswordResetSend(function(e) {
  try {
    var audit = require(__hooks + "/audit_log_lib.js")
    audit.log("info", "system", "members", e.record.id, e.record.id, {
      event: "password_reset_requested",
      email: e.record.getString("email"),
    })
  } catch (err) {
    console.log("[audit-log] Password reset hook error: " + err)
  }
  e.next()
}, "members")

onMailerRecordVerificationSend(function(e) {
  try {
    var audit = require(__hooks + "/audit_log_lib.js")
    audit.log("info", "system", "members", e.record.id, e.record.id, {
      event: "verification_email_sent",
      email: e.record.getString("email"),
    })
  } catch (err) {
    console.log("[audit-log] Verification hook error: " + err)
  }
  e.next()
}, "members")

// ── Log rotation (daily at 03:30 UTC) ───────────────────────────────
// Rotates audit.log → audit.log.YYYY-MM-DD, keeps last 30 days

cronAdd("audit-log-rotation", "30 3 * * *", function() {
  if ($os.getenv("DISABLE_CRONS") === "true") return

  var LOG_PATH = $os.getenv("AUDIT_LOG_PATH") || ($app.dataDir() + "/audit.log")
  var ARCHIVE_DIR = $app.dataDir() + "/audit_archive"
  var KEEP_DAYS = 30

  try {
    // Ensure archive directory exists
    $os.mkdirAll(ARCHIVE_DIR, 0o755)

    // Rotate current log
    var now = new Date()
    var yyyy = now.getFullYear()
    var mm = String(now.getMonth() + 1).padStart(2, "0")
    var dd = String(now.getDate()).padStart(2, "0")
    var archiveName = ARCHIVE_DIR + "/audit." + yyyy + "-" + mm + "-" + dd + ".log"

    try {
      // Read current log, write to archive, truncate original
      var content = $os.readFile(LOG_PATH)
      if (content && content.length > 0) {
        $os.writeFile(archiveName, content, 0o644)
        // Truncate by writing empty
        $os.writeFile(LOG_PATH, "", 0o644)
        console.log("[Audit] Rotated " + content.length + " bytes → " + archiveName)
      }
    } catch (_) {
      // No log file yet, nothing to rotate
    }

    // Delete archives older than KEEP_DAYS
    var cutoff = new Date(now.getTime() - KEEP_DAYS * 24 * 60 * 60 * 1000)
    var entries = $os.readDir(ARCHIVE_DIR)
    for (var i = 0; i < entries.length; i++) {
      var name = entries[i].name()
      // Parse date from filename: audit.YYYY-MM-DD.log
      var match = name.match(/^audit\.(\d{4}-\d{2}-\d{2})\.log$/)
      if (match) {
        var fileDate = new Date(match[1])
        if (fileDate < cutoff) {
          $os.removeAll(ARCHIVE_DIR + "/" + name)
          console.log("[Audit] Deleted old archive: " + name)
        }
      }
    }
  } catch (e) {
    console.log("[Audit] Log rotation error: " + e)
  }
})
