// Google Calendar ICS → PocketBase sync logic
// Fetches the public ICS feed, parses events, skips volleyball (VB prefix),
// and upserts non-volleyball events into the hall_events collection.

var GCAL_ICS_URL = "https://calendar.google.com/calendar/ical/145bqacb4v5qfkr97u2fdchi5o%40group.calendar.google.com/public/basic.ics"

// Zurich offset: UTC+1 (winter) or UTC+2 (summer)
// Approximate CET/CEST rules: last Sunday of March to last Sunday of October
function zurichOffset(date) {
  var y = date.getUTCFullYear()
  // Last Sunday of March
  var mar = new Date(Date.UTC(y, 2, 31))
  while (mar.getUTCDay() !== 0) mar.setUTCDate(mar.getUTCDate() - 1)
  mar.setUTCHours(1, 0, 0, 0) // transition at 01:00 UTC
  // Last Sunday of October
  var oct = new Date(Date.UTC(y, 9, 31))
  while (oct.getUTCDay() !== 0) oct.setUTCDate(oct.getUTCDate() - 1)
  oct.setUTCHours(1, 0, 0, 0)
  if (date >= mar && date < oct) return 2
  return 1
}

function utcToZurich(date) {
  var offset = zurichOffset(date)
  return new Date(date.getTime() + offset * 3600000)
}

function pad(n) {
  return String(n).padStart(2, "0")
}

// Parse ICS datetime: "20260109T190000Z" or "20260109T190000"
function parseIcsDatetime(str) {
  if (!str) return null
  // Remove any timezone prefix like TZID=...:
  var val = str
  var colonIdx = val.lastIndexOf(":")
  if (colonIdx > 0) val = val.substring(colonIdx + 1)
  val = val.trim()

  // DATE only format: 20260109
  if (val.length === 8) {
    var y = parseInt(val.substring(0, 4))
    var m = parseInt(val.substring(4, 6)) - 1
    var d = parseInt(val.substring(6, 8))
    return { date: new Date(y, m, d), dateOnly: true }
  }

  // DATETIME format: 20260109T190000Z or 20260109T190000
  var isUtc = val.charAt(val.length - 1) === "Z"
  if (isUtc) val = val.substring(0, val.length - 1)

  var yr = parseInt(val.substring(0, 4))
  var mo = parseInt(val.substring(4, 6)) - 1
  var dy = parseInt(val.substring(6, 8))
  var hr = parseInt(val.substring(9, 11))
  var mi = parseInt(val.substring(11, 13))
  var se = parseInt(val.substring(13, 15)) || 0

  if (isUtc) {
    return { date: new Date(Date.UTC(yr, mo, dy, hr, mi, se)), dateOnly: false }
  }
  // Already local time (e.g. Europe/Zurich)
  return { date: new Date(yr, mo, dy, hr, mi, se), dateOnly: false, isLocal: true }
}

// Parse a simple ICS text into VEVENT objects
function parseIcs(text) {
  var events = []
  var lines = text.replace(/\r\n /g, "").replace(/\r\n\t/g, "").split(/\r?\n/)

  var inEvent = false
  var current = null

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i]
    if (line === "BEGIN:VEVENT") {
      inEvent = true
      current = {}
      continue
    }
    if (line === "END:VEVENT") {
      if (current) events.push(current)
      inEvent = false
      current = null
      continue
    }
    if (!inEvent || !current) continue

    // Parse property: NAME;PARAMS:VALUE or NAME:VALUE
    var sepIdx = line.indexOf(":")
    if (sepIdx < 0) continue
    var key = line.substring(0, sepIdx)
    var value = line.substring(sepIdx + 1)

    // Normalize key (strip params for matching)
    var baseName = key.split(";")[0]

    if (baseName === "DTSTART") current.dtstart = line
    else if (baseName === "DTEND") current.dtend = line
    else if (baseName === "SUMMARY") current.summary = unescapeIcal(value)
    else if (baseName === "LOCATION") current.location = unescapeIcal(value)
    else if (baseName === "UID") current.uid = value
    else if (baseName === "DESCRIPTION") current.description = unescapeIcal(value)
  }

  return events
}

