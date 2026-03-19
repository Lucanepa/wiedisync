// Shared KSCW email template library
// Provides branded dark-mode email layout, components, and helpers
// Usage: var tpl = require(__hooks + "/email_template_lib.js")
//
// All functions use ES5 (goja compatible) — no const/let/arrow/template literals

// ── Constants ──────────────────────────────────────────────────────────

var ACCENT_COLORS = {
  vb: "#FFC832",    // gold (volleyball)
  bb: "#F97316",    // orange (basketball)
  neutral: "#4A55A2" // navy (brand)
}

var LOGO_IMG = '<img src="https://wiedisync.kscw.ch/wiedisync_logo.svg" alt="KSC Wiedikon" width="48" height="52" style="width:48px;height:52px">'

var VB_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="44" height="44" fill="none" stroke-linecap="round" stroke-linejoin="round">' +
  '<circle cx="12" cy="12" r="10" fill="#FFC832" stroke="#4A55A2" stroke-width="1.5"/>' +
  '<path d="M11.1 7.1a16.55 16.55 0 0 1 10.9 4" stroke="#4A55A2" stroke-width="1.5"/>' +
  '<path d="M12 12a12.6 12.6 0 0 1-8.7 5" stroke="#4A55A2" stroke-width="1.5"/>' +
  '<path d="M16.8 13.6a16.55 16.55 0 0 1-9 7.5" stroke="#4A55A2" stroke-width="1.5"/>' +
  '<path d="M20.7 17a12.8 12.8 0 0 0-8.7-5 13.3 13.3 0 0 1 0-10" stroke="#4A55A2" stroke-width="1.5"/>' +
  '<path d="M6.3 3.8a16.55 16.55 0 0 0 1.9 11.5" stroke="#4A55A2" stroke-width="1.5"/>' +
  '</svg>'

var BB_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="44" height="44" fill="none" stroke="#1a1a1a" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' +
  '<circle cx="12" cy="12" r="10" fill="#F97316"/>' +
  '<path d="M4.93 4.93c4.08 2.64 8.74 3.2 14.14 0"/>' +
  '<path d="M4.93 19.07c4.08-2.64 8.74-3.2 14.14 0"/>' +
  '<line x1="12" y1="2" x2="12" y2="22"/>' +
  '<line x1="2" y1="12" x2="22" y2="12"/>' +
  '</svg>'

function sportIcon(sport) {
  if (sport === "bb") return BB_ICON
  if (sport === "vb") return VB_ICON
  return ""
}

// ── Date / time helpers ────────────────────────────────────────────────

function formatDateCH(isoDate) {
  var d = new Date(isoDate)
  var dd = String(d.getUTCDate()).padStart(2, "0")
  var mm = String(d.getUTCMonth() + 1).padStart(2, "0")
  var yy = d.getUTCFullYear()
  return dd + "." + mm + "." + yy
}

function weekday(isoDate, lang) {
  var de = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"]
  var en = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
  var d = new Date(isoDate)
  return lang === "en" ? en[d.getUTCDay()] : de[d.getUTCDay()]
}

function formatTime(t) {
  return t ? t.slice(0, 5) : ""
}

// ── Components ─────────────────────────────────────────────────────────

// Inline pill badge (e.g. role badges)
function buildBadge(text, color) {
  return '<span style="display:inline-block;background:' + (color || "#4A55A2") +
    ';color:#fff;font-size:12px;font-weight:600;padding:4px 12px;border-radius:20px;letter-spacing:0.3px">' +
    text + '</span>'
}

