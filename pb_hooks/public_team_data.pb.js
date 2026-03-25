/// <reference path="../node_modules/pocketbase/dist/pocketbase.d.ts" />

// Public team data endpoint: GET /api/public/team/{teamId}
// Returns roster + training schedule for the website (no auth required).
//
// Response: {
//   roster: [{ first_name, last_name, initials, number, position, photo_url }],
//   trainings: [{ day, start_time, end_time, hall_name, hall_address }],
//   coach: [{ first_name, last_name, initials, photo_url }],
//   captain: [{ first_name, last_name, initials, photo_url }]
// }
//
// Only exposes public-safe fields (no email, phone, birthdate, etc.)

routerAdd("GET", "/api/public/team/{teamId}", function (e) {
  var teamId = e.request.pathValue("teamId")

  // Validate team ID format (PB 15-char alphanumeric)
  if (!teamId || !teamId.match(/^[a-z0-9]{15}$/)) {
    throw new BadRequestError("Invalid team ID")
  }

  // Verify team exists and is active
  var team
  try {
    team = $app.findRecordById("teams", teamId)
  } catch (err) {
    throw new NotFoundError("Team not found")
  }

  if (!team.getBool("active")) {
    throw new NotFoundError("Team not found")
  }

  // ── Roster: member_teams → members (excluding coaches of THIS team) ──
  var coachIds = team.get("coach") || []
  var coachIdSet = {}
  for (var c = 0; c < coachIds.length; c++) coachIdSet[coachIds[c]] = true

  var roster = []
  try {
    var memberTeams = $app.findRecordsByFilter(
      "member_teams",
      'team = {:teamId} && season = {:season}',
      "-created",
      200,
      0,
      { teamId: teamId, season: team.getString("season") }
    )

    for (var i = 0; i < memberTeams.length; i++) {
      var mt = memberTeams[i]
      var memberId = mt.getString("member")
      if (!memberId) continue
      if (coachIdSet[memberId]) continue // coach of THIS team → shown in coach section

      try {
        var member = $app.findRecordById("members", memberId)
        var firstName = member.getString("first_name")
        var lastName = member.getString("last_name")
        var number = member.getInt("number")
        var positions = member.get("position") || []
        var photo = member.getString("photo")
        var photoUrl = ""
        if (photo) {
          photoUrl = "/api/files/" + member.collection().id + "/" + member.id + "/" + photo + "?thumb=100x100"
        }

        var initials = ""
        if (firstName) initials += firstName.charAt(0).toUpperCase()
        if (lastName) initials += lastName.charAt(0).toUpperCase()

        roster.push({
          first_name: firstName,
          last_name: lastName,
          initials: initials,
          number: number || null,
          position: positions.length > 0 ? positions : [],
          photo_url: photoUrl,
          guest_level: mt.getInt("guest_level") || 0,
        })
      } catch (memberErr) {
        // Skip missing members
      }
    }
  } catch (rosterErr) {
    // No roster data — that's OK
  }

  // ── Trainings: hall_slots for this team ──
  var trainings = []
  var days = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"]
  try {
    var slots = $app.findRecordsByFilter(
      "hall_slots",
      'team = {:teamId}',
      "day_of_week,start_time",
      50,
      0,
      { teamId: teamId }
    )

    for (var s = 0; s < slots.length; s++) {
      var slot = slots[s]
      var dow = slot.getInt("day_of_week")
      var hallId = slot.getString("hall")
      var hallName = ""
      var hallAddress = ""

      if (hallId) {
        try {
          var hall = $app.findRecordById("halls", hallId)
          hallName = hall.getString("name")
          hallAddress = hall.getString("address")
        } catch (hallErr) {}
      }

      trainings.push({
        day: (dow >= 0 && dow <= 6) ? days[dow] : "?",
        day_of_week: dow,
        start_time: slot.getString("start_time"),
        end_time: slot.getString("end_time"),
        hall_name: hallName,
        hall_address: hallAddress,
      })
    }
  } catch (trainErr) {
    // No training data
  }

  // ── Coach & Captain from team relations ──
  var coach = []
  var captain = []

  function resolveMembers(ids) {
    var result = []
    if (!ids || !ids.length) return result
    for (var m = 0; m < ids.length; m++) {
      try {
        var rec = $app.findRecordById("members", ids[m])
        var fn = rec.getString("first_name") || ""
        var ln = rec.getString("last_name") || ""
        var initials = ""
        if (fn) initials += fn.charAt(0).toUpperCase()
        if (ln) initials += ln.charAt(0).toUpperCase()
        var photoUrl = ""
        var photo = rec.getString("photo")
        if (photo) {
          photoUrl = "/api/files/" + rec.collection().id + "/" + rec.id + "/" + photo + "?thumb=100x100"
        }
        result.push({
          first_name: fn,
          last_name: ln,
          initials: initials,
          photo_url: photoUrl,
        })
      } catch (err) {}
    }
    return result
  }

  coach = resolveMembers(team.get("coach"))
  captain = resolveMembers(team.get("captain"))

  var teamIdField = team.getString("team_id") // e.g. "vb_2743" — used for rankings

  // ── Games for this team ──
  // Games use `kscw_team` (PB record ID) and `type` (home/away)
  // Team names are in `home_team` and `away_team` (plain strings)
  var upcoming = []
  var results = []

  // Hall lookup cache (avoid repeated lookups)
  var hallCache = {}
  function resolveHall(hallId) {
    if (!hallId) return null
    if (hallCache[hallId]) return hallCache[hallId]
    try {
      var h = $app.findRecordById("halls", hallId)
      hallCache[hallId] = {
        name: h.getString("name"),
        address: h.getString("address"),
        city: h.getString("city") || "",
        maps_url: h.getString("maps_url") || "",
      }
    } catch (he) {
      hallCache[hallId] = null
    }
    return hallCache[hallId]
  }

  function mapGame(g) {
    var isHome = g.getString("type") === "home"
    var homeScore = g.getInt("home_score")
    var awayScore = g.getInt("away_score")
    var hasScore = g.getString("status") === "completed" && (homeScore > 0 || awayScore > 0)
    var isBB = (g.getString("game_id") || "").indexOf("bb_") === 0 || g.getString("source") === "basketplan"

    var obj = {
      game_id: g.getString("game_id") || g.id,
      date: g.getString("date").slice(0, 10),
      time: g.getString("time") || "",
      home_team: g.getString("home_team"),
      away_team: g.getString("away_team"),
      isHome: isHome,
      score: hasScore ? homeScore + ":" + awayScore : null,
      league: g.getString("league") || "",
      season: g.getString("season") || "",
      sport: isBB ? "basketball" : "volleyball",
    }

    // Sets (volleyball)
    var setsJson = g.get("sets_json")
    if (setsJson && setsJson.length) obj.sets_json = setsJson

    // Referees (volleyball)
    var refsJson = g.get("referees_json")
    if (refsJson && refsJson.length) obj.referees = refsJson

    // Hall
    var hallData = resolveHall(g.getString("hall"))
    if (hallData) obj.hall = hallData

    // Basketball officials
    if (isBB) {
      var officials = {}
      var bbScorer = g.getString("bb_scorer_duty_team")
      var bbTimekeeper = g.getString("bb_timekeeper_duty_team")
      var bb24s = g.getString("bb_24s_official")
      if (bbScorer) officials.scorer = bbScorer
      if (bbTimekeeper) officials.timekeeper = bbTimekeeper
      if (bb24s) officials.shot_clock = bb24s
      if (Object.keys(officials).length) obj.bb_officials = officials
    }

    // Scorer duty (volleyball)
    if (!isBB) {
      var scorerTeam = g.getString("scoreboard_duty_team")
      if (scorerTeam) {
        try {
          var st = $app.findRecordById("teams", scorerTeam)
          obj.scorer_team = st.getString("name")
        } catch (ste) {}
      }
    }

    return obj
  }

  try {
    var now = new Date().toISOString().slice(0, 10)
    var upGames = $app.findRecordsByFilter(
      "games",
      'kscw_team = {:tid} && date >= {:now}',
      "date,time",
      10,
      0,
      { tid: teamId, now: now + " 00:00:00" }
    )
    for (var ug = 0; ug < upGames.length; ug++) {
      upcoming.push(mapGame(upGames[ug]))
    }
  } catch (upErr) {}

  try {
    var now2 = new Date().toISOString().slice(0, 10)
    var resGames = $app.findRecordsByFilter(
      "games",
      'kscw_team = {:tid} && date < {:now} && status = "completed"',
      "-date,-time",
      10,
      0,
      { tid: teamId, now: now2 + " 00:00:00" }
    )
    for (var rg = 0; rg < resGames.length; rg++) {
      results.push(mapGame(resGames[rg]))
    }
  } catch (resErr) {}

  // ── Rankings for this team's league ──
  var rankings = []
  var rankingLeague = ""
  if (teamIdField) {
    try {
      // Get ALL ranking entries for this team, pick the one with most games played
      var rankRows = $app.findRecordsByFilter(
        "rankings",
        'team_id = {:tid}',
        "-played",
        50,
        0,
        { tid: teamIdField }
      )
      if (rankRows.length > 0) {
        // Pick the ranking with the most games played (= main league, not preliminary group)
        var bestRow = rankRows[0]
        for (var br = 1; br < rankRows.length; br++) {
          if (rankRows[br].getInt("played") > bestRow.getInt("played")) {
            bestRow = rankRows[br]
          }
        }
        var leagueGroup = bestRow.getString("league")
        rankingLeague = leagueGroup
        if (leagueGroup) {
          var allRanks = $app.findRecordsByFilter(
            "rankings",
            'league = {:league}',
            "rank",
            50,
            0,
            { league: leagueGroup }
          )
          for (var ar = 0; ar < allRanks.length; ar++) {
            var rr = allRanks[ar]
            var isVB = (rr.getString("team_id") || "").indexOf("vb_") === 0
            rankings.push({
              rank: rr.getInt("rank"),
              team: rr.getString("team_name"),
              team_id: rr.getString("team_id"),
              played: rr.getInt("played"),
              won: rr.getInt("won"),
              lost: rr.getInt("lost"),
              wins_clear: rr.getInt("wins_clear"),
              wins_narrow: rr.getInt("wins_narrow"),
              defeats_clear: rr.getInt("defeats_clear"),
              defeats_narrow: rr.getInt("defeats_narrow"),
              points: rr.getInt("points"),
              sets_won: rr.getInt("sets_won"),
              sets_lost: rr.getInt("sets_lost"),
              points_won: rr.getInt("points_won"),
              points_lost: rr.getInt("points_lost"),
              sport: isVB ? "volleyball" : "basketball",
            })
          }
        }
      }
    } catch (rankErr) {}
  }

  e.json(200, {
    team: {
      name: team.getString("name"),
      full_name: team.getString("full_name"),
      league: team.getString("league"),
      sport: team.getString("sport"),
      season: team.getString("season"),
      team_id: teamIdField,
      team_picture: team.getString("team_picture"),
      collectionId: team.collection().id,
      social_url: team.getString("social_url"),
    },
    roster: roster,
    trainings: trainings,
    coach: coach,
    captain: captain,
    upcoming: upcoming,
    results: results,
    rankings: rankings,
  })
})

