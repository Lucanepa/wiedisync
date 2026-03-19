# Location Autocomplete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add location autocomplete to all location inputs in Wiedisync, searching PocketBase halls (instant) and Nominatim/OpenStreetMap (debounced), using a cmdk combobox UI.

**Architecture:** A shared `LocationCombobox` component wraps cmdk `Command` inside a Radix `Popover` (following `SearchableSelect` pattern). Two hooks power search: `useHallSearch` filters PB halls client-side, `useNominatimSearch` queries OpenStreetMap with 600ms debounce. Results render in two grouped sections.

**Tech Stack:** React 19, TypeScript, cmdk, @radix-ui/react-popover, Nominatim API, PocketBase SDK

**Spec:** `docs/superpowers/specs/2026-03-19-location-autocomplete-design.md`

---

### Task 1: Add Types

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Add NominatimResult and LocationResult types**

Add after the existing `Hall` interface (around line 96):

```typescript
export interface NominatimResult {
  lat: string
  lon: string
  name: string
  display_name: string
  address: {
    amenity?: string
    building?: string
    road?: string
    house_number?: string
    city?: string
    town?: string
    village?: string
    postcode?: string
    country?: string
  }
}

export interface LocationResult {
  name: string
  address: string
  city: string
  lat: number | null
  lon: number | null
  source: 'pocketbase' | 'nominatim'
}
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add NominatimResult and LocationResult types"
```

---

### Task 2: Add i18n Keys

**Files:**
- Modify: `src/i18n/locales/de/common.ts`
- Modify: `src/i18n/locales/en/common.ts`
- Modify: `src/i18n/locales/fr/common.ts`
- Modify: `src/i18n/locales/it/common.ts`
- Modify: `src/i18n/locales/gsw/common.ts`

- [ ] **Step 1: Add keys to German locale**

Add to the Labels section of `src/i18n/locales/de/common.ts`:

```typescript
clubHalls: 'Vereinshallen',
searchResults: 'Weitere Ergebnisse',
searching: 'Suche...',
locationPlaceholder: 'Ort suchen...',
```

Note: `noResults: 'Keine Ergebnisse'` already exists.

- [ ] **Step 2: Add keys to English locale**

```typescript
clubHalls: 'Club Halls',
searchResults: 'More Results',
searching: 'Searching...',
locationPlaceholder: 'Search location...',
```

- [ ] **Step 3: Add keys to French locale**

```typescript
clubHalls: 'Salles du club',
searchResults: 'Autres résultats',
searching: 'Recherche...',
locationPlaceholder: 'Rechercher un lieu...',
```

- [ ] **Step 4: Add keys to Italian locale**

```typescript
clubHalls: 'Palestre del club',
searchResults: 'Altri risultati',
searching: 'Ricerca...',
locationPlaceholder: 'Cerca luogo...',
```

- [ ] **Step 5: Add keys to Swiss German locale**

```typescript
clubHalls: 'Vereinshalle',
searchResults: 'Witeri Ergebnis',
searching: 'Sueche...',
locationPlaceholder: 'Ort sueche...',
```

- [ ] **Step 6: Commit**

```bash
git add src/i18n/locales/*/common.ts
git commit -m "feat: add location autocomplete i18n keys"
```

---

### Task 3: Create `useNominatimSearch` Hook

**Files:**
- Create: `src/hooks/useNominatimSearch.ts`

- [ ] **Step 1: Implement the hook**

```typescript
import { useState, useEffect, useRef } from 'react'
import type { NominatimResult } from '../types'

export function useNominatimSearch(query: string, options?: { enabled?: boolean }) {
  const [results, setResults] = useState<NominatimResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const enabled = options?.enabled ?? true

  useEffect(() => {
    if (!enabled || query.length < 3) {
      setResults([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)

    const timer = setTimeout(async () => {
      // Abort previous request
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      try {
        const params = new URLSearchParams({
          q: query,
          format: 'json',
          countrycodes: 'ch',
          limit: '5',
          addressdetails: '1',
        })
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?${params}`,
          {
            signal: controller.signal,
            headers: { 'User-Agent': 'Wiedisync/1.0 (https://wiedisync.kscw.ch)' },
          },
        )
        if (!res.ok) throw new Error('Nominatim request failed')
        const data: NominatimResult[] = await res.json()
        setResults(data)
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setResults([])
      } finally {
        if (!controller.signal.aborted) setIsLoading(false)
      }
    }, 600)

    return () => {
      clearTimeout(timer)
      abortRef.current?.abort()
    }
  }, [query, enabled])

  return { results, isLoading }
}
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useNominatimSearch.ts
git commit -m "feat: add useNominatimSearch hook with 600ms debounce"
```

---

### Task 4: Create `useHallSearch` Hook

**Files:**
- Create: `src/hooks/useHallSearch.ts`

- [ ] **Step 1: Implement the hook**

```typescript
import { useState, useEffect } from 'react'
import type { Hall, LocationResult } from '../types'
import { usePB } from './usePB'

