# Deadline Time (HH:MM) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a time picker to the "Respond by" deadline field so admins can set a precise cutoff time (e.g. 19:00), defaulting to the activity start time.

**Architecture:** Add `respondByTime` state alongside existing `respondBy` date state in all 3 form components. Combine date+time when submitting. Update deadline-check logic in 5 display components to parse time from `respond_by` with backward-compatible fallback for legacy `00:00:00` records.

**Tech Stack:** React, TypeScript, native `<input type="time">`, PocketBase datetime strings

---

### Task 1: Add deadline time helper to dateHelpers

**Files:**
- Modify: `src/utils/dateHelpers.ts`

- [ ] **Step 1: Add `parseDeadline` helper function**

Add at end of `src/utils/dateHelpers.ts`:

```ts
/**
 * Parse a respond_by datetime into { date, time } with backward-compatible fallback.
 * Legacy records have 00:00:00 (midnight) — treat as "no time set".
 */
export function parseRespondByTime(respondBy: string | undefined | null, fallbackTime?: string): { date: string; time: string } {
  if (!respondBy) return { date: '', time: '' }
  const [date, rawTime] = respondBy.split(' ')
  const hasExplicitTime = rawTime && rawTime !== '00:00:00'
  const time = hasExplicitTime ? rawTime.slice(0, 5) : (fallbackTime || '')
  return { date: date || '', time }
}

/**
 * Compute deadline Date from respond_by string with backward-compatible fallback.
 * Legacy 00:00:00 records fall back to activityStartTime or 23:59.
 */
export function getDeadlineDate(respondBy: string, activityStartTime?: string): Date {
  const [rbDate, rbTime] = respondBy.split(' ')
  const effectiveTime = rbTime && rbTime !== '00:00:00' ? rbTime.slice(0, 5) : (activityStartTime || '23:59')
  return new Date(`${rbDate}T${effectiveTime}`)
}
```

- [ ] **Step 2: Commit**

```bash
git add src/utils/dateHelpers.ts
git commit -m "feat: add parseRespondByTime and getDeadlineDate helpers"
```

---

### Task 2: Update TrainingForm with time input

**Files:**
- Modify: `src/modules/trainings/TrainingForm.tsx:71,186,208,242,490-496`

- [ ] **Step 1: Add respondByTime state**

After `const [respondBy, setRespondBy] = useState('')` (line 71), add:

```ts
const [respondByTime, setRespondByTime] = useState('')
```

- [ ] **Step 2: Update edit-mode initialization**

Replace line 186:
```ts
setRespondBy(training.respond_by?.split(' ')[0] ?? '')
```
with:
```ts
const rbParsed = parseRespondByTime(training.respond_by, training.start_time)
setRespondBy(rbParsed.date)
setRespondByTime(rbParsed.time)
```

Add import at top: `import { parseRespondByTime } from '../../utils/dateHelpers'`

- [ ] **Step 3: Update reset state**

After `setRespondBy('')` in the else branch (line 208), add:
```ts
setRespondByTime('')
```

- [ ] **Step 4: Update submit logic**

Replace line 242:
```ts
respond_by: respondBy || null,
```
with:
```ts
respond_by: respondBy ? `${respondBy} ${respondByTime || startTime || '23:59'}:00` : null,
```

- [ ] **Step 5: Add time input next to DatePicker**

Replace lines 490-496 (the DatePicker block):
```tsx
<DatePicker
  label={t('respondBy')}
  value={respondBy}
  onChange={setRespondBy}
  max={date}
  helperText={t('respondByHint')}
/>
```
with:
```tsx
<div className="space-y-2">
  <DatePicker
    label={t('respondBy')}
    value={respondBy}
    onChange={(v) => {
      setRespondBy(v)
      if (v && !respondByTime) setRespondByTime(startTime?.slice(0, 5) || '')
    }}
    max={date}
    helperText={t('respondByHint')}
  />
  {respondBy && (
    <FormInput
      label={t('respondByTime')}
      type="time"
      value={respondByTime || startTime?.slice(0, 5) || ''}
      onChange={(e) => setRespondByTime(e.target.value)}
    />
  )}
</div>
```

- [ ] **Step 6: Commit**

```bash
git add src/modules/trainings/TrainingForm.tsx
git commit -m "feat: add deadline time picker to TrainingForm"
```

---

### Task 3: Update EventForm with time input

**Files:**
- Modify: `src/modules/events/EventForm.tsx:90,115,128,247,394-399`

- [ ] **Step 1: Add respondByTime state**

After `const [respondBy, setRespondBy] = useState('')` (line 90), add:
```ts
const [respondByTime, setRespondByTime] = useState('')
```

