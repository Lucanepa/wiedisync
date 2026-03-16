# Per-Team Guest Levels Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move guest status from a global `members.is_guest` boolean to a per-team `member_teams.guest_level` (0-3) field with priority-based waitlist bumping.

**Architecture:** Add `guest_level` number field to `member_teams` collection, expose `getGuestLevel(teamId)` / `isGuestIn(teamId)` helpers on auth context, thread `teamId` through `ParticipationButton`, update scorer module to check guest status per duty team, and update RosterEditor with a guest level cycle button.

**Tech Stack:** React 19, TypeScript, PocketBase, TailwindCSS v4, shadcn/ui

**Spec:** `docs/superpowers/specs/2026-03-16-per-team-guest-levels-design.md`

---

## Chunk 1: Data Model & Auth Context

### Task 1: Add `guest_level` to `MemberTeam` type

**Files:**
- Modify: `src/types/index.ts:72-77`

- [ ] **Step 1: Update `MemberTeam` interface**

In `src/types/index.ts`, add `guest_level` to the `MemberTeam` interface:

```typescript
export interface MemberTeam extends RecordModel {
  member: string
  team: string
  season: string
  guest_level: number  // 0=member, 1-3=guest levels
  club?: string
}
```

- [ ] **Step 2: Remove `is_guest` from `Member` interface**

In `src/types/index.ts`, remove line 65 (`is_guest: boolean`) from the `Member` interface.

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "refactor: move guest status from Member to MemberTeam as guest_level"
```

---

### Task 2: Update `useAuth` — replace `isGuest` with `getGuestLevel` / `isGuestIn`

**Files:**
- Modify: `src/hooks/useAuth.tsx`

- [ ] **Step 1: Update `AuthContextValue` interface**

Replace `isGuest: boolean` (line 33) with:

```typescript
getGuestLevel: (teamId: string) => number
isGuestIn: (teamId: string) => boolean
```

- [ ] **Step 2: Add `guestLevelByTeam` state**

After `const [memberSports, setMemberSports] = useState<...>` (line 50), add:

```typescript
const [guestLevelByTeam, setGuestLevelByTeam] = useState<Record<string, number>>({})
```

- [ ] **Step 3: Store `guest_level` from `member_teams` fetch**

In the `member_teams` fetch `useEffect` (starts at line 138), update the `.then()` handler to also build the guest level map. The fetch already returns `MemberTeam` records. After the existing `setMemberTeamIds`, `setMemberTeamNames`, and `setMemberSports` calls (around line 159), add:

```typescript
const glMap: Record<string, number> = {}
for (const mt of mts) {
  glMap[mt.team] = mt.guest_level ?? 0
}
setGuestLevelByTeam(glMap)
```

Also add `setGuestLevelByTeam({})` in the `if (!user?.id)` early return and the `.catch()` handler.

- [ ] **Step 4: Create helper functions**

Replace the existing `const isGuest = user?.is_guest === true` (line 203) with:

```typescript
const getGuestLevel = useCallback(
  (teamId: string) => guestLevelByTeam[teamId] ?? 0,
  [guestLevelByTeam],
)

const isGuestIn = useCallback(
  (teamId: string) => getGuestLevel(teamId) > 0,
  [getGuestLevel],
)
```

- [ ] **Step 5: Update the context provider value**

In the `AuthContext.Provider` value (line 238), replace `isGuest` with `getGuestLevel, isGuestIn`.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useAuth.tsx
git commit -m "refactor: replace global isGuest with per-team getGuestLevel/isGuestIn"
```

---

## Chunk 2: Signup & ParticipationButton

### Task 3: Remove guest checkbox from SignUpPage

**Files:**
- Modify: `src/modules/auth/SignUpPage.tsx`

- [ ] **Step 1: Remove `isGuest` state**

Delete line 42: `const [isGuest, setIsGuest] = useState(false)`

- [ ] **Step 2: Remove `is_guest` from member creation**

In `handleRegister` (around line 125), remove `is_guest: isGuest,` from the `pb.collection('members').create()` call.

