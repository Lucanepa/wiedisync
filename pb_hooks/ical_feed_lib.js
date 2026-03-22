// iCal feed logic — loaded via require() from ical_feed.pb.js

function pad(n) {
  return String(n).padStart(2, "0")
}

function formatUTC(d) {
  return d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()) +
    "T" + pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + pad(d.getUTCSeconds()) + "Z"
}

function formatDateOnly(dateStr) {
  return String(dateStr).replace(/-/g, "").slice(0, 8)
}

function isoDate(d) {
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate())
}

function formatLocal(dateStr, timeStr) {
  dateStr = String(dateStr)
  var parts = String(timeStr).split(":")
  return dateStr.replace(/-/g, "").slice(0, 8) + "T" + pad(parseInt(parts[0])) + pad(parseInt(parts[1])) + "00"
}

function formatLocalOffset(dateStr, timeStr, hours) {
  dateStr = String(dateStr)
  var parts = String(timeStr).split(":")
  var h = parseInt(parts[0]) + hours
  return dateStr.replace(/-/g, "").slice(0, 8) + "T" + pad(h) + pad(parseInt(parts[1])) + "00"
}

function escapeICal(text) {
  return String(text).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n")
}

// PB 0.36 JSVM returns date/time fields as objects, not strings — coerce safely
function str(val) {
  if (!val) return ""
  return String(val)
}