// Batch endpoint: GET /api/public/teams
// Returns basic info + training schedule for all active teams (no roster).
// Used by the overview pages to show training times dynamically.
routerAdd("GET", "/api/public/teams", function (e) {
  var teams
  try {
    teams = $app.findRecordsByFilter("teams", 'active = true', "sport,name", 100, 0)
  } catch (err) {
    e.json(200, { teams: [] })
    return
  }

  var days = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"]
  var result = []

  for (var i = 0; i < teams.length; i++) {
    var t = teams[i]
    var teamId = t.id

    // Get training slots
    var trainings = []
    try {
      var slots = $app.findRecordsByFilter(
        "hall_slots",
        'team = {:teamId}',
        "day_of_week,start_time",
        20,
        0,
        { teamId: teamId }
      )
      for (var s = 0; s < slots.length; s++) {
        var slot = slots[s]
        var dow = slot.getInt("day_of_week")
        var hallId = slot.getString("hall")
        var hallName = ""
        if (hallId) {
          try {
            var hall = $app.findRecordById("halls", hallId)
            hallName = hall.getString("name")
          } catch (he) {}
        }
        trainings.push({
          day: (dow >= 0 && dow <= 6) ? days[dow] : "?",
          start_time: slot.getString("start_time"),
          end_time: slot.getString("end_time"),
          hall_name: hallName,
        })
      }
    } catch (te) {}

    result.push({
      id: t.id,
      name: t.getString("name"),
      full_name: t.getString("full_name"),
      league: t.getString("league"),
      sport: t.getString("sport"),
      season: t.getString("season"),
      trainings: trainings,
    })
  }

  e.json(200, { teams: result })
})
