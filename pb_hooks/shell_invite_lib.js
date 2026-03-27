// Shell invite helpers — shared across callbacks in shell_invite_api.pb.js

var arrayContains = function(arr, value) {
  if (!arr || !arr.length) return false
  for (var i = 0; i < arr.length; i++) {
    if (arr[i] === value) return true
  }
  return false
}

var getCurrentSeason = function() {
  var now = new Date()
  var year = now.getFullYear()
  var month = now.getMonth() // 0-indexed
  if (month < 7) year-- // before August → previous year's season
  var nextYear = (year + 1) % 100
  return year + "/" + (nextYear < 10 ? "0" + nextYear : nextYear)
}

var hasInvitePermission = function(auth, team) {
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

var addDays = function(date, days) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000)
}

var toIsoString = function(date) {
  return date.toISOString().replace("T", " ").slice(0, 23) + "Z"
}

module.exports = {
  arrayContains: arrayContains,
  getCurrentSeason: getCurrentSeason,
  hasInvitePermission: hasInvitePermission,
  addDays: addDays,
  toIsoString: toIsoString,
}
