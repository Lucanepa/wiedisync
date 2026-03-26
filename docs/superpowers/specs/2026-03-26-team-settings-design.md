# Team Settings — Design Spec

**Date:** 2026-03-26
**Status:** Approved
**Scope:** Replace the current `FeatureTogglesSection` in RosterEditor with a grouped "Team Settings" section containing feature toggles, game defaults, and training defaults. Add auto-decline tentative behavior gated by a per-team toggle.

---

## 1. Data Model

Extend the existing `features_enabled` JSON field on the `teams` PB collection. No schema migration needed — the field already stores arbitrary JSON.

### TypeScript interface

```typescript
/** Boolean-only toggles — used by both Team and Event */
interface FeatureToggles {
  tasks?: boolean
  carpool?: boolean
  polls?: boolean
  show_rsvp_time?: boolean
}

/** Full team settings — extends FeatureToggles with defaults + behavior */
interface TeamSettings extends FeatureToggles {
  // ── Participation behavior (applies to all activity types) ──
  auto_decline_tentative?: boolean    // MAYBE → NO after respond_by

  // ── Game defaults ──
  game_min_participants?: number      // e.g. 6 (VB) or 5 (BB)
  game_respond_by_days?: number       // e.g. 3 = "3 days before game"
  game_require_note_if_absent?: boolean

  // ── Training defaults ──
  training_min_participants?: number
  training_respond_by_days?: number
  training_auto_cancel_on_min?: boolean
  training_require_note_if_absent?: boolean
}
```

**Type usage:**

- `Team.features_enabled` is typed as `TeamSettings` (full set of keys)
- `Event.features_enabled` stays typed as `FeatureToggles` (boolean-only subset)
- This prevents game/training-specific numeric fields from bleeding into the Event type

### Defaults

All keys default to `undefined` (= off / unset). When a key is unset, the corresponding feature is disabled and no default is applied to new activities.

---

## 2. UI Layout

Replace `FeatureTogglesSection` in `RosterEditor.tsx` (lines 563-611) with a new `TeamSettingsSection` component. Uses 3 collapsible accordion groups with manual `useState` expand/collapse (same pattern as `DashboardSection.tsx`).

### Structure

```text
── Team Settings ──────────────────────────────────
"Configure features and default settings for this team."

┌─ Features ──────────────────────────────── ▼ ─┐
│  ☑ Tasks (assign duties per game/training)    │
│  ☐ Carpool (organise rides for away games)    │
│  ☑ Polls (team voting & decisions)            │
│  ☑ Show response time (when members replied)  │
│  ☑ Auto-decline "Maybe" after RSVP deadline   │
└───────────────────────────────────────────────┘

┌─ Game Defaults ─────────────────────────── ▶ ─┐
└───────────────────────────────────────────────┘
  (collapsed — expands to:)
│  ☐ Require note when absent                   │
│  Min. players:  [ 6 ]                         │
│  RSVP deadline: [ 3 ] days before             │

┌─ Training Defaults ─────────────────────── ▶ ─┐
└───────────────────────────────────────────────┘
  (collapsed — expands to:)
│  ☑ Auto-cancel if below minimum               │
│  ☐ Require note when absent                   │
│  Min. players:  [ 4 ]                         │
│  RSVP deadline: [ 2 ] days before             │
```

### Behavior

- **Features** group starts expanded; Game Defaults and Training Defaults start collapsed.
- No `localStorage` persistence for accordion state (edit page, not dashboard).
- Boolean settings use **switch toggles** (iOS-style, brand purple `#4A55A2` when active), not checkboxes.
- Each setting has a **label** on the first line and an **italic hint** on a second line explaining the behavior.
- Number inputs: `<input type="number">` with `appearance: textfield` (no spin arrows), centered text, ~56px wide, `inputmode="numeric"` for mobile keyboards. Suffix label ("days before") inline after the input.
- Each toggle/input saves immediately on change via `useMutation` (same as current feature toggles).
- Mobile-responsive: min 44px touch targets, accordion headers with hover/active states.
- `auto_decline_tentative` is under Features (not Game Defaults) because it applies to all activity types (games, trainings, events) in the backend cron.

---

## 3. Backend Integration

### 3.1 Defaults flow into new activities

When a coach creates a new game or training, the creation form pre-fills from team defaults:

| Team setting | Game field | Training field |
| --- | --- | --- |
| `game_min_participants` / `training_min_participants` | `min_participants` | `min_participants` |
| `game_respond_by_days` / `training_respond_by_days` | `respond_by` (computed: `date - N days`) | `respond_by` (computed: `date - N days`) |
| `game_require_note_if_absent` / `training_require_note_if_absent` | `require_note_if_absent` | `require_note_if_absent` |
| — | — | `auto_cancel_on_min` (from `training_auto_cancel_on_min`) |