- [ ] **Step 3: Remove guest checkbox JSX**

Delete the entire guest checkbox block (lines 343-359):

```tsx
{/* Guest checkbox */}
<label className="flex items-start gap-2 ...">
  ...
</label>
```

- [ ] **Step 4: Commit**

```bash
git add src/modules/auth/SignUpPage.tsx
git commit -m "refactor: remove guest checkbox from signup — coaches set guest level via roster"
```

---

### Task 4: Thread `teamId` through `ParticipationButton`

**Files:**
- Modify: `src/components/ParticipationButton.tsx`
- Modify: `src/modules/events/EventCard.tsx`
- Modify: `src/modules/auth/ProfilePage.tsx`

**Note:** `TrainingCard` and `GameCard` do NOT use `ParticipationButton` — they use inline `useParticipation` hook calls with custom UI that has no guest-level checks. Only `EventCard` and `ProfilePage` use `ParticipationButton` and need `teamId` threading.

- [ ] **Step 1: Add `teamId` prop to `ParticipationButton`**

In `src/components/ParticipationButton.tsx`, add `teamId?: string` to `ParticipationButtonProps` (around line 9):

```typescript
interface ParticipationButtonProps {
  activityType: Participation['activity_type']
  activityId: string
  activityDate?: string
  teamId?: string
  compact?: boolean
  // ... rest unchanged
}
```

- [ ] **Step 2: Replace `isGuest` with `isGuestIn`**

Replace line 45:
```typescript
const { isGuest } = useAuth()
```
with:
```typescript
const { isGuestIn } = useAuth()
```

Replace line 157:
```typescript
const isDisabledConfirmed = status === 'confirmed' && isFull && isGuest && effectiveStatus !== 'confirmed'
```
with:
```typescript
const isGuestForTeam = teamId ? isGuestIn(teamId) : false
const isDisabledConfirmed = status === 'confirmed' && isFull && isGuestForTeam && effectiveStatus !== 'confirmed'
```

- [ ] **Step 3: Thread `teamId` from `EventCard.tsx`**

In `src/modules/events/EventCard.tsx`, the `ParticipationButton` at line 63 currently has no `teamId`. Add it using the first event team:

```tsx
<ParticipationButton
  activityType="event"
  activityId={event.id}
  activityDate={event.start_date}
  teamId={event.teams?.[0]}
  compact
/>
```

- [ ] **Step 4: Thread `teamId` from `ProfilePage.tsx`**

In `src/modules/auth/ProfilePage.tsx`, update the three `ParticipationButton` call sites:

Training (around line 251):
```tsx
<ParticipationButton
  activityType="training"
  activityId={tr.id}
  activityDate={tr.date}
  teamId={tr.team}
  compact
/>
```

Game (around line 270):
```tsx
<ParticipationButton
  activityType="game"
  activityId={g.id}
  activityDate={g.date}
  teamId={g.kscw_team}
  compact
/>
```

Event (around line 288):
```tsx
<ParticipationButton
  activityType="event"
  activityId={ev.id}
  activityDate={ev.start_date}
  teamId={ev.teams?.[0]}
  compact
/>
```

- [ ] **Step 5: Commit**

```bash
git add src/components/ParticipationButton.tsx src/modules/events/EventCard.tsx src/modules/auth/ProfilePage.tsx
git commit -m "feat: thread teamId through ParticipationButton for per-team guest checks"
```

---

## Chunk 3: RosterEditor & MemberRow

### Task 5: Update RosterEditor guest toggle to cycle `guest_level`

**Files:**
- Modify: `src/modules/teams/RosterEditor.tsx`

- [ ] **Step 1: Replace the guest toggle button**

The current guest toggle (lines 382-402) updates `members.is_guest`. Replace the entire `{/* Guest toggle */}` block with a cycle button that updates `member_teams.guest_level`:

After Task 1, `MemberTeam` has `guest_level: number`, so `mt.guest_level` is directly typed. The `useTeamMembers` hook (at `src/hooks/useTeamMembers.ts`) fetches all fields (no `fields` param), so `guest_level` will be returned automatically from PocketBase once the field is added.

