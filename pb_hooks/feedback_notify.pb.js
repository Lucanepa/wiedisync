/// <reference path="../pb_data/types.d.ts" />

// ─── Feedback: Email Notification + GitHub Issue Creation ───
// After a feedback record is created:
// 1. Send email notification to admin
// 2. If type is bug or feature: auto-create GitHub Issue in the correct repo
//
// Env vars required:
//   FEEDBACK_ADMIN_EMAIL — admin email for notifications
//   GITHUB_PAT — GitHub Personal Access Token with repo scope

onRecordAfterCreateSuccess((e) => {
  var record = e.record
  var type = record.get("type")
  var title = record.get("title")
  var description = record.get("description")
  var source = record.get("source")
  var sourceUrl = record.get("source_url") || ""
  var screenshot = record.get("screenshot")

  // Determine submitter info
  var submitter = "Anonymous"
  var userId = record.get("user")
  if (userId) {
    try {
      var user = $app.findRecordById("members", userId)
      submitter = user.get("name") || user.get("email") || "Member"
    } catch (_) {}
  } else {
    var name = record.get("name")
    var email = record.get("email")
    if (name && email) submitter = name + " (" + email + ")"
    else if (name) submitter = name
    else if (email) submitter = email
  }

  // Screenshot URL
  var screenshotUrl = ""
  if (screenshot) {
    screenshotUrl = $app.settings().meta.appURL
      + "/api/files/" + record.collection().name
      + "/" + record.id + "/" + screenshot
  }

  // ── 1. Send email notification ─────────────────────────────────────
  var adminEmail = $os.getenv("FEEDBACK_ADMIN_EMAIL")
  if (adminEmail) {
    var typeLabel = type.charAt(0).toUpperCase() + type.slice(1)
    try {
      var mail = new MailerMessage()
      mail.from = {
        address: $app.settings().meta.senderAddress,
        name: $app.settings().meta.senderName,
      }
      mail.to = [{ address: adminEmail }]
      mail.subject = "[KSCW Feedback] " + typeLabel + ": " + title
      mail.text = typeLabel + ": " + title + "\n\n"
        + "Type: " + type + "\n"
        + "Source: " + source + "\n"
        + (sourceUrl ? "URL: " + sourceUrl + "\n" : "")
        + "Submitted by: " + submitter + "\n"
        + "\n---\n\n"
        + description
        + (screenshotUrl ? "\n\n---\nScreenshot: " + screenshotUrl : "")
        + "\n\n---\nView in PocketBase: "
        + $app.settings().meta.appURL + "/_/#/collections/feedback/records/" + record.id
      $app.newMailClient().send(mail)
      console.log("[feedback-notify] Email sent to " + adminEmail)
    } catch (err) {
      console.log("[feedback-notify] Email failed: " + err)
    }
  } else {
    console.log("[feedback-notify] FEEDBACK_ADMIN_EMAIL not set, skipping email")
  }

  // ── 2. Create GitHub Issue (bugs + features only) ──────────────────
  if (type === "bug" || type === "feature") {
    var ghToken = $os.getenv("GITHUB_PAT")
    if (!ghToken) {
      console.log("[feedback-notify] GITHUB_PAT not set, skipping issue creation")
      return
    }

    var repo = source === "website" ? "Lucanepa/kscw-website" : "Lucanepa/kscw"
    var prefix = type === "bug" ? "[Bug]" : "[Feature]"
    var labels = type === "bug"
      ? ["bug", "user-reported"]
      : ["enhancement", "user-reported"]

    var body = "**Type:** " + type + "\n"
      + "**Source:** " + source + "\n"
      + (sourceUrl ? "**URL:** " + sourceUrl + "\n" : "")
      + "**Submitted by:** " + submitter + "\n"
      + "\n---\n\n"
      + description
      + (screenshotUrl ? "\n\n---\n\n**Screenshot:** ![](" + screenshotUrl + ")" : "")
      + "\n\n---\n*Submitted via KSCW Feedback System*"

    try {
      var res = $http.send({
        url: "https://api.github.com/repos/" + repo + "/issues",
        method: "POST",
        headers: {
          "Authorization": "Bearer " + ghToken,
          "Accept": "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: prefix + " " + title,
          body: body,
          labels: labels,
        }),
      })

      var issue = JSON.parse(res.raw)
      if (issue.html_url) {
        record.set("github_issue", issue.html_url)
        record.set("status", "github")
        $app.save(record)
        console.log("[feedback-notify] GitHub issue created: " + issue.html_url)
      } else {
        console.log("[feedback-notify] GitHub API response missing html_url: " + res.raw)
      }
    } catch (err) {
      console.log("[feedback-notify] GitHub issue creation failed: " + err)
      // Record stays with status "new" — cron can retry later
    }
  }
}, "feedback")
