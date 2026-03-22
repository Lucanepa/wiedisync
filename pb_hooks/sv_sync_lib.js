// Shared Swiss Volley sync logic — loaded via require() from hooks

var SV_API_BASE = "https://api.volleyball.ch"
var SV_API_KEY = $os.getenv("SV_API_KEY")

var SV_TEAM_IDS = {
  "12747": "H3",
  "2743":  "H1",
  "541":   "H2",
  "1395":  "D1",
  "1393":  "D2",
  "4689":  "D3",
  "1394":  "D4",
  "7563":  "HU23-1",
  "2301":  "DU23-1",
  "14040": "DU23-2",
  "6023":  "Legends",
}

function isKscwTeamId(id) {
  return SV_TEAM_IDS.hasOwnProperty(String(id))
}

function deriveSeason(dateStr) {
  var d = new Date(dateStr)
  var year = d.getFullYear()
  var month = d.getMonth()
  if (month < 8) {
    return (year - 1) + "/" + String(year).slice(2)
  }
  return year + "/" + String(year + 1).slice(2)
}

function parsePlayDate(playDate) {
  var parts = playDate.split(" ")
  return {
    date: parts[0] || "",
    time: parts[1] ? parts[1].slice(0, 5) : "",
  }
}

function mapSetResults(setResults) {
  if (!setResults) return []
  if (Array.isArray(setResults)) {
    var result = []
    for (var i = 0; i < setResults.length; i++) {
      var s = setResults[i]
      result.push({
        home: s.home || s.Home || 0,
        away: s.away || s.Away || 0,
      })
    }
    return result
  }
  if (typeof setResults === "object") {
    var keys = Object.keys(setResults).sort()
    var result = []
    for (var i = 0; i < keys.length; i++) {
      var s = setResults[keys[i]]
      result.push({
        home: (s && s.home) || (s && s.Home) || 0,
        away: (s && s.away) || (s && s.Away) || 0,
      })
    }
    return result
  }
  return []
}

function determineStatus(game) {
  var rs = game.resultSummary
  if (rs && rs.winner && rs.winner !== "") return "completed"
  return "scheduled"
}

function buildTeamLookup() {
  var lookup = {}
  var teams = $app.findRecordsByFilter("teams", "team_id != ''", "", 0, 0)
  for (var i = 0; i < teams.length; i++) {
    var t = teams[i]
    lookup[t.get("team_id")] = t.id
  }
  return lookup
}

function buildHallLookup() {
  var lookup = {}
  var halls = $app.findRecordsByFilter("halls", "sv_hall_id != ''", "", 0, 0)
  for (var i = 0; i < halls.length; i++) {
    var h = halls[i]
    lookup[h.get("sv_hall_id")] = h.id
  }
  return lookup
}

function mapReferees(refs) {
  if (!refs || typeof refs !== "object") return []
  var keys = Object.keys(refs).sort()
  var result = []
  for (var i = 0; i < keys.length; i++) {
    var r = refs[keys[i]]
    if (r && (r.firstName || r.lastName)) {
      result.push({
        name: ((r.firstName || "") + " " + (r.lastName || "")).trim(),
        id: r.refereeId || null,
      })
    }
  }
  return result
}

function buildCaptionLookups() {
  var res = $http.send({
    url: SV_API_BASE + "/indoor/games",
    method: "GET",
    headers: { "Authorization": SV_API_KEY },
  })

  var lookups = { groups: {}, leagues: {}, phases: {} }
  if (res.statusCode !== 200 || !Array.isArray(res.json)) return lookups

  for (var i = 0; i < res.json.length; i++) {
    var g = res.json[i]
    var league = g.league || {}
    var phase = g.phase || {}
    var group = g.group || {}
    if (league.leagueId) lookups.leagues[league.leagueId] = league.caption || ""
    if (phase.phaseId) lookups.phases[phase.phaseId] = phase.caption || ""
    if (group.groupId) lookups.groups[group.groupId] = group.caption || ""
  }
  return lookups
}