Add import: `import { parseRespondByTime } from '../../utils/dateHelpers'`

- [ ] **Step 2: Update edit-mode initialization**

Replace line 115:
```ts
setRespondBy(event.respond_by?.split(' ')[0] ?? '')
```
with:
```ts
const rbParsed = parseRespondByTime(event.respond_by)
setRespondBy(rbParsed.date)
setRespondByTime(rbParsed.time)
```

- [ ] **Step 3: Update reset state**

After `setRespondBy('')` in the else branch (line 128), add:
```ts
setRespondByTime('')
```

- [ ] **Step 4: Update submit logic**

Replace line 247:
```ts
respond_by: respondBy || null,
```
with:
```ts
respond_by: respondBy ? `${respondBy} ${respondByTime || '23:59'}:00` : null,
```

Note: Events don't have a single `startTime` like trainings, so default is 23:59.

- [ ] **Step 5: Add time input next to DatePicker**

Replace lines 394-399:
```tsx
<DatePicker
  label={t('respondBy')}
  value={respondBy}
  onChange={setRespondBy}
  helperText={t('respondByHint')}
/>
```
with:
```tsx
<div className="space-y-2">
  <DatePicker
    label={t('respondBy')}
    value={respondBy}
    onChange={(v) => {
      setRespondBy(v)
      if (v && !respondByTime) setRespondByTime('23:59')
    }}
    helperText={t('respondByHint')}
  />
  {respondBy && (
    <FormInput
      label={t('respondByTime')}
      type="time"
      value={respondByTime || '23:59'}
      onChange={(e) => setRespondByTime(e.target.value)}
    />
  )}
</div>
```

- [ ] **Step 6: Commit**

```bash
git add src/modules/events/EventForm.tsx
git commit -m "feat: add deadline time picker to EventForm"
```

---

### Task 4: Update GameDetailModal with time input

**Files:**
- Modify: `src/modules/games/components/GameDetailModal.tsx:67,500,504-525`

- [ ] **Step 1: Add deadlineTime state**

After `const [deadlineValue, setDeadlineValue] = useState(game?.respond_by?.split(' ')[0] ?? '')` (line 67), add:
```ts
const [deadlineTime, setDeadlineTime] = useState(() => {
  const parsed = parseRespondByTime(game?.respond_by, game?.start_time)
  return parsed.time
})
```

Add import: `import { parseRespondByTime } from '../../../utils/dateHelpers'`

- [ ] **Step 2: Update the deadline display**

Replace line 500:
```tsx
<DetailRow label={t('respondBy')} value={formatDate(game.respond_by.split(' ')[0])} />
```
with:
```tsx
<DetailRow label={t('respondBy')} value={`${formatDate(game.respond_by.split(' ')[0])}${(() => { const { time } = parseRespondByTime(game.respond_by, game.start_time); return time ? `, ${time}` : '' })()}`} />
```

- [ ] **Step 3: Add time input to the deadline editor**

In the `editingDeadline` branch (lines 504-525), after the DatePicker and before the OK Button, add:
```tsx
<input
  type="time"
  value={deadlineTime || game?.start_time?.slice(0, 5) || ''}
  onChange={(e) => setDeadlineTime(e.target.value)}
  className="w-24 rounded-lg border px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
/>
```

- [ ] **Step 4: Update the save logic**

Replace line 513:
```ts
await updateGame(game.id, { respond_by: deadlineValue || null })
```
with:
```ts
await updateGame(game.id, { respond_by: deadlineValue ? `${deadlineValue} ${deadlineTime || game?.start_time?.slice(0, 5) || '23:59'}:00` : null })
```

- [ ] **Step 5: Reset deadlineTime when entering edit mode**

Replace lines 529-530:
```ts
setDeadlineValue(game.respond_by?.split(' ')[0] ?? '')
setEditingDeadline(true)
```
with:
```ts
const parsed = parseRespondByTime(game.respond_by, game.start_time)
setDeadlineValue(parsed.date)
setDeadlineTime(parsed.time)
setEditingDeadline(true)
```

- [ ] **Step 6: Commit**

```bash
git add src/modules/games/components/GameDetailModal.tsx
git commit -m "feat: add deadline time picker to GameDetailModal"
```

---

### Task 5: Update RecurringTrainingModal to include start time in deadline

**Files:**
- Modify: `src/modules/trainings/RecurringTrainingModal.tsx:155-167,197`

- [ ] **Step 1: Update computeRespondBy to include time**

