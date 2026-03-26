/// <reference path="../pb_data/types.d.ts" />

// Audit logging for ALL collections — creates, updates, deletes, auth events.
// Writes JSON lines to pb_data/audit.log.
//
// NOTE: Uses e.record.collection().name instead of IIFE closure variables
// because PB 0.36 goja engine breaks variable capture in IIFE closures.

// ── helpers (inlined from audit_log_lib.js) ──

var LOG_PATH = $os.getenv("AUDIT_LOG_PATH") || ($app.dataDir() + "/audit.log")

function writeLogLine(obj) {
  obj.ts = new Date().toISOString()
  var line = JSON.stringify(obj)
  // Use $os.writeFile with read-append instead of $os.openFile which can
  // cause Go-level panics in PB 0.36 JSVM that bypass JS try/catch.
  try {
    var existing = ""
    try { existing = String($os.readFile(LOG_PATH)) } catch (_) {}
    $os.writeFile(LOG_PATH, existing + line + "\n", 0o644)
  } catch (e) {
    console.log("[AUDIT] " + line)
  }
}

/**
 * Log a structured audit event.
 * @param {"info"|"warn"|"error"} level
 * @param {"create"|"update"|"delete"|"auth"|"error"|"system"} action
 * @param {string} collection
 * @param {string} recordId
 * @param {string} actor - member ID, "system", or "anonymous"
 * @param {object} [details] - extra context (changed fields, error messages, etc.)
 */
function auditLog(level, action, collection, recordId, actor, details) {
  writeLogLine({
    level: level,
    action: action,
    collection: collection,
    record_id: recordId,
    actor: actor || "system",
    details: details || {},
  })
}

/**
 * Log an error event (shorthand).
 */
function error(collection, message, details) {
  writeLogLine({
    level: "error",
    action: "error",
    collection: collection,
    record_id: "",
    actor: "system",
    details: Object.assign({ message: message }, details || {}),
  })
}

/**
 * Extract changed fields between original and updated record.
 * Returns { fieldName: { old: ..., new: ... } } for fields that changed.
 */
function diffRecord(record) {
  var changes = {}
  var original = record.original()
  if (!original) return changes

  // Compare all field values
  var fields = record.collection().fields
  for (var i = 0; i < fields.length; i++) {
    var name = fields[i].name
    // Skip autodate fields and internal fields
    if (name === "created" || name === "updated") continue

    var oldVal = original.get(name)
    var newVal = record.get(name)
    var oldStr = JSON.stringify(oldVal)
    var newStr = JSON.stringify(newVal)
    if (oldStr !== newStr) {
      changes[name] = { old: oldVal, new: newVal }
    }
  }
  return changes
}

/**
 * Get actor ID from a hook event (works for both Request and non-Request hooks).
 */
function getActor(e) {
  try {
    var info = e.requestInfo()
    if (info && info.auth) return info.auth.id
  } catch (_) {}
  return "system"
}

// ── hooks ──

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

  // CREATE
  onRecordAfterCreateSuccess(function(e) {
    try {
      var cn = e.record.collection().name
      var details = {}
      if (cn === "members") {
        details.email = e.record.getString("email")
        details.first_name = e.record.getString("first_name")
        details.last_name = e.record.getString("last_name")
        details.shell = e.record.getBool("shell")
        details.coach_approved_team = e.record.getBool("coach_approved_team")
      }
      if (cn === "member_teams") {
        details.member = e.record.getString("member")
        details.team = e.record.getString("team")
        details.season = e.record.getString("season")
      }
      auditLog("info", "create", cn, e.record.id, getActor(e), details)
    } catch (err) {
      console.log("[audit-log] Create hook error: " + err)
    }
    e.next()
  }, ALL_COLLECTIONS[i])

  // UPDATE
  onRecordAfterUpdateSuccess(function(e) {
    try {
      var cn = e.record.collection().name
      var changes = diffRecord(e.record)
      var keys = Object.keys(changes)
      if (keys.length > 0) {
        auditLog("info", "update", cn, e.record.id, getActor(e), { changes: changes })
      }
    } catch (err) {
      console.log("[audit-log] Update hook error: " + err)
    }
    e.next()
  }, ALL_COLLECTIONS[i])

  // DELETE
  onRecordAfterDeleteSuccess(function(e) {
    try {
      var cn = e.record.collection().name
      var details = {}
      if (cn === "members") {
        details.email = e.record.getString("email")
        details.first_name = e.record.getString("first_name")
        details.last_name = e.record.getString("last_name")
      }
      if (cn === "member_teams") {
        details.member = e.record.getString("member")
        details.team = e.record.getString("team")
      }
      auditLog("warn", "delete", cn, e.record.id, getActor(e), details)
    } catch (err) {
      console.log("[audit-log] Delete hook error: " + err)
    }
    e.next()
  }, ALL_COLLECTIONS[i])

}

// ── Auth events (members only) ──────────────────────────────────────

onRecordAuthRequest(function(e) {
  try {
    auditLog("info", "auth", "members", e.record.id, e.record.id, {
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
    auditLog("info", "system", "members", e.record.id, e.record.id, {
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
    auditLog("info", "system", "members", e.record.id, e.record.id, {
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
