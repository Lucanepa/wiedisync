// Basketplan sync logic — loaded via require() from hooks
// Fetches basketball games from basketplan.ch public XML API and syncs to PocketBase
// No auth needed — the XML endpoint is public

var BP_BASE = "https://www.basketplan.ch"
var BP_CLUB_ID = 166

var HALL_MAP = {
  "Kantonsschule Wiedikon 2fach": "KWI A",
  "Kantonsschule Wiedikon 1fach": "KWI C",
}

var STATUS_MAP = {
  "upcoming": "scheduled",
  "played": "completed",
  "postponed": "postponed",
  "cancelled": "postponed",
}

// ── XML parsing helpers ──────────────────────────────────────────────

function getAttr(xml, attr) {
  var re = new RegExp(attr + '="([^"]*)"')
  var m = xml.match(re)
  return m ? m[1] : ""
}

function fetchTeamXml(teamId) {
  var url = BP_BASE + "/findTeamById.do?teamId=" + teamId +
    "&clubId=" + BP_CLUB_ID + "&federationId=10&xmlView=true"

  var res = $http.send({
    url: url,
    method: "GET",
    headers: { "User-Agent": "KSCW-Sync/1.0" },
    timeout: 30000,
  })

  return res.raw || ""
}

function parseGames(teamXml, teamIdSet) {
  var games = []
  var gameBlocks = teamXml.split("<GameVO ").slice(1)

  for (var i = 0; i < gameBlocks.length; i++) {
    var block = gameBlocks[i]
    var fullBlock = block.split("</GameVO>")[0] || block
    var id = getAttr(fullBlock, " id")
    if (!id) continue

    var gameNumber = getAttr(fullBlock, "gameNumber")
    var yearMonthDay = getAttr(fullBlock, "yearMonthDay")
    var timeOfDay = getAttr(fullBlock, "timeOfDay")
    var withdrawn = getAttr(fullBlock, "withdrawn") === "true"

    // Home team
    var homeBlockMatch = fullBlock.match(/<homeTeam\s[^>]*\/>|<homeTeam\s[\s\S]*?<\/homeTeam>/)
    var homeBlock = homeBlockMatch ? homeBlockMatch[0] : ""
    var homeTeamName = getAttr(homeBlock, " name")
    var homeTeamId = getAttr(homeBlock, " id")

    // Guest team
    var guestBlockMatch = fullBlock.match(/<guestTeam\s[^>]*\/>|<guestTeam\s[\s\S]*?<\/guestTeam>/)
    var guestBlock = guestBlockMatch ? guestBlockMatch[0] : ""
    var guestTeamName = getAttr(guestBlock, " name")
    var guestTeamId = getAttr(guestBlock, " id")

    // Location
    var locBlockMatch = fullBlock.match(/<location\s[^>]*\/>|<location\s[\s\S]*?<\/location>/)
    var locBlock = locBlockMatch ? locBlockMatch[0] : ""
    var locName = getAttr(locBlock, " name") || getAttr(locBlock, "shortName")
    var locCity = getAttr(locBlock, "city")
    var locAddr = getAttr(locBlock, "line1")

    // League
    var lhBlockMatch = fullBlock.match(/<leagueHolding\s[\s\S]*?<\/leagueHolding>/)
    var lhBlock = lhBlockMatch ? lhBlockMatch[0] : ""
    var leagueBlockMatch = lhBlock.match(/<league\s[\s\S]*?<\/league>/)
    var leagueBlock = leagueBlockMatch ? leagueBlockMatch[0] : ""
    var leagueName = getAttr(leagueBlock, "shortName") || getAttr(lhBlock, "fullName")
    var seasonBlockMatch = lhBlock.match(/<season\s[^>]*\/>|<season\s[\s\S]*?<\/season>/)
    var seasonBlock = seasonBlockMatch ? seasonBlockMatch[0] : ""
    var seasonName = getAttr(seasonBlock, " name")

    // Score
    var resultBlockMatch = fullBlock.match(/<result\s[^>]*\/?>/)
    var resultBlock = resultBlockMatch ? resultBlockMatch[0] : ""
    var scoreHome = resultBlock ? getAttr(resultBlock, "homeTeamScore") : ""
    var scoreGuest = resultBlock ? getAttr(resultBlock, "guestTeamScore") : ""

    var rescheduleRequested = getAttr(fullBlock, "rescheduleRequested") === "true"
    var hasScore = scoreHome !== "" && scoreGuest !== ""
    var status = "upcoming"
    if (withdrawn) status = "cancelled"
    else if (rescheduleRequested) status = "postponed"
    else if (hasScore) status = "played"

    var isHome = teamIdSet[homeTeamId] === true

    games.push({
      id: id,
      gameNumber: gameNumber,
      date: yearMonthDay,
      time: timeOfDay,
      homeTeam: homeTeamName,
      homeTeamId: homeTeamId,
      guestTeam: guestTeamName,
      guestTeamId: guestTeamId,
      location: locName,
      locationCity: locCity,
      locationAddress: locAddr,
      league: (leagueName || "").trim(),
      season: seasonName,
      status: status,
      scoreHome: scoreHome !== "" ? parseInt(scoreHome, 10) : 0,
      scoreGuest: scoreGuest !== "" ? parseInt(scoreGuest, 10) : 0,
      isHome: isHome,
    })
  }

  return games
}