```tsx
{/* Guest level cycle */}
<button
  onClick={async () => {
    const currentLevel = mt.guest_level ?? 0
    const nextLevel = (currentLevel + 1) % 4
    try {
      await pb.collection('member_teams').update(mt.id, { guest_level: nextLevel })
      logActivity('update', 'member_teams', mt.id, { guest_level: nextLevel })
      ;(mt as Record<string, unknown>).guest_level = nextLevel
    } catch { /* ignore */ }
  }}
  title={(() => {
    const level = mt.guest_level ?? 0
    return level === 0 ? t('guestLevel0') : t('guestLevelTooltip', { level })
  })()}
  className={`rounded px-1.5 py-0.5 text-xs font-medium transition-colors ${
    (() => {
      const level = mt.guest_level ?? 0
      if (level === 0) return 'bg-gray-100 text-gray-400 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-500 dark:hover:bg-gray-600'
      if (level === 1) return 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300'
      if (level === 2) return 'bg-orange-100/70 text-orange-600 dark:bg-orange-900/60 dark:text-orange-400'
      return 'bg-orange-100/50 text-orange-500 dark:bg-orange-900/40 dark:text-orange-500'
    })()
  }`}
>
  {(() => {
    const level = mt.guest_level ?? 0
    return level === 0 ? t('guestBadge') : `G${level}`
  })()}
</button>
```

- [ ] **Step 2: Commit**

```bash
git add src/modules/teams/RosterEditor.tsx
git commit -m "feat: replace guest toggle with guest level cycle button (0-3) on member_teams"
```

---

### Task 6: Update MemberRow guest badge

**Files:**
- Modify: `src/modules/teams/MemberRow.tsx`

`MemberRow` already receives `memberTeam: ExpandedMemberTeam` as a prop (line 14 of `MemberRowProps`). After Task 1, `MemberTeam` includes `guest_level`, so `memberTeam.guest_level` is directly accessible. No new props needed.

The component is rendered from `src/modules/teams/TeamDetail.tsx` (line 381) which passes the `memberTeam` record — `guest_level` flows through automatically.

- [ ] **Step 1: Replace `is_guest` badge with `guest_level` badge**

Replace lines 147-151:
```tsx
{member.is_guest && (
  <span className="ml-1.5 rounded px-1.5 py-0.5 text-[10px] font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
    {t('guestBadge')}
  </span>
)}
```

with:
```tsx
{(memberTeam.guest_level ?? 0) > 0 && (
  <span className={`ml-1.5 rounded px-1.5 py-0.5 text-[10px] font-medium ${
    memberTeam.guest_level === 1 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
    : memberTeam.guest_level === 2 ? 'bg-orange-100/70 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400'
    : 'bg-orange-100/50 text-orange-500 dark:bg-orange-900/10 dark:text-orange-500'
  }`}>
    G{memberTeam.guest_level}
  </span>
)}
```

- [ ] **Step 2: Commit**

```bash
git add src/modules/teams/MemberRow.tsx
git commit -m "feat: show per-team guest level badge (G1/G2/G3) in MemberRow"
```

---

## Chunk 4: Scorer Module

### Task 7: Update scorer module to use per-team `guest_level`

**Files:**
- Modify: `src/modules/scorer/components/AssignmentAlgorithm.ts:65-79`
- Modify: `src/modules/scorer/components/AssignmentEditor.tsx:8-34,59-60`
- Modify: `src/modules/scorer/components/DelegationModal.tsx:58-69`
- Modify: `src/modules/scorer/ScorerPage.tsx:109` (remove `is_guest` from fields)

**Context:** `ScorerPage.tsx` already fetches `allMemberTeams` (line 118) — this data is available to pass to child components. `AssignmentEditor` does NOT currently receive `memberTeams` as a prop — it needs a new `guestMemberIds` prop. `DelegationModal` already receives `memberTeams` as a prop.

