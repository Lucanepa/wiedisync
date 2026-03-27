/// <reference path="../pb_data/types.d.ts" />

// Audit log API — read and search audit log files.
// SuperAdmin-only. Reads from pb_data/audit.log + pb_data/audit_archive/*.

routerAdd("POST", "/api/admin/audit", function(e) {
  var lib = require(__hooks + "/audit_api_lib.js")
  lib.requireSuperAdmin(e)

  var body = $apis.requestInfo(e).body || {}
  var collection = body.collection || ""
  var action = body.action || ""
  var level = body.level || ""
  var actor = body.actor || ""
  var recordId = body.record_id || ""
  var search = body.search || ""
  var from = body.from || ""
  var to = body.to || ""
  var page = parseInt(body.page) || 1
  var perPage = parseInt(body.per_page) || 100

  if (perPage > 500) perPage = 500

  var LOG_PATH = $os.getenv("AUDIT_LOG_PATH") || ($app.dataDir() + "/audit.log")
  var ARCHIVE_DIR = $app.dataDir() + "/audit_archive"

  // Collect all log files to search (current + archives)
  var files = []

  // Current log
  try {
    $os.stat(LOG_PATH)
    files.push(LOG_PATH)
  } catch (_) {}

  // Archive files
  try {
    var entries = $os.readDir(ARCHIVE_DIR)
    for (var i = 0; i < entries.length; i++) {
      var name = entries[i].name()
      if (name.match(/^audit\.\d{4}-\d{2}-\d{2}\.log$/)) {
        files.push(ARCHIVE_DIR + "/" + name)
      }
    }
  } catch (_) {}

  // Date range filtering for file selection (optimization)
  if (from) {
    var fromDate = from.substring(0, 10) // YYYY-MM-DD
    files = files.filter(function(f) {
      if (f === LOG_PATH) return true
      var match = f.match(/audit\.(\d{4}-\d{2}-\d{2})\.log$/)
      return match ? match[1] >= fromDate : true
    })
  }
  if (to) {
    var toDate = to.substring(0, 10)
    files = files.filter(function(f) {
      if (f === LOG_PATH) return true
      var match = f.match(/audit\.(\d{4}-\d{2}-\d{2})\.log$/)
      return match ? match[1] <= toDate : true
    })
  }

  // Parse and filter all matching lines
  var allItems = []

  for (var fi = 0; fi < files.length; fi++) {
    try {
      var content = String($os.readFile(files[fi]))
      var lines = content.split("\n")

      for (var li = 0; li < lines.length; li++) {
        var line = lines[li].trim()
        if (!line) continue

        try {
          var entry = JSON.parse(line)
        } catch (_) {
          continue
        }

        // Apply filters
        if (collection && entry.collection !== collection) continue
        if (action && entry.action !== action) continue
        if (level && entry.level !== level) continue
        if (actor && entry.actor !== actor) continue
        if (recordId && entry.record_id !== recordId) continue
        if (from && entry.ts < from) continue
        if (to && entry.ts > to) continue
        if (search) {
          var detailStr = JSON.stringify(entry.details || {})
          if (detailStr.toLowerCase().indexOf(search.toLowerCase()) === -1) continue
        }

        allItems.push(entry)
      }
    } catch (_) {
      // File read error, skip
    }
  }

  // Sort by timestamp descending (newest first)
  allItems.sort(function(a, b) {
    return a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0
  })

  // Paginate
  var total = allItems.length
  var startIdx = (page - 1) * perPage
  var items = allItems.slice(startIdx, startIdx + perPage)

  // Collect available collections for filter dropdown
  var collections = {}
  for (var ci = 0; ci < allItems.length; ci++) {
    collections[allItems[ci].collection] = true
  }

  return e.json(200, {
    items: items,
    total: total,
    page: page,
    perPage: perPage,
    totalPages: Math.ceil(total / perPage),
    collections: Object.keys(collections).sort(),
  })
})

// Get audit log stats (summary for header)
routerAdd("GET", "/api/admin/audit/stats", function(e) {
  var lib = require(__hooks + "/audit_api_lib.js")
  lib.requireSuperAdmin(e)

  var LOG_PATH = $os.getenv("AUDIT_LOG_PATH") || ($app.dataDir() + "/audit.log")
  var ARCHIVE_DIR = $app.dataDir() + "/audit_archive"

  var archiveCount = 0
  try {
    var entries = $os.readDir(ARCHIVE_DIR)
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].name().match(/^audit\.\d{4}-\d{2}-\d{2}\.log$/)) {
        archiveCount++
      }
    }
  } catch (_) {}

  var todayCount = 0
  var errorCount = 0
  try {
    var content = String($os.readFile(LOG_PATH))
    var lines = content.split("\n")
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim()
      if (!line) continue
      todayCount++
      if (line.indexOf('"error"') !== -1) errorCount++
    }
  } catch (_) {}

  return e.json(200, {
    today_events: todayCount,
    today_errors: errorCount,
    archive_days: archiveCount,
  })
})
