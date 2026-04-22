import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { filterSchedulableGames, gameToSvrzRow } from '../svrz-scheduling-sync.mjs';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/games-sample.json', import.meta.url)));

test('filterSchedulableGames keeps open + waitingForApproval, drops approved', () => {
  const out = filterSchedulableGames(fixture, { cutoffDate: new Date('1970-01-01') });
  assert.ok(out.length > 0, 'fixture should contain at least one schedulable game');
  assert.ok(out.every(g => ['open', 'waitingForApproval'].includes(g.status)));
});

test('filterSchedulableGames honors cutoffDate — drops games before cutoff unless startingDateTime is null', () => {
  const cutoff = new Date('2200-01-01'); // future cutoff
  const out = filterSchedulableGames(fixture, { cutoffDate: cutoff });
  // Only games with status in [open, waitingForApproval] AND (starting null OR >= cutoff) survive
  out.forEach(g => {
    if (g.startingDateTime) {
      assert.ok(new Date(g.startingDateTime) >= cutoff, `game ${g.number} survived but starts before cutoff`);
    }
  });
});

test('gameToSvrzRow extracts all fields, club identifier as string', () => {
  const game = fixture[0];
  const row = gameToSvrzRow(game);
  assert.equal(row.svrz_persistence_id, game.persistenceObjectIdentifier);
  assert.equal(row.svrz_number, game.number);
  assert.equal(row.status, game.status);
  assert.equal(row.display_name, game.displayName);
  assert.equal(row.starting_date_time, game.startingDateTime);
  assert.equal(typeof row.home_club_id, 'string', 'home_club_id must be string (preserves leading zeros if SVRZ used them)');
  assert.equal(row.home_club_id, String(game.encounter.teamHome.club.identifier));
  assert.equal(row.home_club_name, game.encounter.teamHome.club.name);
  assert.equal(row.home_team_name, game.encounter.teamHome.name);
  assert.equal(row.away_club_id, String(game.encounter.teamAway.club.identifier));
  assert.equal(row.league_short, game.encounter.teamHome.leagueCategory.name);
  assert.equal(row.gender, game.group.phase.league.gender);
  assert.equal(row.season_name, game.group.phase.league.season.name);
  // raw should contain the full original game
  assert.equal(row.raw.number, game.number);
});

test('gameToSvrzRow tolerates missing encounter/club fields gracefully', () => {
  const empty = { persistenceObjectIdentifier: 'x', number: 0, status: 'open' };
  const row = gameToSvrzRow(empty);
  assert.equal(row.home_club_id, '');
  assert.equal(row.home_club_name, '');
  assert.equal(row.league_short, '');
});
