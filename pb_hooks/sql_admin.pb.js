/// <reference path="../node_modules/pocketbase/dist/pocketbase.d.ts" />

// SQL Admin hook — raw SQL execution for superadmins
// POST /api/admin/sql  { query: "SELECT ..." }
// Auth: PB superuser OR member with superadmin role

routerAdd("POST", "/api/admin/sql", function(e) {
  // ── Auth check ──────────────────────────────────────────────────
  var info = e.requestInfo()
  if (!info.auth) {
    $app.logger().warn("SQL admin: unauthenticated access attempt", "ip", e.remoteIP())
    e.json(401, { success: false, error: "Authentication required" })
    return
  }

  var authorized = false

  // Check member superadmin role
  try {
    var roles = info.auth.get("role")
    if (roles) {
      for (var i = 0; i < roles.length; i++) {
        if (roles[i] === "superuser") authorized = true
      }
    }
  } catch (_) {}

  // Check PB superuser
  if (!authorized) {
    try {
      $app.findRecordById("_superusers", info.auth.id)
      authorized = true
    } catch (_) {}
  }

  if (!authorized) {
    $app.logger().warn("SQL admin: unauthorized access attempt", "user", info.auth.id, "ip", e.remoteIP())
    e.json(403, { success: false, error: "Superadmin role required" })
    return
  }

  // ── Execute SQL ─────────────────────────────────────────────────
  var query = ""
  if (info.body && info.body.query) {
    query = String(info.body.query).trim()
  }

  if (!query) {
    e.json(400, { success: false, error: "SQL query required" })
    return
  }

  var upperQuery = query.toUpperCase().replace(/^\s+/, "")
  var isSelect = upperQuery.indexOf("SELECT") === 0 ||
                 upperQuery.indexOf("PRAGMA") === 0 ||
                 upperQuery.indexOf("EXPLAIN") === 0 ||
                 upperQuery.indexOf("WITH") === 0
  var isPragma = upperQuery.indexOf("PRAGMA") === 0 ||
                 upperQuery.indexOf("EXPLAIN") === 0

  $app.logger().info("SQL admin: query executed", "user", info.auth.id, "type", isSelect ? "read" : "write", "query", query.substring(0, 200))

  try {
    if (isSelect) {
      // Step 1: Discover column names via rows() interface
      // DynamicModel({}) panics with empty object — must know columns first
      var colRows
      if (isPragma) {
        colRows = $app.db().newQuery(query).rows()
      } else {
        var colQuery = "SELECT * FROM (" + query.replace(/;\s*$/, "") + ") LIMIT 0"
        colRows = $app.db().newQuery(colQuery).rows()
      }
      var columns = colRows.columns()
      colRows.close()

      if (!columns || columns.length === 0) {
        e.json(200, { success: true, columns: [], rows: [], rowCount: 0 })
        return
      }

      // Step 2: Build DynamicModel template from discovered columns
      var template = {}
      for (var c = 0; c < columns.length; c++) {
        template[columns[c]] = ""
      }

      // Safety: auto-append LIMIT 1000 if no LIMIT clause (skip for PRAGMA)
      var execQuery = query
      if (!isPragma) {
        var hasLimit = /\bLIMIT\s+\d+/i.test(query)
        if (!hasLimit) {
          execQuery = query.replace(/;\s*$/, "") + " LIMIT 1000"
        }
      }

      var result = arrayOf(new DynamicModel(template))
      $app.db().newQuery(execQuery).all(result)

      var rows = []
      for (var i = 0; i < result.length; i++) {
        var row = JSON.parse(JSON.stringify(result[i]))
        var rowArr = []
        for (var j = 0; j < columns.length; j++) {
          rowArr.push(row[columns[j]])
        }
        rows.push(rowArr)
      }

      e.json(200, {
        success: true,
        columns: columns,
        rows: rows,
        rowCount: rows.length,
      })
    } else {
      // INSERT / UPDATE / DELETE / CREATE / ALTER / DROP
      var dbResult = $app.db().newQuery(query).execute()
      var affected = 0
      try { affected = dbResult.rowsAffected() } catch (_) {}

      e.json(200, {
        success: true,
        columns: ["affected_rows"],
        rows: [[affected]],
        rowCount: 1,
        message: "Query executed. Rows affected: " + affected,
      })
    }
  } catch (err) {
    e.json(200, {
      success: false,
      error: String(err),
      columns: [],
      rows: [],
      rowCount: 0,
    })
  }
})