Coach can override any value per-activity. Existing activities are not retroactively changed.

### 3.2 Swiss Volley / Basketplan sync

When the sync cron **creates** a new game (not found in DB yet), it reads the team's `game_respond_by_days` and sets:

```text
respond_by = game_date - game_respond_by_days
```

If the team has no default set, no `respond_by` is assigned (same as today).

**Important:** The existing sync logic already adjusts `respond_by` when a game's date changes (preserving the existing offset). The new default only applies at **creation time** — when no `respond_by` exists yet. The implementation must check `if (!existingRecord && teamDefault)` to avoid conflicting with the existing update-time offset logic.

### 3.3 Recurring training generator

When generating recurring trainings from a template, copy defaults from the team:

- `training_min_participants` → `min_participants`
- `training_respond_by_days` → computed `respond_by`
- `training_auto_cancel_on_min` → `auto_cancel_on_min`
- `training_require_note_if_absent` → `require_note_if_absent`

**RecurringTrainingModal pre-fill:** The modal already has input fields for `respondByAmount`/`respondByUnit` (a unit picker supporting hours/days/weeks/months), `minParticipants`, `maxParticipants`, `requireNoteIfAbsent`, and `autoCancelOnMin`. When the modal opens, pre-fill these from team defaults:

- `training_respond_by_days` → set `respondByAmount = N`, `respondByUnit = 'days'`
- Other fields map 1:1

All pre-filled values remain editable — the coach can override per-batch.

**`max_participants` excluded:** Not included in team defaults because max capacity is too variable across training types (e.g. gym vs hall). Coaches set it per-training.

### 3.4 Auto-decline tentative cron

**Migration note:** The auto-decline code added 2026-03-26 currently runs unconditionally for all teams. This spec gates it behind the `auto_decline_tentative` toggle, which defaults to `false`. This means auto-decline will be disabled for all teams until they explicitly enable it in Team Settings. Since the feature was just added and no team has relied on it yet, this is acceptable — no data migration needed.

**Implementation:** Remove the current `declineTentativeForActivities` generic helper and inline the logic per activity type, since each type resolves the team differently:

- **Games:** read `kscw_team` from the game record → fetch team → check `features_enabled.auto_decline_tentative`
- **Trainings:** read `team` from the training record → fetch team → check toggle
- **Events:** read `teams[]` from the event record → fetch each team → decline only participations for members of teams that have the toggle enabled

For each activity where the team has opted in:

1. Find all `tentative` participations for that activity.
2. Set `status = "declined"`.
3. Append "Auto-declined: deadline passed" to the existing note.
4. Save.

### 3.5 What does NOT change

- Existing activities keep their current field values.
- Per-activity overrides always take precedence over team defaults.
- The participation UI (buttons, colored popups, roster modal) is unchanged.

---

## 4. i18n

~11 new keys across 5 locales (EN, DE, GSW, FR, IT):

| Key | EN |
| --- | --- |
| `teamSettings` | Team Settings |
| `teamSettingsDescription` | Configure features and default settings for this team. |
| `settingsFeatures` | Features |
| `settingsGameDefaults` | Game Defaults |
| `settingsTrainingDefaults` | Training Defaults |
| `featureAutoDeclineTentative` | Auto-decline "Maybe" after RSVP deadline |
| `requireNoteIfAbsent` | Require note when absent |
| `minParticipants` | Minimum players |
| `respondByDays` | RSVP deadline |
| `respondByDaysSuffix` | days before |
| `autoCancelOnMin` | Auto-cancel if below minimum |

Existing keys (`featureTasks`, `featureCarpool`, `featurePolls`, `featureShowRsvpTime`) remain unchanged — they move under the Features accordion group.

---

## 5. Files Changed

### Frontend

- `src/types/index.ts` — extend `FeatureToggles` → `TeamSettings` with new keys
- `src/modules/teams/RosterEditor.tsx` — replace `FeatureTogglesSection` with `TeamSettingsSection` (3 accordion groups)
- `src/i18n/locales/{en,de,gsw,fr,it}/teams.ts` — add ~11 new keys each
- `src/utils/featureToggles.ts` — update `isFeatureEnabled` to accept `keyof TeamSettings` (not just `keyof FeatureToggles`) so `auto_decline_tentative` can be checked without type errors
- `src/modules/trainings/RecurringTrainingModal.tsx` — pre-fill form fields from team defaults when modal opens
- Game/training creation forms — pre-fill from team defaults when available

### Backend (pb_hooks)

- `participation_reminders.pb.js` — gate tentative auto-decline behind `auto_decline_tentative` team setting
- `sv_sync.pb.js` — apply `game_respond_by_days` when creating new games
- `bp_sync.pb.js` — apply `game_respond_by_days` when creating new games

### No changes needed

- PocketBase schema (`features_enabled` field already accepts arbitrary JSON)