function handleICalFeed(e, sportFilter) {
  var sourceParam = e.request.url.query().get("source") || ""
  var teamParam = e.request.url.query().get("team") || ""

  // Parse sources — default to all games
  var sources = {}
  if (sourceParam) {
    var parts = sourceParam.split(",")
    for (var i = 0; i < parts.length; i++) {
      sources[parts[i].trim()] = true
    }
  } else {
    sources["games-home"] = true
    sources["games-away"] = true
  }

  var wantHome = !!sources["games-home"]
  var wantAway = !!sources["games-away"]
  var wantTrainings = !!sources["trainings"]
  var wantEvents = !!sources["events"]
  var wantClosures = !!sources["closures"]
  var wantHall = !!sources["hall"]

  // Parse and validate team IDs (must be 15-char alphanumeric PocketBase IDs)
  var pbIdPattern = /^[a-z0-9]{15}$/i
  var teamIds = []
  if (teamParam) {
    var tParts = teamParam.split(",")
    for (var i = 0; i < tParts.length; i++) {
      var tid = tParts[i].trim()
      if (tid && pbIdPattern.test(tid)) teamIds.push(tid)
    }
  }

  // Sport filter — look up all team IDs for the given sport
  if (sportFilter === "volleyball" || sportFilter === "basketball") {
    var sportTeams = $app.findRecordsByFilter("teams", 'sport = "' + sportFilter + '"', "", 0, 0)
    var sportTeamIds = []
    for (var i = 0; i < sportTeams.length; i++) {
      sportTeamIds.push(sportTeams[i].id)
    }
    // If team param was also provided, intersect; otherwise use all sport teams
    if (teamIds.length > 0) {
      var intersection = []
      for (var i = 0; i < teamIds.length; i++) {
        for (var j = 0; j < sportTeamIds.length; j++) {
          if (teamIds[i] === sportTeamIds[j]) {
            intersection.push(teamIds[i])
            break
          }
        }
      }
      teamIds = intersection
    } else {
      teamIds = sportTeamIds
    }
  }

  var calName = "KSCW - Kalender"
  if (sportFilter === "volleyball") calName = "KSCW - Volleyball"
  if (sportFilter === "basketball") calName = "KSCW - Basketball"

  var lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//KSCW Volley//Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:" + calName,
    "X-WR-TIMEZONE:Europe/Zurich",
    "REFRESH-INTERVAL;VALUE=DURATION:PT6H",
    "X-PUBLISHED-TTL:PT6H",
  ]

  var now = formatUTC(new Date())

  // ── Games ──
  if (wantHome || wantAway) {
    var gameFilter = ""
    if (teamIds.length > 0) {
      var clauses = []
      for (var i = 0; i < teamIds.length; i++) {
        clauses.push('kscw_team = "' + teamIds[i] + '"')
      }
      gameFilter = "(" + clauses.join(" || ") + ")"
    }
    if (wantHome && !wantAway) {
      gameFilter = gameFilter ? gameFilter + ' && type = "home"' : 'type = "home"'
    } else if (wantAway && !wantHome) {
      gameFilter = gameFilter ? gameFilter + ' && type = "away"' : 'type = "away"'
    }

    var games = $app.findRecordsByFilter("games", gameFilter, "date,time", 0, 0)

    for (var i = 0; i < games.length; i++) {
      var g = games[i]
      var date = str(g.get("date"))
      var time = str(g.get("time"))
      var homeTeam = g.get("home_team") || ""
      var awayTeam = g.get("away_team") || ""
      var league = g.get("league") || ""
      var status = g.get("status") || ""
      var homeScore = g.get("home_score") || 0
      var awayScore = g.get("away_score") || 0

      if (!date) continue

      var title = homeTeam + " - " + awayTeam
      if (status === "completed") {
        title += " (" + homeScore + ":" + awayScore + ")"
      }

      var desc = league
      if (status === "postponed") desc += " [VERSCHOBEN]"

      lines.push("BEGIN:VEVENT")
      lines.push("UID:" + g.id + "@kscw.ch")
      lines.push("DTSTAMP:" + now)

      if (time) {
        lines.push("DTSTART;TZID=Europe/Zurich:" + formatLocal(date, time))
        lines.push("DTEND;TZID=Europe/Zurich:" + formatLocalOffset(date, time, 2))
      } else {
        lines.push("DTSTART;VALUE=DATE:" + formatDateOnly(date))
        var next = new Date(date)
        next.setDate(next.getDate() + 1)
        lines.push("DTEND;VALUE=DATE:" + formatDateOnly(isoDate(next)))
      }

      lines.push("SUMMARY:" + escapeICal(title))
      if (desc) lines.push("DESCRIPTION:" + escapeICal(desc))
      lines.push("END:VEVENT")
    }
  }

  // ── Trainings ──
  if (wantTrainings) {
    var trainFilter = ""
    if (teamIds.length > 0) {
      var clauses = []
      for (var i = 0; i < teamIds.length; i++) {
        clauses.push('team = "' + teamIds[i] + '"')
      }
      trainFilter = "(" + clauses.join(" || ") + ")"
    }

    var trainings = $app.findRecordsByFilter("trainings", trainFilter, "date,start_time", 0, 0)

    for (var i = 0; i < trainings.length; i++) {
      var tr = trainings[i]
      var date = str(tr.get("date"))
      var startTime = str(tr.get("start_time"))
      var endTime = str(tr.get("end_time"))
      var cancelled = tr.get("cancelled")
      var cancelReason = tr.get("cancel_reason") || ""

      if (!date) continue

      var teamName = ""
      try {
        var teamRec = $app.findRecordById("teams", tr.get("team"))
        teamName = teamRec.get("name")
      } catch(err) {}

      var title = "Training" + (teamName ? " " + teamName : "")
      var desc = ""
      if (cancelled) {
        title = "[ABGESAGT] " + title
        desc = cancelReason
      }

      lines.push("BEGIN:VEVENT")
      lines.push("UID:training-" + tr.id + "@kscw.ch")
      lines.push("DTSTAMP:" + now)

      if (startTime) {
        lines.push("DTSTART;TZID=Europe/Zurich:" + formatLocal(date, startTime))
        if (endTime) {
          lines.push("DTEND;TZID=Europe/Zurich:" + formatLocal(date, endTime))
        } else {
          lines.push("DTEND;TZID=Europe/Zurich:" + formatLocalOffset(date, startTime, 2))
        }
      } else {
        lines.push("DTSTART;VALUE=DATE:" + formatDateOnly(date))
        var next = new Date(date)
        next.setDate(next.getDate() + 1)
        lines.push("DTEND;VALUE=DATE:" + formatDateOnly(isoDate(next)))
      }

      lines.push("SUMMARY:" + escapeICal(title))
      if (desc) lines.push("DESCRIPTION:" + escapeICal(desc))
      lines.push("END:VEVENT")
    }
  }

  // ── Events ──
  if (wantEvents) {
    var events = $app.findRecordsByFilter("events", "", "start_date", 0, 0)

    for (var i = 0; i < events.length; i++) {
      var ev = events[i]
      var startDate = str(ev.get("start_date"))
      var endDate = str(ev.get("end_date"))
      var allDay = ev.get("all_day")
      var evTitle = ev.get("title") || ""
      var location = ev.get("location") || ""
      var description = ev.get("description") || ""

      if (!startDate) continue

      var dateStr = startDate.split(" ")[0] || startDate.slice(0, 10)

      lines.push("BEGIN:VEVENT")
      lines.push("UID:event-" + ev.id + "@kscw.ch")
      lines.push("DTSTAMP:" + now)

      if (allDay) {
        lines.push("DTSTART;VALUE=DATE:" + formatDateOnly(dateStr))
        if (endDate) {
          var endDateStr = endDate.split(" ")[0] || endDate.slice(0, 10)
          var endNext = new Date(endDateStr)
          endNext.setDate(endNext.getDate() + 1)
          lines.push("DTEND;VALUE=DATE:" + formatDateOnly(isoDate(endNext)))
        } else {
          var next = new Date(dateStr)
          next.setDate(next.getDate() + 1)
          lines.push("DTEND;VALUE=DATE:" + formatDateOnly(isoDate(next)))
        }
      } else {
        var startTimeStr = startDate.split(" ")[1]
        if (startTimeStr) {
          startTimeStr = startTimeStr.slice(0, 5)
          lines.push("DTSTART;TZID=Europe/Zurich:" + formatLocal(dateStr, startTimeStr))
          var endTimeStr = endDate ? (endDate.split(" ")[1] || "").slice(0, 5) : ""
          if (endTimeStr) {
            var endDatePart = endDate.split(" ")[0] || endDate.slice(0, 10)
            lines.push("DTEND;TZID=Europe/Zurich:" + formatLocal(endDatePart, endTimeStr))
          } else {
            lines.push("DTEND;TZID=Europe/Zurich:" + formatLocalOffset(dateStr, startTimeStr, 2))
          }
        } else {
          lines.push("DTSTART;VALUE=DATE:" + formatDateOnly(dateStr))
          var next = new Date(dateStr)
          next.setDate(next.getDate() + 1)
          lines.push("DTEND;VALUE=DATE:" + formatDateOnly(isoDate(next)))
        }
      }

      lines.push("SUMMARY:" + escapeICal(evTitle))
      if (location) lines.push("LOCATION:" + escapeICal(location))
      if (description) lines.push("DESCRIPTION:" + escapeICal(description))
      lines.push("END:VEVENT")
    }
  }

  // ── Hall closures ──
  if (wantClosures) {
    var closures = $app.findRecordsByFilter("hall_closures", "", "start_date", 0, 0)

    for (var i = 0; i < closures.length; i++) {
      var cl = closures[i]
      var startDate = str(cl.get("start_date"))
      var endDate = str(cl.get("end_date"))
      var reason = cl.get("reason") || ""

      if (!startDate) continue

      var hallName = ""
      try {
        var hallRec = $app.findRecordById("halls", cl.get("hall"))
        hallName = hallRec.get("name")
      } catch(err) {}

      lines.push("BEGIN:VEVENT")
      lines.push("UID:closure-" + cl.id + "@kscw.ch")
      lines.push("DTSTAMP:" + now)
      lines.push("DTSTART;VALUE=DATE:" + formatDateOnly(startDate.slice(0, 10)))

      var endNext = new Date(endDate.slice(0, 10))
      endNext.setDate(endNext.getDate() + 1)
      lines.push("DTEND;VALUE=DATE:" + formatDateOnly(isoDate(endNext)))

      lines.push("SUMMARY:" + escapeICal("Hallensperrung" + (hallName ? ": " + hallName : "")))
      if (reason) lines.push("DESCRIPTION:" + escapeICal(reason))
      lines.push("END:VEVENT")
    }
  }

  // ── Hall events (GCal) ──
  if (wantHall) {
    var hallEvents = $app.findRecordsByFilter("hall_events", "", "date,start_time", 0, 0)

    for (var i = 0; i < hallEvents.length; i++) {
      var he = hallEvents[i]
      var date = str(he.get("date"))
      var startTime = str(he.get("start_time"))
      var endTime = str(he.get("end_time"))
      var allDay = he.get("all_day")
      var heTitle = he.get("title") || ""
      var location = he.get("location") || ""

      if (!date) continue

      lines.push("BEGIN:VEVENT")
      lines.push("UID:hall-" + he.id + "@kscw.ch")
      lines.push("DTSTAMP:" + now)

      if (allDay || !startTime) {
        lines.push("DTSTART;VALUE=DATE:" + formatDateOnly(date.slice(0, 10)))
        var next = new Date(date.slice(0, 10))
        next.setDate(next.getDate() + 1)
        lines.push("DTEND;VALUE=DATE:" + formatDateOnly(isoDate(next)))
      } else {
        lines.push("DTSTART;TZID=Europe/Zurich:" + formatLocal(date.slice(0, 10), startTime))
        if (endTime) {
          lines.push("DTEND;TZID=Europe/Zurich:" + formatLocal(date.slice(0, 10), endTime))
        } else {
          lines.push("DTEND;TZID=Europe/Zurich:" + formatLocalOffset(date.slice(0, 10), startTime, 2))
        }
      }

      lines.push("SUMMARY:" + escapeICal(heTitle))
      if (location) lines.push("LOCATION:" + escapeICal(location))
      lines.push("END:VEVENT")
    }
  }

  lines.push("END:VCALENDAR")

  var body = lines.join("\r\n")
  e.response.header().set("Content-Type", "text/calendar; charset=utf-8")
  var filename = "kscw"
  if (sportFilter === "volleyball") filename = "kscw-volleyball"
  if (sportFilter === "basketball") filename = "kscw-basketball"
  e.response.header().set("Content-Disposition", 'inline; filename="' + filename + '.ics"')
  e.response.header().set("Cache-Control", "public, max-age=3600")
  return e.string(200, body)
}

module.exports = {
  handleICalFeed: handleICalFeed,
}
