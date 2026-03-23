/// <reference path="../pb_data/types.d.ts" />

// ── Shell Invite API ─────────────────────────────────────────────────
// QR-based external user invite system for shell (guest) accounts.
//
// POST /api/team-invites/create  — coach/TR/admin generates invite token
// POST /api/team-invites/claim   — public; new user joins via QR code
// POST /api/team-invites/extend  — coach/TR extends a shell member's expiry
// GET  /api/team-invites/info/{token} — public; validates token, returns team info

// ── Helpers ──────────────────────────────────────────────────────────

// Local copy of arrayContains — not exported from team_permissions_lib
function arrayContains(arr, value) {
  if (!arr || !arr.length) return false
  for (var i = 0; i < arr.length; i++) {
    if (arr[i] === value) return true
  }
  return false
}

// getCurrentSeason — matches notifications_lib.js pattern
function getCurrentSeason() {
  var now = new Date()
  var year = now.getFullYear()
  var month = now.getMonth() // 0-indexed
  if (month < 7) year-- // before August → previous year's season
  var nextYear = (year + 1) % 100
  return year + "/" + (nextYear < 10 ? "0" + nextYear : nextYear)
}

// hasInvitePermission — returns true if auth user is coach, team_responsible, or sport/global admin for the team
function hasInvitePermission(auth, team) {
  if (!auth) return false

  var roles = auth.get("role") || []
  if (arrayContains(roles, "superuser") || arrayContains(roles, "admin")) return true

  var sport = team.getString("sport")
  if (sport === "volleyball" && arrayContains(roles, "vb_admin")) return true
  if (sport === "basketball" && arrayContains(roles, "bb_admin")) return true

  var authId = auth.id
  var coaches = team.get("coach") || []
  var trs = team.get("team_responsible") || []
  return arrayContains(coaches, authId) || arrayContains(trs, authId)
}

// addDays — returns a new Date offset by N days
function addDays(date, days) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000)
}

// toIsoString — formats a Date as "YYYY-MM-DD HH:MM:SS.sssZ" compatible with PB datetime fields
function toIsoString(date) {
  return date.toISOString().replace("T", " ").slice(0, 23) + "Z"
}

// ── POST /api/team-invites/create ────────────────────────────────────
// Auth: coach, team_responsible, or sport/global admin
// Body: { team, guest_level }
// Returns: { token, qr_url, expires_at }

routerAdd("POST", "/api/team-invites/create", function (e) {
  var info = e.requestInfo()
  var auth = info.auth
  if (!auth) throw new ForbiddenError("Authentication required.")

  var body = info.body
  var teamId = (body.team || "").trim()
  var guestLevel = parseInt(body.guest_level)

  if (!teamId) throw new BadRequestError("team is required.")
  if (isNaN(guestLevel) || guestLevel < 0 || guestLevel > 3) {
    throw new BadRequestError("guest_level must be 0-3.")
  }

  // Load team record
  var team
  try {
    team = $app.findRecordById("teams", teamId)
  } catch (_) {
    throw new BadRequestError("Team not found.")
  }

  // Permission check
  if (!hasInvitePermission(auth, team)) {
    throw new ForbiddenError("You don't have permission to create invites for this team.")
  }

  // Max 20 pending invites per team
  var pendingInvites
  try {
    pendingInvites = $app.findRecordsByFilter(
      "team_invites",
      'team = "' + teamId + '" && status = "pending"',
      "",
      21,
      0
    )
  } catch (_) {
    pendingInvites = []
  }
  if (pendingInvites && pendingInvites.length >= 20) {
    throw new BadRequestError("Maximum of 20 pending invites per team reached. Revoke some before creating new ones.")
  }

  // Generate crypto-random 32-char token
  var token = $security.randomStringWithAlphabet(32, "abcdefghijklmnopqrstuvwxyz0123456789")

  // Expires in 7 days
  var now = new Date()
  var expiresAt = addDays(now, 7)
  var expiresAtStr = toIsoString(expiresAt)

  // Create team_invites record
  var collection = $app.findCollectionByNameOrId("team_invites")
  var record = new Record(collection)
  record.set("team", teamId)
  record.set("token", token)
  record.set("guest_level", guestLevel)
  record.set("status", "pending")
  record.set("expires_at", expiresAtStr)
  record.set("created_by", auth.id)
  $app.save(record)

  var qrUrl = "https://wiedisync.kscw.ch/join?token=" + token

  console.log("[ShellInvite] Created invite " + token + " for team " + team.getString("name") + " by " + auth.id)

  return e.json(200, {
    token: token,
    qr_url: qrUrl,
    expires_at: expiresAtStr,
  })
})


