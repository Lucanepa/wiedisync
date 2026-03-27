// Audit API helpers — shared across callbacks in audit_api.pb.js

var requireSuperAdmin = function(e) {
  var info = e.requestInfo()
  if (!info.auth) {
    throw new UnauthorizedError("Authentication required")
  }
  var authorized = false
  // Check member superuser role
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
    throw new ForbiddenError("Superadmin access required")
  }
}

module.exports = {
  requireSuperAdmin: requireSuperAdmin,
}
