// ClubDesk CSV sync shared logic — loaded via require() from hooks

// ── CSV Parser ───────────────────────────────────────────────────────
// ClubDesk exports semicolon-delimited CSV (Swiss/German locale).
// Fields may be quoted with double-quotes. BOM may be present.

function splitCSVLine(line, delimiter) {
  var result = []
  var current = ""
  var inQuotes = false

  for (var i = 0; i < line.length; i++) {
    var ch = line.charAt(i)
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line.charAt(i + 1) === '"') {
          current += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        current += ch
      }
    } else {
      if (ch === '"') {
        inQuotes = true
      } else if (ch === delimiter) {
        result.push(current)
        current = ""
      } else {
        current += ch
      }
    }
  }
  result.push(current)
  return result
}

function parseCSV(text) {
  // Strip BOM
  if (text.length > 0 && text.charCodeAt(0) === 0xFEFF) {
    text = text.substring(1)
  }

  var lines = text.split(/\r?\n/)
  if (lines.length < 2) return { rows: [], headers: [] }

  // Auto-detect delimiter from header row
  var header = lines[0]
  var delimiter = header.indexOf(";") >= 0 ? ";" : ","
  console.log("[ClubDesk Sync] Detected delimiter: '" + delimiter + "'")

  var headers = splitCSVLine(header, delimiter)
  for (var h = 0; h < headers.length; h++) {
    headers[h] = headers[h].trim()
  }
  console.log("[ClubDesk Sync] CSV columns: " + headers.join(", "))

  var rows = []
  for (var i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue
    var values = splitCSVLine(lines[i], delimiter)
    var obj = {}
    for (var j = 0; j < headers.length; j++) {
      obj[headers[j]] = (values[j] || "").trim()
    }
    rows.push(obj)
  }

  return { rows: rows, headers: headers }
}

// ── Field Mapping ────────────────────────────────────────────────────
// ClubDesk German column names → PocketBase member fields
// NOTE: exact column names may need adjustment after seeing a real export.

function mapRow(row) {
  var mapped = {}

  mapped.first_name = row["Vorname"] || row["First Name"] || ""
  mapped.last_name = row["Nachname"] || row["Last Name"] || ""
  mapped.name = (mapped.first_name + " " + mapped.last_name).trim()

  mapped.email = (row["E-Mail"] || row["Email"] || row["E-Mail 1"] || "").toLowerCase()

  // Phone: prefer mobile, then landline
  mapped.phone = row["Mobile"] || row["Mobiltelefon"] || row["Telefon"] || row["Phone"] || ""

  // Birthdate: Swiss DD.MM.YYYY → ISO YYYY-MM-DD
  var bd = row["Geburtsdatum"] || row["Birthdate"] || ""
  if (bd) {
    var parts = bd.split(".")
    if (parts.length === 3 && parts[2].length === 4) {
      mapped.birthdate = parts[2] + "-" + padTwo(parts[1]) + "-" + padTwo(parts[0])
    } else {
      mapped.birthdate = bd
    }
  } else {
    mapped.birthdate = ""
  }

  // Year of birth
  if (row["Jahrgang"]) {
    mapped.yob = parseInt(row["Jahrgang"]) || 0
  } else if (mapped.birthdate && mapped.birthdate.length >= 4) {
    mapped.yob = parseInt(mapped.birthdate.substring(0, 4)) || 0
  } else {
    mapped.yob = 0
  }

  // ClubDesk internal ID
  mapped.clubdesk_id = row["[ID]"] || row["ID"] || ""

  // Groups (for volleyball filter)
  mapped._groups = row["Gruppen"] || row["Groups"] || row["Gruppe"] || ""

  return mapped
}

function padTwo(s) {
  s = String(s)
  return s.length < 2 ? "0" + s : s
}

// ── Volleyball Filter ────────────────────────────────────────────────

function isVolleyball(groupsStr) {
  if (!groupsStr) return true // no groups column → include (with warning)
  var lower = groupsStr.toLowerCase()
  return lower.indexOf("volleyball") >= 0 ||
         lower.indexOf("volley") >= 0 ||
         lower.indexOf("vb") >= 0
}