- [ ] **Step 1: Update `AssignmentAlgorithm.ts`**

The `buildScorerTeams` function (line 65) takes `members: Member[]` and `memberTeams: MemberTeam[]`. Currently it checks `!m.is_guest` on the member. Replace with a per-team check using `memberTeams`:

```typescript
function buildScorerTeams(members: Member[], memberTeams: MemberTeam[]): Set<string> {
  const scorerMemberIds = new Set<string>()
  for (const m of members) {
    if (m.licences?.includes('scorer_vb')) {
      scorerMemberIds.add(m.id)
    }
  }
  const teams = new Set<string>()
  for (const mt of memberTeams) {
    if (scorerMemberIds.has(mt.member) && (mt.guest_level ?? 0) === 0) {
      teams.add(mt.team)
    }
  }
  return teams
}
```

- [ ] **Step 2: Update `AssignmentEditor.tsx` — add `guestMemberIds` prop**

`AssignmentEditor` does not receive `memberTeams`. Rather than threading the full array, add a pre-computed `guestMemberIds?: Set<string>` prop. This keeps the component simple — the parent (`ScorerPage`) computes which members are guests on the duty team.

Add to `AssignmentEditorProps` (line 8):
```typescript
/** Set of member IDs who are guests on the selected duty team */
guestMemberIds?: Set<string>
```

Replace line 60:
```typescript
let list = members.filter((m) => m.active && !m.is_guest)
```
with:
```typescript
let list = members.filter((m) => m.active && !guestMemberIds?.has(m.id))
```

In `ScorerPage.tsx`, where `AssignmentEditor` is rendered, compute and pass `guestMemberIds`:
```typescript
// Compute guests for the duty team
const guestMemberIds = useMemo(() => {
  const guests = new Set<string>()
  for (const mt of allMemberTeams) {
    if ((mt.guest_level ?? 0) > 0) guests.add(mt.member)
  }
  return guests
}, [allMemberTeams])
```

Pass `guestMemberIds={guestMemberIds}` to each `AssignmentEditor` instance.

- [ ] **Step 3: Update `ScorerPage.tsx` — remove `is_guest` from fields**

At line 109, remove `is_guest` from the fields list:
```typescript
fields: 'id,name,first_name,last_name,licences,active,phone,email',
```

- [ ] **Step 4: Update `DelegationModal.tsx`**

At line 62, replace `!m.active || m.is_guest` with a check against the duty team's `member_teams`. The component already has `memberTeams` and `dutyTeamId` props:

```typescript
// Build set of guests on the duty team
const guestsOnDutyTeam = useMemo(() => {
  const guests = new Set<string>()
  for (const mt of memberTeams) {
    if (mt.team === dutyTeamId && (mt.guest_level ?? 0) > 0) {
      guests.add(mt.member)
    }
  }
  return guests
}, [memberTeams, dutyTeamId])
```

Then update the filter at line 60-68:
```typescript
return members.filter((m) => {
  if (m.id === currentUserId) return false
  if (!m.active || guestsOnDutyTeam.has(m.id)) return false
  // ... rest unchanged
})
```

- [ ] **Step 5: Commit**

```bash
git add src/modules/scorer/components/AssignmentAlgorithm.ts src/modules/scorer/components/AssignmentEditor.tsx src/modules/scorer/components/DelegationModal.tsx src/modules/scorer/ScorerPage.tsx
git commit -m "refactor: scorer module uses per-team guest_level instead of global is_guest"
```

---

## Chunk 5: i18n, PB Hooks & Migration

### Task 8: Update i18n translations

**Files:**
- Modify: `src/i18n/locales/en/teams.ts`
- Modify: `src/i18n/locales/de/teams.ts`
- Modify: `src/i18n/locales/en/auth.ts`
- Modify: `src/i18n/locales/de/auth.ts`
- Modify: `src/i18n/locales/en/participation.ts`
- Modify: `src/i18n/locales/de/participation.ts`

- [ ] **Step 1: Update English teams translations**