function hallToLocationResult(hall: Hall): LocationResult {
  return {
    name: hall.name,
    address: hall.address,
    city: hall.city,
    lat: null,
    lon: null,
    source: 'pocketbase',
  }
}

export function useHallSearch(query: string) {
  const { data: halls } = usePB<Hall>('halls', { all: true, sort: 'name' })
  const [results, setResults] = useState<LocationResult[]>([])

  useEffect(() => {
    if (!query || query.length < 1) {
      setResults([])
      return
    }
    const q = query.toLowerCase()
    const filtered = halls
      .filter(
        (h) =>
          h.name.toLowerCase().includes(q) ||
          h.address.toLowerCase().includes(q) ||
          h.city.toLowerCase().includes(q),
      )
      .slice(0, 5)
      .map(hallToLocationResult)
    setResults(filtered)
  }, [query, halls])

  return { results }
}
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useHallSearch.ts
git commit -m "feat: add useHallSearch hook for client-side hall filtering"
```

---

### Task 5: Create `LocationCombobox` Component

**Files:**
- Create: `src/components/LocationCombobox.tsx`

This follows the same Popover + Command pattern as `src/components/ui/SearchableSelect.tsx`.

- [ ] **Step 1: Implement the component**

```typescript
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MapPin } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandLoading,
} from '@/components/ui/command'
import { cn } from '@/lib/utils'
import { useNominatimSearch } from '@/hooks/useNominatimSearch'
import { useHallSearch } from '@/hooks/useHallSearch'
import type { LocationResult, NominatimResult } from '@/types'

interface LocationComboboxProps {
  value: string
  onChange: (value: string) => void
  onSelect?: (result: LocationResult) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

function nominatimToLocationResult(r: NominatimResult): LocationResult {
  return {
    name: r.address.amenity || r.address.building || r.name,
    address: `${r.address.road || ''} ${r.address.house_number || ''}`.trim(),
    city: r.address.city || r.address.town || r.address.village || '',
    lat: parseFloat(r.lat),
    lon: parseFloat(r.lon),
    source: 'nominatim',
  }
}

export default function LocationCombobox({
  value,
  onChange,
  onSelect,
  placeholder,
  disabled,
  className,
}: LocationComboboxProps) {
  const { t } = useTranslation('common')
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const { results: hallResults } = useHallSearch(search)
  const { results: nominatimResults, isLoading: nominatimLoading } = useNominatimSearch(search)
  const osmResults = nominatimResults.map(nominatimToLocationResult)

  const handleSelect = (result: LocationResult) => {
    const display = [result.name, result.address, result.city].filter(Boolean).join(', ')
    onChange(display)
    onSelect?.(result)
    setOpen(false)
    setSearch('')
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            'flex min-h-[44px] w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-left text-sm shadow-sm ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
            className,
          )}
        >
          <span className={value ? '' : 'text-muted-foreground'}>
            {value || placeholder || t('locationPlaceholder')}
          </span>
          <MapPin className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={t('locationPlaceholder')}
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>{t('noResults')}</CommandEmpty>

