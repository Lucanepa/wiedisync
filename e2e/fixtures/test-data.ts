/** Known public routes for smoke tests */
export const PUBLIC_ROUTES = [
  { path: '/', name: 'Home' },
  { path: '/games', name: 'Games' },
  { path: '/teams', name: 'Teams' },
  { path: '/calendar', name: 'Calendar' },
  { path: '/events', name: 'Events' },
  { path: '/datenschutz', name: 'Privacy' },
  { path: '/impressum', name: 'Imprint' },
] as const

/** Auth-required routes — should redirect to /login when unauthenticated */
export const AUTH_ROUTES = [
  { path: '/trainings', name: 'Trainings' },
  { path: '/absences', name: 'Absences' },
  { path: '/scorer', name: 'Scorer' },
  { path: '/profile', name: 'Profile' },
] as const

/** Admin-only routes */
export const ADMIN_ROUTES = [
  { path: '/admin/spielplanung', name: 'Game Planning' },
  { path: '/admin/hallenplan', name: 'Hall Slots' },
] as const

/** Superadmin-only routes */
export const SUPERADMIN_ROUTES = [
  { path: '/admin/database', name: 'Database' },
  { path: '/admin/clubdesk-sync', name: 'ClubDesk Sync' },
] as const

/** Known team slugs in the dev DB */
export const KNOWN_TEAM_SLUGS = ['H1', 'H3', 'D2'] as const
