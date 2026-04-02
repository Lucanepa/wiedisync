/**
 * Monthly Newsletter Digest
 * POST /kscw/newsletter/digest — triggered by Directus Flow cron (1st of month)
 * Gathers news, game results, upcoming games, events from last/next 30 days.
 * Calls Claude API for locale-specific editorial summaries.
 * Sends branded HTML emails filtered by subscriber category preferences.
 */

import { buildEmailLayout, formatDateCH, FRONTEND_URL } from './email-template.js';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const WEBSITE_URL = process.env.KSCW_WEBSITE_URL || 'https://kscw-website.pages.dev';

async function generateSummary(locale, data, monthLabel, year) {
  if (!ANTHROPIC_API_KEY) return null;
  try {
    const baseUrl = WEBSITE_URL;
    const prompt = locale === 'de'
      ? `Schreibe eine 3-4 Sätze lange Einleitung für den KSCW Newsletter für ${monthLabel} ${year} auf Deutsch. Verwende VOLLSTÄNDIGE inline HTML-Links (<a href="https://...">) mit der Basis-URL ${baseUrl}. Beispiele: <a href="${baseUrl}/de/volleyball/">Volleyball</a>, <a href="${baseUrl}/de/basketball/">Basketball</a>, <a href="${baseUrl}/de/weiteres/kalender">Kalender</a>, <a href="${baseUrl}/de/news/">News</a>, <a href="${baseUrl}/de/volleyball/d1">Damen 1</a>. Schreibe enthusiastisch aber sachlich. Sage NICHT "April" oder den aktuellen Monat — es geht um ${monthLabel} ${year}. Kein Markdown, nur HTML. Hier sind die Highlights: ${JSON.stringify(data)}`
      : `Write a 3-4 sentence intro for the KSCW newsletter covering ${monthLabel} ${year} in English. Use FULL inline HTML links (<a href="https://...">) with base URL ${baseUrl}. Examples: <a href="${baseUrl}/en/volleyball/">volleyball</a>, <a href="${baseUrl}/en/basketball/">basketball</a>, <a href="${baseUrl}/en/weiteres/kalender">calendar</a>, <a href="${baseUrl}/en/news/">news</a>, <a href="${baseUrl}/en/volleyball/d1">Damen 1</a>. Write enthusiastically but factually. Do NOT mention the current month — this covers ${monthLabel} ${year}. No markdown, only HTML. Here are the highlights: ${JSON.stringify(data)}`;

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    const result = await resp.json();
    if (result.error) {
      console.error('Claude API error:', result.error.message || JSON.stringify(result.error));
      return null;
    }
    return result.content?.[0]?.text || null;
  } catch (err) {
    console.error('Claude API call failed:', err.message);
    return null;
  }
}