// ── Extract leagueHoldingIds from team XML (current season only) ─────

function extractLeagueHoldingIds(teamXml) {
  var ids = {}
  // Match full leagueHolding tags to check season
  var lhMatches = teamXml.match(/<leagueHolding[^>]*>/g)
  if (lhMatches) {
    // Determine current season start year (season starts in September)
    var now = new Date()
    var seasonStartYear = now.getMonth() < 8 ? now.getFullYear() - 1 : now.getFullYear()
    var seasonPrefix = String(seasonStartYear) // e.g. "2025"

    for (var i = 0; i < lhMatches.length; i++) {
      var tag = lhMatches[i]
      var id = getAttr(tag, " id")
      if (!id) continue

      // Check if from date is in current season (starts with seasonStartYear)
      var from = getAttr(tag, "from")
      if (from && from.indexOf(seasonPrefix) === 0) {
        ids[id] = true
      }
    }
  }
  return ids
}

// ── Fetch and parse ranking XML ─────────────────────────────────────

function fetchRankingXml(leagueHoldingId) {
  var url = BP_BASE + "/showRankingForLeague.do?leagueHoldingId=" + leagueHoldingId + "&xmlView=true"
  var res = $http.send({
    url: url,
    method: "GET",
    headers: { "User-Agent": "KSCW-Sync/1.0" },
    timeout: 30000,
  })
  return res.raw || ""
}

function parseRankings(rankingXml, leagueHoldingId) {
  var rankings = []

  // Extract league name
  var lhMatch = rankingXml.match(/<leagueHolding[^>]*fullName="([^"]*)"/)
  var leagueName = lhMatch ? lhMatch[1] : ""
  var seasonMatch = rankingXml.match(/<season[^>]*name="([^"]*)"/)
  var season = seasonMatch ? seasonMatch[1] : ""

  // Parse each Ranking block
  var rankBlocks = rankingXml.split("<Ranking>").slice(1)
  for (var i = 0; i < rankBlocks.length; i++) {
    var block = rankBlocks[i].split("</Ranking>")[0] || rankBlocks[i]

    var rdMatch = block.match(/<rankingDataVO[^>]*\/>/)
    if (!rdMatch) continue
    var rd = rdMatch[0]

    var teamMatch = block.match(/<team[^>]*\/>|<team[^>]*>[\s\S]*?<\/team>/)
    if (!teamMatch) continue
    var teamBlock = teamMatch[0]

    var bpTeamId = getAttr(teamBlock, " id")
    var teamName = getAttr(teamBlock, " name")

    rankings.push({
      bpTeamId: bpTeamId,
      teamName: teamName,
      league: leagueName,
      season: season,
      rank: parseInt(getAttr(rd, "currentRanking"), 10) || 0,
      played: parseInt(getAttr(rd, "gamesPlayed"), 10) || 0,
      won: parseInt(getAttr(rd, "victories"), 10) || 0,
      lost: parseInt(getAttr(rd, "defeats"), 10) || 0,
      pointsFor: parseInt(getAttr(rd, "totalScoreFor"), 10) || 0,
      pointsAgainst: parseInt(getAttr(rd, "totalScoreAgainst"), 10) || 0,
      totalPoints: parseInt(getAttr(rd, "totalPoints"), 10) || 0,
    })
  }

  return rankings
}

// ── Build PB team lookups (shared) ───────────────────────────────────

function buildTeamLookups() {
  var pbTeams = $app.findRecordsByFilter("teams", "sport = 'basketball' && bb_source_id != ''", "", 0, 0)
  var bpToPbTeam = {}
  var teamIdSet = {}
  var teamIds = []
  for (var i = 0; i < pbTeams.length; i++) {
    var t = pbTeams[i]
    var bpId = t.getString("bb_source_id")
    bpToPbTeam[bpId] = t.id
    teamIdSet[bpId] = true
    teamIds.push(bpId)
  }
  return { bpToPbTeam: bpToPbTeam, teamIdSet: teamIdSet, teamIds: teamIds }
}