function syncGames() {
  console.log("[SV Sync] Fetching games from Swiss Volley API...")

  var res = $http.send({
    url: SV_API_BASE + "/indoor/games",
    method: "GET",
    headers: { "Authorization": SV_API_KEY },
  })

  if (res.statusCode !== 200) {
    console.log("[SV Sync] Games API returned status " + res.statusCode)
    return
  }

  var allGames = res.json
  if (!Array.isArray(allGames)) {
    console.log("[SV Sync] Unexpected games response format")
    return
  }

  var kscwGames = []
  for (var i = 0; i < allGames.length; i++) {
    var g = allGames[i]
    var homeId = String(g.teams.home.teamId)
    var awayId = String(g.teams.away.teamId)
    if (isKscwTeamId(homeId) || isKscwTeamId(awayId)) {
      kscwGames.push(g)
    }
  }

  console.log("[SV Sync] Found " + kscwGames.length + " KSCW games out of " + allGames.length + " total")

  var teamLookup = buildTeamLookup()
  var hallLookup = buildHallLookup()
  var gamesCol = $app.findCollectionByNameOrId("games")

  var created = 0
  var updated = 0
  var errors = 0

  for (var i = 0; i < kscwGames.length; i++) {
    try {
      var g = kscwGames[i]
      var gameId = String(g.gameId)
      var home = g.teams.home
      var away = g.teams.away
      var homeId = String(home.teamId)
      var awayId = String(away.teamId)

      var parsed = parsePlayDate(g.playDate)
      var resultSummary = g.resultSummary || {}

      var isHome = isKscwTeamId(homeId)
      var kscwSvId = isHome ? homeId : awayId
      var kscwTeamPbId = teamLookup["vb_" + kscwSvId] || ""

      // Link hall relation for home games; store away hall as JSON
      var hallPbId = ""
      var awayHallJson = null
      if (g.hall && g.hall.hallId) {
        if (isHome) {
          hallPbId = hallLookup[String(g.hall.hallId)] || ""
        } else {
          var street = g.hall.street || ""
          var num = g.hall.number || ""
          awayHallJson = {
            name: g.hall.caption || "",
            address: num ? (street + " " + num) : street,
            city: g.hall.city || "",
            plus_code: g.hall.plusCode || "",
          }
        }
      }

      var homeScore = resultSummary.wonSetsHomeTeam || 0
      var awayScore = resultSummary.wonSetsAwayTeam || 0
      var setsJson = mapSetResults(g.setResults)
      var status = determineStatus(g)
      var referees = mapReferees(g.referees)

      var record
      var isUpdate = false
      try {
        record = $app.findFirstRecordByData("games", "game_id", "vb_" + gameId)
        isUpdate = true
        updated++
      } catch (e) {
        record = new Record(gamesCol)
        created++
      }

      // Auto-adjust respond_by when game date changes (preserve offset)
      if (isUpdate) {
        var oldDate = record.getString("date")
        var respondBy = record.getString("respond_by")
        if (respondBy && oldDate && oldDate !== parsed.date) {
          var oldMs = new Date(oldDate).getTime()
          var rbMs = new Date(respondBy.split(" ")[0]).getTime()
          var offsetMs = oldMs - rbMs
          var newGameMs = new Date(parsed.date).getTime()
          var newRb = new Date(newGameMs - offsetMs)
          var yyyy = newRb.getFullYear()
          var mm = String(newRb.getMonth() + 1).padStart(2, "0")
          var dd = String(newRb.getDate()).padStart(2, "0")
          record.set("respond_by", yyyy + "-" + mm + "-" + dd)
          console.log("[SV Sync] Game vb_" + gameId + " date changed " + oldDate + " -> " + parsed.date + ", respond_by adjusted to " + yyyy + "-" + mm + "-" + dd)
        }
      }

      record.set("game_id", "vb_" + gameId)
      record.set("home_team", home.caption || "")
      record.set("away_team", away.caption || "")
      record.set("kscw_team", kscwTeamPbId)
      record.set("hall", hallPbId)
      record.set("away_hall_json", awayHallJson)
      record.set("date", parsed.date)
      record.set("time", parsed.time)
      record.set("league", g.group.caption || g.phase.caption || g.league.caption || "")
      record.set("round", g.group.caption || "")
      record.set("season", deriveSeason(g.playDate))
      record.set("type", isHome ? "home" : "away")
      record.set("status", status)
      record.set("home_score", homeScore)
      record.set("away_score", awayScore)
      record.set("sets_json", setsJson)
      record.set("referees_json", referees)
      record.set("source", "swiss_volley")

      $app.save(record)
    } catch (e) {
      errors++
      console.log("[SV Sync] Error processing game " + (kscwGames[i].gameId) + ": " + e)
    }
  }

  console.log("[SV Sync] Games sync complete: " + created + " created, " + updated + " updated, " + errors + " errors")
}