// ── Matching Logic ───────────────────────────────────────────────────

function normalizeStr(s) {
  return (s || "").toLowerCase().trim()
}

function findExistingMember(mapped, byClubDeskId, byEmail, byNameDob, byName) {
  // 1. clubdesk_id (exact)
  if (mapped.clubdesk_id && byClubDeskId[mapped.clubdesk_id]) {
    return { member: byClubDeskId[mapped.clubdesk_id], via: "clubdesk_id" }
  }
  // 2. email (case-insensitive)
  if (mapped.email && byEmail[mapped.email]) {
    return { member: byEmail[mapped.email], via: "email" }
  }
  // 3. first_name + last_name + birthdate
  if (mapped.birthdate) {
    var nameDbKey = normalizeStr(mapped.first_name) + "|" + normalizeStr(mapped.last_name) + "|" + mapped.birthdate
    if (byNameDob[nameDbKey]) {
      return { member: byNameDob[nameDbKey], via: "name+dob" }
    }
  }
  // 4. first_name + last_name only
  var nameKey = normalizeStr(mapped.first_name) + "|" + normalizeStr(mapped.last_name)
  if (nameKey !== "|" && byName[nameKey]) {
    return { member: byName[nameKey], via: "name" }
  }
  return null
}

// ── Sync Logic ───────────────────────────────────────────────────────