In `src/i18n/locales/en/teams.ts`, replace lines 74-77:

```typescript
// Guest
guestBadge: 'Guest',
toggleGuest: 'Toggle guest status',
guestExplanation: 'Guests have lower priority than licenced players when trainings are full.',
```

with:

```typescript
// Guest levels
guestBadge: 'G',
guestLevel0: 'Not a guest',
guestLevel1: 'Guest Level 1',
guestLevel2: 'Guest Level 2',
guestLevel3: 'Guest Level 3',
guestLevelTooltip: 'Guest Level {{level}} — lower priority when trainings are full',
guestExplanation: 'Guest levels 1-3 determine priority when trainings are full. Level 1 has highest guest priority, level 3 lowest.',
```

- [ ] **Step 2: Update German teams translations**

In `src/i18n/locales/de/teams.ts`, replace lines 74-77:

```typescript
// Guest
guestBadge: 'Gast',
toggleGuest: 'Gast-Status umschalten',
guestExplanation: 'Gäste haben bei vollen Trainings eine niedrigere Priorität als lizenzierte Spieler.',
```

with:

```typescript
// Gaststufen
guestBadge: 'G',
guestLevel0: 'Kein Gast',
guestLevel1: 'Gast Stufe 1',
guestLevel2: 'Gast Stufe 2',
guestLevel3: 'Gast Stufe 3',
guestLevelTooltip: 'Gast Stufe {{level}} — niedrigere Priorität bei vollen Trainings',
guestExplanation: 'Gaststufen 1-3 bestimmen die Priorität bei vollen Trainings. Stufe 1 hat die höchste Gast-Priorität, Stufe 3 die niedrigste.',
```

- [ ] **Step 3: Remove guest strings from auth translations**

In `src/i18n/locales/en/auth.ts`, remove lines 104-106:
```typescript
// Guest registration
isGuest: 'I am a guest player',
guestExplanation: 'Guests have lower priority than licenced players when trainings are full.',
```

In `src/i18n/locales/de/auth.ts`, remove lines 104-106:
```typescript
// Guest registration
isGuest: 'Ich bin Gast-Spieler/in',
guestExplanation: 'Gäste haben bei vollen Trainings eine niedrigere Priorität als lizenzierte Spieler.',
```

- [ ] **Step 4: Update participation translations**

In `src/i18n/locales/en/participation.ts`, update `waitlistHint` (line 32):
```typescript
waitlistHint: 'Full — guests are waitlisted by level',
```

In `src/i18n/locales/de/participation.ts`, update `waitlistHint` (line 32):
```typescript
waitlistHint: 'Voll — Gäste werden nach Stufe auf die Warteliste gesetzt',
```

- [ ] **Step 5: Commit**

```bash
git add src/i18n/locales/en/teams.ts src/i18n/locales/de/teams.ts src/i18n/locales/en/auth.ts src/i18n/locales/de/auth.ts src/i18n/locales/en/participation.ts src/i18n/locales/de/participation.ts
git commit -m "i18n: add guest level translations, remove signup guest strings"
```

---

### Task 9: Update PocketBase participation priority hooks

**Files:**
- Modify: `pb_hooks/participation_priority.pb.js`
- Modify: `pb_hooks/participation_priority_lib.js`

**Note:** These files are gitignored (contain API keys). Deploy via SSH after editing locally.

- [ ] **Step 1: Update bumping logic in `participation_priority_lib.js`**

The current lib checks `is_guest` on the member record to decide if someone can be bumped. Update to query `member_teams` for the activity's team and check `guest_level`:

Where the hook currently does something like:
```javascript
// Old: check is_guest on member
const member = $app.findRecordById("members", participantMemberId)
const isGuest = member.getBool("is_guest")
```

Replace with:
```javascript
// New: check guest_level on member_teams for this team
const season = "2025/26"  // or derive from activity
const mts = $app.findRecordsByFilter("member_teams",
  `member="${participantMemberId}" && team="${teamId}" && season="${season}"`,
  "", 1, 0)
const guestLevel = mts.length > 0 ? mts[0].getInt("guest_level") : 0
const isGuest = guestLevel > 0
```

