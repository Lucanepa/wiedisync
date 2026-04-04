import { useEffect, useState, useCallback } from 'react'
import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../hooks/useAuth'
import { useTheme } from '../hooks/useTheme'
import TeamChip from './TeamChip'
import SwitchToggle from '@/components/SwitchToggle'
import LanguageDropdown from '@/components/LanguageDropdown'
import { getFileUrl } from '../utils/fileUrl'
import AdminToggle from './AdminToggle'
import { useAdminMode } from '../hooks/useAdminMode'
import { Bell, UserX, PenSquare, CalendarDays, ClipboardList, Building2, CalendarClock, Database, HeartPulse, LogIn, User, Users, Settings, ChevronDown, ScrollText, MessageSquare, Banknote, BarChart3, UserPlus } from 'lucide-react'
import type { MemberTeam, Team } from '../types'
import { asObj } from '../utils/relations'

type ExpandedMemberTeam = MemberTeam & { team: Team | string }

/** Animated close: plays exit animation, then calls onClose after it finishes */
function useAnimatedClose(onClose: () => void) {
  const [closing, setClosing] = useState(false)
  const startClose = useCallback(() => {
    setClosing(true)
  }, [])
  const onAnimEnd = useCallback(() => {
    if (closing) onClose()
  }, [closing, onClose])
  return { closing, startClose, onAnimEnd }
}

const iconClass = 'h-5 w-5'

const secondaryItems = [
  { to: '/teams', labelKey: 'teams', icon: <Users className={iconClass} /> },
  { to: '/absences', labelKey: 'absences', icon: <UserX className={iconClass} /> },
  { to: '/scorer', labelKey: 'scorer', icon: <PenSquare className={iconClass} /> },
  { to: '/events', labelKey: 'events', icon: <CalendarDays className={iconClass} /> },
]

const adminItems = [
  { to: '/admin/spielplanung', labelKey: 'gameplan', icon: <ClipboardList className={iconClass} /> },
  { to: '/admin/hallenplan', labelKey: 'hallenplan', icon: <Building2 className={iconClass} /> },
  { to: '/admin/terminplanung', labelKey: 'terminplanung', icon: <CalendarClock className={iconClass} /> },
  { to: '/admin/referee-expenses', labelKey: 'refereeExpenses', icon: <Banknote className={iconClass} /> },
  { to: '/admin/anmeldungen', labelKey: 'anmeldungen', icon: <UserPlus className={iconClass} /> },
  { to: '/admin/club-stats', labelKey: 'clubStats', icon: <BarChart3 className={iconClass} /> },
  { to: '/admin/database', labelKey: 'manageDb', icon: <Database className={iconClass} /> },
]