function syncRankings() {
  console.log("[SV Sync] Fetching rankings from Swiss Volley API...")

  var res = $http.send({
    url: SV_API_BASE + "/indoor/ranking",
    method: "GET",
    headers: { "Authorization": SV_API_KEY },
  })

  if (res.statusCode !== 200) {
    console.log("[SV Sync] Rankings API returned status " + res.statusCode)
    return
  }

  var allGroups = res.json
  if (!Array.isArray(allGroups)) {
    console.log("[SV Sync] Unexpected rankings response format")
    return
  }

  console.log("[SV Sync] Building caption lookups from games data...")
  var captions = buildCaptionLookups()

  var relevantGroups = []
  for (var i = 0; i < allGroups.length; i++) {
    var grp = allGroups[i]
    var ranking = grp.ranking || []
    var hasKscw = false
    for (var j = 0; j < ranking.length; j++) {
      if (isKscwTeamId(String(ranking[j].teamId || ""))) {
        hasKscw = true
        break
      }
    }
    if (hasKscw) {
      relevantGroups.push(grp)
    }
  }

  console.log("[SV Sync] Found " + relevantGroups.length + " relevant ranking groups out of " + allGroups.length + " total")

  var rankingsCol = $app.findCollectionByNameOrId("rankings")
  var now = new Date().toISOString()

  var created = 0
  var updated = 0
  var errors = 0

  for (var i = 0; i < relevantGroups.length; i++) {
    var grp = relevantGroups[i]

    var groupCaption = captions.groups[grp.groupId] || ""
    var phaseCaption = captions.phases[grp.phaseId] || ""
    var leagueCaption = captions.leagues[grp.leagueId] || ""

    var leagueStr = groupCaption || phaseCaption || leagueCaption || ("Group " + grp.groupId)

    var ranking = grp.ranking || []

    var nowDate = new Date()
    var yr = nowDate.getFullYear()
    var mo = nowDate.getMonth()
    var season = mo < 8
      ? (yr - 1) + "/" + String(yr).slice(2)
      : yr + "/" + String(yr + 1).slice(2)

    for (var j = 0; j < ranking.length; j++) {
      try {
        var r = ranking[j]
        var teamId = String(r.teamId || "")
        var teamCaption = r.teamCaption || ""

        var record
        try {
          record = $app.findFirstRecordByFilter(
            "rankings",
            "team_id = {:tid} && league = {:league}",
            { "tid": "vb_" + teamId, "league": leagueStr }
          )
          updated++
        } catch (e) {
          record = new Record(rankingsCol)
          created++
        }

        record.set("team_id", "vb_" + teamId)
        record.set("team_name", teamCaption)
        record.set("league", leagueStr)
        record.set("rank", r.rank || 0)
        record.set("played", r.games || 0)
        record.set("won", r.wins || 0)
        record.set("lost", r.defeats || 0)
        record.set("wins_clear", r.winsClear || 0)
        record.set("wins_narrow", r.winsNarrow || 0)
        record.set("defeats_clear", r.defeatsClear || 0)
        record.set("defeats_narrow", r.defeatsNarrow || 0)
        record.set("sets_won", r.setsWon || 0)
        record.set("sets_lost", r.setsLost || 0)
        record.set("points_won", r.ballsWon || 0)
        record.set("points_lost", r.ballsLost || 0)
        record.set("points", r.points || 0)
        record.set("season", season)
        record.set("updated_at", now)

        $app.save(record)
      } catch (e) {
        errors++
        console.log("[SV Sync] Error processing ranking entry: " + e)
      }
    }
  }

  console.log("[SV Sync] Rankings sync complete: " + created + " created, " + updated + " updated, " + errors + " errors")
}

module.exports = {
  syncGames: syncGames,
  syncRankings: syncRankings,
}