function buildGameCard(g, showScore) {
  const time = g.time ? g.time.slice(0, 5) : '';
  const dateStr = formatDateCH(g.date);
  const isVB = g.league && !/liga.*basket|sbl|lnb|proball/i.test(g.league);
  const sportColor = isVB ? '#FFC832' : '#F97316';

  // Determine winner for color highlighting
  const homeScore = g.home_score ?? null;
  const awayScore = g.away_score ?? null;
  const homeWon = homeScore !== null && awayScore !== null && homeScore > awayScore;
  const awayWon = homeScore !== null && awayScore !== null && awayScore > homeScore;
  const winColor = '#22c55e';
  const loseColor = '#ef4444';

  // KSCW team is bold
  const isKscwHome = g.type === 'home';
  const homeBold = isKscwHome ? 'font-weight:700;color:#ffffff' : 'color:#94a3b8';
  const awayBold = !isKscwHome ? 'font-weight:700;color:#ffffff' : 'color:#94a3b8';

  // Score colors
  const homeScoreStyle = showScore && homeWon ? `color:${winColor};font-weight:800` : showScore && awayWon ? `color:${loseColor};font-weight:700` : 'color:#e2e8f0;font-weight:700';
  const awayScoreStyle = showScore && awayWon ? `color:${winColor};font-weight:800` : showScore && homeWon ? `color:${loseColor};font-weight:700` : 'color:#e2e8f0;font-weight:700';

  // League badge
  const leagueShort = g.league ? g.league.replace(/Gruppe?\s*/i, '').slice(0, 12) : '';

  let card = `<table width="100%" cellpadding="0" cellspacing="0" style="border-bottom:1px solid #334155;margin-bottom:2px"><tr>`;

  // Left: date + time
  card += `<td style="vertical-align:top;padding:10px 8px 10px 0;width:70px"><div style="font-size:12px;color:#64748b">${dateStr}</div>`;
  if (time) card += `<div style="font-size:11px;color:#475569">${time}</div>`;
  card += `</td>`;

  // (sport dot removed — games grouped by sport section instead)

  // Score column (separate from team names)
  if (showScore) {
    card += `<td style="vertical-align:top;padding:8px 6px 8px 0;width:28px;text-align:right">`;
    card += `<div style="font-size:13px;line-height:1.5;${homeScoreStyle}">${homeScore ?? '-'}</div>`;
    card += `<div style="font-size:13px;line-height:1.5;${awayScoreStyle}">${awayScore ?? '-'}</div>`;
    card += `</td>`;
  }

  // Team names column
  card += `<td style="vertical-align:top;padding:8px 0">`;
  card += `<div style="font-size:13px;line-height:1.5;${homeBold}">${g.home_team}</div>`;
  card += `<div style="font-size:13px;line-height:1.5;${awayBold}">${g.away_team}</div>`;
  card += `</td>`;

  // League badge
  if (leagueShort) {
    card += `<td style="vertical-align:top;padding:12px 0 10px;width:70px;text-align:right"><span style="font-size:10px;color:#64748b;border:1px solid #334155;border-radius:4px;padding:2px 6px;white-space:nowrap">${leagueShort}</span></td>`;
  }

  card += `</tr></table>`;
  return card;
}