// ── POST /api/team-invites/claim ──────────────────────────────────────
// Auth: None (public)
// Body: { token, first_name, last_name, email }
// Returns: { success, member_id, team_name, email }

routerAdd("POST", "/api/team-invites/claim", function (e) {
  var body = e.requestInfo().body

  var token = (body.token || "").trim()
  var firstName = (body.first_name || "").trim()
  var lastName = (body.last_name || "").trim()
  var email = (body.email || "").trim().toLowerCase()

  if (!token) throw new BadRequestError("token is required.")
  if (!firstName) throw new BadRequestError("first_name is required.")
  if (!lastName) throw new BadRequestError("last_name is required.")
  if (!email) throw new BadRequestError("email is required.")

  // Basic email format check
  if (email.indexOf("@") < 1 || email.indexOf(".") < 0) {
    throw new BadRequestError("Invalid email address.")
  }

  // Find invite by token
  var invites
  try {
    invites = $app.findRecordsByFilter(
      "team_invites",
      'token = "' + token + '"',
      "",
      1,
      0
    )
  } catch (_) {
    invites = []
  }

  if (!invites || invites.length === 0) {
    throw new NotFoundError("Invalid or expired invite link.")
  }

  var invite = invites[0]

  // Validate status
  if (invite.getString("status") !== "pending") {
    throw new BadRequestError("This invite has already been used or revoked.")
  }

  // Validate not expired
  var expiresStr = invite.getString("expires_at")
  if (expiresStr) {
    var expiresAt = new Date(expiresStr)
    if (new Date() > expiresAt) {
      throw new BadRequestError("This invite link has expired.")
    }
  }

  var teamId = invite.getString("team")
  var guestLevel = invite.get("guest_level")

  // Check email not already registered
  var existingMembers
  try {
    existingMembers = $app.findRecordsByFilter(
      "members",
      'email = "' + email + '"',
      "",
      1,
      0
    )
  } catch (_) {
    existingMembers = []
  }

  if (existingMembers && existingMembers.length > 0) {
    throw new BadRequestError("An account with this email already exists.")
  }

  // Max 10 shell members per team
  var shellCount
  try {
    shellCount = $app.findRecordsByFilter(
      "member_teams",
      'team = "' + teamId + '" && season = "' + getCurrentSeason() + '"',
      "",
      200,
      0
    )
  } catch (_) {
    shellCount = []
  }

  var activeShellCount = 0
  if (shellCount && shellCount.length > 0) {
    for (var i = 0; i < shellCount.length; i++) {
      var memberId = shellCount[i].getString("member")
      try {
        var m = $app.findRecordById("members", memberId)
        if (m.getBool("shell")) activeShellCount++
      } catch (_) {}
    }
  }

  if (activeShellCount >= 10) {
    throw new BadRequestError("This team has reached the maximum of 10 shell members.")
  }

  // Load team for name
  var team
  try {
    team = $app.findRecordById("teams", teamId)
  } catch (_) {
    throw new BadRequestError("Team not found.")
  }

  // shell_expires = now + 30 days
  var now = new Date()
  var shellExpires = addDays(now, 30)
  var shellExpiresStr = toIsoString(shellExpires)

  // Create member + member_teams + claim invite atomically
  // (if any step fails, all are rolled back)
  var memberIdOut = ""
  $app.runInTransaction(function(txApp) {
    // Create Member record (without approval yet)
    var memberCol = txApp.findCollectionByNameOrId("members")
    var member = new Record(memberCol)
    member.set("first_name", firstName)
    member.set("last_name", lastName)
    member.set("name", firstName + " " + lastName)
    member.set("email", email)
    member.set("shell", true)
    member.set("coach_approved_team", false) // set after member_teams exists
    member.set("wiedisync_active", true)
    member.set("shell_expires", shellExpiresStr)
    member.set("shell_reminder_sent", false)
    member.set("birthdate_visibility", "hidden")
    member.set("language", "german")
    member.set("role", ["user"])
    txApp.save(member)

    // Create member_teams record first, so the link exists
    var mtCol = txApp.findCollectionByNameOrId("member_teams")
    var mt = new Record(mtCol)
    mt.set("member", member.id)
    mt.set("team", teamId)
    mt.set("season", getCurrentSeason())
    mt.set("guest_level", guestLevel)
    txApp.save(mt)

    // Now set coach_approved_team (member_teams exists)
    member.set("coach_approved_team", true)
    txApp.save(member)

    // Mark invite as claimed
    invite.set("status", "claimed")
    invite.set("claimed_by", member.id)
    invite.set("claimed_at", toIsoString(now))
    txApp.save(invite)

    // Store member ref for response
    memberIdOut = member.id
  })
  var memberIdResult = memberIdOut

  console.log("[ShellInvite] Claimed: " + email + " joined team " + team.getString("name") + " as shell member " + memberIdOut)

  return e.json(200, {
    success: true,
    member_id: memberIdOut,
    team_name: team.getString("name"),
    email: email,
  })
})