function syncMembers(csvString) {
  var parsed = parseCSV(csvString)
  var rows = parsed.rows
  var headers = parsed.headers

  if (rows.length === 0) {
    throw new Error("No data rows found in CSV")
  }

  console.log("[ClubDesk Sync] Parsed " + rows.length + " rows from CSV")

  // Check if Gruppen column exists
  var hasGroups = false
  for (var h = 0; h < headers.length; h++) {
    var hl = headers[h].toLowerCase()
    if (hl === "gruppen" || hl === "groups" || hl === "gruppe") {
      hasGroups = true
      break
    }
  }
  if (!hasGroups) {
    console.log("[ClubDesk Sync] WARNING: No 'Gruppen' column found — importing all rows")
  }

  // Log unique groups for debugging
  if (hasGroups) {
    var uniqueGroups = {}
    for (var i = 0; i < rows.length; i++) {
      var g = rows[i]["Gruppen"] || rows[i]["Groups"] || rows[i]["Gruppe"] || ""
      if (g) uniqueGroups[g] = (uniqueGroups[g] || 0) + 1
    }
    var groupNames = Object.keys(uniqueGroups)
    console.log("[ClubDesk Sync] Unique groups (" + groupNames.length + "):")
    for (var gi = 0; gi < groupNames.length; gi++) {
      console.log("  - " + groupNames[gi] + " (" + uniqueGroups[groupNames[gi]] + " members)")
    }
  }

  // Fetch all existing PB members
  var pbMembers = $app.findRecordsByFilter("members", "1=1", "", 0, 0)
  console.log("[ClubDesk Sync] Existing PB members: " + pbMembers.length)

  // Build lookup maps
  var byClubDeskId = {}
  var byEmail = {}
  var byNameDob = {}
  var byName = {}

  for (var i = 0; i < pbMembers.length; i++) {
    var m = pbMembers[i]
    var cdId = m.get("clubdesk_id") || ""
    if (cdId) byClubDeskId[cdId] = m

    var email = normalizeStr(m.get("email"))
    if (email) byEmail[email] = m

    var fn = normalizeStr(m.get("first_name"))
    var ln = normalizeStr(m.get("last_name"))
    var bd = m.get("birthdate") || ""
    // Normalize birthdate to YYYY-MM-DD if it's a full ISO string
    if (bd && bd.length > 10) bd = bd.substring(0, 10)

    if (fn || ln) {
      var nameKey = fn + "|" + ln
      byName[nameKey] = m
      if (bd) {
        byNameDob[nameKey + "|" + bd] = m
      }
    }
  }

  var membersCol = $app.findCollectionByNameOrId("members")
  var created = 0
  var updated = 0
  var skipped = 0
  var errors = 0
  var details = []

  for (var i = 0; i < rows.length; i++) {
    try {
      var mapped = mapRow(rows[i])

      // Skip empty rows
      if (!mapped.first_name && !mapped.last_name) {
        skipped++
        details.push({ row: i + 2, action: "skipped", reason: "empty name" })
        continue
      }

      // Volleyball filter
      if (hasGroups && !isVolleyball(mapped._groups)) {
        skipped++
        details.push({ row: i + 2, action: "skipped", name: mapped.name, reason: "not volleyball (" + mapped._groups + ")" })
        continue
      }

      var match = findExistingMember(mapped, byClubDeskId, byEmail, byNameDob, byName)

      if (match) {
        // Update: only fill blank fields (non-destructive)
        var existing = match.member
        var updates = {}

        if (mapped.email && !existing.get("email")) updates["email"] = mapped.email
        if (mapped.phone && !existing.get("phone")) updates["phone"] = mapped.phone
        if (mapped.birthdate && !existing.get("birthdate")) updates["birthdate"] = mapped.birthdate
        if (mapped.yob && !existing.get("yob")) updates["yob"] = mapped.yob
        if (mapped.clubdesk_id && !existing.get("clubdesk_id")) updates["clubdesk_id"] = mapped.clubdesk_id

        if (Object.keys(updates).length > 0) {
          for (var key in updates) {
            existing.set(key, updates[key])
          }
          $app.save(existing)
          updated++
          details.push({
            row: i + 2,
            action: "updated",
            name: mapped.name,
            via: match.via,
            fields: Object.keys(updates),
          })
        } else {
          skipped++
          details.push({
            row: i + 2,
            action: "skipped",
            name: mapped.name,
            via: match.via,
            reason: "no new data",
          })
        }
      } else {
        // Create new member
        var record = new Record(membersCol)
        var emailToUse = mapped.email || generatePlaceholderEmail(mapped.first_name, mapped.last_name)
        record.set("email", emailToUse)
        record.set("first_name", mapped.first_name)
        record.set("last_name", mapped.last_name)
        record.set("name", mapped.name)
        record.set("phone", mapped.phone)
        record.set("birthdate", mapped.birthdate || null)
        record.set("yob", mapped.yob)
        record.set("clubdesk_id", mapped.clubdesk_id)
        record.set("role", ["player"])
        record.set("active", true)
        record.set("member_active", false)

        // Auth collection requires a password
        record.setPassword(generatePassword())

        $app.save(record)
        created++
        details.push({ row: i + 2, action: "created", name: mapped.name })

        // Update lookup maps for dedup within batch
        if (mapped.email) byEmail[mapped.email] = record
        var nk = normalizeStr(mapped.first_name) + "|" + normalizeStr(mapped.last_name)
        if (nk !== "|") byName[nk] = record
        if (mapped.clubdesk_id) byClubDeskId[mapped.clubdesk_id] = record
        if (mapped.birthdate) byNameDob[nk + "|" + mapped.birthdate] = record
      }
    } catch (e) {
      errors++
      var rowName = ""
      try { rowName = (rows[i]["Vorname"] || "") + " " + (rows[i]["Nachname"] || "") } catch (_) {}
      details.push({ row: i + 2, action: "error", name: rowName, error: String(e) })
      console.log("[ClubDesk Sync] Error on row " + (i + 2) + ": " + e)
    }
  }

  console.log("[ClubDesk Sync] Complete: " + created + " created, " + updated + " updated, " + skipped + " skipped, " + errors + " errors")

  return {
    created: created,
    updated: updated,
    skipped: skipped,
    errors: errors,
    details: details,
  }
}

function generatePlaceholderEmail(firstName, lastName) {
  var fn = (firstName || "unknown").toLowerCase().replace(/[^a-z]/g, "")
  var ln = (lastName || "unknown").toLowerCase().replace(/[^a-z]/g, "")
  return fn + "." + ln + "@placeholder.kscw.ch"
}

function generatePassword() {
  var chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$"
  var pwd = "Tmp_"
  for (var i = 0; i < 16; i++) {
    var idx = Math.floor(Math.random() * chars.length)
    pwd += chars.charAt(idx)
  }
  return pwd
}

module.exports = {
  syncMembers: syncMembers,
  parseCSV: parseCSV,
}