            {hallResults.length > 0 && (
              <CommandGroup heading={t('clubHalls')}>
                {hallResults.map((r, i) => (
                  <CommandItem
                    key={`hall-${i}`}
                    value={`hall-${r.name}-${r.address}`}
                    onSelect={() => handleSelect(r)}
                    className="flex items-center gap-2"
                  >
                    <div className="h-full w-0.5 self-stretch rounded bg-[#FFC832]" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{r.name}</div>
                      {(r.address || r.city) && (
                        <div className="truncate text-xs text-muted-foreground">
                          {[r.address, r.city].filter(Boolean).join(', ')}
                        </div>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {(osmResults.length > 0 || nominatimLoading) && (
              <CommandGroup heading={t('searchResults')}>
                {nominatimLoading && <CommandLoading>{t('searching')}</CommandLoading>}
                {osmResults.map((r, i) => (
                  <CommandItem
                    key={`osm-${i}`}
                    value={`osm-${r.name}-${r.address}-${r.city}`}
                    onSelect={() => handleSelect(r)}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{r.name}</div>
                      {(r.address || r.city) && (
                        <div className="truncate text-xs text-muted-foreground">
                          {[r.address, r.city].filter(Boolean).join(', ')}
                        </div>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
```

- [ ] **Step 2: Check if `CommandLoading` exists in the command component**

Read `src/components/ui/command.tsx` and check if `CommandLoading` is exported. If not, it needs to be added (cmdk provides `Command.Loading`). If missing, add:

```typescript
const CommandLoading = ({
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof CommandPrimitive.Loading> & { className?: string }) => (
  <CommandPrimitive.Loading
    className={cn('py-2 px-3 text-sm text-muted-foreground', className)}
    {...props}
  >
    {children}
  </CommandPrimitive.Loading>
)
CommandLoading.displayName = 'CommandLoading'
```

And add `CommandLoading` to the exports at the bottom of the file.

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/components/LocationCombobox.tsx src/components/ui/command.tsx
git commit -m "feat: add LocationCombobox component with two-layer search"
```

---

### Task 6: Integrate into EventForm

**Files:**
- Modify: `src/modules/events/EventForm.tsx`

- [ ] **Step 1: Add import**

Add to imports at top of file:

```typescript
import LocationCombobox from '@/components/LocationCombobox'
```

- [ ] **Step 2: Replace the location FormInput**

Find (around line 338-343):

```tsx
<FormInput
  label={t('location')}
  type="text"
  value={location}
  onChange={(e) => setLocation(e.target.value)}
/>
```

Replace with:

```tsx
<FormField label={t('location')}>
  <LocationCombobox
    value={location}
    onChange={setLocation}
  />
</FormField>
```

The component internally builds the display string (`name, address, city`) and passes it to `onChange`. No `onSelect` needed for single-field cases.

Ensure `FormField` is imported (check existing imports — it may already be imported alongside `FormInput`/`FormTextarea`).

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Manual test**

Run: `npm run dev`
Navigate to create event form. Type "KWI" — should see club halls. Type "Sporthalle" — should see club halls + Nominatim results after 600ms.

- [ ] **Step 5: Commit**

```bash
git add src/modules/events/EventForm.tsx
git commit -m "feat: add location autocomplete to EventForm"
```

---

### Task 7: Integrate into TrainingForm

**Files:**
- Modify: `src/modules/trainings/TrainingForm.tsx`

- [ ] **Step 1: Add import**

```typescript
import LocationCombobox from '@/components/LocationCombobox'
```

- [ ] **Step 2: Replace the hall_name FormInput**

Find the "Andere Halle" free-text input (around line 444-452):

```tsx
{hallId === '__other__' && (
  <FormInput
    type="text"
    value={hallName}
    onChange={(e) => setHallName(e.target.value)}
    placeholder={tc('hallNamePlaceholder')}
    className="mt-2"
  />
)}
```

Replace with:

```tsx
{hallId === '__other__' && (
  <div className="mt-2">
    <LocationCombobox
      value={hallName}
      onChange={setHallName}
      onSelect={(r) => setHallName(r.name)}
      placeholder={tc('hallNamePlaceholder')}
    />
  </div>
)}
```

Note: The primary hall `Select` dropdown remains unchanged.

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Manual test**

Run: `npm run dev`
Navigate to training form, select "Andere Halle", type a hall name — should see autocomplete.

- [ ] **Step 5: Commit**

```bash
git add src/modules/trainings/TrainingForm.tsx
git commit -m "feat: add location autocomplete to TrainingForm other-hall input"
```

---

### Task 8: Integrate into AwayProposalForm

**Files:**
- Modify: `src/modules/gameScheduling/components/AwayProposalForm.tsx`

- [ ] **Step 1: Add import**

```typescript
import LocationCombobox from '@/components/LocationCombobox'
```

- [ ] **Step 2: Replace all 3 place inputs**

Find the place input inside the `.map()` (around line 79-87):

```tsx
<input
  type="text"
  value={p.place}
  onChange={e => updateProposal(i, 'place', e.target.value)}
  placeholder="z.B. Sporthalle Muster, Musterstr. 1"
  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-500 dark:bg-gray-600 dark:text-gray-100"
  required
/>
```

Replace with:

```tsx
<LocationCombobox
  value={p.place}
  onChange={(v) => updateProposal(i, 'place', v)}
  placeholder="z.B. Sporthalle Muster, Musterstr. 1"
/>
```

Note: The `required` attribute is handled by `allFilled` check on submit, not the HTML attribute.

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Manual test**

Run: `npm run dev`
Navigate to game scheduling → away proposals. Each of the 3 place fields should show autocomplete.

- [ ] **Step 5: Commit**

```bash
git add src/modules/gameScheduling/components/AwayProposalForm.tsx
git commit -m "feat: add location autocomplete to AwayProposalForm"
```

---

### Task 9: Integrate into RecordEditModal (Admin)

**Files:**
- Modify: `src/modules/admin/components/RecordEditModal.tsx`

- [ ] **Step 1: Add imports**

```typescript
import LocationCombobox from '@/components/LocationCombobox'
import type { LocationResult } from '@/types'
```

- [ ] **Step 2: Add location select handler**

Inside the `RecordEditModal` component function, before `renderField`, add:

```typescript
const isHallsCollection = collection === 'halls'

const handleLocationSelect = (result: LocationResult) => {
  setFormData((prev) => ({
    ...prev,
    name: result.name,
    address: result.address,
    city: result.city,
    ...(result.lat != null && result.lon != null
      ? { maps_url: `https://www.google.com/maps/search/?api=1&query=${result.lat},${result.lon}` }
      : {}),
  }))
}
```

- [ ] **Step 3: Add LocationCombobox to the text field rendering**

In the `renderField` function, modify the `case 'text'` block. Before the existing `return`, add a check:

```typescript
case 'text':
case 'url':
case 'editor':
  // Show LocationCombobox for hall name field in halls collection
  if (isHallsCollection && field.name === 'name') {
    return (
      <LocationCombobox
        value={String(value ?? '')}
        onChange={(v) => setField(field.name, v)}
        onSelect={handleLocationSelect}
        className="mt-1"
      />
    )
  }
  return (
    <input
      type="text"
      value={String(value ?? '')}
      onChange={(e) => setField(field.name, e.target.value)}
      className={inputClass}
    />
  )
```

- [ ] **Step 4: Verify build**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 5: Manual test**

Run: `npm run dev`
Navigate to admin → halls collection → edit a record. The `name` field should show autocomplete. Selecting a result should auto-fill name, address, city, and maps_url fields.

- [ ] **Step 6: Commit**

```bash
git add src/modules/admin/components/RecordEditModal.tsx
git commit -m "feat: add location autocomplete to admin hall record editing"
```

---

### Task 10: Final Verification

- [ ] **Step 1: Full build check**

Run: `npx astro build` or `npm run build`
Expected: build succeeds with no errors

- [ ] **Step 2: Test all integration points**

Run: `npm run dev` and verify:
1. EventForm → location field has autocomplete
2. TrainingForm → "Andere Halle" field has autocomplete
3. AwayProposalForm → all 3 place fields have autocomplete
4. RecordEditModal → halls collection name field has autocomplete with multi-field fill

- [ ] **Step 3: Test edge cases**

- Type < 3 chars: no Nominatim search (PB halls still filter)
- Type gibberish: "Keine Ergebnisse" shown
- Slow network: "Suche..." loading indicator in OSM group
- Select PB hall: gold accent visible, instant selection
- Select Nominatim result: fields auto-fill correctly
- Escape key: closes combobox
- Arrow keys + Enter: keyboard selection works

- [ ] **Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address location autocomplete edge cases"
```
