// Cloudflare Pages Functions worker
// Serves team.html for clean team URLs like /volleyball/h1

const TEAM_PATHS = new Set([
  '/volleyball/h1', '/volleyball/h2', '/volleyball/h3', '/volleyball/legends',
  '/volleyball/d1', '/volleyball/d2', '/volleyball/d3', '/volleyball/d4',
  '/volleyball/du23', '/volleyball/hu23', '/volleyball/hu20',
  '/basketball/h1', '/basketball/h3', '/basketball/h4',
  '/basketball/lions', '/basketball/rhinos',
]);

const OLD_REDIRECTS = {
  '/volleyball/teams/h1.html': '/volleyball/h1',
  '/volleyball/teams/h2.html': '/volleyball/h2',
  '/volleyball/teams/h3.html': '/volleyball/h3',
  '/volleyball/teams/legends.html': '/volleyball/legends',
  '/volleyball/teams/d1.html': '/volleyball/d1',
  '/volleyball/teams/d2.html': '/volleyball/d2',
  '/volleyball/teams/d3.html': '/volleyball/d3',
  '/volleyball/teams/d4.html': '/volleyball/d4',
  '/volleyball/teams/du23.html': '/volleyball/du23',
  '/volleyball/teams/hu23.html': '/volleyball/hu23',
  '/volleyball/teams/hu20.html': '/volleyball/hu20',
  '/basketball/teams/h1.html': '/basketball/h1',
  '/basketball/teams/h3.html': '/basketball/h3',
  '/basketball/teams/h4.html': '/basketball/h4',
  '/basketball/teams/lions.html': '/basketball/lions',
  '/basketball/teams/rhinos.html': '/basketball/rhinos',
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '');

    // Old URL redirects
    if (OLD_REDIRECTS[path]) {
      return Response.redirect(new URL(OLD_REDIRECTS[path], url.origin).href, 301);
    }

    // Team pages — serve team.html
    if (TEAM_PATHS.has(path)) {
      const teamPage = await env.ASSETS.fetch(new URL('/team.html', url.origin));
      return new Response(teamPage.body, {
        headers: {
          ...Object.fromEntries(teamPage.headers),
          'content-type': 'text/html; charset=utf-8',
        },
      });
    }

    // Everything else — serve normally
    return env.ASSETS.fetch(request);
  },
};