Replace the `computeRespondBy` function (lines 155-167):
```ts
function computeRespondBy(trainingDate: string): string {
  if (!respondByAmount) return ''
  const amount = Number(respondByAmount)
  if (!amount || amount <= 0) return ''
  const d = new Date(trainingDate)
  switch (respondByUnit) {
    case 'hours': d.setHours(d.getHours() - amount); break
    case 'days': d.setDate(d.getDate() - amount); break
    case 'weeks': d.setDate(d.getDate() - amount * 7); break
    case 'months': d.setMonth(d.getMonth() - amount); break
  }
  return toISODate(d)
}
```
with:
```ts
function computeRespondBy(trainingDate: string, trainingStartTime: string): string {
  if (!respondByAmount) return ''
  const amount = Number(respondByAmount)
  if (!amount || amount <= 0) return ''
  // Use full datetime to avoid UTC/local timezone mismatch with date-only strings
  const d = new Date(`${trainingDate}T${trainingStartTime || '23:59'}`)
  switch (respondByUnit) {
    case 'hours': d.setHours(d.getHours() - amount); break
    case 'days': d.setDate(d.getDate() - amount); break
    case 'weeks': d.setDate(d.getDate() - amount * 7); break
    case 'months': d.setMonth(d.getMonth() - amount); break
  }
  // For 'hours', date may change so compute both date and time
  // For days/weeks/months, keep the training start time as the deadline time
  if (respondByUnit === 'hours') {
    return `${toISODate(d)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:00`
  }
  return `${toISODate(d)} ${trainingStartTime || '23:59'}:00`
}
```

- [ ] **Step 2: Update the call site**

Replace line 197:
```ts
respond_by: computeRespondBy(date) || null,
```
with:
```ts
respond_by: computeRespondBy(date, slot.start_time) || null,
```

- [ ] **Step 3: Commit**

```bash
git add src/modules/trainings/RecurringTrainingModal.tsx
git commit -m "feat: include start time in recurring training deadline computation"
```

---

### Task 6: Update deadline check + display in TrainingCard

**Files:**
- Modify: `src/modules/trainings/TrainingCard.tsx:193-196,358-361`

- [ ] **Step 1: Update deadline check logic**

Add import at top:
```ts
import { getDeadlineDate } from '../../utils/dateHelpers'
```

Replace lines 193-196:
```ts
const deadlinePassed = training.respond_by ? (() => {
  const deadlineDate = new Date(`${training.respond_by.split(' ')[0]}T${training.start_time || '23:59'}`)
  return deadlineDate < new Date()
})() : false
```
with:
```ts
const deadlinePassed = training.respond_by
  ? getDeadlineDate(training.respond_by, training.start_time) < new Date()
  : false
```

- [ ] **Step 2: Update deadline display**

Replace lines 358-361:
```tsx
{training.respond_by && !isLocked && !deadlinePassed && (
  <p className="text-[10px] leading-tight text-gray-400 dark:text-gray-500">
    {tTrainings('respondBy')}: {formatDate(training.respond_by.split(' ')[0])}{training.start_time ? ` ${formatTime(training.start_time)}` : ''}
  </p>
)}
```
with:
```tsx
{training.respond_by && !isLocked && !deadlinePassed && (
  <p className="text-[10px] leading-tight text-gray-400 dark:text-gray-500">
    {tTrainings('respondBy')}: {formatDate(training.respond_by.split(' ')[0])}, {(() => {
      const [, rbTime] = training.respond_by.split(' ')
      const time = rbTime && rbTime !== '00:00:00' ? rbTime.slice(0, 5) : training.start_time
      return time ? formatTime(time) : ''
    })()}
  </p>
)}
```

- [ ] **Step 3: Commit**

```bash
git add src/modules/trainings/TrainingCard.tsx
git commit -m "feat: update TrainingCard deadline check and display for time support"
```

---

### Task 7: Update deadline check + display in TrainingDetailModal

**Files:**
- Modify: `src/modules/trainings/TrainingDetailModal.tsx:153-156,273-276`

- [ ] **Step 1: Update deadline check logic**

Add import: `import { getDeadlineDate } from '../../utils/dateHelpers'`

Replace lines 153-156:
```ts
const deadlinePassed = training.respond_by ? (() => {
  const deadlineDate = new Date(`${training.respond_by.split(' ')[0]}T${training.start_time || '23:59'}`)
  return deadlineDate < new Date()
})() : false
```
with:
```ts
const deadlinePassed = training.respond_by
  ? getDeadlineDate(training.respond_by, training.start_time) < new Date()
  : false
```

- [ ] **Step 2: Update deadline display**

Replace lines 273-276:
```tsx
{training.respond_by && !isLocked && !deadlinePassed && (
  <p className="text-xs text-gray-400 dark:text-gray-500">
    {tTrainings('respondBy')}: {formatDate(training.respond_by.split(' ')[0])}{training.start_time ? ` ${formatTime(training.start_time)}` : ''}
  </p>
)}
```
with:
```tsx
{training.respond_by && !isLocked && !deadlinePassed && (
  <p className="text-xs text-gray-400 dark:text-gray-500">
    {tTrainings('respondBy')}: {formatDate(training.respond_by.split(' ')[0])}, {(() => {
      const [, rbTime] = training.respond_by.split(' ')
      const time = rbTime && rbTime !== '00:00:00' ? rbTime.slice(0, 5) : training.start_time
      return time ? formatTime(time) : ''
    })()}
  </p>
)}
```

- [ ] **Step 3: Commit**

```bash
git add src/modules/trainings/TrainingDetailModal.tsx
git commit -m "feat: update TrainingDetailModal deadline check and display for time support"
```

---

### Task 8: Update ParticipationButton deadline check

**Files:**
- Modify: `src/components/ParticipationButton.tsx:177-180`

- [ ] **Step 1: Update deadline check**

Add import: `import { getDeadlineDate } from '../utils/dateHelpers'`

Replace lines 177-180:
```ts
const deadlinePassed = respondBy ? (() => {
  const deadlineDate = new Date(`${respondBy}T${activityStartTime || '23:59'}`)
  return deadlineDate < new Date()
})() : false
```
with:
```ts
const deadlinePassed = respondBy
  ? getDeadlineDate(respondBy, activityStartTime) < new Date()
  : false
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ParticipationButton.tsx
git commit -m "feat: update ParticipationButton deadline check to use getDeadlineDate"
```

---

### Task 9: Update ParticipationRosterModal deadline check + display

**Files:**
- Modify: `src/components/ParticipationRosterModal.tsx:229-232,338-346`

- [ ] **Step 1: Update deadline check**

Add import: `import { getDeadlineDate } from '../utils/dateHelpers'`

Replace lines 229-232:
```ts
const deadlinePassed = respondBy ? (() => {
  const deadlineDate = new Date(`${respondBy}T${activityStartTime || '23:59'}`)
  return deadlineDate < new Date()
})() : false
```
with:
```ts
const deadlinePassed = respondBy
  ? getDeadlineDate(respondBy, activityStartTime) < new Date()
  : false
```

- [ ] **Step 2: Update deadline display in banner**

Find the deadline banner (around line 344):
```tsx
{t('respondBy')}: {formatDate(respondBy)}
```
Replace with:
```tsx
{t('respondBy')}: {formatDate(respondBy.split(' ')[0])}{(() => {
  const [, rbTime] = (respondBy || '').split(' ')
  const time = rbTime && rbTime !== '00:00:00' ? `, ${rbTime.slice(0, 5)}` : ''
  return time
})()}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/ParticipationRosterModal.tsx
git commit -m "feat: update ParticipationRosterModal deadline check and display for time support"
```

---

### Task 10: Update EventCard to pass full respond_by (not just date)

**Files:**
- Modify: `src/modules/events/EventCard.tsx:154`

- [ ] **Step 1: Pass full respond_by string**

Replace line 154:
```tsx
respondBy={event.respond_by?.split(' ')[0]}
```
with:
```tsx
respondBy={event.respond_by}
```

This ensures the time component flows through to ParticipationButton, which now handles parsing via `getDeadlineDate`.

- [ ] **Step 2: Commit**

```bash
git add src/modules/events/EventCard.tsx
git commit -m "feat: pass full respond_by datetime to ParticipationButton in EventCard"
```

---

### Task 11: Add i18n key for respondByTime

**Files:**
- Modify: `src/i18n/locales/de/trainings.ts`
- Modify: `src/i18n/locales/en/trainings.ts`
- Modify: `src/i18n/locales/fr/trainings.ts`
- Modify: `src/i18n/locales/it/trainings.ts`

- [ ] **Step 1: Add respondByTime key to all locale files**

Add `respondByTime: 'Deadline time'` (or translated equivalent) to each trainings locale:

- **en**: `respondByTime: 'Deadline time'`
- **de**: `respondByTime: 'Anmeldefrist Uhrzeit'`
- **fr**: `respondByTime: "Heure limite d'inscription"`
- **it**: `respondByTime: 'Ora limite di iscrizione'`

Also add to events locales if using the same key, or check if events already has its own respondBy keys and add there too.

- [ ] **Step 2: Commit**

```bash
git add src/i18n/locales/
git commit -m "feat: add respondByTime i18n key for all locales"
```

---

### Task 12: Build verification

- [ ] **Step 1: Run the build**

```bash
npm run build
```

Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 2: Fix any build errors if needed**

- [ ] **Step 3: Final commit if any fixes were needed**