// Info card with label/value rows (dark card-in-card)
// rows: [{ label: "Datum", value: "12.03.2026", halfWidth: true }, ...]
function buildInfoCard(rows) {
  if (!rows || rows.length === 0) return ""

  var html = '<table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;border:1px solid #334155;border-radius:8px;overflow:hidden">'

  // Check if we have half-width pairs
  var i = 0
  html += '<tr><td style="padding:16px 20px">' +
    '<table width="100%" cellpadding="0" cellspacing="0">'

  while (i < rows.length) {
    var row = rows[i]
    var next = (i + 1 < rows.length) ? rows[i + 1] : null

    // Two half-width columns side by side
    if (row.halfWidth && next && next.halfWidth) {
      html += '<tr>' +
        '<td style="width:50%;vertical-align:top;padding:0 8px 10px 0">' +
        '<div style="font-size:11px;text-transform:uppercase;color:#64748b;letter-spacing:0.5px;margin-bottom:2px">' + row.label + '</div>' +
        '<div style="font-size:14px;font-weight:600;color:#e2e8f0">' + row.value + '</div>' +
        '</td>' +
        '<td style="width:50%;vertical-align:top;padding:0 0 10px 8px">' +
        '<div style="font-size:11px;text-transform:uppercase;color:#64748b;letter-spacing:0.5px;margin-bottom:2px">' + next.label + '</div>' +
        '<div style="font-size:14px;font-weight:600;color:#e2e8f0">' + next.value + '</div>' +
        '</td>' +
        '</tr>'
      i += 2
    } else {
      // Full-width row
      html += '<tr><td colspan="2" style="padding:0 0 10px">' +
        '<div style="font-size:11px;text-transform:uppercase;color:#64748b;letter-spacing:0.5px;margin-bottom:2px">' + row.label + '</div>' +
        '<div style="font-size:14px;font-weight:600;color:#e2e8f0">' + row.value + '</div>' +
        '</td></tr>'
      i += 1
    }
  }

  html += '</table></td></tr></table>'
  return html
}

// Alert box: "info" (blue), "warning" (red), "success" (green)
function buildAlertBox(type, title, text) {
  var bg, border, titleColor, textColor
  if (type === "warning") {
    bg = "#450a0a"; border = "#7f1d1d"; titleColor = "#f87171"; textColor = "#fca5a5"
  } else if (type === "success") {
    bg = "#052e16"; border = "#166534"; titleColor = "#4ade80"; textColor = "#86efac"
  } else {
    // info (default)
    bg = "#172554"; border = "#1e3a5f"; titleColor = "#60a5fa"; textColor = "#93c5fd"
  }

  return '<table width="100%" cellpadding="0" cellspacing="0" style="background:' + bg + ';border:1px solid ' + border + ';border-radius:8px">' +
    '<tr><td style="padding:12px 16px">' +
    '<div style="font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:' + titleColor + ';font-weight:700;margin-bottom:4px">' + title + '</div>' +
    '<div style="font-size:13px;color:' + textColor + '">' + text + '</div>' +
    '</td></tr></table>'
}

// CTA button (textColor defaults to white, override for light backgrounds)
function buildCtaButton(url, label, color, textColor) {
  var btnColor = color || "#4A55A2"
  var txtColor = textColor || "#ffffff"
  return '<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:4px 0 8px">' +
    '<a href="' + url + '" style="display:inline-block;background:' + btnColor +
    ';color:' + txtColor + ';font-size:14px;font-weight:600;padding:12px 28px;border-radius:8px;text-decoration:none;letter-spacing:0.2px">' +
    label + '</a>' +
    '</td></tr></table>'
}

// Text paragraph (for body content)
function buildParagraph(text, options) {
  var color = (options && options.color) || "#e2e8f0"
  var size = (options && options.size) || "14px"
  var align = (options && options.align) || "left"
  var marginBottom = (options && options.marginBottom) || "12px"
  return '<div style="font-size:' + size + ';color:' + color + ';text-align:' + align + ';margin-bottom:' + marginBottom + '">' + text + '</div>'
}

// Divider line
function buildDivider() {
  return '<div style="border-top:1px solid #334155;margin:8px 0"></div>'
}

// ── Main layout wrapper ────────────────────────────────────────────────

