# Deadline Time (HH:MM) for Respond By

**Date:** 2026-03-23
**Status:** Approved

## Problem

The "Respond by" field only accepts a date. Admins want to set a specific cutoff time (e.g. 19:00) so members must RSVP before a precise moment, not just by end of day.

## Design

### Storage

No schema change. PocketBase `respond_by` is already a datetime string (`"2026-04-12 00:00:00"`). We store the actual time instead of midnight.

### Forms: TrainingForm, EventForm, GameDetailModal

- Add a `<input type="time">` next to the existing DatePicker for "Respond by"
- New state: `respondByTime` (string, HH:MM format)
- **Default**: when a date is picked and time is empty, auto-fill with the activity's start time
- **Submit**: `respond_by: respondBy ? \`${respondBy} ${respondByTime || startTime || '23:59'}:00\` : null`
- **Edit mode**: parse existing `respond_by` to extract time portion (split on space, take `[1]`, slice to HH:MM). If time is `00:00`, treat as unset and show the activity start time instead.

### RecurringTrainingModal

- `computeRespondBy()` includes the training's `startTime` in the computed deadline
- Output changes from `toISODate(d)` (date only) to `\`${toISODate(d)} ${startTime}:00\``
- For the `'hours'` unit: construct `new Date(\`${trainingDate}T${startTime}\`)` to avoid UTC/local timezone mismatch when parsing date-only strings
- No new UI input needed — time is derived from the training start time

### Deadline Check Logic

Current pattern in TrainingCard, EventCard, ParticipationButton, ParticipationRosterModal:
```ts
const deadlineDate = new Date(`${respondBy}T${activityStartTime || '23:59'}`)
```

**Change**: Extract both date and time from `respond_by`, with backward-compatible fallback:
```ts
const [rbDate, rbTime] = (respond_by || '').split(' ')
const effectiveTime = rbTime && rbTime !== '00:00:00' ? rbTime.slice(0, 5) : (activityStartTime || '23:59')
const deadlineDate = new Date(`${rbDate}T${effectiveTime}`)
```

**Backward compatibility**: Legacy records stored with `00:00:00` (midnight) are treated as "no time set" and fall back to the activity start time or 23:59, preserving the old behavior.

### Display

- Cards and roster modal show: "12. Apr 2026, 19:00" (add time to formatted output)
- "Deadline passed" styling unchanged

### Reminder Hook (participation_reminders.pb.js)

- Currently filters with `respond_by ~ "2026-04-12"` (substring match on date). This still works with the added time component.
- No changes needed to the hook logic.
- **Note**: The reminder cron fires at 09:00 CEST regardless of the deadline time. A deadline at 06:00 would already have passed by the time the reminder fires. This is acceptable — the reminder is a "last day" nudge, not a precision timer.

### i18n

- Add `respondByTime` label if needed, or use inline layout where the time picker is visually part of the same "Respond by" row (no separate label needed).

## Files to Modify

1. `src/modules/trainings/TrainingForm.tsx` — add time state + input
2. `src/modules/events/EventForm.tsx` — add time state + input
3. `src/modules/games/components/GameDetailModal.tsx` — add time input to inline deadline editor
4. `src/modules/trainings/RecurringTrainingModal.tsx` — include start time in `computeRespondBy()`
5. `src/modules/trainings/TrainingCard.tsx` — update deadline parsing + display
6. `src/modules/trainings/TrainingDetailModal.tsx` — update deadline parsing + display
7. `src/modules/events/EventCard.tsx` — update deadline parsing + display
8. `src/components/ParticipationButton.tsx` — update deadline parsing
9. `src/components/ParticipationRosterModal.tsx` — update deadline parsing + display

## Out of Scope

- Changing the PocketBase field type
- Adding a custom TimePicker component (native `<input type="time">` is sufficient)
- Changing the reminder cron schedule
