# Per-Team Guest Levels

**Date:** 2026-03-16
**Status:** Approved

## Problem

`is_guest` is a global boolean on the `members` collection. A member is either a guest everywhere or not at all. This doesn't support the real-world scenario where someone is a regular player on one team but a guest at another team's trainings. There are also no guest priority levels — all guests are treated equally in waitlist bumping.

## Design

### Data Model

**`member_teams` collection** — add field:
- `guest_level`: number (0-3, default 0)
  - 0 = regular member (not a guest)
  - 1 = guest level 1 (highest priority guest)
  - 2 = guest level 2
  - 3 = guest level 3 (lowest priority guest)

**`members` collection** — remove:
- `is_guest` field (replaced by per-team `guest_level`)

**`MemberTeam` type**:
```typescript
export interface MemberTeam extends RecordModel {
  member: string
  team: string
  season: string
  guest_level: number  // 0=member, 1-3=guest levels
  club?: string
}
```

### Auth & Context (`useAuth`)

Remove:
- `isGuest: boolean` (global flag)

Add:
- `getGuestLevel(teamId: string): number` — returns 0 (not guest) or 1-3 from `member_teams` for current season
- `isGuestIn(teamId: string): boolean` — convenience, returns `getGuestLevel(teamId) > 0`

Implementation: the existing `member_teams` fetch (line ~146 in useAuth.tsx) already runs per-session. Store `guest_level` in a map `Record<string, number>` (teamId -> guest_level) alongside existing `memberTeamIds`.

### Participation Priority (Waitlist Bumping)

**Current**: Guest confirms when full -> auto-waitlisted. Licensed player confirms when full -> bump last-confirmed guest.

**New**:
- When bumping is needed, select the guest with the **highest `guest_level` number** (level 3 first, then 2, then 1)
- Among same-level guests, bump the **last confirmed** (most recent)
- Non-guests (guest_level=0) still bump any guest
- Guests cannot bump other guests

The PB hook looks up the participant's `member_teams` record for the activity's team to get `guest_level`. When choosing who to bump, it queries confirmed participants, joins their `member_teams` guest_level, and picks `ORDER BY guest_level DESC, created DESC LIMIT 1`.

**`ParticipationButton.tsx`**: Replace `isGuest` (global) with `isGuestIn(teamId)` for the "can't confirm when full" disabled state.

### RosterEditor

Replace the single "Guest" toggle button with a **guest level cycle button**:
- Click cycles: 0 -> 1 -> 2 -> 3 -> 0
- Level 0: Gray badge (inactive state, like today's non-guest)
- Level 1: Orange badge "G1"
- Level 2: Orange badge "G2" (slightly dimmer)
- Level 3: Orange badge "G3" (dimmest)

Updates `member_teams.guest_level` for that member+team+season record.

Tooltip shows current state: "Gast Stufe 2" / "Guest Level 2" or "Kein Gast" / "Not a guest".

### Signup Flow

Remove the `is_guest` checkbox from `SignUpPage`. New members sign up with just team selection; coach/admin sets guest status + level in RosterEditor after approval.

### Migration

1. Add `guest_level` field (number, default 0) to `member_teams` collection via PB API
2. Backfill: for every member where `members.is_guest = true`, set `guest_level = 1` on all their `member_teams` records
3. Remove `is_guest` field from `members` collection (after code is updated)

### Code Cleanup

Remove all references to `members.is_guest`:
- `Member` type in `src/types/index.ts`: remove `is_guest`
- `useAuth.tsx`: remove `isGuest`, add `getGuestLevel`/`isGuestIn`
- `SignUpPage.tsx`: remove guest checkbox + `isGuest` state
- `ParticipationButton.tsx`: use `isGuestIn(teamId)` instead of `isGuest`
- `RosterEditor.tsx`: update guest toggle to cycle `member_teams.guest_level`
- i18n files: update/add guest level labels

### Translations (new keys)

- `guestLevel0` / `guestLevel1` / `guestLevel2` / `guestLevel3` labels
- `guestLevelTooltip` with interpolation for level number
- Updated `guestExplanation` mentioning levels
- Remove old signup-specific `isGuest` / `guestExplanation` strings from auth namespace

## Files Affected

- `src/types/index.ts` — `Member` (remove `is_guest`), `MemberTeam` (add `guest_level`)
- `src/hooks/useAuth.tsx` — remove `isGuest`, add `getGuestLevel`/`isGuestIn`, store guest level map
- `src/modules/auth/SignUpPage.tsx` — remove guest checkbox
- `src/components/ParticipationButton.tsx` — use `isGuestIn(teamId)`
- `src/modules/teams/RosterEditor.tsx` — guest level cycle button on `member_teams`
- `pb_hooks/participation_priority.pb.js` — bump by guest_level DESC
- `pb_hooks/participation_priority_lib.js` — updated bumping logic
- `src/i18n/locales/en/teams.ts` — guest level labels
- `src/i18n/locales/de/teams.ts` — guest level labels (German)
- `src/i18n/locales/en/auth.ts` — remove `isGuest`/`guestExplanation`
- `src/i18n/locales/de/auth.ts` — remove `isGuest`/`guestExplanation`
- `src/i18n/locales/en/participation.ts` — updated waitlist hint
- `src/i18n/locales/de/participation.ts` — updated waitlist hint
