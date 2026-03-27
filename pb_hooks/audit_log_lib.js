/// <reference path="../pb_data/types.d.ts" />

// Shared audit log helpers — required inside each hook callback via:
//   var lib = require(__hooks + "/audit_log_lib.js")

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
function logError(collection, message, details) {
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
  LOG_PATH: LOG_PATH,
  writeLogLine: writeLogLine,
  auditLog: auditLog,
  logError: logError,
  diffRecord: diffRecord,
  getActor: getActor,
}