// ── Main sync function ───────────────────────────────────────────────

function syncGames() {
  var lookups = buildTeamLookups()
  if (lookups.teamIds.length === 0) {
    console.log("[BP Sync] No basketball teams with bb_source_id found in PocketBase")
    return
  }
  var bpToPbTeam = lookups.bpToPbTeam
  var teamIdSet = lookups.teamIdSet
  var teamIds = lookups.teamIds
  console.log("[BP Sync] Found " + teamIds.length + " basketball teams in PocketBase")

  // Build hall name → PB hall ID lookup
  var pbHalls = $app.findRecordsByFilter("halls", "1=1", "", 0, 0)
  var hallByName = {}
  for (var i = 0; i < pbHalls.length; i++) {
    hallByName[pbHalls[i].getString("name")] = pbHalls[i].id
  }

  // Fetch all games from all teams via public XML API
  var allGames = []
  var seenGameIds = {}
  var allLeagueHoldingIds = {}

  for (var i = 0; i < teamIds.length; i++) {
    var teamId = teamIds[i]
    try {
      var xml = fetchTeamXml(teamId)
      if (!xml || xml.length < 100) {
        console.log("[BP Sync] Empty response for team " + teamId + ", skipping")
        continue
      }

      // Collect leagueHoldingIds for rankings sync
      var lhIds = extractLeagueHoldingIds(xml)
      var lhKeys = Object.keys(lhIds)
      for (var k = 0; k < lhKeys.length; k++) {
        allLeagueHoldingIds[lhKeys[k]] = true
      }

      var games = parseGames(xml, teamIdSet)
      var newCount = 0
      for (var j = 0; j < games.length; j++) {
        if (!seenGameIds[games[j].id]) {
          seenGameIds[games[j].id] = true
          allGames.push(games[j])
          newCount++
        }
      }
      console.log("[BP Sync] Team " + teamId + ": " + games.length + " games (" + newCount + " new)")
    } catch (err) {
      console.log("[BP Sync] Error fetching team " + teamId + ": " + err)
    }
  }

  // Store leagueHoldingIds for rankings sync (accessible via module)
  _leagueHoldingIds = allLeagueHoldingIds

  console.log("[BP Sync] Total unique games: " + allGames.length)

  // Sync games to PocketBase
  var created = 0
  var updated = 0
  var skipped = 0

  for (var i = 0; i < allGames.length; i++) {
    var g = allGames[i]
    var gameId = "bb_" + g.gameNumber
    var kscwTeamBpId = g.isHome ? g.homeTeamId : g.guestTeamId
    var pbTeamId = bpToPbTeam[kscwTeamBpId]

    if (!pbTeamId) {
      skipped++
      continue
    }

    // Skip games with no away team (incomplete data from Basketplan)
    if (!g.guestTeam || !g.guestTeam.trim()) {
      console.log("[BP Sync] Skipping game " + gameId + " — no away team (home: " + (g.homeTeam || "?") + ")")
      skipped++
      continue
    }

    // Resolve hall for home games
    var hallId = ""
    if (g.isHome && g.location) {
      var mappedHallName = HALL_MAP[g.location]
      if (mappedHallName) hallId = hallByName[mappedHallName] || ""
    }

    var awayHallJson = null
    if (!g.isHome && g.location) {
      awayHallJson = { name: g.location, address: g.locationAddress, city: g.locationCity }
    }

    var gameData = {
      game_id: gameId,
      source: "basketplan",
      kscw_team: pbTeamId,
      home_team: g.homeTeam,
      away_team: g.guestTeam,
      date: g.date,
      time: g.time || "",
      type: g.isHome ? "home" : "away",
      status: STATUS_MAP[g.status] || "scheduled",
      home_score: g.scoreHome,
      away_score: g.scoreGuest,
      league: g.league,
      season: g.season,
      referees_json: [],
    }

    if (hallId) gameData.hall = hallId
    if (awayHallJson) gameData.away_hall_json = awayHallJson

    try {
      // Try to find existing game
      var existing = $app.findFirstRecordByFilter("games", "game_id = {:gameId}", { gameId: gameId })
      // Auto-adjust respond_by when game date changes (preserve offset)
      var oldDate = existing.getString("date")
      var respondBy = existing.getString("respond_by")
      if (respondBy && oldDate && oldDate !== g.date) {
        var oldMs = new Date(oldDate).getTime()
        var rbMs = new Date(respondBy.split(" ")[0]).getTime()
        var offsetMs = oldMs - rbMs
        var newGameMs = new Date(g.date).getTime()
        var newRb = new Date(newGameMs - offsetMs)
        var yyyy = newRb.getFullYear()
        var mm = String(newRb.getMonth() + 1).padStart(2, "0")
        var dd = String(newRb.getDate()).padStart(2, "0")
        gameData.respond_by = yyyy + "-" + mm + "-" + dd
        console.log("[BP Sync] Game " + gameId + " date changed " + oldDate + " -> " + g.date + ", respond_by adjusted to " + yyyy + "-" + mm + "-" + dd)
      }
      // Update existing
      existing.load(gameData)
      $app.save(existing)
      updated++
    } catch (_) {
      // Create new
      try {
        var collection = $app.findCollectionByNameOrId("games")
        var record = new Record(collection)
        record.load(gameData)
        $app.save(record)
        created++
      } catch (createErr) {
        console.log("[BP Sync] Error creating game " + gameId + ": " + createErr)
        skipped++
      }
    }
  }

  console.log("[BP Sync] Done: " + created + " created, " + updated + " updated, " + skipped + " skipped")
}

