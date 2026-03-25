/// <reference path="../pb_data/types.d.ts" />

// Audit log — append-only JSON-lines file at pb_data/audit.log
//
// Each line is a JSON object:
// {"ts":"...","level":"info|warn|error","action":"create|update|delete|auth|error","collection":"...","record_id":"...","actor":"...","details":{...}}
//
// Usage from hooks:
//   var audit = require(__hooks + "/audit_log_lib.js")
//   audit.log("info", "create", "members", record.id, actorId, { email: "..." })
//   audit.error("members", "Failed to create member_teams", { error: err.toString() })

var LOG_PATH = $os.getenv("AUDIT_LOG_PATH") || ($app.dataDir() + "/audit.log")

// Go os package constants — use $os bindings if available, otherwise hardcoded values
// O_WRONLY=1, O_CREATE=64 (0x40), O_APPEND=1024 (0x400)
var OPEN_FLAGS = (typeof $os.O_APPEND !== "undefined" ? $os.O_APPEND : 1024) |
                 (typeof $os.O_CREATE !== "undefined" ? $os.O_CREATE : 64) |
                 (typeof $os.O_WRONLY !== "undefined" ? $os.O_WRONLY : 1)

function writeLogLine(obj) {
  obj.ts = new Date().toISOString()
  var line = JSON.stringify(obj) + "\n"
  try {
    var f = $os.openFile(LOG_PATH, OPEN_FLAGS, 0o644)
    f.writeString(line)
    f.close()
  } catch (e) {
    // Last resort — at least get it in console
    console.log("[AUDIT WRITE ERROR] " + e + " | " + line)
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
function log(level, action, collection, recordId, actor, details) {
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

module.exports = {
  log: log,
  error: error,
  diffRecord: diffRecord,
  getActor: getActor,
}
