/**
 * SVRZ game-scheduling sync — bulk fetch of games + Spielplaner contacts
 * from volleymanager.volleyball.ch into Directus `svrz_games` and
 * `svrz_spielplaner_contacts` collections.
 *
 * See docs/superpowers/specs/2026-04-22-game-scheduling-per-verein-invites-design.md
 */

import { vmLogin, csrfFromPage, VM_BASE, UA } from './vm-client.mjs';

/**
 * Filter games down to those that are schedulable — i.e. status is "open" or
 * "waitingForApproval", AND either has no start date yet or starts on/after cutoff.
 */
export function filterSchedulableGames(games, { cutoffDate = new Date('1970-01-01') } = {}) {
  return games.filter(g => {
    if (!['open', 'waitingForApproval'].includes(g.status)) return false;
    const d = g.startingDateTime ? new Date(g.startingDateTime) : null;
    return d === null || d >= cutoffDate;
  });
}

/**
 * Map a SVRZ game JSON record to a flat row for the `svrz_games` Directus collection.
 * Club identifiers are stringified to preserve any leading zeros SVRZ may use.
 */
export function gameToSvrzRow(g) {
  const enc = g.encounter || {};
  const home = enc.teamHome || {};
  const away = enc.teamAway || {};
  const homeClub = home.club || {};
  const awayClub = away.club || {};
  const league = g.group?.phase?.league || {};
  return {
    svrz_persistence_id: g.persistenceObjectIdentifier,
    svrz_number: g.number,
    status: g.status,
    display_name: g.displayName,
    short_display_name: g.shortDisplayName,
    starting_date_time: g.startingDateTime,
    playing_weekday: g.playingWeekday,
    home_club_id: homeClub.identifier == null ? '' : String(homeClub.identifier),
    home_club_name: homeClub.name || '',
    home_team_name: home.name || enc.teamHomeName || '',
    away_club_id: awayClub.identifier == null ? '' : String(awayClub.identifier),
    away_club_name: awayClub.name || '',
    away_team_name: away.name || enc.teamAwayName || '',
    league_name: league.displayName || '',
    league_short: home.leagueCategory?.name || away.leagueCategory?.name || '',
    gender: league.gender || '',
    season_name: league.season?.name || '',
    raw: g,
  };
}