// Store leagueHoldingIds between syncGames and syncRankings calls
var _leagueHoldingIds = {}

function syncRankings() {
  var lookups = buildTeamLookups()
  var bpToPbTeam = lookups.bpToPbTeam

  // If syncGames wasn't called first, fetch leagueHoldingIds now
  var lhIds = Object.keys(_leagueHoldingIds)
  if (lhIds.length === 0) {
    console.log("[BP Sync] No leagueHoldingIds cached, fetching from team XMLs...")
    for (var i = 0; i < lookups.teamIds.length; i++) {
      try {
        var xml = fetchTeamXml(lookups.teamIds[i])
        var ids = extractLeagueHoldingIds(xml)
        var keys = Object.keys(ids)
        for (var k = 0; k < keys.length; k++) {
          _leagueHoldingIds[keys[k]] = true
        }
      } catch (err) {
        console.log("[BP Sync] Error fetching team XML for rankings: " + err)
      }
    }
    lhIds = Object.keys(_leagueHoldingIds)
  }

  console.log("[BP Sync] Fetching rankings for " + lhIds.length + " leagues...")

  var rankingsCol = $app.findCollectionByNameOrId("rankings")
  var now = new Date().toISOString()
  var created = 0
  var updated = 0
  var errors = 0

  for (var i = 0; i < lhIds.length; i++) {
    var lhId = lhIds[i]
    try {
      var xml = fetchRankingXml(lhId)
      if (!xml || xml.length < 100) {
        console.log("[BP Sync] Empty ranking for leagueHolding " + lhId)
        continue
      }

      var rankings = parseRankings(xml, lhId)

      // Skip leagues that don't contain any KSCW team
      var hasKscw = false
      for (var j = 0; j < rankings.length; j++) {
        if (bpToPbTeam[rankings[j].bpTeamId]) {
          hasKscw = true
          break
        }
      }
      if (!hasKscw) {
        continue
      }

      console.log("[BP Sync] League " + lhId + ": " + rankings.length + " teams in ranking")

      for (var j = 0; j < rankings.length; j++) {
        var r = rankings[j]
        try {
          // Use bb_ prefix on team_id to distinguish from volleyball team IDs
          var teamId = "bb_" + r.bpTeamId

          var record
          try {
            record = $app.findFirstRecordByFilter(
              "rankings",
              "team_id = {:tid} && league = {:league}",
              { tid: teamId, league: r.league }
            )
            updated++
          } catch (_) {
            record = new Record(rankingsCol)
            created++
          }

          record.set("team_id", teamId)
          record.set("team_name", r.teamName)
          record.set("league", r.league)
          record.set("rank", r.rank)
          record.set("played", r.played)
          record.set("won", r.won)
          record.set("lost", r.lost)
          record.set("sets_won", 0) // basketball doesn't have sets
          record.set("sets_lost", 0)
          record.set("points_won", r.pointsFor)
          record.set("points_lost", r.pointsAgainst)
          record.set("points", r.totalPoints)
          record.set("season", r.season)
          record.set("updated_at", now)

          // Set team relation if this is a KSCW team
          var pbTeamId = bpToPbTeam[r.bpTeamId]
          if (pbTeamId) {
            record.set("team", pbTeamId)
          }

          $app.save(record)
        } catch (e) {
          errors++
          console.log("[BP Sync] Error saving ranking for " + r.teamName + ": " + e)
        }
      }
    } catch (err) {
      console.log("[BP Sync] Error fetching ranking for league " + lhId + ": " + err)
    }
  }

  console.log("[BP Sync] Rankings done: " + created + " created, " + updated + " updated, " + errors + " errors")
}

module.exports = {
  syncGames: syncGames,
  syncRankings: syncRankings,
}
