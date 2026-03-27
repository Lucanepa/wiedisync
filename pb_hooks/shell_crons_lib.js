/// <reference path="../pb_data/types.d.ts" />

// ── Shell Crons helpers ──
// Extracted from shell_crons.pb.js for PB 0.36 JSVM scope isolation.

// toIsoString — formats a Date as PocketBase datetime string
function toIsoString(date) {
  return date.toISOString().replace("T", " ").slice(0, 23) + "Z"
}

// nowIsoString — current UTC time as PB datetime string
function nowIso() {
  return toIsoString(new Date())
}

// plusDaysIso — UTC time N days from now as PB datetime string
function plusDaysIso(days) {
  return toIsoString(new Date(new Date().getTime() + days * 24 * 60 * 60 * 1000))
}

module.exports = {
  toIsoString: toIsoString,
  nowIso: nowIso,
  plusDaysIso: plusDaysIso,
}