function buildDigestHtml(locale, summary, news, results, upcoming, events, unsubUrl) {
  const t = (de, en) => locale === 'de' ? de : en;
  let body = '';

  // AI Summary
  if (summary) {
    body += `<div style="font-size:15px;color:#e2e8f0;line-height:1.6;margin-bottom:20px;padding:16px;background:#0f172a;border-radius:8px;border-left:3px solid #FFC832">${summary}</div>`;
  }

  // News section
  if (news.length > 0) {
    body += `<div style="font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#64748b;font-weight:700;margin:20px 0 8px">News</div>`;
    for (const n of news) {
      const link = `${WEBSITE_URL}/${locale}/news/?article=${n.slug}`;
      const title = (locale === 'en' && n.title_en) ? n.title_en : n.title;
      body += `<div style="padding:8px 0;border-bottom:1px solid #334155"><a href="${link}" style="color:#60a5fa;text-decoration:none;font-weight:600;font-size:14px">${title}</a>`;
      // Only show excerpt for DE (no English excerpt available)
      if (locale === 'de' && n.excerpt) body += `<div style="color:#94a3b8;font-size:13px;margin-top:2px">${n.excerpt}</div>`;
      body += '</div>';
    }
  }

  // Results section — grouped by sport
  if (results.length > 0) {
    body += `<div style="font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#64748b;font-weight:700;margin:20px 0 12px">${t('Resultate', 'Results')}</div>`;
    const vbResults = results.filter(g => !g._sport || g._sport === 'volleyball');
    const bbResults = results.filter(g => g._sport === 'basketball');
    if (vbResults.length > 0) {
      body += `<div style="font-size:12px;font-weight:700;color:#FFC832;margin:12px 0 6px;text-transform:uppercase;letter-spacing:0.3px">🏐 Volleyball</div>`;
      for (const g of vbResults) body += buildGameCard(g, true);
    }
    if (bbResults.length > 0) {
      body += `<div style="font-size:12px;font-weight:700;color:#F97316;margin:12px 0 6px;text-transform:uppercase;letter-spacing:0.3px">🏀 Basketball</div>`;
      for (const g of bbResults) body += buildGameCard(g, true);
    }
  }

  // Upcoming games — grouped by sport
  if (upcoming.length > 0) {
    body += `<div style="font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#64748b;font-weight:700;margin:20px 0 12px">${t('Kommende Spiele', 'Upcoming Games')}</div>`;
    const vbUpcoming = upcoming.filter(g => !g._sport || g._sport === 'volleyball');
    const bbUpcoming = upcoming.filter(g => g._sport === 'basketball');
    if (vbUpcoming.length > 0) {
      body += `<div style="font-size:12px;font-weight:700;color:#FFC832;margin:12px 0 6px;text-transform:uppercase;letter-spacing:0.3px">🏐 Volleyball</div>`;
      for (const g of vbUpcoming) body += buildGameCard(g, false);
    }
    if (bbUpcoming.length > 0) {
      body += `<div style="font-size:12px;font-weight:700;color:#F97316;margin:12px 0 6px;text-transform:uppercase;letter-spacing:0.3px">🏀 Basketball</div>`;
      for (const g of bbUpcoming) body += buildGameCard(g, false);
    }
  }

  // Events
  if (events.length > 0) {
    body += `<div style="font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#64748b;font-weight:700;margin:20px 0 8px">Events</div>`;
    for (const ev of events) {
      body += `<div style="padding:6px 0;border-bottom:1px solid #334155;font-size:13px;color:#e2e8f0"><span style="color:#94a3b8">${formatDateCH(ev.startDate || ev.date)}</span> &nbsp; ${ev.title}${ev.location ? ' — ' + ev.location : ''}</div>`;
    }
  }

  // Unsubscribe
  body += `<div style="margin-top:24px;padding-top:16px;border-top:1px solid #334155;text-align:center;font-size:12px;color:#64748b"><a href="${unsubUrl}" style="color:#64748b;text-decoration:underline">${t('Newsletter abbestellen', 'Unsubscribe')}</a></div>`;

  const now = new Date();
  const monthNames = locale === 'de'
    ? ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember']
    : ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const prevMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
  const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();

  return buildEmailLayout(body, {
    title: `KSCW ${t('Monatsupdate', 'Monthly Update')}`,
    subtitle: `${monthNames[prevMonth]} ${year}`,
  });
}