// ── POST /api/team-invites/extend ─────────────────────────────────────
// Auth: coach or team_responsible (for the member's team)
// Body: { member_id }
// Resets shell_expires to now + 30 days, reactivates if expired

routerAdd("POST", "/api/team-invites/extend", function (e) {
  var info = e.requestInfo()
  var auth = info.auth
  if (!auth) throw new ForbiddenError("Authentication required.")

  var body = info.body
  var memberId = (body.member_id || "").trim()
  if (!memberId) throw new BadRequestError("member_id is required.")

  // Load member
  var member
  try {
    member = $app.findRecordById("members", memberId)
  } catch (_) {
    throw new NotFoundError("Member not found.")
  }

  // Must be a shell account
  if (!member.getBool("shell")) {
    throw new BadRequestError("This member is not a shell account.")
  }

  // Find which team(s) this shell member is on — auth user must have permission for at least one
  var season = getCurrentSeason()
  var memberTeams
  try {
    memberTeams = $app.findRecordsByFilter(
      "member_teams",
      'member = "' + memberId + '" && season = "' + season + '"',
      "",
      20,
      0
    )
  } catch (_) {
    memberTeams = []
  }

  if (!memberTeams || memberTeams.length === 0) {
    throw new BadRequestError("Shell member is not assigned to any team this season.")
  }

  // Check permission: auth user must have invite permission for at least one of the member's teams
  var permitted = false
  var permittedTeamId = ""
  for (var i = 0; i < memberTeams.length; i++) {
    var tId = memberTeams[i].getString("team")
    try {
      var team = $app.findRecordById("teams", tId)
      if (hasInvitePermission(auth, team)) {
        permitted = true
        permittedTeamId = tId
        break
      }
    } catch (_) {}
  }

  if (!permitted) {
    throw new ForbiddenError("You don't have permission to extend this member's access.")
  }

  // Reset expiry to now + 30 days
  var now = new Date()
  var newExpiry = addDays(now, 30)
  var newExpiryStr = toIsoString(newExpiry)

  member.set("shell_expires", newExpiryStr)
  member.set("wiedisync_active", true)
  member.set("shell_reminder_sent", false)
  $app.save(member)

  console.log("[ShellInvite] Extended shell expiry for member " + memberId + " (team " + permittedTeamId + ") to " + newExpiryStr)

  return e.json(200, {
    success: true,
    member_id: memberId,
    shell_expires: newExpiryStr,
  })
})


// ── GET /api/team-invites/info/{token} ───────────────────────────────
// Auth: None (public)
// Validates token is pending and not expired
// Returns: { team_name, sport, guest_level, expires_at }

routerAdd("GET", "/api/team-invites/info/{token}", function (e) {
  var token = e.request.pathValue("token")
  if (!token) throw new BadRequestError("token is required.")

  // Find invite
  var invites
  try {
    invites = $app.findRecordsByFilter(
      "team_invites",
      'token = "' + token + '"',
      "",
      1,
      0
    )
  } catch (_) {
    invites = []
  }

  if (!invites || invites.length === 0) {
    throw new NotFoundError("Invalid or expired invite link.")
  }

  var invite = invites[0]

  // Must be pending
  if (invite.getString("status") !== "pending") {
    throw new BadRequestError("This invite has already been used or revoked.")
  }

  // Must not be expired
  var expiresStr = invite.getString("expires_at")
  if (expiresStr) {
    var expiresAt = new Date(expiresStr)
    if (new Date() > expiresAt) {
      throw new BadRequestError("This invite link has expired.")
    }
  }

  var teamId = invite.getString("team")
  var teamName = ""
  var sport = ""

  try {
    var team = $app.findRecordById("teams", teamId)
    teamName = team.getString("name")
    sport = team.getString("sport")
  } catch (_) {}

  return e.json(200, {
    team_name: teamName,
    sport: sport,
    guest_level: invite.get("guest_level"),
    expires_at: expiresStr,
  })
})
