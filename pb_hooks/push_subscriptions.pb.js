/// <reference path="../pb_data/types.d.ts" />

// ─── Push Subscriptions ───
// API endpoints for managing Web Push subscriptions.
// - POST /api/web-push/subscribe — register a push subscription
// - POST /api/web-push/unsubscribe — remove a push subscription
// - GET /api/web-push/vapid-public-key — get the VAPID public key
// - POST /api/web-push/test — send a test push (superuser only)

// ── GET /api/web-push/vapid-public-key ──────────────────────────────────

routerAdd("GET", "/api/web-push/vapid-public-key", function(e) {
  // VAPID public key — safe to expose publicly (must be inside callback for goja scope)
  var key = "BKJqU0d09bzpCWv6Goq-_24NxBLHHwGkjrUrRQsyIDoECVIE5nBBFw8g3j_hjBRhOlJL2YU72b_5R_SxFedMBQs"
  return e.json(200, { publicKey: key })
})

// ── POST /api/web-push/subscribe ────────────────────────────────────────

routerAdd("POST", "/api/web-push/subscribe", function(e) {
  var auth = e.requestInfo().auth
  if (!auth) throw new ForbiddenError("Authentication required")

  var body = e.requestInfo().body
  var endpoint = body.endpoint || ""
  var p256dh = body.keys_p256dh || ""
  var authKey = body.keys_auth || ""

  if (!endpoint || !p256dh || !authKey) {
    throw new BadRequestError("endpoint, keys_p256dh, and keys_auth are required")
  }

  // Check if subscription already exists (by endpoint)
  var existing = []
  try {
    existing = $app.findRecordsByFilter(
      "push_subscriptions",
      'endpoint = "' + endpoint.replace(/"/g, '\\"') + '"',
      "", 1, 0
    )
  } catch (_) {}

  if (existing.length > 0) {
    // Update existing subscription (may have changed keys or member)
    var record = existing[0]
    record.set("member", auth.id)
    record.set("keys_p256dh", p256dh)
    record.set("keys_auth", authKey)
    record.set("user_agent", body.user_agent || "")
    record.set("active", true)
    $app.save(record)
    console.log("[push] Updated subscription for member " + auth.id)
    return e.json(200, { success: true, updated: true })
  }

  // Create new subscription
  var collection = $app.findCollectionByNameOrId("push_subscriptions")
  var record = new Record(collection)
  record.set("member", auth.id)
  record.set("endpoint", endpoint)
  record.set("keys_p256dh", p256dh)
  record.set("keys_auth", authKey)
  record.set("user_agent", body.user_agent || "")
  record.set("active", true)
  $app.save(record)

  console.log("[push] New subscription for member " + auth.id)
  return e.json(201, { success: true, created: true })
}, $apis.requireAuth())

// ── POST /api/web-push/unsubscribe ──────────────────────────────────────

routerAdd("POST", "/api/web-push/unsubscribe", function(e) {
  var auth = e.requestInfo().auth
  if (!auth) throw new ForbiddenError("Authentication required")

  var body = e.requestInfo().body
  var endpoint = body.endpoint || ""

  if (!endpoint) {
    throw new BadRequestError("endpoint is required")
  }

  try {
    var records = $app.findRecordsByFilter(
      "push_subscriptions",
      'endpoint = "' + endpoint.replace(/"/g, '\\"') + '" && member = "' + auth.id + '"',
      "", 1, 0
    )
    if (records.length > 0) {
      $app.delete(records[0])
      console.log("[push] Unsubscribed member " + auth.id)
    }
  } catch (_) {}

  return e.json(200, { success: true })
}, $apis.requireAuth())

// ── POST /api/web-push/test — send test push to yourself (superuser) ────

routerAdd("POST", "/api/web-push/test", function(e) {
  var pushLib = require(__hooks + "/push_lib.js")
  var auth = e.requestInfo().auth
  var body = e.requestInfo().body
  var memberId = body.member_id || (auth ? auth.id : "")

  if (!memberId) throw new BadRequestError("member_id is required")

  var result = pushLib.sendPushToMember(
    memberId,
    body.title || "Test Push",
    body.body || "This is a test notification from KSC Wiedikon.",
    body.url || "https://kscw.lucanepa.com",
    "test"
  )

  console.log("[push] Test push to " + memberId + ": " + JSON.stringify(result))
  return e.json(200, result)
}, $apis.requireSuperuserAuth())