// Wraps body HTML in the branded email chrome
// options: { lang, sport, title, subtitle, ctaUrl, ctaLabel, ctaColor, showLogo, greeting, footerExtra }
function buildEmailLayout(bodyHtml, options) {
  var opts = options || {}
  var lang = opts.lang || "de"
  var sport = opts.sport || null
  var accentColor = sport ? (ACCENT_COLORS[sport] || ACCENT_COLORS.neutral) : ACCENT_COLORS.neutral
  var showLogo = opts.showLogo !== false
  var title = opts.title || ""
  var subtitle = opts.subtitle || ""
  var greeting = opts.greeting || ""

  var html = '<!DOCTYPE html>' +
    '<html lang="' + lang + '"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>' +
    '<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif">' +
    '<table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:24px 0">' +
    '<tr><td align="center">' +
    '<table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#1e293b;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.3)">'

  // Accent stripe
  html += '<tr><td style="background:' + accentColor + ';height:4px;font-size:0;line-height:0">&nbsp;</td></tr>'

  // Header with logo + title
  if (showLogo || title) {
    html += '<tr><td style="background:#1e293b;padding:28px 28px 20px;text-align:center">'
    var icon = sport ? sportIcon(sport) : ""
    if (showLogo && icon) {
      html += '<table cellpadding="0" cellspacing="0" style="margin:0 auto"><tr>' +
        '<td style="vertical-align:middle;padding-right:12px">' + LOGO_IMG + '</td>' +
        '<td style="vertical-align:middle">' + icon + '</td>' +
        '</tr></table>'
    } else if (showLogo) {
      html += '<div style="text-align:center">' + LOGO_IMG + '</div>'
    }
    if (title) html += '<div style="font-size:22px;font-weight:700;color:#ffffff;margin-top:8px">' + title + '</div>'
    if (subtitle) html += '<div style="font-size:14px;color:#94a3b8;margin-top:4px">' + subtitle + '</div>'
    html += '</td></tr>'
  }

  // Greeting
  if (greeting) {
    html += '<tr><td style="padding:4px 28px 12px">' +
      '<div style="font-size:15px;color:#e2e8f0">' + greeting + '</div>' +
      '</td></tr>'
  }

  // Body content
  html += '<tr><td style="padding:4px 28px 20px">' + bodyHtml + '</td></tr>'

  // CTA button
  if (opts.ctaUrl && opts.ctaLabel) {
    html += '<tr><td style="padding:0 28px 20px">' +
      buildCtaButton(opts.ctaUrl, opts.ctaLabel, opts.ctaColor || accentColor, opts.ctaTextColor || "#000000") +
      '</td></tr>'
  }

  // Footer extra text (e.g. "Vielen Dank!")
  if (opts.footerExtra) {
    html += '<tr><td style="padding:0 28px 20px;text-align:center">' +
      '<div style="font-size:13px;color:#94a3b8">' + opts.footerExtra + '</div>' +
      '</td></tr>'
  }

  // Bottom bar
  html += '<tr><td style="background:#0f172a;border-top:1px solid #334155;padding:14px 28px;text-align:center">' +
    '<div style="font-size:11px;color:#64748b">KSC Wiedikon &middot; <a href="https://wiedisync.kscw.ch" style="color:#64748b;text-decoration:none">wiedisync.kscw.ch</a></div>' +
    '</td></tr>'

  html += '</table></td></tr></table></body></html>'

  return html
}

// ── Plain text layout ──────────────────────────────────────────────────

// lines: array of strings, options: { title, url }
function buildPlainLayout(lines, options) {
  var opts = options || {}
  var out = []

  if (opts.title) {
    out.push(opts.title)
    out.push("─".repeat ? "────────────────────" : "--------------------")
    out.push("")
  }

  for (var i = 0; i < lines.length; i++) {
    out.push(lines[i])
  }

  out.push("")
  if (opts.url) out.push(opts.url)
  out.push("")
  out.push("KSC Wiedikon")
  out.push("wiedisync.kscw.ch")

  return out.join("\r\n")
}

// ── Exports ────────────────────────────────────────────────────────────

module.exports = {
  // Constants
  ACCENT_COLORS: ACCENT_COLORS,
  LOGO_IMG: LOGO_IMG,
  VB_ICON: VB_ICON,
  BB_ICON: BB_ICON,
  sportIcon: sportIcon,
  // Helpers
  formatDateCH: formatDateCH,
  weekday: weekday,
  formatTime: formatTime,
  // Components
  buildBadge: buildBadge,
  buildInfoCard: buildInfoCard,
  buildAlertBox: buildAlertBox,
  buildCtaButton: buildCtaButton,
  buildParagraph: buildParagraph,
  buildDivider: buildDivider,
  // Layouts
  buildEmailLayout: buildEmailLayout,
  buildPlainLayout: buildPlainLayout,
}
