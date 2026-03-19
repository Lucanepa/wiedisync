# Location Autocomplete for Wiedisync

**Date:** 2026-03-19
**Status:** Draft

## Problem

All location inputs in Wiedisync are free-text fields. Users must type hall names and addresses from memory, leading to inconsistent data and extra effort — especially for away games at unfamiliar venues.

## Solution

A reusable `LocationCombobox` component using `cmdk` (already installed) that searches two sources: PocketBase halls (instant, client-side) and Nominatim/OpenStreetMap (debounced, no API key). Results appear in grouped sections with club halls pinned on top. Selecting a result auto-fills related form fields while keeping them editable.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Scope | All location inputs including admin | Consistent UX everywhere |
| Search strategy | Two-layer: PB halls pinned + Nominatim | 90% of lookups are known halls; external covers the rest |
| External provider | Nominatim (no API key) | Low volume, zero cost, zero setup; swappable later |
| On select | Auto-fill + editable | Convenience without locking users in if parsing is imperfect |
| UI pattern | cmdk combobox with grouped results | Already installed, keyboard nav built-in, consistent with existing UI |

## Component: `LocationCombobox`

### Props

All types defined in `src/types/index.ts` alongside existing `Hall` type.

```typescript
interface NominatimResult {
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

interface LocationResult {
  name: string
  address: string
  city: string
  lat: number | null
  lon: number | null
  source: 'pocketbase' | 'nominatim'
}

interface LocationComboboxProps {
  value: string
  onChange: (value: string) => void
  onSelect: (result: LocationResult) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}
```

### Behavior

1. User types in the input field
2. **Immediately**: filter PocketBase halls client-side by fuzzy match on `name`, `address`, `city`
3. **After 600ms debounce**: query Nominatim API
4. Display results in two `cmdk` groups:
   - **Vereinshallen** — PB matches, gold left border accent
   - **OpenStreetMap** — Nominatim results
5. User selects via click or keyboard (arrow keys + Enter, Escape to close — all handled natively by cmdk)
6. `onSelect` fires with structured `LocationResult`
7. `onChange` fires with the display string (for the text input value)

### Composition Pattern

Follows the existing `SearchableSelect` (`src/components/ui/SearchableSelect.tsx`) pattern: Radix `Popover` wrapping cmdk `Command`. Popover trigger width matches input via `w-[--radix-popover-trigger-width]`. All keyboard/a11y behavior delegated to cmdk's built-in handling.

Wrap in `FormField` from `src/components/FormField.tsx` at each integration point for consistent label rendering.

### Empty/Loading States

- No input: show nothing (combobox closed)
- Typing, PB results found: show PB results immediately, "Searching..." in OSM group
- Typing, no PB results: show "Searching..." only
- Results loaded: show both groups (hide empty groups)
- No results at all: show "Keine Ergebnisse" message
- Error: silently degrade — show PB results only, no error UI

## Hook: `useNominatimSearch`

```typescript
function useNominatimSearch(query: string, options?: { enabled?: boolean }): {
  results: NominatimResult[]
  isLoading: boolean
}
```

- Endpoint: `https://nominatim.openstreetmap.org/search`
- Params: `q={query}`, `format=json`, `countrycodes=ch`, `limit=5`, `addressdetails=1`
- Headers: `User-Agent: Wiedisync/1.0 (https://wiedisync.kscw.ch)`
- Debounce: 600ms (internal to hook) — ensures Nominatim's 1 req/sec rate limit is respected even with fast typers pausing at word boundaries
- Cancellation: AbortController — new search aborts previous in-flight request
- Min query length: 3 characters before searching

### NominatimResult → LocationResult Mapping

```typescript
{
  name: result.address.amenity || result.address.building || result.name,
  address: `${result.address.road || ''} ${result.address.house_number || ''}`.trim(),
  city: result.address.city || result.address.town || result.address.village || '',
  lat: parseFloat(result.lat),
  lon: parseFloat(result.lon),
  source: 'nominatim'
}
```

## Hook: `useHallSearch`

```typescript
function useHallSearch(query: string): {
  results: LocationResult[]
}
```

- Source: PocketBase `halls` collection (fetched once, cached in component/context)
- Filter: case-insensitive substring match on `name`, `address`, `city`
- Mapping: `Hall` → `LocationResult` with `source: 'pocketbase'`
- Coordinates: `lat: null, lon: null` for PB halls (coordinates not stored on Hall records; maps_url formats vary and are not reliably parseable). The primary value of PB results is name/address autofill, not coordinates.

## Integration Points

### EventForm (`src/modules/events/EventForm.tsx`)

- Replace `location` text input with `LocationCombobox`
- `onSelect`: set `location` to `"${result.name}, ${result.address}, ${result.city}"`
- Single field — no multi-field auto-fill needed

### TrainingForm (`src/modules/trainings/TrainingForm.tsx`)

- The primary hall `Select` dropdown (known halls) remains unchanged
- Replace only the `hall_name` free-text input (shown when "Andere Halle" is selected) with `LocationCombobox`
- `onSelect`: set `hall_name` to `result.name`

### AwayProposalForm (`src/modules/gameScheduling/components/AwayProposalForm.tsx`)

- Replace each `proposed_place_N` text input with `LocationCombobox`
- `onSelect`: set `proposed_place_N` to `"${result.name}, ${result.address}, ${result.city}"`
- Three independent combobox instances

### RecordEditModal (`src/modules/admin/components/RecordEditModal.tsx`)

- When editing a `halls` collection record:
  - `name` field: replace with `LocationCombobox`
  - `onSelect`: auto-fill `name`, `address`, `city` fields in the record
  - Generate `maps_url`: `https://www.google.com/maps/search/?api=1&query={lat},{lon}` (only when lat/lon available from Nominatim result; skip if null)
- Other collections/fields: unchanged

## File Changes

### New Files

| File | Purpose |
|------|---------|
| `src/components/LocationCombobox.tsx` | Reusable cmdk-based location search combobox |
| `src/hooks/useNominatimSearch.ts` | Debounced Nominatim geocoding hook |
| `src/hooks/useHallSearch.ts` | Client-side PocketBase hall filtering hook |

### Modified Files

| File | Change |
|------|--------|
| `src/modules/events/EventForm.tsx` | Swap location input → LocationCombobox |
| `src/modules/trainings/TrainingForm.tsx` | Swap hall_name input → LocationCombobox |
| `src/modules/gameScheduling/components/AwayProposalForm.tsx` | Swap 3x proposed_place inputs → LocationCombobox |
| `src/modules/admin/components/RecordEditModal.tsx` | Conditional LocationCombobox for hall records |

### i18n Keys (all 5 locales)

- `common.clubHalls` → "Vereinshallen" / "Club Halls" / etc.
- `common.searchResults` → "Weitere Ergebnisse" / "More Results" / etc.
- `common.noResults` → "Keine Ergebnisse" / "No results" / etc.
- `common.searching` → "Suche..." / "Searching..." / etc.

## Constraints

- Nominatim rate limit: 1 request/second max — 600ms debounce + AbortController handles this
- Nominatim requires User-Agent identification
- No new dependencies — uses existing `cmdk` and `@radix-ui/react-popover`
- Swiss bias via `countrycodes=ch` but does not hard-block other countries
