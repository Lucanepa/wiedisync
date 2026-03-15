# shadcn/ui Migration Design — KSCW Platform

**Date:** 2026-03-15
**Status:** Approved
**Approach:** B — shadcn as foundation, KSCW wrappers on top for custom UX patterns

## Context

The KSCW platform (React 19 + Tailwind CSS v4 + Vite) currently uses hand-rolled UI components with 8 Radix UI packages installed but only 1 used (Popover in DatePicker). Headless UI is installed but completely unused. The app has ~140 TSX files, 6 core UI components in `src/components/ui/`, and ~28 feature components.

### Goals

1. **Consistency & polish** — unified design system with battle-tested accessible components
2. **Development speed** — pre-built components for new features (Command palette, Sheet, Toast, DataTable, etc.)
3. **Reduce custom code** — replace hand-rolled Modal, SwitchToggle, Select, etc. with maintained equivalents
4. **Future-proofing** — well-supported component system as the app grows

### Constraints

- Must preserve mobile-first UX: sheet-up-on-mobile / centered-modal-on-desktop adaptive behavior
- Must keep KSCW brand colors (brand-500 #4A55A2, gold-400 #FFC832) alongside shadcn semantic tokens
- Must not break 223 Playwright E2E tests
- German UI, code in English

## Architecture

### Theming Strategy: Hybrid

shadcn semantic tokens map to KSCW brand colors. Existing `brand-*` and `gold-*` palette scales remain available as utility classes for fine-grained use.

| shadcn token | Light value | Dark value | Maps to |
|---|---|---|---|
| `--primary` | brand-500 (#4A55A2) | brand-500 (#4A55A2) | Main actions, links |
| `--primary-foreground` | white | white | Text on primary |
| `--secondary` | gold-400 (#FFC832) | gold-400 (#FFC832) | Accent, highlights |
| `--secondary-foreground` | gray-900 | gray-900 | Text on secondary |
| `--accent` | brand-50 (#eef0fa) | brand-900/50 | Hover highlights |
| `--accent-foreground` | brand-700 | gold-400 | Text on accent |
| `--muted` | gray-100 | gray-800 | Subdued backgrounds |
| `--muted-foreground` | gray-500 | gray-400 | Secondary text |
| `--destructive` | red-600 | red-700 | Danger actions |
| `--destructive-foreground` | white | white | Text on destructive |
| `--background` | white | gray-900 | Page background |
| `--foreground` | gray-900 | gray-100 | Default text |
| `--card` | white | gray-800 | Card backgrounds |
| `--card-foreground` | gray-900 | gray-100 | Card text |
| `--popover` | white | gray-800 | Popover/dropdown bg |
| `--popover-foreground` | gray-900 | gray-100 | Popover text |
| `--border` | gray-200 | gray-700 | Borders |
| `--input` | gray-300 | gray-600 | Input borders |
| `--ring` | brand-500/40 | brand-500/40 | Focus rings |

The existing `brand-*` (50–950) and `gold-*` (50–900) scales stay in `@theme` as additional palette tokens.

### CSS Architecture

`index.css` structure after migration:

**CSS variable format:** All semantic tokens use complete `hsl()` values (e.g. `--primary: hsl(231 38% 46%)`), NOT space-separated channels. This is required for Tailwind v4's `@theme inline` `var()` mapping to work. Verify `bg-primary` resolves correctly after Phase 1 before proceeding.

```
1. @import "tailwindcss"
2. @custom-variant dark (&:where(.dark, .dark *))
3. :root { shadcn semantic CSS variables with complete hsl() values }
4. .dark { dark mode overrides }
5. @theme inline {
     /* shadcn semantic → Tailwind utilities */
     --color-background: var(--background);
     --color-primary: var(--primary);
     ...
     /* KSCW palette (preserved) */
     --color-brand-50 through --color-brand-950
     --color-gold-50 through --color-gold-900
   }
6. @layer base { body { background-color: var(--background); color: var(--foreground); } }
7. Custom animations (sheet, modal, fade — kept for KSCW wrappers)
8. Scrollbar, safe-area, reduced-motion styles
```

### File Structure

```
src/
  lib/
    utils.ts              ← cn() helper (clsx + tailwind-merge)
  components/
    ui/                   ← shadcn components (lowercase: button.tsx, card.tsx, dialog.tsx, etc.)
    Modal.tsx             ← KSCW wrapper: shadcn Dialog (desktop) + Drawer (mobile)
    ConfirmDialog.tsx     ← Rewritten on shadcn AlertDialog
    SwitchToggle.tsx      ← KSCW wrapper: shadcn Switch + icon overlay
    FormField.tsx         ← New: label + input + error + helperText wrapper
    ... (domain components unchanged)
```

Convention: shadcn primitives use lowercase filenames (`button.tsx`), KSCW wrappers use PascalCase (`Modal.tsx`).

### ThemeProvider

The existing `useTheme` hook in `src/hooks/useTheme.tsx` is already compatible — it toggles `dark` class on `<html>`, which is exactly what shadcn expects. No changes needed.

## Component Migration Map

### Tier 1 — Direct shadcn replacements

| Current component | shadcn replacement | Migration notes |
|---|---|---|
| `ui/Button.tsx` | `shadcn/button` | Variant mapping: primary→default, secondary→outline, ghost→ghost, danger→destructive. Extend with `loading` prop and Loader2 spinner |
| `ui/Badge.tsx` | `shadcn/badge` | Extend with 8 KSCW color variants (success, warning, danger, info, neutral, brand, purple, orange, teal) as additional variant values |
| `ui/Card.tsx` | `shadcn/card` | **Note:** `ui/Card.tsx` is currently dead code (zero imports in codebase). Delete it; adopt shadcn Card fresh when domain components need it. Domain components (GameCard, TeamCard, etc.) hand-roll their own card patterns — migrate these to shadcn Card opportunistically |
| `ui/Input.tsx` (Input) | `shadcn/input` + `shadcn/label` | Wrap in FormField for label+error+helperText pattern |
| `ui/Input.tsx` (Textarea) | `shadcn/textarea` + `shadcn/label` | Same FormField wrapper |
| `ui/Input.tsx` (Select) | `shadcn/select` | **Breaking API change**: current native `<select>` with `<option>` children + `onChange(e)` → Radix-based `<Select><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="...">...</SelectItem></SelectContent></Select>` with `onValueChange(value)`. Every usage site (~8 files) needs structural JSX changes, not just import swaps |
| `ConfirmDialog.tsx` | `shadcn/alert-dialog` | Native shadcn confirmation pattern |
| `ui/DatePicker.tsx` | `shadcn/popover` + `shadcn/calendar` | Replaces manual Radix Popover + custom calendar grid |
| `ui/SearchableSelect.tsx` | `shadcn/command` + `shadcn/popover` | Combobox pattern |

### Tier 2 — KSCW wrappers on shadcn primitives

| Current component | Built on | Why wrapper needed |
|---|---|---|
| `Modal.tsx` | `shadcn/dialog` + `shadcn/drawer` | Adaptive UX: sheet-up on mobile, centered modal on desktop, with enter/exit animations |
| `MoreSheet.tsx` | Keep as-is (Tier 3) | 370 lines of domain logic (nav, auth, profile, admin toggles); only ~20 lines are animation/backdrop. Low benefit vs regression risk |
| `FilterChips.tsx` | `shadcn/toggle-group` | Chip styling on toggle-group primitive |
| `SportToggle.tsx` | `shadcn/toggle-group` | Two-option sport selector |
| `ViewToggle.tsx` | `shadcn/toggle-group` | List/grid view toggle |
| `SwitchToggle.tsx` | `shadcn/switch` | Icon-inside-knob toggle with label — KSCW-specific UX |

### Tier 3 — Keep as-is (no migration)

| Component | Reason |
|---|---|
| `TeamChip.tsx` | Domain-specific, per-team color coding |
| `TeamMultiSelect.tsx` / `TeamSelect.tsx` | Domain-specific (could use shadcn Command internally later) |
| `LoadingSpinner.tsx` | Trivial, no benefit from shadcn |
| `EmptyState.tsx` | Layout component |
| `AdminToggle.tsx` / `AdminOnly.tsx` | Auth logic, not UI primitives |
| `NotificationBell.tsx` / `NotificationPanel.tsx` | Domain-specific |
| `BottomTabBar.tsx` | Mobile nav, domain-specific |
| `ImageLightbox.tsx` | Could use shadcn Dialog later, low priority |
| All Participation components | Domain-specific feature components |
| Route guards (`AuthRoute`, `AdminRoute`, `SuperAdminRoute`) | Logic, not UI |

## Execution Order

### Phase 1: Foundation

1. Add `@/` path alias to `tsconfig.app.json` — requires both `"baseUrl": "."` and `"paths": { "@/*": ["./src/*"] }` in `compilerOptions`
2. Add matching alias to `vite.config.ts`: `resolve: { alias: { '@': path.resolve(__dirname, './src') } }`
3. Install `clsx` + `tailwind-merge`
4. Create `src/lib/utils.ts` with `cn()` helper
5. Run `npx shadcn@latest init` — generates `components.json`
6. Ensure `components.json` has correct Tailwind v4 config:
   ```json
   {
     "$schema": "https://ui.shadcn.com/schema.json",
     "style": "new-york",
     "rsc": false,
     "tsx": true,
     "tailwind": {
       "config": "",
       "css": "src/index.css",
       "cssVariables": true
     },
     "aliases": {
       "components": "@/components",
       "utils": "@/lib/utils",
       "ui": "@/components/ui"
     }
   }
   ```
7. Update `index.css`: add shadcn semantic CSS variables (`:root` / `.dark`) using complete `hsl()` values, add `@theme inline` mappings, keep existing KSCW palette tokens and custom animations
8. **Verification gate**: confirm `bg-primary` and `text-foreground` resolve correctly in the browser before proceeding to Phase 2

### Phase 2: Add shadcn primitives
```bash
npx shadcn@latest add button badge card input textarea label select \
  switch dialog drawer alert-dialog popover command calendar \
  toggle-group tooltip dropdown-menu separator
```

### Phase 3: Build KSCW wrappers
1. Extend `button.tsx` with `loading` prop and KSCW variant aliases
2. Extend `badge.tsx` with 8 KSCW color variants
3. Extend `card.tsx` with `hoverable` prop
4. Create `FormField.tsx` — label + shadcn Input/Textarea + error + helperText
5. Rewrite `Modal.tsx` — shadcn Dialog (desktop) + Drawer (mobile) with viewport detection
6. Rewrite `ConfirmDialog.tsx` — shadcn AlertDialog (currently wraps Modal; this rewrite removes that dependency entirely, so Modal must be migrated first or ConfirmDialog must be made independent)
7. Rewrite `SwitchToggle.tsx` — shadcn Switch with icon overlay

### Phase 4: Migrate imports across codebase
For each replaced component, find all imports across ~140 TSX files and update:
- `import Button from '../components/ui/Button'` → `import { Button } from '../components/ui/button'`
- `import { Input, Textarea, Select } from '../components/ui/Input'` → `import { FormField } from '../components/FormField'` + shadcn Select
- `import Card from '../components/ui/Card'` → `import { Card, CardHeader, CardContent, CardFooter } from '../components/ui/card'`
- Update Card subcomponent syntax: `Card.Header` → `CardHeader`, `Card.Body` → `CardContent`, `Card.Footer` → `CardFooter`
- Update Badge, Modal, ConfirmDialog, SwitchToggle imports similarly
- Update FilterChips, SportToggle, ViewToggle to use shadcn ToggleGroup internally

### Phase 5: Cleanup
1. Delete old component files that were fully replaced
2. Remove unused dependencies: `@headlessui/react`, unused `@radix-ui/*` packages (dialog, dropdown-menu, select, switch, tabs, toggle-group, tooltip — popover stays as shadcn uses it)
3. Remove redundant `dark:` class overrides where shadcn semantic tokens now handle light/dark automatically

### Phase 6: Verification
1. Run full Playwright E2E suite (223 tests)
2. Manual visual check of key flows: login, games, trainings, scorer, hallenplan, admin
3. Verify dark mode toggle works correctly
4. Verify mobile sheet behavior preserved

## What does NOT change

- `useTheme` hook — already compatible
- Domain components (TeamChip, Participation*, Notification*, Calendar*, etc.)
- PocketBase hooks (backend)
- i18n system
- Routing
- E2E test structure (selectors may need updates — see E2E strategy below)

## E2E Test Selector Strategy

Before migration, audit Playwright selectors that target components being replaced:
- **Modal/Dialog**: native `<dialog>` → Radix Dialog portal. Tests using `dialog` role selectors should still work; tests relying on specific DOM structure (e.g. `dialog[open]`) will break
- **Select**: native `<select>` → Radix Select with `listbox` role. Tests using `getByRole('combobox')` may need updates
- **DatePicker**: Radix Popover structure changes — `data-state` attributes added
- **Button**: export change (default → named) doesn't affect tests, only imports
- Shadcn components add `data-state`, `data-orientation` ARIA attributes — these are additive and shouldn't break existing selectors
- Run E2E suite after each phase, not just at the end

## New shadcn dependencies added

```
clsx
tailwind-merge
@radix-ui/react-alert-dialog (new — for AlertDialog)
@radix-ui/react-separator (new)
vaul (new — for Drawer)
cmdk (new — for Command/combobox)
react-day-picker (new — for Calendar)
```

## Dependencies removed

```
@headlessui/react (unused)
@radix-ui/react-dialog (replaced by shadcn)
@radix-ui/react-dropdown-menu (replaced by shadcn)
@radix-ui/react-select (replaced by shadcn)
@radix-ui/react-switch (replaced by shadcn)
@radix-ui/react-tabs (unused, never imported)
@radix-ui/react-toggle-group (replaced by shadcn)
@radix-ui/react-tooltip (replaced by shadcn)
@radix-ui/react-popover (replaced by shadcn — shadcn installs its own)
```

## Risk Assessment

| Risk | Mitigation |
|---|---|
| Modal behavior regression (mobile sheet UX) | KSCW wrapper preserves exact behavior; test on mobile viewport |
| Card.Header/Body/Footer API change | Mechanical find-replace; TypeScript catches missed spots |
| Button variant naming | Map old → new in a single pass; grep for all usages first |
| E2E selector breakage | shadcn components have good ARIA; update selectors as needed |
| Bundle size increase | vaul + cmdk + react-day-picker add ~25KB gzipped; offset by removing unused Radix packages |
| date-fns overlap | Project already uses `date-fns`; `react-day-picker` also depends on it — no conflict, shared dep |
| Button default→named export | 25+ import sites change; TypeScript catches all missed spots at build time |

## Notes

- **Icon alignment**: Both the codebase and shadcn use `lucide-react` — no icon library conflicts
- **date-fns**: The project's `dateUtils.ts` custom functions remain alongside `react-day-picker`; they serve different purposes (date formatting/math vs calendar UI)
