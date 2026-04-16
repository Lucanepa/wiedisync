/** Known public routes for smoke tests */
export const PUBLIC_ROUTES = [
  { path: '/games', name: 'Games' },
  { path: '/calendar', name: 'Calendar' },
  { path: '/events', name: 'Events' },
  { path: '/datenschutz', name: 'Privacy' },
  { path: '/impressum', name: 'Imprint' },
] as const

/** Auth-required routes — should redirect to /login when unauthenticated */
export const AUTH_ROUTES = [
  { path: '/teams', name: 'Teams' },
  { path: '/trainings', name: 'Trainings' },
  { path: '/absences', name: 'Absences' },
  { path: '/scorer', name: 'Scorer' },
  { path: '/profile', name: 'Profile' },
] as const

/** Admin-only routes */
export const ADMIN_ROUTES = [
  { path: '/admin/spielplanung', name: 'Game Planning' },
  { path: '/admin/hallenplan', name: 'Hall Slots' },
  { path: '/admin/scorer-assign', name: 'Scorer Assign' },
  { path: '/admin/terminplanung', name: 'Terminplanung Setup' },
  { path: '/admin/terminplanung/dashboard', name: 'Terminplanung Dashboard' },
] as const

/** Superadmin-only routes */
export const SUPERADMIN_ROUTES = [
  { path: '/admin/database', name: 'Database' },
] as const

/** Known team slugs in the dev DB */
export const KNOWN_TEAM_SLUGS = ['H1', 'H3', 'D2'] as const

/** Mobile devices for multi-device responsiveness tests */
export const MOBILE_DEVICES = [
  'iPhone SE',
  'iPhone 15',
  'Pixel 7',
  'iPad Pro 11',
] as const

/** Viewport presets matching Tailwind breakpoints */
export const VIEWPORTS = {
  xs: { width: 320, height: 568 },   // iPhone SE / smallest target
  sm: { width: 648, height: 900 },   // Just above Tailwind sm (40rem=640px) to avoid boundary flake
  lg: { width: 1024, height: 768 },  // Tailwind lg (desktop sidebar threshold)
} as const