export function registerNewsletterDigest(router, { database, logger, services, getSchema }) {
  const log = logger.child({ endpoint: 'newsletter-digest' });

  router.post('/newsletter/digest', async (req, res) => {
    try {
      // Require auth (Directus Flow sends with admin token)
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const now = new Date();
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(now.getDate() - 30);
      const thirtyDaysFromNow = new Date(now);
      thirtyDaysFromNow.setDate(now.getDate() + 30);

      const agoISO = thirtyDaysAgo.toISOString().slice(0, 10);
      const nowISO = now.toISOString().slice(0, 10);
      const futureISO = thirtyDaysFromNow.toISOString().slice(0, 10);

      // Fetch news
      const news = await database('news')
        .where('is_published', true)
        .where('published_at', '>=', agoISO)
        .orderBy('published_at', 'desc')
        .select('title', 'title_en', 'slug', 'excerpt', 'category');

      // Fetch recent results (with league, type, sets)
      const results = await database('games')
        .where('date', '>=', agoISO)
        .where('date', '<=', nowISO)
        .whereNotNull('home_score')
        .orderBy('date', 'desc')
        .limit(20)
        .select('date', 'time', 'home_team', 'away_team', 'home_score', 'away_score', 'kscw_team', 'type', 'league', 'sets_json');

      // Fetch upcoming games
      const upcoming = await database('games')
        .where('date', '>', nowISO)
        .where('date', '<=', futureISO)
        .orderBy('date', 'asc')
        .limit(20)
        .select('date', 'time', 'home_team', 'away_team', 'kscw_team', 'type', 'league');

      // Fetch events
      const events = await database('events')
        .where('start_date', '>=', agoISO)
        .where('start_date', '<=', futureISO)
        .orderBy('start_date', 'asc')
        .select('title', 'start_date as startDate', 'location');

      if (!news.length && !results.length && !upcoming.length && !events.length) {
        log.info('Newsletter digest: no content, skipping');
        return res.json({ success: true, sent: 0, reason: 'no_content' });
      }

      const subscribers = await database('newsletter_subscribers')
        .where('verified', true)
        .select('email', 'locale', 'categories', 'unsubscribe_token');

      if (!subscribers.length) {
        log.info('Newsletter digest: no subscribers');
        return res.json({ success: true, sent: 0, reason: 'no_subscribers' });
      }

      // Resolve team sports for category filtering
      const teamIds = [...new Set([...results, ...upcoming].map(g => g.kscw_team).filter(Boolean))];
      const teamSports = {};
      if (teamIds.length) {
        const teams = await database('teams').whereIn('id', teamIds).select('id', 'sport');
        for (const t of teams) teamSports[t.id] = t.sport;
      }

      // Attach sport to each game for grouping in email template
      for (const g of results) g._sport = teamSports[g.kscw_team] || 'volleyball';
      for (const g of upcoming) g._sport = teamSports[g.kscw_team] || 'volleyball';

      // Generate AI summaries (2 calls: DE + EN)
      const summaryData = {
        news: news.slice(0, 5).map(n => n.title),
        results: results.slice(0, 5).map(r => `${r.home_team} ${r.home_score}:${r.away_score} ${r.away_team}`),
        upcoming: upcoming.slice(0, 5).map(u => `${u.home_team} vs ${u.away_team} (${u.date})`),
        events: events.slice(0, 3).map(e => e.title),
      };

      const monthNamesDE = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
      const monthNamesEN = ['January','February','March','April','May','June','July','August','September','October','November','December'];
      const prevMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
      const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();

      const summaryDE = await generateSummary('de', summaryData, monthNamesDE[prevMonth], prevYear);
      const summaryEN = await generateSummary('en', summaryData, monthNamesEN[prevMonth], prevYear);

      // Send emails
      const schema = await getSchema();
      const { MailService } = services;
      const mail = new MailService({ schema, knex: database });
      let sent = 0;

      for (const sub of subscribers) {
        const cats = typeof sub.categories === 'string' ? JSON.parse(sub.categories) : sub.categories || ['volleyball', 'basketball', 'club'];
        const catSet = new Set(cats);

        const subNews = news.filter(n => catSet.has(n.category || 'club'));
        const subResults = results.filter(g => !g.kscw_team || catSet.has(teamSports[g.kscw_team] || 'club'));
        const subUpcoming = upcoming.filter(g => !g.kscw_team || catSet.has(teamSports[g.kscw_team] || 'club'));
        const subEvents = catSet.has('club') ? events : [];

        if (!subNews.length && !subResults.length && !subUpcoming.length && !subEvents.length) continue;

        const summary = sub.locale === 'en' ? summaryEN : summaryDE;
        const unsubUrl = `${WEBSITE_URL}/${sub.locale}/news/?unsubscribe=${sub.unsubscribe_token}`;
        const html = buildDigestHtml(sub.locale, summary, subNews, subResults, subUpcoming, subEvents, unsubUrl);

        const monthNames = sub.locale === 'de'
          ? ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember']
          : ['January','February','March','April','May','June','July','August','September','October','November','December'];
        const prevMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
        const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
        const subject = sub.locale === 'de'
          ? `KSCW Monatsupdate — ${monthNames[prevMonth]} ${year}`
          : `KSCW Monthly Update — ${monthNames[prevMonth]} ${year}`;

        try {
          await mail.send({ to: sub.email, subject, html });
          sent++;
        } catch (mailErr) {
          log.error({ msg: `Failed to send digest to ${sub.email}: ${mailErr.message}` });
        }
      }

      log.info(`Newsletter digest sent to ${sent} subscribers`);
      res.json({ success: true, sent });
    } catch (err) {
      log.error({ msg: `newsletter/digest: ${err.message}`, stack: err.stack });
      res.status(500).json({ error: 'Internal error' });
    }
  });
}
