/// <reference path="../pb_data/types.d.ts" />

// ─── Web Push Library ───
// Sends push notifications via Cloudflare Worker.
// Usage: var pushLib = require(__hooks + "/push_lib.js")
//        pushLib.sendPush(memberId, title, body, url, tag)

// Configuration — update after deploying the CF Worker
var PUSH_WORKER_URL = "https://kscw-push.lucanepa.workers.dev"
var _secrets = JSON.parse(String.fromCharCode.apply(null, new Uint8Array($os.readFile(__hooks + "/secrets.json"))))
var PUSH_AUTH_SECRET = _secrets.PUSH_AUTH_SECRET

/**
 * Send push notification to all active subscriptions for a member.
 * Silently skips if member has no subscriptions.
 * Returns { sent: number, failed: number, cleaned: number }
 */
function sendPushToMember(memberId, title, body, url, tag) {
  if (!memberId) return { sent: 0, failed: 0, cleaned: 0 }

  var subscriptions = []
  try {
    subscriptions = $app.findRecordsByFilter(
      "push_subscriptions",
      'member = "' + memberId + '" && active = true',
      "", 10, 0
    )
  } catch (e) {
    // No subscriptions found — that's fine
    return { sent: 0, failed: 0, cleaned: 0 }
  }

  if (subscriptions.length === 0) return { sent: 0, failed: 0, cleaned: 0 }

  // Build subscription payload for the worker
  var subs = []
  for (var i = 0; i < subscriptions.length; i++) {
    subs.push({
      endpoint: subscriptions[i].getString("endpoint"),
      keys: {
        p256dh: subscriptions[i].getString("keys_p256dh"),
        auth: subscriptions[i].getString("keys_auth"),
      },
    })
  }

  var result = { sent: 0, failed: 0, cleaned: 0 }

  try {
    var resp = $http.send({
      url: PUSH_WORKER_URL + "/push",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + PUSH_AUTH_SECRET,
      },
      body: JSON.stringify({
        subscriptions: subs,
        title: title || "KSC Wiedikon",
        body: body || "",
        url: url || "https://kscw.lucanepa.com",
        tag: tag || undefined,
      }),
      timeout: 10000,
    })

    if (resp.statusCode === 200) {
      var data = JSON.parse(resp.raw)
      result.sent = data.sent || 0
      result.failed = data.failed || 0

      // Clean up expired subscriptions reported by the worker
      if (data.expired && data.expired.length > 0) {
        for (var e = 0; e < data.expired.length; e++) {
          cleanupExpiredSubscription(data.expired[e])
          result.cleaned++
        }
      }
    } else {
      console.log("[push] Worker returned " + resp.statusCode + ": " + resp.raw)
    }
  } catch (err) {
    console.log("[push] Failed to call push worker: " + err)
  }

  return result
}

/**
 * Send push notification to multiple members at once.
 * Batches all subscriptions into a single worker request.
 */
function sendPushToMembers(memberIds, title, body, url, tag) {
  if (!memberIds || memberIds.length === 0) return { sent: 0, failed: 0, cleaned: 0 }

  // Build member filter
  var filters = []
  for (var i = 0; i < memberIds.length; i++) {
    filters.push('member = "' + memberIds[i] + '"')
  }

  var subscriptions = []
  try {
    subscriptions = $app.findRecordsByFilter(
      "push_subscriptions",
      '(' + filters.join(' || ') + ') && active = true',
      "", 200, 0
    )
  } catch (e) {
    return { sent: 0, failed: 0, cleaned: 0 }
  }

  if (subscriptions.length === 0) return { sent: 0, failed: 0, cleaned: 0 }

  var subs = []
  for (var j = 0; j < subscriptions.length; j++) {
    subs.push({
      endpoint: subscriptions[j].getString("endpoint"),
      keys: {
        p256dh: subscriptions[j].getString("keys_p256dh"),
        auth: subscriptions[j].getString("keys_auth"),
      },
    })
  }

  var result = { sent: 0, failed: 0, cleaned: 0 }

  try {
    var resp = $http.send({
      url: PUSH_WORKER_URL + "/push",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + PUSH_AUTH_SECRET,
      },
      body: JSON.stringify({
        subscriptions: subs,
        title: title || "KSC Wiedikon",
        body: body || "",
        url: url || "https://kscw.lucanepa.com",
        tag: tag || undefined,
      }),
      timeout: 15000,
    })

    if (resp.statusCode === 200) {
      var data = JSON.parse(resp.raw)
      result.sent = data.sent || 0
      result.failed = data.failed || 0

      if (data.expired && data.expired.length > 0) {
        for (var e = 0; e < data.expired.length; e++) {
          cleanupExpiredSubscription(data.expired[e])
          result.cleaned++
        }
      }
    } else {
      console.log("[push] Worker returned " + resp.statusCode)
    }
  } catch (err) {
    console.log("[push] Failed to call push worker for batch: " + err)
  }

  return result
}

/**
 * Remove an expired/invalid subscription from the database.
 */
function cleanupExpiredSubscription(endpoint) {
  try {
    var records = $app.findRecordsByFilter(
      "push_subscriptions",
      'endpoint = "' + endpoint.replace(/"/g, '\\"') + '"',
      "", 1, 0
    )
    if (records.length > 0) {
      $app.delete(records[0])
      console.log("[push] Cleaned up expired subscription: " + endpoint.slice(0, 60) + "...")
    }
  } catch (e) {
    console.log("[push] Failed to cleanup subscription: " + e)
  }
}

module.exports = {
  sendPushToMember: sendPushToMember,
  sendPushToMembers: sendPushToMembers,
  PUSH_WORKER_URL: PUSH_WORKER_URL,
}