function unescapeIcal(text) {
  return text.replace(/\\n/g, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\")
}

// Resolve hall ID(s) from event title/location
// Returns array of hall IDs (may be multiple for "A+B" or "all halls" scenarios)
function resolveHalls(title, location) {
  var text = ((title || "") + " " + (location || "")).toLowerCase()

  // Specific hall references in location field
  if (location) {
    var loc = location.trim().toLowerCase()
    if (loc === "halle a") return ["KWI A"]
    if (loc === "halle b") return ["KWI B"]
    if (loc === "halle c") return ["KWI C"]
    if (loc === "halle a+b" || loc === "halle b+a") return ["KWI A", "KWI B"]
    if (loc === "halle a+b+c" || loc === "halle b+c" || loc === "halle a+c") return ["KWI A", "KWI B", "KWI C"]
  }

  // Check title for "Halle C" pattern
  if (/halle\s*c/i.test(text)) return ["KWI C"]
  if (/halle\s*b/i.test(text)) return ["KWI B"]
  if (/halle\s*a/i.test(text)) return ["KWI A"]

  // "Halle geschlossen", "KWI Turnhalle", or no specific hall → all KWI halls
  return ["KWI A", "KWI B", "KWI C"]
}

// Build hall name→ID map (loaded once per sync run)
var hallNameMap = null
function getHallId(hallName) {
  if (!hallNameMap) {
    hallNameMap = {}
    try {
      var halls = $app.findRecordsByFilter("halls", "", "", 0, 0)
      for (var i = 0; i < halls.length; i++) {
        hallNameMap[halls[i].get("name")] = halls[i].id
      }
      console.log("[GCal Sync] Loaded " + halls.length + " halls")
    } catch (e) {
      console.log("[GCal Sync] Error loading halls: " + e)
    }
  }
  return hallNameMap[hallName] || ""
}

function syncHallEvents() {
  console.log("[GCal Sync] Fetching ICS feed...")

  var res = $http.send({
    url: GCAL_ICS_URL,
    method: "GET",
  })

  if (res.statusCode !== 200) {
    console.log("[GCal Sync] ICS feed returned status " + res.statusCode)
    return
  }

  var icsText = String(res.raw)
  var allEvents = parseIcs(icsText)
  console.log("[GCal Sync] Parsed " + allEvents.length + " events from ICS feed")

  // Filter: skip volleyball events (title starts with "VB ")
  var nonVbEvents = []
  for (var i = 0; i < allEvents.length; i++) {
    var ev = allEvents[i]
    var summary = (ev.summary || "").trim()
    if (summary.substring(0, 3) === "VB ") continue
    nonVbEvents.push(ev)
  }
  console.log("[GCal Sync] " + nonVbEvents.length + " non-volleyball events to sync")

  // Only sync events from current season onwards (Sept 1 of current season)
  var now = new Date()
  var seasonYear = now.getMonth() < 8 ? now.getFullYear() - 1 : now.getFullYear()
  var cutoff = new Date(seasonYear, 8, 1) // Sept 1

  var col = $app.findCollectionByNameOrId("hall_events")
  var created = 0
  var updated = 0
  var errors = 0
  var skipped = 0
  var syncedUids = {}

  for (var i = 0; i < nonVbEvents.length; i++) {
    try {
      var ev = nonVbEvents[i]
      if (!ev.uid || !ev.dtstart) { skipped++; continue }

      var start = parseIcsDatetime(ev.dtstart)
      if (!start) { skipped++; continue }

      var startDate = start.date
      var isAllDay = start.dateOnly

      // Convert UTC to Zurich local for non-local, non-allday events
      var localStart = startDate
      if (!isAllDay && !start.isLocal) {
        localStart = utcToZurich(startDate)
      }

      // Skip events before cutoff
      if (localStart < cutoff) { skipped++; continue }

      var end = ev.dtend ? parseIcsDatetime(ev.dtend) : null
      var localEnd = null
      if (end && !end.dateOnly && !end.isLocal) {
        localEnd = utcToZurich(end.date)
      } else if (end && (end.dateOnly || end.isLocal)) {
        localEnd = end.date
      }

      // Format date as YYYY-MM-DD
      var dateStr = localStart.getFullYear() + "-" + pad(localStart.getMonth() + 1) + "-" + pad(localStart.getDate())
      var startTime = isAllDay ? "" : (pad(localStart.getHours()) + ":" + pad(localStart.getMinutes()))
      var endTime = (localEnd && !isAllDay) ? (pad(localEnd.getHours()) + ":" + pad(localEnd.getMinutes())) : ""

      syncedUids[ev.uid] = true

      var record
      try {
        record = $app.findFirstRecordByData("hall_events", "uid", ev.uid)
        updated++
      } catch (e) {
        record = new Record(col)
        created++
      }

      record.set("uid", ev.uid)
      record.set("title", ev.summary || "")
      record.set("date", dateStr)
      record.set("start_time", startTime)
      record.set("end_time", endTime)
      record.set("location", ev.location || "")
      record.set("all_day", isAllDay)
      record.set("source", "gcal")

      // Resolve hall relation(s) from title/location
      var hallNames = resolveHalls(ev.summary, ev.location)
      var hallIds = []
      for (var h = 0; h < hallNames.length; h++) {
        var hid = getHallId(hallNames[h])
        if (hid) hallIds.push(hid)
      }
      record.set("hall", hallIds)

      $app.save(record)
    } catch (e) {
      errors++
      console.log("[GCal Sync] Error processing event: " + e)
    }
  }

  // Clean up events that are no longer in the feed (deleted from Google Calendar)
  var deleted = 0
  try {
    var existing = $app.findRecordsByFilter("hall_events", 'source = "gcal"', "", 0, 0)
    for (var i = 0; i < existing.length; i++) {
      var r = existing[i]
      if (!syncedUids[r.get("uid")]) {
        $app.delete(r)
        deleted++
      }
    }
  } catch (e) {
    console.log("[GCal Sync] Error during cleanup: " + e)
  }

  console.log("[GCal Sync] Sync complete: " + created + " created, " + updated + " updated, " + deleted + " deleted, " + skipped + " skipped, " + errors + " errors")
}

module.exports = {
  syncHallEvents: syncHallEvents,
}
