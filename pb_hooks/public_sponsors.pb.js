/// <reference path="../node_modules/pocketbase/dist/pocketbase.d.ts" />

// Public sponsors endpoint: GET /api/public/sponsors
// Returns all active sponsors sorted by sort_order (no auth required).
//
// Response: {
//   sponsors: [{ id, name, logo_url, website_url }]
// }

routerAdd("GET", "/api/public/sponsors", function (e) {
  var collection
  try {
    collection = $app.findCollectionByNameOrId("sponsors")
  } catch (err) {
    throw new NotFoundError("Sponsors collection not found")
  }

  var collectionId = collection.id
  var records

  try {
    records = $app.findRecordsByFilter(
      "sponsors",
      'active = true',
      "sort_order",
      200,
      0
    )
  } catch (err) {
    // No sponsors found — return empty array
    e.json(200, { sponsors: [] })
    return
  }

  var sponsors = []
  for (var i = 0; i < records.length; i++) {
    var rec = records[i]
    var logo = rec.getString("logo")
    var logoUrl = ""
    if (logo) {
      logoUrl = "/api/files/" + collectionId + "/" + rec.id + "/" + logo
    }

    sponsors.push({
      id: rec.id,
      name: rec.getString("name"),
      logo_url: logoUrl,
      website_url: rec.getString("website_url"),
      teams: rec.get("teams") || [],
      team_page_only: rec.getBool("team_page_only"),
    })
  }

  e.json(200, { sponsors: sponsors })
})
