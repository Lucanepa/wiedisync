/// <reference path="../node_modules/pocketbase/dist/pocketbase.d.ts" />

// Public iCal feed endpoint: GET /api/ical
// Returns KSCW calendar events as an iCalendar (.ics) feed for subscriptions.
//
// Query params (all optional):
//   source  — comma-separated: games-home,games-away,trainings,events,closures,hall
//   team    — comma-separated team record IDs to filter games/trainings
//   sport   — "volleyball" or "basketball" to filter by sport
//
// Convenience routes:
//   /api/ical/volleyball  → games for volleyball teams only
//   /api/ical/basketball  → games for basketball teams only

routerAdd("GET", "/api/ical/volleyball", function(e) {
  var lib = require(__hooks + "/ical_feed_lib.js")
  return lib.handleICalFeed(e, "volleyball")
})

routerAdd("GET", "/api/ical/basketball", function(e) {
  var lib = require(__hooks + "/ical_feed_lib.js")
  return lib.handleICalFeed(e, "basketball")
})

routerAdd("GET", "/api/ical", function(e) {
  var lib = require(__hooks + "/ical_feed_lib.js")
  var sportParam = e.request.url.query().get("sport") || ""
  return lib.handleICalFeed(e, sportParam)
})