function OptionsAccordion({ theme, toggleTheme, onClose }: { theme: string; toggleTheme: () => void; onClose?: () => void }) {
  const [open, setOpen] = useState(false)
  const { t } = useTranslation('nav')

  return (
    <div className="px-4 py-2">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full min-h-[44px] items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
      >
        <Settings className="h-5 w-5" />
        <span className="flex-1 text-left">{t('options', 'Options')}</span>
        <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      <div
        className={`grid transition-[grid-template-rows] duration-200 ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
      >
        <div className="overflow-hidden">
          <div className="py-1">
            {/* Dark mode row */}
            <div className="flex min-h-[48px] items-center justify-between rounded-lg px-4 py-3">
              <span className="text-base font-medium text-gray-700 dark:text-gray-300">{t('darkMode', 'Dark mode')}</span>
              <SwitchToggle
                enabled={theme === 'dark'}
                onChange={toggleTheme}
                size="sm"
                ariaLabel="Toggle dark mode"
                iconOff={
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.758 17.303a.75.75 0 00-1.061-1.06l-1.591 1.59a.75.75 0 001.06 1.061l1.591-1.59zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.697 7.757a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 00-1.061 1.06l1.59 1.591z" />
                  </svg>
                }
                iconOn={
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path fillRule="evenodd" d="M9.528 1.718a.75.75 0 01.162.819A8.97 8.97 0 009 6a9 9 0 009 9 8.97 8.97 0 003.463-.69.75.75 0 01.981.98 10.503 10.503 0 01-9.694 6.46c-5.799 0-10.5-4.701-10.5-10.5 0-4.368 2.667-8.112 6.46-9.694a.75.75 0 01.818.162z" clipRule="evenodd" />
                  </svg>
                }
              />
            </div>
            {/* Language row */}
            <div className="flex min-h-[48px] items-center justify-between rounded-lg px-4 py-3">
              <span className="text-base font-medium text-gray-700 dark:text-gray-300">{t('language', 'Language')}</span>
              <LanguageDropdown size="sm" />
            </div>
            {/* Admin toggle row */}
            <div className="flex min-h-[48px] items-center justify-between rounded-lg px-4 py-3">
              <span className="text-base font-medium text-gray-700 dark:text-gray-300">{t('adminMode', 'Admin mode')}</span>
              <AdminToggle size="sm" onAfterToggle={onClose} />
            </div>
            {/* Feedback row */}
            <NavLink
              to="/feedback"
              onClick={onClose}
              className={({ isActive }) =>
                `flex min-h-[48px] items-center gap-3 rounded-lg px-4 py-3 transition-colors ${
                  isActive
                    ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/50 dark:text-gold-400'
                    : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                }`
              }
            >
              <MessageSquare className="h-4 w-4" />
              <span className="text-base font-medium">{t('feedback')}</span>
            </NavLink>
            {/* Version / Changelog row */}
            <NavLink
              to="/changelog"
              onClick={onClose}
              className="flex min-h-[48px] items-center justify-between rounded-lg px-4 py-3 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <span className="flex items-center gap-2 text-base font-medium text-gray-700 dark:text-gray-300">
                <ScrollText className="h-4 w-4" />
                {t('whatsNew', "What's New")}
              </span>
              <span className="text-xs font-mono text-gray-400 dark:text-gray-500">v1.0.0</span>
            </NavLink>
          </div>
        </div>
      </div>
    </div>
  )
}

interface MoreSheetProps {
  onClose: () => void
  unreadNotifications?: number
  onOpenNotifications?: () => void
  memberTeams?: ExpandedMemberTeam[]
}

export default function MoreSheet({ onClose, unreadNotifications = 0, onOpenNotifications, memberTeams = [] }: MoreSheetProps) {
  const { user, isApproved, isSuperAdmin, logout } = useAuth()
  const { isAdminMode } = useAdminMode()
  const { theme, toggleTheme } = useTheme()
  const { t } = useTranslation('nav')
  const { closing, startClose, onAnimEnd } = useAnimatedClose(onClose)

  // Prevent body scroll when sheet is open
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  return (
    <div className="fixed inset-0 z-50" onClick={startClose}>
      {/* Backdrop */}
      <div className={`absolute inset-0 bg-black/50 ${closing ? 'animate-fade-out' : 'animate-fade-in'}`} />

      {/* Sheet */}
      <div
        className={`pb-safe absolute bottom-0 left-0 right-0 max-h-[85vh] overflow-y-auto overscroll-contain rounded-t-2xl bg-white dark:bg-gray-800 ${closing ? 'animate-sheet-down' : 'animate-sheet-up'}`}
        onClick={(e) => e.stopPropagation()}
        onAnimationEnd={onAnimEnd}
      >
        {/* Handle — sticky so it's always visible */}
        <div className="sticky top-0 z-10 flex justify-center rounded-t-2xl bg-white pb-2 pt-3 dark:bg-gray-800">
          <div className="h-1 w-10 rounded-full bg-gray-300 dark:bg-gray-600" />
        </div>

        {/* Nav items */}
        <nav className="px-4 pb-2">
          {/* Notifications row */}
          {user && isApproved && onOpenNotifications && (
            <>
              <button
                onClick={onOpenNotifications}
                className="flex min-h-[48px] w-full items-center gap-4 rounded-lg px-4 py-3 text-base font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                <div className="relative">
                  <Bell className={iconClass} />
                  {unreadNotifications > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-red-500 px-0.5 text-[9px] font-bold text-white">
                      {unreadNotifications > 99 ? '99+' : unreadNotifications}
                    </span>
                  )}
                </div>
                {t('notifications')}
              </button>
              <div className="my-2 border-t border-gray-200 dark:border-gray-700" />
            </>
          )}
          {(!user || !isApproved) ? null : secondaryItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={startClose}
              className={({ isActive }) =>
                `flex min-h-[48px] items-center gap-4 rounded-lg px-4 py-3 text-base font-medium transition-colors ${
                  isActive
                    ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/50 dark:text-gold-400'
                    : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                }`
              }
            >
              {item.icon}
              {t(item.labelKey)}
            </NavLink>
          ))}

          {isAdminMode && (
            <>
              <div className="my-2 border-t border-gray-200 dark:border-gray-700" />
              <p className="mb-1 px-4 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                {t('admin')}
              </p>
              {adminItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={startClose}
                  className={({ isActive }) =>
                    `flex min-h-[48px] items-center gap-4 rounded-lg px-4 py-3 text-base font-medium transition-colors ${
                      isActive
                        ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/50 dark:text-gold-400'
                        : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                    }`
                  }
                >
                  {item.icon}
                  {t(item.labelKey)}
                </NavLink>
              ))}
            </>
          )}

          {isAdminMode && isSuperAdmin && (
            <>
              <div className="my-2 border-t border-gray-200 dark:border-gray-700" />
              <p className="mb-1 px-4 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                {t('superadmin')}
              </p>
              <NavLink
                to="/admin/data-health"
                onClick={startClose}
                className={({ isActive }) =>
                  `flex min-h-[48px] items-center gap-4 rounded-lg px-4 py-3 text-base font-medium transition-colors ${
                    isActive
                      ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/50 dark:text-gold-400'
                      : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                  }`
                }
              >
                <HeartPulse className={iconClass} />
                {t('dataHealth')}
              </NavLink>
              <NavLink
                to="/admin/audit-log"
                onClick={startClose}
                className={({ isActive }) =>
                  `flex min-h-[48px] items-center gap-4 rounded-lg px-4 py-3 text-base font-medium transition-colors ${
                    isActive
                      ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/50 dark:text-gold-400'
                      : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                  }`
                }
              >
                <ScrollText className={iconClass} />
                {t('auditLog')}
              </NavLink>
            </>
          )}
        </nav>

        {/* Divider */}
        <div className="mx-4 border-t border-gray-200 dark:border-gray-700" />

        {/* User section */}
        {user ? (
          <>
            <div className="px-4 py-3">
              {/* Profile link + name + teams */}
              <div className="flex items-center gap-3">
                <NavLink
                  to="/profile"
                  onClick={startClose}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-400 overflow-hidden"
                  aria-label={t('myProfile')}
                >
                  {user.photo ? (
                    <img
                      src={getFileUrl('members', user.id, user.photo)}
                      alt=""
                      className="h-10 w-10 rounded-full object-cover"
                    />
                  ) : (
                    <User className={iconClass} />
                  )}
                </NavLink>
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                    {user.first_name} {user.last_name}
                  </span>
                  {memberTeams.length > 0 && (
                    <div className="mt-0.5 flex flex-wrap gap-1">
                      {memberTeams.map((mt) => (
                        <TeamChip key={mt.id} team={asObj<Team>(mt.team)?.name ?? '?'} size="sm" />
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => {
                    logout()
                    startClose()
                  }}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                >
                  {t('logout')}
                </button>
              </div>
            </div>

            {/* Options section — expandable */}
            <div className="mx-4 border-t border-gray-200 dark:border-gray-700" />
            <OptionsAccordion theme={theme} toggleTheme={toggleTheme} onClose={startClose} />
          </>
        ) : (
          <>
            <div className="px-4 py-3 space-y-3">
              {/* Sign in — own row */}
              <NavLink
                to="/login"
                onClick={startClose}
                className="flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-2 text-base font-medium text-brand-600 transition-colors hover:bg-gray-100 dark:text-gold-400 dark:hover:bg-gray-700"
              >
                <LogIn className={iconClass} />
                {t('signIn')}
              </NavLink>

              {/* Toggles — expandable */}
              <OptionsAccordion theme={theme} toggleTheme={toggleTheme} onClose={startClose} />
            </div>
          </>
        )}

        {/* Legal links */}
        <div className="mx-4 border-t border-gray-200 dark:border-gray-700" />
        <div className="flex items-center justify-center gap-3 px-4 py-3 text-xs text-gray-400 dark:text-gray-500">
          <NavLink to="/datenschutz" onClick={startClose} className="hover:text-gray-600 dark:hover:text-gray-300">
            {t('privacy')}
          </NavLink>
          <span>·</span>
          <NavLink to="/impressum" onClick={startClose} className="hover:text-gray-600 dark:hover:text-gray-300">
            {t('impressum')}
          </NavLink>
        </div>
      </div>
    </div>
  )
}
