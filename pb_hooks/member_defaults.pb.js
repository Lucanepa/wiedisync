/// <reference path="../pb_data/types.d.ts" />

// ── Member defaults: ensure required fields are set on create ──
// Catches members created via any path (signup form, OAuth, admin panel, API).

onRecordCreateRequest("members", function (e) {
  var record = e.record

  // Default birthdate_visibility to 'hidden'
  if (!record.getString("birthdate_visibility")) {
    record.set("birthdate_visibility", "hidden")
  }

  // Default role to ['user'] if empty
  var role = record.get("role")
  if (!role || (Array.isArray(role) && role.length === 0)) {
    record.set("role", ["user"])
  }

  e.next()
})