- [ ] **Step 2: Update bump target selection**

When choosing which guest to bump, update the query to order by `guest_level DESC` (bump level 3 first):

```javascript
// Find the guest with highest guest_level (lowest priority) to bump
// Among same level, bump the most recently confirmed
const bumpTarget = $app.findFirstRecordByFilter("participations",
  `activity_type="${activityType}" && activity_id="${activityId}" && status="confirmed" && member!=?"`,
  // Join with member_teams to get guest_level
  // ... (implementation depends on current hook structure)
)
```

The exact implementation depends on the current hook structure (which is gitignored). The key change is: instead of bumping "any guest", find the confirmed participant whose `member_teams.guest_level` for this team is highest (3 > 2 > 1), with `created DESC` as tiebreaker.

This likely requires a raw SQL query or multiple PB queries:
1. Get all confirmed participants for this activity
2. For each, look up their `member_teams.guest_level` for the activity's team
3. Sort by `guest_level DESC, created DESC`
4. Bump the first one

- [ ] **Step 3: Deploy hooks to VPS**

```bash
scp -i ~/.ssh/id_ed25519 pb_hooks/participation_priority_lib.js ubuntu@100.69.245.37:/tmp/
scp -i ~/.ssh/id_ed25519 pb_hooks/participation_priority.pb.js ubuntu@100.69.245.37:/tmp/
ssh -i ~/.ssh/id_ed25519 ubuntu@100.69.245.37 'sudo cp /tmp/participation_priority_lib.js /tmp/participation_priority.pb.js /opt/pocketbase-kscw/pb_hooks/ && sudo systemctl restart pocketbase-kscw'
```

- [ ] **Step 4: Verify hooks loaded**

```bash
ssh -i ~/.ssh/id_ed25519 ubuntu@100.69.245.37 'sudo journalctl -u pocketbase-kscw --since "1 min ago" --no-pager'
```

Check for any errors. Verify "loaded" log messages if present.

---

### Task 10: PocketBase migration — add `guest_level` field and backfill

**Files:**
- This task uses PocketBase MCP tools (no code files)

- [ ] **Step 1: Add `guest_level` field to `member_teams` collection**

Use the PocketBase MCP tool to add a `number` field named `guest_level` to the `member_teams` collection with:
- Default value: `0`
- Min: `0`
- Max: `3`

Do this on both dev and prod PocketBase instances.

- [ ] **Step 2: Backfill existing guests**

Query all members where `is_guest = true`. For each, find their `member_teams` records and set `guest_level = 1`.

Use PocketBase MCP:
1. `list_records` on `members` with filter `is_guest=true`
2. For each member, `list_records` on `member_teams` with filter `member="<id>"`
3. For each `member_team`, `update_record` with `{ guest_level: 1 }`

- [ ] **Step 3: Verify backfill**

Query `member_teams` with `guest_level > 0` to verify the correct number of records were updated.

- [ ] **Step 4: Remove `is_guest` field from `members` collection**

After code deployment, remove the `is_guest` field from the `members` collection schema. This should be done AFTER the code changes are deployed and verified working.

---

### Task 11: Build verification

- [ ] **Step 1: Run TypeScript compiler**

```bash
cd /home/luca-canepa/Desktop/Github/kscw && npx tsc --noEmit
```

Verify zero type errors. Fix any remaining references to `is_guest` or `isGuest`.

- [ ] **Step 2: Search for remaining `is_guest` / `isGuest` references**

```bash
grep -rn "is_guest\|isGuest" src/ --include="*.ts" --include="*.tsx"
```

The only expected match should be `guest_count` (which is a different field) and comment text. Fix any remaining code references.

- [ ] **Step 3: Run dev server**

```bash
npm run dev
```

Verify the app loads without console errors.

- [ ] **Step 4: Final commit**

If any fixes were needed:
```bash
git add -A
git commit -m "fix: resolve remaining is_guest references after migration"
```
